// Plan 18 (M1–M3): styles for every look, per-video variety, the short-form formats, kinetic typography
// and the hand-drawn reveal of whiteboard and chalkboard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { STYLES, ART_STYLES, styleBase, styleTheme, styleCss, STICK_STYLES } from '../src/art/styles.mjs';
import { variety, entranceCss, flatDecor, seeded } from '../src/art/variety.mjs';
import { validate } from '../src/schema/validate.mjs';
import { TEMPLATES, FORMAT_TEMPLATES } from '../src/schema/spec.mjs';
import { buildTimeline, afterVoice, minDuration } from '../src/timeline.mjs';
import { TEMPLATE_HTML } from '../src/compiler/templates.mjs';
import { templatesDoc } from '../src/docs.mjs';
import { FORMAT_RECIPES, resolveFormat } from '../src/formats-guide.mjs';
import { iconSvg } from '../src/art/props.mjs';
import { findChrome } from '../src/deps/locate.mjs';

const NEW = ['whiteboard', 'chalkboard', 'kinetic', 'flat-vector'];

test('new styles exist with the right base; stickman styles stay stickman', () => {
  for (const id of NEW) assert.ok(STYLES[id], id);
  assert.equal(styleBase('whiteboard'), 'stickman');
  assert.equal(styleBase('chalkboard'), 'stickman');
  assert.equal(styleBase('kinetic'), 'motion');
  assert.equal(styleBase('flat-vector'), '2d');
  assert.equal(styleBase('retro-tv'), 'stickman');
  assert.ok(!STICK_STYLES.includes('kinetic') && STICK_STYLES.includes('whiteboard'));
  for (const id of ART_STYLES) for (const k of ['bg', 'ink', 'accent', 'accent2', 'display']) assert.ok(styleTheme({ style: id })[k], `${id}.${k}`);
});

test('variety: the same video always looks the same; different videos in one style differ', () => {
  const a = variety({ title: 'Why we sleep' }, 'whiteboard');
  assert.deepEqual(variety({ title: 'Why we sleep' }, 'whiteboard'), a);
  const looks = new Set();
  for (const t of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) {
    const v = variety({ title: `Video ${t}` }, 'whiteboard');
    looks.add(JSON.stringify([v.entrance, v.transitions, v.accent, v.backdrop]));
  }
  assert.ok(looks.size >= 6, `only ${looks.size} different looks in 8 videos`);
  // The user's own accent wins; a "seed" field gives another look for the same title.
  assert.equal(variety({ title: 'x', accent: '#123456' }, 'flat-vector').accent, null);
  assert.notDeepEqual(variety({ title: 'x', seed: 2 }, 'kinetic'), variety({ title: 'x', seed: 3 }, 'kinetic'));
  // The accent from variety reaches the theme and the CSS.
  const v = variety({ title: 'Video A' }, 'flat-vector');
  assert.equal(styleTheme({ style: 'flat-vector' }, v).accent, v.accent[0]);
  assert.ok(entranceCss({ entrance: 'up' }) === '' && entranceCss({ entrance: 'blur' }).includes('@keyframes v-blur'));
  const d1 = flatDecor(v, 0, styleTheme({ style: 'flat-vector' }, v)), d2 = flatDecor(v, 1, styleTheme({ style: 'flat-vector' }, v));
  assert.equal((d1.match(/<i /g) || []).length, 3);
  assert.notEqual(d1, d2, 'each scene gets its own decoration');
  assert.ok(seeded('a')() !== seeded('b')());
});

test('style CSS: draw-on turns off the usual entrances; kinetic hides captions; flat removes shadows', () => {
  const wb = styleCss({ style: 'whiteboard' }, { backdrop: 'grid' });
  assert.match(wb, /#stage\.st-whiteboard \.a-up,[^{]*\{animation:none !important\}/);
  assert.match(wb, /\.wb-board\{position:absolute;inset:0;background:linear-gradient/);
  assert.match(styleCss({ style: 'chalkboard' }, {}), /feTurbulence/);
  assert.match(styleCss({ style: 'kinetic' }, {}), /#stage\.st-kinetic \.cap\{display:none !important\}/);
  assert.match(styleCss({ style: 'flat-vector' }, {}), /\.frame\{box-shadow:none/);
});

const sb = (extra, scenes) => ({ title: 'T', type: 'reel', ...extra, scenes });
const S = [
  { template: 'title', headline: 'Hi', narration: 'Hello there.' },
  { template: 'Top 10', number: 3, title: 'X' }, { template: 'would you rather', optionA: 'a', optionB: 'b' },
  { template: 'whatsapp', messages: [{ from: 'me', text: 'hey' }] }, { template: 'Myth vs Truth', myth: 'm', truth: 't' },
  { template: 'did you know', fact: 'f' }, { template: 'trivia', question: 'q', options: ['a', 'b'], answer: 1 }, { template: 'cta', headline: 'Go' },
];

test('validate: styles pick their look; format templates and their aliases; no "does not fit" warnings', () => {
  const cases = [[{ look: 'whiteboard' }, 'stickman', 'whiteboard'], [{ look: 'kinetic typography' }, '2d', 'kinetic'], [{ art: { style: 'flat design' } }, '2d', 'flat-vector'],
    [{ art: 'chalk' }, 'stickman', 'chalkboard'], [{ look: '2d', art: { style: 'whiteboard' } }, 'stickman', 'whiteboard']];
  for (const [extra, look, style] of cases) {
    const r = validate(sb(extra, S));
    assert.equal(r.ok, true, JSON.stringify(r.errors));
    assert.equal(r.storyboard.look, look, JSON.stringify(extra));
    assert.equal(r.storyboard.art.style, style);
  }
  const r = validate(sb({}, S));
  assert.deepEqual(r.storyboard.scenes.map((s) => s.template), ['title', 'rank', 'poll', 'chat', 'myth', 'fact', 'quiz', 'cta']);
  assert.ok(!r.warnings.some((w) => /does not fit/.test(w.message)), JSON.stringify(r.warnings));
  assert.deepEqual(FORMAT_TEMPLATES, ['rank', 'fact', 'myth', 'quiz', 'poll', 'chat']);
  for (const t of FORMAT_TEMPLATES) assert.equal(validate(sb({}, [TEMPLATES[t].example, { template: 'cta', headline: 'Go' }])).ok, true, t);
});

test('validate: format mistakes get clear errors', () => {
  const r = validate(sb({}, [{ template: 'quiz', question: 'q', options: ['only'], answer: 7 }, { template: 'chat', messages: [] }, { template: 'poll', optionA: 'a' }]));
  assert.equal(r.ok, false);
  const msgs = r.errors.map((e) => `${e.path}: ${e.message}`).join('\n');
  assert.match(msgs, /scenes\[0\]\.options: has 1 items, needs at least 2/);
  assert.match(msgs, /scenes\[0\]\.answer: is 7, must be between 1 and 4/);
  assert.match(msgs, /scenes\[1\]\.messages/);
  assert.match(msgs, /scenes\[2\]\.optionB/);
});

test('timeline: word times for each narration; a quiz waits for its countdown; chats get time per message', () => {
  const tl = buildTimeline({ format: '9:16', scenes: [{ template: 'quiz', narration: 'Which planet is the hottest?', countdown: 4 }, { template: 'chat', messages: Array(6).fill({ text: 'x' }) }, { template: 'title' }] });
  assert.equal(tl.scenes[0].words.length, 5);
  assert.ok(tl.scenes[0].words.every(([, a, b], k, w) => b > a && (k === 0 || a >= w[k - 1][1] - 0.01)));
  const speechEnd = tl.scenes[0].parts.at(-1).end;
  assert.ok(tl.scenes[0].end - speechEnd >= 4 + 1.5, 'room for the countdown and the answer');
  assert.equal(afterVoice({ template: 'quiz' }), 4.6);
  assert.ok(minDuration({ template: 'chat', messages: Array(6).fill({}) }) >= 7.8);
  assert.equal(tl.scenes[2].words, undefined);
});

const ctx = (tl, extra = {}) => ({ index: 0, fi: 1, format: '9:16', tl, dur: tl.duration, theme: { ink: '#111', accent: '#e00' }, asset: () => ({ src: 'x', aspect: 1 }), layout: { ground: 200, chh: 400 }, cast: new Map(), art: {}, world: {}, ...extra });

test('formats: reveals follow the voice', () => {
  const tl = buildTimeline({ format: '9:16', scenes: [
    { template: 'quiz', narration: 'Which planet is the hottest?', countdown: 3 },
    { template: 'myth', narration: 'Cracking knuckles causes arthritis. Studies found no link.' }] });
  const q = TEMPLATE_HTML.quiz({ template: 'quiz', question: 'Q?', options: ['A', 'B', 'C'], answer: 2, countdown: 3 }, ctx(tl.scenes[0]));
  const rv = +/--rv:([\d.]+)s/.exec(q)[1], t0 = +/--t0:([\d.]+)s/.exec(q)[1];
  const speechEnd = tl.scenes[0].parts.at(-1).end - tl.scenes[0].start;
  assert.ok(Math.abs(rv - (speechEnd + 3)) < 0.02 && Math.abs(t0 - speechEnd) < 0.02, `${rv} ${t0} ${speechEnd}`);
  assert.equal((q.match(/qz-right/g) || []).length, 1);
  assert.equal((q.match(/<b style="--d:/g) || []).length, 3, '3 countdown digits');
  const m = TEMPLATE_HTML.myth({ template: 'myth', myth: 'M', truth: 'T' }, ctx(tl.scenes[1]));
  const truthAt = +/--rv:([\d.]+)s/.exec(m)[1];
  const second = tl.scenes[1].words.find(([w]) => /^Studies/.test(w))[1] - tl.scenes[1].start;
  assert.ok(Math.abs(truthAt - (second - 0.1)) < 0.02, `truth at ${truthAt}, second sentence at ${second}`);
});

test('formats: chat, poll, rank and fact markup', () => {
  const tl = buildTimeline({ format: '9:16', scenes: [{ template: 'chat', messages: [{ from: 'Mom', text: 'Where?' }, { from: 'me', text: 'Library' }, { from: 'Mom', text: 'Me too.' }] }] });
  const c = TEMPLATE_HTML.chat({ template: 'chat', contact: 'Mom', messages: [{ from: 'Mom', text: 'Where?' }, { from: 'me', text: 'Library' }, { from: 'Mom', text: 'Me too.' }] }, ctx(tl.scenes[0]));
  assert.equal((c.match(/ct-msg them/g) || []).length, 2);
  assert.equal((c.match(/ct-msg me/g) || []).length, 1);
  assert.equal((c.match(/ct-typing/g) || []).length, 2, 'typing dots before the other person\'s messages only');
  const times = [...c.matchAll(/class="ct-msg[^"]*" style="--d:([\d.]+)s/g)].map((x) => +x[1]);
  assert.ok(times[0] < times[1] && times[1] < times[2]);
  assert.match(c, /<span class="ct-av">M<\/span>/);
  const p = TEMPLATE_HTML.poll({ template: 'poll', optionA: 'A', optionB: 'B', resultA: 70 }, ctx(buildTimeline({ format: '9:16', scenes: [{ template: 'poll' }] }).scenes[0]));
  assert.match(p, /--p:70%/); assert.match(p, /--p:30%/);
  assert.doesNotMatch(TEMPLATE_HTML.poll({ template: 'poll', optionA: 'A', optionB: 'B' }, ctx(buildTimeline({ format: '9:16', scenes: [{ template: 'poll' }] }).scenes[0])), /pl-bar/);
  const r = TEMPLATE_HTML.rank({ template: 'rank', number: 3, title: 'Snooze', icon: 'alarm' }, ctx(buildTimeline({ format: '9:16', scenes: [{ template: 'rank' }] }).scenes[0]));
  assert.match(r, /<span>#<\/span>3/); assert.match(r, /aria-label="alarm-clock"|aria-label="alarm"/);
  const f = TEMPLATE_HTML.fact({ template: 'fact', number: 4, fact: 'F' }, ctx(buildTimeline({ format: '9:16', scenes: [{ template: 'fact' }] }).scenes[0]));
  assert.match(f, /Fact #4/);
  assert.equal(iconSvg('nonexistent-thing'), null);
});

test('kinetic typography: big words timed to the voice; scenes with characters keep their picture', () => {
  const tl = buildTimeline({ format: '16:9', scenes: [{ template: 'title', narration: 'Three money habits that *actually* stick. Pay yourself first.' }, { template: 'story', characters: [{ who: 'man' }] }] });
  const k = TEMPLATE_HTML.title({ template: 'title', headline: 'Money habits' }, ctx(tl.scenes[0], { fi: 0, style: STYLES.kinetic, vary: { moves: ['kt-slam', 'kt-rise'] } }));
  const beats = [...k.matchAll(/class="kt-beat( kt-hot)?" style="--d:([\d.]+)s;--o:([\d.]+)s;--kin:(kt-\w+)"/g)];
  assert.ok(beats.length >= 3 && beats.length <= 6, String(beats.length));
  assert.ok(beats.every((b, i) => i === 0 || +b[2] >= +beats[i - 1][2]), 'in order');
  assert.ok(beats.some((b) => b[1]), 'the *starred* word is highlighted');
  assert.deepEqual(beats.slice(0, 2).map((b) => b[4]), ['kt-slam', 'kt-rise']);
  assert.match(k, /class="kt-label/);
  // A story scene with a character is drawn normally even in the kinetic style.
  const st = TEMPLATE_HTML.story({ template: 'story', characters: [{ who: 'man' }] }, ctx(tl.scenes[1], { fi: 0, style: STYLES.kinetic, isStick: () => false, is3d: () => false }));
  assert.doesNotMatch(st, /kt-beat/);
  // Without a voice the words are spread over the scene.
  const quiet = TEMPLATE_HTML.bullets({ template: 'bullets', headline: 'Save first', items: ['Automate it', 'Every payday'] }, ctx({ start: 0, duration: 5, parts: [] }, { fi: 0, dur: 5, style: STYLES.kinetic }));
  assert.ok((quiet.match(/kt-beat/g) || []).length >= 2);
});

test('the guide lists the styles and formats and gives a recipe', () => {
  const d = templatesDoc('reel', 'insta-reel', undefined, 'quiz');
  for (const s of ['whiteboard:', 'chalkboard:', 'kinetic:', 'flat-vector:', '### Recipe for "quiz"', '"template":"quiz"']) assert.ok(d.includes(s), s);
  assert.ok(d.includes('### "quiz"'), 'the chosen format\'s template is documented');
  assert.ok(templatesDoc('reel', 'insta-reel', undefined, 'countdown').includes('### "rank"'));
  assert.equal(resolveFormat('top-n'), 'countdown'); assert.equal(resolveFormat('would you rather'), 'poll'); assert.equal(resolveFormat('nope'), null);
  for (const [k, r] of Object.entries(FORMAT_RECIPES)) {
    const v = validate({ ...r.example, scenes: [...r.example.scenes, ...(r.example.scenes.length < 2 ? [{ template: 'cta', headline: 'Go' }] : [])] });
    assert.equal(v.ok, true, `${k}: ${JSON.stringify(v.errors)}`);
  }
  const manifest = JSON.parse(fs.readFileSync('agent/manifest.json', 'utf8'));
  assert.match(manifest.systemPrompt, /STYLES AND FORMATS/);
});

const chrome = findChrome() ? false : 'Chrome not found';
test('whiteboard page: the hand draws blocks in order, as the scene plays', { skip: chrome, timeout: 180000 }, async () => {
  const { prepare } = await import('../src/pipeline.mjs');
  const { openBuild } = await import('../src/render/browser.mjs');
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-wb-'));
  const f = path.join(d, 'sb.json');
  fs.writeFileSync(f, JSON.stringify({ title: 'Draw test', type: 'explainer', format: '9:16', look: 'whiteboard', captions: false, scenes: [
    { template: 'rank', number: 2, title: 'Fear of failing', text: 'Starting feels risky.', narration: 'Number two: fear of failing. Starting feels risky.' },
    { template: 'quiz', question: 'What helps?', options: ['Willpower', 'A small start'], answer: 2, narration: 'What helps most?' }] }));
  const p = await prepare(f, { voice: 'skip' });
  const html = fs.readFileSync(p.build.file, 'utf8');
  assert.match(html, /class="[^"]*look-stick st-whiteboard[^"]*draw-on draw-marker/);
  assert.match(html, /class="wb-hand"/);
  const s = await openBuild(p.build.file, p.build.stage);
  try {
    const state = async (sec) => { await s.seek(Math.round(sec * 1000)); return s.page.evaluate(() => ({
      hand: getComputedStyle(document.querySelector('.wb-hand')).display,
      clips: [...document.querySelectorAll('.scene.on .rk-num, .scene.on .headline, .scene.on .subline')].map((e) => e.style.clipPath || 'none'),
    })); };
    const early = await state(0.05), mid = await state(0.9), late = await state(p.timeline.scenes[0].end - 0.2);
    assert.ok(early.clips.every((c) => c.startsWith('inset(0px 100%') || c.startsWith('inset(0 100%')), `nothing drawn yet: ${early.clips}`);
    assert.equal(mid.hand, 'block');
    assert.ok(mid.clips.some((c) => c === 'none' || c === ''), 'the first block is done');
    assert.ok(late.clips.every((c) => c === 'none' || c === ''), `all drawn by the end: ${late.clips}`);
    assert.equal(late.hand, 'none', 'the hand leaves when it is done');
    // The quiz answer still lights up although entrances are off in this style.
    await s.seek(Math.round((p.timeline.scenes[1].end - 0.3) * 1000));
    const right = await s.page.evaluate(() => getComputedStyle(document.querySelector('.scene.on .qz-right')).backgroundColor);
    assert.notEqual(right, 'rgba(0, 0, 0, 0)');
  } finally { await s.close(); fs.rmSync(d, { recursive: true, force: true }); }
});
