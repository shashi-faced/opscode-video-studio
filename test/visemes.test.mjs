import { test } from 'node:test';
import assert from 'node:assert/strict';
import { englishShapes, hindiShapes, wordShapes, visemeTrack } from '../src/audio/visemes.mjs';
import { buildTimeline } from '../src/timeline.mjs';

test('English words map to mouth shapes', () => {
  assert.deepEqual(englishShapes('mummy'), ['A', 'F', 'A', 'C']);      // lips close on each m
  assert.deepEqual(englishShapes('fish'), ['G', 'C', 'B']);            // f: lower lip under teeth
  assert.equal(englishShapes('home').at(-1), 'A');                     // silent final e
  assert.deepEqual(englishShapes('hello!'), englishShapes('Hello'));
});

test('Hindi words: consonant classes, vowel signs, inherent a and schwa deletion', () => {
  assert.deepEqual(hindiShapes('मिको'), ['A', 'C', 'B', 'E']);          // म ि क ो
  assert.deepEqual(hindiShapes('घर'), ['B', 'D', 'B']);                // gha + inherent a, final r without a
  assert.deepEqual(hindiShapes('धन्यवाद'), ['B', 'D', 'B', 'C', 'D', 'G', 'D', 'B']);  // virama joins न्य
  assert.equal(wordShapes('तारा')[1], 'D');
  assert.deepEqual(wordShapes('kamal'), englishShapes('kamal'));        // Hinglish in Latin letters
});

test('a track covers the line, merges repeats and ends at rest', () => {
  const tr = visemeTrack([{ text: 'mama' }, { text: 'papa' }], [[1, 1.4], [1.7, 2.1]], 2.3);
  assert.equal(tr[0][0], 1);
  assert.equal(tr.at(-1)[1], 'X');
  for (let k = 1; k < tr.length; k++) { assert.ok(tr[k][0] >= tr[k - 1][0]); assert.notEqual(tr[k][1], tr[k - 1][1]); }
  assert.ok(tr.some(([t, x]) => x === 'X' && t > 1.39 && t < 1.7), 'mouth rests in the pause between words');
});

test('dialogue lines get a mouth-shape track in the timeline, with or without a voice', () => {
  const sb = { scenes: [{ template: 'dialogue', lines: [{ who: 'miko', text: 'Hello friend!' }] }], captions: true };
  const tl = buildTimeline(sb);
  const p = tl.scenes[0].parts.find(x => x.kind === 'line');
  assert.ok(p.visemes.length > 3);
  assert.ok(p.visemes[0][0] >= p.start && p.visemes.at(-1)[0] <= p.end + 0.001);
});
