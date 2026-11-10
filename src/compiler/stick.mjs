// Stickman characters drawn in code (plan 14, Phase 2). Same rig as the cartoon characters
// (ch-head, ch-arm-l/r, ch-leg-l/r, ch-eyes, ch-mouth-closed), so every pose, walk, entrance and
// talking animation in CHARACTER_CSS works unchanged. Coordinates match characters.mjs:
// viewBox -30 -50 260 350, feet on y = 293, centre line x = 100.
//
// The pen line is "hand-drawn": each stroke is a smooth path through a few points nudged by a
// seeded random, so a character looks the same on every frame (no flicker) but not ruler-straight.
import { VIEWBOX } from './characters.mjs';

// ---------- seeded wobble ----------
function rng(seed) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const f1 = (n) => (+n).toFixed(1);

/** A slightly wobbly line from (x1,y1) to (x2,y2), as a smooth path through 4 jittered points. */
function wline(r, x1, y1, x2, y2, amp) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  const pts = [[x1, y1]];
  for (const t of [0.33, 0.66]) { const o = (r() - 0.5) * 2 * amp; pts.push([x1 + dx * t + nx * o, y1 + dy * t + ny * o]); }
  pts.push([x2, y2]);
  // Catmull-Rom through the points, as cubic Béziers.
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}

/** A hand-drawn circle: radius wobbles a little and the pen overshoots where it started. */
function wcircle(r, cx, cy, rad, amp) {
  const n = 12, start = r() * Math.PI * 2, pts = [];
  for (let k = 0; k <= n + 1; k++) {
    const a = start + (k / n) * Math.PI * 2;
    const rr = rad + (r() - 0.5) * 2 * amp + (k > n ? amp * 0.8 : 0);
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  let d = `M${f1(pts[0][0])} ${f1(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[pts.length - 2], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${f1(p1[0] + (p2[0] - p0[0]) / 6)} ${f1(p1[1] + (p2[1] - p0[1]) / 6)} ${f1(p2[0] - (p3[0] - p1[0]) / 6)} ${f1(p2[1] - (p3[1] - p1[1]) / 6)} ${f1(p2[0])} ${f1(p2[1])}`;
  }
  return d;
}

// ---------- expressions ----------
/** All moods the stickman draws. The cartoon and 3D characters show the nearest of their six. */
export const STICK_MOODS = ['happy', 'sad', 'surprised', 'angry', 'worried', 'sleepy', 'shocked', 'frustrated', 'sweating', 'crying', 'grin', 'deflated', 'suspicious'];
export const MOOD_BASE = { shocked: 'surprised', frustrated: 'angry', sweating: 'worried', crying: 'sad', grin: 'happy', deflated: 'sad', suspicious: 'worried' };
export const baseMood = (m) => MOOD_BASE[m] || m || 'happy';

const HEAD = { cx: 100, cy: 54, r: 34 };

function stickFace(mood, ink, lw, accent) {
  const { cx, cy } = HEAD, ey = cy - 2, my = cy + 14, ex1 = cx - 11, ex2 = cx + 11;
  const s = (d, w = lw * 0.75) => `<path d="${d}" stroke="${ink}" stroke-width="${f1(w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  // Eyes
  let eyes;
  const dot = (x, rx = 3.2, ry = 4.4) => `<ellipse class="eye" cx="${x}" cy="${ey}" rx="${rx}" ry="${ry}" fill="${ink}"/>`;
  switch (mood) {
    case 'sleepy': eyes = s(`M${ex1 - 5} ${ey} q5 4 10 0`) + s(`M${ex2 - 5} ${ey} q5 4 10 0`); break;
    case 'suspicious': eyes = s(`M${ex1 - 5} ${ey + 1} h10`, lw * 0.9) + dot(ex2, 3, 2.6); break;
    case 'shocked': eyes = `<g class="eye"><circle cx="${ex1}" cy="${ey}" r="6.5" fill="#fff" stroke="${ink}" stroke-width="${f1(lw * 0.5)}"/><circle cx="${ex1}" cy="${ey}" r="1.8" fill="${ink}"/></g><g class="eye"><circle cx="${ex2}" cy="${ey}" r="6.5" fill="#fff" stroke="${ink}" stroke-width="${f1(lw * 0.5)}"/><circle cx="${ex2}" cy="${ey}" r="1.8" fill="${ink}"/></g>`; break;
    case 'grin': eyes = s(`M${ex1 - 5} ${ey + 2} q5 -6 10 0`) + s(`M${ex2 - 5} ${ey + 2} q5 -6 10 0`); break;
    case 'surprised': eyes = dot(ex1, 3.6, 5) + dot(ex2, 3.6, 5); break;
    default: eyes = dot(ex1) + dot(ex2);
  }
  // Brows: inner end, outer end (y offsets, negative = up)
  const by = ey - 11;
  const brow = (x, side, inner, outer) => s(`M${x + side * 6} ${by + outer} L${x - side * 6} ${by + inner}`, lw * 0.7);
  let brows = '';
  switch (mood) {
    case 'sad': case 'worried': case 'crying': case 'sweating': brows = brow(ex1, -1, -4, 2) + brow(ex2, 1, -4, 2); break;
    case 'deflated': brows = brow(ex1, -1, -2, 3) + brow(ex2, 1, -2, 3); break;
    case 'angry': case 'frustrated': brows = brow(ex1, -1, 4, -3) + brow(ex2, 1, 4, -3); break;
    case 'surprised': case 'shocked': brows = s(`M${ex1 - 6} ${by - 3} q6 -6 12 0`, lw * 0.7) + s(`M${ex2 - 6} ${by - 3} q6 -6 12 0`, lw * 0.7); break;
    case 'suspicious': brows = brow(ex1, -1, 3, 1) + s(`M${ex2 - 6} ${by - 2} q6 -7 12 -1`, lw * 0.7); break;
    default: brows = '';
  }
  // Mouth at rest (the mood); visemes replace it while the character speaks.
  let mouth;
  switch (mood) {
    case 'sad': case 'crying': mouth = s(`M${cx - 8} ${my + 4} q8 -7 16 0`); break;
    case 'deflated': mouth = s(`M${cx - 7} ${my + 3} q7 -3 14 0`); break;
    case 'angry': mouth = s(`M${cx - 8} ${my + 3} q8 -5 16 0`, lw * 0.85); break;
    case 'frustrated': mouth = `<rect x="${cx - 9}" y="${my - 3}" width="18" height="7" rx="2" fill="#fff" stroke="${ink}" stroke-width="${f1(lw * 0.6)}"/>` + s(`M${cx - 3} ${my - 3} v7 M${cx + 3} ${my - 3} v7`, lw * 0.4); break;
    case 'surprised': mouth = `<ellipse cx="${cx}" cy="${my + 1}" rx="4" ry="5" fill="${ink}"/>`; break;
    case 'shocked': mouth = `<ellipse cx="${cx}" cy="${my + 2}" rx="7" ry="9" fill="${ink}"/>`; break;
    case 'worried': case 'sweating': mouth = s(`M${cx - 8} ${my + 1} q4 -4 8 0 t8 0`); break;
    case 'sleepy': mouth = `<ellipse cx="${cx}" cy="${my + 1}" rx="3" ry="2.4" fill="${ink}"/>`; break;
    case 'grin': mouth = `<path d="M${cx - 11} ${my - 2} Q${cx} ${my + 14} ${cx + 11} ${my - 2} Z" fill="${ink}"/><path d="M${cx - 6} ${my + 5} Q${cx} ${my + 9} ${cx + 6} ${my + 5}" fill="${accent}"/>`; break;
    case 'suspicious': mouth = s(`M${cx - 6} ${my + 2} L${cx + 7} ${my - 1}`); break;
    default: mouth = s(`M${cx - 8} ${my - 1} q8 8 16 0`);
  }
  // Extras
  let extra = '';
  if (mood === 'sweating' || mood === 'shocked') extra += `<path class="st-sweat" d="M${cx + 30} ${cy - 18} q-5 8 0 11 q5 -3 0 -11" fill="#6fc3ff" stroke="${ink}" stroke-width="${f1(lw * 0.35)}"/>`;
  if (mood === 'crying') extra += `<path class="ch-tear" d="M${ex1 + 1} ${ey + 6} q-4 7 0 10 q4 -3 0 -10" fill="#6fc3ff"/><path class="ch-tear" d="M${ex2 - 1} ${ey + 6} q-4 7 0 10 q4 -3 0 -10" fill="#6fc3ff"/>`;
  if (mood === 'frustrated' || mood === 'angry') extra += s(`M${cx + 27} ${cy - 34} l6 6 m0 -6 l-6 6`, lw * 0.6);
  if (mood === 'sleepy') extra += `<g class="ch-zzz" font-family="Caveat,Kalam,sans-serif" font-weight="700" fill="${ink}"><text x="${cx + 30}" y="${cy - 30}" font-size="16">z</text><text x="${cx + 40}" y="${cy - 44}" font-size="21">z</text></g>`;
  // Viseme mouths (one is shown at a time while speaking; see STICK_CSS)
  const V = {
    A: s(`M${cx - 7} ${my} h14`, lw * 0.9),
    B: `<path d="M${cx - 8} ${my - 1} q8 7 16 0 q-8 3 -16 0" fill="${ink}"/>`,
    C: `<path d="M${cx - 10} ${my - 2} q10 9 20 0 q-10 3 -20 0" fill="${ink}"/>`,
    D: `<ellipse cx="${cx}" cy="${my + 1}" rx="8" ry="7" fill="${ink}"/><ellipse cx="${cx}" cy="${my + 4}" rx="4.5" ry="2.4" fill="${accent}"/>`,
    E: `<ellipse cx="${cx}" cy="${my + 1}" rx="5.5" ry="6.5" fill="${ink}"/>`,
    F: `<ellipse cx="${cx}" cy="${my + 1}" rx="3.4" ry="4" fill="${ink}"/>`,
    G: `<path d="M${cx - 7} ${my - 1} q7 6 14 0 Z" fill="${ink}"/>` + s(`M${cx - 6} ${my - 2} h12`, lw * 0.5),
    H: `<ellipse cx="${cx}" cy="${my + 1}" rx="7" ry="5.5" fill="${ink}"/><path d="M${cx - 3} ${my + 1} q3 -4 6 0" fill="${accent}"/>`,
  };
  const vis = `<g class="ch-vis">${Object.entries(V).map(([k, d]) => `<g class="v${k}">${d}</g>`).join('')}</g>`;
  return `<g class="ch-eyes">${eyes}</g>${brows}<g class="ch-mouth-closed">${mouth}</g>${vis}${extra}`;
}

// ---------- the figure ----------
/**
 * @param kind  cast kind (boy, girl, man, woman, grandpa, grandma; others drawn as an adult)
 * @param o     { mood, pose, color, id (wobble seed), head: hollow|white|glow|beanie|hood, ink, paper, accent,
 *                limb (limb colour), lw (line width), wobble, gloves, beanie, shirt }
 */
export function stickSvg(kind, o = {}) {
  const r = rng(`${o.id || kind}`);
  const ink = o.ink || '#191916', paper = o.paper || '#fdfdfc', accent = o.accent || '#e5483b';
  const head = o.head || 'hollow', lw = o.lw || 4.6, amp = o.wobble ?? 1.6;
  const limb = o.limb || ink;
  const mood = o.mood || 'happy';
  const glow = head === 'glow';
  const stroke = (d, w = lw, c = limb) => `<path d="${d}" stroke="${c}" stroke-width="${f1(w)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const { cx, cy, r: hr } = HEAD;
  const shoulder = [100, 104], hip = [100, 196];
  const kid = kind === 'boy' || kind === 'girl';
  const old = kind === 'grandpa' || kind === 'grandma';
  const female = kind === 'girl' || kind === 'woman' || kind === 'grandma';

  // Limbs: arm from the shoulder down (elbow slightly out), hand at the end. Rotated by the pose CSS.
  const hand = (x, y) => o.gloves
    ? `<circle cx="${x}" cy="${y}" r="10" fill="#ffffff" stroke="${ink}" stroke-width="${f1(lw * 0.7)}"/>`
    : `<ellipse cx="${x}" cy="${y}" rx="${glow ? 8 : 5.5}" ry="${glow ? 8 : 6.5}" fill="${limb}"/>`;
  const armPath = (side) => { const s = side === 'l' ? -1 : 1; return `${wline(r, shoulder[0], shoulder[1], shoulder[0] + s * 5, 145, amp)} ${wline(r, shoulder[0] + s * 5, 145, shoulder[0], 186, amp).replace(/^M[^C]+/, '')}`; };
  const arm = (side) => `<g class="ch-arm ch-arm-${side}" style="transform-origin:${shoulder[0]}px ${shoulder[1]}px">${stroke(armPath(side))}${hand(shoulder[0], 190)}</g>`;
  const foot = (side) => `<ellipse cx="${side === 'l' ? 95 : 105}" cy="290" rx="${glow ? 10 : 8}" ry="${glow ? 5.5 : 4.2}" fill="${limb}"/>`;
  const leg = (side) => `<g class="ch-leg ch-leg-${side}" style="transform-origin:${hip[0]}px ${hip[1]}px">${stroke(wline(r, hip[0], hip[1], hip[0], 287, amp))}${foot(side)}</g>`;

  // Body: a single line, or a shirt for beanie / hood styles.
  let torso;
  if (head === 'beanie' || head === 'hood') {
    const c = o.shirt || o.color || (head === 'hood' ? '#e8862e' : '#ffd23f');
    torso = `<path d="M84 100 Q100 94 116 100 L120 196 Q100 202 80 196 Z" fill="${c}" stroke="${ink}" stroke-width="${f1(lw * 0.8)}" stroke-linejoin="round"/>`;
    if (head === 'beanie') torso += `<path d="M82 196 L118 196 L116 220 L84 220 Z" fill="${o.shorts || '#2b2f3a'}" stroke="${ink}" stroke-width="${f1(lw * 0.7)}" stroke-linejoin="round"/>`;
  } else {
    torso = stroke(wline(r, 100, cy + hr - 2, hip[0], hip[1], amp), glow ? lw * 1.4 : lw);
  }

  // Head
  const headFill = head === 'hollow' || head === 'beanie' ? paper : glow ? '#f1f3f6' : '#ffffff';
  const headStroke = glow ? 'none' : ink;
  let headBack = '', headFront = '';
  if (head === 'hood') {
    const hc = o.shirt || o.color || '#e8862e';
    headBack = `<path d="M${cx - 40} ${cy + 26} Q${cx - 46} ${cy - 44} ${cx} ${cy - 46} Q${cx + 46} ${cy - 44} ${cx + 40} ${cy + 26} Q${cx} ${cy + 40} ${cx - 40} ${cy + 26} Z" fill="${hc}" stroke="${ink}" stroke-width="${f1(lw * 0.8)}"/>`;
  }
  // Family details, so a cast reads as different people.
  const hairC = old ? '#9aa0a6' : ink;
  if (head !== 'hood' && head !== 'beanie' && !glow) {
    if (kind === 'boy') headFront += stroke(`M${cx - 10} ${cy - hr + 1} l-4 -9 M${cx} ${cy - hr - 1} l1 -10 M${cx + 10} ${cy - hr + 1} l5 -8`, lw * 0.8, hairC);
    if (kind === 'man') headFront += stroke(`M${cx - hr + 4} ${cy - 12} Q${cx} ${cy - hr - 12} ${cx + hr - 4} ${cy - 12}`, lw * 1.1, hairC);
    if (kind === 'girl') { headBack += stroke(`M${cx + hr - 4} ${cy - 16} q22 -4 20 26 q-2 14 -10 20`, lw * 1.2, hairC); headFront += `<path d="M${cx + hr - 8} ${cy - 24} l10 -6 l-2 12 Z" fill="${accent}"/>`; }
    if (kind === 'woman') headBack += stroke(`M${cx - hr + 2} ${cy - 14} q-10 30 -4 58 M${cx + hr - 2} ${cy - 14} q10 30 4 58 M${cx - hr + 6} ${cy - 20} Q${cx} ${cy - hr - 14} ${cx + hr - 6} ${cy - 20}`, lw * 1.1, hairC);
    if (kind === 'grandma') headBack += `<circle cx="${cx}" cy="${cy - hr - 6}" r="11" fill="${hairC}" stroke="${ink}" stroke-width="${f1(lw * 0.5)}"/>`;
    if (kind === 'grandpa') headFront += stroke(`M${cx - 9} ${cy + 9} q9 5 18 0`, lw * 1.3, hairC);
    if (old) headFront += `<g fill="none" stroke="${ink}" stroke-width="${f1(lw * 0.55)}"><circle cx="${cx - 11}" cy="${cy - 2}" r="8"/><circle cx="${cx + 11}" cy="${cy - 2}" r="8"/><path d="M${cx - 3} ${cy - 2} h6"/></g>`;
  }
  if (head === 'beanie') {
    const bc = o.beanie || '#e23b3b';
    headFront += `<path d="M${cx - hr - 2} ${cy - 6} Q${cx - hr} ${cy - hr - 16} ${cx} ${cy - hr - 16} Q${cx + hr} ${cy - hr - 16} ${cx + hr + 2} ${cy - 6} Z" fill="${bc}" stroke="${ink}" stroke-width="${f1(lw * 0.8)}" stroke-linejoin="round"/><path d="M${cx - hr - 3} ${cy - 8} h${2 * hr + 6}" stroke="${ink}" stroke-width="${f1(lw * 0.6)}"/>`;
  }
  const headShape = `<path d="${wcircle(r, cx, cy, hr, glow ? 0.4 : amp * 0.7)}" fill="${headFill}" stroke="${headStroke}" stroke-width="${f1(lw)}" stroke-linejoin="round"/>`;
  const sizeK = kid ? 0.86 : 1;
  const headG = `<g class="ch-head" style="transform-origin:100px ${cy + hr + 8}px">${headBack}${headShape}${stickFace(mood, glow ? '#3a3f47' : ink, lw, accent)}${headFront}</g>`;
  const body = `${leg('l')}${leg('r')}${arm('l')}${torso}${arm('r')}${headG}`;
  const shadow = `<ellipse class="ch-shadow" cx="100" cy="293" rx="40" ry="5" fill="${glow ? '#ffffff14' : '#00000018'}"/>`;
  // Kids are drawn a little smaller, from the feet.
  const kidT = sizeK === 1 ? '' : ` transform="translate(100 293) scale(${sizeK}) translate(-100 -293)"`;
  return `<svg class="chr plan-stick st-head-${head}${female ? ' st-f' : ''} pose-${o.pose || 'idle'} mood-${mood}" viewBox="${VIEWBOX}" role="img" aria-label="${kind}">${shadow}<g class="ch-all"${kidT}><g class="ch-body">${body}</g></g></svg>`;
}

/** Extra CSS for stickmen: default leg spread, viseme mouths, sweat. Loaded with CHARACTER_CSS. */
export const STICK_CSS = `
:where(.chr.plan-stick) .ch-leg-l{transform:rotate(7deg)}:where(.chr.plan-stick) .ch-leg-r{transform:rotate(-7deg)}
.chr.plan-stick .ch-vis>g{display:none}
.chwrap[data-vis]:not([data-vis=""]):not([data-vis="X"]) .chr.plan-stick .ch-mouth-closed{display:none}
${'ABCDEFGH'.split('').map(k => `.chwrap[data-vis="${k}"] .chr.plan-stick .ch-vis .v${k}{display:inline}`).join('\n')}
.chr.plan-stick .st-sweat{animation:ch-drip 1.6s ease-in infinite}
.talking .chr.plan-stick .ch-mouth-open{display:none}
.talking .chr.plan-stick .ch-mouth-closed{opacity:1}
`;
