// Props for stickman scenes: Lucide icons (ISC) drawn in the style's ink with a soft accent blob behind,
// placed beside the characters and entering on cue (drop, pop, slide, draw, wobble).
import fs from 'node:fs';

const DATA = JSON.parse(fs.readFileSync(new URL('./icons.json', import.meta.url), 'utf8'));
export const ICONS = Object.keys(DATA.icons);
export const ICON_ALIASES = DATA.aliases;
export const PROP_ENTERS = ['pop', 'drop', 'slide', 'draw', 'wobble', 'none'];
export const PROP_SIZES = { small: 0.13, medium: 0.19, large: 0.27 };

const norm = (s) => String(s || '').trim().toLowerCase().replace(/[\s_]+/g, '-');

/** Icon name for a word ("money", "Battery Low", "cage"), or null. */
export function resolveIcon(name) {
  const k = norm(name);
  if (DATA.icons[k]) return k;
  if (ICON_ALIASES[k]) return ICON_ALIASES[k];
  const sing = k.replace(/s$/, '');
  if (DATA.icons[sing]) return sing;
  if (ICON_ALIASES[sing]) return ICON_ALIASES[sing];
  // A word inside a longer name: "old-tv" → tv, "red-bell" → bell.
  for (const part of k.split('-').reverse()) { if (DATA.icons[part]) return part; if (ICON_ALIASES[part]) return ICON_ALIASES[part]; }
  return null;
}

/** Deterministic hand-drawn blob path around (50,50). */
function blob(seed) {
  let h = 7;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const pts = [];
  for (let k = 0; k < 8; k++) {
    h = (h * 1103515245 + 12345) >>> 0;
    const a = (k / 8) * Math.PI * 2, r = 40 + ((h >>> 16) % 9);
    pts.push([50 + Math.cos(a) * r, 50 + Math.sin(a) * r]);
  }
  return `M${pts.map(p => p.map(v => v.toFixed(1)).join(' ')).join(' L')} Z`;
}

/**
 * HTML for a scene's props.
 * @param props  [{ icon, position?, x?, y?: "ground"|"air"|0-100, size?, enter?, at?, color? }]
 * @param ctx    { ink, accent, accent2, ground (px), stageH, posX (name → %), sceneDur }
 */
export function propsHtml(props, ctx) {
  return (props || []).slice(0, 6).map((p, k) => {
    const icon = resolveIcon(p.icon);
    if (!icon) return '';
    const size = PROP_SIZES[p.size] || PROP_SIZES.medium;
    const x = typeof p.x === 'number' ? p.x : ctx.posX[p.position] ?? [70, 30, 50, 85, 15, 60][k];
    const yPct = p.y === 'air' ? 52 : typeof p.y === 'number' ? p.y : null;
    const bottom = yPct == null ? `${ctx.ground}px` : `${yPct}%`;
    const enter = PROP_ENTERS.includes(p.enter) ? p.enter : 'pop';
    const d = typeof p.at === 'number' ? p.at : 0.5 + k * 0.45;
    const fill = p.color || (k % 2 ? ctx.accent2 : ctx.accent);
    const body = DATA.icons[icon].replace(/<(path|circle|rect|line|polyline|polygon|ellipse) /g, '<$1 pathLength="1" ');
    return `<div class="st-prop pe-${enter}" style="left:${x}%;bottom:${bottom};height:calc(var(--sh)*${size});--d:${d.toFixed(2)}s">`
      + `<svg viewBox="-6 -6 36 36" aria-label="${icon}"><path d="${blob(icon + k)}" transform="scale(.36) translate(-16 -16)" fill="${fill}" opacity=".28"/>`
      + `<g fill="none" stroke="${ctx.ink}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg></div>`;
  }).join('');
}

/** One icon as inline SVG (Lucide, ISC), for the format templates. Null when the name is unknown. */
export function iconSvg(name, { stroke = 'currentColor', width = 1.9 } = {}) {
  const icon = resolveIcon(name);
  if (!icon) return null;
  return `<svg viewBox="0 0 24 24" aria-label="${icon}"><g fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round">${DATA.icons[icon]}</g></svg>`;
}

export const PROP_CSS = `
.st-prop{position:absolute;aspect-ratio:1;transform:translateX(-50%);z-index:3}
.st-prop svg{width:100%;height:100%;display:block;overflow:visible}
.st-prop.pe-pop{animation:st-pop .55s cubic-bezier(.3,1.6,.5,1) both;animation-delay:var(--d)}
.st-prop.pe-drop{animation:st-drop .7s cubic-bezier(.35,0,.3,1.25) both;animation-delay:var(--d)}
.st-prop.pe-slide{animation:st-slide .7s cubic-bezier(.2,.8,.3,1) both;animation-delay:var(--d)}
.st-prop.pe-wobble{animation:st-pop .5s ease both,st-wob 1.6s ease-in-out infinite alternate;animation-delay:var(--d),calc(var(--d) + .5s)}
.st-prop.pe-draw svg g *{stroke-dasharray:1;stroke-dashoffset:1;animation:st-draw .9s ease forwards;animation-delay:var(--d)}
.st-prop.pe-draw{animation:sc-fade .2s both;animation-delay:var(--d)}
@keyframes st-pop{from{opacity:0;transform:translateX(-50%) scale(.3)}to{opacity:1;transform:translateX(-50%) scale(1)}}
@keyframes st-drop{from{opacity:0;transform:translateX(-50%) translateY(calc(var(--sh)*-.6))}20%{opacity:1}to{transform:translateX(-50%)}}
@keyframes st-slide{from{opacity:0;transform:translateX(calc(-50% + var(--u)*30))}to{opacity:1;transform:translateX(-50%)}}
@keyframes st-wob{from{transform:translateX(-50%) rotate(-5deg)}to{transform:translateX(-50%) rotate(5deg)}}
@keyframes st-draw{to{stroke-dashoffset:0}}
`;
