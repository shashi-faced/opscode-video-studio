// Speech → words (plan 13, Phase 2). The clean-up rules run without a model; the listening tests
// run only when the Whisper small model is installed (video_assets install whisper-small).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tidy, guard, measureShift, applyShift, STOCK } from '../src/asr/clean.mjs';
import { readPcm, loudness, levels, onsetNear, HOP } from '../src/asr/audio.mjs';
import { MANIFEST, modelReady } from '../src/asr/models.mjs';
import { trimRuntime } from '../src/asr/runtime.mjs';
import { languageCode } from '../src/asr/transcribe.mjs';
import { findFfmpeg } from '../src/deps/locate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIX = path.join(ROOT, 'test', 'fixtures', 'asr');
const ff = findFfmpeg();
const W = (text, start, end) => ({ text, start, end });
const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');

// A loudness map: quiet, with loud stretches [a, b) in seconds.
function rmsWith(bursts, secs = 10) {
  const r = new Float32Array(Math.round(secs / HOP)).fill(0.001);
  for (const [a, b] of bursts) for (let f = Math.round(a / HOP); f < Math.round(b / HOP); f++) r[f] = 0.2;
  return r;
}

test('tidy: in order, inside the audio, 60 ms to 1.5 s, no overlap', () => {
  const out = tidy([W(' b', 2, 1.9), W('a ', 1, 4), W('c', 2.5, 9), W('d', 9.98, 12)], 10);
  assert.deepEqual(out.map(w => w.text), ['a', 'b', 'c', 'd']);
  assert.ok(out.every((w, i) => i === 0 || w.start >= out[i - 1].start));
  assert.equal(out[0].end, 2, 'a ends where b starts');
  assert.ok(out[1].end - out[1].start >= 0.06 - 1e-9, 'a backwards word gets at least 60 ms');
  assert.ok(out[2].end - out[2].start <= 1.5, 'a stretched word is capped at 1.5 s');
  assert.ok(out.every(w => w.end <= 10), 'nothing ends after the audio');
});

test('guard: words over silence, after the end, and sound labels are dropped', () => {
  const rms = rmsWith([[1, 2]]);
  const g = guard([W('hello', 1.1, 1.5), W('ghost', 5, 5.4), W('late', 12, 12.3), W('[Music]', 1.2, 1.4), W('♪', 1.5, 1.6)], { rms, duration: 10 });
  assert.deepEqual(g.words.map(w => w.text), ['hello']);
  const why = Object.fromEntries(g.dropped.map(d => [d.text, d.reason]));
  assert.equal(why.ghost, 'silence');
  assert.equal(why.late, 'after the end of the audio');
  assert.equal(why['[Music]'], 'sound label');
});

test('guard: stock phrases on their own are dropped, even spread over pauses', () => {
  const alone = guard([W('Thank', 2, 2.3), W('you.', 2.3, 2.6)]);
  assert.equal(alone.words.length, 0);
  // Whisper spread this one over 4 s of music.
  const spread = guard([W('Thank', 15.35, 16.85), W('you for watching!', 19.05, 19.25)]);
  assert.equal(spread.words.length, 0);
  assert.ok(STOCK.has('thanksforwatching'));
});

test('guard: real speech that contains a stock phrase is kept', () => {
  const said = [W('I', 1, 1.1), W('want', 1.1, 1.3), W('to', 1.3, 1.4), W('say', 1.4, 1.6), W('thank', 1.6, 1.8), W('you', 1.8, 2)];
  assert.equal(guard(said).words.length, 6);
  // A known script says it: keep it even on its own.
  assert.equal(guard([W('Thank', 2, 2.3), W('you.', 2.3, 2.6)], { keep: new Set(['thankyou']) }).words.length, 2);
  // Hindi stock phrase alone vs. in a sentence.
  assert.equal(guard([W('धन्यवाद', 1, 1.5)]).words.length, 0);
  assert.equal(guard([W('धन्यवाद', 1, 1.5), W('मिको!', 1.5, 2)]).words.length, 2);
});

test('guard: a word looping 4+ times is cut to 3', () => {
  const loop = Array.from({ length: 7 }, (_, i) => W('the', 1 + i * 0.2, 1.15 + i * 0.2));
  assert.equal(guard(loop).words.length, 3);
});

test('measureShift: finds how late words are from the sound after pauses', () => {
  // Phrases start at 1, 3, 5 and 7 s; Whisper heard each 0.12 s late.
  const rms = rmsWith([[1, 2], [3, 4], [5, 6], [7, 8]]);
  const heard = [1, 3, 5, 7].flatMap(t => [W('a', t + 0.12, t + 0.5), W('b', t + 0.5, t + 0.9)]);
  const s = measureShift(heard, rms, 'en');
  assert.equal(s.measured, true);
  assert.ok(Math.abs(s.shift - 0.12) <= 0.011, `shift ${s.shift}`);
  const fixed = applyShift(heard, s.shift);
  assert.ok(Math.abs(fixed[0].start - 1) <= 0.011);
});

test('measureShift: too few pauses uses the calibrated default for the language', () => {
  const rms = rmsWith([[1, 5]]);
  const heard = [W('one', 1.13, 1.5), W('two', 1.5, 2)];
  assert.deepEqual(measureShift(heard, rms, 'en'), { shift: 0.13, measured: false, samples: 1 });
  assert.equal(measureShift(heard, rms, 'hi').shift, 0.05);
  assert.equal(measureShift(heard, new Float32Array(1000), 'en').measured, false, 'silent audio');
});

test('onsetNear walks back to where the sound rises', () => {
  const rms = rmsWith([[2, 3]]);
  const { thr } = levels(rms);
  assert.ok(Math.abs(onsetNear(rms, 2.15, thr) - 2) < 0.011, 'heard late');
  assert.ok(Math.abs(onsetNear(rms, 1.9, thr) - 2) < 0.011, 'heard early');
  assert.equal(onsetNear(rms, 5, thr), null, 'no sound nearby');
});

test('languageCode', () => {
  assert.equal(languageCode('auto'), null);
  assert.equal(languageCode(''), null);
  assert.equal(languageCode('Hindi'), 'hi');
  assert.equal(languageCode('hi-IN'), 'hi');
  assert.equal(languageCode('en'), 'en');
});

test('model manifest: pinned revisions, sizes and SHA-256 for every file', () => {
  assert.deepEqual(MANIFEST.models.map(m => m.id).sort(), ['base', 'small']);
  for (const m of MANIFEST.models) {
    assert.match(m.revision, /^[0-9a-f]{40}$/);
    assert.equal(m.files.length, 7);
    assert.equal(m.size, m.files.reduce((n, f) => n + f.size, 0));
    for (const f of m.files) {
      assert.match(f.sha256, /^[0-9a-f]{64}$/);
      assert.ok(f.url.includes(`/resolve/${m.revision}/`), `${f.file} is pinned`);
    }
  }
});

test('trimRuntime keeps only this computer\'s ONNX Runtime and drops CUDA', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-trim-'));
  const put = (p, n = 1000) => { fs.mkdirSync(path.dirname(path.join(d, p)), { recursive: true }); fs.writeFileSync(path.join(d, p), Buffer.alloc(n)); };
  const bin = 'node_modules/onnxruntime-node/bin/napi-v6';
  put(`${bin}/linux/x64/libonnxruntime.so.1`);
  put(`${bin}/linux/x64/libonnxruntime_providers_cuda.so`, 5000);
  put(`${bin}/linux/arm64/libonnxruntime.so.1`);
  put(`${bin}/win32/x64/onnxruntime.dll`);
  put('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm', 3000);
  put('node_modules/onnxruntime-web/package.json', 10);
  const freed = trimRuntime(d, 'linux', 'x64');
  const has = (p) => fs.existsSync(path.join(d, p));
  assert.ok(has(`${bin}/linux/x64/libonnxruntime.so.1`));
  assert.ok(!has(`${bin}/linux/x64/libonnxruntime_providers_cuda.so`));
  assert.ok(!has(`${bin}/linux/arm64`));
  assert.ok(!has(`${bin}/win32`));
  assert.ok(!has('node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.wasm'));
  assert.ok(has('node_modules/onnxruntime-web/package.json'));
  assert.equal(freed, 5000 + 1000 + 1000 + 3000);
  fs.rmSync(d, { recursive: true, force: true });
});

test('readPcm: clear errors for a missing file and a video without sound', { skip: ff ? false : 'ffmpeg not found' }, () => {
  assert.throws(() => readPcm('/nope/missing.mp4'), e => /file not found/.test(e.message) && !!e.fix);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-pcm-'));
  const silentVideo = path.join(d, 'v.mp4');
  execFileSync(ff, ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=1:size=160x120:rate=10', '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', silentVideo]);
  assert.throws(() => readPcm(silentVideo), e => /no sound track/.test(e.message));
  const pcm = readPcm(path.join(FIX, 'en.mp3'));
  assert.ok(Math.abs(pcm.length / 16000 - 9.9) < 0.2);
  fs.rmSync(d, { recursive: true, force: true });
});

test('without a model: a clear error that says how to install it', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-home-'));
  const code = `import('${pathUrl('src/asr/transcribe.mjs')}').then(m => m.transcribe({ pcm: new Float32Array(16000) }, { language: 'en' })).then(() => console.log('NO ERROR'), e => console.log(JSON.stringify({ m: e.message, fix: e.fix })))`;
  const r = spawnSync(process.execPath, ['-e', code], { env: { ...process.env, OPSCODE_VIDEO_HOME: home }, encoding: 'utf8' });
  const out = JSON.parse(r.stdout.trim().split('\n').pop());
  assert.match(out.m, /not installed/);
  assert.match(out.fix, /video_assets.*whisper-small/);
  fs.rmSync(home, { recursive: true, force: true });
});
function pathUrl(rel) { return new URL(rel, `file://${ROOT}/`).href; }

// ---------- listening (needs the small model) ----------
const listen = modelReady('small') ? false : 'whisper-small not installed (video_assets install whisper-small)';

test('English clip: language found, every word heard, times within 100 ms of the sound', { skip: listen, timeout: 300000 }, async () => {
  const { transcribe } = await import('../src/asr/transcribe.mjs');
  const truth = JSON.parse(fs.readFileSync(path.join(FIX, 'en.words.json'), 'utf8'));
  const pcm = readPcm(path.join(FIX, 'en.mp3'));
  const t = await transcribe({ pcm }, { language: 'auto', cache: false });
  assert.equal(t.language, 'en');
  assert.equal(t.languageDetected, true);
  assert.equal(t.model, 'whisper-small');
  // Truth on the real sound: Edge's spacing moved to where speech starts.
  const rms = loudness(pcm);
  const off = onsetNear(rms, truth[0].start, levels(rms).thr, { back: 0.05, fwd: 0.6 }) - truth[0].start;
  const heard = t.words.map(w => norm(w.text));
  const errs = [];
  let j = 0;
  for (const w of truth) {
    const k = heard.indexOf(norm(w.text), j);
    if (k < 0) continue;
    errs.push(Math.abs(t.words[k].start - (w.start + off)));
    j = k + 1;
  }
  assert.ok(errs.length >= truth.length * 0.9, `${errs.length}/${truth.length} words heard`);
  errs.sort((a, b) => a - b);
  assert.ok(errs[errs.length >> 1] <= 0.1, `median start error ${errs[errs.length >> 1]} s`);
  assert.ok(t.words.every((w, i) => w.end > w.start && (i === 0 || w.start >= t.words[i - 1].start)));
  assert.ok(t.segments.length >= 1 && t.segments[0].text.includes('together'));
});

test('Hindi clip: language found and written in Devanagari', { skip: listen, timeout: 300000 }, async () => {
  const { transcribe } = await import('../src/asr/transcribe.mjs');
  const t = await transcribe(path.join(FIX, 'hi.mp3'), { language: 'auto', cache: false });
  assert.equal(t.language, 'hi');
  assert.match(t.words.map(w => w.text).join(' '), /[ऀ-ॿ]/);
  assert.ok(t.words.length >= 10, `${t.words.length} words`);
});

test('same audio → same words, and the cache returns it', { skip: listen, timeout: 300000 }, async () => {
  const { transcribe } = await import('../src/asr/transcribe.mjs');
  const pcm = readPcm(path.join(FIX, 'en.mp3'));
  const a = await transcribe({ pcm }, { language: 'en', cache: false });
  const b = await transcribe({ pcm }, { language: 'en', cache: false });
  assert.deepEqual(a.words, b.words);
  await transcribe({ pcm }, { language: 'en' });
  const c = await transcribe({ pcm }, { language: 'en' });
  assert.equal(c.cached, true);
  assert.deepEqual(c.words, a.words);
});

test('silence, noise and music give no words', { skip: listen || (ff ? false : 'ffmpeg not found'), timeout: 300000 }, async () => {
  const { transcribe } = await import('../src/asr/transcribe.mjs');
  const gen = (args) => { const b = execFileSync(ff, ['-v', 'error', ...args, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 2 ** 30 }); const o = new Float32Array(b.length >> 2); new Uint8Array(o.buffer).set(b.subarray(0, o.length * 4)); return o; };
  for (const args of [
    ['-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '20'],
    ['-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink:a=0.05'],
    ['-f', 'lavfi', '-i', 'sine=f=262:d=20', '-f', 'lavfi', '-i', 'sine=f=330:d=20', '-f', 'lavfi', '-i', 'sine=f=392:d=20', '-filter_complex', 'amix=inputs=3,volume=2,tremolo=f=2:d=0.7'],
  ]) {
    const t = await transcribe({ pcm: gen(args) }, { language: 'en', cache: false });
    assert.deepEqual(t.words.map(w => w.text), [], args.join(' '));
  }
});
