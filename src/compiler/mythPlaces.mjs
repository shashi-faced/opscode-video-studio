// Places of the old Indian stories (plan 19 P2), and divine light. Same 1600×1600 canvas as
// backgrounds.mjs (bottom-centre crop; ground on y = 1420; keep key art in x 350–1250, y ≥ 700).
//
// Two skins: "madhubani" (Mithila painting: paper ground, flat colours, double black outlines,
// pattern fills, a sun with a face) and "flat" (the same places, plain fills and a single
// outline, for the other 2D styles). In the madhubani style the everyday places (meadow, forest,
// village, home…) are drawn here too, so the whole video keeps one look.
import { MADHU as C, patterns, makeShape, line } from './myth.mjs';

const ART = 1600, G = 1420;
const f0 = (n) => Math.round(n);
const rnd = (k, n) => ((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;

// New places any 2D style can use.
export const MYTH_PLACES = ['ashram', 'palace', 'ghat', 'kailash', 'cosmos', 'temple', 'battlefield', 'lanka'];
export const MYTH_PLACE_ALIASES = {
  hermitage: 'ashram', aashram: 'ashram', 'rishi-ashram': 'ashram', tapovan: 'ashram', 'forest-ashram': 'ashram', gurukul: 'ashram', yajna: 'ashram', yagya: 'ashram', havan: 'ashram',
  'royal-court': 'palace', court: 'palace', darbar: 'palace', durbar: 'palace', mahal: 'palace', rajmahal: 'palace', ayodhya: 'palace', hastinapur: 'palace', indrapastha: 'palace', 'king-court': 'palace', throne: 'palace', 'throne-room': 'palace', kingdom: 'palace', fort: 'palace', castle: 'palace',
  ganga: 'ghat', 'ganga-ghat': 'ghat', sarayu: 'ghat', yamuna: 'ghat', 'river-ghat': 'ghat', riverbank: 'ghat', 'river-bank': 'ghat', 'holy-river': 'ghat', kashi: 'ghat', varanasi: 'ghat',
  'mount-kailash': 'kailash', kailasa: 'kailash', himalaya: 'kailash', himalayas: 'kailash',
  cosmos: 'cosmos', universe: 'cosmos', brahmand: 'cosmos', 'shani-lok': 'cosmos', shanilok: 'cosmos', swarg: 'cosmos', swarga: 'cosmos', devlok: 'cosmos', vaikunth: 'cosmos', 'planets-sky': 'cosmos',
  mandir: 'temple', shivling: 'temple', shivalaya: 'temple', shrine: 'temple',
  kurukshetra: 'battlefield', yuddh: 'battlefield', war: 'battlefield', battle: 'battlefield', 'war-field': 'battlefield', 'battle-field': 'battlefield', ranbhoomi: 'battlefield',
  'sone-ki-lanka': 'lanka', 'golden-lanka': 'lanka', 'golden-city': 'lanka',
  // Hindi
  'आश्रम': 'ashram', 'महल': 'palace', 'दरबार': 'palace', 'घाट': 'ghat', 'गंगा': 'ghat', 'कैलाश': 'kailash', 'ब्रह्मांड': 'cosmos', 'स्वर्ग': 'cosmos', 'मंदिर': 'temple', 'कुरुक्षेत्र': 'battlefield', 'युद्ध': 'battlefield', 'लंका': 'lanka',
};

const SKY = {
  madhubani: { day: ['#f4e6c6', '#f4e6c6'], sunset: ['#f6c27a', '#f4e0b4'], night: ['#1f2b57', '#2e3f78'] },
  flat: { day: ['#7cc8f2', '#d4effb'], sunset: ['#f48a5a', '#ffd39b'], night: ['#0f1c44', '#2c3f7a'] },
};
const GROUND = { madhubani: { day: '#9cc66b', sunset: '#b5a55a', night: '#3d5a3c' }, flat: { day: '#7cc35a', sunset: '#8e9a4c', night: '#2a4a3a' } };

let uidN = 0;

/** A drawing kit for one background (one id, one skin, one time). */
function kit(skin, time) {
  const u = `mp${uidN++}`;
  const m = skin === 'madhubani';
  const ink = C.ink;
  const sh = makeShape(u, ink, skin);
  const S = (d, fill, pat, lw = 2.6) => sh(d, fill, m ? pat : null, { lw });
  const night = time === 'night';
  const dim = (c) => night ? `color-mix(in srgb, ${c} 55%, #1a2350)` : c;

  const sky = () => `<rect width="${ART}" height="${ART}" fill="url(#${u}sky)"/>`;
  const defs = `${patterns(u, ink, 3.2)}<defs><linearGradient id="${u}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${SKY[skin][time][0]}"/><stop offset="1" stop-color="${SKY[skin][time][1]}"/></linearGradient>
<radialGradient id="${u}glow"><stop offset="0" stop-color="#fff3b0"/><stop offset=".4" stop-color="#ffd25a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd25a" stop-opacity="0"/></radialGradient></defs>`;

  // Sun with a face (a Mithila favourite), or the moon with one at night.
  const sun = (x, y, r = 92) => {
    if (night) {
      return `<circle cx="${x}" cy="${y}" r="${r * 1.9}" fill="url(#${u}glow)" opacity=".35"/>${S(`M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y} Z`, '#fbf1cf', 'dots', 2)}`
        + (m ? `<path d="M${x - 40} ${y - 14} q16 -14 32 0 q-16 10 -32 0 Z" fill="#fff" stroke="${ink}" stroke-width="4"/><circle cx="${x - 20}" cy="${y - 14}" r="7" fill="${ink}"/>${line(`M${x - 22} ${y + 34} q22 16 44 0`, ink, 5)}` : '');
    }
    const rays = Array.from({ length: 16 }, (_, k) => {
      const a = (k / 16) * Math.PI * 2, a1 = a - 0.11, a2 = a + 0.11, R = r * 1.55;
      return `M${f0(x + Math.cos(a1) * r * 1.02)} ${f0(y + Math.sin(a1) * r * 1.02)} L${f0(x + Math.cos(a) * R)} ${f0(y + Math.sin(a) * R)} L${f0(x + Math.cos(a2) * r * 1.02)} ${f0(y + Math.sin(a2) * r * 1.02)} Z`;
    }).join(' ');
    const face = m ? `<path d="M${x - 50} ${y - 16} q20 -20 40 0 q-20 13 -40 0 Z M${x + 10} ${y - 16} q20 -20 40 0 q-20 13 -40 0 Z" fill="#fff" stroke="${ink}" stroke-width="4"/><circle cx="${x - 28}" cy="${y - 17}" r="7.5" fill="${ink}"/><circle cx="${x + 32}" cy="${y - 17}" r="7.5" fill="${ink}"/>${line(`M${x} ${y - 6} L${x - 6} ${y + 18} L${x + 6} ${y + 18}`, ink, 4)}${line(`M${x - 30} ${y + 38} q30 22 60 0`, C.red, 7)}` : '';
    return `<g class="mpl-spin" style="transform-origin:${x}px ${y}px"><path d="${rays}" fill="${time === 'sunset' ? C.vermilion : C.red}" stroke="${m ? ink : 'none'}" stroke-width="4"/></g>${S(`M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y} Z`, time === 'sunset' ? C.saffron : C.yellow, 'dots', 2)}${face}`;
  };
  const stars = (n = 40, yMax = 1150) => night ? `<g class="bg-stars">${Array.from({ length: n }, (_, k) => {
    const x = f0(rnd(k, 1) * ART), y = f0(rnd(k, 2) * yMax), s = 8 + rnd(k, 3) * 10;
    return `<path d="M${x} ${f0(y - s)} L${f0(x + s * 0.3)} ${f0(y - s * 0.3)} L${f0(x + s)} ${y} L${f0(x + s * 0.3)} ${f0(y + s * 0.3)} L${x} ${f0(y + s)} L${f0(x - s * 0.3)} ${f0(y + s * 0.3)} L${f0(x - s)} ${y} L${f0(x - s * 0.3)} ${f0(y - s * 0.3)} Z" fill="#fff6c8" style="animation-delay:-${(rnd(k, 4) * 3).toFixed(2)}s"/>`;
  }).join('')}</g>` : '';
  // Birds in flight: the Madhubani bird, a patterned body with a fan tail.
  const bird = (x, y, s = 1, c = C.green, k = 0) => `<g class="bg-cloud" style="animation-duration:${(18 + rnd(k, 5) * 10).toFixed(1)}s;animation-delay:-${(rnd(k, 6) * 10).toFixed(1)}s"><g transform="translate(${x} ${y}) scale(${s})">${S('M-40 0 C-30 -22 20 -24 36 -6 L58 -10 L44 2 C30 20 -26 20 -40 0 Z', c, 'scale', 2)}${S('M-38 0 L-74 -22 L-66 0 L-74 22 Z', C.red, 'stripes', 1.6)}${S('M-6 -12 C0 -46 24 -52 30 -40 C20 -34 12 -24 8 -12 Z', C.yellow, 'stripes', 1.4)}<circle cx="34" cy="-8" r="4" fill="${ink}"/></g></g>`;
  const cloud = (x, y, s = 1, k = 0) => `<g class="bg-cloud" style="animation-duration:${(30 + rnd(k, 5) * 14).toFixed(1)}s;animation-delay:-${(rnd(k, 6) * 20).toFixed(1)}s"><g transform="translate(${x} ${y}) scale(${s})">${S('M-110 30 C-130 -10 -80 -40 -50 -24 C-40 -66 30 -70 44 -30 C80 -50 130 -20 110 30 Z', night ? '#5b6aa3' : '#ffffff', 'wave', 1.8)}</g></g>`;
  // Ground: a band with stripes and grass, the line where everyone stands.
  const ground = (c = GROUND[skin][time], top = G - 30) => `${S(`M0 ${top} Q400 ${top - 26} 800 ${top} T1600 ${top} V1600 H0 Z`, c, 'stripes', 2.4)}${m ? Array.from({ length: 34 }, (_, k) => line(`M${f0(rnd(k, 9) * ART)} ${f0(top + 30 + rnd(k, 10) * 140)} l10 -28 l8 24 l10 -32`, C.green, 6)).join('') : ''}`;
  // Tree: a hatched trunk and a crown of veined leaves with red fruit (Madhubani's tree of life).
  const tree = (x, y, s = 1, k = 0) => {
    const leaves = Array.from({ length: 14 }, (_, j) => {
      const a = (j / 14) * Math.PI * 2, r = 110 + (j % 2) * 34, lx = Math.cos(a) * r, ly = -280 + Math.sin(a) * r * 0.8;
      return `<g transform="translate(${f0(lx)} ${f0(ly)}) rotate(${f0(a * 57.3 + 90)})">${S('M0 -48 C26 -24 26 24 0 48 C-26 24 -26 -24 0 -48 Z', j % 3 === 0 ? C.leaf : C.green, null, 1.6)}${m ? line('M0 -42 V42 M0 -20 L12 -30 M0 0 L-12 -10 M0 20 L12 10', ink, 3) : ''}</g>`;
    }).join('');
    const fruit = m ? Array.from({ length: 6 }, (_, j) => `<circle cx="${f0(Math.cos(j) * 70)}" cy="${f0(-280 + Math.sin(j * 1.7) * 60)}" r="13" fill="${C.red}" stroke="${ink}" stroke-width="4"/>`).join('') : '';
    return `<g transform="translate(${x} ${y}) scale(${s})">${S('M-34 0 C-24 -80 -26 -160 -14 -240 L14 -240 C26 -160 24 -80 34 0 Z', C.brown, 'hatch', 2.4)}<g class="bg-sway" style="animation-delay:-${(k * 0.7).toFixed(1)}s">${S('M0 -280 m-150 0 a150 120 0 1 0 300 0 a150 120 0 1 0 -300 0', dim(C.leaf), 'leaf', 2.4)}${leaves}${fruit}</g></g>`;
  };
  const hut = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${S('M-150 0 V-170 H150 V0 Z', '#e8b86a', 'dots', 2.4)}${S('M-190 -160 L0 -330 L190 -160 Z', C.brown, 'hatch', 2.6)}${S('M-44 0 V-90 A44 44 0 0 1 44 -90 V0 Z', night ? '#f5b042' : C.ink, null, 2)}${m ? line('M-150 -40 H150 M-150 -130 H150', C.red, 8) : ''}${S('M80 -120 h44 v44 h-44 Z', night ? '#f5b042' : C.indigo, null, 1.6)}</g>`;
  const mountain = (x, w, h, snow = true, c = '#8a7a9e') => `${S(`M${x - w / 2} ${G - 80} L${x} ${G - 80 - h} L${x + w / 2} ${G - 80} Z`, dim(c), 'chev', 2.6)}${snow ? S(`M${x - w * 0.16} ${G - 80 - h * 0.68} L${x} ${G - 80 - h} L${x + w * 0.16} ${G - 80 - h * 0.68} L${x + w * 0.08} ${G - 80 - h * 0.74} L${x} ${G - 80 - h * 0.64} L${x - w * 0.08} ${G - 80 - h * 0.74} Z`, '#ffffff', null, 2) : ''}`;
  // Temple: shikhara tower with bands, amalaka, kalash and a flag that flutters.
  const temple = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${S('M-210 0 V-50 H210 V0 Z', '#d9c6a0', 'chev', 2.4)}${S('M-150 -50 V-250 H150 V-50 Z', '#f0d9a8', 'dots', 2.4)}${S('M-120 -250 C-120 -420 -60 -540 0 -580 C60 -540 120 -420 120 -250 Z', C.vermilion, 'stripes', 2.6)}${m ? line('M-114 -300 H114 M-104 -360 H104 M-88 -420 H88 M-64 -480 H64', ink, 5) : ''}${S('M-40 -585 a40 18 0 1 0 80 0 a40 18 0 1 0 -80 0', C.yellow, 'stripes', 1.8)}${S('M-16 -600 C-26 -630 26 -630 16 -600 Z', C.gold, null, 1.6)}${line('M0 -630 V-720', ink, 6)}<g class="bg-sway" style="transform-origin:0 -720px">${S('M0 -720 L110 -700 L0 -660 Z', C.saffron, 'stripes', 1.8)}</g>${S('M-60 -50 V-170 A60 60 0 0 1 60 -170 V-50 Z', '#3a2418', null, 2)}<path d="M-6 -150 h12 v22 a10 10 0 0 1 -12 0 Z" fill="${C.gold}"/></g>`;
  const shivling = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${S('M-130 0 C-130 -40 130 -40 130 0 L170 -14 L130 -30 C110 -52 -110 -52 -130 -30 Z', '#4a4f5c', 'stripes', 2.2)}${S('M-56 -40 V-140 A56 60 0 0 1 56 -140 V-40 Z', '#2f3440', null, 2.2)}${line('M-40 -150 H40 M-40 -136 H40 M-40 -122 H40', '#e8e8e8', 6)}<circle cx="0" cy="-104" r="10" fill="${C.red}"/>${S('M-72 -160 c10 -30 40 -30 50 -10 c10 -26 50 -24 50 10', C.yellow, 'dots', 1.4)}</g>`;
  const diya = (x, y, s = 1, k = 0) => `<g transform="translate(${x} ${y}) scale(${s})">${S('M-46 0 C-40 30 40 30 46 0 Z', C.ochre, 'dots', 1.6)}<g class="bg-flame" style="animation-delay:-${(k * 0.17).toFixed(2)}s">${S('M0 -6 C-18 -26 -6 -50 0 -64 C6 -50 18 -26 0 -6 Z', C.saffron, null, 1.4)}<path d="M0 -12 C-6 -22 -2 -34 0 -40 C2 -34 6 -22 0 -12 Z" fill="${C.yellow}"/></g></g>`;
  const lotus = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${S('M0 0 C-30 -10 -40 -50 -20 -70 C-10 -40 0 -20 0 0 Z M0 0 C30 -10 40 -50 20 -70 C10 -40 0 -20 0 0 Z M0 0 C-12 -30 -8 -70 0 -86 C8 -70 12 -30 0 0 Z', C.pink, 'stripes', 1.4)}${S('M-60 8 C-30 -6 30 -6 60 8 C30 18 -30 18 -60 8 Z', C.green, null, 1.4)}</g>`;
  const fish = (x, y, s = 1, c = C.vermilion, k = 0) => `<g class="bg-fish" style="animation-duration:${(7 + rnd(k, 3) * 5).toFixed(1)}s;animation-delay:-${(rnd(k, 4) * 6).toFixed(1)}s"><g transform="translate(${x} ${y}) scale(${s})">${S('M-60 0 C-30 -40 40 -40 60 0 C40 40 -30 40 -60 0 Z', c, 'scale', 1.8)}${S('M-58 0 L-96 -26 L-88 0 L-96 26 Z', C.yellow, 'stripes', 1.4)}<circle cx="34" cy="-6" r="7" fill="#fff" stroke="${ink}" stroke-width="3"/><circle cx="36" cy="-6" r="3.4" fill="${ink}"/></g></g>`;
  const water = (top, c = '#4f86c6') => `${S(`M0 ${top} Q400 ${top - 20} 800 ${top} T1600 ${top} V1600 H0 Z`, dim(c), 'wave', 2.4)}<g class="bg-waves">${Array.from({ length: 5 }, (_, k) => line(`M${-100 + k * 60} ${top + 40 + k * 46} q60 -26 120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0 t120 0`, '#cfe6ff', 5)).join('')}</g>`;
  const fire = (x, y, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${S('M-110 0 L-90 -70 H90 L110 0 Z', '#b0763a', 'band', 2.2)}<g class="bg-flame">${S('M-70 -70 C-90 -130 -40 -170 -30 -230 C-10 -180 10 -170 0 -260 C40 -200 70 -170 50 -110 C80 -130 80 -100 70 -70 Z', C.saffron, null, 2)}${S('M-40 -70 C-50 -110 -20 -140 -10 -180 C10 -140 30 -120 20 -90 C40 -100 40 -84 36 -70 Z', C.yellow, null, 1.4)}</g><g class="mpl-smoke">${[0, 1, 2].map((k) => `<circle cx="${-20 + k * 24}" cy="${-290 - k * 70}" r="${36 + k * 12}" fill="#d8d2c6" opacity=".55" style="animation-delay:-${k * 1.3}s"/>`).join('')}</g></g>`;
  const pillar = (x, y, h, s = 1) => `<g transform="translate(${x} ${y}) scale(${s})">${S(`M-30 0 V${-h} H30 V0 Z`, '#f0d9a8', 'stripes', 2.2)}${S(`M-46 ${-h} H46 V${-h - 30} H-46 Z`, C.gold, 'dots', 2)}${S('M-46 0 H46 V-26 H-46 Z', C.gold, 'dots', 2)}</g>`;
  const dome = (x, y, w, c = C.gold) => `${S(`M${x - w} ${y} C${x - w} ${y - w * 1.1} ${x - w * 0.2} ${y - w * 1.2} ${x} ${y - w * 1.7} C${x + w * 0.2} ${y - w * 1.2} ${x + w} ${y - w * 1.1} ${x + w} ${y} Z`, c, 'scale', 2.4)}${line(`M${x} ${y - w * 1.7} V${y - w * 2.1}`, C.ink, 5)}<circle cx="${x}" cy="${y - w * 2.15}" r="8" fill="${C.red}"/>`;
  const flag = (x, y, c = C.saffron, k = 0) => `${line(`M${x} ${y} V${y - 160}`, C.ink, 6)}<g class="bg-sway" style="transform-origin:${x}px ${y - 160}px;animation-delay:-${k * 0.4}s">${S(`M${x} ${y - 160} L${x + 90} ${y - 140} L${x} ${y - 110} Z`, c, 'stripes', 1.6)}</g>`;
  const wheel = (x, y, r) => `${S(`M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y} Z`, C.gold, null, 2.2)}${Array.from({ length: 8 }, (_, k) => line(`M${x} ${y} L${f0(x + Math.cos(k * Math.PI / 4) * r * 0.86)} ${f0(y + Math.sin(k * Math.PI / 4) * r * 0.86)}`, C.ink, 5)).join('')}<circle cx="${x}" cy="${y}" r="${r * 0.22}" fill="${C.red}" stroke="${C.ink}" stroke-width="4"/>`;
  const chariot = (x, y, s = 1, c = C.red) => `<g transform="translate(${x} ${y}) scale(${s})">${S('M-150 -60 H140 L170 -170 H-120 Z', c, 'chev', 2.4)}${S('M-150 -60 H140 V-30 H-150 Z', C.gold, 'band', 2)}${wheel(-40, -30, 70)}${flag(120, -170, C.saffron)}</g>`;
  const palaceFront = (x, y, s = 1, c = '#f2d38f') => `<g transform="translate(${x} ${y}) scale(${s})">${S('M-430 0 V-360 H430 V0 Z', c, 'dots', 2.6)}${[-300, -100, 100, 300].map((ax) => S(`M${ax - 70} 0 V-180 C${ax - 70} -260 ${ax + 70} -260 ${ax + 70} -180 V0 Z`, night ? '#3a2a50' : '#7a3b2a', null, 2.2)).join('')}${S('M-460 -360 H460 V-410 H-460 Z', C.red, 'band', 2.4)}${dome(-260, -410, 90)}${dome(0, -410, 140)}${dome(260, -410, 90)}${flag(-430, -410, C.saffron, 1)}${flag(430, -410, C.saffron, 2)}</g>`;

  return { u, m, S, sky, defs, sun, stars, bird, cloud, ground, tree, hut, mountain, temple, shivling, diya, lotus, fish, water, fire, pillar, dome, flag, chariot, palaceFront, night, time, dim };
}

// ── places ──
const PLACE = {
  ashram(k) {
    return `${k.sky()}${k.stars()}${k.sun(1060, 700)}${k.bird(520, 640, 1, C.green, 1)}${k.bird(760, 520, 0.8, C.indigo, 2)}
${k.tree(260, G - 60, 1.3, 1)}${k.tree(1380, G - 50, 1.2, 2)}${k.ground()}${k.hut(560, G - 30, 1)}${k.fire(980, G + 20, 0.9)}${k.lotus(1240, G + 80, 1)}${k.lotus(380, G + 110, 0.8)}`;
  },
  palace(k) {
    return `${k.sky()}${k.stars()}${k.sun(1120, 470, 70)}${k.cloud(520, 500, 1, 1)}${k.palaceFront(800, G - 40, 1.25)}
${k.S(`M0 ${G - 40} H1600 V1600 H0 Z`, k.m ? '#c9744a' : '#c28a5a', 'chev', 2.4)}${k.S(`M560 ${G - 40} H1040 L1120 1600 H480 Z`, C.red, 'flower', 2.2)}${k.pillar(330, G - 40, 520)}${k.pillar(1270, G - 40, 520)}${k.diya(470, G + 30, 1, 1)}${k.diya(1130, G + 30, 1, 2)}`;
  },
  ghat(k) {
    const steps = Array.from({ length: 5 }, (_, j) => k.S(`M${120 + j * 30} ${G - 60 + j * 34} H${1480 - j * 30} V${G - 26 + j * 34} H${120 + j * 30} Z`, j % 2 ? '#d9c6a0' : '#cdb48a', 'stripes', 2)).join('');
    return `${k.sky()}${k.stars()}${k.sun(800, 820, 96)}${k.bird(420, 620, 0.9, C.green, 1)}${k.bird(1150, 680, 0.8, C.red, 3)}
${k.temple(1260, G - 300, 0.7)}${k.tree(330, G - 280, 0.9, 1)}${k.water(G - 300)}${k.fish(560, G - 170, 1, C.vermilion, 1)}${k.fish(1060, G - 120, 0.9, C.yellow, 2)}${k.lotus(820, G - 200, 0.8)}
${steps}${k.diya(500, G + 120, 0.8, 1)}${k.diya(1100, G + 120, 0.8, 2)}`;
  },
  kailash(k) {
    return `${k.sky()}${k.stars(60)}${k.sun(1110, 520, 70)}${k.cloud(500, 600, 1.1, 1)}${k.cloud(1240, 820, 0.9, 2)}
${k.mountain(260, 700, 520, true, '#7b8fb5')}${k.mountain(1360, 720, 560, true, '#7b8fb5')}${k.mountain(800, 980, 860, true, '#9aa9cc')}${k.ground(k.m ? '#b7c7d9' : '#cfdbe8')}${k.S(`M560 ${G + 40} a240 40 0 1 0 480 0 a240 40 0 1 0 -480 0`, '#6fa3d6', 'wave', 2)}`;
  },
  cosmos(k) {
    let x = 0, y = 0, r = 0;
    const ring = (half) => `<path d="M${x - r * 1.9} ${y} A${r * 1.9} ${r * 0.42} 0 0 ${half} ${x + r * 1.9} ${y}" fill="none" stroke="${C.ink}" stroke-width="30"/><path d="M${x - r * 1.9} ${y} A${r * 1.9} ${r * 0.42} 0 0 ${half} ${x + r * 1.9} ${y}" fill="none" stroke="${C.gold}" stroke-width="22"/>`;
    const sat = (x0, y0, r0, c) => { x = x0; y = y0; r = r0; return `${ring(1)}${k.S(`M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y} Z`, c, 'stripes', 2.4)}${ring(0)}`; };
    const planet = (x, y, r, c, p = 'dots') => k.S(`M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y} Z`, c, p, 2.2);
    const sky = `<rect width="1600" height="1600" fill="${k.m ? '#22205a' : '#140f3a'}"/><rect width="1600" height="1600" fill="url(#cosg)"/><defs><radialGradient id="cosg" cx=".5" cy=".6" r=".7"><stop offset="0" stop-color="#7a4ab8" stop-opacity=".7"/><stop offset="1" stop-color="#7a4ab8" stop-opacity="0"/></radialGradient></defs>`;
    const stars = `<g class="bg-stars">${Array.from({ length: 70 }, (_, j) => `<circle cx="${f0(rnd(j, 1) * ART)}" cy="${f0(rnd(j, 2) * 1500)}" r="${(3 + rnd(j, 3) * 6).toFixed(1)}" fill="#fff6c8" style="animation-delay:-${(rnd(j, 4) * 3).toFixed(2)}s"/>`).join('')}</g>`;
    return `${sky}${stars}<g class="mpl-float">${sat(1120, 820, 120, '#4a5fb5')}</g>${planet(420, 700, 70, C.vermilion, 'chev')}${planet(1300, 1180, 50, C.leaf, 'dots')}${planet(560, 1120, 36, C.yellow, 'stripes')}
${k.S(`M300 ${G} C500 ${G - 70} 1100 ${G - 70} 1300 ${G} C1100 ${G + 60} 500 ${G + 60} 300 ${G} Z`, '#f2e4ff', 'wave', 2.2)}`;
  },
  temple(k) {
    return `${k.sky()}${k.stars()}${k.sun(520, 640, 76)}${k.bird(1240, 640, 0.9, C.green, 2)}${k.tree(1380, G - 40, 1, 2)}${k.temple(800, G - 40, 1.1)}${k.ground(k.m ? '#d9b680' : '#cfae7a')}
${k.shivling(800, G + 90, 0.9)}${k.diya(560, G + 70, 0.9, 1)}${k.diya(1040, G + 70, 0.9, 2)}${k.lotus(380, G + 120, 0.8)}`;
  },
  battlefield(k) {
    const dust = `<g class="bg-cloud" style="animation-duration:40s">${[200, 600, 1000, 1400].map((x, j) => `<ellipse cx="${x}" cy="${G - 120 - j * 8}" rx="260" ry="60" fill="#e0b47a" opacity=".45"/>`).join('')}</g>`;
    return `${k.sky()}${k.stars()}${k.sun(800, 640, 100)}${k.mountain(260, 900, 360, false, '#b07a5a')}${k.mountain(1340, 900, 400, false, '#b07a5a')}${dust}
${k.ground(k.m ? '#c9a46a' : '#b8925a')}${k.chariot(470, G - 10, 0.75, C.red)}${k.chariot(1130, G - 10, 0.75, C.indigo)}${[300, 640, 960, 1300].map((x, j) => k.flag(x, G - 60, j % 2 ? C.indigo : C.saffron, j)).join('')}`;
  },
  lanka(k) {
    return `${k.sky()}${k.stars()}${k.sun(1120, 470, 70)}${k.cloud(500, 520, 1, 1)}
${k.S(`M80 ${G - 260} C300 ${G - 520} 1300 ${G - 520} 1520 ${G - 260} Z`, '#8a6a4a', 'chev', 2.4)}${k.palaceFront(800, G - 360, 0.9, C.gold)}${[300, 1300].map((x) => k.dome(x, G - 340, 70, C.gold)).join('')}
${k.water(G - 230, '#2f6fae')}${k.fish(500, G - 70, 0.9, C.vermilion, 1)}${k.fish(1120, G + 10, 0.8, C.yellow, 2)}`;
  },
  // Madhubani versions of the everyday places.
  meadow(k) { return `${k.sky()}${k.stars()}${k.sun(1180, 760)}${k.bird(440, 620, 1, C.green, 1)}${k.bird(820, 700, 0.8, C.red, 2)}${k.tree(300, G - 40, 1.2, 1)}${k.tree(1340, G - 40, 1.1, 2)}${k.ground()}${k.lotus(620, G + 110, 0.8)}${k.lotus(1000, G + 140, 0.7)}`; },
  forest(k) { return `${k.sky()}${k.stars()}${k.sun(800, 640, 70)}${[160, 470, 800, 1130, 1440].map((x, j) => k.tree(x, G - 120 + (j % 2) * 40, 1.1 + (j % 2) * 0.2, j)).join('')}${k.ground(k.m ? '#6f9a4a' : '#5f9a44')}${k.bird(640, 700, 0.8, C.yellow, 3)}`; },
  village(k) { return `${k.sky()}${k.stars()}${k.sun(1250, 640, 80)}${k.tree(200, G - 40, 1, 1)}${k.hut(560, G - 40, 0.95)}${k.hut(1060, G - 60, 0.8)}${k.tree(1420, G - 40, 0.9, 2)}${k.ground()}${k.bird(800, 640, 0.8, C.green, 2)}`; },
  mountains(k) { return PLACE.kailash(k); },
  sky(k) { return `${k.sky()}${k.stars()}${k.sun(800, 760, 110)}${k.cloud(380, 640, 1.2, 1)}${k.cloud(1220, 900, 1, 2)}${k.cloud(700, 1250, 1.4, 3)}${k.bird(500, 1000, 1, C.green, 1)}${k.bird(1120, 560, 0.9, C.red, 2)}`; },
  home(k) {
    // Inside a mud house: a painted wall (kohbar-style borders), a window, a shelf with pots, a diya.
    return `${k.S(`M0 0 H1600 V${G} H0 Z`, k.m ? '#efd3a0' : '#f1dcb4', 'dots', 2.4)}${k.S(`M0 ${G - 140} H1600 V${G - 100} H0 Z`, C.red, 'band', 2)}${k.S(`M0 700 H1600 V740 H0 Z`, C.indigo, 'chev', 2)}
${k.S(`M600 860 H1000 V1180 H600 Z`, k.night ? '#22305e' : '#9fd0f0', null, 2.6)}${line('M800 860 V1180 M600 1020 H1000', C.brown, 14)}${k.lotus(380, 1100, 1.1)}${k.lotus(1220, 1100, 1.1)}
${k.S(`M0 ${G} H1600 V1600 H0 Z`, '#b9824e', 'stripes', 2.4)}${k.diya(800, G + 80, 1.1, 1)}`;
  },
};
// The other places, in the Madhubani style, drawn as the nearest one above.
const NEAREST = { beach: 'ghat', underwater: 'ghat', city: 'palace', office: 'palace', classroom: 'ashram', bedroom: 'home', festival: 'temple', space: 'cosmos' };

/** Does this module draw the place (in this skin)? */
export const drawsPlace = (place, skin) => MYTH_PLACES.includes(place) || (skin === 'madhubani' && (place in PLACE || place in NEAREST));

/** Full-bleed background for a place. skin: "madhubani" | "flat". */
export function mythBackgroundHtml(place, time = 'day', skin = 'flat') {
  const t = ['day', 'sunset', 'night'].includes(time) ? time : 'day';
  const k = kit(skin === 'madhubani' ? 'madhubani' : 'flat', t);
  const fn = PLACE[place] || PLACE[NEAREST[place]] || PLACE.meadow;
  const shade = t === 'night' && place !== 'cosmos' ? '<rect width="1600" height="1600" fill="#0a1238" opacity=".22"/>' : t === 'sunset' ? '<rect width="1600" height="1600" fill="#ff7e3f" opacity=".08"/>' : '';
  return `<div class="bg mpl-${skin}"><svg class="bgart" viewBox="0 0 ${ART} ${ART}" preserveAspectRatio="xMidYMax slice">${k.defs}${fn(k)}${shade}</svg></div>`;
}

// ── divine light (any 2D style): scene field "light" ──
export const LIGHTS = ['none', 'divine', 'petals', 'sparkles'];
export function lightHtml(kind) {
  if (!kind || kind === 'none') return '';
  if (kind === 'divine') {
    // Rays from above, slowly turning, and a warm glow where the characters stand.
    const rays = Array.from({ length: 14 }, (_, k) => { const a = -90 + (k - 6.5) * 9; return `<path d="M800 -200 L${f0(800 + Math.cos((a - 2.6) * Math.PI / 180) * 2600)} ${f0(-200 + Math.sin((a - 2.6) * Math.PI / 180) * -2600)} L${f0(800 + Math.cos((a + 2.6) * Math.PI / 180) * 2600)} ${f0(-200 + Math.sin((a + 2.6) * Math.PI / 180) * -2600)} Z" fill="#fff4c0" opacity="${k % 2 ? 0.16 : 0.28}"/>`; }).join('');
    return `<div class="fx fx-divine"><svg viewBox="0 0 1600 1600" preserveAspectRatio="xMidYMax slice"><defs><radialGradient id="fxg"><stop offset="0" stop-color="#fff2b0" stop-opacity=".75"/><stop offset="1" stop-color="#ffd25a" stop-opacity="0"/></radialGradient></defs><g class="fx-rays">${rays}</g><ellipse cx="800" cy="1250" rx="620" ry="420" fill="url(#fxg)"/></svg></div>`;
  }
  if (kind === 'petals') {
    return `<div class="fx fx-petals">${Array.from({ length: 22 }, (_, k) => `<i style="left:${(rnd(k, 1) * 100).toFixed(1)}%;animation-duration:${(5 + rnd(k, 2) * 4).toFixed(2)}s;animation-delay:-${(rnd(k, 3) * 8).toFixed(2)}s;--r:${f0(rnd(k, 4) * 360)}deg;background:${['#e2678f', '#f08a24', '#f2b632', '#ff9fb8'][k % 4]}"></i>`).join('')}</div>`;
  }
  return `<div class="fx fx-sparkles">${Array.from({ length: 30 }, (_, k) => `<i style="left:${(rnd(k, 5) * 100).toFixed(1)}%;bottom:${(rnd(k, 6) * 30).toFixed(1)}%;animation-duration:${(3 + rnd(k, 7) * 3).toFixed(2)}s;animation-delay:-${(rnd(k, 8) * 6).toFixed(2)}s"></i>`).join('')}</div>`;
}

export const MYTH_PLACE_CSS = `
.mpl-spin{animation:mpl-spin 40s linear infinite}
.mpl-float{animation:mpl-float 6s ease-in-out infinite alternate}
.mpl-smoke circle{animation:mpl-smoke 4s ease-out infinite}
@keyframes mpl-spin{to{transform:rotate(360deg)}}
@keyframes mpl-float{from{transform:translateY(-14px)}to{transform:translateY(14px)}}
@keyframes mpl-smoke{from{transform:translateY(40px) scale(.6);opacity:0}30%{opacity:.6}to{transform:translateY(-120px) scale(1.3);opacity:0}}
.fx{position:absolute;inset:0;z-index:1;pointer-events:none;overflow:hidden}
.fx svg{position:absolute;inset:0;width:100%;height:100%}
.fx-rays{transform-origin:800px -200px;animation:fx-sway 9s ease-in-out infinite alternate}
.fx-divine{mix-blend-mode:screen}
@keyframes fx-sway{from{transform:rotate(-5deg)}to{transform:rotate(5deg)}}
.fx-petals{z-index:4}
.fx-petals i{position:absolute;top:-6%;width:calc(var(--u)*1.6);height:calc(var(--u)*2.6);border-radius:50% 50% 50% 0;opacity:.9;animation:fx-fall 7s linear infinite}
@keyframes fx-fall{from{transform:translateY(0) rotate(var(--r))}to{transform:translateY(calc(var(--u)*190)) rotate(calc(var(--r) + 540deg))}}
.fx-sparkles i{position:absolute;width:calc(var(--u)*.9);height:calc(var(--u)*.9);border-radius:50%;background:#ffe27a;box-shadow:0 0 calc(var(--u)*1.4) #ffd25a;animation:fx-rise 4s ease-out infinite}
@keyframes fx-rise{from{transform:translateY(0);opacity:0}20%{opacity:1}to{transform:translateY(calc(var(--u)*-60));opacity:0}}
`;
