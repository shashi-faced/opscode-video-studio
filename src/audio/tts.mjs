// Voiceover: Microsoft Edge neural voices via msedge-tts, cached on disk.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { HOME_DIR } from '../deps/locate.mjs';
import { decodeMono, trimSilenceLead, normalisePeak, SR } from './wav.mjs';
import { speechParts, PART_GAP } from '../timeline.mjs';
import { KIND_INFO } from '../compiler/characters.mjs';

// Character voices follow the narrator's language; age sets pitch and speed.
const VOICE_BY_LANG = {
  'hi-IN': { f: 'hi-IN-SwaraNeural', m: 'hi-IN-MadhurNeural' },
  'en-IN': { f: 'en-IN-NeerjaNeural', m: 'en-IN-PrabhatNeural' },
  'en-US': { f: 'en-US-AvaMultilingualNeural', m: 'en-US-AndrewMultilingualNeural' },
  'en-GB': { f: 'en-GB-SoniaNeural', m: 'en-GB-RyanNeural' },
};
const AGE_PROSODY = {
  kid: { pitch: 18, rate: '+6%' }, adult: { pitch: 0, rate: '+0%' }, old: { pitch: -8, rate: '-8%' },
  big: { pitch: -16, rate: '-4%' }, robot: { pitch: -6, rate: '+0%' },
};
const pct = (n) => `${n >= 0 ? '+' : ''}${n}%`;

/** Voice settings for every cast member (and bare kinds used as "who"). */
export function castVoices(storyboard) {
  const narrator = storyboard.voice?.voice || 'en-IN-NeerjaExpressiveNeural';
  const lang = VOICE_BY_LANG[narrator.slice(0, 5)] ? narrator.slice(0, 5) : 'en-IN';
  const map = new Map();
  const used = new Map();
  const add = (key, c) => {
    const info = KIND_INFO[c.kind] || KIND_INFO.rabbit;
    const pros = AGE_PROSODY[info.age] || AGE_PROSODY.adult;
    const voice = c.voice || VOICE_BY_LANG[lang][info.gender === 'm' ? 'm' : 'f'];
    let pitch = pros.pitch;
    // Two characters with the same voice and age would sound identical: shift each a little.
    const sig = `${voice}|${pitch}`;
    const n = used.get(sig) || 0;
    used.set(sig, n + 1);
    pitch += n * (n % 2 ? 7 : -7);
    map.set(key, { voice, pitch: c.pitch || pct(pitch), rate: c.rate || pros.rate });
  };
  for (const c of storyboard.cast || []) {
    const v = { ...c };
    add(String(c.id).toLowerCase(), v);
    if (c.name) map.set(String(c.name).toLowerCase(), map.get(String(c.id).toLowerCase()));
  }
  return {
    get(who) {
      const k = String(who || '').toLowerCase();
      if (!map.has(k)) add(k, { kind: KIND_INFO[k] ? k : 'rabbit' });
      return map.get(k);
    },
  };
}

const CACHE = path.join(HOME_DIR, 'cache', 'tts');
const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const speakable = (s) => String(s).replace(/\*/g, '');

/** Word timings from Edge metadata: [{ text, start, end }] in seconds from the audio start. */
export function parseWordBoundaries(raw) {
  const out = [];
  const re = /"Type":\s*"WordBoundary"[\s\S]*?"Offset":\s*(\d+),\s*"Duration":\s*(\d+)[\s\S]*?"Text":\s*("(?:[^"\\]|\\.)*")/g;
  let m;
  while ((m = re.exec(raw))) {
    let text;
    try { text = JSON.parse(m[3]); } catch { continue; }
    const start = +m[1] / 1e7;
    out.push({ text, start: +start.toFixed(3), end: +(start + +m[2] / 1e7).toFixed(3) });
  }
  return out;
}

async function speakToFile(voice, rate, text, file, pitch) {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 15000, synthesisTimeoutMs: 60000 });
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, { wordBoundaryEnabled: true });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovtts-'));
  try {
    const { audioFilePath, metadataFilePath } = await tts.toFile(dir, xmlEscape(text), { rate: rate || '+0%', ...(pitch && pitch !== '+0%' ? { pitch } : {}) });
    const words = metadataFilePath && fs.existsSync(metadataFilePath) ? parseWordBoundaries(fs.readFileSync(metadataFilePath, 'utf8')) : [];
    fs.writeFileSync(file.replace(/\.mp3$/, '.words.json'), JSON.stringify(words));
    fs.copyFileSync(audioFilePath, file);
  } finally {
    try { tts.close(); } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

async function speakCached(voice, rate, pitch, text, needWords = false) {
  const key = crypto.createHash('sha1').update(JSON.stringify([voice, rate, text, pitch || ''])).digest('hex').slice(0, 16);
  const mp3 = path.join(CACHE, `${key}.mp3`);
  const wordsFile = path.join(CACHE, `${key}.words.json`);
  // Clips cached before word timings existed are spoken again once when timings are needed.
  if (!fs.existsSync(mp3) || fs.statSync(mp3).size < 500 || (needWords && !fs.existsSync(wordsFile))) {
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try { await speakToFile(voice, rate, text, mp3, pitch); lastErr = null; break; }
      catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 800 * (attempt + 1))); }
    }
    if (lastErr) throw new Error(`text-to-speech failed (${lastErr.message || lastErr}). Check the internet connection or the voice name "${voice}".`);
  }
  const { samples, lead } = trimSilenceLead(decodeMono(mp3));
  let words = null;
  try {
    if (fs.existsSync(wordsFile)) words = JSON.parse(fs.readFileSync(wordsFile, 'utf8'))
      .map(w => ({ text: w.text, start: +Math.max(0, w.start - lead).toFixed(3), end: +Math.max(0, w.end - lead).toFixed(3) }));
  } catch { words = null; }
  return { samples: normalisePeak(samples), file: mp3, words: words && words.length ? words : null };
}

/**
 * Returns per scene: null or { samples (mono 48k, all parts joined), seconds, parts: [seconds per part], file }.
 * Narration uses the storyboard voice; each dialogue line uses its speaker's voice.
 */
export async function synthesize(storyboard, { onProgress = () => {} } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const { voice = 'en-IN-NeerjaExpressiveNeural', rate = '+0%' } = storyboard.voice || {};
  const voices = castVoices(storyboard);
  const out = [];
  const total = storyboard.scenes.reduce((n, sc) => n + speechParts(sc).length, 0);
  let done = 0;
  const gap = new Float32Array(Math.round(PART_GAP * SR));
  // Narration word timings drive the captions.
  const needWords = storyboard.captions !== false;
  for (const sc of storyboard.scenes) {
    const parts = speechParts(sc);
    if (!parts.length) { out.push(null); continue; }
    const clips = [];
    const partWords = [];
    let file = null, words = null;
    for (const p of parts) {
      const v = p.kind === 'line' ? voices.get(p.who) : { voice, rate, pitch: null };
      // Narration timings drive captions; dialogue-line timings drive the speaker's mouth (lip-sync).
      const clip = await speakCached(v.voice, v.rate, v.pitch, speakable(p.text), p.kind === 'line' || needWords);
      clips.push(clip.samples);
      partWords.push(clip.words);
      if (p.kind === 'narration') words = clip.words;
      file = file || clip.file;
      onProgress({ stage: 'voice', done: ++done, total });
    }
    const len = clips.reduce((n, c) => n + c.length, 0) + gap.length * (clips.length - 1);
    const samples = new Float32Array(len);
    let o = 0;
    clips.forEach((c, j) => { samples.set(c, o); o += c.length + (j < clips.length - 1 ? gap.length : 0); });
    out.push({ samples, seconds: +(samples.length / SR).toFixed(3), parts: clips.map(c => +(c.length / SR).toFixed(3)), file, words, partWords });
  }
  return out;
}
