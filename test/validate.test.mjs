import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate, validateFile } from '../src/schema/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseDir = path.join(ROOT, 'examples');
const scene = (o) => ({ template: 'title', headline: 'Hello', ...o });

test('examples are valid', () => {
  for (const f of ['reel.json', 'ad.json']) {
    const r = validateFile(path.join(baseDir, f));
    assert.equal(r.ok, true, JSON.stringify(r.errors));
  }
});

test('aliases used by small models are normalised with warnings', () => {
  const r = validate({ format: 'portrait', voice: 'hi-IN-SwaraNeural', scenes: [{ type: 'intro', title: 'Hi *there*', vo: 'Hello' }, { layout: 'outro', title: 'Bye', chips: 'a, b' }] }, { baseDir });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.storyboard.format, '9:16');
  assert.equal(r.storyboard.voice.voice, 'hi-IN-SwaraNeural');
  assert.equal(r.storyboard.scenes[0].template, 'title');
  assert.equal(r.storyboard.scenes[0].headline, 'Hi *there*');
  assert.equal(r.storyboard.scenes[0].narration, 'Hello');
  assert.equal(r.storyboard.scenes[1].template, 'cta');
  assert.ok(r.warnings.length >= 5);
});

test('null optional fields are dropped (real free-model mistake)', () => {
  const r = validate({ brand: { name: 'Shop', logo: null }, scenes: [scene(), scene({ template: 'cta', subline: '' })] }, { baseDir });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.ok(r.warnings.some(w => w.path === 'brand.logo'));
});

test('unknown template gives the list of valid ones', () => {
  const r = validate({ scenes: [scene(), scene({ template: 'hero2' })] }, { baseDir });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].path, 'scenes[1].template');
  assert.match(r.errors[0].fix, /title, feature, bullets/);
});

test('pixel coordinates are explained as fractions', () => {
  const r = validate({ scenes: [scene(), { template: 'feature', headline: 'x', image: 'assets/browser.webp', highlights: [{ x: 120, y: 0.1, w: 0.5, h: 0.1 }] }] }, { baseDir });
  assert.equal(r.ok, false);
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].message, /fractions/);
});

test('missing image and too long headline', () => {
  const r = validate({ scenes: [scene({ headline: 'x'.repeat(90) }), { template: 'feature', headline: 'ok', image: 'nope.png' }] }, { baseDir });
  const paths = r.errors.map(e => e.path);
  assert.deepEqual(paths.sort(), ['scenes[0].headline', 'scenes[1].image']);
});

test('needs at least 2 scenes', () => {
  const r = validate({ scenes: [scene()] }, { baseDir });
  assert.equal(r.ok, false);
  assert.equal(r.errors[0].path, 'scenes');
});
