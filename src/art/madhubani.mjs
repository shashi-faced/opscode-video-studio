// Style "madhubani" (plan 19 P3): Mithila folk painting for the old Indian stories, and for any
// 2D video. Paper ground, flat Mithila colours, double black outlines, pattern fills, a painted
// border around every scene (its motif chosen per video), mythology figures in their Madhubani
// skin (myth.mjs) and the places drawn in the same hand (mythPlaces.mjs).
import { seeded } from './seed.mjs';

export const MADHUBANI_STYLE = {
  label: 'Madhubani (Mithila painting)', base: '2d', kind: 'paper', myth: 'madhubani', flatInk: true,
  theme: { dark: false, bg: '#f3e4c2', bg2: '#ecd7ab', bg3: '#e2c58f', ink: '#1c140f', muted: '#5a4532', accent: '#cf3a2b', accent2: '#2e4796', ok: '#3d8b3f', alert: '#cf3a2b', onAccent: '#fff8e8', display: 'Rozha One' },
  font: { display: '"Rozha One","Hind"', body: '"Hind"' },
  stage: '#f3e4c2', caption: 'paper', underline: false, defaultPlace: 'meadow',
  // Per video: the accent pair and the border motif.
  accents: [['#cf3a2b', '#2e4796'], ['#e2552f', '#3d8b3f'], ['#cf3a2b', '#f2b632'], ['#2e4796', '#e2678f'], ['#8c2a2a', '#f2b632']],
  backdrops: ['triangles', 'scales', 'vine', 'waves', 'lotus'],
};
export const MADHUBANI_ALIASES = {
  madhubani: 'madhubani', mithila: 'madhubani', 'mithila painting': 'madhubani', 'madhubani painting': 'madhubani', 'madhubani art': 'madhubani', 'madhubani style': 'madhubani',
  'indian folk': 'madhubani', 'indian folk art': 'madhubani', 'folk art': 'madhubani', 'folk painting': 'madhubani', 'bihar painting': 'madhubani', 'मधुबनी': 'madhubani', 'मिथिला': 'madhubani',
};

const BAND = { triangles: '#f2b632', scales: '#e2552f', vine: '#f4e6c6', waves: '#2e4796', lotus: '#cf3a2b' };

/** The border motif, as an SVG pattern tile of size b (the band's width). */
function motif(kind, b, ink, t) {
  const s = (w) => `stroke="${ink}" stroke-width="${(b * w).toFixed(1)}" fill="none" stroke-linecap="round"`;
  switch (kind) {
    case 'triangles': return { w: b, h: b, d: `<path d="M0 ${b} L${b / 2} ${b * 0.2} L${b} ${b} Z" fill="${t.accent}" stroke="${ink}" stroke-width="${(b * 0.05).toFixed(1)}"/><circle cx="${b / 2}" cy="${b * 0.72}" r="${b * 0.08}" fill="${ink}"/>` };
    case 'scales': return { w: b * 0.8, h: b * 0.5, d: `<path d="M0 ${b * 0.5} A${b * 0.4} ${b * 0.4} 0 0 1 ${b * 0.8} ${b * 0.5}" ${s(0.05)}/><path d="M${-b * 0.4} ${b * 0.25} A${b * 0.4} ${b * 0.4} 0 0 1 ${b * 0.4} ${b * 0.25} M${b * 0.4} ${b * 0.25} A${b * 0.4} ${b * 0.4} 0 0 1 ${b * 1.2} ${b * 0.25}" ${s(0.05)}/>` };
    case 'vine': return { w: b * 1.6, h: b, d: `<path d="M0 ${b / 2} Q${b * 0.4} ${b * 0.1} ${b * 0.8} ${b / 2} T${b * 1.6} ${b / 2}" ${s(0.06)}/><path d="M${b * 0.4} ${b * 0.3} q${b * 0.12} ${-b * 0.28} ${b * 0.3} ${-b * 0.16} q${-b * 0.06} ${b * 0.2} ${-b * 0.3} ${b * 0.16} Z M${b * 1.2} ${b * 0.7} q${b * 0.12} ${b * 0.28} ${b * 0.3} ${b * 0.16} q${-b * 0.06} ${-b * 0.2} ${-b * 0.3} ${-b * 0.16} Z" fill="${t.ok}" stroke="${ink}" stroke-width="${(b * 0.04).toFixed(1)}"/><circle cx="${b * 0.8}" cy="${b / 2}" r="${b * 0.1}" fill="${t.accent}"/>` };
    case 'waves': return { w: b, h: b, d: `<path d="M0 ${b * 0.35} q${b / 4} ${-b * 0.2} ${b / 2} 0 t${b / 2} 0 M0 ${b * 0.7} q${b / 4} ${-b * 0.2} ${b / 2} 0 t${b / 2} 0" stroke="#f4e6c6" stroke-width="${(b * 0.07).toFixed(1)}" fill="none"/>` };
    default: return { w: b * 1.2, h: b, d: `<g transform="translate(${b * 0.6} ${b * 0.82})"><path d="M0 0 C${-b * 0.3} ${-b * 0.1} ${-b * 0.36} ${-b * 0.46} ${-b * 0.18} ${-b * 0.6} C${-b * 0.1} ${-b * 0.36} 0 ${-b * 0.2} 0 0 Z M0 0 C${b * 0.3} ${-b * 0.1} ${b * 0.36} ${-b * 0.46} ${b * 0.18} ${-b * 0.6} C${b * 0.1} ${-b * 0.36} 0 ${-b * 0.2} 0 0 Z M0 0 C${-b * 0.12} ${-b * 0.3} ${-b * 0.08} ${-b * 0.6} 0 ${-b * 0.7} C${b * 0.08} ${-b * 0.6} ${b * 0.12} ${-b * 0.3} 0 0 Z" fill="#f2b632" stroke="${ink}" stroke-width="${(b * 0.04).toFixed(1)}"/></g>` };
  }
}

/** The painted border for one scene (an SVG the size of the stage). */
export function madhuDecor(v, index, theme, stage, sc = {}) {
  const W = stage.width, H = stage.height, ink = theme.ink;
  const b = Math.round(Math.min(W, H) * 0.034), o = Math.round(b * 0.28);
  const kind = v?.backdrop || 'triangles';
  const m = motif(kind, b, ink, theme);
  const id = `mdb${index}`;
  const frame = `M0 0 H${W} V${H} H0 Z M${b + o} ${b + o} V${H - b - o} H${W - b - o} V${b + o} Z`;
  // A rosette in each corner.
  const rose = (x, y) => `<g transform="translate(${x} ${y})"><rect x="${-b * 0.62}" y="${-b * 0.62}" width="${b * 1.24}" height="${b * 1.24}" fill="${theme.accent2}" stroke="${ink}" stroke-width="${(b * 0.08).toFixed(1)}"/>${[0, 45, 90, 135].map((a) => `<ellipse rx="${b * 0.5}" ry="${b * 0.16}" transform="rotate(${a})" fill="#f2b632" stroke="${ink}" stroke-width="${(b * 0.04).toFixed(1)}"/>`).join('')}<circle r="${b * 0.16}" fill="${theme.accent}" stroke="${ink}" stroke-width="${(b * 0.04).toFixed(1)}"/></g>`;
  const c = (b + o) / 2;
  // A small motif that changes per scene (the seeded variety), in the top band's middle.
  const rnd = seeded(`${v?.decor ?? 0}|${index}`);
  const mid = rnd() < 0.5 ? `<circle cx="${W / 2}" cy="${c}" r="${b * 0.42}" fill="#f2b632" stroke="${ink}" stroke-width="${(b * 0.07).toFixed(1)}"/>` : `<path d="M${W / 2 - b * 0.5} ${c} L${W / 2} ${c - b * 0.42} L${W / 2 + b * 0.5} ${c} L${W / 2} ${c + b * 0.42} Z" fill="#f2b632" stroke="${ink}" stroke-width="${(b * 0.07).toFixed(1)}"/>`;
  return `<svg class="md-border" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><defs><pattern id="${id}" width="${m.w}" height="${m.h}" patternUnits="userSpaceOnUse">${m.d}</pattern></defs>`
    + `<path d="${frame}" fill="${BAND[kind]}" fill-rule="evenodd"/><path d="${frame}" fill="url(#${id})" fill-rule="evenodd"/>`
    + `<rect x="${(b * 0.06).toFixed(1)}" y="${(b * 0.06).toFixed(1)}" width="${W - b * 0.12}" height="${H - b * 0.12}" fill="none" stroke="${ink}" stroke-width="${(b * 0.12).toFixed(1)}"/>`
    + `<rect x="${b}" y="${b}" width="${W - 2 * b}" height="${H - 2 * b}" fill="none" stroke="${ink}" stroke-width="${(b * 0.1).toFixed(1)}"/>`
    + `<rect x="${b + o}" y="${b + o}" width="${W - 2 * (b + o)}" height="${H - 2 * (b + o)}" fill="none" stroke="${ink}" stroke-width="${(b * 0.1).toFixed(1)}"/>`
    + `<rect x="${b}" y="${b}" width="${W - 2 * b}" height="${o}" fill="${theme.accent}"/><rect x="${b}" y="${H - b - o}" width="${W - 2 * b}" height="${o}" fill="${theme.accent}"/><rect x="${b}" y="${b}" width="${o}" height="${H - 2 * b}" fill="${theme.accent}"/><rect x="${W - b - o}" y="${b}" width="${o}" height="${H - 2 * b}" fill="${theme.accent}"/>`
    + `${mid}${rose(c, c)}${rose(W - c, c)}${rose(c, H - c)}${rose(W - c, H - c)}</svg>`
    + (sc.template === 'story' || sc.template === 'dialogue' ? '' : textMotifs(W, H, b, theme, rnd));
}

/**
 * Text scenes (titles, lists, quotes…): painted motifs behind the words, so they look like a page
 * of the same painting: a sun with a face in a top corner, two fish facing each other at the
 * bottom (an old Mithila sign of good fortune) and lotuses.
 */
function textMotifs(W, H, b, t, rnd) {
  const ink = t.ink, u = Math.min(W, H) / 100, sw = (k) => (u * k).toFixed(1);
  const left = rnd() < 0.5, sx = left ? W * 0.2 : W * 0.8, sy = H * 0.12, r = u * 9;
  const rays = Array.from({ length: 14 }, (_, k) => { const a = (k / 14) * Math.PI * 2; return `M${(sx + Math.cos(a - 0.12) * r).toFixed(0)} ${(sy + Math.sin(a - 0.12) * r).toFixed(0)} L${(sx + Math.cos(a) * r * 1.55).toFixed(0)} ${(sy + Math.sin(a) * r * 1.55).toFixed(0)} L${(sx + Math.cos(a + 0.12) * r).toFixed(0)} ${(sy + Math.sin(a + 0.12) * r).toFixed(0)} Z`; }).join(' ');
  const sun = `<g class="md-spin" style="transform-origin:${sx.toFixed(0)}px ${sy.toFixed(0)}px"><path d="${rays}" fill="${t.accent}" stroke="${ink}" stroke-width="${sw(0.35)}"/></g><circle cx="${sx}" cy="${sy}" r="${r}" fill="#f2b632" stroke="${ink}" stroke-width="${sw(0.6)}"/>`
    + `<path d="M${sx - r * 0.55} ${sy - r * 0.15} q${r * 0.22} ${-r * 0.22} ${r * 0.44} 0 q${-r * 0.22} ${r * 0.14} ${-r * 0.44} 0 Z M${sx + r * 0.11} ${sy - r * 0.15} q${r * 0.22} ${-r * 0.22} ${r * 0.44} 0 q${-r * 0.22} ${r * 0.14} ${-r * 0.44} 0 Z" fill="#fff" stroke="${ink}" stroke-width="${sw(0.3)}"/><circle cx="${sx - r * 0.3}" cy="${sy - r * 0.16}" r="${r * 0.08}" fill="${ink}"/><circle cx="${sx + r * 0.36}" cy="${sy - r * 0.16}" r="${r * 0.08}" fill="${ink}"/><path d="M${sx - r * 0.32} ${sy + r * 0.38} q${r * 0.32} ${r * 0.26} ${r * 0.64} 0" fill="none" stroke="${t.accent}" stroke-width="${sw(0.7)}" stroke-linecap="round"/>`;
  const fish = (x, y, dir, c) => `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${dir * u * 0.16} ${u * 0.16})"><path d="M-60 0 C-30 -40 40 -40 60 0 C40 40 -30 40 -60 0 Z" fill="${c}" stroke="${ink}" stroke-width="5"/><path d="M-40 -12 A12 12 0 0 1 -16 -12 M-16 -12 A12 12 0 0 1 8 -12 M8 -12 A12 12 0 0 1 32 -12 M-34 8 A12 12 0 0 1 -10 8 M-10 8 A12 12 0 0 1 14 8" fill="none" stroke="${ink}" stroke-width="3"/><path d="M-58 0 L-96 -28 L-88 0 L-96 28 Z" fill="#f2b632" stroke="${ink}" stroke-width="5"/><circle cx="34" cy="-6" r="8" fill="#fff" stroke="${ink}" stroke-width="3"/><circle cx="36" cy="-6" r="4" fill="${ink}"/></g>`;
  const fy = H - b * 2 - u * 9;
  const lotus = (x, y) => `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${u * 0.14})"><path d="M0 0 C-30 -10 -40 -50 -20 -70 C-10 -40 0 -20 0 0 Z M0 0 C30 -10 40 -50 20 -70 C10 -40 0 -20 0 0 Z M0 0 C-12 -30 -8 -70 0 -86 C8 -70 12 -30 0 0 Z" fill="#e2678f" stroke="${ink}" stroke-width="5"/><path d="M-60 8 C-30 -6 30 -6 60 8 C30 18 -30 18 -60 8 Z" fill="#3d8b3f" stroke="${ink}" stroke-width="5"/></g>`;
  return `<svg class="md-motif" viewBox="0 0 ${W} ${H}" aria-hidden="true">${sun}${fish(W / 2 - u * 13, fy, 1, t.accent)}${fish(W / 2 + u * 13, fy, -1, t.accent2)}${lotus(b * 2 + u * 8, fy + u * 4)}${lotus(W - b * 2 - u * 8, fy + u * 4)}</svg>`;
}

const PAPER = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><filter id='p'><feTurbulence type='fractalNoise' baseFrequency='.55' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .45  0 0 0 0 .32  0 0 0 0 .16  0 0 0 .13 0'/></filter><rect width='300' height='300' filter='url(#p)'/></svg>")}")`;

/** CSS for the madhubani style. */
export function madhuCss(s, t, sel) {
  const o = [];
  o.push(`${sel} .amb{display:none}`);
  o.push(`${sel}::before{content:"";position:absolute;inset:0;z-index:5;pointer-events:none;background:${PAPER};mix-blend-mode:multiply}`);
  o.push(`${sel} .md-border{position:absolute;inset:0;width:100%;height:100%;z-index:6;pointer-events:none}`);
  o.push(`${sel} .scene .in{z-index:1}`);
  // Painted text: maroon display type, cards like painted panels with a double black line.
  o.push(`${sel} .headline{color:#8c2a2a;text-shadow:none}${sel} .headline mark{background:none;color:var(--accent)}`);
  o.push(`${sel} .kicker{color:var(--accent2);letter-spacing:.02em}`); // wide spacing breaks up Devanagari words
  o.push(`${sel} .md-motif{position:absolute;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}`);
  o.push(`${sel} .md-spin{animation:md-spin 40s linear infinite}@keyframes md-spin{to{transform:rotate(360deg)}}`);
  o.push(`${sel} .chip,${sel} .tag,${sel} .badge,${sel} .stat,${sel} .steps li,${sel} .qz-opt,${sel} .storytext,${sel} .bubble{background:#fbf3df !important;box-shadow:0 0 0 calc(var(--u)*.25) #fbf3df,0 0 0 calc(var(--u)*.55) var(--ink) !important;border:calc(var(--u)*.3) solid var(--ink) !important;color:var(--ink)}`);
  o.push(`${sel} .frame{box-shadow:none;border:calc(var(--u)*.6) double var(--ink);border-radius:0}`);
  // Story scenes: the painted place fills the frame, figures keep their flat Madhubani colours.
  o.push(`${sel} .t-story .storytext{border-radius:calc(var(--u)*1)}`);
  o.push(`${sel} .chr.plan-myth{filter:none}`);
  return o.join('\n');
}
