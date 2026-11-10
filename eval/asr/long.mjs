// Plan 13 Phase 1: long audio (30 s windows), silence and music (invented words).
//   node eval/asr/long.mjs [model=small] [dtype=q8]
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { HOME_DIR, findFfmpeg } from '../../src/deps/locate.mjs';

const [modelArg = 'small', dtypeArg = 'q8'] = process.argv.slice(2);
const MODELS = { base: 'onnx-community/whisper-base_timestamped', small: 'onnx-community/whisper-small_timestamped' };
const req = createRequire(path.join(HOME_DIR, 'asr', 'package.json'));
const tf = await import(pathToFileURL(req.resolve('@huggingface/transformers')).href);
tf.env.cacheDir = path.join(HOME_DIR, 'models', 'whisper');
const ff = findFfmpeg();
const CACHE = path.join(HOME_DIR, 'cache', 'tts');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-asr-'));
const pcm = (args) => { const b = execFileSync(ff, ['-v', 'error', ...args, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 1 << 30 }); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');

// Long file: 24 English clips with 0.8 s gaps; the true word times shift by each clip's offset.
const keys = fs.readdirSync(CACHE).filter(f => f.endsWith('.words.json')).sort().map(f => f.replace('.words.json', ''))
  .filter(k => { try { const w = JSON.parse(fs.readFileSync(path.join(CACHE, k + '.words.json'), 'utf8')); return w.length >= 6 && !/[ऀ-ॿ]/.test(w.map(x => x.text).join(' ')); } catch { return false; } }).slice(0, 24);
const parts = [], truth = [];
let off = 0;
const gap = new Float32Array(Math.round(0.8 * 16000));
for (const k of keys) {
  const a = pcm(['-i', path.join(CACHE, k + '.mp3')]);
  for (const w of JSON.parse(fs.readFileSync(path.join(CACHE, k + '.words.json'), 'utf8'))) truth.push({ text: w.text, start: off + w.start });
  parts.push(a, gap);
  off += (a.length + gap.length) / 16000;
}
const long = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
let o = 0; for (const p of parts) { long.set(p, o); o += p.length; }

const asr = await tf.pipeline('automatic-speech-recognition', MODELS[modelArg], { dtype: dtypeArg, device: 'cpu' });
const run = async (audio, language = 'english') => {
  const s = Date.now();
  const r = await asr(audio, { return_timestamps: 'word', language, task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 });
  return { r, took: (Date.now() - s) / 1000 };
};

const out = {};
{
  const { r, took } = await run(long);
  const heard = r.chunks.map(c => ({ text: c.text.trim(), start: c.timestamp[0] }));
  // In-order text match, then the start error after removing the median shift.
  const A = truth.map(w => norm(w.text)), B = heard.map(w => norm(w.text));
  const pairs = []; let j = 0;
  for (let i = 0; i < A.length; i++) for (let k = j; k < Math.min(B.length, j + 6); k++) if (A[i] && A[i] === B[k]) { pairs.push([truth[i].start, heard[k].start]); j = k + 1; break; }
  const d = pairs.map(([t, h]) => (h - t) * 1000).sort((a, b) => a - b);
  const bias = d[d.length >> 1];
  const res = d.map(x => Math.abs(x - bias)).sort((a, b) => a - b);
  const monotonic = heard.every((w, i) => i === 0 || w.start >= heard[i - 1].start - 0.01);
  // Drift: the shift in the first and last quarter of the file (window joins must not slide the times).
  const q1 = pairs.slice(0, pairs.length >> 2).map(([t, h]) => h - t).sort((a, b) => a - b);
  const q4 = pairs.slice(-(pairs.length >> 2)).map(([t, h]) => h - t).sort((a, b) => a - b);
  out.long = { audioSec: +(long.length / 16000).toFixed(1), took: +took.toFixed(1), rtf: +(took / (long.length / 16000)).toFixed(3), trueWords: truth.length, heardWords: heard.length, matched: +(pairs.length / truth.length).toFixed(3), biasMs: Math.round(bias), afterBiasMedianMs: Math.round(res[res.length >> 1]), afterBiasP90Ms: Math.round(res[Math.floor(res.length * 0.9)]), driftMs: Math.round((q4[q4.length >> 1] - q1[q1.length >> 1]) * 1000), monotonic };
  console.log('long', JSON.stringify(out.long));
}
for (const [name, args] of [
  ['silence20s', ['-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '20']],
  ['noise20s', ['-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink:a=0.05']],
  ['music20s', ['-f', 'lavfi', '-i', 'sine=f=262:d=20', '-f', 'lavfi', '-i', 'sine=f=330:d=20', '-f', 'lavfi', '-i', 'sine=f=392:d=20', '-filter_complex', 'amix=inputs=3,volume=2,tremolo=f=2:d=0.7']],
]) {
  const { r, took } = await run(pcm(args));
  out[name] = { words: (r.chunks || []).length, text: r.text.trim().slice(0, 120), took: +took.toFixed(1) };
  console.log(name, JSON.stringify(out[name]));
}
out.peakRssMB = Math.round(process.resourceUsage().maxRSS / 1024);
fs.mkdirSync(new URL('./runs/', import.meta.url).pathname, { recursive: true });
fs.writeFileSync(new URL(`./runs/long-${modelArg}-${dtypeArg}.json`, import.meta.url).pathname, JSON.stringify(out, null, 2));
console.log('peakRssMB', out.peakRssMB);
fs.rmSync(tmp, { recursive: true, force: true });
