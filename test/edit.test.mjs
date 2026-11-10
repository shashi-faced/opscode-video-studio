// Editing tools (trim, concat, mix, reframe, inspect, gif) on small clips made with ffmpeg.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { TOOL_DEFS, runTool } from '../src/tools.mjs';
import { findFfmpeg } from '../src/deps/locate.mjs';
import { inspectMedia } from '../src/edit/ffmpegCore.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CLI = path.join(ROOT, 'bin', 'opscode-video.mjs');
const ff = findFfmpeg();
const skip = ff ? false : 'ffmpeg not found';
let dir, clip1, clip2, bgm;

before(() => {
  if (!ff) return;
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-edit-'));
  clip1 = path.join(dir, 'clip1.mp4');
  clip2 = path.join(dir, 'clip2.mp4');
  bgm = path.join(dir, 'bgm.mp3');
  const make = (secs, hz, out) => execFileSync(ff, ['-y', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `testsrc=duration=${secs}:size=1280x720:rate=30`,
    '-f', 'lavfi', '-i', `sine=frequency=${hz}:duration=${secs}`,
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '128k', out]);
  make(6, 440, clip1);
  make(4, 880, clip2);
  execFileSync(ff, ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=5', '-c:a', 'libmp3lame', '-b:a', '128k', bgm]);
});
after(() => { if (dir) fs.rmSync(dir, { recursive: true, force: true }); });

const near = (v, want, tol, what) => assert.ok(Math.abs(v - want) <= tol, `${what}: expected ~${want}, got ${v}`);

test('the 6 editing tools are declared', () => {
  const names = TOOL_DEFS.map(t => t.name);
  for (const n of ['video_trim', 'video_concat', 'video_audio_mix', 'video_reframe', 'video_inspect', 'video_to_gif']) assert.ok(names.includes(n), n);
  assert.equal(new Set(names).size, names.length, 'tool names are unique');
});

test('the manifest allows the editing tools', () => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent', 'manifest.json'), 'utf8'));
  for (const n of ['video_trim', 'video_concat', 'video_audio_mix', 'video_reframe', 'video_inspect', 'video_to_gif']) assert.ok(m.allowedTools.includes(n), n);
});

test('video_inspect reads size, length and streams', { skip }, async () => {
  const r = await runTool('video_inspect', { input: clip1 }, { cwd: dir });
  assert.equal(r.ok, true, r.text);
  assert.equal(r.data.width, 1280);
  assert.equal(r.data.height, 720);
  assert.ok(r.data.hasVideo && r.data.hasAudio);
  near(r.data.duration, 6, 0.2, 'duration');
});

test('video_trim exact cuts frame-accurately and makes a poster', { skip }, async () => {
  const out = path.join(dir, 'trim-exact.mp4');
  const r = await runTool('video_trim', { input: clip1, start: 1, end: 4, mode: 'exact', out }, { cwd: dir });
  assert.equal(r.ok, true, r.text);
  assert.equal(r.videoFile, out);
  assert.ok(r.imageFile && fs.existsSync(r.imageFile));
  const m = await inspectMedia(out, { cwd: dir });
  near(m.duration, 3, 0.2, 'duration');
  assert.equal(m.width, 1280);
});

test('video_trim fast does a stream copy', { skip }, async () => {
  const out = path.join(dir, 'trim-fast.mp4');
  const r = await runTool('video_trim', { input: clip1, start: '00:00:01', duration: 2, mode: 'fast', out }, { cwd: dir });
  assert.equal(r.ok, true, r.text);
  assert.ok(fs.existsSync(out));
});

test('video_concat joins clips in order', { skip }, async () => {
  const out = path.join(dir, 'merged.mp4');
  const r = await runTool('video_concat', { inputs: [clip1, clip2], out }, { cwd: dir });
  assert.equal(r.ok, true, r.text);
  assert.equal(r.data.clipsCount, 2);
  near((await inspectMedia(out, { cwd: dir })).duration, 10, 0.3, 'duration');
});

test('video_audio_mix mixes and replaces audio', { skip }, async () => {
  const mixed = path.join(dir, 'mixed.mp4');
  const r1 = await runTool('video_audio_mix', { video: clip1, audio: bgm, mode: 'mix', audioVolume: 0.3, out: mixed }, { cwd: dir });
  assert.equal(r1.ok, true, r1.text);
  assert.equal(r1.data.mode, 'mixed');
  const m = await inspectMedia(mixed, { cwd: dir });
  assert.ok(m.hasAudio);
  near(m.duration, 6, 0.2, 'video length kept');
  const r2 = await runTool('video_audio_mix', { video: clip2, audio: bgm, mode: 'replace', out: path.join(dir, 'replaced.mp4') }, { cwd: dir });
  assert.equal(r2.ok, true, r2.text);
  assert.equal(r2.data.mode, 'replaced');
});

test('video_reframe makes 9:16 and 1:1', { skip }, async () => {
  const reel = path.join(dir, 'reel.mp4');
  const r1 = await runTool('video_reframe', { input: clip1, format: '9:16', style: 'blur_pad', out: reel }, { cwd: dir });
  assert.equal(r1.ok, true, r1.text);
  const m1 = await inspectMedia(reel, { cwd: dir });
  assert.deepEqual([m1.width, m1.height], [1080, 1920]);
  const sq = path.join(dir, 'square.mp4');
  const r2 = await runTool('video_reframe', { input: clip2, format: '1:1', style: 'crop', out: sq }, { cwd: dir });
  assert.equal(r2.ok, true, r2.text);
  const m2 = await inspectMedia(sq, { cwd: dir });
  assert.deepEqual([m2.width, m2.height], [1080, 1080]);
});

test('video_to_gif makes a GIF', { skip }, async () => {
  const out = path.join(dir, 'clip.gif');
  const r = await runTool('video_to_gif', { input: clip1, start: 1, duration: 2, fps: 12, width: 320, out }, { cwd: dir });
  assert.equal(r.ok, true, r.text);
  assert.ok(fs.statSync(out).size > 1000);
  assert.equal(r.data.width, 320);
});

test('a missing input gives a clear error, not a crash', { skip }, async () => {
  const r = await runTool('video_trim', { input: path.join(dir, 'nope.mp4'), start: 0, end: 1 }, { cwd: dir });
  assert.equal(r.ok, false);
  assert.match(r.text, /Trim failed/);
});

test('CLI: the app bridge and the trim command work', { skip }, () => {
  const b64 = Buffer.from(JSON.stringify({ input: clip1 })).toString('base64');
  const line = (out) => JSON.parse(out.trim().split('\n').pop());
  const r1 = line(execFileSync('node', [CLI, 'tool', 'video_inspect', '--b64', b64, '--quiet', '--image-path'], { encoding: 'utf8' }));
  assert.equal(r1.ok, true);
  assert.equal(r1.data.width, 1280);
  const out = path.join(dir, 'cli-trim.mp4');
  const b64t = Buffer.from(JSON.stringify({ input: clip2, start: 1, duration: 2, out })).toString('base64');
  const r2 = line(execFileSync('node', [CLI, 'tool', 'video_trim', '--b64', b64t, '--quiet', '--image-path'], { encoding: 'utf8' }));
  assert.equal(r2.ok, true, r2.text);
  assert.equal(r2.videoFile, out, 'the app reads videoFile from the bridge line');
  const out2 = path.join(dir, 'cli-trim2.mp4');
  const r3 = line(execFileSync('node', [CLI, 'trim', clip2, out2, '--start', '1', '--duration', '2', '--quiet'], { encoding: 'utf8' }));
  assert.equal(r3.ok, true);
  assert.ok(fs.existsSync(out2));
});
