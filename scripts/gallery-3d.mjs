#!/usr/bin/env node
// Gallery pictures for the Opscode app (plan 12, Phase 8): every built-in 3D character kind, every preset
// design and every place, as small JPEGs. Built-in models only, so the pictures match a fresh install.
//   node scripts/gallery-3d.mjs <out-dir>    → <out-dir>/characters/<id>.jpg, <out-dir>/places/<id>.jpg, index.json
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validate } from '../src/schema/validate.mjs';
import { buildTimeline } from '../src/timeline.mjs';
import { compile } from '../src/compiler/compile.mjs';
import { openBuild, gpuWorks } from '../src/render/browser.mjs';
import { findFfmpeg } from '../src/deps/locate.mjs';
import { CHARACTER_KINDS, BACKGROUNDS } from '../src/schema/spec.mjs';
import { PRESETS } from '../src/characters/presets.mjs';

const OUT = path.resolve(process.argv[2] || 'gallery-3d');
const ffmpeg = findFfmpeg();
const gpu = await gpuWorks();

async function stills(sb, items, crop, scale, dir) {
  const v = validate(sb, { baseDir: OUT, limits: { scenes: 200, cast: 200 } });
  if (!v.ok) throw new Error(JSON.stringify(v.errors.slice(0, 3)));
  const timeline = buildTimeline(v.storyboard);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ovgal-'));
  fs.mkdirSync(dir, { recursive: true });
  try {
    const build = compile(v.storyboard, timeline, { baseDir: OUT, buildDir: tmp, progress: false });
    const sess = await openBuild(build.file, build.stage, { gpu });
    try {
      for (let k = 0; k < items.length; k++) {
        await sess.seek((timeline.scenes[k].start + 1.4) * 1000);
        const raw = path.join(tmp, `f${k}.jpg`);
        fs.writeFileSync(raw, await sess.frame('jpeg', 92));
        execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-i', raw, '-vf', `crop=${crop},scale=${scale}`, '-q:v', '4', path.join(dir, `${items[k]}.jpg`)]);
        process.stderr.write(`\r${path.basename(dir)} ${k + 1}/${items.length}  `);
      }
    } finally { await sess.close(); }
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  process.stderr.write('\n');
}

const base = { version: 1, type: 'story', look: '3d', models: 'built-in', scenery: 'built-in', captions: false, voice: { provider: 'none' }, format: '16:9', title: 'gallery' };
const charIds = [...CHARACTER_KINDS, ...Object.keys(PRESETS)];
const cast = [...CHARACTER_KINDS.map(k => ({ id: k, kind: k })), ...Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name, kind: p.kind, design: structuredClone(p.design) }))];
await stills({ ...base, cast, scenes: charIds.map(id => ({ template: 'story', background: 'meadow', time: 'day', camera: 'full', characters: [{ who: id, pose: 'idle', mood: 'happy', turn: 20 }], duration: 2 })) },
  charIds, '1080:1080:420:0', '192:192', path.join(OUT, 'characters'));
await stills({ ...base, cast: [], scenes: BACKGROUNDS.map(bg => ({ template: 'story', background: bg, time: 'day', camera: bg === 'space' ? 'wide' : 'extreme-wide', duration: 2 })) },
  BACKGROUNDS, '1920:1080:0:0', '320:180', path.join(OUT, 'places'));
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify({
  characters: [...CHARACTER_KINDS.map(k => ({ id: k, kind: k })), ...Object.entries(PRESETS).map(([id, p]) => ({ id, name: p.name, icon: p.icon, preset: true }))],
  places: BACKGROUNDS,
}, null, 2));
console.log(JSON.stringify({ ok: true, out: OUT, characters: charIds.length, places: BACKGROUNDS.length }));
