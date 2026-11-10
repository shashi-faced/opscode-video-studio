// Audio for speech recognition: 16 kHz mono float PCM from any audio or video file, and a
// loudness map used to find where speech starts and to drop words heard over silence.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { findFfmpeg } from '../deps/locate.mjs';

export const ASR_SR = 16000;
export const HOP = 0.01;          // loudness frame step (s)
const WIN = 0.02;                 // loudness frame length (s)

function userError(message, fix) { const e = new Error(message); e.fix = fix; return e; }

/** Decode the first audio track of `file` to 16 kHz mono Float32Array. */
export function readPcm(file, { start = 0, duration = null } = {}) {
  if (!fs.existsSync(file)) throw userError(`file not found: ${file}`, 'check the path (relative to the workspace)');
  const ff = findFfmpeg();
  if (!ff) throw userError('ffmpeg not found', 'run video_doctor with install=true');
  const args = ['-v', 'error', ...(start ? ['-ss', String(start)] : []), '-i', file, ...(duration ? ['-t', String(duration)] : []), '-map', '0:a:0?', '-vn', '-ac', '1', '-ar', String(ASR_SR), '-f', 'f32le', '-'];
  let buf;
  try { buf = execFileSync(ff, args, { maxBuffer: 2 ** 32, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) {
    const msg = String(e.stderr || e.message);
    if (/does not contain any stream|matches no streams/i.test(msg)) throw userError(`${file} has no sound track`, 'captions need speech: use a video with audio');
    throw userError(`could not read the audio of ${file}: ${msg.trim().slice(-300)}`, 'check that the file is a video or audio file');
  }
  if (!buf.length) throw userError(`${file} has no sound track`, 'captions need speech: use a video with audio');
  // Copy into an aligned buffer (the pipe buffer's offset may not be a multiple of 4).
  const out = new Float32Array(buf.length >> 2);
  new Uint8Array(out.buffer).set(buf.subarray(0, out.length * 4));
  return out;
}

/** RMS loudness per HOP frame. */
export function loudness(pcm, sr = ASR_SR) {
  const hop = Math.round(HOP * sr), win = Math.round(WIN * sr);
  const n = Math.max(0, Math.floor((pcm.length - win) / hop) + 1);
  const out = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let e = 0;
    const o = f * hop;
    for (let k = 0; k < win; k++) { const v = pcm[o + k]; e += v * v; }
    out[f] = Math.sqrt(e / win);
  }
  return out;
}

const pct = (arr, p) => { if (!arr.length) return 0; const s = Float32Array.from(arr).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

/** Quiet level, speech level and the threshold between them. */
export function levels(rms) {
  const floor = pct(rms, 0.1), level = pct(rms, 0.9);
  return { floor, level, thr: floor + 0.2 * (level - floor) };
}

/** Loudest point (RMS) inside [a, b] seconds. */
export function peakIn(rms, a, b) {
  let m = 0;
  for (let f = Math.max(0, Math.floor(a / HOP)); f <= Math.min(rms.length - 1, Math.ceil(b / HOP)); f++) if (rms[f] > m) m = rms[f];
  return m;
}

/**
 * Where the sound around time t really starts: walk back while it is loud (t heard late), or forward
 * to the first loud frame (t heard early). null when it cannot be told (no quiet before it, or no sound).
 */
export function onsetNear(rms, t, thr, { back = 0.4, fwd = 0.15 } = {}) {
  let f = Math.round(t / HOP);
  if (f < 0 || f >= rms.length) return null;
  if (rms[f] > thr) {
    const stop = Math.max(0, f - Math.round(back / HOP));
    while (f > stop && rms[f - 1] > thr) f--;
    return f === stop && f > 0 ? null : f * HOP;
  }
  const stop = Math.min(rms.length - 1, f + Math.round(fwd / HOP));
  while (f < stop && rms[f] <= thr) f++;
  return rms[f] > thr ? f * HOP : null;
}
