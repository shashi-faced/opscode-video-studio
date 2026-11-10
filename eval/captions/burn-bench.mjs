// Plan 13 Phase 4: burn captions into a plain video and compare with ffmpeg's ASS subtitles.
//   node eval/captions/burn-bench.mjs <seconds=60> <WxH=1920x1080> <lang=en|hi> <style=pop>
// The video loops a test clip's voice; Hindi uses the true script (spelling) with heard timing.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFfmpeg } from '../../src/deps/locate.mjs';
import { transcribe } from '../../src/asr/transcribe.mjs';
import { captionsFromWords, captionsFromScript, maxCharsFor } from '../../src/captions/build.mjs';
import { burnCaptions } from '../../src/captions/burn.mjs';
import { cuesFrom, plainCaption } from '../../src/captions/formats.mjs';

const [secs = '60', size = '1920x1080', lang = 'en', style = 'pop'] = process.argv.slice(2);
const [W, H] = size.split('x').map(Number);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FIX = path.join(ROOT, 'test', 'fixtures', 'asr');
const ff = findFfmpeg();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-burn-'));
const input = path.join(dir, 'in.mp4');
execFileSync(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', `testsrc2=size=${W}x${H}:rate=30:duration=${secs}`, '-stream_loop', '-1', '-i', path.join(FIX, `${lang}.mp3`),
  '-t', secs, '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', input]);

let t = Date.now();
const tr = await transcribe(input, { language: lang });
const listenSec = (Date.now() - t) / 1000;
let caps;
if (lang === 'hi') {
  const one = JSON.parse(fs.readFileSync(path.join(FIX, 'hi.words.json'), 'utf8')).map(w => w.text).join(' ');
  const reps = Math.round(tr.duration / 6.05);
  caps = captionsFromScript(Array(reps).fill(one).join(' '), tr.words, tr.duration, style, { maxChars: maxCharsFor(W, H) }).captions;
} else caps = captionsFromWords(tr.words, style, { maxChars: maxCharsFor(W, H) });

const out = path.join(dir, 'ours.mp4');
const r = await burnCaptions({ input, captions: caps, out, style });

// ASS through libass (no HarfBuzz in this ffmpeg): same cues, plain style.
const cues = cuesFrom(caps);
const at = (x) => { const cs = Math.round(x * 100); return `${Math.floor(cs / 360000)}:${String(Math.floor(cs / 6000) % 60).padStart(2, '0')}:${String(Math.floor(cs / 100) % 60).padStart(2, '0')}.${String(cs % 100).padStart(2, '0')}`; };
const ass = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${W}\nPlayResY: ${H}\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, OutlineColour, BorderStyle, Outline, Shadow, Alignment, MarginV\nStyle: Default,Hind,${Math.round(Math.min(W, H) * 0.06)},&H00FFFFFF,&H00000000,1,4,0,2,${Math.round(H * 0.08)}\n\n[Events]\nFormat: Layer, Start, End, Style, Text\n${cues.map(c => `Dialogue: 0,${at(c.start)},${at(c.end)},Default,${plainCaption(c.text)}`).join('\n')}\n`;
fs.writeFileSync(path.join(dir, 'subs.ass'), ass);
t = Date.now();
execFileSync(ff, ['-y', '-v', 'error', '-i', input, '-vf', `subtitles=subs.ass:fontsdir=${path.join(ROOT, 'fonts')}`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-c:a', 'copy', path.join(dir, 'ass.mp4')], { cwd: dir });
const assSec = (Date.now() - t) / 1000;

// A frame from each, at a moment with a caption.
const mid = cues[Math.floor(cues.length / 2)];
const at2 = ((mid.start + mid.end) / 2).toFixed(2);
for (const n of ['ours', 'ass']) execFileSync(ff, ['-y', '-v', 'error', '-ss', at2, '-i', path.join(dir, `${n}.mp4`), '-frames:v', '1', '-vf', `crop=iw:ih*0.35:0:ih*0.65,scale=${Math.min(W, 960)}:-1`, path.join(dir, `${n}.jpg`)]);
console.log(JSON.stringify({ secs: +secs, size, lang, style, words: tr.words.length, listenSec, ours: { seconds: r.seconds, states: r.states, stills: r.stills }, assSeconds: assSec, frames: [path.join(dir, 'ours.jpg'), path.join(dir, 'ass.jpg')] }));
