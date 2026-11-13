// Per-video variety (plan 18 M1). YouTube removes faceless channels whose videos look templated, so two
// videos in the same style should not look like copies. A seed from the title picks, inside the style:
// the accent colours, how text enters, the scene transitions and the backdrop pattern. The same
// storyboard always renders the same.
import { STYLES } from './styles.mjs';

export const ENTRANCES = ['up', 'slide', 'scale', 'blur', 'drop'];
const TRANSITION_SETS = [['fade'], ['slide', 'fade'], ['zoom', 'fade'], ['slide'], ['fade', 'zoom', 'slide'], ['cut', 'fade']];
const KINETIC_MOVES = ['kt-slam', 'kt-left', 'kt-rise', 'kt-drop', 'kt-zoom'];

/** A small seeded random generator (mulberry32 on a string hash). */
export function seeded(text) {
  let h = 2166136261 >>> 0;
  for (const c of String(text || 'video')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rnd, list) => list[Math.floor(rnd() * list.length) % list.length];

/**
 * Choices for one video. `seed` is normally the title (plus the user's own "seed" field, if given).
 * Returns { entrance, transitions, accent, backdrop, ground, moves, decor } — only what the style supports.
 */
export function variety(storyboard, styleId) {
  const s = STYLES[styleId];
  const rnd = seeded(`${storyboard.seed ?? ''}|${storyboard.title || ''}|${styleId || ''}`);
  const v = {
    entrance: pick(rnd, ENTRANCES),
    transitions: pick(rnd, TRANSITION_SETS),
    accent: null, backdrop: null, ground: null,
    // Kinetic typography: which entrance each word group uses, in order.
    moves: KINETIC_MOVES.slice().sort(() => rnd() - 0.5),
    // Flat vector decoration: one layout number per scene is taken from this.
    decor: Math.floor(rnd() * 1e9),
  };
  if (s?.accents?.length) v.accent = storyboard.accent ? null : pick(rnd, s.accents);
  if (s?.backdrops?.length) v.backdrop = pick(rnd, s.backdrops);
  if (s?.grounds?.length) v.ground = pick(rnd, s.grounds);
  return v;
}

/** CSS for the entrance the video uses (overrides the default "rise up" for styled videos). */
export function entranceCss(v) {
  if (!v || v.entrance === 'up') return '';
  const kf = {
    slide: 'from{opacity:0;transform:translateX(calc(var(--u)*-6))}',
    scale: 'from{opacity:0;transform:scale(.82)}',
    blur: 'from{opacity:0;filter:blur(calc(var(--u)*1.2));transform:translateY(calc(var(--u)*1.2))}',
    drop: 'from{opacity:0;transform:translateY(calc(var(--u)*-4))}',
  }[v.entrance];
  return `#stage.v-ent-${v.entrance} .a-up{animation-name:v-${v.entrance}}\n@keyframes v-${v.entrance}{${kf}}`;
}

/** Flat-vector decoration for one scene: 3 soft shapes in the style's colours, placed by the seed. */
export function flatDecor(v, index, theme) {
  const rnd = seeded(`${v.decor}|${index}`);
  const colors = [theme.accent, theme.accent2, theme.bg3];
  const shapes = [];
  for (let k = 0; k < 3; k++) {
    const kind = Math.floor(rnd() * 3);
    const size = 14 + rnd() * 26;
    const x = rnd() < 0.5 ? -6 + rnd() * 22 : 70 + rnd() * 30;
    const y = -8 + rnd() * 100;
    const c = colors[k % colors.length];
    const op = k === 2 ? 0.9 : 0.16 + rnd() * 0.12;
    const radius = kind === 0 ? '50%' : kind === 1 ? '22%' : '50%';
    const fill = kind === 2 ? `border:calc(var(--u)*${(1 + rnd() * 1.4).toFixed(2)}) solid ${c};background:none` : `background:${c}`;
    shapes.push(`<i style="left:${x.toFixed(1)}%;top:${y.toFixed(1)}%;width:calc(var(--u)*${size.toFixed(1)});height:calc(var(--u)*${size.toFixed(1)});border-radius:${radius};${fill};opacity:${op.toFixed(2)};transform:rotate(${(rnd() * 40 - 20).toFixed(0)}deg);animation-delay:${(0.05 + k * 0.12).toFixed(2)}s"></i>`);
  }
  return `<div class="fv-decor">${shapes.join('')}</div>`;
}
