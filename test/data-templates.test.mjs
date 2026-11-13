// Plan 18 M4: charts, timeline, map, newsroom and the documentary style.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { country, place, fitView, regionBox, allCountries } from '../src/art/maps.mjs';
import { validate } from '../src/schema/validate.mjs';
import { TEMPLATES, DATA_TEMPLATES } from '../src/schema/spec.mjs';
import { buildTimeline, minDuration, afterVoice } from '../src/timeline.mjs';
import { TEMPLATE_HTML } from '../src/compiler/templates.mjs';
import { cueTimes, palette } from '../src/compiler/data.mjs';
import { STYLES, styleBase, styleCss } from '../src/art/styles.mjs';
import { templatesDoc } from '../src/docs.mjs';
import { TOOL_DEFS } from '../src/tools.mjs';
import { findChrome } from '../src/deps/locate.mjs';

test('maps: countries by English, short and Hindi names; cities; lat/lon', () => {
  assert.equal(country('USA').name, 'United States of America');
  assert.equal(country('uk').name, 'United Kingdom');
  assert.equal(country('भारत').name, 'India');
  assert.equal(country('Ivory Coast').name, "Côte d'Ivoire");
  assert.equal(country('Atlantis'), null);
  const delhi = place('Delhi');
  assert.equal(delhi.kind, 'city'); assert.ok(Math.abs(delhi.lat - 28.6) < 0.2);
  assert.deepEqual(place('दिल्ली').lat, delhi.lat);
  assert.equal(place('Japan').kind, 'country');
  assert.equal(place({ lat: 10, lon: 20, label: 'Here' }).name, 'Here');
  assert.equal(place('Nowhere-ville'), null);
  // France's box is mainland France, not stretched to French Guiana.
  const fr = country('France').box;
  assert.ok(fr[0] > -6 && fr[2] < 10, String(fr));
  assert.ok(regionBox('south asia') && regionBox('एशिया'));
});

test('maps: shapes that cross the 180° line are continuous (no line across the map)', () => {
  for (const c of allCountries()) for (const poly of c.polys) for (const ring of poly) {
    for (let i = 1; i < ring.length; i++) assert.ok(Math.abs(ring[i][0] - ring[i - 1][0]) < 180, `${c.name} jumps at point ${i}`);
  }
});

test('maps: the view holds every place asked for, in the frame shape', () => {
  const pts = ['Kochi', 'Venice', 'Cairo'].map(place);
  const v = fitView({ points: pts, aspect: 9 / 16 });
  for (const p of pts) { const [x, y] = v.project(p.lon, p.lat); assert.ok(x > 0 && x < v.W && y > 0 && y < v.H, `${p.name} at ${x},${y}`); }
  assert.ok(Math.abs(v.W / v.H - 9 / 16) < 0.01);
});

test('reveal times follow the words that name each item, in order', () => {
  const tl = { start: 10, words: [['PhonePe', 10.5, 11], ['leads,', 11, 11.4], ['then', 11.5, 11.8], ['Google', 12, 12.3], ['Pay.', 12.3, 12.6], ['Paytm', 13.4, 13.8], ['is', 13.8, 14], ['last.', 14, 14.4]], parts: [{ end: 14.4 }] };
  const t = cueTimes({ tl, dur: 6 }, ['PhonePe', 'Google Pay', 'Others', 'Paytm']);
  assert.equal(t[0], 0.5); assert.ok(Math.abs(t[1] - 1.85) < 0.01); assert.ok(Math.abs(t[3] - 3.25) < 0.01);
  assert.ok(t[2] > t[1] && t[2] < t[3], 'an item not named sits between its neighbours');
  const none = cueTimes({ tl: { start: 0, words: [], parts: [] }, dur: 6 }, ['a', 'b', 'c']);
  assert.ok(none[0] < none[1] && none[1] < none[2]);
});

const sb = (scenes, extra = {}) => ({ title: 'T', type: 'explainer', ...extra, scenes: [...scenes, { template: 'cta', headline: 'Go' }] });

test('validate: every example is valid; loose input is tidied', () => {
  for (const t of DATA_TEMPLATES) { const r = validate(sb([TEMPLATES[t].example])); assert.equal(r.ok, true, `${t}: ${JSON.stringify(r.errors)}`); }
  const r = validate(sb([
    { template: 'bar chart race', years: [2000, 2010], data: { India: [1, 5], China: ['2', '9'] } },
    { template: 'Pie Chart', data: [['A', '60%'], ['B', 40]] },
    { template: 'line graph', data: [{ year: 2020, value: '1,200' }, { year: 2021, value: 1500 }] },
    { template: 'world map', countries: 'India, Japan', route: 'Delhi -> Tokyo', pins: ['Mumbai'] },
    { template: 'history', events: ['1947: Independence', { date: 1950, title: 'Republic' }] },
    { template: 'breaking news', title: 'Big news', headlines: 'One | Two' },
  ]));
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const [race, pie, line, map, tl, news] = r.storyboard.scenes;
  assert.equal(race.kind, 'race'); assert.deepEqual(race.steps, ['2000', '2010']); assert.deepEqual(race.data[1], { label: 'China', values: [2, 9] });
  assert.equal(pie.kind, 'pie'); assert.equal(pie.data[0].value, 60);
  assert.equal(line.kind, 'line'); assert.deepEqual(line.data[0], { label: '2020', value: 1200 });
  assert.deepEqual(map.highlight, ['India', 'Japan']); assert.deepEqual(map.route, ['Delhi', 'Tokyo']); assert.deepEqual(map.pins, [{ place: 'Mumbai' }]);
  assert.deepEqual(tl.events, [{ year: '1947', title: 'Independence' }, { title: 'Republic', year: '1950' }]);
  assert.equal(news.template, 'news'); assert.equal(news.headline, 'Big news'); assert.deepEqual(news.ticker, ['One', 'Two']);
  assert.ok(!r.warnings.some((w) => /does not fit/.test(w.message) && !/scenes\[6\]/.test(w.path)), JSON.stringify(r.warnings));
});

test('validate: chart and map mistakes get clear errors', () => {
  const r = validate(sb([
    { template: 'chart', kind: 'race', data: [{ label: 'A', value: 3 }, { label: 'B', values: [1, 2] }] },
    { template: 'chart', kind: 'bar', data: [{ label: 'A', value: 'lots' }, { label: 'B', value: 2 }] },
    { template: 'map', highlight: ['Narnia'], route: ['Delhi', 'Gotham'] },
  ]));
  const msg = r.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
  assert.match(msg, /scenes\[0\]\.data\[0\]: a race needs "values"/);
  assert.match(msg, /scenes\[0\]\.steps: a race needs at least 2 steps/);
  assert.match(msg, /scenes\[1\]\.data\[0\]\.value/);
  assert.match(msg, /scenes\[2\]\.highlight\[0\]: no country called "Narnia"/);
  assert.match(msg, /scenes\[2\]\.route\[1\]: no place called "Gotham"/);
});

test('timeline: races and timelines get enough time; numbers get time to finish', () => {
  assert.ok(minDuration({ template: 'chart', kind: 'race', steps: Array(8).fill('x') }) >= 9);
  assert.ok(minDuration({ template: 'timeline', events: Array(6).fill({}) }) >= 8);
  assert.equal(afterVoice({ template: 'chart', kind: 'bar' }), 1);
  const tl = buildTimeline({ format: '16:9', scenes: [{ template: 'chart', kind: 'race', steps: Array(10).fill('x'), narration: 'Short.' }] });
  assert.ok(tl.scenes[0].duration >= 11);
});

const ctx = (sc, extra = {}) => {
  const tl = buildTimeline({ format: '16:9', scenes: [sc] }).scenes[0];
  return { index: 0, fi: 0, format: '16:9', tl, dur: tl.duration, theme: STYLES.documentary.theme, asset: () => ({ src: 'x.jpg', aspect: 1.5 }), ...extra };
};

test('charts: bars, line, pie and race markup', () => {
  const bar = TEMPLATES.chart.example;
  const b = TEMPLATE_HTML.chart(bar, ctx(bar));
  assert.equal((b.match(/class="cb-row/g) || []).length, 4);
  assert.match(b, /class="cb-row hot"/);
  assert.match(b, /data-cu="[\d.]+:0\|[\d.]+:48"/);
  assert.match(b, /<b>48<\/b>%/);
  const line = { template: 'chart', kind: 'line', prefix: '₹', data: [{ label: '2015', value: 6000 }, { label: '2019', value: 11538 }, { label: '2023', value: 12544 }] };
  const l = TEMPLATE_HTML.chart(line, ctx(line));
  assert.match(l, /class="ln-line" d="M/);
  const dots = [...l.matchAll(/class="ln-dot[^"]*"[^>]*--d:([\d.]+)s/g)].map((m) => +m[1]);
  assert.equal(dots.length, 3); assert.ok(dots[0] < dots[1] && dots[1] < dots[2]);
  assert.match(l, /data-loc="en-IN"/, '₹ numbers use Indian grouping');
  assert.match(l, />₹15K</);
  const pie = { template: 'chart', kind: 'pie', data: [{ label: 'A', value: 50 }, { label: 'B', value: 30 }, { label: 'C', value: 20 }] };
  const p = TEMPLATE_HTML.chart(pie, ctx(pie));
  const shares = [...p.matchAll(/--p:([\d.]+);--off:(-?[\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  assert.deepEqual(shares, [[50, 0], [30, -50], [20, -80]]);
  const race = { template: 'chart', kind: 'race', steps: ['1990', '2000', '2010'], data: [{ label: 'A', values: [1, 5, 9] }, { label: 'B', values: [4, 3, 2] }, { label: 'C', values: [2, 2, 12] }], top: 2 };
  const rc = TEMPLATE_HTML.chart(race, ctx(race));
  assert.equal((rc.match(/@keyframes rc0p/g) || []).length, 3);
  // C starts second, drops out of the top 2 (hidden) in 2000, and ends first.
  assert.match(rc, /@keyframes rc0p2\{0%\{transform:translateY\(100%\);opacity:1\}50%\{transform:translateY\(200%\);opacity:0\}100%\{transform:translateY\(0%\);opacity:1\}\}/);
  assert.match(rc, /class="cu rc-year" data-cu="[\d.]+:1990\|[\d.]+:2000\|[\d.]+:2010"[^>]*data-grp="0"/);
});

test('chart colours come from the theme without repeats', () => {
  const pal = palette({ accent: '#e63946', accent2: '#2bb3a3', ok: '#2bb3a3', alert: '#e63946', ink: '#1f2a44', bg: '#f4f6fb' });
  assert.equal(pal.length, 8);
  assert.equal(new Set(pal).size, 8);
  assert.deepEqual(pal.slice(0, 2), ['#e63946', '#2bb3a3']);
});

test('timeline, map and news markup', () => {
  const t = TEMPLATES.timeline.example;
  const th = TEMPLATE_HTML.timeline(t, ctx(t));
  const times = [...th.matchAll(/class="tl-ev[^"]*" style="--d:([\d.]+)s/g)].map((m) => +m[1]);
  assert.equal(times.length, 4); assert.ok(times.every((x, i) => !i || x > times[i - 1]));
  const words = buildTimeline({ format: '16:9', scenes: [t] }).scenes[0].words;
  const said2014 = words.find(([w]) => w.startsWith('2014'))[1];
  assert.ok(Math.abs(times[2] - (said2014 - 0.15 - buildTimeline({ format: '16:9', scenes: [t] }).scenes[0].start)) < 0.02, 'the 2014 event lights up when "2014" is said');
  const m = TEMPLATES.map.example;
  const mh = TEMPLATE_HTML.map(m, ctx(m));
  assert.equal((mh.match(/class="mp-hi"/g) || []).length, 2);
  assert.equal((mh.match(/class="mp-route"/g) || []).length, 3);
  assert.equal((mh.match(/class="mp-stop"/g) || []).length, 4);
  assert.match(mh, /class="mp-land" d="M[\d.]+ [\d.]+L/);
  assert.ok(mh.length < 120000, `map scene is ${mh.length} bytes`);
  const world = TEMPLATE_HTML.map({ template: 'map', region: 'world', highlight: ['Russia', 'Fiji'] }, ctx({ template: 'map' }));
  assert.ok(world.length < 160000);
  const n = TEMPLATES.news.example;
  const nh = TEMPLATE_HTML.news(n, ctx(n));
  assert.match(nh, /class="nw-tag"[^>]*>Breaking news</);
  assert.equal((nh.match(/<span>Rover Pragyan rolls out<\/span>/g) || []).length, 2, 'the ticker repeats so it never runs out');
  assert.match(TEMPLATE_HTML.news({ template: 'news', headline: 'H', image: 'a.jpg' }, ctx(n)), /class="nw-img" src="x.jpg"/);
});

test('documentary style; guide, tool and prompt know the new formats', () => {
  assert.equal(styleBase('documentary'), 'motion');
  const css = styleCss({ style: 'documentary' }, {});
  assert.match(css, /#stage\.st-documentary::before\{[^}]*feTurbulence/);
  assert.match(css, /\.lang-deva \.kicker\{letter-spacing:\.02em\}/);
  const r = validate(sb([TEMPLATES.map.example], { look: 'documentary' }));
  assert.equal(r.storyboard.art.style, 'documentary');
  const d = templatesDoc('explainer', 'youtube', undefined, 'documentary');
  for (const s of ['### Recipe for "documentary"', '### "map"', '### "timeline"', 'documentary:']) assert.ok(d.includes(s), s);
  assert.ok(templatesDoc('explainer', 'youtube', undefined, 'data').includes('never invent data'));
  const fmt = TOOL_DEFS.find((t) => t.name === 'video_templates').parameters.properties.format.enum;
  for (const f of ['data', 'documentary', 'news']) assert.ok(fmt.includes(f), f);
  const prompt = JSON.parse(fs.readFileSync('agent/manifest.json', 'utf8')).systemPrompt;
  assert.match(prompt, /Kinetic typography, charts, maps, timelines and news layouts are storyboard templates/);
  assert.ok(fs.existsSync('src/data/LICENSE-world-atlas.txt'));
});

const chrome = findChrome() ? false : 'Chrome not found';
test('page: numbers count up with the scene; the race reorders; map highlights fade in', { skip: chrome, timeout: 180000 }, async () => {
  const { prepare } = await import('../src/pipeline.mjs');
  const { openBuild } = await import('../src/render/browser.mjs');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-data-'));
  const f = path.join(d, 'sb.json');
  fs.writeFileSync(f, JSON.stringify({ title: 'Data test', type: 'explainer', format: '16:9', look: 'documentary', captions: false, scenes: [
    { template: 'chart', kind: 'bar', data: [{ label: 'A', value: 1200 }, { label: 'B', value: 300 }] },
    { template: 'chart', kind: 'race', steps: ['2000', '2010', '2020'], data: [{ label: 'A', values: [9, 5, 1] }, { label: 'B', values: [1, 5, 9] }] },
    { template: 'map', highlight: ['India'] }] }));
  const p = await prepare(f, { voice: 'skip' });
  const s = await openBuild(p.build.file, p.build.stage);
  const sc = p.timeline.scenes;
  try {
    const read = async (ms, sel) => { await s.seek(Math.round(ms)); return s.page.evaluate((q) => [...document.querySelectorAll(`.scene.on ${q}`)].map((e) => e.textContent), sel); };
    assert.deepEqual(await read(50, '.cb-val'), ['0', '0']);
    const mid = await read(sc[0].start * 1000 + 950, '.cb-val');
    assert.ok(+mid[0].replace(/,/g, '') > 0 && +mid[0].replace(/,/g, '') < 1200, `counting: ${mid}`);
    assert.deepEqual(await read(sc[0].end * 1000 - 50, '.cb-val'), ['1,200', '300']);
    const order = async (ms) => { await s.seek(Math.round(ms)); return s.page.evaluate(() => [...document.querySelectorAll('.scene.on .rc-row')].map((r) => [r.querySelector('.rc-lab').textContent, r.getBoundingClientRect().top]).sort((a, b) => a[1] - b[1]).map((x) => x[0]).join('')); };
    assert.equal(await order(sc[1].start * 1000 + 300), 'AB');
    assert.equal(await order(sc[1].end * 1000 - 100), 'BA');
    assert.equal((await read(sc[1].end * 1000 - 100, '.rc-year'))[0], '2020');
    await s.seek(Math.round(sc[2].end * 1000 - 100));
    const fill = await s.page.evaluate(() => { const e = document.querySelector('.scene.on .mp-hi'); return [getComputedStyle(e).fill, getComputedStyle(e).opacity]; });
    assert.equal(fill[1], '1');
    assert.match(fill[0], /^rgb\(/, `a real colour, not ${fill[0]}`);
  } finally { await s.close(); fs.rmSync(d, { recursive: true, force: true }); }
});
