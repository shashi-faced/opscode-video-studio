// Character sheet (plan 12, Phase 6): a designed 3D character seen from the front, at 45 degrees, from the
// side and from the back, plus close-ups of three moods, tiled into one image. Used to review a design
// (by the user or a vision model) before it goes into a film, and saved next to library entries.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { validateFile } from '../schema/validate.mjs';
import { buildTimeline } from '../timeline.mjs';
import { compile } from '../compiler/compile.mjs';
import { openBuild, gpuWorks, UserError } from '../render/browser.mjs';
import { findFfmpeg } from '../deps/locate.mjs';

const VIEWS = [
  { label: 'front', turn: 0, camera: 'full' },
  { label: '3/4', turn: 45, camera: 'full' },
  { label: 'side', turn: 90, camera: 'full' },
  { label: 'back', turn: 180, camera: 'full' },
  { label: 'happy', turn: 15, camera: 'close', mood: 'happy', pose: 'wave' },
  { label: 'sad', turn: 15, camera: 'close', mood: 'sad' },
  { label: 'surprised', turn: 15, camera: 'close', mood: 'surprised' },
  { label: 'walk', turn: 60, camera: 'full', pose: 'walk' },
];

export async function characterSheet(storyboardFile, id, { out } = {}) {
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new UserError('ffmpeg was not found.', 'run video_doctor with install=true');
  const v = validateFile(storyboardFile);
  if (!v.ok) { const e = new UserError(`The storyboard has ${v.errors.length} error(s).`, 'fix them first'); e.details = { errors: v.errors }; throw e; }
  const entry = (v.storyboard.cast || []).find(c => c.id === String(id).toLowerCase());
  if (!entry) throw new UserError(`No cast member "${id}".`, `use one of: ${(v.storyboard.cast || []).map(c => c.id).join(', ')}`);
  const sb = {
    ...v.storyboard, title: `sheet-${entry.id}`, look: '3d', captions: false, voice: { provider: 'none' }, cinematic: false, platform: undefined, format: '16:9',
    cast: [entry],
    scenes: VIEWS.map(vw => ({ template: 'story', background: 'meadow', time: 'day', camera: vw.camera, characters: [{ who: entry.id, pose: vw.pose || 'idle', mood: vw.mood || 'happy', turn: vw.turn }], duration: 3 })),
  };
  const timeline = buildTimeline(sb);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovsheet-'));
  try {
    const build = compile(sb, timeline, { baseDir: path.dirname(path.resolve(storyboardFile)), buildDir: dir, progress: false });
    const sess = await openBuild(build.file, build.stage, { gpu: await gpuWorks() });
    const frames = [];
    try {
      for (let k = 0; k < VIEWS.length; k++) {
        const s = timeline.scenes[k];
        await sess.seek((s.start + 1.2) * 1000);
        const f = path.join(dir, `v${k}.jpg`);
        fs.writeFileSync(f, await sess.frame('jpeg', 90));
        frames.push(f);
      }
    } finally { await sess.close(); }
    const file = path.resolve(out || path.join(path.dirname(path.resolve(storyboardFile)), 'out', `character-${entry.id}.png`));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const inputs = frames.flatMap(f => ['-i', f]);
    const labels = VIEWS.map((vw, k) => `[${k}]crop=1080:1080:420:0,scale=360:360[c${k}]`).join(';');
    execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', `${labels};${VIEWS.map((_, k) => `[c${k}]`).join('')}xstack=inputs=${VIEWS.length}:layout=0_0|360_0|720_0|1080_0|0_360|360_360|720_360|1080_360`, file]);
    return { ok: true, file, id: entry.id, name: entry.name || entry.id, views: VIEWS.map(v => v.label), design: entry.design || null, kind: entry.kind };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
