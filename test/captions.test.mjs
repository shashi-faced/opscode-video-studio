// Caption engine (plan 13, Phase 3): alignment of a script to heard words, grouping, subtitle files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { alignWords, matchRate } from '../src/captions/align.mjs';
import { groupWords, MAX_CHARS } from '../src/captions/group.mjs';
import { cuesFrom, toSrt, toVtt, toWordsJson, twoLines, writeSubtitles, srtTime, vttTime } from '../src/captions/formats.mjs';
import { captionTokens, buildTimeline } from '../src/timeline.mjs';
import { slug } from '../src/pipeline.mjs';
import { modelReady } from '../src/asr/models.mjs';

const FIX = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'test', 'fixtures', 'asr');
const W = (text, start, end) => ({ text, start, end });
const tok = (s) => captionTokens(s);

test('align: Hindi script heard in Latin letters still gets each word\'s time', () => {
  const tokens = tok('गाँव की प्यारी रात में दीये जले');
  const heard = [W('gaon', 0.2, 0.5), W('ki', 0.5, 0.65), W('pyari', 0.7, 1.1), W('raat', 1.15, 1.45), W('mein', 1.5, 1.7), W('diye', 1.8, 2.1), W('jale', 2.15, 2.5)];
  assert.equal(matchRate(tokens, heard), 0, 'no word spells the same');
  const t = alignWords(tokens, heard, 3);
  assert.equal(t.length, 7);
  // Each word starts within one word of the heard word at the same position.
  t.forEach(([a], i) => assert.ok(Math.abs(a - heard[i].start) <= 0.35, `word ${i}: ${a} vs ${heard[i].start}`));
  assert.ok(t.every((x, i) => i === 0 || x[0] >= t[i - 1][0]), 'in order');
  assert.ok(t[0][0] >= 0.2 - 1e-9 && t.at(-1)[1] <= 2.5 + 1e-9, 'inside the heard speech');
});

test('align: words between matched anchors take the heard times, not an even spread', () => {
  // "Brand" was heard as two words; everything else spells the same.
  const tokens = tok('Try Zyntrix today');
  const heard = [W('Try', 0, 0.3), W('Zin', 0.4, 0.6), W('tricks', 0.6, 1.4), W('today', 2.0, 2.4)];
  const t = alignWords(tokens, heard, 3);
  assert.deepEqual(t[0], [0, 0.3]);
  assert.deepEqual(t[1], [0.4, 1.4], 'the unmatched word covers the two heard words between the anchors');
  assert.deepEqual(t[2], [2, 2.4]);
});

test('align: the search window reaches past a few extra heard words', () => {
  const tokens = tok('one two three');
  const heard = [W('one', 0, 0.2), ...'uh um er ah so'.split(' ').map((w, i) => W(w, 0.3 + i * 0.1, 0.35 + i * 0.1)), W('two', 1, 1.2), W('three', 1.3, 1.6)];
  const t = alignWords(tokens, heard, 2);
  assert.deepEqual(t[1], [1, 1.2]);
});

test('group: lines stay under maxChars on tall frames', () => {
  const text = 'Supercalifragilistic expialidocious wonderful extraordinary celebrations tonight everyone';
  const tokens = tok(text);
  const times = tokens.map((_, i) => [i * 0.5, i * 0.5 + 0.4]);
  const caps = groupWords(tokens, times, 'line', { maxChars: MAX_CHARS.tall });
  assert.ok(caps.length >= 3);
  for (const c of caps) assert.ok([...c.html].length <= MAX_CHARS.tall, c.html);
});

test('group: a chunk stays on screen at least 0.7 s when there is room', () => {
  const tokens = tok('Hi. Then a long pause.');
  const times = [[1, 1.1], [5, 5.2], [5.2, 5.3], [5.3, 5.6], [5.6, 6]];
  const caps = groupWords(tokens, times, 'line');
  assert.ok(caps[0].end - caps[0].start >= 0.7 - 1e-9, JSON.stringify(caps[0]));
});

test('SRT: numbered, increasing, comma times, at most 2 lines, Devanagari kept', () => {
  const caps = [
    { start: 0.5, end: 2.1, html: 'गाँव की <mark>प्यारी</mark> रात' },
    { start: 2, end: 3.5, html: '<b class="w">A</b> <b class="w">very</b> <b class="w">long</b> <b class="w">caption</b> <b class="w">that</b> <b class="w">needs</b> <b class="w">two</b> <b class="w">lines</b> <b class="w">to fit</b>', words: [[2, 2.1], [2.1, 2.3], [2.3, 2.5], [2.5, 2.8], [2.8, 2.9], [2.9, 3.1], [3.1, 3.2], [3.2, 3.4], [3.4, 3.5]] },
    { start: 4, end: 4.5, html: '' },
  ];
  const cues = cuesFrom(caps);
  assert.equal(cues.length, 2, 'empty caption dropped');
  assert.equal(cues[0].end, 2, 'overlap trimmed to the next start');
  const srt = toSrt(cues);
  const blocks = srt.trim().split('\n\n');
  assert.equal(blocks.length, 2);
  blocks.forEach((b, k) => {
    const [n, times, ...lines] = b.split('\n');
    assert.equal(n, String(k + 1));
    assert.match(times, /^\d\d:\d\d:\d\d,\d{3} --> \d\d:\d\d:\d\d,\d{3}$/);
    assert.ok(lines.length >= 1 && lines.length <= 2);
    for (const l of lines) assert.ok([...l].length <= MAX_CHARS.wide);
  });
  assert.ok(srt.includes('गाँव की प्यारी रात'));
  assert.equal(srtTime(3661.5), '01:01:01,500');
});

test('VTT: header, and per-word timestamps for karaoke cues', () => {
  const cues = cuesFrom([{ start: 1, end: 2, html: '<b class="w">One</b> <b class="w">two</b> <b class="w">three</b>', words: [[1, 1.2], [1.3, 1.5], [1.6, 2]] }, { start: 3, end: 4, html: 'Plain &amp; simple' }]);
  const vtt = toVtt(cues);
  assert.ok(vtt.startsWith('WEBVTT\n\n'));
  assert.ok(vtt.includes('00:00:01.000 --> 00:00:02.000\nOne <00:00:01.300>two <00:00:01.600>three'));
  assert.ok(vtt.includes('Plain &amp; simple'));
  assert.equal(vttTime(0.25), '00:00:00.250');
  const wj = JSON.parse(toWordsJson(cues, { language: 'en' }));
  assert.equal(wj.language, 'en');
  assert.deepEqual(wj.words.slice(0, 3).map(w => w.text), ['One', 'two', 'three']);
  assert.equal(wj.words[1].start, 1.3);
});

test('twoLines breaks near the middle', () => {
  assert.equal(twoLines('short'), 'short');
  const t = twoLines('one two three four five six seven eight nine ten eleven twelve', 30);
  const [a, b] = t.split('\n');
  assert.ok(Math.abs(a.length - b.length) <= 6, t);
});

test('writeSubtitles writes .srt and .vtt next to the video', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-subs-'));
  const r = writeSubtitles(path.join(d, 'my-video'), [{ start: 0, end: 1, html: 'Hello' }]);
  assert.ok(fs.readFileSync(r.srt, 'utf8').includes('Hello'));
  assert.ok(fs.readFileSync(r.vtt, 'utf8').startsWith('WEBVTT'));
  assert.deepEqual(writeSubtitles(path.join(d, 'none'), []), {});
  fs.rmSync(d, { recursive: true, force: true });
});

test('timeline: reel captions use short lines', () => {
  const narration = 'Celebrate this festival season with spectacular discounts across every single category today';
  const sb = { format: '9:16', captions: { style: 'line' }, fps: 30, scenes: [{ template: 'title', headline: 'Hi', narration }] };
  const tl = buildTimeline(sb, [6], [[6]], [null]);
  for (const c of tl.scenes[0].captions) assert.ok([...c.html].length <= MAX_CHARS.tall, c.html);
});

test('file names keep letters of any script', () => {
  assert.equal(slug('दिवाली की शुभकामनाएँ'), 'दिवाली-की-शुभकामनाएँ');
  assert.equal(slug('Diwali Sale 2026!'), 'diwali-sale-2026');
  assert.equal(slug('🎉'), 'video');
  assert.ok([...slug('x'.repeat(200))].length <= 60);
});

// Real check: the true Hindi script aligned to what Whisper heard (with spelling slips) lands on the true word times.
const listen = modelReady('small') ? false : 'whisper-small not installed';
test('align: Hindi script on real Whisper words is within 150 ms of the true times', { skip: listen, timeout: 300000 }, async () => {
  const { transcribe } = await import('../src/asr/transcribe.mjs');
  const { readPcm, loudness, levels, onsetNear } = await import('../src/asr/audio.mjs');
  const truth = JSON.parse(fs.readFileSync(path.join(FIX, 'hi.words.json'), 'utf8'));
  const pcm = readPcm(path.join(FIX, 'hi.mp3'));
  const heard = (await transcribe({ pcm }, { language: 'hi' })).words;
  const tokens = tok(truth.map(w => w.text).join(' '));
  const rms = loudness(pcm);
  const off = onsetNear(rms, truth[0].start, levels(rms).thr, { back: 0.05, fwd: 0.6 }) - truth[0].start;
  const t = alignWords(tokens, heard, pcm.length / 16000);
  const errs = t.map(([a], i) => Math.abs(a - (truth[i].start + off))).sort((a, b) => a - b);
  assert.ok(errs[errs.length >> 1] <= 0.15, `median ${errs[errs.length >> 1]}`);
  assert.ok(errs[Math.floor(errs.length * 0.9)] <= 0.3, `p90 ${errs[Math.floor(errs.length * 0.9)]}`);
});
