// Renders the Video Studio style gallery tiles (plan 15, plan 18): one short sample scene per style,
// saved as a 4 s looping WebM (480×270, no sound) and a JPG poster. Made by our own engine, so a tile
// shows exactly what that style produces.
//
//   node scripts/style-previews.mjs <out dir> [style …]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { findFfmpeg } from '../src/deps/locate.mjs';
import { render } from '../src/render/render.mjs';
import { STYLES } from '../src/art/styles.mjs';

const SAMPLES = {
  'line-art': { headline: 'One *idea*. A real video.', who: 'man', pose: 'think', mood: 'suspicious', props: [{ icon: 'lightbulb', position: 'right', y: 'air', enter: 'drop', at: 0.9 }] },
  'classic-bw': { headline: 'You vs *you*', who: 'man', pose: 'point', mood: 'angry', props: [{ icon: 'target', position: 'right', enter: 'pop', at: 0.9 }] },
  'modern-pop': { headline: 'AI tools that *save hours*', who: 'man', pose: 'point', mood: 'grin', props: [{ icon: 'laptop', position: 'right', enter: 'slide', at: 0.7 }, { icon: 'rocket', position: 'far-right', y: 'air', enter: 'pop', at: 1.5 }] },
  'retro-tv': { headline: 'Why did the TV *turn on*?', who: 'man', pose: 'think', mood: 'worried', props: [{ icon: 'tv', position: 'right', y: 'air', enter: 'wobble', at: 0.8 }] },
  'cozy-color': { headline: 'Why can\'t you *sleep*?', who: 'woman', pose: 'idle', mood: 'sleepy', background: 'bedroom', time: 'night', props: [{ icon: 'alarm', position: 'right', enter: 'wobble', at: 0.9 }] },
  'cozy-story': { headline: 'The message you *fear*', who: 'woman', pose: 'think', mood: 'sweating', background: 'city', props: [{ icon: 'chat', position: 'right', y: 'air', enter: 'pop', at: 0.9 }] },
  prehistoric: { headline: 'The first *fire*', who: 'man', pose: 'cheer', mood: 'grin', background: 'mountains', props: [{ icon: 'fire', position: 'right', enter: 'pop', at: 0.9 }] },
  historical: { headline: 'A day in *1600*', who: 'man', pose: 'wave', mood: 'happy', background: 'village', props: [{ icon: 'crown', position: 'right', y: 'air', enter: 'drop', at: 0.9 }] },
  'amber-noir': { headline: 'What if money was *free*?', who: 'man', pose: 'walk', mood: 'suspicious', props: [{ icon: 'coins', position: 'right', y: 'air', enter: 'wobble', at: 0.9 }] },
  'noir-thriller': { headline: 'Never open *the door*', who: 'man', pose: 'idle', mood: 'shocked', props: [{ icon: 'siren', position: 'right', y: 'air', enter: 'pop', at: 0.9 }] },
};

// Plan 18: styles that are not plain stickman story scenes get their own sample storyboard.
const story2d = (headline, extra = {}) => ({
  cast: [{ id: 'mia', kind: 'girl', name: 'Mia' }, { id: 'kai', kind: 'boy', name: 'Kai' }],
  scenes: [{ template: 'story', duration: 4.6, headline, background: extra.background || 'meadow', time: extra.time, sfx: extra.sfx,
    characters: [{ who: 'mia', position: 'left', pose: 'wave', mood: 'happy', enter: 'pop' }, { who: 'kai', position: 'right', pose: 'cheer', mood: 'grin', enter: 'pop' }] }],
});
const BUILD = {
  whiteboard: () => ({ look: 'stickman', cast: [{ id: 'hero', kind: 'man', name: 'Hero' }], scenes: [{ template: 'story', duration: 4.6, headline: 'How *ideas* grow', characters: [{ who: 'hero', pose: 'point', mood: 'happy', position: 'left' }], props: [{ icon: 'lightbulb', position: 'right', y: 'air', enter: 'draw', at: 0.6 }] }] }),
  chalkboard: () => ({ look: 'stickman', cast: [{ id: 'hero', kind: 'woman', name: 'Hero' }], scenes: [{ template: 'story', duration: 4.6, headline: 'Why is the sky *blue*?', characters: [{ who: 'hero', pose: 'think', mood: 'happy', position: 'left' }], props: [{ icon: 'sun', position: 'right', y: 'air', enter: 'draw', at: 0.6 }] }] }),
  kinetic: () => ({ scenes: [{ template: 'title', duration: 4.6, headline: 'Small habits. *Big* results.', subline: 'Start today' }] }),
  'flat-vector': () => story2d('Save money *every month*', { background: 'city' }),
  documentary: () => ({ scenes: [{ template: 'map', duration: 4.6, kicker: 'The spice route', headline: 'From *Kochi* to *Venice*', route: ['Kochi', 'Muscat', 'Cairo', 'Venice'], highlight: ['India'] }] }),
  neon: () => ({ look: 'stickman', cast: [{ id: 'hero', kind: 'man', name: 'Hero' }], scenes: [{ template: 'story', duration: 4.6, headline: 'The year *2099*', characters: [{ who: 'hero', pose: 'cheer', mood: 'grin', position: 'left' }] }] }),
  horror: () => ({ look: 'stickman', cast: [{ id: 'hero', kind: 'man', name: 'Hero' }], scenes: [{ template: 'story', duration: 4.6, headline: 'Never look *behind you*', characters: [{ who: 'hero', pose: 'idle', mood: 'shocked', position: 'left' }] }] }),
  'retro-pixel': () => story2d('Level *up* your life'),
  'paper-cutout': () => ({ scenes: [{ template: 'title', duration: 4.6, kicker: 'Story time', headline: 'The *paper* kingdom', subline: 'Once upon a time' }] }),
  watercolor: () => story2d('The *kind* little star', { background: 'forest' }),
  comic: () => story2d('Meanwhile, *at school*…', { sfx: 'POW!' }),
  isometric: () => ({ scenes: [{ template: 'title', duration: 4.6, kicker: 'How it works', headline: 'Your data, *step by step*' }] }),
  clay: () => ({ look: '3d', cast: [{ id: 'mia', kind: 'girl', name: 'Mia' }, { id: 'rex', kind: 'dog', name: 'Rex' }], scenes: [{ template: 'story', duration: 4.6, background: 'meadow', camera: 'two-shot', characters: [{ who: 'mia', position: 'left', pose: 'wave' }, { who: 'rex', position: 'right' }] }] }),
  'low-poly': () => ({ look: '3d', cast: [{ id: 'kai', kind: 'boy', name: 'Kai' }, { id: 'fox', kind: 'fox', name: 'Fox' }], scenes: [{ template: 'story', duration: 4.6, background: 'forest', camera: 'two-shot', characters: [{ who: 'kai', position: 'left', pose: 'wave' }, { who: 'fox', position: 'right' }] }] }),
};
for (const id of Object.keys(BUILD)) SAMPLES[id] = { build: BUILD[id] };

const [outDir, ...only] = process.argv.slice(2);
if (!outDir) { console.error('usage: node scripts/style-previews.mjs <out dir> [style …]'); process.exit(2); }
fs.mkdirSync(outDir, { recursive: true });
const ff = findFfmpeg();
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-tiles-'));
const ids = only.length ? only : Object.keys(SAMPLES);

for (const id of ids) {
  const s = SAMPLES[id];
  if (!s || !STYLES[id]) { console.log(`skip ${id}`); continue; }
  const custom = s.build?.();
  const sb = custom ? { title: `tile ${id}`, type: 'explainer', format: '16:9', ...custom, art: { style: id }, captions: false, music: { volume: 0 }, scenes: [...custom.scenes, { template: 'title', duration: 1, headline: 'end' }] } : {
    title: `tile ${id}`, type: 'explainer', format: '16:9', look: 'stickman', art: { style: id }, captions: false, music: { volume: 0 },
    cast: [{ id: 'hero', kind: s.who, name: 'Hero' }],
    scenes: [
      { template: 'story', duration: 4.6, headline: s.headline, background: s.background, time: s.time, characters: [{ who: 'hero', pose: s.pose, mood: s.mood, position: 'left', enter: s.pose === 'walk' ? 'walk-in' : 'pop' }], props: s.props },
      { template: 'story', duration: 1, headline: 'end' },
    ],
  };
  const f = path.join(work, `${id}.json`);
  fs.writeFileSync(f, JSON.stringify(sb));
  const t0 = Date.now();
  const r = await render(f, { voice: 'skip', fps: 30 });
  const webm = path.join(outDir, `${id}.webm`), jpg = path.join(outDir, `${id}.jpg`);
  // Seconds 0.4–4.4 (entrances included), 480×270, VP9, no sound; poster at 3 s.
  execFileSync(ff, ['-y', '-v', 'error', '-ss', '0.4', '-t', '4', '-i', r.file, '-an', '-vf', 'scale=480:270:flags=lanczos,fps=24', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '40', '-row-mt', '1', '-deadline', 'good', '-cpu-used', '4', webm]);
  execFileSync(ff, ['-y', '-v', 'error', '-ss', '3', '-i', r.file, '-frames:v', '1', '-vf', 'scale=480:270:flags=lanczos', '-q:v', '4', jpg]);
  console.log(`${id}: ${Math.round(fs.statSync(webm).size / 1024)} KB webm, ${Math.round(fs.statSync(jpg).size / 1024)} KB jpg, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
fs.rmSync(work, { recursive: true, force: true });
