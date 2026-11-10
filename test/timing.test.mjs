// Generated videos (plan 13, Phase 6): captions.timing / captions.lines, and lip-sync that rests the
// mouth where the voice is quiet.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { validate } from '../src/schema/validate.mjs';
import { applyQuiet, quietSpans, visemeTrack } from '../src/audio/visemes.mjs';
import { buildTimeline, captionTokens } from '../src/timeline.mjs';
import { HOME_DIR } from '../src/deps/locate.mjs';
import { modelReady } from '../src/asr/models.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'test', 'fixtures', 'asr');
const two = (captions) => ({ title: 'T', type: 'explainer', captions, scenes: [{ template: 'title', headline: 'Hi', narration: 'Hello there.' }, { template: 'cta', headline: 'Go' }] });

test('validate: captions.timing aliases and captions.lines', () => {
  const a = validate(two({ style: 'pop', timing: 'accurate', lines: 'yes' }));
  assert.equal(a.ok, true, JSON.stringify(a.errors));
  assert.equal(a.storyboard.captions.timing, 'whisper');
  assert.equal(a.storyboard.captions.lines, true);
  const b = validate(two({ timing: 'banana' }));
  assert.equal(b.storyboard.captions.timing, 'auto');
  assert.ok(b.warnings.some(w => w.path === 'captions.timing'));
  const c = validate(two({ style: 'line' }));
  assert.equal(c.storyboard.captions.timing, undefined, 'old storyboards are unchanged (auto at render)');
});

test('quietSpans finds quiet stretches of at least 60 ms', () => {
  const rms = Float32Array.from([...Array(20).fill(0.3), ...Array(10).fill(0.001), ...Array(20).fill(0.3), ...Array(4).fill(0.001), ...Array(10).fill(0.3)]);
  assert.deepEqual(quietSpans(rms, 0.05), [[0.2, 0.3]], 'a 40 ms dip is not a rest');
});

test('applyQuiet closes the mouth in quiet stretches and keeps shapes elsewhere', () => {
  const track = [[1, 'B'], [1.2, 'D'], [1.5, 'C'], [2, 'X']];
  assert.deepEqual(applyQuiet(track, [[1.3, 1.45]], 2), [[1, 'B'], [1.2, 'D'], [1.3, 'X'], [1.45, 'D'], [1.5, 'C'], [2, 'X']]);
  assert.deepEqual(applyQuiet(track, [], 2), track);
  // An open flicker under 40 ms between two rests is closed.
  assert.deepEqual(applyQuiet([[1, 'D'], [2, 'X']], [[1, 1.5], [1.53, 2]], 2), [[1, 'X']]);
});

test('Hindi line: quiet audio brings the mouth-open share down to the real sound', () => {
  // Fluent Hindi: no pause between words, so word times alone keep the mouth open all the time.
  const tokens = captionTokens('गाँव की प्यारी रात में शर्मा परिवार');
  const times = tokens.map((_, i) => [i * 0.4, i * 0.4 + 0.4]);
  const end = times.at(-1)[1];
  const share = (tr) => { let o = 0; tr.forEach(([t, x], k) => { const e = tr[k + 1] ? tr[k + 1][0] : end; if (x !== 'X') o += e - t; }); return o / end; };
  assert.ok(share(visemeTrack(tokens, times, end)) > 0.999);
  const quiet = [[0.35, 0.45], [1.15, 1.25], [1.95, 2.1]];
  const s = share(visemeTrack(tokens, times, end, quiet));
  assert.ok(s < 0.9 && s > 0.5, `open ${s}`);
});

test('timeline: quiet spans reach the visemes; captions.lines adds dialogue captions in order', () => {
  const sb = (lines) => ({ fps: 30, captions: { style: 'line', lines }, cast: [{ id: 'mia', kind: 'girl' }], scenes: [{ template: 'dialogue', narration: 'Mia waved.', lines: [{ who: 'mia', text: 'Hello friend, how are you?' }] }] });
  const words = [[{ text: 'Mia', start: 0, end: 0.3 }, { text: 'waved', start: 0.3, end: 0.8 }], [{ text: 'Hello', start: 0, end: 0.4 }, { text: 'friend', start: 0.4, end: 0.9 }, { text: 'how', start: 1, end: 1.2 }, { text: 'are', start: 1.2, end: 1.4 }, { text: 'you', start: 1.4, end: 1.8 }]];
  const off = buildTimeline(sb(false), [3.2], [[1, 1.9]], [words[0]], [words]);
  const on = buildTimeline(sb(true), [3.2], [[1, 1.9]], [words[0]], [words], [[null, [[0.9, 1.0]]]]);
  assert.equal(off.scenes[0].captions.length, 1, 'narration only by default');
  assert.ok(on.scenes[0].captions.length >= 2);
  assert.ok(on.scenes[0].captions.some(c => c.html.includes('friend')));
  assert.ok(on.scenes[0].captions.every((c, i, a) => i === 0 || c.start >= a[i - 1].start));
  const line = on.scenes[0].parts.find(p => p.kind === 'line');
  const restAt = line.start + 0.9;
  assert.ok(line.visemes.some(([t, x]) => x === 'X' && Math.abs(t - restAt) < 0.011), 'mouth rests in the quiet span');
});

// ---------- synthesize() with a seeded voice cache (no internet): which parts are listened to ----------
// A private home: its TTS cache holds the English fixture under the key for TEXT; models and the speech
// engine are linked from the real home when present.
const VOICE = 'en-IN-NeerjaExpressiveNeural';
const TEXT = JSON.parse(fs.readFileSync(path.join(FIX, 'en.words.json'), 'utf8')).map(w => w.text).join(' ');
function seedHome({ words = 'fixture', models = true } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-home-'));
  const tts = path.join(home, 'cache', 'tts');
  fs.mkdirSync(tts, { recursive: true });
  const key = crypto.createHash('sha1').update(JSON.stringify([VOICE, '+0%', TEXT, ''])).digest('hex').slice(0, 16);
  fs.copyFileSync(path.join(FIX, 'en.mp3'), path.join(tts, `${key}.mp3`));
  fs.writeFileSync(path.join(tts, `${key}.words.json`), words === 'fixture' ? fs.readFileSync(path.join(FIX, 'en.words.json')) : JSON.stringify(words));
  if (models) for (const d of ['models', 'asr']) if (fs.existsSync(path.join(HOME_DIR, d))) fs.symlinkSync(path.join(HOME_DIR, d), path.join(home, d));
  return home;
}
function synth(home, timing) {
  const sb = { voice: { voice: VOICE, rate: '+0%' }, captions: { style: 'line', timing }, scenes: [{ template: 'title', headline: 'x', narration: TEXT }] };
  const code = `import(${JSON.stringify(pathToFileURL(path.join(ROOT, 'src/audio/tts.mjs')).href)}).then(async m => { const r = await m.synthesize(${JSON.stringify(sb)}); console.log(JSON.stringify({ notes: r.notes, words: r[0].words?.slice(0, 3), quiet: r[0].partQuiet })); })`;
  const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, OPSCODE_VIDEO_HOME: home }, encoding: 'utf8', timeout: 300000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout.trim().split('\n').pop());
}
const truth = JSON.parse(fs.readFileSync(path.join(FIX, 'en.words.json'), 'utf8'));

test('auto: good voice timings are used as they are (no listening)', () => {
  const home = seedHome();
  const r = synth(home, 'auto');
  assert.deepEqual(r.notes, []);
  assert.equal(r.words[0].text, truth[0].text);
  assert.deepEqual(r.quiet, [null], 'narration has no mouth');
  fs.rmSync(home, { recursive: true, force: true });
});

test('no model: listening is skipped with a note, the render does not fail', () => {
  const home = seedHome({ models: false });
  const r = synth(home, 'whisper');
  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0], /not installed/);
  assert.equal(r.words[0].text, truth[0].text, 'voice timings used');
  fs.rmSync(home, { recursive: true, force: true });
});

const listen = modelReady('small') ? false : 'whisper-small not installed';
test('whisper / auto with missing timings: the scene is listened to', { skip: listen, timeout: 600000 }, () => {
  const home = seedHome();
  const w = synth(home, 'whisper');
  assert.match(w.notes.join(' '), /1 spoken part\(s\) timed by listening/);
  assert.equal(w.words[0].text.toLowerCase().replace(/\W/g, ''), 'they');
  assert.notDeepEqual(w.words[0], truth[0], 'heard times, not the voice\'s');
  fs.rmSync(home, { recursive: true, force: true });
  const empty = seedHome({ words: [] });
  const a = synth(empty, 'auto');
  assert.match(a.notes.join(' '), /timed by listening/, 'no voice timings → listened');
  assert.equal(a.words?.[0]?.text.toLowerCase().replace(/\W/g, ''), 'they', 'heard words fill in the missing timings');
  fs.rmSync(empty, { recursive: true, force: true });
});
