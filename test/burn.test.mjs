// Burning captions into any video (plan 13, Phase 4).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { captionStates, shapeClass } from '../src/captions/page.mjs';
import { captionsFromWords, captionsFromScript, maxCharsFor } from '../src/captions/build.mjs';
import { burnCaptions, probeVideo } from '../src/captions/burn.mjs';
import { findFfmpeg, findChrome } from '../src/deps/locate.mjs';

const W = (text, start, end) => ({ text, start, end });
const ff = findFfmpeg();
const canBurn = ff && findChrome() ? false : 'needs ffmpeg and Chrome';

test('states cover the whole video, in order, with empty gaps', () => {
  const caps = [{ start: 1, end: 2, html: 'Hello there' }, { start: 3, end: 4.5, html: 'Bye' }];
  const s = captionStates(caps, 6, 'line');
  assert.equal(s[0].t0, 0);
  assert.equal(s.at(-1).t1, 6);
  s.forEach((x, i) => { if (i) assert.ok(Math.abs(x.t0 - s[i - 1].t1) < 1e-9, 'no holes'); });
  assert.deepEqual(s.map(x => x.html), ['', 'Hello there', '', 'Bye', '']);
});

test('karaoke: one state per lit word; pop: three growing steps first', () => {
  const html = '<b class="w">One</b> <b class="w">two</b> <b class="w">three</b>';
  const words = [[1, 1.3], [1.4, 1.7], [1.8, 2.2]];
  const k = captionStates([{ start: 0.95, end: 2.5, html, words }], 3, 'karaoke').filter(x => x.html);
  assert.deepEqual(k.map(x => x.on), [-1, 0, 1, 2]);
  assert.ok(k.every(x => x.scale === 1));
  const p = captionStates([{ start: 0.95, end: 2.5, html, words }], 3, 'pop').filter(x => x.html);
  const growing = p.slice(0, 3).map(x => x.scale);
  assert.ok(growing[0] < growing[1] && growing[1] < growing[2] && growing[2] < 1, String(growing));
  assert.equal(p.at(-1).scale, 1);
  assert.equal(p.at(-1).on, 2);
});

test('overlapping chunks never draw two captions at once', () => {
  const s = captionStates([{ start: 0, end: 2, html: 'A' }, { start: 1.5, end: 3, html: 'B' }], 3, 'line');
  assert.deepEqual(s.map(x => [x.html, +x.t0.toFixed(2), +x.t1.toFixed(2)]), [['A', 0, 1.5], ['B', 1.5, 3]]);
});

test('frame shape classes and line limits for any size', () => {
  assert.equal(shapeClass(1920, 1080), 'f-16x9');
  assert.equal(shapeClass(1080, 1920), 'f-9x16');
  assert.equal(shapeClass(1080, 1350), 'f-9x16');
  assert.equal(shapeClass(1080, 1080), 'f-1x1');
  assert.equal(maxCharsFor(1080, 1920), 32);
  assert.equal(maxCharsFor(1280, 720), 42);
});

test('captions from heard words, and from a script with the heard timing', () => {
  const heard = [W('hello', 0.5, 0.8), W('world.', 0.9, 1.3), W('nice', 2, 2.3), W('day', 2.4, 2.8)];
  const a = captionsFromWords(heard, 'pop');
  assert.ok(a.length >= 2);
  assert.equal(a[0].words[0][0], 0.5);
  assert.ok(a.every(c => c.words.length <= 3));
  const b = captionsFromScript('Hello *World*. Nice day', heard, 3, 'karaoke');
  assert.equal(b.tokens, 4);
  assert.ok(b.captions[0].html.includes('<mark>World.</mark>') || b.captions[0].html.includes('<mark>World</mark>'));
  assert.equal(b.captions[0].words[0][0], 0.5);
  assert.equal(captionsFromWords([W('<b>x</b>', 0, 1)], 'line')[0].html, '&lt;b&gt;x&lt;/b&gt;', 'heard text is escaped');
});

test('probeVideo reads size after rotation, length and sound', { skip: ff ? false : 'ffmpeg not found' }, () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-probe-'));
  const f = path.join(d, 'r.mp4');
  execFileSync(ff, ['-y', '-v', 'error', '-display_rotation', '90', '-f', 'lavfi', '-i', 'testsrc=size=320x180:rate=25:duration=2', '-f', 'lavfi', '-i', 'sine=d=2', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-shortest', f]);
  const v = probeVideo(f);
  assert.deepEqual([v.width, v.height], [180, 320], 'a phone video shot upright is upright');
  assert.ok(Math.abs(v.duration - 2) < 0.1);
  assert.equal(v.fps, 25);
  assert.equal(v.hasAudio, true);
  assert.throws(() => probeVideo(path.join(d, 'missing.mp4')), /file not found/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('burn: captions appear only when spoken, picture and sound otherwise unchanged', { skip: canBurn, timeout: 180000 }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-burn-'));
  const input = path.join(d, 'in.mp4');
  execFileSync(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=0x204060:size=640x360:rate=30:duration=4', '-f', 'lavfi', '-i', 'sine=f=300:d=4',
    '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', input]);
  const captions = [{ start: 1, end: 2.5, html: '<b class="w">नमस्ते</b> <b class="w">दुनिया</b>', words: [[1, 1.6], [1.7, 2.4]] }];
  const out = path.join(d, 'out.mp4');
  const r = await burnCaptions({ input, captions, out, style: 'karaoke' });
  assert.equal(r.file, out);
  assert.deepEqual([r.width, r.height], [640, 360]);
  assert.ok(r.stills >= 3, `stills ${r.stills}`);
  assert.ok(!fs.existsSync(path.join(d, '.captions-out')), 'work folder removed');
  const md5 = (f, map) => execFileSync(ff, ['-v', 'error', '-i', f, '-map', map, '-f', 'md5', '-'], { encoding: 'utf8' }).trim();
  assert.equal(md5(out, '0:a'), md5(input, '0:a'), 'sound copied unchanged');
  const v = probeVideo(out);
  assert.ok(Math.abs(v.duration - 4) < 0.1);
  assert.equal(v.fps, 30);
  // Bottom band: bright text pixels while the caption is up, none before it.
  const band = (f, t) => {
    const raw = execFileSync(ff, ['-v', 'error', '-ss', String(t), '-i', f, '-frames:v', '1', '-vf', 'crop=640:120:0:240,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1 << 24 });
    let bright = 0;
    for (const px of raw) if (px > 200) bright++;
    return bright;
  };
  // At 640×360 the caption text is about 13 px tall: tens of bright pixels, where the plain frame has none.
  assert.ok(band(out, 2) >= band(input, 2) + 40, `caption drawn: ${band(out, 2)} bright pixels`);
  assert.equal(band(out, 0.5), band(input, 0.5), 'no caption before the speech');
  assert.ok(band(out, 3.5) < 20, 'caption gone after its end');
  fs.rmSync(d, { recursive: true, force: true });
});
