import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validate } from '../src/schema/validate.mjs';
import { resolvePlatform, safePixels } from '../src/schema/platforms.mjs';
import { alignWords, captionTokens, timedCaptions, buildTimeline } from '../src/timeline.mjs';
import { youtubeChapters } from '../src/render/render.mjs';
import { parseWordBoundaries } from '../src/audio/tts.mjs';

const two = [{ template: 'title', headline: 'Hi', narration: 'Hello there.' }, { template: 'cta', headline: 'Buy', button: 'Go' }];

test('platform aliases resolve', () => {
  assert.equal(resolvePlatform('Insta Reel'), 'insta-reel');
  assert.equal(resolvePlatform('yt shorts'), 'youtube-short');
  assert.equal(resolvePlatform('WhatsApp'), 'whatsapp-status');
  assert.equal(resolvePlatform('youtube'), 'youtube');
  assert.equal(resolvePlatform('myspace'), null);
});

test('platform sets format and caption style; explicit format wins', () => {
  let r = validate({ platform: 'instagram', scenes: two });
  assert.ok(r.ok, JSON.stringify(r.errors));
  assert.equal(r.storyboard.platform, 'insta-reel');
  assert.equal(r.storyboard.format, '9:16');
  assert.deepEqual(r.storyboard.captions, { style: 'pop', position: 'bottom' });
  r = validate({ platform: 'insta-post', scenes: two });
  assert.equal(r.storyboard.format, '4:5');
  r = validate({ platform: 'youtube', format: '1:1', scenes: two });
  assert.equal(r.storyboard.format, '1:1');
  assert.ok(r.warnings.some(w => w.path === 'format'));
});

test('type reel defaults to insta-reel; old storyboards keep working', () => {
  assert.equal(validate({ type: 'reel', scenes: two }).storyboard.platform, 'insta-reel');
  const old = validate({ format: '16:9', captions: true, scenes: two });
  assert.ok(old.ok);
  assert.equal(old.storyboard.platform, undefined);
  assert.deepEqual(old.storyboard.captions, { style: 'line', position: 'bottom' });
  assert.equal(validate({ captions: false, scenes: two }).storyboard.captions, false);
  assert.equal(validate({ captions: 'word by word', scenes: two }).storyboard.captions.style, 'pop');
});

test('narration too long for the platform is an error', () => {
  const long = 'word '.repeat(170).trim();
  const r = validate({ platform: 'insta-post', scenes: [{ template: 'title', headline: 'Hi', narration: long }, { template: 'cta', headline: 'Bye', button: 'Go', narration: long }] });
  assert.ok(r.errors.some(e => /allows at most 60/.test(e.message)));
});

test('safe zone in pixels', () => {
  const s = safePixels('insta-reel', 1080, 1920);
  assert.equal(s.top, 269);
  assert.equal(s.bottom, 480);
  assert.equal(s.right, 151);
  assert.deepEqual(safePixels(undefined, 1920, 1080), { top: 0, bottom: 0, left: 0, right: 0, rightFrom: 0 });
});

test('caption tokens keep highlights across words', () => {
  const t = captionTokens('Big *Diwali sale* now!');
  assert.deepEqual(t.map(x => x.text), ['Big', 'Diwali', 'sale', 'now!']);
  assert.equal(t[1].html, '<mark>Diwali</mark>');
  assert.equal(t[2].html, '<mark>sale</mark>');
  assert.equal(t[3].html, 'now!');
});

test('words align to TTS timings, unmatched ones are filled in', () => {
  const tokens = captionTokens('Hello — world, 30% off!');
  const words = [{ text: 'Hello', start: 0.1, end: 0.5 }, { text: 'world', start: 0.6, end: 1.0 }, { text: '30%', start: 1.2, end: 1.8 }, { text: 'off', start: 1.9, end: 2.2 }];
  const t = alignWords(tokens, words, 2.5);
  assert.deepEqual(t[0], [0.1, 0.5]);
  assert.ok(t[1][0] >= 0.5 && t[1][1] <= 0.65, `dash between neighbours: ${t[1]}`);
  assert.deepEqual(t[2], [0.6, 1]);
  assert.deepEqual(t[4], [1.9, 2.2]);
  // No timings: shared out over the span, in order.
  const est = alignWords(tokens, null, 5);
  assert.equal(est[0][0], 0);
  assert.ok(Math.abs(est.at(-1)[1] - 5) < 0.01);
});

test('pop captions: at most 3 words, per-word times, no trailing commas', () => {
  const words = 'One two three four five six seven'.split(' ').map((w, i) => ({ text: w, start: i * 0.4, end: i * 0.4 + 0.3 }));
  const caps = timedCaptions('One two, three four five six seven.', words, 10, 3, 'pop');
  for (const c of caps) {
    assert.ok(c.words.length <= 3);
    assert.ok(!/,<\/b>/.test(c.html));
  }
  assert.equal(caps[0].words.length, 2); // breaks at the comma
  assert.equal(caps[0].start, 10);
  assert.equal(caps[1].words[0][0], 10.8);
});

test('timeline uses narration word timings', () => {
  const sb = { captions: { style: 'karaoke' }, fps: 30, scenes: [{ template: 'title', headline: 'Hi', narration: 'Meet the product.' }, { template: 'cta', headline: 'Go' }] };
  const words = [[{ text: 'Meet', start: 0, end: 0.3 }, { text: 'the', start: 0.35, end: 0.45 }, { text: 'product', start: 0.5, end: 1.1 }], null];
  const tl = buildTimeline(sb, [1.2, null], [[1.2], null], words);
  const c = tl.scenes[0].captions[0];
  assert.equal(c.words.length, 3);
  assert.equal(c.words[2][0], +(tl.scenes[0].voiceStart + 0.5).toFixed(3));
});

test('Edge word-boundary metadata parses', () => {
  const raw = JSON.stringify({ Metadata: [{ Type: 'WordBoundary', Data: { Offset: 1000000, Duration: 5375000, text: { Text: 'दिवाली', Length: 6, BoundaryType: 'WordBoundary' } } }, { Type: 'SessionEnd', Data: {} }] });
  assert.deepEqual(parseWordBoundaries(raw), [{ text: 'दिवाली', start: 0.1, end: 0.637 }]);
});

test('YouTube chapters: start at 0:00, at least 10 s each, at least 3', () => {
  const sb = { scenes: [{ headline: 'Intro' }, { headline: '*Fast* setup' }, { headline: 'Short one' }, { narration: 'Pricing for every team size.' }, { headline: 'Get it' }] };
  const tl = { duration: 50, scenes: [{ start: 0 }, { start: 12 }, { start: 16 }, { start: 26 }, { start: 44 }] };
  const ch = youtubeChapters(sb, tl);
  assert.deepEqual(ch.map(c => c.start), [0, 12, 26]);
  assert.equal(ch[1].label, 'Fast setup');
  assert.equal(ch[2].label, 'Pricing for every team size');
  assert.deepEqual(youtubeChapters(sb, { duration: 20, scenes: tl.scenes.map((s, i) => ({ start: i * 4 })) }), []);
});
