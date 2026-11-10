// Speech → words with times (plan 13, Phase 2). Whisper through transformers.js, on the CPU.
//
//   const t = await transcribe('clip.mp4', { language: 'auto', quality: 'balanced', onProgress });
//   t.words  // [{ text, start, end }] in seconds from the start of the file
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { HOME_DIR } from '../deps/locate.mjs';
import { readPcm, loudness, ASR_SR, HOP } from './audio.mjs';
import { loadTransformers, runtimeVersion } from './runtime.mjs';
import { MODEL_DIR, QUALITY, modelInfo, modelReady } from './models.mjs';
import { measureShift, guard, tidy, applyShift, segmentsOf } from './clean.mjs';

export const ENGINE = 'transformers';
const CLEAN_VERSION = 1;                 // bump when the clean-up rules change (old cache entries are ignored)
export const CACHE_DIR = path.join(HOME_DIR, 'cache', 'asr');
const WINDOW = 120, OVERLAP = 5;         // long audio is heard in 2-minute windows (progress, memory)

const LANG_NAMES = { english: 'en', hindi: 'hi', hinglish: 'hi', urdu: 'ur', bengali: 'bn', tamil: 'ta', telugu: 'te', marathi: 'mr', gujarati: 'gu', punjabi: 'pa', kannada: 'kn', malayalam: 'ml', spanish: 'es', french: 'fr', german: 'de', arabic: 'ar', japanese: 'ja', chinese: 'zh', portuguese: 'pt', russian: 'ru', italian: 'it', korean: 'ko', indonesian: 'id', nepali: 'ne' };

/** "Hindi" / "hi-IN" / "hi" → "hi"; "auto" or empty → null. */
export function languageCode(lang) {
  if (!lang || /^auto$/i.test(lang)) return null;
  const s = String(lang).trim().toLowerCase();
  return LANG_NAMES[s] || s.split(/[-_]/)[0];
}

function userError(message, fix) { const e = new Error(message); e.fix = fix; return e; }

const pipes = new Map();
async function pipelineFor(id) {
  if (pipes.has(id)) return pipes.get(id);
  if (!modelReady(id)) {
    const m = modelInfo(id);
    throw userError(`the ${m.label} speech model is not installed`, `run video_assets with action "install" and set "whisper-${id}" (${Math.round(m.size / 1048576)} MB, once)`);
  }
  const tf = await loadTransformers();
  tf.env.localModelPath = MODEL_DIR + path.sep;
  tf.env.allowRemoteModels = false;
  tf.env.allowLocalModels = true;
  const p = { tf, asr: await tf.pipeline('automatic-speech-recognition', modelInfo(id).repo, { dtype: 'q8', device: 'cpu' }) };
  pipes.set(id, p);
  return p;
}

/** Free loaded models (about 1–2 GB of memory each). */
export async function unloadModels() {
  for (const p of pipes.values()) { try { await p.asr.dispose(); } catch { /* already freed */ } }
  pipes.clear();
}

/** Most likely language of the loudest 30 s: the model's first-token language scores. */
async function detectLanguage({ tf, asr }, pcm, rms) {
  const n30 = 30 * ASR_SR, fpw = Math.round(30 / HOP), step = Math.round(10 / HOP);
  let best = 0, bestE = -1;
  for (let f = 0; f + 1 < rms.length; f += step) {
    let e = 0;
    for (let k = f; k < Math.min(rms.length, f + fpw); k++) e += rms[k];
    if (e > bestE) { bestE = e; best = f; }
  }
  const a = pcm.subarray(Math.round(best * HOP * ASR_SR), Math.round(best * HOP * ASR_SR) + n30);
  const gc = asr.model.generation_config;
  const inputs = await asr.processor(a);
  const out = await asr.model({ ...inputs, decoder_input_ids: new tf.Tensor('int64', BigInt64Array.from([BigInt(gc.decoder_start_token_id)]), [1, 1]) });
  const L = out.logits.data;
  let lang = 'en', top = -Infinity;
  for (const [tok, id] of Object.entries(gc.lang_to_id)) if (L[id] > top) { top = L[id]; lang = tok.replace(/[<|>]/g, ''); }
  return lang;
}

/** Heard words of one stretch of audio, in seconds from its start. */
async function hear({ asr }, pcm, language) {
  const r = await asr(pcm, { return_timestamps: 'word', language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
  return (r.chunks || []).map(c => ({ text: c.text, start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] + 0.2 }));
}

/**
 * @param input  path to an audio/video file, or { pcm: Float32Array (16 kHz mono) }
 * @param opts.language  'auto' | 'en' | 'hi' | 'Hindi' | ...
 * @param opts.quality   'fast' (base, English) | 'balanced' (small, all languages)
 * @param opts.keep      phrases from a known script (never dropped as stock phrases)
 * @param opts.cache     reuse an earlier result for the same audio (default true)
 * @returns Transcript { engine, model, revision, language, languageDetected, duration, shift, words, segments, dropped, notes }
 */
export async function transcribe(input, { language = 'auto', quality = 'balanced', keep = [], cache = true, onProgress = () => {} } = {}) {
  let id = QUALITY[quality] || (modelInfo(quality) && quality);
  const pcm = input && input.pcm ? input.pcm : readPcm(input);
  const duration = pcm.length / ASR_SR;
  let code = languageCode(language);
  const notes = [];
  // English-only quality with another language: the small model is needed for the right script.
  if (id === 'base' && code && code !== 'en') { id = 'small'; notes.push('used the small model: the fast model writes Hindi and other languages in the wrong script'); }

  const keepN = new Set(keep.map(k => String(k).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '')));
  const audioSha1 = crypto.createHash('sha1').update(Buffer.from(pcm.buffer, pcm.byteOffset, pcm.byteLength)).digest('hex');
  const keyOf = (mid, lang) => crypto.createHash('sha1').update(JSON.stringify([audioSha1, ENGINE, runtimeVersion(), modelInfo(mid).revision, lang, CLEAN_VERSION, [...keepN].sort()])).digest('hex').slice(0, 20);
  if (cache && code) {
    const f = path.join(CACHE_DIR, keyOf(id, code) + '.json');
    if (fs.existsSync(f)) { try { return { ...JSON.parse(fs.readFileSync(f, 'utf8')), cached: true }; } catch { /* re-hear */ } }
  }

  let p = await pipelineFor(id);
  const rms = loudness(pcm);
  let languageDetected = false;
  if (!code) {
    onProgress({ stage: 'listen', step: 'language' });
    code = await detectLanguage(p, pcm, rms);
    languageDetected = true;
    if (id === 'base' && code !== 'en') {
      if (modelReady('small')) { id = 'small'; p = await pipelineFor(id); notes.push(`heard ${code}: used the small model for the right script`); }
      else notes.push(`heard ${code}: the fast model may write it in the wrong script; install whisper-small for better captions`);
    }
    if (cache) {
      const f = path.join(CACHE_DIR, keyOf(id, code) + '.json');
      if (fs.existsSync(f)) { try { return { ...JSON.parse(fs.readFileSync(f, 'utf8')), languageDetected, cached: true }; } catch { /* re-hear */ } }
    }
  }

  // Long audio: 2-minute windows overlapping by 5 s; each window keeps the words that start before the middle of the overlap.
  let raw = [];
  const step = WINDOW - OVERLAP;
  const windows = Math.max(1, Math.ceil((duration - OVERLAP) / step));
  for (let k = 0; k < windows; k++) {
    const s = k * step, e = Math.min(duration, s + WINDOW);
    const cutLo = k === 0 ? -Infinity : s + OVERLAP / 2, cutHi = k === windows - 1 ? Infinity : e - OVERLAP / 2;
    const ws = await hear(p, pcm.subarray(Math.round(s * ASR_SR), Math.round(e * ASR_SR)), code);
    for (const w of ws) { const t = w.start + s; if (t >= cutLo && t < cutHi) raw.push({ text: w.text, start: t, end: w.end + s }); }
    onProgress({ stage: 'listen', done: Math.round(e), total: Math.round(duration) });
  }

  raw = tidy(raw, Infinity);
  const sh = measureShift(raw, rms, code);
  const g = guard(tidy(applyShift(raw, sh.shift), Infinity), { rms, duration, keep: keepN });
  const words = tidy(g.words, duration);
  const t = {
    engine: ENGINE, engineVersion: runtimeVersion(), model: `whisper-${id}`, revision: modelInfo(id).revision,
    language: code, languageDetected, duration: +duration.toFixed(3), audioSha1,
    shift: sh.shift, shiftMeasured: sh.measured,
    words,
    segments: segmentsOf(words).map(s => ({ start: s[0].start, end: s.at(-1).end, text: s.map(w => w.text).join(' ').replace(/\s+([,.!?।])/g, '$1') })),
    dropped: g.dropped, notes,
  };
  if (cache) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
    const f = path.join(CACHE_DIR, keyOf(id, code) + '.json');
    fs.writeFileSync(f + '.tmp', JSON.stringify(t));
    fs.renameSync(f + '.tmp', f);
  }
  return t;
}
