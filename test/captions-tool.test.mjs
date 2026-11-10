// video_captions tool (plan 13, Phase 5).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { captionOptions } from '../src/captions/tool.mjs';
import { glueSymbols, guard } from '../src/asr/clean.mjs';
import { TOOL_DEFS, runTool } from '../src/tools.mjs';
import { modelReady } from '../src/asr/models.mjs';
import { findFfmpeg, findChrome } from '../src/deps/locate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'test', 'fixtures', 'asr');
const W = (text, start, end) => ({ text, start, end });
const ff = findFfmpeg();
const wide = { width: 1280, height: 720 }, tall = { width: 1080, height: 1920 };

test('style: given, alias, from the platform, else from the frame shape', () => {
  assert.equal(captionOptions({ style: 'karaoke' }, tall).style, 'karaoke');
  assert.equal(captionOptions({ style: 'subtitles' }, tall).style, 'line');
  assert.equal(captionOptions({ platform: 'youtube' }, tall).style, 'line');
  assert.equal(captionOptions({ platform: 'Insta Reel' }, wide).platform, 'insta-reel');
  assert.equal(captionOptions({}, tall).style, 'pop');
  assert.equal(captionOptions({}, wide).style, 'karaoke');
  assert.equal(captionOptions({ position: 'sideways' }, wide).position, 'bottom');
  assert.equal(captionOptions({ highlight: 'red;}body{' }, wide).highlight, undefined, 'only plain colours reach the CSS');
});

test('symbols heard as words join their word ("30" "%" → "30%", "₹" "999" → "₹999")', () => {
  const g = glueSymbols([W('30', 1, 1.2), W('%', 1.2, 1.3), W('off', 1.4, 1.6), W('₹', 2, 2.1), W('999', 2.1, 2.5), W('.', 2.5, 2.55)]);
  assert.deepEqual(g.map(w => w.text), ['30%', 'off', '₹999.']);
  assert.equal(g[2].start, 2);
  // Not dropped as "invented" any more.
  assert.equal(guard([W('30', 1, 1.2), W('%', 1.2, 1.3)]).dropped.length, 0);
});

test('the tool is declared and allowed', () => {
  const def = TOOL_DEFS.find(t => t.name === 'video_captions');
  assert.ok(def);
  assert.deepEqual(def.parameters.required, ['input']);
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent', 'manifest.json'), 'utf8'));
  assert.ok(m.allowedTools.includes('video_captions'));
  assert.match(m.systemPrompt, /video_captions/);
});

function makeVideo(dir, name, { audio = path.join(FIX, 'en.mp3'), size = '640x360', secs = 10 } = {}) {
  const f = path.join(dir, name);
  const args = ['-y', '-v', 'error', '-f', 'lavfi', '-i', `color=c=0x203050:size=${size}:rate=25:duration=${secs}`];
  if (audio) args.push('-i', audio, '-map', '0:v', '-map', '1:a', '-shortest', '-c:a', 'aac');
  args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', f);
  execFileSync(ff, args);
  return f;
}

test('clear errors: no input, missing file, no sound', { skip: ff ? false : 'ffmpeg not found' }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-ct-'));
  assert.match((await runTool('video_captions', {}, { cwd: d })).text, /missing "input"/);
  assert.match((await runTool('video_captions', { input: 'nope.mp4' }, { cwd: d })).text, /file not found/);
  makeVideo(d, 'mute.mp4', { audio: null, secs: 2 });
  const r = await runTool('video_captions', { input: 'mute.mp4' }, { cwd: d });
  assert.equal(r.ok, false);
  assert.match(r.text, /no sound track/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('edited words.json: files written without listening; a script keeps its spelling', { skip: ff ? false : 'ffmpeg not found' }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-ct-'));
  makeVideo(d, 'v.mp4', { secs: 4 });
  fs.writeFileSync(path.join(d, 'w.json'), JSON.stringify({ language: 'en', words: [W('hello', 0.5, 0.9), W('opscode', 1, 1.6), W('bad', 2, 1), W('', 2, 3)] }));
  const r = await runTool('video_captions', { input: 'v.mp4', words: 'w.json', burn: false, style: 'karaoke' }, { cwd: d });
  assert.equal(r.ok, true, r.text);
  assert.equal(r.videoFile, undefined, 'not burned');
  assert.equal(r.data.source, 'edited');
  assert.equal(r.data.wordCount, 3, 'empty words dropped; a backwards time is fixed, not dropped');
  for (const k of ['srt', 'vtt', 'words']) assert.ok(fs.existsSync(r.data[k]), k);
  assert.ok(fs.readFileSync(r.data.srt, 'utf8').includes('hello opscode bad'));
  const words = JSON.parse(fs.readFileSync(r.data.words, 'utf8'));
  assert.ok(words.about.includes('words'));
  assert.equal(words.words[1].text, 'opscode');
  // A script: the user's spelling, the file's timing.
  fs.writeFileSync(path.join(d, 'script.txt'), 'Hello *Opscode* team');
  const s = await runTool('video_captions', { input: 'v.mp4', words: 'w.json', script: 'script.txt', burn: false, out: 'scripted.mp4' }, { cwd: d });
  assert.equal(s.ok, true, s.text);
  assert.ok(fs.readFileSync(s.data.srt, 'utf8').includes('Hello Opscode team'));
  assert.ok(s.text.includes('Script spelling used'));
  fs.rmSync(d, { recursive: true, force: true });
});

const full = modelReady('small') && ff && findChrome() ? false : 'needs whisper-small, ffmpeg and Chrome';
test('listen and burn: a captioned MP4, subtitles and a preview frame', { skip: full, timeout: 300000 }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-ct-'));
  makeVideo(d, 'talk.mp4');
  const r = await runTool('video_captions', { input: 'talk.mp4', style: 'pop' }, { cwd: d });
  assert.equal(r.ok, true, r.text);
  assert.equal(r.videoFile, path.join(d, 'talk-captions.mp4'));
  assert.ok(fs.existsSync(r.videoFile));
  assert.ok(r.image && r.image.startsWith('data:image/jpeg;base64,'), 'preview frame for the chat');
  assert.equal(r.data.language, 'en');
  assert.ok(r.data.wordCount >= 22, `${r.data.wordCount} words`);
  assert.match(r.text, /Captions burned in/);
  assert.match(fs.readFileSync(r.data.srt, 'utf8'), /together/);
  fs.rmSync(d, { recursive: true, force: true });
});
