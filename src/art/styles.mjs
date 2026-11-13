// Art styles (plan 14 §3.4, plan 15, plan 18). One entry sets the whole look of a video: colours, fonts,
// the stage background, how story scenes are drawn, and the caption treatment. "base" is the look a style
// is built on: stickman styles draw people as stickmen; other styles work with the 2D cartoon look or with
// motion graphics only. Every style is drawn in code (free); painted scenes (Gemini) come in plan 14 Phase 3.
//
// Wording and choices are our own; the reference README (kaomei/stickman-video-director, MIT) inspired
// the set of styles. No channel names, no copied media.
import { backgroundHtml } from '../compiler/backgrounds.mjs';

const PAPER_GRID = (paper, line) => `linear-gradient(${line} 1px,transparent 1px) 0 0/calc(var(--u)*5.9) calc(var(--u)*5.9),linear-gradient(90deg,${line} 1px,transparent 1px) 0 0/calc(var(--u)*5.9) calc(var(--u)*5.9),${paper}`;

/**
 * kind:  "paper" (plain or patterned page, figures on a hand-drawn ground line) or
 *        "scene" (an illustrated place from backgrounds.mjs, tinted to the style)
 * head:  stickman head type (stick.mjs): hollow | white | glow | beanie | hood
 */
export const STYLES = {
  'line-art': {
    label: 'Minimal Line Art', kind: 'paper', head: 'hollow', lw: 5.2, wobble: 1.7,
    theme: { dark: false, bg: '#fdfdfc', bg2: '#f6f6f3', bg3: '#eeeeea', ink: '#191916', muted: '#5f6368', accent: '#e5483b', accent2: '#f2b630', ok: '#2e9b5f', alert: '#e5483b', onAccent: '#ffffff', display: 'Caveat' },
    font: { display: '"Caveat","Kalam"', body: '"Kalam","Hind"' },
    stage: PAPER_GRID('#fdfdfc', 'rgba(76,90,105,.05)'), caption: 'ink', underline: true,
  },
  'classic-bw': {
    label: 'Classic Black & White', kind: 'paper', head: 'hollow', lw: 5.4, wobble: 0.9,
    theme: { dark: false, bg: '#ffffff', bg2: '#f7f7f7', bg3: '#efefef', ink: '#111111', muted: '#555555', accent: '#e63946', accent2: '#2f6bff', ok: '#2a9d8f', alert: '#e63946', onAccent: '#ffffff', display: 'Poppins' },
    dark: { dark: true, bg: '#0b0b0c', bg2: '#151517', bg3: '#1f1f22', ink: '#f4f4f2', muted: '#a8a8a8', accent: '#ffcc33', accent2: '#4cc9f0', ok: '#2ec4b6', alert: '#ff5d5d', onAccent: '#111111', display: 'Poppins' },
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: '#ffffff', stageDark: '#0b0b0c', caption: 'ink', underline: true,
  },
  'modern-pop': {
    label: 'Modern Pop', kind: 'paper', head: 'beanie', lw: 4.4, wobble: 0.6,
    theme: { dark: false, bg: '#ffffff', bg2: '#f3f6f9', bg3: '#e8eef4', ink: '#1d1f24', muted: '#5b6472', accent: '#16b7d9', accent2: '#2f6bff', ok: '#16b77d', alert: '#e5483b', onAccent: '#ffffff', display: 'Poppins' },
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: 'linear-gradient(180deg,#ffffff 0%,#ffffff 62%,#f2f5f8 62%),#ffffff', floorGrid: true, caption: 'box-light', underline: false,
  },
  'retro-tv': {
    label: 'Retro TV', kind: 'paper', head: 'glow', lw: 7, wobble: 0.3, limb: '#e9ebee', ink: '#e9ebee',
    theme: { dark: true, bg: '#0d0f12', bg2: '#15181d', bg3: '#1c2027', ink: '#f2f3f5', muted: '#9aa1ab', accent: '#ffffff', accent2: '#b9c0ca', ok: '#9be7c4', alert: '#ff7a7a', onAccent: '#0d0f12', display: 'Poppins' },
    font: { display: '"Poppins","Hind"', body: '"Poppins","Hind"' },
    stage: 'radial-gradient(120% 90% at 50% 45%,#1a1e24 0%,#0d0f12 70%,#050607 100%)', scanlines: true, caption: 'tv', underline: false, upper: true,
  },
  'cozy-color': {
    label: 'Colourful Hand-Drawn', kind: 'scene', head: 'white', lw: 3.6, wobble: 1.4,
    theme: { dark: false, bg: '#f7f1e3', bg2: '#efe6d2', bg3: '#e6d9bf', ink: '#2a2622', muted: '#6e6457', accent: '#e07a5f', accent2: '#3d8a7f', ok: '#4f9d69', alert: '#d1495b', onAccent: '#ffffff', display: 'Caveat' },
    font: { display: '"Caveat","Kalam"', body: '"Kalam","Hind"' },
    stage: '#f7f1e3', tint: 'background:#f7efe0;mix-blend-mode:multiply;opacity:.35', filter: 'saturate(.8) brightness(1.03)', caption: 'paper', underline: true,
  },
  'cozy-story': {
    label: 'Cozy Storytelling', kind: 'scene', head: 'white', lw: 4, wobble: 1,
    theme: { dark: false, bg: '#fff6ea', bg2: '#ffead0', bg3: '#ffdcb0', ink: '#2d2a32', muted: '#6b5e57', accent: '#ff7b54', accent2: '#4ecdc4', ok: '#2a9d8f', alert: '#e63946', onAccent: '#ffffff', display: 'Poppins' },
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: '#fff6ea', filter: 'saturate(1.05)', caption: 'box', underline: false,
  },
  prehistoric: {
    label: 'Prehistoric Cave', kind: 'scene', head: 'white', lw: 5, wobble: 2.2,
    theme: { dark: false, bg: '#efe2c8', bg2: '#e2cfa8', bg3: '#d2b98a', ink: '#2b1d12', muted: '#6b5440', accent: '#c0622b', accent2: '#7a8b3a', ok: '#6a8f3a', alert: '#b3361e', onAccent: '#ffffff', display: 'Caveat' },
    font: { display: '"Caveat","Kalam"', body: '"Kalam","Hind"' },
    stage: '#efe2c8', defaultPlace: 'mountains', tint: 'background:#c9a26b;mix-blend-mode:multiply;opacity:.35', filter: 'sepia(.35) saturate(.85)', caption: 'box', underline: true,
  },
  historical: {
    label: 'Historical Cartoon', kind: 'scene', head: 'white', lw: 4.6, wobble: 0.8,
    theme: { dark: false, bg: '#fbf3e4', bg2: '#f3e3c4', bg3: '#e8cf9f', ink: '#1f1a17', muted: '#5e5248', accent: '#d9482b', accent2: '#1f6f8b', ok: '#2f7d4f', alert: '#b3261e', onAccent: '#ffffff', display: 'Rozha One' },
    font: { display: '"Rozha One","Hind"', body: '"Hind"' },
    stage: '#fbf3e4', defaultPlace: 'village', filter: 'saturate(1.1) contrast(1.05)', caption: 'box', underline: false,
  },
  'amber-noir': {
    label: 'Amber Noir', kind: 'scene', head: 'hood', lw: 4.2, wobble: 0.6, shirt: '#e8862e', ink: '#1a1020', limb: '#f6e6d2',
    theme: { dark: true, bg: '#1a1020', bg2: '#2a1830', bg3: '#3b2240', ink: '#f6e6d2', muted: '#c4a98f', accent: '#ffb347', accent2: '#e8862e', ok: '#7bdff2', alert: '#ff5e78', onAccent: '#1a1020', display: 'Poppins' },
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: '#1a1020', defaultPlace: 'city', defaultTime: 'night', tint: 'background:radial-gradient(70% 60% at 60% 40%,#ffb34766,#2a103900 60%),#2a1030;mix-blend-mode:multiply;opacity:.75', filter: 'brightness(.75) saturate(1.1)', caption: 'box', underline: false,
  },
  'noir-thriller': {
    label: 'Survival Thriller', kind: 'scene', head: 'white', lw: 4.4, wobble: 0.5, gloves: true, ink: '#121212', limb: '#e9edf3',
    theme: { dark: true, bg: '#0b1020', bg2: '#141c33', bg3: '#1e2a48', ink: '#eef2f8', muted: '#9aa6bd', accent: '#ffb547', accent2: '#e5383b', ok: '#7bdff2', alert: '#ff4d4d', onAccent: '#0b1020', display: 'Poppins' },
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: '#0b1020', defaultPlace: 'city', defaultTime: 'night', tint: 'background:radial-gradient(60% 55% at 35% 35%,#ffb54755,#0000 60%),#0a1430;mix-blend-mode:multiply;opacity:.8', filter: 'brightness(.72) saturate(.9) contrast(1.1)', caption: 'box', underline: false, vignette: true,
  },
};

// ───────────────────────── plan 18: styles for every look ─────────────────────────
const NEW_STYLES = {
  whiteboard: {
    label: 'Whiteboard', base: 'stickman', kind: 'paper', head: 'hollow', lw: 5, wobble: 1.1, draw: 'marker',
    theme: { dark: false, bg: '#fbfbf8', bg2: '#f3f3ef', bg3: '#ebebe6', ink: '#1b1b1f', muted: '#55585f', accent: '#d7263d', accent2: '#1b6fd8', ok: '#2e9b5f', alert: '#d7263d', onAccent: '#ffffff', display: 'Kalam' },
    font: { display: '"Kalam","Caveat"', body: '"Kalam","Hind"' },
    stage: 'radial-gradient(140% 120% at 30% 10%,#ffffff 0%,#f7f7f3 60%,#efefea 100%)', caption: 'ink', underline: true,
    accents: [['#d7263d', '#1b6fd8'], ['#1b6fd8', '#2e9b5f'], ['#2e9b5f', '#d7263d'], ['#e07a1f', '#1b6fd8'], ['#7b3fd1', '#e07a1f']],
    backdrops: ['plain', 'grid', 'dots'],
  },
  chalkboard: {
    label: 'Chalkboard', base: 'stickman', kind: 'paper', head: 'hollow', lw: 5.2, wobble: 1.4, draw: 'chalk', ink: '#f2efe6', limb: '#f2efe6',
    theme: { dark: true, bg: '#22352c', bg2: '#2a4035', bg3: '#314a3e', ink: '#f2efe6', muted: '#c9d2c6', accent: '#ffd966', accent2: '#8fd3ff', ok: '#a5e3a1', alert: '#ff8a8a', onAccent: '#1b2a22', display: 'Kalam' },
    font: { display: '"Kalam","Caveat"', body: '"Kalam","Hind"' },
    stage: 'radial-gradient(120% 100% at 50% 40%,#2b4237 0%,#22352c 60%,#1a2922 100%)', caption: 'chalk', underline: true,
    accents: [['#ffd966', '#8fd3ff'], ['#ff9ec7', '#ffd966'], ['#8fd3ff', '#a5e3a1'], ['#ffb26b', '#8fd3ff']],
    backdrops: ['plain', 'frame'],
  },
  kinetic: {
    label: 'Kinetic Typography', base: 'motion', kind: 'paper', kinetic: true,
    theme: { dark: true, bg: '#0e0e12', bg2: '#16161d', bg3: '#1f1f29', ink: '#ffffff', muted: '#a8a8b8', accent: '#ffd23f', accent2: '#4cc9f0', ok: '#2ec4b6', alert: '#ff5d5d', onAccent: '#0e0e12', display: 'Poppins' },
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: '#0e0e12', caption: 'none', underline: false,
    accents: [['#ffd23f', '#4cc9f0'], ['#ff4d6d', '#ffd23f'], ['#4cc9f0', '#b8f35f'], ['#b8f35f', '#ff8fab'], ['#ff9f1c', '#2ec4b6']],
    grounds: ['#0e0e12', '#101828', '#1a0f1f', '#0d1b16'],
  },
  'flat-vector': {
    label: 'Flat Vector', base: '2d', kind: 'paper', flat: true,
    theme: { dark: false, bg: '#f4f6fb', bg2: '#e9eef8', bg3: '#dde5f4', ink: '#1f2a44', muted: '#5a6782', accent: '#ff6b4a', accent2: '#2bb3a3', ok: '#2bb3a3', alert: '#e63946', onAccent: '#ffffff', display: 'Poppins' },
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: '#f4f6fb', caption: 'box-light', underline: false,
    accents: [['#ff6b4a', '#2bb3a3'], ['#5b6cff', '#ffb547'], ['#2bb3a3', '#ff6b9d'], ['#ffb547', '#5b6cff'], ['#e63946', '#2a9df4']],
  },
  // Plan 18 M4: history, true crime, business stories. Works with maps, timelines and charts.
  documentary: {
    label: 'Documentary', base: 'motion', kind: 'paper', docu: true, upper: false,
    theme: { dark: true, bg: '#0f0e0c', bg2: '#181613', bg3: '#221f1b', ink: '#f1e9dc', muted: '#b3a690', accent: '#e0a84a', accent2: '#7fa7c9', ok: '#9cc79b', alert: '#d9534f', onAccent: '#14110d', display: 'Rozha One' },
    font: { display: '"Rozha One","Hind"', body: '"Hind"' },
    stage: 'radial-gradient(120% 100% at 50% 35%,#1c1915 0%,#0f0e0c 70%)', caption: 'box', underline: false,
    accents: [['#e0a84a', '#7fa7c9'], ['#d9734a', '#c9b37f'], ['#c9b37f', '#8fb3a6'], ['#e8c766', '#b5655a'], ['#9fc0d9', '#e0a84a']],
    grounds: ['radial-gradient(120% 100% at 50% 35%,#1c1915 0%,#0f0e0c 70%)', 'radial-gradient(120% 100% at 30% 30%,#161b20 0%,#0b0e11 70%)', 'radial-gradient(120% 100% at 60% 40%,#1f1714 0%,#0e0a09 72%)'],
  },
};
Object.assign(STYLES, NEW_STYLES);


export const ART_STYLES = Object.keys(STYLES);
/** The look a style is built on: "stickman", "2d" or "motion" (no characters). */
export const styleBase = (id) => STYLES[id]?.base || 'stickman';
/** Styles that need look "stickman"; the others work with any 2D video. */
export const STICK_STYLES = ART_STYLES.filter((id) => styleBase(id) === 'stickman');
export const STYLE_ALIASES = {
  'line art': 'line-art', lineart: 'line-art', minimal: 'line-art', 'minimal line art': 'line-art', 'hand-drawn': 'line-art', handdrawn: 'line-art', sketch: 'line-art', doodle: 'line-art', b1: 'line-art',
  classic: 'classic-bw', 'black and white': 'classic-bw', 'black & white': 'classic-bw', bw: 'classic-bw', monochrome: 'classic-bw', a1: 'classic-bw',
  pop: 'modern-pop', modern: 'modern-pop', beanie: 'modern-pop', tech: 'modern-pop', a2: 'modern-pop',
  tv: 'retro-tv', retro: 'retro-tv', 'retro tv': 'retro-tv', television: 'retro-tv', b3: 'retro-tv',
  colorful: 'cozy-color', colourful: 'cozy-color', 'colorful hand-drawn': 'cozy-color', 'colourful hand-drawn': 'cozy-color', psychology: 'cozy-color', b2: 'cozy-color',
  cozy: 'cozy-story', cosy: 'cozy-story', 'cozy storytelling': 'cozy-story', story: 'cozy-story', a4: 'cozy-story',
  cave: 'prehistoric', caveman: 'prehistoric', 'stone age': 'prehistoric', a3: 'prehistoric',
  history: 'historical', 'historical cartoon': 'historical', period: 'historical', a5: 'historical',
  noir: 'amber-noir', amber: 'amber-noir', 'what if': 'amber-noir', a6: 'amber-noir',
  thriller: 'noir-thriller', survival: 'noir-thriller', horror: 'noir-thriller', suspense: 'noir-thriller', 'survival thriller': 'noir-thriller', b4: 'noir-thriller',
};
Object.assign(STYLE_ALIASES, {
  documentary: 'documentary', docu: 'documentary', 'documentary style': 'documentary', cinematic: 'documentary', 'film': 'documentary', 'true crime': 'documentary', 'history documentary': 'documentary', netflix: 'documentary', 'news documentary': 'documentary',
  whiteboard: 'whiteboard', 'white board': 'whiteboard', 'whiteboard animation': 'whiteboard', 'white-board': 'whiteboard', marker: 'whiteboard', 'hand drawing': 'whiteboard', 'drawing hand': 'whiteboard',
  chalk: 'chalkboard', blackboard: 'chalkboard', 'chalk board': 'chalkboard', greenboard: 'chalkboard', 'black board': 'chalkboard', classroom: 'chalkboard',
  'kinetic typography': 'kinetic', 'kinetic type': 'kinetic', typography: 'kinetic', 'kinetic text': 'kinetic', 'text animation': 'kinetic', 'animated text': 'kinetic', 'word by word': 'kinetic',
  flat: 'flat-vector', vector: 'flat-vector', 'flat design': 'flat-vector', 'flat vector': 'flat-vector', 'flat illustration': 'flat-vector', corporate: 'flat-vector', 'motion graphics': 'flat-vector',
});

export const styleOf = (art) => STYLES[art?.style] || STYLES['line-art'];

/** Theme tokens for the compiler (same shape as THEME_PRESETS entries). */
export function styleTheme(art, v) {
  const s = styleOf(art);
  const t = { ...(art?.theme === 'dark' && s.dark ? s.dark : s.theme) };
  // Per-video variety (variety.mjs): another accent pair from the style's own set.
  if (v?.accent) { t.accent = v.accent[0]; t.accent2 = v.accent[1]; }
  return t;
}

/** Stickman drawing options for stick.mjs. */
export function stickOptions(art, v) {
  const s = styleOf(art), t = styleTheme(art, v);
  return { head: s.head, lw: s.lw, wobble: s.wobble, ink: s.ink || t.ink, limb: s.limb, paper: t.bg, accent: t.accent, gloves: !!s.gloves, shirt: s.shirt };
}

const UNDERLINE = (c) => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 10' preserveAspectRatio='none'><path d='M2 6 Q25 2 50 5 T98 4' stroke='${c}' stroke-width='3' fill='none' stroke-linecap='round'/></svg>`)}")`;

/** CSS for the whole video in this style (added after the template CSS). */
export function styleCss(art, v) {
  const s = styleOf(art), t = styleTheme(art, v), id = art?.style in STYLES ? art.style : 'line-art';
  const dark = art?.theme === 'dark' && s.dark;
  const sel = `#stage.st-${id}`;
  const cap = {
    ink: `${sel} .cap span{background:none;box-shadow:none;color:${t.ink};font-family:var(--body);font-weight:700}`,
    'box-light': `${sel} .cap span{background:#ffffffe6;color:${t.ink};box-shadow:0 calc(var(--u)*.4) calc(var(--u)*1.6) #0002}`,
    tv: `${sel} .cap span{background:none;box-shadow:none;color:#fff;font-family:"Poppins",var(--body);font-weight:700;text-transform:uppercase;letter-spacing:.03em;text-shadow:0 0 calc(var(--u)*.8) #fff6}`,
    paper: `${sel} .cap span{background:#f6efdd;color:#2a2622;box-shadow:0 calc(var(--u)*.3) calc(var(--u)*1.2) #0002;font-family:var(--body)}`,
    box: `${sel} .cap span{font-family:var(--body)}`,
    chalk: `${sel} .cap span{background:#1b2a22e6;color:#f2efe6;box-shadow:none;border:calc(var(--u)*.25) solid #f2efe655;font-family:var(--body)}`,
    none: `${sel} .cap{display:none !important}`,
  }[s.caption] || '';
  return `
:root{--display:${s.font.display},Georgia,serif;--body:${s.font.body},system-ui,sans-serif}
${sel}{background:${dark ? s.stageDark : (v?.ground || s.stage)} !important;color:var(--ink)}
${sel} .amb,${sel} .blob,${sel} .star{display:none !important}
${s.scanlines ? `${sel}::after{content:"";position:absolute;inset:0;z-index:8;pointer-events:none;background:repeating-linear-gradient(0deg,#ffffff07 0 1px,transparent 1px 3px),radial-gradient(120% 100% at 50% 50%,transparent 60%,#000a 100%)}` : ''}
${s.vignette ? `${sel} .st-scene::after{content:"";position:absolute;inset:0;background:radial-gradient(110% 90% at 50% 45%,transparent 55%,#000c 100%)}` : ''}
${s.upper ? `${sel} .headline,${sel} .kicker{text-transform:uppercase;letter-spacing:.02em}` : ''}
${sel} .chr.st-head-glow{filter:drop-shadow(0 0 calc(var(--u)*.7) #ffffff55)}
${s.underline ? `${sel} .headline mark,${sel} .stext mark{background:${UNDERLINE(t.accent)} no-repeat 0 92%/0% .32em;color:${t.accent};animation:st-ul .55s cubic-bezier(.3,.7,.3,1) forwards;animation-delay:calc(var(--d,0s) + .55s)}
@keyframes st-ul{to{background-size:100% .32em}}` : `${sel} .headline mark{background:none;color:var(--accent)}`}
${cap}
${sel} .st-bg{position:absolute;inset:0}
${sel} .st-ground{position:absolute;left:4%;right:4%;bottom:calc(var(--ground) - var(--u)*0.6);height:calc(var(--u)*2.2);z-index:1}
${s.floorGrid ? `${sel} .st-bg{background:repeating-linear-gradient(90deg,#d9e1ea 0 1px,transparent 1px calc(var(--u)*8)) 0 62%/100% 38% no-repeat}` : ''}
${sel} .st-scene{position:absolute;inset:0;${s.filter ? `filter:${s.filter};` : ''}}
${sel} .st-tint{position:absolute;inset:0;pointer-events:none;${s.tint || 'display:none'}}
${sel} .bubble{font-family:var(--body)}
${extraCss(id, s, t, sel, v)}
${s.kind === 'paper' ? `${sel} .st-story .storytitle .headline{color:var(--ink);text-shadow:none}
${sel} .st-story .storytitle .headline mark{color:var(--accent)}
${sel} .st-story .storytext{background:none;box-shadow:none;color:var(--ink)}
${sel} .st-story .stext{font-weight:700}` : ''}
`;
}

/** Background of a story scene in this style. */
export function sceneBackdrop(art, sc) {
  const s = styleOf(art), t = styleTheme(art);
  if (s.kind === 'scene') {
    const place = sc.background || s.defaultPlace || 'meadow', time = sc.time || s.defaultTime || 'day';
    return `<div class="st-scene">${backgroundHtml(place, time)}<div class="st-tint"></div></div>`;
  }
  // Paper: a hand-drawn ground line under the figures.
  const c = s.limb || t.ink;
  return `<div class="st-bg"></div><svg class="st-ground" viewBox="0 0 1000 20" preserveAspectRatio="none"><path d="M0 11 Q120 7 250 10 T520 9 T780 11 T1000 9" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".55"/></svg>`;
}

const CHALK_NOISE = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .09 0'/></filter><rect width='240' height='240' filter='url(#n)'/></svg>")}")`;

const GRAIN = `url("data:image/svg+xml,${encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='g'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .14 0'/></filter><rect width='200' height='200' filter='url(#g)'/></svg>")}")`;

/** CSS that only some styles need: board backdrops, draw-on, kinetic words, flat decoration. */
function extraCss(id, s, t, sel, v) {
  const out = [];
  if (s.draw) {
    // Draw-on styles: the runtime reveals each block as the hand draws it, so the usual entrances are off.
    out.push(`${sel} .a-up,${sel} .a-pop,${sel} .a-rise,${sel} .chwrap,${sel} .st-prop{animation:none !important}`);
    out.push(`${sel} .chwrap .floaty,${sel} .chwrap .chflip{animation:none}`);
    out.push(`${sel} .wb-hand{position:absolute;z-index:7;width:calc(var(--u)*13);pointer-events:none;transform-origin:4% 6%;display:none;filter:drop-shadow(calc(var(--u)*.4) calc(var(--u)*.8) calc(var(--u)*.8) #0003)}`);
    out.push(`${sel} .frame{box-shadow:none;border:calc(var(--u)*.35) solid var(--ink)}`);
    if (v?.backdrop === 'grid') out.push(`${sel} .wb-board{position:absolute;inset:0;background:linear-gradient(#1b6fd80d 1px,transparent 1px) 0 0/calc(var(--u)*5) calc(var(--u)*5),linear-gradient(90deg,#1b6fd80d 1px,transparent 1px) 0 0/calc(var(--u)*5) calc(var(--u)*5)}`);
    if (v?.backdrop === 'dots') out.push(`${sel} .wb-board{position:absolute;inset:0;background:radial-gradient(#00000014 1px,transparent 1.4px) 0 0/calc(var(--u)*3.4) calc(var(--u)*3.4)}`);
    if (v?.backdrop === 'frame') out.push(`${sel} .wb-board{position:absolute;inset:calc(var(--u)*1.2);border:calc(var(--u)*1.6) solid #6b4a2b;border-radius:calc(var(--u)*.8);box-shadow:inset 0 0 calc(var(--u)*4) #0006}`);
    if (s.draw === 'chalk') {
      out.push(`${sel}::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;background:${CHALK_NOISE};opacity:.9}`);
      out.push(`${sel} .headline,${sel} .subline,${sel} .item,${sel} .stext,${sel} .kicker,${sel} .fmt-text{text-shadow:0 0 calc(var(--u)*.25) #ffffff55}`);
      out.push(`${sel} .chip,${sel} .tag,${sel} .badge{background:none;border:calc(var(--u)*.25) solid currentColor}`);
    }
  }
  if (s.kinetic) {
    out.push(`${sel} .amb{display:none}`);
    out.push(`${sel} .kt{position:absolute;inset:0}`);
    out.push(`${sel} .kt-label{position:absolute;left:0;right:0;top:max(calc(var(--u)*7),calc(var(--st,0px) + var(--u)*4));text-align:center;font:600 calc(var(--u)*2.6) var(--body);letter-spacing:.14em;text-transform:uppercase;color:var(--muted);opacity:.9}`);
    out.push(`${sel} .kt-beat{position:absolute;left:8%;right:8%;top:22%;bottom:22%;display:flex;align-items:center;justify-content:center;text-align:center;opacity:0}`);
    out.push(`${sel} .kt-word{font-family:var(--display);font-weight:800;line-height:1.02;letter-spacing:-.01em;color:var(--ink);text-wrap:balance;width:100%}`);
    out.push(`${sel} .kt-word mark{background:none;color:var(--accent)}`);
    out.push(`${sel} .kt-beat.kt-hot .kt-word{color:var(--accent)}`);
    out.push(`${sel} .kt-beat{animation:var(--kin) .34s cubic-bezier(.2,.9,.2,1) var(--d) both,kt-out .16s ease var(--o) forwards}`);
    out.push(`${sel} .kt-bar{position:absolute;left:50%;bottom:20%;width:calc(var(--u)*10);height:calc(var(--u)*.8);margin-left:calc(var(--u)*-5);background:var(--accent);border-radius:9px;transform-origin:left;animation:kt-bar .5s cubic-bezier(.2,.9,.2,1) .1s both}`);
    out.push('@keyframes kt-slam{from{opacity:0;transform:scale(1.7)}to{opacity:1;transform:none}}');
    out.push('@keyframes kt-left{from{opacity:0;transform:translateX(-14%)}to{opacity:1;transform:none}}');
    out.push('@keyframes kt-rise{from{opacity:0;transform:translateY(18%)}to{opacity:1;transform:none}}');
    out.push('@keyframes kt-drop{from{opacity:0;transform:translateY(-22%) rotate(-3deg)}to{opacity:1;transform:none}}');
    out.push('@keyframes kt-zoom{from{opacity:0;transform:scale(.55)}to{opacity:1;transform:none}}');
    out.push('@keyframes kt-out{to{opacity:0}}');
    out.push('@keyframes kt-bar{from{transform:scaleX(0)}}');
  }
  if (s.docu) {
    out.push(`${sel} .amb{display:none}`);
    // Film grain (moves every frame step) and a vignette, over everything but the captions.
    out.push(`${sel}::before{content:"";position:absolute;inset:-20%;z-index:6;pointer-events:none;background:${GRAIN};opacity:.5;animation:docu-grain .5s steps(4) infinite}`);
    out.push(`${sel}::after{content:"";position:absolute;inset:0;z-index:6;pointer-events:none;background:radial-gradient(115% 95% at 50% 45%,transparent 50%,#000b 100%)}`);
    out.push(`${sel} .headline{font-weight:400;letter-spacing:.005em}`);
    out.push(`${sel} .kicker{text-transform:uppercase;letter-spacing:.22em;font-weight:600;color:var(--accent);display:flex;align-items:center;gap:.8em}`);
    out.push(`${sel}.lang-deva .kicker{letter-spacing:.02em}`); // wide spacing breaks up Devanagari words
    out.push(`${sel} .kicker::before{content:"";width:2.2em;height:.12em;background:currentColor;flex:none}`);
    out.push(`${sel} .frame{box-shadow:0 calc(var(--u)*2) calc(var(--u)*6) #000a;border-radius:calc(var(--u)*.4)}`);
    out.push(`${sel} .frame img,${sel} .nw-img{animation:docu-push var(--sd,8s) linear both;filter:sepia(.18) contrast(1.06) saturate(.85)}`);
    out.push(`${sel} .chip,${sel} .tag,${sel} .badge{background:none;border:calc(var(--u)*.2) solid color-mix(in srgb,var(--ink) 40%,transparent)}`);
    out.push(`${sel} .mp-text{background:linear-gradient(90deg,#0f0e0ce6,#0f0e0c99);backdrop-filter:none}`);
    out.push('@keyframes docu-grain{0%{transform:translate(0,0)}25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-2%,-1%)}}');
    out.push('@keyframes docu-push{from{transform:scale(1.02)}to{transform:scale(1.1)}}');
  }
  if (s.flat) {
    out.push(`${sel} .amb{display:none}`);
    out.push(`${sel} .frame{box-shadow:none;border-radius:calc(var(--u)*1.2);border:calc(var(--u)*.3) solid var(--ink)}`);
    out.push(`${sel} .chip,${sel} .tag,${sel} .badge,${sel} .button{box-shadow:none !important;background-image:none !important}`);
    out.push(`${sel} .fv-decor{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}`);
    out.push(`${sel} .fv-decor i{position:absolute;display:block;animation:fv-in .9s cubic-bezier(.2,.8,.2,1) both}`);
    out.push(`${sel} .scene .in{z-index:1}`);
    out.push(`${sel} .t-story .bgwrap,${sel} .t-story .bg{filter:saturate(1.15) contrast(1.02)}`);
    out.push('@keyframes fv-in{from{opacity:0;transform:scale(.6)}}');
  }
  return out.join('\n');
}
