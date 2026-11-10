// Cartoon characters built from one shared rig: head, body, arms, legs and a face.
// Every character can take any pose (CSS animations on the arm/leg groups) and any mood
// (face shapes). Soft radial shading and dark outlines give a rounded "3D cartoon" look.
//
// Coordinates: viewBox -30 -50 260 350; the character stands on y = 293 (its feet).
// Arms hang down from the shoulders; a positive rotation swings an arm toward the
// viewer's left, a negative one toward the right.

export const VIEWBOX = '-30 -50 260 350';
// Moods only stickmen draw, shown as the nearest of the six cartoon faces.
const MOOD_BASE = { shocked: 'surprised', frustrated: 'angry', sweating: 'worried', crying: 'sad', grin: 'happy', deflated: 'sad', suspicious: 'worried' };
export const ASPECT = 260 / 350;

const SKIN = { light: '#f6d2b8', medium: '#e3ab72', tan: '#c68642', dark: '#8d5524' };

// Default looks per kind: main colour (fur or clothes), plan (body layout) and voice hints.
export const KIND_INFO = {
  boy:      { plan: 'human', color: '#3d7bf2', hair: '#2b1a12', gender: 'm', age: 'kid' },
  girl:     { plan: 'human', color: '#ff6fa8', hair: '#2b1a12', gender: 'f', age: 'kid' },
  man:      { plan: 'human', color: '#2f9e74', hair: '#2b1a12', gender: 'm', age: 'adult' },
  woman:    { plan: 'human', color: '#9b5de5', hair: '#2b1a12', gender: 'f', age: 'adult' },
  grandpa:  { plan: 'human', color: '#f1ead9', hair: '#e9e9e9', gender: 'm', age: 'old' },
  grandma:  { plan: 'human', color: '#e2703a', hair: '#ececec', gender: 'f', age: 'old' },
  rabbit:   { plan: 'animal', color: '#f4f1ec', inner: '#ffb3c7', gender: 'f', age: 'kid' },
  cat:      { plan: 'animal', color: '#f4a259', inner: '#ffd9b0', gender: 'f', age: 'kid' },
  dog:      { plan: 'animal', color: '#c58b4f', inner: '#f3dcc0', gender: 'm', age: 'kid' },
  bear:     { plan: 'animal', color: '#8b5a3c', inner: '#d9b08c', gender: 'm', age: 'big' },
  panda:    { plan: 'animal', color: '#f7f7f7', inner: '#ffffff', gender: 'm', age: 'kid' },
  fox:      { plan: 'animal', color: '#ef7d32', inner: '#fff4e6', gender: 'm', age: 'adult' },
  elephant: { plan: 'animal', color: '#9aa5b1', inner: '#c9d1da', gender: 'm', age: 'big' },
  lion:     { plan: 'animal', color: '#f2b544', inner: '#fbe3a6', gender: 'm', age: 'big' },
  mouse:    { plan: 'animal', color: '#a7a9b4', inner: '#ffc2cf', gender: 'f', age: 'kid' },
  owl:      { plan: 'owl', color: '#8d6b4f', inner: '#f1e3c8', gender: 'm', age: 'old' },
  robot:    { plan: 'robot', color: '#5aa9ff', gender: 'm', age: 'robot' },
  star:     { plan: 'float', color: '#ffd23f', gender: 'f', age: 'kid' },
  sun:      { plan: 'float', color: '#ffb627', gender: 'm', age: 'adult' },
  moon:     { plan: 'float', color: '#f3e7b0', gender: 'f', age: 'old' },
  cloud:    { plan: 'float', color: '#ffffff', gender: 'f', age: 'kid' },
};

export const KIND_ALIASES = {
  bunny: 'rabbit', hare: 'rabbit', khargosh: 'rabbit', kitten: 'cat', kitty: 'cat', puppy: 'dog', doggy: 'dog',
  teddy: 'bear', tiger: 'lion', cub: 'lion', rat: 'mouse', chuha: 'mouse', hathi: 'elephant', ullu: 'owl', bird: 'owl',
  child: 'boy', kid: 'boy', son: 'boy', student: 'boy', daughter: 'girl', 'little-girl': 'girl',
  father: 'man', dad: 'man', papa: 'man', teacher: 'woman', mother: 'woman', mom: 'woman', maa: 'woman', mummy: 'woman',
  grandfather: 'grandpa', dadaji: 'grandpa', dada: 'grandpa', nanaji: 'grandpa', nana: 'grandpa', 'old-man': 'grandpa',
  grandmother: 'grandma', dadi: 'grandma', nani: 'grandma', 'old-woman': 'grandma', granny: 'grandma',
  bot: 'robot', android: 'robot', tara: 'star', taara: 'star', sitara: 'star', suraj: 'sun', chand: 'moon', chanda: 'moon', badal: 'cloud',
};

// ---------- colour helpers ----------
function rgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** amt > 0 lightens toward white, amt < 0 darkens toward black. */
export function shade(hex, amt) {
  const [r, g, b] = rgb(hex).map(v => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt)));
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function painter(uid, flat = null) {
  const defs = [];
  let n = 0;
  // Flat: plain fills with an ink outline, to sit with stickmen in a drawn style.
  if (flat) return { defs, g: (color) => color, edge: () => flat.ink };
  return {
    defs,
    // Rounded, lit-from-top-left fill: the "3D" look.
    g(color, { cx = '36%', cy = '30%', r = '78%', light = 0.4, dark = -0.32 } = {}) {
      const id = `${uid}g${n++}`;
      defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}"><stop offset="0" stop-color="${shade(color, light)}"/><stop offset=".55" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, dark)}"/></radialGradient>`);
      return `url(#${id})`;
    },
    edge: (color) => shade(color, -0.52),
  };
}
const S = (P, c, w = 3) => `fill="${P.g(c)}" stroke="${P.edge(c)}" stroke-width="${w}" stroke-linejoin="round"`;

// ---------- face ----------
function face(P, { ex1 = 80, ex2 = 120, ey = 96, my = 124, sc = 1, mood = 'happy', eye = '#2a1d1a', cheeks = '#ff7f8f', robot = false }) {
  const e = (x) => {
    if (mood === 'sleepy') return `<path d="M${x - 8 * sc} ${ey} q${8 * sc} ${6 * sc} ${16 * sc} 0" stroke="${eye}" stroke-width="${3.4 * sc}" fill="none" stroke-linecap="round"/>`;
    const rx = (mood === 'surprised' ? 8 : 6.5) * sc, ry = (mood === 'surprised' ? 9 : 8.5) * sc;
    if (robot) return `<ellipse class="eye" cx="${x}" cy="${ey}" rx="${rx}" ry="${ry}" fill="#7ff3ff"/>`;
    return `<g class="eye"><ellipse cx="${x}" cy="${ey}" rx="${rx}" ry="${ry}" fill="${eye}"/><circle cx="${x - 2.2 * sc}" cy="${ey - 3.2 * sc}" r="${2.6 * sc}" fill="#fff"/><circle cx="${x + 2.4 * sc}" cy="${ey + 2.6 * sc}" r="${1.1 * sc}" fill="#fff" opacity=".8"/></g>`;
  };
  const brow = (x, side) => {
    const w = 8 * sc, y = ey - 15 * sc, inner = side < 0 ? x + w : x - w, outer = side < 0 ? x - w : x + w;
    const c = robot ? '#7ff3ff' : shade(eye, 0.1);
    switch (mood) {
      case 'sad': case 'worried': return `<path d="M${outer} ${y + 3 * sc} L${inner} ${y - 4 * sc}" stroke="${c}" stroke-width="${3.2 * sc}" stroke-linecap="round"/>`;
      case 'angry': return `<path d="M${outer} ${y - 4 * sc} L${inner} ${y + 4 * sc}" stroke="${c}" stroke-width="${3.6 * sc}" stroke-linecap="round"/>`;
      case 'surprised': return `<path d="M${x - w} ${y - 3 * sc} Q${x} ${y - 10 * sc} ${x + w} ${y - 3 * sc}" stroke="${c}" stroke-width="${3 * sc}" fill="none" stroke-linecap="round"/>`;
      default: return '';
    }
  };
  const ink = robot ? '#7ff3ff' : '#6b1d1d';
  const mw = 12 * sc;
  let closed;
  switch (mood) {
    case 'sad': closed = `<path d="M${100 - mw} ${my + 6 * sc} Q100 ${my - 5 * sc} ${100 + mw} ${my + 6 * sc}" stroke="${ink}" stroke-width="${3.4 * sc}" fill="none" stroke-linecap="round"/>`; break;
    case 'angry': closed = `<path d="M${100 - mw} ${my + 4 * sc} Q100 ${my - 3 * sc} ${100 + mw} ${my + 4 * sc}" stroke="${ink}" stroke-width="${3.8 * sc}" fill="none" stroke-linecap="round"/>`; break;
    case 'surprised': closed = `<ellipse cx="100" cy="${my + 2 * sc}" rx="${6 * sc}" ry="${7.5 * sc}" fill="${robot ? 'none' : '#5a1717'}" stroke="${ink}" stroke-width="${robot ? 3 : 0}"/>`; break;
    case 'worried': closed = `<path d="M${100 - mw} ${my + 3 * sc} q${mw / 2} ${-5 * sc} ${mw} 0 t${mw} 0" stroke="${ink}" stroke-width="${3.2 * sc}" fill="none" stroke-linecap="round"/>`; break;
    case 'sleepy': closed = `<ellipse cx="100" cy="${my + 2 * sc}" rx="${4 * sc}" ry="${3 * sc}" fill="${ink}"/>`; break;
    default: closed = robot
      ? `<path d="M${100 - mw} ${my} Q100 ${my + 10 * sc} ${100 + mw} ${my}" stroke="${ink}" stroke-width="${3.4 * sc}" fill="none" stroke-linecap="round"/>`
      : `<path d="M${100 - mw} ${my - 1 * sc} Q100 ${my + 15 * sc} ${100 + mw} ${my - 1 * sc} Z" fill="#6b1d1d" stroke="#4a1010" stroke-width="${1.6 * sc}" stroke-linejoin="round"/><path d="M${100 - 6 * sc} ${my + 7 * sc} Q100 ${my + 3 * sc} ${100 + 6 * sc} ${my + 7 * sc} Q100 ${my + 12 * sc} ${100 - 6 * sc} ${my + 7 * sc}" fill="#ff8a9a"/>`;
  }
  const open = robot
    ? `<rect x="${100 - 10 * sc}" y="${my - 2 * sc}" width="${20 * sc}" height="${9 * sc}" rx="${3 * sc}" fill="#7ff3ff"/>`
    : `<ellipse cx="100" cy="${my + 4 * sc}" rx="${9.5 * sc}" ry="${8 * sc}" fill="#5a1717" stroke="#3d0d0d" stroke-width="${1.4 * sc}"/><ellipse cx="100" cy="${my + 8 * sc}" rx="${5.5 * sc}" ry="${3 * sc}" fill="#ff8a9a"/>`;
  let extra = '';
  if (mood === 'sad' && !robot) extra = `<path class="ch-tear" d="M${ex1 + 4 * sc} ${ey + 9 * sc} q${-4 * sc} ${8 * sc} 0 ${11 * sc} q${4 * sc} ${-3 * sc} 0 ${-11 * sc}" fill="#6fc3ff"/>`;
  if (mood === 'sleepy') extra = `<g class="ch-zzz" font-family="Poppins,sans-serif" font-weight="700" fill="#8fa6ff"><text x="${ex2 + 22 * sc}" y="${ey - 24 * sc}" font-size="${16 * sc}">z</text><text x="${ex2 + 34 * sc}" y="${ey - 40 * sc}" font-size="${21 * sc}">z</text></g>`;
  if (mood === 'angry' && !robot) extra = `<path d="M${ex2 + 22 * sc} ${ey - 36 * sc} l${6 * sc} ${6 * sc} m0 ${-6 * sc} l${-6 * sc} ${6 * sc} m${9 * sc} ${-3 * sc} l${6 * sc} 0" stroke="#e5383b" stroke-width="${3 * sc}" stroke-linecap="round"/>`;
  const blush = robot || mood === 'angry' ? '' : `<ellipse cx="${ex1 - 10 * sc}" cy="${ey + 16 * sc}" rx="${8 * sc}" ry="${5 * sc}" fill="${cheeks}" opacity=".45"/><ellipse cx="${ex2 + 10 * sc}" cy="${ey + 16 * sc}" rx="${8 * sc}" ry="${5 * sc}" fill="${cheeks}" opacity=".45"/>`;
  return `${blush}<g class="ch-eyes">${e(ex1)}${e(ex2)}</g>${brow(ex1, -1)}${brow(ex2, 1)}<g class="ch-mouth-closed">${closed}</g><g class="ch-mouth-open">${open}</g>${extra}`;
}

// ---------- limbs ----------
const arm = (side, P, sleeve, hand, { x = side === 'l' ? 64 : 136, y = 166, len = 54, w = 18 } = {}) =>
  `<g class="ch-arm ch-arm-${side}" style="transform-origin:${x}px ${y}px"><rect x="${x - w / 2}" y="${y - 4}" width="${w}" height="${len}" rx="${w / 2}" ${S(P, sleeve, 2.6)}/><circle cx="${x}" cy="${y + len}" r="${w * 0.62}" ${S(P, hand, 2.4)}/></g>`;
const leg = (side, P, color, shoe, { x = side === 'l' ? 88 : 112, y = 232, len = 52, w = 20 } = {}) =>
  `<g class="ch-leg ch-leg-${side}" style="transform-origin:${x}px ${y}px"><rect x="${x - w / 2}" y="${y - 4}" width="${w}" height="${len}" rx="${w / 2}" ${S(P, color, 2.6)}/><ellipse cx="${x + (side === 'l' ? -3 : 3)}" cy="${y + len + 2}" rx="${w * 0.85}" ry="${w * 0.48}" ${S(P, shoe, 2.4)}/></g>`;

// ---------- humans ----------
function human(kind, P, o) {
  const skin = SKIN[o.skin] || SKIN.medium;
  const hair = o.hair || KIND_INFO[kind].hair;
  const cloth = o.color || KIND_INFO[kind].color;
  const dress = kind === 'girl' || kind === 'woman' || kind === 'grandma';
  const old = kind === 'grandpa' || kind === 'grandma';
  const pants = kind === 'grandpa' ? '#efe7d6' : kind === 'boy' ? '#2b4a8b' : '#3b3f58';
  const shoe = kind === 'girl' ? '#e63962' : '#4a3426';

  // Hair drawn behind the head (long hair, buns)
  let hairBack = '';
  if (kind === 'girl') hairBack = `<circle cx="38" cy="112" r="20" ${S(P, hair)}/><circle cx="162" cy="112" r="20" ${S(P, hair)}/><rect x="31" y="98" width="14" height="8" rx="4" fill="#ff4f8b"/><rect x="155" y="98" width="14" height="8" rx="4" fill="#ff4f8b"/>`;
  if (kind === 'woman') hairBack = `<path d="M44 92 Q40 150 58 172 L142 172 Q160 150 156 92 Z" ${S(P, hair)}/>`;
  if (kind === 'grandma') hairBack = `<circle cx="100" cy="34" r="20" ${S(P, hair)}/>`;

  let hairFront;
  switch (kind) {
    case 'boy': hairFront = `<path d="M44 92 Q42 34 100 34 Q158 34 156 92 Q148 66 126 62 L118 50 L108 62 L96 48 L88 62 Q62 62 44 92 Z" ${S(P, hair)}/>`; break;
    case 'girl': hairFront = `<path d="M44 96 Q40 34 100 34 Q160 34 156 96 Q150 70 132 62 Q112 74 84 60 Q60 66 44 96 Z" ${S(P, hair)}/>`; break;
    case 'man': hairFront = `<path d="M46 86 Q46 36 100 36 Q154 36 154 86 Q144 62 100 58 Q60 58 46 86 Z" ${S(P, hair)}/><path d="M86 136 Q100 128 114 136 Q100 132 86 136 Z" fill="${hair}" stroke="${shade(hair, -0.4)}" stroke-width="5" stroke-linejoin="round"/>`; break;
    case 'woman': hairFront = `<path d="M44 96 Q42 34 104 36 Q158 38 156 96 Q146 60 112 58 Q80 76 44 96 Z" ${S(P, hair)}/>`; break;
    case 'grandpa': hairFront = `<path d="M44 104 Q38 76 52 66 Q50 92 58 104 Z M156 104 Q162 76 148 66 Q150 92 142 104 Z" ${S(P, hair, 2.4)}/><path d="M78 134 Q100 120 122 134 Q112 142 100 136 Q88 142 78 134 Z" ${S(P, hair, 2.4)}/>`; break;
    default: hairFront = `<path d="M44 96 Q42 36 100 36 Q158 36 156 96 Q140 62 100 60 Q60 62 44 96 Z" ${S(P, hair)}/>`;
  }
  const glasses = old ? `<g fill="none" stroke="#3a2a22" stroke-width="3"><circle cx="80" cy="98" r="13"/><circle cx="120" cy="98" r="13"/><path d="M93 98h14M67 96l-14 -4M133 96l14 -4"/></g>` : '';
  const ears = `<ellipse cx="45" cy="104" rx="9" ry="12" ${S(P, skin, 2.4)}/><ellipse cx="155" cy="104" rx="9" ry="12" ${S(P, skin, 2.4)}/>`;
  const head = `<g class="ch-head" style="transform-origin:100px 146px">${hairBack}${ears}<circle cx="100" cy="96" r="56" ${S(P, skin)}/>${hairFront}${face(P, { mood: o.mood, my: kind === 'man' || kind === 'grandpa' ? 128 : 124 })}${glasses}</g>`;

  const torso = dress
    ? `<path d="M72 150 Q100 140 128 150 L150 248 Q100 260 50 248 Z" ${S(P, cloth)}/>${kind === 'grandma' ? `<path d="M120 150 L86 248 L104 250 L134 156 Z" fill="${shade(cloth, -0.25)}" opacity=".85"/>` : ''}`
    : `<rect x="60" y="148" width="80" height="${kind === 'grandpa' ? 100 : 88}" rx="28" ${S(P, cloth)}/>${kind === 'man' ? `<path d="M88 150 L100 166 L112 150" fill="#fff" stroke="${P.edge('#ffffff')}" stroke-width="2"/>` : kind === 'boy' ? `<path d="M100 178 l5 10 11 1 -8 8 2 11 -10 -6 -10 6 2 -11 -8 -8 11 -1z" fill="#ffd23f"/>` : ''}`;
  const legColor = dress ? skin : pants;
  return `${leg('l', P, legColor, shoe)}${leg('r', P, legColor, shoe)}<rect x="90" y="138" width="20" height="18" rx="6" fill="${shade(skin, -0.15)}"/>${arm('l', P, cloth, skin)}${arm('r', P, cloth, skin)}${torso}${head}`;
}

// ---------- animals ----------
function animal(kind, P, o) {
  const fur = o.color || KIND_INFO[kind].color;
  const inner = KIND_INFO[kind].inner;
  const dark = shade(fur, -0.35);
  const limb = kind === 'panda' ? '#2b2b33' : fur;
  const paw = kind === 'panda' ? '#2b2b33' : shade(fur, -0.18);
  const nose = kind === 'rabbit' || kind === 'mouse' || kind === 'cat' ? '#ff7d9c' : '#2b1d1a';
  let back = '', ears = '', muzzle = '', front = '', tail = '';
  switch (kind) {
    case 'rabbit':
      back = `<g style="transform-origin:100px 60px" class="ch-ears"><ellipse cx="74" cy="6" rx="16" ry="48" transform="rotate(-12 74 6)" ${S(P, fur)}/><ellipse cx="74" cy="10" rx="7" ry="34" transform="rotate(-12 74 10)" fill="${inner}"/><ellipse cx="126" cy="6" rx="16" ry="48" transform="rotate(12 126 6)" ${S(P, fur)}/><ellipse cx="126" cy="10" rx="7" ry="34" transform="rotate(12 126 10)" fill="${inner}"/></g>`;
      tail = `<circle cx="146" cy="236" r="14" ${S(P, '#ffffff', 2.4)}/>`;
      front = `<rect x="94" y="128" width="6" height="9" rx="2" fill="#fff" stroke="#c9c2bb" stroke-width="1.4"/><rect x="100" y="128" width="6" height="9" rx="2" fill="#fff" stroke="#c9c2bb" stroke-width="1.4"/>`;
      break;
    case 'cat':
      ears = `<path d="M52 66 L58 18 L92 46 Z M148 66 L142 18 L108 46 Z" ${S(P, fur)}/><path d="M60 56 L63 30 L82 46 Z M140 56 L137 30 L118 46 Z" fill="${inner}"/>`;
      tail = `<path d="M140 240 Q186 236 176 186 Q172 170 184 160" stroke="${P.edge(fur)}" stroke-width="18" fill="none" stroke-linecap="round"/><path d="M140 240 Q186 236 176 186 Q172 170 184 160" stroke="${fur}" stroke-width="12" fill="none" stroke-linecap="round"/>`;
      front = `<g stroke="${dark}" stroke-width="2.2" stroke-linecap="round"><path d="M60 114 L30 108 M60 120 L30 122 M140 114 L170 108 M140 120 L170 122"/></g>`;
      break;
    case 'dog':
      ears = `<ellipse cx="46" cy="94" rx="17" ry="36" transform="rotate(18 46 94)" ${S(P, shade(fur, -0.22))}/><ellipse cx="154" cy="94" rx="17" ry="36" transform="rotate(-18 154 94)" ${S(P, shade(fur, -0.22))}/>`;
      muzzle = `<ellipse cx="100" cy="118" rx="26" ry="19" ${S(P, inner, 2.2)}/>`;
      tail = `<path d="M142 232 Q170 214 166 188" stroke="${P.edge(fur)}" stroke-width="16" fill="none" stroke-linecap="round"/><path d="M142 232 Q170 214 166 188" stroke="${fur}" stroke-width="10" fill="none" stroke-linecap="round"/>`;
      break;
    case 'bear': case 'panda':
      ears = `<circle cx="54" cy="50" r="19" ${S(P, kind === 'panda' ? '#2b2b33' : fur)}/><circle cx="146" cy="50" r="19" ${S(P, kind === 'panda' ? '#2b2b33' : fur)}/>${kind === 'bear' ? `<circle cx="54" cy="50" r="9" fill="${inner}"/><circle cx="146" cy="50" r="9" fill="${inner}"/>` : ''}`;
      muzzle = kind === 'bear' ? `<ellipse cx="100" cy="120" rx="24" ry="17" ${S(P, inner, 2.2)}/>` : `<ellipse cx="80" cy="98" rx="14" ry="17" transform="rotate(25 80 98)" fill="#2b2b33"/><ellipse cx="120" cy="98" rx="14" ry="17" transform="rotate(-25 120 98)" fill="#2b2b33"/>`;
      tail = `<circle cx="144" cy="238" r="11" ${S(P, kind === 'panda' ? '#2b2b33' : fur, 2.4)}/>`;
      break;
    case 'fox':
      ears = `<path d="M50 70 L46 8 L94 48 Z M150 70 L154 8 L106 48 Z" ${S(P, fur)}/><path d="M48 30 L46 8 L62 22 Z M152 30 L154 8 L138 22 Z" fill="#3a2418"/><path d="M58 60 L56 26 L84 50 Z M142 60 L144 26 L116 50 Z" fill="${inner}"/>`;
      muzzle = `<path d="M46 108 Q60 150 100 150 Q140 150 154 108 Q126 126 100 112 Q74 126 46 108 Z" fill="${inner}"/>`;
      tail = `<path d="M136 246 Q200 250 196 184 Q190 150 168 158 Q180 196 136 222 Z" ${S(P, fur)}/><path d="M196 184 Q190 150 168 158 Q176 172 192 180 Z" fill="#fff"/>`;
      break;
    case 'elephant':
      back = `<ellipse cx="38" cy="98" rx="34" ry="44" ${S(P, shade(fur, -0.08))}/><ellipse cx="42" cy="98" rx="20" ry="30" fill="${inner}"/><ellipse cx="162" cy="98" rx="34" ry="44" ${S(P, shade(fur, -0.08))}/><ellipse cx="158" cy="98" rx="20" ry="30" fill="${inner}"/>`;
      front = `<path d="M100 108 C100 138 104 152 120 156 C130 158 136 150 132 142" stroke="${P.edge(fur)}" stroke-width="24" fill="none" stroke-linecap="round"/><path d="M100 108 C100 138 104 152 120 156 C130 158 136 150 132 142" stroke="${fur}" stroke-width="18" fill="none" stroke-linecap="round"/>`;
      tail = `<path d="M142 234 Q160 240 158 256" stroke="${dark}" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      break;
    case 'lion':
      back = `<g>${Array.from({ length: 14 }, (_, k) => { const a = (k / 14) * Math.PI * 2; return `<circle cx="${(100 + Math.cos(a) * 58).toFixed(1)}" cy="${(96 + Math.sin(a) * 58).toFixed(1)}" r="24" fill="${shade(fur, -0.3)}"/>`; }).join('')}<circle cx="100" cy="96" r="66" fill="${shade(fur, -0.3)}"/></g>`;
      ears = `<circle cx="58" cy="52" r="14" ${S(P, fur)}/><circle cx="142" cy="52" r="14" ${S(P, fur)}/>`;
      muzzle = `<ellipse cx="100" cy="120" rx="24" ry="17" ${S(P, inner, 2.2)}/>`;
      tail = `<path d="M140 236 Q182 240 176 200" stroke="${P.edge(fur)}" stroke-width="10" fill="none" stroke-linecap="round"/><circle cx="176" cy="194" r="11" fill="${shade(fur, -0.3)}"/>`;
      break;
    case 'mouse':
      ears = `<circle cx="48" cy="44" r="32" ${S(P, fur)}/><circle cx="48" cy="44" r="19" fill="${inner}"/><circle cx="152" cy="44" r="32" ${S(P, fur)}/><circle cx="152" cy="44" r="19" fill="${inner}"/>`;
      tail = `<path d="M140 240 Q196 246 182 196 Q176 176 194 168" stroke="#ff9bb3" stroke-width="5" fill="none" stroke-linecap="round"/>`;
      front = `<g stroke="${dark}" stroke-width="2" stroke-linecap="round"><path d="M64 116 L34 110 M64 122 L34 124 M136 116 L166 110 M136 122 L166 124"/></g>`;
      break;
  }
  const noseEl = kind === 'elephant' ? '' : `<ellipse cx="100" cy="${muzzle ? 110 : 112}" rx="${kind === 'mouse' || kind === 'rabbit' ? 6 : 8}" ry="${kind === 'mouse' || kind === 'rabbit' ? 4.5 : 6}" fill="${nose}"/>`;
  const head = `<g class="ch-head" style="transform-origin:100px 150px">${back}${ears}<circle cx="100" cy="96" r="56" ${S(P, fur)}/>${muzzle}${face(P, { mood: o.mood, my: kind === 'elephant' ? 126 : 124, ex1: kind === 'elephant' ? 76 : 80, ex2: kind === 'elephant' ? 124 : 120 })}${noseEl}${front}</g>`;
  const body = `<ellipse cx="100" cy="198" rx="46" ry="50" ${S(P, fur)}/><ellipse cx="100" cy="206" rx="28" ry="32" fill="${inner}" opacity="${kind === 'panda' ? 0 : 0.9}"/>`;
  return `${tail}${leg('l', P, limb, paw, { len: 44, y: 240, w: 22 })}${leg('r', P, limb, paw, { len: 44, y: 240, w: 22 })}${arm('l', P, limb, paw, { y: 168, len: 48, w: 19 })}${arm('r', P, limb, paw, { y: 168, len: 48, w: 19 })}${body}${head}`;
}

// ---------- owl ----------
function owl(P, o) {
  const c = o.color || KIND_INFO.owl.color;
  const inner = KIND_INFO.owl.inner;
  const feathers = Array.from({ length: 6 }, (_, k) => `<path d="M${84 + (k % 3) * 16} ${200 + Math.floor(k / 3) * 20} q8 8 16 0" stroke="${shade(inner, -0.3)}" stroke-width="2.4" fill="none"/>`).join('');
  const wing = (side) => {
    const x = side === 'l' ? 44 : 156;
    return `<g class="ch-arm ch-arm-${side}" style="transform-origin:${x}px 158px"><ellipse cx="${x}" cy="200" rx="20" ry="46" ${S(P, shade(c, -0.12))}/></g>`;
  };
  const foot = (side) => {
    const x = side === 'l' ? 84 : 116;
    return `<g class="ch-leg ch-leg-${side}" style="transform-origin:${x}px 270px"><path d="M${x - 12} 290 q4 -14 12 -16 q8 2 12 16 Z" fill="#f39c34" stroke="#b9661a" stroke-width="2.4" stroke-linejoin="round"/></g>`;
  };
  const head = `<g class="ch-head" style="transform-origin:100px 190px"><path d="M58 92 L52 46 L84 76 Z M142 92 L148 46 L116 76 Z" ${S(P, c)}/>
<circle cx="78" cy="132" r="25" fill="${inner}" stroke="${shade(inner, -0.35)}" stroke-width="2.4"/><circle cx="122" cy="132" r="25" fill="${inner}" stroke="${shade(inner, -0.35)}" stroke-width="2.4"/>
${face(P, { mood: o.mood, ex1: 78, ex2: 122, ey: 132, my: 170, sc: 1.25 })}<path d="M92 150 L100 166 L108 150 Z" fill="#f39c34" stroke="#b9661a" stroke-width="2.2" stroke-linejoin="round"/></g>`;
  return `${foot('l')}${foot('r')}${wing('l')}${wing('r')}<ellipse cx="100" cy="186" rx="66" ry="96" ${S(P, c)}/><ellipse cx="100" cy="214" rx="40" ry="56" fill="${inner}"/>${feathers}${head}`;
}

// ---------- robot ----------
function robot(P, o) {
  const c = o.color || KIND_INFO.robot.color;
  const metal = '#c9d3e6';
  return `${leg('l', P, metal, shade(c, -0.25), { len: 46, y: 238 })}${leg('r', P, metal, shade(c, -0.25), { len: 46, y: 238 })}${arm('l', P, metal, c, { y: 164, len: 50 })}${arm('r', P, metal, c, { y: 164, len: 50 })}
<rect x="62" y="146" width="76" height="94" rx="20" ${S(P, c)}/><circle cx="100" cy="186" r="13" fill="#7ff3ff" stroke="${P.edge(c)}" stroke-width="2.4" class="ch-glow"/>
<g class="ch-head" style="transform-origin:100px 146px"><path d="M100 30 V8" stroke="${P.edge(c)}" stroke-width="5" stroke-linecap="round"/><circle cx="100" cy="8" r="9" fill="#ff9a3c" class="ch-glow"/>
<rect x="48" y="30" width="104" height="108" rx="32" ${S(P, c)}/><rect x="60" y="48" width="80" height="72" rx="20" fill="#1b2347" stroke="#0e1430" stroke-width="2.4"/>
${face(P, { mood: o.mood, ex1: 82, ex2: 118, ey: 78, my: 100, sc: 0.9, robot: true })}</g>`;
}

// ---------- objects with faces (float) ----------
function floater(kind, P, o) {
  const c = o.color || KIND_INFO[kind].color;
  const cy = 170;
  // Arms start at the edge of the shape so waves and cheers show outside it.
  const ax = kind === 'cloud' ? 26 : kind === 'star' ? 40 : 34;
  const arms = `${arm('l', P, c, c, { x: ax, y: cy + 14, len: 36, w: 16 })}${arm('r', P, c, c, { x: 200 - ax, y: cy + 14, len: 36, w: 16 })}`;
  let shape = '', behind = '';
  switch (kind) {
    case 'star': {
      const pts = Array.from({ length: 10 }, (_, k) => { const a = -Math.PI / 2 + k * Math.PI / 5, r = k % 2 ? 46 : 98; return `${(100 + Math.cos(a) * r).toFixed(1)},${(cy + 8 + Math.sin(a) * r).toFixed(1)}`; }).join(' ');
      behind = `<circle cx="100" cy="${cy}" r="96" fill="${c}" opacity=".18" class="ch-glow"/>`;
      shape = `<polygon points="${pts}" ${S(P, c, 6)}/>`;
      break;
    }
    case 'sun':
      behind = `<g class="ch-rays" style="transform-origin:100px ${cy}px">${Array.from({ length: 12 }, (_, k) => `<path d="M100 ${cy - 76} L108 ${cy - 100} L92 ${cy - 100} Z" transform="rotate(${k * 30} 100 ${cy})" fill="${shade(c, -0.08)}"/>`).join('')}</g>`;
      shape = `<circle cx="100" cy="${cy}" r="70" ${S(P, c, 4)}/>`;
      break;
    case 'moon':
      behind = `<circle cx="100" cy="${cy}" r="92" fill="${c}" opacity=".16" class="ch-glow"/>`;
      shape = `<circle cx="100" cy="${cy}" r="72" ${S(P, c, 4)}/><circle cx="136" cy="${cy - 30}" r="10" fill="${shade(c, -0.12)}"/><circle cx="62" cy="${cy + 34}" r="8" fill="${shade(c, -0.12)}"/><circle cx="142" cy="${cy + 26}" r="6" fill="${shade(c, -0.12)}"/>`;
      break;
    case 'cloud':
      shape = `<path d="M40 ${cy + 46} Q10 ${cy + 40} 22 ${cy + 4} Q18 ${cy - 34} 58 ${cy - 34} Q70 ${cy - 76} 112 ${cy - 66} Q150 ${cy - 82} 164 ${cy - 34} Q198 ${cy - 26} 186 ${cy + 12} Q198 ${cy + 46} 160 ${cy + 50} Z" ${S(P, c, 4)}/>`;
      break;
  }
  const f = face(P, { mood: o.mood, ex1: 80, ex2: 120, ey: cy - 4, my: cy + 24, cheeks: '#ff7f8f' });
  return `${behind}${shape}${arms}<g class="ch-head" style="transform-origin:100px ${cy + 60}px">${f}</g>`;
}

/**
 * SVG for one character.
 * @param kind  CHARACTER_KINDS entry
 * @param o     { mood, pose, color, hair, skin }
 * @param uid   unique id prefix for gradients
 */
export function characterSvg(kind, o = {}, uid = 'c') {
  const info = KIND_INFO[kind] || KIND_INFO.rabbit;
  const P = painter(uid, o.flat || null);
  const mood = MOOD_BASE[o.mood] || o.mood || 'happy';
  const opts = { ...o, mood };
  let body;
  switch (info.plan) {
    case 'human': body = human(kind, P, opts); break;
    case 'animal': body = animal(kind, P, opts); break;
    case 'owl': body = owl(P, opts); break;
    case 'robot': body = robot(P, opts); break;
    default: body = floater(kind, P, opts);
  }
  const shadow = info.plan === 'float'
    ? '<ellipse class="ch-shadow" cx="100" cy="293" rx="46" ry="7" fill="#00000026"/>'
    : '<ellipse class="ch-shadow" cx="100" cy="293" rx="62" ry="9" fill="#00000033"/>';
  return `<svg class="chr plan-${info.plan} pose-${o.pose || 'idle'} mood-${mood}" viewBox="${VIEWBOX}" role="img" aria-label="${kind}"><defs>${P.defs.join('')}</defs>${shadow}<g class="ch-all"><g class="ch-body">${body}</g></g></svg>`;
}

// Poses, talking and idle life. All CSS animations, so the frame-stepped renderer can seek them.
export const CHARACTER_CSS = `
.chwrap{position:absolute;bottom:var(--ground);height:calc(var(--chh)*var(--s,1));aspect-ratio:${(ASPECT).toFixed(4)};margin-left:calc(var(--chh)*var(--s,1)*${(-ASPECT / 2).toFixed(4)});z-index:2}
.chflip{width:100%;height:100%}.chflip.flip{transform:scaleX(-1)}
.chr{width:100%;height:100%;display:block;overflow:visible}
.chr *{transform-box:view-box}
.chr .ch-eyes .eye{transform-box:fill-box;transform-origin:center;animation:blink 4.2s infinite;animation-delay:var(--blink,0s)}
.chr .ch-mouth-open{opacity:0;transform-box:fill-box;transform-origin:50% 0}
.talking .chr .ch-mouth-open{opacity:1;animation:ch-talk .21s ease-in-out infinite alternate}
.talking .chr .ch-mouth-closed{opacity:0}
.talking .chr .ch-head{animation:ch-nod .5s ease-in-out infinite alternate}
.chr .ch-arm-l{transform:rotate(14deg)}.chr .ch-arm-r{transform:rotate(-14deg)}
.chr .ch-body{transform-origin:100px 293px;animation:ch-breathe 2.8s ease-in-out infinite alternate}
.chr .ch-tear{animation:ch-drip 1.8s ease-in infinite}
.chr .ch-zzz{animation:ch-zzz 2.4s ease-in-out infinite}
.chr .ch-glow{animation:ch-glow 1.6s ease-in-out infinite alternate}
.chr .ch-rays{animation:ch-spin 16s linear infinite}
.chr.plan-float .ch-all{animation:ch-float 2.8s ease-in-out infinite alternate}
.pose-wave .ch-arm-r{animation:ch-wave .55s ease-in-out infinite alternate}
.pose-cheer .ch-arm-l{animation:ch-cheer-l .45s ease-in-out infinite alternate}
.pose-cheer .ch-arm-r{animation:ch-cheer-r .45s ease-in-out infinite alternate}
.pose-cheer .ch-all{animation:ch-hop .45s ease-in-out infinite alternate}
.pose-point .ch-arm-r{transform:rotate(-96deg)}
.pose-think .ch-arm-r{transform:rotate(124deg)}
.pose-think .ch-head{transform:rotate(-7deg)}
.pose-talk .ch-arm-l{animation:ch-wave .9s ease-in-out infinite alternate}
.pose-sit .ch-all{transform:translateY(9%)}
.pose-walk .ch-leg-l,.enter-walk-in .ch-leg-l{animation:ch-step .42s ease-in-out infinite alternate}
.pose-walk .ch-leg-r,.enter-walk-in .ch-leg-r{animation:ch-step .42s ease-in-out infinite alternate-reverse}
.pose-walk .ch-arm-l{animation:ch-swing-l .42s ease-in-out infinite alternate-reverse}
.pose-walk .ch-arm-r{animation:ch-swing-r .42s ease-in-out infinite alternate-reverse}
.pose-walk .ch-all{animation:ch-bob .21s ease-in-out infinite alternate}
.enter-walk-in .ch-leg-l,.enter-walk-in .ch-leg-r{animation-iteration-count:4;animation-delay:var(--d,0s)}
.pose-jump .ch-all{animation:ch-jump 1s ease-in-out infinite}
.pose-dance .ch-body{animation:ch-sway .6s ease-in-out infinite alternate}
.pose-dance .ch-arm-l{animation:ch-cheer-l .6s ease-in-out infinite alternate}
.pose-dance .ch-arm-r{animation:ch-swing-r .6s ease-in-out infinite alternate-reverse}
.enter-walk-in{animation:ch-walkin 1.68s cubic-bezier(.3,.1,.3,1) both;animation-delay:var(--d,0s)}
.enter-pop{animation:pop .6s cubic-bezier(.3,1.5,.5,1) both;animation-delay:var(--d,0s)}
.enter-fly-in{animation:ch-flyin 1.4s cubic-bezier(.2,.8,.25,1) both;animation-delay:var(--d,0s)}
.enter-fade{animation:sc-fade .8s ease both;animation-delay:var(--d,0s)}
@keyframes ch-talk{from{transform:scaleY(.2)}to{transform:scaleY(1)}}
@keyframes ch-nod{from{transform:rotate(-2deg)}to{transform:rotate(2.5deg) translateY(2px)}}
@keyframes ch-breathe{to{transform:scale(1.012,1.022)}}
@keyframes ch-wave{from{transform:rotate(-142deg)}to{transform:rotate(-178deg)}}
@keyframes ch-cheer-l{from{transform:rotate(140deg)}to{transform:rotate(166deg)}}
@keyframes ch-cheer-r{from{transform:rotate(-140deg)}to{transform:rotate(-166deg)}}
@keyframes ch-hop{to{transform:translateY(-14px)}}
@keyframes ch-step{from{transform:rotate(-22deg)}to{transform:rotate(22deg)}}
@keyframes ch-swing-l{from{transform:rotate(-8deg)}to{transform:rotate(30deg)}}
@keyframes ch-swing-r{from{transform:rotate(8deg)}to{transform:rotate(-30deg)}}
@keyframes ch-bob{to{transform:translateY(-5px)}}
@keyframes ch-jump{0%,100%{transform:translateY(0) scale(1.04,.94)}12%{transform:translateY(0) scale(1)}50%{transform:translateY(-64px) scale(.98,1.04)}88%{transform:translateY(0) scale(1)}}
@keyframes ch-sway{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}
@keyframes ch-float{from{transform:translateY(-6px)}to{transform:translateY(10px)}}
@keyframes ch-glow{from{opacity:.55}to{opacity:1}}
@keyframes ch-spin{to{transform:rotate(360deg)}}
@keyframes ch-drip{0%{transform:translateY(0);opacity:0}20%{opacity:1}100%{transform:translateY(16px);opacity:0}}
@keyframes ch-zzz{0%{transform:translateY(6px);opacity:0}30%{opacity:1}100%{transform:translateY(-12px);opacity:0}}
@keyframes ch-walkin{from{transform:translateX(var(--from,-60vw))}}
@keyframes ch-flyin{from{opacity:0;transform:translate(calc(var(--u)*-30),calc(var(--u)*-70)) rotate(-40deg) scale(.6)}60%{opacity:1}}
`;
