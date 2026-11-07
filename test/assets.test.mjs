import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadSet, assetStatus } from '../src/assets/assets.mjs';
import { validate } from '../src/schema/validate.mjs';
import { buildTimeline } from '../src/timeline.mjs';
import { compile } from '../src/compiler/compile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('the 3D pack manifest pins every model to a CC0 file with a checksum', () => {
  const s = loadSet('3d-starter');
  assert.ok(s.models.length >= 5);
  for (const m of s.models) {
    assert.match(m.url, /^https:\/\/static\.poly\.pizza\/[0-9a-f-]{36}\.glb$/);
    assert.match(m.sha256, /^[0-9a-f]{64}$/);
    assert.equal(m.licence, 'CC0 1.0');
    assert.ok(m.size > 10000 && m.height > 0.3);
  }
  assert.ok(s.models.some(m => m.auto), 'some models are used by default');
  const st = assetStatus();
  assert.equal(st.total, s.models.length);
});

test('with no pack installed, 3D characters are built in code', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ovhome-'));
  const out = execFileSync(process.execPath, ['-e', `
    const { modelFor, assetStatus } = await import(${JSON.stringify(path.join(ROOT, 'src/assets/assets.mjs'))});
    console.log(JSON.stringify({ fox: modelFor('fox'), installed: assetStatus().installed }));`], { env: { ...process.env, OPSCODE_VIDEO_HOME: home }, encoding: 'utf8' });
  assert.deepEqual(JSON.parse(out.trim().split('\n').pop()), { fox: null, installed: 0 });
});

test('"models": "built-in" never uses pack models', () => {
  const sb = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'cinematic-3d.json'), 'utf8'));
  sb.models = 'built-in';
  const v = validate(sb, { baseDir: path.join(ROOT, 'examples') });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovb-'));
  const b = compile(v.storyboard, buildTimeline(v.storyboard), { baseDir: path.join(ROOT, 'examples'), buildDir: dir });
  const spec = JSON.parse(fs.readFileSync(b.file, 'utf8').match(/id="world3d">([\s\S]*?)<\/script>/)[1]);
  assert.deepEqual(spec.models, {});
  assert.ok(Object.values(spec.scenes).every(s => s.characters.every(c => !c.useModel)));
});

test('pack characters give the same frame whatever was drawn before (clip switch, head turns)', async (t) => {
  const { modelFor } = await import('../src/assets/assets.mjs');
  const { findChrome } = await import('../src/deps/locate.mjs');
  if (!modelFor('fox') || !findChrome()) return t.skip('fox model or Chrome not installed');
  const crypto = await import('node:crypto');
  const { openBuild, gpuWorks } = await import('../src/render/browser.mjs');
  const { compile } = await import('../src/compiler/compile.mjs');
  // The fox walks in (walk clip), then talks with head turns (idle clip, which does not move every bone).
  const v = validate({ look: '3d', models: 'pack', voice: { provider: 'none' }, captions: false, cast: [{ id: 'fox', kind: 'fox', model: 'pack' }, { id: 'owl', kind: 'owl' }],
    scenes: [{ template: 'dialogue', background: 'forest', characters: [{ who: 'fox', enter: 'walk-in' }, { who: 'owl' }], lines: [{ who: 'fox', text: 'Look at all the fireflies tonight!' }, { who: 'owl', text: 'They are beautiful.' }, { who: 'fox', text: 'Can we stay up late?' }] },
      { template: 'story', narration: 'b' }] }, { baseDir: ROOT });
  assert.equal(v.ok, true, JSON.stringify(v.errors));
  const tl = buildTimeline(v.storyboard);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovdet-'));
  const b = compile(v.storyboard, tl, { baseDir: ROOT, buildDir: dir, progress: false });
  const sess = await openBuild(b.file, b.stage, { gpu: await gpuWorks() });
  const h = async (s) => { await sess.seek(s * 1000); return crypto.createHash('sha1').update(await sess.frame('png')).digest('hex'); };
  try {
    await h(0);
    const s = tl.scenes[0], a = s.start + s.duration * 0.8, early = s.start + 0.4;
    const first = await h(a);
    // Another scene in between, then the same moment again: three.js sees an unchanged clip value and
    // skips writing bones, so anything left on them (head turns, other clips) must be reset by us.
    await h(tl.scenes[1].start + 0.5);
    assert.equal(await h(a), first);
    await h(early);   // walking: another clip
    assert.equal(await h(a), first);
  } finally { await sess.close(); fs.rmSync(dir, { recursive: true, force: true }); }
});
