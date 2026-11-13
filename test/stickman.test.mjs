// Stickman look (plan 14, Phase 2): characters, styles, props, validation and mouth shapes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { stickSvg, STICK_MOODS, baseMood } from '../src/compiler/stick.mjs';
import { characterSvg } from '../src/compiler/characters.mjs';
import { STYLES, ART_STYLES, styleCss, styleTheme, stickOptions, styleBase } from '../src/art/styles.mjs';
import { resolveIcon, propsHtml, ICONS } from '../src/art/props.mjs';
import { validate } from '../src/schema/validate.mjs';
import { CHARACTER_MOODS } from '../src/schema/spec.mjs';
import { fontFiles } from '../src/compiler/themes.mjs';
import { findChrome } from '../src/deps/locate.mjs';

const RIG = ['ch-head', 'ch-arm ch-arm-l', 'ch-arm ch-arm-r', 'ch-leg ch-leg-l', 'ch-leg ch-leg-r', 'ch-eyes', 'ch-mouth-closed', 'ch-vis'];

test('every head type and mood draws the full rig plus 8 mouth shapes', () => {
  for (const head of ['hollow', 'white', 'glow', 'beanie', 'hood']) {
    for (const mood of STICK_MOODS) {
      const svg = stickSvg('man', { head, mood, id: 'x' });
      for (const part of RIG) assert.ok(svg.includes(`class="${part}`), `${head}/${mood}: ${part}`);
      for (const v of 'ABCDEFGH') assert.ok(svg.includes(`class="v${v}"`), `${head}/${mood}: viseme ${v}`);
      assert.ok(svg.includes(`mood-${mood}`));
    }
  }
});

test('the wobble is fixed per character (no flicker) and differs between characters', () => {
  assert.equal(stickSvg('man', { id: 'sam' }), stickSvg('man', { id: 'sam' }));
  assert.notEqual(stickSvg('man', { id: 'sam' }), stickSvg('man', { id: 'raj' }));
});

test('family details: kids are smaller, grandparents wear glasses, gloves in thriller', () => {
  assert.match(stickSvg('boy', { id: 'a' }), /scale\(0\.86\)/);
  assert.doesNotMatch(stickSvg('man', { id: 'a' }), /scale\(0\.86\)/);
  assert.match(stickSvg('grandma', { id: 'a' }), /<circle cx="89"[^>]*r="8"\/>/);
  assert.match(stickSvg('man', { id: 'a', gloves: true }), /r="10" fill="#ffffff"/);
});

test('cartoon and 3D characters show the nearest of their six faces for stickman-only moods', () => {
  assert.equal(CHARACTER_MOODS.length, 13);
  assert.equal(baseMood('shocked'), 'surprised');
  assert.equal(baseMood('happy'), 'happy');
  assert.match(characterSvg('rabbit', { mood: 'crying' }), /mood-sad/);
  // Flat painter for animals beside stickmen: no gradients, ink outline.
  const flat = characterSvg('dog', { flat: { ink: '#111' } });
  assert.doesNotMatch(flat, /radialGradient/);
  assert.match(flat, /stroke="#111"/);
});

test('every style has a theme, CSS and stickman options (10 stickman styles from plan 14, more from plan 18)', () => {
  assert.ok(ART_STYLES.length >= 14);
  for (const id of ART_STYLES) {
    const css = styleCss({ style: id });
    assert.ok(css.includes(`#stage.st-${id}`), id);
    const t = styleTheme({ style: id });
    for (const k of ['bg', 'ink', 'accent', 'accent2', 'display']) assert.ok(t[k], `${id}.${k}`);
    if (styleBase(id) === 'stickman') assert.ok(['hollow', 'white', 'glow', 'beanie', 'hood'].includes(stickOptions({ style: id }).head), id);
  }
  assert.equal(styleTheme({ style: 'classic-bw', theme: 'dark' }).bg, STYLES['classic-bw'].dark.bg);
  // Dark scene styles draw faces in dark ink so a white head shows a face.
  for (const id of ['noir-thriller', 'amber-noir']) assert.match(stickOptions({ style: id }).ink, /^#1/);
});

test('handwriting fonts with Devanagari are bundled', () => {
  const f = fontFiles();
  assert.ok(f.some(x => x.family === 'Kalam' && x.range === 'U+0900-097F'));
  assert.ok(f.some(x => x.family === 'Caveat'));
});

test('props: names, aliases and plurals find icons; unknown ones are left out', () => {
  assert.ok(ICONS.length >= 140);
  assert.equal(resolveIcon('money'), 'banknote');
  assert.equal(resolveIcon('Battery Low'), 'battery-low');
  assert.equal(resolveIcon('phones'), 'phone');
  assert.equal(resolveIcon('old-tv'), 'tv');
  assert.equal(resolveIcon('xyzzy'), null);
  const html = propsHtml([{ icon: 'coffee', enter: 'draw' }, { icon: 'nope' }], { ink: '#111', accent: '#e00', accent2: '#0e0', ground: 100, posX: { left: 27 } });
  assert.equal((html.match(/class="st-prop/g) || []).length, 1);
  assert.match(html, /pe-draw/);
  assert.match(html, /pathLength="1"/);
});

const two = (extra) => ({ title: 'T', type: 'explainer', ...extra, scenes: [{ template: 'story', headline: 'Hi', narration: 'Hello there.', characters: [{ who: 'man', mood: 'panicking' }], props: ['phones', { icon: 'money', enter: 'falls' }, { icon: 'unicornz' }] }, { template: 'cta', headline: 'Go' }] });

test('validate: look aliases, style aliases, default style, props and new moods', () => {
  const a = validate(two({ look: 'stick figure' }));
  assert.equal(a.ok, true, JSON.stringify(a.errors));
  assert.equal(a.storyboard.look, 'stickman');
  assert.equal(a.storyboard.art.style, 'line-art');
  assert.deepEqual(a.storyboard.scenes[0].props.map(p => p.icon), ['phone', 'banknote']);
  assert.equal(a.storyboard.scenes[0].props[1].enter, 'drop');
  assert.ok(a.warnings.some(w => /unicornz/.test(w.message)));
  assert.equal(a.storyboard.scenes[0].characters[0].mood, 'sweating');
  assert.equal(validate(two({ look: 'retro tv' })).storyboard.art.style, 'retro-tv');
  const b = validate(two({ art: { style: 'B4' } }));
  assert.equal(b.storyboard.look, 'stickman');
  assert.equal(b.storyboard.art.style, 'noir-thriller');
  assert.equal(validate(two({ look: 'stickman', art: { style: 'neon-blob' } })).storyboard.art.style, 'line-art');
});

const canRender = findChrome() ? false : 'Chrome not found';
test('compiled page: stickmen, style class, fonts, props; mouth shape follows the line', { skip: canRender, timeout: 120000 }, async () => {
  const { prepare } = await import('../src/pipeline.mjs');
  const { openBuild } = await import('../src/render/browser.mjs');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-stick-'));
  const sb = { title: 'Stick test', type: 'story', format: '16:9', look: 'stickman', art: { style: 'retro-tv' }, cast: [{ id: 'sam', kind: 'man' }, { id: 'pup', kind: 'dog' }],
    scenes: [{ template: 'dialogue', characters: [{ who: 'sam' }, { who: 'pup' }], props: [{ icon: 'bell' }], lines: [{ who: 'sam', text: 'Hello there, little friend, how are you today?' }] }, { template: 'story', headline: 'The end' }] };
  const f = path.join(d, 'sb.json');
  fs.writeFileSync(f, JSON.stringify(sb));
  const p = await prepare(f, { voice: 'skip' });
  const html = fs.readFileSync(p.build.file, 'utf8');
  assert.match(html, /class="[^"]*look-stick st-retro-tv/);
  assert.match(html, /plan-stick st-head-glow/);
  assert.match(html, /font-family:"Kalam"/);
  assert.match(html, /st-prop/);
  const line = p.timeline.scenes[0].parts.find(x => x.kind === 'line');
  assert.ok(line.visemes.length > 5);
  const open = line.visemes.find(([, s]) => s !== 'X');
  const sess = await openBuild(p.build.file, p.build.stage);
  try {
    await sess.seek(Math.round((open[0] + 0.01) * 1000));
    const vis = await sess.page.evaluate(() => document.querySelector('.scene.on .chwrap[data-who="sam"]').dataset.vis);
    assert.equal(vis, open[1]);
    const shown = await sess.page.evaluate((v) => getComputedStyle(document.querySelector(`.scene.on .chwrap[data-who="sam"] .ch-vis .v${v}`)).display, open[1]);
    assert.equal(shown, 'inline');
    await sess.seek(Math.round((p.timeline.scenes[0].end - 0.05) * 1000));
    assert.equal(await sess.page.evaluate(() => document.querySelector('.scene.on .chwrap[data-who="sam"]').dataset.vis), '');
  } finally { await sess.close(); }
  fs.rmSync(d, { recursive: true, force: true });
});
