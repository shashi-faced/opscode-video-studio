// Video types, characters, story/dialogue/steps scenes, per-line speech timing and voices.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validate } from '../src/schema/validate.mjs';
import { buildTimeline, speechParts, PART_GAP } from '../src/timeline.mjs';
import { castVoices } from '../src/audio/tts.mjs';
import { compile } from '../src/compiler/compile.mjs';
import { characterSvg } from '../src/compiler/characters.mjs';
import { CHARACTER_KINDS, POSES, CHARACTER_MOODS } from '../src/schema/spec.mjs';
import { templatesDoc } from '../src/docs.mjs';

const story = () => ({
  type: 'kids story',
  title: 'Test story',
  cast: [{ name: 'Miko', kind: 'bunny' }, { id: 'tara', kind: 'star', name: 'Tara' }],
  scenes: [
    { template: 'story', bg: 'garden', time: 'evening', headline: 'Miko', characters: ['miko'], narration: 'Once upon a time.' },
    { template: 'conversation', lines: ['Tara: I fell from the sky.', { speaker: 'Miko', says: 'I will help you!', mood: 'excited' }] },
    { template: 'story', headline: 'The End', characters: [{ who: 'miko', pose: 'waving', mood: 'scared', position: 'middle' }], narration: 'The end.' },
  ],
});

test('story type sets theme, music and captions, and normalises loose input', () => {
  const v = validate(story());
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const sb = v.storyboard;
  assert.equal(sb.type, 'story');
  assert.equal(sb.theme, 'storybook');
  assert.equal(sb.music.style, 'playful');
  assert.equal(sb.cast[0].kind, 'rabbit');
  assert.equal(sb.cast[0].id, 'miko');
  assert.equal(sb.scenes[0].background, 'meadow');
  assert.equal(sb.scenes[0].time, 'sunset');
  assert.deepEqual(sb.scenes[0].characters, [{ who: 'miko' }]);
  assert.equal(sb.scenes[1].template, 'dialogue');
  assert.deepEqual(sb.scenes[1].lines[0], { who: 'tara', text: 'I fell from the sky.' });
  assert.deepEqual(sb.scenes[1].lines[1], { who: 'miko', text: 'I will help you!', mood: 'happy' });
  assert.equal(sb.scenes[1].background, 'meadow', 'background carried over from the previous scene');
  const c = sb.scenes[2].characters[0];
  assert.deepEqual([c.pose, c.mood, c.position], ['wave', 'worried', 'center']);
});

test('unknown speakers are errors with a fix naming the cast', () => {
  const sb = story();
  sb.scenes[1].lines.push({ who: 'bob', text: 'Hi' });
  const v = validate(sb);
  assert.equal(v.ok, false);
  const e = v.errors.find(x => x.path === 'scenes[1].lines[2].who');
  assert.ok(e && /miko/.test(e.fix) && /tara/.test(e.fix), JSON.stringify(v.errors));
});

test('a plain character kind works without a cast', () => {
  const v = validate({ type: 'greeting', scenes: [{ template: 'story', background: 'diwali', characters: [{ who: 'girl', pose: 'cheer' }], narration: 'Happy Diwali!' }, { template: 'cta', headline: 'Sharma Sweets' }] });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(v.storyboard.scenes[0].background, 'festival');
  assert.equal(v.storyboard.music.style, 'festive');
});

test('steps template accepts items as an alias', () => {
  const v = validate({ type: 'howto', scenes: [{ template: 'title', headline: 'Make chai' }, { template: 'how-to', headline: 'Steps', items: ['Boil water', 'Add tea', 'Add milk'] }] });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.deepEqual(v.storyboard.scenes[1].steps, ['Boil water', 'Add tea', 'Add milk']);
});

test('speech parts: narration first, then each line; timeline windows follow measured lengths', () => {
  const sb = validate(story()).storyboard;
  assert.deepEqual(speechParts(sb.scenes[1]).map(p => [p.kind, p.who]), [['line', 'tara'], ['line', 'miko']]);
  const tl = buildTimeline(sb, [2, 1 + PART_GAP + 2, 1], [[2], [1, 2], [1]]);
  const parts = tl.scenes[1].parts;
  assert.equal(parts.length, 2);
  assert.equal(+(parts[0].end - parts[0].start).toFixed(3), 1);
  assert.equal(+(parts[1].start - parts[0].end).toFixed(3), PART_GAP);
  assert.equal(tl.scenes[1].captions.length, 0, 'dialogue lines show in bubbles, not captions');
  assert.ok(tl.scenes[0].captions.length > 0);
});

test('characters get distinct voices from the narrator language', () => {
  const sb = validate({ ...story(), voice: { voice: 'hi-IN-SwaraNeural' }, cast: [{ id: 'a', kind: 'rabbit' }, { id: 'b', kind: 'star' }, { id: 'c', kind: 'owl' }] }).storyboard;
  const v = castVoices(sb);
  assert.equal(v.get('c').voice, 'hi-IN-MadhurNeural');
  assert.equal(v.get('a').voice, 'hi-IN-SwaraNeural');
  assert.notEqual(v.get('a').pitch, v.get('b').pitch, 'two kid voices must not sound the same');
  assert.equal(castVoices({ cast: [{ id: 'x', kind: 'boy', voice: 'en-GB-RyanNeural', pitch: '+3%' }] }).get('x').pitch, '+3%');
});

test('every character renders in every pose and mood', () => {
  for (const k of CHARACTER_KINDS) for (const pose of POSES) for (const mood of CHARACTER_MOODS) {
    const svg = characterSvg(k, { pose, mood }, 't');
    assert.ok(svg.startsWith('<svg') && svg.includes('ch-mouth-open') && !svg.includes('undefined') && !svg.includes('NaN'), `${k} ${pose} ${mood}`);
  }
});

test('a story compiles to a page with backgrounds, characters and bubbles', () => {
  const sb = validate(story()).storyboard;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-'));
  const { file } = compile(sb, buildTimeline(sb), { baseDir: dir, buildDir: dir });
  const html = fs.readFileSync(file, 'utf8');
  assert.equal((html.match(/class="bgart"/g) || []).length, 3);
  assert.ok(html.includes('data-who="miko"') && html.includes('data-who="tara"'));
  assert.equal((html.match(/class="bubble"/g) || []).length, 2);
  assert.ok(html.includes('class="storytitle"'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('templates doc for a type is focused', () => {
  const doc = templatesDoc('story');
  assert.ok(doc.includes('Recipe for "story"') && doc.includes('### "dialogue"'));
  assert.ok(!doc.includes('### "feature"'));
  assert.ok(templatesDoc('tutorial').includes('### "steps"'));
});
