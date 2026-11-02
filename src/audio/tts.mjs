// Voiceover: Microsoft Edge neural voices via msedge-tts, cached on disk.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { HOME_DIR } from '../deps/locate.mjs';
import { decodeMono, trimSilence, normalisePeak, SR } from './wav.mjs';

const CACHE = path.join(HOME_DIR, 'cache', 'tts');
const xmlEscape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
const speakable = (s) => String(s).replace(/\*/g, '');

async function speakToFile(voice, rate, text, file) {
  const tts = new MsEdgeTTS({ connectionTimeoutMs: 15000, synthesisTimeoutMs: 60000 });
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovtts-'));
  try {
    const { audioFilePath } = await tts.toFile(dir, xmlEscape(text), { rate: rate || '+0%' });
    fs.copyFileSync(audioFilePath, file);
  } finally {
    try { tts.close(); } catch {}
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** Returns per scene: null or { samples: Float32Array (mono 48k, trimmed), seconds, file } */
export async function synthesize(storyboard, { onProgress = () => {} } = {}) {
  fs.mkdirSync(CACHE, { recursive: true });
  const { voice = 'en-IN-NeerjaExpressiveNeural', rate = '+0%' } = storyboard.voice || {};
  const out = [];
  const total = storyboard.scenes.filter(s => s.narration).length;
  let done = 0;
  for (const sc of storyboard.scenes) {
    if (!sc.narration) { out.push(null); continue; }
    const text = speakable(sc.narration);
    const key = crypto.createHash('sha1').update(JSON.stringify([voice, rate, text])).digest('hex').slice(0, 16);
    const mp3 = path.join(CACHE, `${key}.mp3`);
    if (!fs.existsSync(mp3) || fs.statSync(mp3).size < 500) {
      let lastErr;
      for (let attempt = 0; attempt < 3; attempt++) {
        try { await speakToFile(voice, rate, text, mp3); lastErr = null; break; }
        catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 800 * (attempt + 1))); }
      }
      if (lastErr) throw new Error(`text-to-speech failed (${lastErr.message || lastErr}). Check the internet connection or the voice name "${voice}".`);
    }
    const samples = normalisePeak(trimSilence(decodeMono(mp3)));
    out.push({ samples, seconds: +(samples.length / SR).toFixed(3), file: mp3 });
    onProgress({ stage: 'voice', done: ++done, total });
  }
  return out;
}
