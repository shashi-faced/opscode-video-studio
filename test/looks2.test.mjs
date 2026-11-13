// Plan 18 M5: neon, horror, retro pixel, paper cut-out, watercolor, comic and isometric looks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STYLES, STYLE_ALIASES, styleBase, styleCss, styleTheme, stickOptions } from '../src/art/styles.mjs';
import { LOOKS2, looksDecor, looksDefs } from '../src/art/looks2.mjs';
import { variety } from '../src/art/variety.mjs';
import { validate } from '../src/schema/validate.mjs';
import { templatesDoc } from '../src/docs.mjs';
import { findChrome } from '../src/deps/locate.mjs';

const IDS = ['neon', 'horror', 'retro-pixel', 'paper-cutout', 'watercolor', 'comic', 'isometric'];

test('seven new looks with the right base, theme and CSS', () => {
  assert.deepEqual(Object.keys(LOOKS2), IDS);
  assert.deepEqual(IDS.map(styleBase), ['stickman', 'stickman', '2d', '2d', '2d', '2d', '2d']);
  for (const id of IDS) {
    const t = styleTheme({ style: id });
    for (const k of ['bg', 'ink', 'accent', 'accent2', 'display']) assert.ok(t[k], `${id}.${k}`);
    const css = styleCss({ style: id }, variety({ title: 'x' }, id));
    assert.ok(css.includes(`#stage.st-${id} .scene>.lk`), id);
    assert.ok(STYLES[id].accents?.length >= 4, `${id} has accent pairs for variety`);
  }
  assert.equal(stickOptions({ style: 'neon' }).head, 'glow');
  assert.equal(stickOptions({ style: 'horror' }).head, 'hollow');
});

test('aliases: everyday names find the look', () => {
  const cases = { synthwave: 'neon', cyberpunk: 'neon', horror: 'horror', spooky: 'horror', '8-bit': 'retro-pixel', 'pixel art': 'retro-pixel', 'paper cut-out': 'paper-cutout', collage: 'paper-cutout', watercolour: 'watercolor', storybook: 'watercolor', 'comic book': 'comic', manga: 'comic', isometric: 'isometric', '2.5d': 'isometric' };
  for (const [k, v] of Object.entries(cases)) assert.equal(STYLE_ALIASES[k], v, k);
  const r = validate({ title: 'x', look: 'comic book', scenes: [{ template: 'title', headline: 'a', sfx: 'POW!' }, { template: 'cta', headline: 'b' }] });
  assert.equal(r.ok, true); assert.equal(r.storyboard.look, '2d'); assert.equal(r.storyboard.art.style, 'comic');
  assert.ok(!r.warnings.some((w) => /sfx/.test(w.path)), 'sfx is a known field');
});

test('scenery: the same video gives the same scenery; scenes differ; maps and news get none', () => {
  const theme = styleTheme({ style: 'paper-cutout' });
  for (const id of ['neon', 'horror', 'retro-pixel', 'paper-cutout', 'watercolor', 'comic', 'isometric']) {
    const v = variety({ title: 'Video' }, id);
    const a = looksDecor(STYLES[id], v, 0, theme, { template: 'title' }, 0);
    assert.ok(a.startsWith('<div class="lk'), id);
    assert.equal(a, looksDecor(STYLES[id], v, 0, theme, { template: 'title' }, 0), `${id} is deterministic`);
    if (!['comic'].includes(id)) assert.notEqual(a, looksDecor(STYLES[id], v, 1, theme, { template: 'title' }, 0), `${id} varies by scene`);
    assert.equal(looksDecor(STYLES[id], v, 0, theme, { template: 'map' }, 0), '');
  }
  assert.equal(looksDecor(STYLES['line-art'], {}, 0, theme, { template: 'title' }, 0), '');
});

test('comic bursts, neon text scenes and isometric blocks', () => {
  const t = styleTheme({ style: 'comic' }), v = variety({ title: 'x' }, 'comic');
  const c = looksDecor(STYLES.comic, v, 0, t, { template: 'title', sfx: 'POW!<b>' }, 0);
  assert.match(c, /class="cm-sfx"[^>]*>POW!b<\/div>/, 'escaped');
  assert.match(c, /class="cm-burst"/);
  assert.doesNotMatch(looksDecor(STYLES.comic, v, 0, t, { template: 'bullets' }, 0), /cm-burst/, 'no action lines behind lists');
  assert.match(looksDecor(STYLES.neon, v, 0, t, { template: 'cta' }, 1), /class="lk txt"/);
  assert.match(looksDecor(STYLES.neon, v, 0, t, { template: 'story' }, 1), /class="lk"/);
  const iso = looksDecor(STYLES.isometric, variety({ title: 'x' }, 'isometric'), 0, styleTheme({ style: 'isometric' }), { template: 'title' }, 0);
  const blocks = (iso.match(/class="blk"/g) || []).length;
  assert.ok(blocks >= 5 && blocks <= 6, String(blocks));
  assert.equal((iso.match(/<polygon /g) || []).length, 3 + blocks * 3, 'plate (3 faces) + 3 faces per block');
  assert.match(iso, /class="flow"/);
  assert.match(looksDecor(STYLES.isometric, variety({ title: 'x' }, 'isometric'), 0, styleTheme({ style: 'isometric' }), { template: 'bullets' }, 0), /opacity:\.35/, 'faint behind text');
});

test('filters only for the looks that need them; fitted labels have no vertical padding', () => {
  assert.match(looksDefs(STYLES['retro-pixel']), /id="lk-px"/);
  assert.match(looksDefs(STYLES.watercolor), /id="lk-wc".*id="lk-wash"/);
  assert.match(looksDefs(STYLES['paper-cutout']), /id="lk-torn"/);
  assert.equal(looksDefs(STYLES.neon), '');
  for (const id of IDS) {
    for (const m of styleCss({ style: id }, {}).matchAll(/\.kicker\{([^}]*)\}/g)) {
      const pad = /padding:([^;]+)/.exec(m[1]);
      assert.ok(!pad || /^0\b/.test(pad[1].trim()), `${id} kicker padding ${pad?.[1]}`);
      assert.doesNotMatch(m[1], /(^|;)border:/, `${id} kicker border adds height`);
    }
  }
});

test('the guide describes every look', () => {
  const d = templatesDoc('story');
  for (const id of IDS) assert.match(d, new RegExp(`- ${id}: `), id);
  assert.match(JSON.parse(fs.readFileSync('agent/manifest.json', 'utf8')).systemPrompt, /neon \/ synthwave, horror \/ mystery, retro pixel/);
});

const chrome = findChrome() ? false : 'Chrome not found';
test('pages: pixel filter is defined; horror creeps in; neon floor rolls with the scene', { skip: chrome, timeout: 240000 }, async () => {
  const { prepare } = await import('../src/pipeline.mjs');
  const { openBuild } = await import('../src/render/browser.mjs');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-looks-'));
  const run = async (style, check) => {
    const f = path.join(d, `${style}.json`);
    fs.writeFileSync(f, JSON.stringify({ title: `T ${style}`, type: 'story', format: '16:9', art: { style }, captions: false, scenes: [
      { template: 'story', characters: [{ who: 'boy' }], narration: 'A boy.' }, { template: 'title', headline: 'Hello', duration: 4 }] }));
    const p = await prepare(f, { voice: 'skip' });
    const s = await openBuild(p.build.file, p.build.stage);
    try { await check(s, p); } finally { await s.close(); }
  };
  await run('retro-pixel', async (s) => {
    await s.seek(1500);
    const r = await s.page.evaluate(() => ({ def: !!document.getElementById('lk-px'), f: getComputedStyle(document.querySelector('.scene.on .chwrap')).filter }));
    assert.equal(r.def, true); assert.match(r.f, /url\("?#lk-px"?\)/);
  });
  await run('horror', async (s, p) => {
    const scale = async (ms) => { await s.seek(ms); return s.page.evaluate(() => new DOMMatrix(getComputedStyle(document.querySelector('.scene.on')).transform).a); };
    const a = await scale(100), b = await scale(Math.round(p.timeline.scenes[0].end * 1000) - 100);
    assert.ok(a < 1.01 && b > 1.03, `${a} → ${b}`);
  });
  await run('neon', async (s) => {
    const pos = async (ms) => { await s.seek(ms); return s.page.evaluate(() => getComputedStyle(document.querySelector('.scene.on .nx-floor')).backgroundPosition); };
    const a = await pos(100), b = await pos(700), a2 = await pos(100);
    assert.notEqual(a, b); assert.equal(a, a2, 'the same time gives the same frame');
  });
  fs.rmSync(d, { recursive: true, force: true });
});
