import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validate } from '../src/schema/validate.mjs';
import { buildTimeline } from '../src/timeline.mjs';
import { compile } from '../src/compiler/compile.mjs';
import { CHARACTER_KINDS } from '../src/schema/spec.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseDir = path.join(ROOT, 'examples');
const story = JSON.parse(fs.readFileSync(path.join(baseDir, 'kids-story-3d.json'), 'utf8'));

function build(sb) {
  const v = validate(sb, { baseDir });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const tl = buildTimeline(v.storyboard);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov3d-'));
  const b = compile(v.storyboard, tl, { baseDir, buildDir: dir });
  const html = fs.readFileSync(b.file, 'utf8');
  const spec = JSON.parse(html.match(/<script type="application\/json" id="world3d">([\s\S]*?)<\/script>/)[1]);
  return { b, html, spec, dir };
}

test('look, camera and new poses accept loose wording', () => {
  const sb = structuredClone(story);
  sb.look = 'Pixar style';
  sb.scenes[1].camera = 'close up';
  sb.scenes[1].characters[0].pose = 'sitting';
  const r = validate(sb, { baseDir });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.storyboard.look, '3d');
  assert.equal(r.storyboard.scenes[1].camera, 'close');
  assert.equal(r.storyboard.scenes[1].characters[0].pose, 'sit');
});

test('a 3D storyboard compiles to a three.js world with every story scene', () => {
  const { b, html, spec, dir } = build(story);
  assert.equal(b.has3d, true);
  const storyScenes = story.scenes.map((s, i) => [s, i]).filter(([s]) => s.template === 'story' || s.template === 'dialogue');
  assert.deepEqual(Object.keys(spec.scenes).map(Number), storyScenes.map(([, i]) => i));
  for (const f of ['assets/three/three.module.js', 'assets/three/three.core.js', 'assets/three/addons/effects/OutlineEffect.js', 'assets/world3d.js']) assert.ok(fs.existsSync(path.join(dir, f)), f);
  assert.match(html, /<script type="importmap">/);
  assert.match(html, /class="bubble" data-line="0" data-who="/);
  assert.ok(!/class="chwrap/.test(html), '3D scenes do not draw 2D characters');
  for (const c of story.cast) assert.ok(spec.kinds[c.kind], `kind info for ${c.kind}`);
});

test('the 2D look is unchanged when look is not 3d', () => {
  const sb = structuredClone(story);
  delete sb.look;
  const v = validate(sb, { baseDir });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ov2d-'));
  const b = compile(v.storyboard, buildTimeline(v.storyboard), { baseDir, buildDir: dir });
  assert.equal(b.has3d, false);
  const html = fs.readFileSync(b.file, 'utf8');
  assert.ok(!html.includes('id="world3d"'));
  assert.match(html, /class="chwrap/);
});

test('every character kind can be put in a 3D scene', () => {
  const kinds = CHARACTER_KINDS;
  const scenes = [];
  for (let i = 0; i < kinds.length; i += 4) scenes.push({ template: 'story', background: 'meadow', characters: kinds.slice(i, i + 4).map(k => ({ who: k })), narration: 'Hello.' });
  const { spec } = build({ title: 'All kinds', type: 'story', look: '3d', voice: { provider: 'none' }, scenes });
  const seen = Object.values(spec.scenes).flatMap(s => s.characters.map(c => c.kind));
  assert.deepEqual([...new Set(seen)].sort(), [...kinds].sort());
});

test('director inputs: new places, line shots and cinematic mode reach the 3D scene spec', () => {
  const sb = structuredClone(story);
  sb.cinematic = true;
  const dlg = sb.scenes.findIndex(s => s.template === 'dialogue' && (s.lines || []).length > 1);
  sb.scenes[dlg].lines[1].shot = 'OTS';
  const v = validate(sb, { baseDir });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  assert.equal(v.storyboard.scenes[dlg].lines[1].shot, 'over-shoulder');
  const { spec, html } = build(sb);
  const ids = Object.keys(spec.scenes).map(Number).sort((a, b) => a - b);
  assert.equal(spec.scenes[ids[0]].newPlace, true, 'the first scene establishes its place');
  for (let k = 1; k < ids.length; k++) {
    const a = spec.scenes[ids[k - 1]], b = spec.scenes[ids[k]];
    assert.equal(b.newPlace, a.background !== b.background || a.time !== b.time);
  }
  assert.equal(spec.scenes[dlg].lines[1].shot, 'over-shoulder');
  assert.equal(spec.scenes[ids[0]].cinematic, true);
  assert.match(html, /class="[^"]*\bcine\b/);
});

test('weather and "near" props reach the 3D scene spec; scenery "built-in" uses no world pack', () => {
  const sb = structuredClone(story);
  const k = sb.scenes.findIndex(s => s.template === 'story' && (s.characters || []).length);
  sb.scenes[k].weather = 'snow';
  sb.scenes[k].characters[0].near = 'tent';
  sb.scenery = 'built-in';
  const { spec } = build(sb);
  assert.equal(spec.scenes[k].weather, 'snow');
  assert.equal(spec.scenes[k].characters[0].near, 'tent');
  assert.deepEqual(spec.props, {});
  const bad = structuredClone(story);
  // Unknown props are guessed (spaceship → ship) or dropped with a warning, never a failed storyboard.
  bad.scenes[k].characters[0].near = 'spaceship-factory';
  const g = validate(bad, { baseDir });
  assert.equal(g.ok, true);
  assert.equal(g.storyboard.scenes[k].characters[0].near, 'ship');
  bad.scenes[k].characters[0].near = 'grandma';
  const d = validate(bad, { baseDir });
  assert.equal(d.storyboard.scenes[k].characters[0].near, undefined);
  assert.ok(d.warnings.some(w => /not a prop; removed/.test(w.message)));
});
