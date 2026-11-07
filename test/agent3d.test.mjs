import { test } from 'node:test';
import assert from 'node:assert/strict';
import { templatesDoc, STORY_EXAMPLE_3D } from '../src/docs.mjs';
import { validate } from '../src/schema/validate.mjs';
import { speedText, TOOL_DEFS } from '../src/tools.mjs';
import { PRESETS } from '../src/characters/presets.mjs';

const sb = (design) => ({ look: '3d', voice: { provider: 'none' }, cast: [{ id: 'd', design }], scenes: [{ template: 'story', characters: [{ who: 'd' }], narration: 'a' }, { template: 'story', narration: 'b' }] });

test('the 3D guide is only sent when asked for, and stays under 3 KB', () => {
  const d3 = templatesDoc('story', null, '3d'), d2 = templatesDoc('story');
  const part = d3.slice(d3.indexOf('## 3D look'), d3.indexOf('## Top-level'));
  assert.ok(part.length > 1000 && part.length <= 3000, `3D guide is ${part.length} bytes`);
  assert.match(d3, /preset:<id>/);
  assert.doesNotMatch(d2, /preset:<id>/);
  assert.match(d2, /look "3d" for the 3D guide/);
  assert.match(d3, /"look": "3d"/);
});

test('the 3D example storyboard is valid', () => {
  const r = validate(structuredClone(STORY_EXAMPLE_3D), { baseDir: '.' });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});

test('every preset is a valid design and fills in kind and name', () => {
  for (const id of Object.keys(PRESETS)) {
    const r = validate(sb(`preset:${id}`), { baseDir: '.' });
    assert.equal(r.ok, true, `${id}: ${JSON.stringify(r.errors)}`);
    assert.equal(r.storyboard.cast[0].name, PRESETS[id].name);
    assert.ok(r.storyboard.cast[0].kind);
  }
});

test('an unknown preset is one clear error that lists the presets', () => {
  const r = validate(sb('preset:unicorn'), { baseDir: '.' });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0].fix, /dragon/);
});

test('3D aliases from users and models are understood', () => {
  for (const look of ['3D', 'Pixar style', 'CGI', 'three d']) {
    const r = validate({ ...sb('preset:frog'), look }, { baseDir: '.' });
    assert.equal(r.storyboard.look, '3d', look);
  }
  const r = validate({ ...sb('preset:frog'), scenes: [{ template: 'story', camera: 'zoom in', characters: [{ who: 'd' }], narration: 'a' }, { template: 'story', camera: '360', narration: 'b' }] }, { baseDir: '.' });
  assert.deepEqual(r.storyboard.scenes.map(s => s.camera), ['dolly-in', 'orbit']);
});

test('render results say how fast 3D was and hint when there is no GPU', () => {
  assert.equal(speedText({ has3d: false }), '');
  assert.match(speedText({ has3d: true, gpu: true, renderFps: 22.8, workers: 4 }), /22\.8 frames\/s.*GPU/);
  assert.match(speedText({ has3d: true, gpu: false, renderFps: 3 }), /CPU.*video_doctor/);
  const t = TOOL_DEFS.find(x => x.name === 'video_templates');
  assert.deepEqual(t.parameters.properties.look.enum, ['2d', '3d']);
});

test('words models invent are corrected with a warning instead of failing (eval/3d findings)', () => {
  const r = validate({
    look: '3d', voice: { provider: 'none' },
    cast: [{ id: 'motu', kind: 'monkey', name: 'Motu' }, { id: 'raja', library: 'nobody-saved-this' }, { id: 'owl', kind: 'owl' }],
    scenes: [
      { template: 'story', camera: 'Fast tracking shot alongside Kai, then a sweeping reveal', weather: 'bubbles', characters: [{ who: 'motu', pose: 'sleep', near: 'spaceship' }, { who: 'owl', pose: 'perch', mood: 'shy', near: 'motu' }], narration: 'a' },
      { template: 'dialogue', camera: 'Wide, sweeping pullback across the peaks', lines: [{ who: 'owl', text: 'Hi.', mood: 'gentle' }, { who: 'motu', text: 'Hello.', mood: 'confident' }] },
    ],
  }, { baseDir: '.' });
  const [s0, s1] = r.storyboard.scenes;
  assert.equal(r.storyboard.cast[0].design.plan, PRESETS.monkey.design.plan);   // kind "monkey" → preset:monkey
  assert.equal(s0.camera, 'follow');
  assert.equal(s1.camera, 'dolly-out');
  assert.equal(s0.weather, 'sparkles');
  assert.deepEqual([s0.characters[0].pose, s0.characters[0].mood, s0.characters[0].near], ['sit', 'sleepy', 'ship']);
  assert.deepEqual([s0.characters[1].pose, s0.characters[1].mood, s0.characters[1].near], ['idle', 'worried', undefined]);
  assert.deepEqual(s1.lines.map(l => l.mood), ['happy', 'happy']);
  // An unknown saved character is still an error, with the way to fix it.
  assert.equal(r.ok, false);
  assert.deepEqual(r.errors.map(e => e.path), ['cast[1].design']);
  assert.match(r.errors[0].message, /no saved character "nobody-saved-this"/);
});
