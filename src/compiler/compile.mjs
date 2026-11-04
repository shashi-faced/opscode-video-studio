// Storyboard + timeline -> self-contained build folder (index.html + assets).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { STAGE } from '../schema/spec.mjs';
import { PLATFORMS, safePixels } from '../schema/platforms.mjs';
import { resolveTheme, themeCss, fontFiles } from './themes.mjs';
import { TEMPLATE_HTML, TEMPLATE_CSS } from './templates.mjs';
import { imageSize } from '../util/imagesize.mjs';
import { stageLayout } from './backgrounds.mjs';
import { escapeHtml } from '../timeline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FORMAT_INDEX = { '16:9': 0, '9:16': 1, '1:1': 2, '4:5': 2 };

export function compile(storyboard, timeline, { baseDir, buildDir }) {
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
  const cap = storyboard.captions || null;
  const stageCls = [stage.cls, cap ? `cap-${cap.style} cap-${cap.position}` : '', plat && plat.progress === false ? 'no-prog' : ''].filter(Boolean).join(' ');
  const safeVars = `--st:${safe.top}px;--sb:${safe.bottom}px;--sl:${safe.left}px;--sr:${safe.right}px;--srf:${safe.rightFrom}px`;
  const scenesHtml = storyboard.scenes.map((sc, i) => {
    const ctx = { index: i, fi: FORMAT_INDEX[storyboard.format], asset, brandLogo, format: storyboard.format, cast, layout };
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
  const prog = `<div class="prog">${timeline.scenes.map(() => '<span><i></i></span>').join('')}</div>`;

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(storyboard.title)}</title>
<style>${fonts}
${themeCss(theme)}
html,body{margin:0;background:#000}
#stage{width:${stage.width}px;height:${stage.height}px;--ground:${layout.ground}px;--chh:${layout.chh}px;${safeVars}}
${TEMPLATE_CSS}</style></head>
<body><div id="stage" class="${stageCls}" data-platform="${storyboard.platform || ''}"><div class="amb">${stars}<div class="blob"></div><div class="blob b2"></div></div>
${brand}${prog}
${scenesHtml}
<div class="cap"><span></span></div></div>
<script type="application/json" id="timeline">${JSON.stringify(timeline).replace(/</g, '\\u003c')}</script>
<script>${fs.readFileSync(path.join(HERE, 'runtime.js'), 'utf8')}</script></body></html>`;

  const file = path.join(buildDir, 'index.html');
  fs.writeFileSync(file, html);
  return { file, stage, theme };
}
