// A transparent page that draws one caption state with the studio's own caption CSS
// (same fonts, styles, safe zones and sizes as rendered videos). Used to burn captions into any video.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { TEMPLATE_CSS } from '../compiler/templates.mjs';
import { fontFiles, themeCss, resolveTheme } from '../compiler/themes.mjs';
import { safePixels } from '../schema/platforms.mjs';

/** Frame-size class for any width × height (the caption size and position rules hang off it). */
export const shapeClass = (w, h) => (w > h * 1.2 ? 'f-16x9' : h > w * 1.17 ? 'f-9x16' : 'f-1x1');

/**
 * @param o.width, o.height  video size in pixels
 * @param o.style            line | karaoke | pop
 * @param o.position         bottom | middle | top
 * @param o.platform         optional platform id (keeps captions clear of the app's buttons)
 * @param o.theme            theme preset name (caption accent colour); default night-saffron
 * @param o.highlight        colour of the spoken word (karaoke, pop)
 * @returns path of the written HTML file
 */
export function writeCaptionPage(dir, { width, height, style = 'pop', position = 'bottom', platform, theme, highlight }) {
  fs.mkdirSync(dir, { recursive: true });
  const t = resolveTheme(theme, highlight);
  const fonts = fontFiles().map(f => `@font-face{font-family:"${f.family}";font-weight:${f.weight};font-style:normal;font-display:block;src:url(${pathToFileURL(f.src).href}) format("woff2")${f.range ? `;unicode-range:${f.range}` : ''}}`).join('\n');
  const safe = safePixels(platform, width, height);
  const u = Math.min(width, height) / 100;
  const hl = highlight ? `.cap-pop .cap .w.on,.cap-pop .cap mark{color:${highlight}}` : '';
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>${fonts}
${themeCss(t)}
${TEMPLATE_CSS}
html,body{margin:0;background:transparent}
#stage{width:${width}px;height:${height}px;--u:${u.toFixed(3)}px;--st:${safe.top}px;--sb:${safe.bottom}px;--sl:${safe.left}px;--sr:${safe.right}px;--srf:${safe.rightFrom}px;background:none !important}
${hl}</style></head>
<body><div id="stage" class="${shapeClass(width, height)} cap-${style} cap-${position}"><div class="cap"><span></span></div></div>
<script>
const span = document.querySelector('.cap span');
window.setCaption = (html, on, scale) => {
  if (span.innerHTML !== html) span.innerHTML = html;
  span.querySelectorAll('.w').forEach((w, k) => { w.classList.toggle('on', k === on); w.classList.toggle('past', k < on); });
  span.style.transform = scale === 1 ? '' : 'scale(' + scale + ')';
};
window.ready = document.fonts.ready.then(() => true);
</script></body></html>`;
  const file = path.join(dir, 'captions.html');
  fs.writeFileSync(file, html);
  return file;
}

/**
 * Caption chunks → the list of distinct things to draw, each with its time window.
 * A state is { html, on (lit word, -1 none), scale }; empty html = nothing on screen.
 * Pop adds three growing steps (0.14 s) at the start of each chunk, like the renderer.
 */
export function captionStates(captions, duration, style = 'pop') {
  const out = [];
  const push = (t0, t1, html, on, scale) => {
    if (!(t1 > t0 + 1e-6)) return;
    const last = out.at(-1);
    if (last && last.html === html && last.on === on && last.scale === scale && Math.abs(last.t1 - t0) < 1e-6) { last.t1 = t1; return; }
    out.push({ t0, t1, html, on, scale });
  };
  let t = 0;
  const caps = [...captions].filter(c => c.html && c.end > c.start).sort((a, b) => a.start - b.start);
  caps.forEach((c, i) => {
    const s = Math.max(t, c.start), e = Math.min(duration, i + 1 < caps.length ? Math.min(c.end, caps[i + 1].start) : c.end);
    push(t, s, '', -1, 1);
    if (!(e > s)) { t = Math.max(t, s); return; }
    // Moments where something changes: each word lighting up, and the pop growth steps.
    const cuts = new Set([s, e]);
    (c.words || []).forEach(([a]) => { if (a > s && a < e) cuts.add(a); });
    const grow = style === 'pop' && c.words ? [0.047, 0.093, 0.14] : [];
    grow.forEach(g => { if (s + g < e) cuts.add(s + g); });
    const ts = [...cuts].sort((a, b) => a - b);
    for (let k = 0; k + 1 < ts.length; k++) {
      const a = ts[k];
      let on = -1;
      (c.words || []).forEach(([w0], q) => { if (a + 1e-6 >= w0) on = q; });
      let scale = 1;
      if (grow.length) {
        const p = Math.max(0, Math.min(1, (a - c.start) / 0.14));
        scale = +(0.82 + 0.18 * (1 - Math.pow(1 - p, 3))).toFixed(3);
      }
      push(a, ts[k + 1], c.html, c.words ? on : -1, scale);
    }
    t = e;
  });
  push(t, duration, '', -1, 1);
  return out;
}
