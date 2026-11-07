// Storyboard + timeline -> self-contained build folder (index.html + assets).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { STAGE } from '../schema/spec.mjs';
import { PLATFORMS, safePixels } from '../schema/platforms.mjs';
import { resolveTheme, themeCss, fontFiles } from './themes.mjs';
import { TEMPLATE_HTML, TEMPLATE_CSS } from './templates.mjs';
import { imageSize } from '../util/imagesize.mjs';
import { stageLayout } from './backgrounds.mjs';
import { escapeHtml } from '../timeline.mjs';
import { KIND_INFO } from './characters.mjs';
import { modelFor, propFor, loadSet } from '../assets/assets.mjs';
const SCENERY = JSON.parse(fs.readFileSync(new URL('./scenery.json', import.meta.url), 'utf8'));

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORMAT_INDEX = { '16:9': 0, '9:16': 1, '1:1': 2, '4:5': 2 };

/** progress: false hides the scene progress bar (film shots are rendered one at a time). */
export function compile(storyboard, timeline, { baseDir, buildDir, progress = true }) {
  fs.mkdirSync(path.join(buildDir, 'assets'), { recursive: true });
  const stage = STAGE[storyboard.format];
  const theme = resolveTheme(storyboard.theme, storyboard.accent);

  // Copy each referenced file once; name by content hash so rebuilds are stable.
  const assetCache = new Map();
  const asset = (rel) => {
    const abs = path.resolve(baseDir, rel);
    if (assetCache.has(abs)) return assetCache.get(abs);
    let out;
    if (fs.existsSync(abs)) {
      const buf = fs.readFileSync(abs);
      const name = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 12) + path.extname(abs).toLowerCase();
      fs.writeFileSync(path.join(buildDir, 'assets', name), buf);
      const { width, height } = imageSize(abs);
      out = { src: `assets/${name}`, width, height, aspect: +(width / height).toFixed(4) };
    } else {
      out = { src: `missing:${rel}`, width: 16, height: 10, aspect: 1.6 };
    }
    assetCache.set(abs, out);
    return out;
  };

  const fonts = fontFiles().map(f => {
    fs.copyFileSync(f.src, path.join(buildDir, 'assets', f.name));
    return `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:normal;font-display:block;src:url(assets/${f.name}) format("woff2")${f.range ? `;unicode-range:${f.range}` : ''}}`;
  }).join('\n');

  const brandLogo = storyboard.brand?.logo;
  // Story characters: looked up by id or by display name.
  const cast = new Map();
  for (const c of storyboard.cast || []) {
    cast.set(String(c.id).toLowerCase(), { ...c, id: String(c.id).toLowerCase() });
    if (c.name) cast.set(String(c.name).toLowerCase(), { ...c, id: String(c.id).toLowerCase() });
  }
  const layout = stageLayout(stage.width, stage.height);
  // Platform: safe zone kept free of text, caption style, progress bar.
  const plat = PLATFORMS[storyboard.platform];
  const safe = safePixels(storyboard.platform, stage.width, stage.height);
  // Cinematic 16:9: 2.39:1 letterbox bars (138 px each); titles and story text stay clear of them.
  if (storyboard.cinematic && storyboard.format === '16:9') { safe.top = Math.max(safe.top, 150); safe.bottom = Math.max(safe.bottom, 150); }
  const cap = storyboard.captions || null;
  const cine = !!storyboard.cinematic && storyboard.format === '16:9';
  const stageCls = [stage.cls, cap ? `cap-${cap.style} cap-${cap.position}` : '', (plat && plat.progress === false) || !progress || cine ? 'no-prog' : '', cine ? 'cine' : ''].filter(Boolean).join(' ');
  const safeVars = `--st:${safe.top}px;--sb:${safe.bottom}px;--sl:${safe.left}px;--sr:${safe.right}px;--srf:${safe.rightFrom}px`;
  // 3D look (plan 12): story and dialogue scenes are drawn by the three.js world module.
  const world = {};
  const is3d = (sc) => (sc.template === 'story' || sc.template === 'dialogue') && (sc.look || storyboard.look) === '3d';
  const scenesHtml = storyboard.scenes.map((sc, i) => {
    const ctx = { index: i, fi: FORMAT_INDEX[storyboard.format], asset, brandLogo, format: storyboard.format, cast, layout, is3d, world };
    const inner = TEMPLATE_HTML[sc.template](sc, ctx);
    return `<section class="scene tr-${sc.transition || 'fade'}" data-i="${i}">${inner}</section>`;
  }).join('\n');

  const stars = theme.stars ? Array.from({ length: 46 }, (_, k) => {
    // Deterministic pseudo-random positions.
    const r = (n) => ((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
    return `<i class="star" style="left:${(r(1) * 100).toFixed(2)}%;top:${(r(2) * 100).toFixed(2)}%;animation-delay:-${(r(3) * 3).toFixed(2)}s"></i>`;
  }).join('') : '';

  const brand = storyboard.brand?.name || brandLogo
    ? `<div class="brand">${brandLogo ? `<img src="${asset(brandLogo).src}" alt="">` : ''}${escapeHtml(storyboard.brand?.name || '')}</div>` : '';
  const has3d = Object.keys(world).length > 0;
  let credits3d = null;
  let worldHead = '', worldBody = '';
  if (has3d) {
    // three.js (MIT) is copied into the build, so the page works offline from file://.
    const threeDir = path.join(buildDir, 'assets', 'three');
    fs.mkdirSync(path.join(threeDir, 'addons', 'effects'), { recursive: true });
    const THREE_SRC = path.resolve(path.dirname(createRequire(import.meta.url).resolve('three')), '..');
    for (const f of ['three.module.js', 'three.core.js']) fs.copyFileSync(path.join(THREE_SRC, 'build', f), path.join(threeDir, f));
    fs.copyFileSync(path.join(THREE_SRC, 'examples', 'jsm', 'effects', 'OutlineEffect.js'), path.join(threeDir, 'addons', 'effects', 'OutlineEffect.js'));
    // Downloaded character models (Phase 3): copied into the build for the kinds that use them.
    const models = {};
    if (storyboard.models !== 'built-in') {
      for (const w of Object.values(world)) for (const c of w.characters) {
        // auto: only the pack models marked "auto" (curated); pack: any installed model for the kind.
        const pref = c.modelPref !== 'auto' ? c.modelPref : storyboard.models === 'pack' ? 'pack' : 'auto';
        const m = pref === 'built-in' ? null : modelFor(c.kind);
        c.useModel = !!(m && (pref === 'pack' || m.auto));
        if (!c.useModel || models[c.kind] !== undefined) continue;
        models[c.kind] = { file: `assets/models/${m.file}`, height: m.height, colorSlot: m.colorSlot || null, turn: m.turn || 0 };
        if (m) { fs.mkdirSync(path.join(buildDir, 'assets', 'models'), { recursive: true }); fs.copyFileSync(m.path, path.join(buildDir, 'assets', 'models', m.file)); }
      }
    }
    for (const k of Object.keys(models)) if (!models[k]) delete models[k];
    // World pack props (Phase 4): the ones each location uses, plus any a character stands "near".
    const props = {};
    if (storyboard.scenery !== 'built-in') {
      const names = new Set();
      for (const w of Object.values(world)) {
        for (const n of SCENERY.locations[w.background] || []) names.add(n);
        for (const c of w.characters) if (c.near) names.add(c.near);
      }
      for (const n of names) {
        const m = propFor(n);
        if (!m) continue;
        fs.mkdirSync(path.join(buildDir, 'assets', 'props'), { recursive: true });
        fs.copyFileSync(m.path, path.join(buildDir, 'assets', 'props', m.file));
        props[n] = { file: `assets/props/${m.file}`, fit: m.fit };
      }
    }
    if (Object.keys(props).length) credits3d = [credits3d, loadSet('3d-world').credit].filter(Boolean).join('; ');
    if (Object.keys(models).length || Object.keys(props).length) {
      fs.mkdirSync(path.join(threeDir, 'addons', 'loaders'), { recursive: true });
      fs.mkdirSync(path.join(threeDir, 'addons', 'utils'), { recursive: true });
      fs.copyFileSync(path.join(THREE_SRC, 'examples', 'jsm', 'loaders', 'GLTFLoader.js'), path.join(threeDir, 'addons', 'loaders', 'GLTFLoader.js'));
      for (const u of ['BufferGeometryUtils.js', 'SkeletonUtils.js']) fs.copyFileSync(path.join(THREE_SRC, 'examples', 'jsm', 'utils', u), path.join(threeDir, 'addons', 'utils', u));
      if (Object.keys(models).length) credits3d = [loadSet().credit, credits3d].filter(Boolean).join('; ');
    }
    fs.copyFileSync(path.join(HERE, 'world3d.js'), path.join(buildDir, 'assets', 'world3d.js'));
    // A new place (or time of day) gets an establishing shot; cinematic adds letterbox + hand-held.
    let prevKey = null;
    for (const i of Object.keys(world).map(Number).sort((a, b) => a - b)) {
      const w = world[i];
      const key = `${w.background}|${w.time}`;
      w.newPlace = w.prevPlace != null ? w.prevPlace !== key : prevKey !== key;
      w.cinematic = !!storyboard.cinematic;
      prevKey = key;
    }
    const kinds = {};
    for (const w of Object.values(world)) for (const c of w.characters) kinds[c.kind] = KIND_INFO[c.kind] || KIND_INFO.rabbit;
    const spec = { width: stage.width, height: stage.height, format: storyboard.format, seed: storyboard.title || 'video', kinds, models, props, scenes: world };
    worldHead = `<script type="importmap">{"imports":{"three":"./assets/three/three.module.js","three/addons/":"./assets/three/addons/"}}</script>`;
    worldBody = `<canvas id="w3d" width="${stage.width}" height="${stage.height}"></canvas>
<script type="application/json" id="world3d">${JSON.stringify(spec).replace(/</g, '\\u003c')}</script>
<script>window.__worldReady = new Promise((res, rej) => { window.__worldResolve = res; window.__worldReject = rej; });</script>
<script type="module" src="./assets/world3d.js"></script>`;
  }
  const prog = `<div class="prog">${timeline.scenes.map(() => '<span><i></i></span>').join('')}</div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(storyboard.title)}</title>
${worldHead}<style>${fonts}
${themeCss(theme)}
html,body{margin:0;background:#000}
#stage{width:${stage.width}px;height:${stage.height}px;--ground:${layout.ground}px;--chh:${layout.chh}px;${safeVars}}
${TEMPLATE_CSS}</style></head>
<body><div id="stage" class="${stageCls}" data-platform="${storyboard.platform || ''}"><div class="amb">${stars}<div class="blob"></div><div class="blob b2"></div></div>${has3d ? worldBody : ''}
${brand}${prog}
${scenesHtml}
<div class="cap"><span></span></div></div>
<script type="application/json" id="timeline">${JSON.stringify(timeline).replace(/</g, '\\u003c')}</script>
<script>${fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf8')}</script></body></html>`;

  const file = path.join(buildDir, 'index.html');
  fs.writeFileSync(file, html);
  return { file, stage, theme, has3d, credits3d };
}
