// --progress-file: the latest progress is kept in one small JSON file for the host app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { progressWriter, progressRecord } from '../src/progressFile.mjs';
import { sceneAt } from '../src/render/render.mjs';

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-prog-'));
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

test('record: stage, done/total, percent, scene; film frames count as done/total', () => {
  const r = progressRecord({ stage: 'frames', done: 451, total: 759, scene: 3, scenes: 4 }, { tool: 'video_render' });
  assert.deepEqual({ ...r, at: 0 }, { v: 1, tool: 'video_render', at: 0, stage: 'frames', done: 451, total: 759, percent: 59, scene: 3, scenes: 4 });
  assert.equal(progressRecord({ stage: 'shots', frames: 50, totalFrames: 200 }, {}).percent, 25);
  assert.equal(progressRecord({ stage: 'encode' }, {}).percent, undefined);
  assert.equal(progressRecord({ stage: 'voice', warning: 'voice missing' }, {}).note, 'voice missing');
});

test('writer: stage changes are written at once, repeats are spaced out, the last frame is always written', () => {
  const d = tmp(), f = path.join(d, 'p.json');
  const w = progressWriter(f, 'video_render');
  w({ stage: 'prepare' });
  assert.equal(read(f).stage, 'prepare');
  w({ stage: 'frames', done: 1, total: 100 });
  assert.equal(read(f).done, 1);
  w({ stage: 'frames', done: 31, total: 100 });   // too soon after the last write
  assert.equal(read(f).done, 1);
  w({ stage: 'frames', done: 100, total: 100 });  // finished: always written
  assert.equal(read(f).percent, 100);
  assert.equal(read(f).tool, 'video_render');
  assert.equal(read(f).pid, process.pid);
  assert.deepEqual(fs.readdirSync(d), ['p.json'], 'no temp files left');
  fs.rmSync(d, { recursive: true, force: true });
});

test('writer: no file given, a bad event or an unwritable path never throws', () => {
  progressWriter('', 'x')({ stage: 'frames' });
  progressWriter(path.join(os.tmpdir(), 'no-such-dir-xyz', 'p.json'), 'x')({ stage: 'frames' });
  progressWriter(path.join(tmp(), 'p.json'), 'x')(null);
});

test('sceneAt: the scene on screen at a time, clamped to the last one', () => {
  const tl = { scenes: [{ end: 5 }, { end: 9 }, { end: 14 }] };
  assert.deepEqual([0, 4.99, 5, 13, 20].map((t) => sceneAt(tl, t)), [1, 1, 2, 3, 3]);
});

test('CLI: --progress-file is written by a tool call and does not change the result line', () => {
  const d = tmp(), f = path.join(d, 'p.json');
  const sb = path.join(d, 'sb.json');
  fs.writeFileSync(sb, JSON.stringify({ title: 'T', type: 'explainer', scenes: [{ template: 'title', headline: 'Hi' }, { template: 'cta', headline: 'Go' }] }));
  const cli = path.resolve('bin/opscode-video.mjs');
  const b64 = Buffer.from(JSON.stringify({ storyboard: sb })).toString('base64');
  const out = execFileSync(process.execPath, [cli, 'tool', 'video_validate', '--b64', b64, '--cwd', d, '--quiet', '--image-path', '--progress-file', f], { encoding: 'utf8' });
  const last = JSON.parse(out.trim().split('\n').pop());
  assert.equal(typeof last.ok, 'boolean');
  assert.equal(out.trim().split('\n').length, 1, 'quiet: only the result line');
  fs.rmSync(d, { recursive: true, force: true });
});
