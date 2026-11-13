// Plan 18 M6: 3D presets (clay, low-poly) and the post story and before/after formats.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STYLES, STYLE_ALIASES, styleBase } from '../src/art/styles.mjs';
import { validate } from '../src/schema/validate.mjs';
import { TEMPLATES, FORMAT_TEMPLATES } from '../src/schema/spec.mjs';
import { buildTimeline, minDuration } from '../src/timeline.mjs';
import { TEMPLATE_HTML } from '../src/compiler/templates.mjs';
import { templatesDoc } from '../src/docs.mjs';
import { TOOL_DEFS } from '../src/tools.mjs';
import { findChrome } from '../src/deps/locate.mjs';

test('clay and low-poly are 3D styles; their names pick the 3D look', () => {
  assert.equal(styleBase('clay'), '3d'); assert.equal(styleBase('low-poly'), '3d');
  assert.equal(STYLES.clay.preset3d, 'clay'); assert.equal(STYLES['low-poly'].preset3d, 'low-poly');
  assert.equal(STYLE_ALIASES.claymation, 'clay'); assert.equal(STYLE_ALIASES['low poly'], 'low-poly');
  const sb = (extra) => ({ title: 'x', type: 'story', ...extra, scenes: [{ template: 'story', characters: [{ who: 'boy' }] }, { template: 'story', narration: 'b' }] });
  for (const [extra, style] of [[{ look: 'claymation' }, 'clay'], [{ art: { style: 'low poly' } }, 'low-poly'], [{ look: '2d', art: { style: 'clay' } }, 'clay']]) {
    const r = validate(sb(extra));
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.storyboard.look, '3d', JSON.stringify(extra)); assert.equal(r.storyboard.art.style, style);
  }
});

test('3D engine: presets restyle every mesh; the default look is untouched', () => {
  const src = fs.readFileSync('src/compiler/world3d.js', 'utf8');
  assert.match(src, /const PRESET = \['clay', 'low-poly'\]\.includes\(SPEC\.preset\)/);
  assert.match(src, /applyPreset\(scene\);\n  scenes\[i\] = /);
  assert.match(src, /flatShading: PRESET === 'low-poly'/);
  assert.match(src, /if \(!PRESET\) return;/);
  assert.match(fs.readFileSync('src/compiler/compile.mjs', 'utf8'), /preset: style\?\.preset3d \|\| null/);
});

const ctx = (sc, extra = {}) => {
  const tl = buildTimeline({ format: '16:9', scenes: [sc] }).scenes[0];
  return { index: 0, fi: 0, format: '16:9', tl, dur: tl.duration, theme: {}, asset: () => ({ src: 'x.jpg', aspect: 1 }), ...extra };
};

test('post: a generic card with counting votes and comments', () => {
  const p = TEMPLATES.post.example;
  const h = TEMPLATE_HTML.post(p, ctx(p));
  assert.match(h, /class="ps-card/);
  assert.match(h, /data-cu="0\.9:0\|2\.3:24800"/);
  assert.match(h, /data-cu="1\.1:0\|2\.5:1320"/);
  assert.match(h, /<span class="ps-av">Q<\/span><div><b>quiet_intern<\/b><small>Office Stories · 5h<\/small>/);
  assert.doesNotMatch(h, /reddit|r\//i);
  const r = validate({ title: 'x', scenes: [{ template: 'reddit story', headline: 'Hi', text: 'body', upvotes: '24.8k', subreddit: 'Stories' }, { template: 'cta', headline: 'b' }] });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.storyboard.scenes[0], { template: 'post', title: 'Hi', body: 'body', votes: 24800, community: 'Stories' });
});

test('before / after: the wipe starts when "before" is said; loose input is tidied', () => {
  const b = TEMPLATES.beforeafter.example;
  const c = ctx(b);
  const h = TEMPLATE_HTML.beforeafter(b, c);
  const rv = +/--rv:([\d.]+)s/.exec(h)[1];
  const said = c.tl.words.find(([w]) => /before/i.test(w))[1] - c.tl.start;
  assert.ok(Math.abs(rv - (said - 0.1)) < 0.02, `${rv} vs ${said}`);
  assert.ok(h.indexOf('ba-after') < h.indexOf('ba-before'), 'after is underneath, before wipes in over it');
  assert.equal((h.match(/<li><b>✕<\/b>/g) || []).length, 2);
  assert.equal((h.match(/<li><b>✓<\/b>/g) || []).length, 2);
  assert.ok(minDuration({ template: 'beforeafter' }) >= 5.5);
  const r = validate({ title: 'x', scenes: [{ template: 'before and after', then: 'Messy desk', now: ['Clean desk', 'Plants'] }, { template: 'cta', headline: 'b' }] });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.storyboard.scenes[0], { template: 'beforeafter', before: { text: 'Messy desk' }, after: { items: ['Clean desk', 'Plants'] } });
  assert.equal(validate({ title: 'x', scenes: [{ template: 'beforeafter', after: 'a' }, { template: 'cta', headline: 'b' }] }).ok, false, 'needs before');
});

test('guide, tool and prompt know the new formats and presets', () => {
  assert.ok(FORMAT_TEMPLATES.includes('post') && FORMAT_TEMPLATES.includes('beforeafter'));
  const fmt = TOOL_DEFS.find((t) => t.name === 'video_templates').parameters.properties.format.enum;
  assert.ok(fmt.includes('post') && fmt.includes('beforeafter'));
  const d = templatesDoc('reel', 'insta-reel', undefined, 'post');
  assert.ok(d.includes('### Recipe for "post"') && d.includes('### "post"') && d.includes('never game footage'));
  assert.ok(templatesDoc('reel', 'insta-reel', undefined, 'before and after').includes('### "beforeafter"'));
  assert.match(templatesDoc('story'), /- clay: Clay 3D\..*sets look "3d"/);
  const prompt = JSON.parse(fs.readFileSync('agent/manifest.json', 'utf8')).systemPrompt;
  assert.match(prompt, /clay or low-poly 3D/); assert.match(prompt, /never name or imitate a real site or community/);
});

const chrome = findChrome() ? false : 'Chrome not found';
test('page: before/after wipes and settles at half; clay world builds', { skip: chrome, timeout: 240000 }, async () => {
  const { prepare } = await import('../src/pipeline.mjs');
  const { openBuild } = await import('../src/render/browser.mjs');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-m6-'));
  const f = path.join(d, 'sb.json');
  fs.writeFileSync(f, JSON.stringify({ title: 'M6', type: 'reel', format: '16:9', captions: false, scenes: [
    { template: 'beforeafter', before: { text: 'Old' }, after: { text: 'New' }, duration: 7 }, { template: 'cta', headline: 'Go' }] }));
  const p = await prepare(f, { voice: 'skip' });
  const s = await openBuild(p.build.file, p.build.stage);
  try {
    const clip = async (ms) => { await s.seek(ms); return s.page.evaluate(() => getComputedStyle(document.querySelector('.scene.on .ba-before')).clipPath); };
    assert.match(await clip(200), /inset\(0px 100%/);
    assert.match(await clip(6800), /inset\(0px 50%/);
  } finally { await s.close(); }
  const g = path.join(d, 'clay.json');
  fs.writeFileSync(g, JSON.stringify({ title: 'Clay', type: 'story', format: '16:9', art: { style: 'clay' }, captions: false, scenes: [
    { template: 'story', characters: [{ who: 'boy' }], narration: 'Hi.' }, { template: 'story', characters: [{ who: 'girl' }], narration: 'Bye.' }] }));
  const q = await prepare(g, { voice: 'skip' });
  const html = fs.readFileSync(q.build.file, 'utf8');
  assert.match(html, /"preset":"clay"/);
  const s2 = await openBuild(q.build.file, q.build.stage);
  try {
    await s2.seek(1000);
    const ok = await s2.page.evaluate(() => window.__worldReady.then(() => true));
    assert.equal(ok, true);
  } finally { await s2.close(); fs.rmSync(d, { recursive: true, force: true }); }
});
