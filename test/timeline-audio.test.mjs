import { test } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildTimeline, captionChunks, markup, LEAD_IN } from '../src/timeline.mjs';
import { synthMusic } from '../src/audio/synth.mjs';
import { SR } from '../src/audio/wav.mjs';

const sb = {
  captions: true, fps: 30,
  scenes: [
    { template: 'title', headline: 'Hi', narration: 'Meet the product. It is *fast*.' },
    { template: 'bullets', headline: 'Why', items: ['a'] },
    { template: 'cta', headline: 'Go', narration: 'Download it today.' },
  ],
};

test('scene length follows measured voice, with template minimums', () => {
  const tl = buildTimeline(sb, [6, null, 2]);
  assert.equal(tl.scenes[0].duration, +(LEAD_IN + 6 + 0.7).toFixed(3));
  assert.equal(tl.scenes[1].duration, 4.5); // bullets minimum, no narration
  assert.equal(tl.scenes[2].duration, 5); // cta minimum beats 0.4 + 2 + 0.7
  assert.equal(tl.scenes[1].start, tl.scenes[0].end);
  assert.equal(tl.duration, tl.scenes[2].end);
});

test('captions cover the voice and keep emphasis markup', () => {
  const tl = buildTimeline(sb, [6, null, 2]);
  const caps = tl.scenes[0].captions;
  assert.ok(caps.length >= 2);
  assert.equal(caps[0].start, tl.scenes[0].voiceStart);
  assert.ok(caps.some(c => c.html.includes('<mark>fast</mark>')));
});

test('caption chunks split on punctuation and stay short', () => {
  const c = captionChunks('One two three four five six seven eight nine ten. Eleven twelve.');
  assert.ok(c.every(x => x.split(' ').length <= 9));
  assert.ok(c[0].endsWith('seven') || c[0].endsWith('ten.'));
});

test('markup escapes HTML', () => {
  assert.equal(markup('<b>*x*</b>'), '&lt;b&gt;<mark>x</mark>&lt;/b&gt;');
});

test('music is deterministic, finite and normalised', () => {
  const tl = buildTimeline(sb, [3, null, 2]);
  for (const style of ['indian-electronic', 'corporate-upbeat', 'ambient']) {
    const [L, R] = synthMusic(tl, { style });
    assert.ok(L.length >= tl.duration * SR);
    let peak = 0, bad = 0;
    for (let i = 0; i < L.length; i++) { const v = Math.max(Math.abs(L[i]), Math.abs(R[i])); if (!Number.isFinite(v)) bad++; peak = Math.max(peak, v); }
    assert.equal(bad, 0, style);
    assert.ok(peak <= 1.0001 && peak > 0.5, `${style} peak ${peak}`);
    const h1 = crypto.createHash('md5').update(Buffer.from(L.buffer)).digest('hex');
    const h2 = crypto.createHash('md5').update(Buffer.from(synthMusic(tl, { style })[0].buffer)).digest('hex');
    assert.equal(h1, h2, `${style} not deterministic`);
  }
});
