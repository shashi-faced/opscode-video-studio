import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validate } from '../src/schema/validate.mjs';
import { buildTimeline } from '../src/timeline.mjs';
import { compile } from '../src/compiler/compile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = (cast) => ({ look: '3d', voice: { provider: 'none' }, cast, scenes: [{ template: 'story', characters: cast.map(c => ({ who: c.id })).slice(0, 4), narration: 'Hi.' }, { template: 'story', characters: [{ who: cast[0].id }], narration: 'Bye.' }] });

test('designs accept loose wording and infer a kind for the voice', () => {
  const r = validate(base([{ id: 'raja', design: { plan: 'Bird', extras: 'tail-fan, Crest', accessories: ['crown'], snout: 'beak' } }, { id: 'croc', design: { plan: 'quadruped', snout: 'long snout', extras: ['long tail'] } }]), { baseDir: ROOT });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  const [a, b] = r.storyboard.cast;
  assert.equal(a.design.plan, 'bird');
  assert.deepEqual(a.design.extras, ['tail-fan', 'crest']);
  assert.equal(a.kind, 'owl');
  assert.equal(b.kind, 'dog');
  assert.equal(b.design.snout, 'long');
});

test('unknown design parts are errors with the allowed list', () => {
  const r = validate(base([{ id: 'x', design: { plan: 'spaceship' } }]), { baseDir: ROOT });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /design\.plan/.test(e.path)));
});

test('a designed character reaches the 3D spec and never uses pack models', () => {
  const v = validate(base([{ id: 'zog', name: 'Zog', kind: 'robot', design: { plan: 'biped', eyes: 'cyclops', horns: 'antenna' } }]), { baseDir: ROOT });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovd-'));
  const b = compile(v.storyboard, buildTimeline(v.storyboard), { baseDir: ROOT, buildDir: dir });
  const spec = JSON.parse(fs.readFileSync(b.file, 'utf8').match(/id="world3d">([\s\S]*?)<\/script>/)[1]);
  const c = spec.scenes[0].characters[0];
  assert.equal(c.design.eyes, 'cyclops');
  assert.equal(c.useModel, false);
});

test('the character library saves a design and a storyboard can use it by name', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ovlib-'));
  const out = execFileSync(process.execPath, ['-e', `
    const { saveLibraryCharacter } = await import(${JSON.stringify(path.join(ROOT, 'src/characters/library.mjs'))});
    const { validate } = await import(${JSON.stringify(path.join(ROOT, 'src/schema/validate.mjs'))});
    saveLibraryCharacter({ id: 'Raja King', name: 'Raja', kind: 'owl', design: { plan: 'bird', extras: ['tail-fan'] } });
    const r = validate({ look: '3d', voice: { provider: 'none' }, cast: [{ id: 'raja', design: 'library:raja-king' }], scenes: [{ template: 'story', characters: [{ who: 'raja' }], narration: 'a' }, { template: 'story', narration: 'b' }] }, { baseDir: '.' });
    console.log(JSON.stringify({ ok: r.ok, design: r.storyboard.cast[0].design, kind: r.storyboard.cast[0].kind }));`], { env: { ...process.env, OPSCODE_VIDEO_HOME: home }, encoding: 'utf8' });
  const r = JSON.parse(out.trim().split('\n').pop());
  assert.equal(r.ok, true);
  assert.deepEqual(r.design, { plan: 'bird', extras: ['tail-fan'] });
  assert.equal(r.kind, 'owl');
});
