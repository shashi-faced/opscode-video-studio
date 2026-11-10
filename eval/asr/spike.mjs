// Plan 13 Phase 1 spike: how well and how fast Whisper (transformers.js) finds word times.
// Ground truth: cached Edge TTS clips, whose words.json holds the exact word boundaries.
//
//   node eval/asr/spike.mjs [model=base|small|turbo] [dtype=q8|fp32|...] [perLang=10]
//
// Needs @huggingface/transformers installed in ~/.opscode/agents/video-studio/asr (not a package dependency).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { HOME_DIR, findFfmpeg } from '../../src/deps/locate.mjs';

const [modelArg = 'base', dtypeArg = 'q8', perLangArg = '10'] = process.argv.slice(2);
const MODELS = { tiny: 'onnx-community/whisper-tiny_timestamped', base: 'onnx-community/whisper-base_timestamped', small: 'onnx-community/whisper-small_timestamped', turbo: 'onnx-community/whisper-large-v3-turbo_timestamped' };
const ASR = path.join(HOME_DIR, 'asr');
const req = createRequire(path.join(ASR, 'package.json'));
const tf = await import(pathToFileURL(req.resolve('@huggingface/transformers')).href);
tf.env.cacheDir = path.join(HOME_DIR, 'models', 'whisper');
const ff = findFfmpeg();

const CACHE = path.join(HOME_DIR, 'cache', 'tts');
const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');

function pickClips(perLang) {
  const by = { en: [], hi: [] };
  for (const f of fs.readdirSync(CACHE).filter(f => f.endsWith('.words.json')).sort()) {
    let w; try { w = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
    if (!w || w.length < 6) continue;
    const t = w.map(x => x.text).join(' ');
    by[/[ऀ-ॿ]/.test(t) ? 'hi' : 'en'].push({ key: f.replace('.words.json', ''), words: w });
  }
  // Longest clips first: more words per clip, more timing points.
  for (const k in by) by[k] = by[k].sort((a, b) => b.words.length - a.words.length).slice(0, perLang).map(c => ({ ...c, lang: k }));
  return [...by.en, ...by.hi];
}

function pcm16k(file) {
  const buf = execFileSync(ff, ['-v', 'error', '-i', file, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

// Edit distance on word lists (for WER).
function editDist(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// Pair heard words with true words by text, in order (LCS), then compare start times.
function pairs(truth, heard) {
  const A = truth.map(w => norm(w.text)), B = heard.map(w => norm(w.text));
  const L = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--)
    L[i][j] = A[i] && A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] && A[i] === B[j]) { out.push([truth[i], heard[j]]); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  return out;
}

const q = (arr, p) => { if (!arr.length) return NaN; const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

const clips = pickClips(+perLangArg);
const t0 = Date.now();
const asr = await tf.pipeline('automatic-speech-recognition', MODELS[modelArg], { dtype: dtypeArg, device: 'cpu' });
const loadSec = (Date.now() - t0) / 1000;

const results = [];
for (const c of clips) {
  const audio = pcm16k(path.join(CACHE, c.key + '.mp3'));
  const secs = audio.length / 16000;
  const s = Date.now();
  const r = await asr(audio, { return_timestamps: 'word', language: c.lang === 'hi' ? 'hindi' : 'english', task: 'transcribe', chunk_length_s: 30 });
  const took = (Date.now() - s) / 1000;
  const heard = (r.chunks || []).map(ch => ({ text: ch.text.trim(), start: ch.timestamp[0], end: ch.timestamp[1] ?? ch.timestamp[0] }));
  const T = c.words.map(w => norm(w.text)).filter(Boolean);
  const H = heard.map(w => norm(w.text)).filter(Boolean);
  const pr = pairs(c.words, heard);
  const signed = pr.map(([t, h]) => (h.start - t.start) * 1000);
  const errs = signed.map(Math.abs);
  const endSigned = pr.map(([t, h]) => (h.end - t.end) * 1000);
  results.push({ key: c.key, lang: c.lang, secs: +secs.toFixed(2), took: +took.toFixed(2), wer: +(editDist(T, H) / T.length).toFixed(3), matched: +(pr.length / c.words.length).toFixed(2), startErrMs: errs.map(e => Math.round(e)), startSignedMs: signed.map(Math.round), endSignedMs: endSigned.map(Math.round), heardScript: /[ऀ-ॿ]/.test(r.text) ? 'devanagari' : /[؀-ۿ]/.test(r.text) ? 'arabic' : 'latin', text: r.text.trim().slice(0, 90) });
  process.stdout.write(`${c.lang} ${c.key} ${secs.toFixed(1)}s took ${took.toFixed(2)}s wer ${results.at(-1).wer} matched ${results.at(-1).matched} median ${Math.round(q(errs, 0.5))}ms\n`);
}

const summary = {};
for (const lang of ['en', 'hi']) {
  const rs = results.filter(r => r.lang === lang);
  if (!rs.length) continue;
  const errs = rs.flatMap(r => r.startErrMs);
  const sg = rs.flatMap(r => r.startSignedMs), bias = q(sg, 0.5);
  const eg = rs.flatMap(r => r.endSignedMs);
  const audio = rs.reduce((a, r) => a + r.secs, 0), took = rs.reduce((a, r) => a + r.took, 0);
  summary[lang] = { clips: rs.length, audioSec: +audio.toFixed(1), rtf: +(took / audio).toFixed(3), werMean: +(rs.reduce((a, r) => a + r.wer, 0) / rs.length).toFixed(3), matched: +(rs.reduce((a, r) => a + r.matched, 0) / rs.length).toFixed(2), startMedianMs: q(errs, 0.5), startP90Ms: q(errs, 0.9), startBiasMs: bias, startAfterBiasMedianMs: q(sg.map(x => Math.abs(x - bias)), 0.5), startAfterBiasP90Ms: q(sg.map(x => Math.abs(x - bias)), 0.9), endBiasMs: q(eg, 0.5), scripts: [...new Set(rs.map(r => r.heardScript))] };
}
const report = { model: MODELS[modelArg], dtype: dtypeArg, cpus: os.cpus().length, loadSec: +loadSec.toFixed(1), peakRssMB: Math.round(process.resourceUsage().maxRSS / 1024), summary, results };
const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), 'runs');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, `${modelArg}-${dtypeArg}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ model: report.model, dtype: report.dtype, loadSec: report.loadSec, peakRssMB: report.peakRssMB, summary }, null, 2));
