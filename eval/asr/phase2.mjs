// Plan 13 Phase 2 check: transcribe() on the Phase 1 clips with automatic language detection,
// timing measured against the real sound (Edge word times moved to the clip's real speech onset),
// plus silence / noise / music, which must give no words.
//   node eval/asr/phase2.mjs [quality=balanced]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { HOME_DIR, findFfmpeg } from '../../src/deps/locate.mjs';
import { transcribe } from '../../src/asr/transcribe.mjs';
import { readPcm, loudness, levels, onsetNear } from '../../src/asr/audio.mjs';

const quality = process.argv[2] || 'balanced';
const CACHE = path.join(HOME_DIR, 'cache', 'tts');
const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(p * s.length))]) : null; };

const by = { en: [], hi: [] };
for (const f of fs.readdirSync(CACHE).filter(f => f.endsWith('.words.json')).sort()) {
  let w; try { w = JSON.parse(fs.readFileSync(path.join(CACHE, f), 'utf8')); } catch { continue; }
  if (!w || w.length < 6) continue;
  by[/[ऀ-ॿ]/.test(w.map(x => x.text).join(' ')) ? 'hi' : 'en'].push({ key: f.replace('.words.json', ''), truth: w });
}
const clips = Object.entries(by).flatMap(([lang, cs]) => cs.sort((a, b) => b.truth.length - a.truth.length).slice(0, 10).map(c => ({ ...c, lang })));

const res = { en: { err: [], lang: 0, n: 0, measured: 0, secs: 0, took: 0 }, hi: { err: [], lang: 0, n: 0, measured: 0, secs: 0, took: 0 } };
for (const c of clips) {
  const file = path.join(CACHE, c.key + '.mp3');
  const pcm = readPcm(file);
  const rms = loudness(pcm);
  // Real-sound truth: Edge's spacing, moved so its first word starts at the real onset.
  const on = onsetNear(rms, c.truth[0].start, levels(rms).thr, { back: 0.05, fwd: 0.6 }) ?? c.truth[0].start;
  const off = on - c.truth[0].start;
  const s = Date.now();
  const t = await transcribe({ pcm }, { language: 'auto', quality, cache: false });
  const r = res[c.lang];
  r.took += (Date.now() - s) / 1000; r.secs += t.duration; r.n++;
  if (t.language === c.lang) r.lang++;
  if (t.shiftMeasured) r.measured++;
  // In-order text pairs (LCS).
  const A = c.truth.map(w => norm(w.text)), B = t.words.map(w => norm(w.text));
  const L = Array.from({ length: A.length + 1 }, () => new Array(B.length + 1).fill(0));
  for (let i = A.length - 1; i >= 0; i--) for (let j = B.length - 1; j >= 0; j--) L[i][j] = A[i] && A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  let i = 0, j = 0;
  while (i < A.length && j < B.length) {
    if (A[i] && A[i] === B[j]) { r.err.push(Math.abs(t.words[j].start - (c.truth[i].start + off)) * 1000); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++;
  }
  console.log(c.lang, c.key, `lang=${t.language}`, `shift=${t.shift}${t.shiftMeasured ? '' : '(default)'}`, `words=${t.words.length}/${c.truth.length}`, `dropped=${t.dropped.length}`);
}
const summary = {};
for (const [lang, r] of Object.entries(res)) summary[lang] = { clips: r.n, languageRight: r.lang, shiftMeasured: r.measured, matchedWords: r.err.length, startMedianMs: q(r.err, 0.5), startP90Ms: q(r.err, 0.9), speed: +(r.took / r.secs).toFixed(2) };

const ff = findFfmpeg();
const gen = (args) => { const b = execFileSync(ff, ['-v', 'error', ...args, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], { maxBuffer: 2 ** 30 }); const o = new Float32Array(b.length >> 2); new Uint8Array(o.buffer).set(b.subarray(0, o.length * 4)); return o; };
for (const [name, args] of [
  ['silence', ['-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '20']],
  ['noise', ['-f', 'lavfi', '-i', 'anoisesrc=d=20:c=pink:a=0.05']],
  ['music', ['-f', 'lavfi', '-i', 'sine=f=262:d=20', '-f', 'lavfi', '-i', 'sine=f=330:d=20', '-f', 'lavfi', '-i', 'sine=f=392:d=20', '-filter_complex', 'amix=inputs=3,volume=2,tremolo=f=2:d=0.7']],
]) {
  const t = await transcribe({ pcm: gen(args) }, { language: 'en', quality, cache: false });
  summary[name] = { words: t.words.map(w => w.text).join(' ') || '(none)', dropped: t.dropped.map(d => `${d.text.trim()}: ${d.reason}`) };
}
console.log(JSON.stringify(summary, null, 2));
