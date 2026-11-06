import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFilm, isFilm } from '../src/film/film.mjs';
import { validateFile } from '../src/schema/validate.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const baseDir = path.join(ROOT, 'examples');
const story = JSON.parse(fs.readFileSync(path.join(baseDir, 'kids-story.json'), 'utf8'));
const { scenes, ...top } = story;
const film = (sequences, extra = {}) => ({ ...top, title: 'Test film', ...extra, sequences });

test('a film of sequences is valid and lists every shot with its id', () => {
  const r = validateFilm(film([
    { id: 'intro', title: 'Intro', shots: scenes.slice(0, 3) },
    { id: 'end', title: 'End', shots: [{ id: 'finale', ...scenes[7] }] },
  ]), { baseDir });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.deepEqual(r.shots.map(s => s.id), ['intro-001', 'intro-002', 'intro-003', 'finale']);
  assert.deepEqual(r.sequences.map(s => [s.id, s.shots.length]), [['intro', 3], ['end', 1]]);
  assert.equal(r.storyboard.scenes.length, 4);
  assert.equal(r.storyboard.scenes[3].id, undefined, 'shot id is not passed on as a scene field');
});

test('a plain storyboard is read as a film with one sequence', () => {
  const r = validateFilm(story, { baseDir });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
  assert.equal(r.sequences.length, 1);
  assert.equal(r.shots.length, scenes.length);
  assert.equal(isFilm(story), false);
  assert.equal(isFilm(film([])), true);
});

test('errors point at the shot inside its sequence', () => {
  const bad = { ...scenes[1], characters: [{ who: 'nobody' }] };
  const r = validateFilm(film([{ id: 'a', shots: scenes.slice(0, 2) }, { id: 'b', shots: [scenes[2], bad] }]), { baseDir });
  assert.equal(r.ok, false);
  const e = r.errors.find(x => /unknown character/.test(x.message));
  assert.ok(e, JSON.stringify(r.errors));
  assert.equal(e.path, 'sequences[1].shots[1].characters[0].who');
  assert.equal(e.shot, 'b-002');
});

test('films may have far more shots and characters than a short video', () => {
  const shots = Array.from({ length: 90 }, (_, k) => ({ ...scenes[k % scenes.length] }));
  const cast = [...story.cast, ...Array.from({ length: 10 }, (_, k) => ({ id: `extra${k}`, kind: 'cat', name: `Extra ${k}` }))];
  const r = validateFilm(film([{ id: 'long', shots }], { cast }), { baseDir });
  assert.equal(r.ok, true, JSON.stringify(r.errors.slice(0, 3)));
  assert.equal(r.shots.length, 90);
});

test('a short storyboard is still limited to 16 scenes', () => {
  const file = path.join(ROOT, 'test', 'fixtures', '_too-many.json');
  fs.writeFileSync(file, JSON.stringify({ ...top, scenes: Array.from({ length: 20 }, (_, k) => ({ ...scenes[k % scenes.length] })) }));
  try { assert.equal(validateFile(file).ok, false); } finally { fs.rmSync(file); }
});

test('duplicate ids and empty sequences are errors', () => {
  const r = validateFilm(film([
    { id: 'a', shots: [{ id: 'x', ...scenes[0] }, { id: 'x', ...scenes[1] }] },
    { id: 'a', shots: [] },
  ]), { baseDir });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => /shot id "x" is used twice/.test(e.message)));
  assert.ok(r.errors.some(e => /sequence id "a" is used twice/.test(e.message)));
  assert.ok(r.errors.some(e => /needs at least one shot/.test(e.message)));
});

test('"cut" is an allowed scene transition', () => {
  const r = validateFilm(film([{ id: 'a', shots: [{ ...scenes[0], transition: 'cut' }, scenes[1]] }]), { baseDir });
  assert.equal(r.ok, true, JSON.stringify(r.errors));
});
