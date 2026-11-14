// Mythology kit (plan 19): people of the Ramayana / Mahabharata era, deities in their traditional
// forms, and animals, drawn in code. One parametric figure (facing right, 3/4 profile, Madhubani
// proportions: large almond eye, long nose line) built from parts: skin, garments, headwear, beard,
// held item, extra arms or heads, vanara or elephant face, tail, halo, tilak.
//
// Same rig as the cartoon and stickman figures (ch-head, ch-arm-l/r, ch-leg-l/r, ch-eyes .eye,
// ch-mouth-closed, ch-vis .vA–.vH), so every pose, walk, entrance and lip-sync works unchanged.
// viewBox -30 -50 260 350, feet on y = 293, neck pivot at (100, 96), shoulder at (100, 104).
//
// skin "madhubani": every garment filled with Mithila patterns and outlined with a double black
// line; skin "flat": the same figures, plain fills and a single outline (for other styles).
// Same as characters.mjs VIEWBOX (kept here so the two modules don't import each other).
const VIEWBOX = '-30 -50 260 350';

const f1 = (n) => (+n).toFixed(1);
export const MADHU = {
  ink: '#1c140f', paper: '#f4e6c6', red: '#cf3a2b', vermilion: '#e2552f', yellow: '#f2b632', ochre: '#d9902a',
  indigo: '#2e4796', blue: '#3c6fc4', green: '#3d8b3f', leaf: '#6aa84f', pink: '#e2678f', maroon: '#8c2a2a',
  gold: '#e9b23a', white: '#fbf6ea', saffron: '#f08a24', black: '#1c140f', brown: '#7a4a2a',
};
const C = MADHU;
// Skin colours: people, and the traditional colours of the deities.
const SKIN = { fair: '#f1c38f', wheat: '#e2a46c', brown: '#c47d4a', dark: '#8d5530', blue: '#3f72c8', ashblue: '#9cb9d9', orange: '#e0702e', navy: '#28356b', gold: '#f0b347', red: '#c24a2c', grey: '#8f9aa6', green: '#4d8c4a' };

// ── patterns ──
export function patterns(u, ink, k = 1) {
  const s = `stroke="${ink}" fill="none" stroke-width="0.9" stroke-linecap="round"`;
  const out = `<defs>
<pattern id="${u}-scale" width="9" height="7" patternUnits="userSpaceOnUse"><path d="M0 7 A4.5 4.5 0 0 1 9 7 M-4.5 3.5 A4.5 4.5 0 0 1 4.5 3.5 M4.5 3.5 A4.5 4.5 0 0 1 13.5 3.5" ${s}/></pattern>
<pattern id="${u}-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="3.5" cy="3.5" r="1.25" fill="${ink}"/></pattern>
<pattern id="${u}-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><path d="M0 0 V5" ${s}/></pattern>
<pattern id="${u}-stripes" width="10" height="6" patternUnits="userSpaceOnUse"><path d="M0 1.5 H10 M0 4.5 H10" ${s}/></pattern>
<pattern id="${u}-chev" width="10" height="7" patternUnits="userSpaceOnUse"><path d="M0 5.5 L2.5 1.5 L5 5.5 L7.5 1.5 L10 5.5" ${s}/></pattern>
<pattern id="${u}-leaf" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M3 9 Q6 2 9 9 Q6 7 3 9 Z M6 9 V3" ${s}/></pattern>
<pattern id="${u}-flower" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.6" fill="${ink}"/><path d="M6 1.5 V3.5 M6 8.5 V10.5 M1.5 6 H3.5 M8.5 6 H10.5" ${s}/></pattern>
<pattern id="${u}-band" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 10 L5 2 L10 10 Z" fill="${ink}" fill-opacity=".85"/></pattern>
<pattern id="${u}-wave" width="16" height="8" patternUnits="userSpaceOnUse"><path d="M0 4 Q4 0 8 4 T16 4" ${s}/></pattern>
</defs>`;
  // Big scenery uses the same patterns, scaled up (k).
  return k === 1 ? out : out.replace(/patternUnits="userSpaceOnUse"( patternTransform="([^"]*)")?/g, (_, __, t) => `patternUnits="userSpaceOnUse" patternTransform="${t ? t + ' ' : ''}scale(${k})"`);
}

/**
 * A garment or body part: base colour, an optional pattern on top, and the outline. Madhubani:
 * a double black line (a wide black stroke with a narrower stroke of the base colour on it).
 */
export function makeShape(u, ink, skin) {
  const madhu = skin === 'madhubani';
  return (d, fill, pat, { lw = 1, noPat = false } = {}) => {
    let out = `<path d="${d}" fill="${fill}"/>`;
    if (madhu && pat && !noPat) out += `<path d="${d}" fill="url(#${u}-${pat})" opacity=".55"/>`;
    out += madhu
      ? `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${f1(4.6 * lw)}" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${fill}" stroke-width="${f1(1.8 * lw)}" stroke-linejoin="round"/>`
      : `<path d="${d}" fill="none" stroke="${ink}" stroke-width="${f1(2.6 * lw)}" stroke-linejoin="round"/>`;
    return out;
  };
}
export const line = (d, c, w = 2) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${f1(w)}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ── who is who ──
// gender / age feed the voice casting (tts.mjs); `look` is the figure.
export const MYTH_KINDS = {
  // People of the era
  king:      { gender: 'm', age: 'adult', look: { skin: 'wheat', top: 'bare', lower: C.yellow, lowerPat: 'stripes', scarf: C.red, head: 'crown', jewel: true, moustache: true, item: 'sword' } },
  queen:     { gender: 'f', age: 'adult', look: { skin: 'fair', top: C.red, lower: C.red, lowerPat: 'flower', scarf: C.yellow, head: 'crown-f', jewel: true, female: true } },
  prince:    { gender: 'm', age: 'adult', look: { skin: 'wheat', top: 'bare', lower: C.saffron, lowerPat: 'chev', scarf: C.green, head: 'crown-s', jewel: true, item: 'bow', quiver: true } },
  princess:  { gender: 'f', age: 'adult', look: { skin: 'fair', top: C.pink, lower: C.pink, lowerPat: 'flower', scarf: C.yellow, head: 'tiara', jewel: true, female: true } },
  rishi:     { gender: 'm', age: 'old', look: { skin: 'wheat', top: 'bare', lower: C.saffron, lowerPat: 'hatch', scarf: C.saffron, head: 'jata', beard: 'long-white', mala: true, tilak: 'shiv', item: 'kamandal' } },
  rishika:   { gender: 'f', age: 'old', look: { skin: 'wheat', top: C.saffron, lower: C.saffron, lowerPat: 'hatch', scarf: C.white, head: 'bun-white', mala: true, female: true, item: 'mala' } },
  soldier:   { gender: 'm', age: 'adult', look: { skin: 'brown', top: C.maroon, topPat: 'scale', lower: C.indigo, lowerPat: 'stripes', head: 'helmet', moustache: true, item: 'spear', shield: true } },
  villager:  { gender: 'm', age: 'adult', look: { skin: 'brown', top: 'bare', lower: C.white, lowerPat: 'stripes', scarf: C.green, head: 'turban', moustache: true } },
  'village-woman': { gender: 'f', age: 'adult', look: { skin: 'brown', top: C.green, lower: C.yellow, lowerPat: 'dots', scarf: C.green, head: 'veil', female: true, item: 'pot' } },
  'young-rishi': { gender: 'm', age: 'kid', look: { skin: 'wheat', top: 'bare', lower: C.saffron, lowerPat: 'hatch', scarf: C.saffron, head: 'tuft', mala: true, tilak: 'vaishnav', kid: true } },
  // Deities and divine figures (traditional forms)
  ram:       { gender: 'm', age: 'adult', divine: true, look: { skin: 'blue', top: 'bare', lower: C.yellow, lowerPat: 'stripes', scarf: C.saffron, head: 'crown', jewel: true, item: 'bow', quiver: true, tilak: 'vaishnav', halo: true } },
  sita:      { gender: 'f', age: 'adult', divine: true, look: { skin: 'fair', top: C.red, lower: C.red, lowerPat: 'flower', scarf: C.yellow, head: 'crown-f', jewel: true, female: true, halo: true, item: 'lotus' } },
  lakshman:  { gender: 'm', age: 'adult', divine: true, look: { skin: 'fair', top: 'bare', lower: C.green, lowerPat: 'chev', scarf: C.yellow, head: 'crown', jewel: true, item: 'bow', quiver: true, tilak: 'vaishnav' } },
  bharat:    { gender: 'm', age: 'adult', look: { skin: 'wheat', top: 'bare', lower: C.yellow, lowerPat: 'stripes', scarf: C.red, head: 'crown', jewel: true, tilak: 'vaishnav' } },
  hanuman:   { gender: 'm', age: 'adult', divine: true, look: { skin: 'orange', face: 'vanara', top: 'bare', lower: C.red, lowerPat: 'stripes', scarf: C.yellow, head: 'crown', jewel: true, item: 'gada', tail: true, tilak: 'sindoor', halo: true } },
  krishna:   { gender: 'm', age: 'adult', divine: true, look: { skin: 'blue', top: 'bare', lower: C.yellow, lowerPat: 'chev', scarf: C.green, head: 'crown-peacock', jewel: true, item: 'flute', tilak: 'vaishnav', halo: true } },
  radha:     { gender: 'f', age: 'adult', divine: true, look: { skin: 'fair', top: C.pink, lower: C.pink, lowerPat: 'flower', scarf: C.yellow, head: 'crown-f', jewel: true, female: true, halo: true } },
  shiva:     { gender: 'm', age: 'adult', divine: true, look: { skin: 'ashblue', top: 'bare', lower: C.brown, lowerPat: 'leaf', lowerName: 'tiger-skin', head: 'jata-moon', mala: true, snake: true, tilak: 'tripundra', thirdEye: true, item: 'trishul', halo: true } },
  parvati:   { gender: 'f', age: 'adult', divine: true, look: { skin: 'fair', top: C.red, lower: C.red, lowerPat: 'flower', scarf: C.green, head: 'crown-f', jewel: true, female: true, halo: true, item: 'lotus' } },
  ganesha:   { gender: 'm', age: 'adult', divine: true, look: { skin: 'orange', face: 'elephant', top: 'bare', lower: C.yellow, lowerPat: 'stripes', scarf: C.red, head: 'crown', jewel: true, item: 'modak', arms4: ['axe', 'lotus'], belly: true, halo: true } },
  durga:     { gender: 'f', age: 'adult', divine: true, look: { skin: 'gold', top: C.red, lower: C.red, lowerPat: 'flower', scarf: C.yellow, head: 'crown-f', jewel: true, female: true, item: 'trishul', arms4: ['sword', 'chakra'], halo: true, tilak: 'bindi-big' } },
  vishnu:    { gender: 'm', age: 'adult', divine: true, look: { skin: 'blue', top: 'bare', lower: C.yellow, lowerPat: 'stripes', scarf: C.red, head: 'crown', jewel: true, item: 'gada', arms4: ['chakra', 'conch'], tilak: 'vaishnav', halo: true } },
  lakshmi:   { gender: 'f', age: 'adult', divine: true, look: { skin: 'fair', top: C.red, lower: C.red, lowerPat: 'flower', scarf: C.yellow, head: 'crown-f', jewel: true, female: true, item: 'lotus', arms4: ['lotus', 'coins'], halo: true } },
  brahma:    { gender: 'm', age: 'old', divine: true, look: { skin: 'gold', top: 'bare', lower: C.white, lowerPat: 'stripes', scarf: C.red, head: 'crown', beard: 'long-white', heads: 3, item: 'book', arms4: ['kamandal', 'mala'], halo: true } },
  shani:     { gender: 'm', age: 'adult', divine: true, look: { skin: 'navy', top: 'bare', lower: C.indigo, lowerPat: 'stripes', scarf: '#5b3b8c', head: 'crown', jewel: true, item: 'bow', tilak: 'vaishnav', halo: true } },
  surya:     { gender: 'm', age: 'adult', divine: true, look: { skin: 'gold', top: 'bare', lower: C.saffron, lowerPat: 'chev', scarf: C.red, head: 'crown', jewel: true, item: 'lotus', halo: 'sun' } },
  indra:     { gender: 'm', age: 'adult', divine: true, look: { skin: 'wheat', top: 'bare', lower: C.yellow, lowerPat: 'scale', scarf: C.blue, head: 'crown', jewel: true, item: 'vajra', halo: true } },
  narada:    { gender: 'm', age: 'old', divine: true, look: { skin: 'fair', top: 'bare', lower: C.white, lowerPat: 'hatch', scarf: C.saffron, head: 'tuft', beard: 'short-white', mala: true, tilak: 'vaishnav', item: 'veena' } },
  ravana:    { gender: 'm', age: 'adult', look: { skin: 'brown', top: 'bare', lower: C.maroon, lowerPat: 'scale', scarf: C.black, head: 'crown', jewel: true, moustache: true, heads: 10, item: 'sword' } },
  asura:     { gender: 'm', age: 'big', look: { skin: 'green', top: 'bare', lower: C.maroon, lowerPat: 'scale', scarf: C.black, head: 'horns', moustache: true, fangs: true, item: 'gada' } },
  vanara:    { gender: 'm', age: 'adult', look: { skin: 'brown', face: 'vanara', top: 'bare', lower: C.green, lowerPat: 'stripes', head: 'none', tail: true, item: 'gada' } },
  // Animals of the stories
  deer:      { gender: 'f', age: 'kid', animal: 'deer' },
  cow:       { gender: 'f', age: 'adult', animal: 'cow' },
  peacock:   { gender: 'm', age: 'adult', animal: 'peacock' },
  fish:      { gender: 'f', age: 'kid', animal: 'fish' },
  snake:     { gender: 'm', age: 'adult', animal: 'snake' },
  parrot:    { gender: 'f', age: 'kid', animal: 'parrot' },
  horse:     { gender: 'm', age: 'adult', animal: 'horse' },
  swan:      { gender: 'f', age: 'adult', animal: 'swan' },
};

export const MYTH_ALIASES = {
  raja: 'king', maharaja: 'king', samrat: 'king', emperor: 'king', rani: 'queen', maharani: 'queen', rajkumar: 'prince', kumar: 'prince', rajkumari: 'princess',
  rishi: 'rishi', sage: 'rishi', muni: 'rishi', saint: 'rishi', guru: 'rishi', hermit: 'rishi', yogi: 'rishi', sadhu: 'rishi', tapasvi: 'rishi', maharishi: 'rishi',
  sadhvi: 'rishika', 'female-sage': 'rishika', yoddha: 'soldier', sainik: 'soldier', warrior: 'soldier', guard: 'soldier', kisan: 'villager', farmer: 'villager', gramin: 'villager',
  disciple: 'young-rishi', shishya: 'young-rishi', 'young-sage': 'young-rishi',
  rama: 'ram', 'shri-ram': 'ram', shriram: 'ram', raghav: 'ram', siya: 'sita', janaki: 'sita', vaidehi: 'sita', laxman: 'lakshman', lakshmana: 'lakshman',
  bajrangbali: 'hanuman', 'hanuman-ji': 'hanuman', hanumanji: 'hanuman', maruti: 'hanuman', pawanputra: 'hanuman', 'monkey-god': 'hanuman',
  kanha: 'krishna', kanhaiya: 'krishna', 'shri-krishna': 'krishna', govind: 'krishna', gopal: 'krishna', murari: 'krishna', keshav: 'krishna',
  mahadev: 'shiva', shiv: 'shiva', shankar: 'shiva', bholenath: 'shiva', mahesh: 'shiva', rudra: 'shiva', gauri: 'parvati', uma: 'parvati',
  ganesh: 'ganesha', ganpati: 'ganesha', vinayak: 'ganesha', ganapati: 'ganesha', gajanan: 'ganesha', 'durga-maa': 'durga', amba: 'durga', bhavani: 'durga', devi: 'durga',
  narayan: 'vishnu', hari: 'vishnu', 'laxmi': 'lakshmi', 'lakshmi-maa': 'lakshmi', shanidev: 'shani', 'shani-dev': 'shani', shanidev_: 'shani', saturn: 'shani',
  suryadev: 'surya', 'surya-dev': 'surya', 'sun-god': 'surya', indradev: 'indra', 'narad-muni': 'narada', narad: 'narada', raavan: 'ravana', ravan: 'ravana', lankesh: 'ravana', dashanan: 'ravana',
  demon: 'asura', rakshas: 'asura', rakshasa: 'asura', daitya: 'asura', danav: 'asura', vanar: 'vanara',
  hiran: 'deer', hiran_: 'deer', mriga: 'deer', 'golden-deer': 'deer', fawn: 'deer', gau: 'cow', gaay: 'cow', kamdhenu: 'cow', nandi: 'cow', mor: 'peacock', machli: 'fish', matsya: 'fish',
  naag: 'snake', nag: 'snake', serpent: 'snake', sheshnag: 'snake', vasuki: 'snake', tota: 'parrot', ghoda: 'horse', ashva: 'horse', hans: 'swan', hamsa: 'swan',
  // Hindi
  'राजा': 'king', 'रानी': 'queen', 'राजकुमार': 'prince', 'राजकुमारी': 'princess', 'ऋषि': 'rishi', 'मुनि': 'rishi', 'साधु': 'rishi', 'सैनिक': 'soldier', 'किसान': 'villager',
  'राम': 'ram', 'श्रीराम': 'ram', 'सीता': 'sita', 'लक्ष्मण': 'lakshman', 'भरत': 'bharat', 'हनुमान': 'hanuman', 'बजरंगबली': 'hanuman', 'कृष्ण': 'krishna', 'राधा': 'radha',
  'शिव': 'shiva', 'महादेव': 'shiva', 'पार्वती': 'parvati', 'गणेश': 'ganesha', 'दुर्गा': 'durga', 'विष्णु': 'vishnu', 'लक्ष्मी': 'lakshmi', 'ब्रह्मा': 'brahma',
  'शनि': 'shani', 'शनिदेव': 'shani', 'सूर्य': 'surya', 'इंद्र': 'indra', 'नारद': 'narada', 'रावण': 'ravana', 'राक्षस': 'asura', 'वानर': 'vanara',
  'हिरण': 'deer', 'मृग': 'deer', 'गाय': 'cow', 'मोर': 'peacock', 'मछली': 'fish', 'सांप': 'snake', 'नाग': 'snake', 'तोता': 'parrot', 'घोड़ा': 'horse', 'हंस': 'swan',
};

// ── parts ──
const HEAD_C = { x: 104, y: 46 };

function facePath(dx = 0, dy = 0, k = 1) {
  const p = (x, y) => `${f1(HEAD_C.x + (x - HEAD_C.x) * k + dx)} ${f1(HEAD_C.y + (y - HEAD_C.y) * k + dy)}`;
  // Profile facing right: back of head, forehead, the long Madhubani nose, lips, chin, jaw.
  return `M${p(80, 30)} C${p(82, 12)} ${p(102, 6)} ${p(118, 13)} C${p(126, 18)} ${p(129, 28)} ${p(129, 37)} L${p(137, 51)} L${p(129, 54)} C${p(130, 57)} ${p(129, 60)} ${p(127, 62)} L${p(129, 65)} C${p(127, 70)} ${p(124, 73)} ${p(118, 77)} C${p(107, 83)} ${p(91, 80)} ${p(84, 70)} C${p(77, 60)} ${p(76, 44)} ${p(80, 30)} Z`;
}

function eyeAndBrow(ink, mood, dx = 0, dy = 0, k = 1) {
  const p = (x, y) => `${f1(HEAD_C.x + (x - HEAD_C.x) * k + dx)} ${f1(HEAD_C.y + (y - HEAD_C.y) * k + dy)}`;
  const lift = mood === 'angry' ? 4 : mood === 'sad' || mood === 'worried' ? -3 : mood === 'surprised' ? -5 : 0;
  // The fish-shaped Madhubani eye with its long tail toward the temple.
  const eye = `<g class="eye"><path d="M${p(101, 41)} Q${p(113, 31)} ${p(125, 40)} Q${p(113, 48)} ${p(101, 41)} Z" fill="#fffaf0" stroke="${ink}" stroke-width="${f1(2 * k)}"/><circle cx="${p(117, 40).split(' ')[0]}" cy="${p(117, 40).split(' ')[1]}" r="${f1(4.2 * k)}" fill="${ink}"/><path d="M${p(101, 41)} L${p(93, 38)}" stroke="${ink}" stroke-width="${f1(1.8 * k)}" stroke-linecap="round"/></g>`;
  const brow = mood === 'angry'
    ? `M${p(101, 30 + lift)} Q${p(114, 28)} ${p(127, 35)}`
    : `M${p(100, 32 + lift)} Q${p(114, 22 + lift)} ${p(127, 31 + lift / 2)}`;
  return `<g class="ch-eyes">${eye}</g>${line(brow, ink, 2.2 * k)}`;
}

function mouthParts(ink, mood, red) {
  const mx = 125, my = 66;
  const s = (d, w = 1.8) => line(d, ink, w);
  let closed;
  switch (mood) {
    case 'sad': case 'worried': closed = s(`M${mx - 6} ${my + 1} q3 -3 6 0`); break;
    case 'angry': closed = s(`M${mx - 6} ${my} h6`, 2.2); break;
    case 'surprised': closed = `<ellipse cx="${mx - 2}" cy="${my}" rx="2.6" ry="3.4" fill="${ink}"/>`; break;
    default: closed = `<path d="M${mx - 7} ${my - 1} q4 4 8 0" fill="none" stroke="${ink}" stroke-width="1.8" stroke-linecap="round"/><path d="M${mx - 6} ${my} q3 2 6 0" fill="${red}" opacity=".85"/>`;
  }
  const V = {
    A: s(`M${mx - 6} ${my} h6`),
    B: `<path d="M${mx - 7} ${my - 1} q4 4 8 0 q-4 1 -8 0" fill="${ink}"/>`,
    C: `<path d="M${mx - 8} ${my - 1.5} q5 6 9 0 q-5 1.5 -9 0" fill="${ink}"/>`,
    D: `<ellipse cx="${mx - 3}" cy="${my + 0.5}" rx="4.4" ry="4.2" fill="${ink}"/>`,
    E: `<ellipse cx="${mx - 3}" cy="${my + 0.5}" rx="3" ry="3.8" fill="${ink}"/>`,
    F: `<ellipse cx="${mx - 2.5}" cy="${my}" rx="2" ry="2.4" fill="${ink}"/>`,
    G: s(`M${mx - 6} ${my} q3 2.5 6 0`),
    H: `<ellipse cx="${mx - 3}" cy="${my + 0.5}" rx="3.8" ry="3" fill="${ink}"/>`,
  };
  return `<g class="ch-mouth-closed">${closed}</g><g class="ch-mouth-open">${V.D}</g><g class="ch-vis">${Object.entries(V).map(([k, d]) => `<g class="v${k}">${d}</g>`).join('')}</g>`;
}

function headwear(kind, L, ink, shape) {
  const g = C.gold, r = C.red;
  switch (L.head) {
    case 'crown': return {
      back: '',
      front: shape('M83 24 L84 -2 L93 8 L99 -14 L106 4 L113 -10 L118 6 L125 -2 L124 24 C112 18 96 18 83 24 Z', g, 'dots')
        + `<circle cx="104" cy="12" r="4.2" fill="${r}" stroke="${ink}" stroke-width="1.6"/><circle cx="104" cy="-2" r="2.2" fill="${r}"/>`
        + line('M84 22 C96 16 112 16 124 22', ink, 1.6),
    };
    case 'crown-s': return { back: '', front: shape('M84 24 L86 6 L96 12 L104 0 L112 12 L122 6 L124 24 C112 19 96 19 84 24 Z', g, 'dots') + `<circle cx="104" cy="13" r="3.4" fill="${r}"/>` };
    case 'crown-peacock': return {
      back: '',
      front: shape('M84 24 L86 4 L96 11 L104 -4 L112 11 L122 4 L124 24 C112 19 96 19 84 24 Z', g, 'dots')
        // The peacock feather: a curved quill with its eye.
        + line('M112 4 C118 -14 124 -26 120 -40', C.green, 2.6)
        + `<path d="M120 -40 C111 -38 108 -26 116 -21 C125 -18 130 -30 120 -40 Z" fill="${C.green}" stroke="${ink}" stroke-width="1.6"/><ellipse cx="118" cy="-29" rx="4.2" ry="5.4" fill="${C.blue}" stroke="${ink}" stroke-width="1.2"/><circle cx="118" cy="-29" r="2" fill="${C.yellow}"/>`,
    };
    case 'crown-f': return {
      back: `<circle cx="80" cy="34" r="13" fill="${ink}"/>` + `<circle cx="72" cy="30" r="2.6" fill="${C.white}"/><circle cx="77" cy="24" r="2.6" fill="${C.white}"/>`,
      front: shape('M86 22 L88 6 L97 13 L104 2 L111 13 L120 6 L122 22 C112 17 96 17 86 22 Z', g, 'dots') + `<circle cx="104" cy="12" r="3" fill="${r}"/>`,
    };
    case 'tiara': return { back: `<circle cx="80" cy="34" r="12" fill="${ink}"/>`, front: line('M86 22 C96 14 112 14 122 20', g, 3.4) + `<circle cx="104" cy="15" r="2.8" fill="${r}"/>` };
    case 'jata': return { back: '', front: `<path d="M84 20 C80 -6 100 -16 112 -8 C122 -2 124 12 122 20 C108 14 96 14 84 20 Z" fill="${C.brown}" stroke="${ink}" stroke-width="2.6"/>` + line('M90 10 C96 2 104 -2 112 0 M88 2 C96 -8 106 -10 114 -6', ink, 1.4) + `<path d="M84 22 C96 17 112 17 122 22" fill="none" stroke="${C.saffron}" stroke-width="3"/>` };
    case 'jata-moon': return {
      back: `<path d="M84 26 C70 40 66 70 72 96" fill="none" stroke="${C.brown}" stroke-width="7" stroke-linecap="round"/>`,
      front: `<path d="M84 20 C78 -10 98 -22 112 -12 C124 -4 126 12 122 20 C108 14 96 14 84 20 Z" fill="${C.brown}" stroke="${ink}" stroke-width="2.6"/>` + line('M90 8 C96 0 104 -4 112 -2 M88 0 C96 -10 106 -12 114 -8', ink, 1.4)
        // Crescent moon, and the Ganga as a small stream from the hair.
        + `<path d="M114 -14 A8 8 0 1 0 120 -2 A6 6 0 1 1 114 -14 Z" fill="${C.white}" stroke="${ink}" stroke-width="1.4"/>`
        + `<path d="M96 -12 C92 -22 98 -28 94 -36" fill="none" stroke="#7cc6ff" stroke-width="3" stroke-linecap="round"/>`,
    };
    case 'bun-white': return { back: `<circle cx="84" cy="22" r="11" fill="${C.white}" stroke="${ink}" stroke-width="2.2"/>`, front: '' };
    case 'helmet': return { back: '', front: shape('M82 26 C82 4 100 -4 112 -2 C124 0 128 12 126 26 C112 20 96 20 82 26 Z', '#9aa4ad', 'scale') + line('M104 -4 V-14', ink, 2.4) + `<circle cx="104" cy="-16" r="3" fill="${r}"/>` };
    case 'turban': return { back: '', front: shape('M80 26 C78 6 96 -2 110 0 C124 2 130 14 128 26 C112 20 96 20 80 26 Z', C.yellow, 'stripes') + line('M84 18 C98 8 116 8 126 16', ink, 1.4) };
    case 'veil': return { back: `<path d="M78 16 C66 40 66 84 84 100 L96 96 C86 80 84 50 92 26 Z" fill="${L.scarf || C.green}" stroke="${ink}" stroke-width="2.4"/>`, front: shape('M80 26 C82 6 100 -2 114 4 C124 8 128 18 128 26 C112 18 96 18 80 26 Z', L.scarf || C.green, 'dots') };
    case 'tuft': return { back: '', front: `<path d="M86 14 C92 6 102 4 110 6" fill="none" stroke="${ink}" stroke-width="3"/><path d="M94 6 C92 -4 98 -10 102 -14" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>` };
    case 'horns': return { back: '', front: `<path d="M88 16 C80 4 80 -8 86 -16 C88 -6 92 2 96 10 Z" fill="#efe6d2" stroke="${ink}" stroke-width="2"/><path d="M114 12 C122 0 124 -10 120 -18 C116 -8 112 0 108 8 Z" fill="#efe6d2" stroke="${ink}" stroke-width="2"/>` };
    default: return { back: '', front: '' };
  }
}

function hairBack(L, ink) {
  if (L.face === 'elephant' || L.head === 'jata' || L.head === 'jata-moon' || L.head === 'helmet' || L.head === 'veil') return '';
  const c = L.head === 'bun-white' || L.beard === 'long-white' ? '#ece6d8' : ink;
  // Long hair falls behind the shoulder for women and deities; a short crop for others.
  return L.female || L.divine
    ? `<path d="M82 24 C70 42 70 78 80 106 L94 100 C86 80 84 52 92 30 Z" fill="${c}"/>`
    : `<path d="M81 26 C74 40 74 58 84 72 L90 64 C86 52 86 40 92 30 Z" fill="${c}"/>`;
}

const LONG_ITEMS = new Set(['gada', 'trishul', 'spear', 'bow', 'sword', 'axe', 'vajra', 'veena', 'flute']);

/** The items a hand can hold, drawn around the hand at (104, 192), pointing up or out. */
function heldItem(item, ink, shape) {
  const g = C.gold;
  switch (item) {
    case 'gada': return shape('M101 200 L126 112 L132 114 L107 202 Z', g, 'stripes', { lw: 0.7 }) + shape('M118 96 C118 80 146 80 146 96 C146 116 118 116 118 96 Z', g, 'scale') + `<circle cx="132" cy="80" r="3.6" fill="${g}" stroke="${ink}" stroke-width="1.6"/>`;
    case 'bow': return `<path d="M118 112 C142 150 142 232 118 268" fill="none" stroke="${C.brown}" stroke-width="5.5" stroke-linecap="round"/><path d="M118 112 C142 150 142 232 118 268" fill="none" stroke="${ink}" stroke-width="1.2"/>` + line('M118 112 L118 268', ink, 1);
    case 'trishul': return '<g transform="rotate(16 104 196)">' + line('M108 290 L108 40', C.brown, 4.6) + line('M108 290 L108 40', ink, 1) + `<path d="M108 40 L108 10 M96 46 C94 30 96 22 98 14 M120 46 C122 30 120 22 118 14 M96 46 H120" fill="none" stroke="${ink}" stroke-width="3.2" stroke-linecap="round"/>` + `<path d="M108 6 L104 14 H112 Z M98 10 L95 16 H101 Z M118 10 L115 16 H121 Z" fill="${ink}"/>` + `<rect x="102" y="58" width="12" height="10" rx="5" fill="#c9a26a" stroke="${ink}" stroke-width="1.4"/></g>`;
    case 'flute': return shape('M98 186 L162 150 L165 155 L101 191 Z', C.yellow, 'stripes', { lw: 0.6 }) + `<circle cx="120" cy="174" r="1.6" fill="${ink}"/><circle cx="132" cy="167" r="1.6" fill="${ink}"/><circle cx="144" cy="160" r="1.6" fill="${ink}"/>` + `<path d="M160 152 C166 160 164 172 158 180" fill="none" stroke="${C.red}" stroke-width="2.4"/>`;
    case 'lotus': return line('M104 196 L106 170', C.green, 3) + `<path d="M106 172 C96 166 94 152 100 144 C104 154 106 160 106 172 Z M106 172 C116 166 118 152 112 144 C108 154 106 160 106 172 Z M106 172 C102 158 104 144 106 138 C108 144 110 158 106 172 Z" fill="${C.pink}" stroke="${ink}" stroke-width="1.6"/>`;
    case 'sword': return shape('M100 188 L150 112 L156 116 L106 192 Z', '#cfd6dc', 'hatch', { lw: 0.6 }) + `<path d="M96 184 L112 196" stroke="${g}" stroke-width="5" stroke-linecap="round"/>`;
    case 'spear': return '<g transform="rotate(16 104 196)">' + line('M104 290 L104 30', C.brown, 4) + line('M104 290 L104 30', ink, 1) + `<path d="M104 8 L96 34 L104 30 L112 34 Z" fill="#cfd6dc" stroke="${ink}" stroke-width="1.6"/></g>`;
    case 'kamandal': return shape('M92 200 C88 222 120 222 116 200 Z', C.brown, 'dots', { lw: 0.7 }) + line('M96 200 C96 190 112 190 112 200', ink, 2.2) + line('M116 206 L128 198', ink, 2.4);
    case 'mala': return `<circle cx="104" cy="210" r="13" fill="none" stroke="${C.brown}" stroke-width="3.4" stroke-dasharray="1 3.6" stroke-linecap="round"/>`;
    case 'pot': return shape('M82 176 C70 176 66 206 90 210 C114 212 112 178 98 176 Z', C.ochre, 'chev', { lw: 0.7 }) + line('M86 176 h14', ink, 2.4);
    case 'modak': return `<path d="M98 186 C96 172 112 172 110 186 C108 192 100 192 98 186 Z" fill="${C.white}" stroke="${ink}" stroke-width="1.6"/>` + line('M104 174 V186', ink, 1);
    case 'axe': return line('M104 196 L118 140', C.brown, 3.6) + `<path d="M114 140 C126 128 136 138 130 150 Z" fill="#cfd6dc" stroke="${ink}" stroke-width="1.6"/>`;
    case 'chakra': return `<g><circle cx="106" cy="168" r="13" fill="${g}" stroke="${ink}" stroke-width="2"/><circle cx="106" cy="168" r="4" fill="${C.red}"/>${Array.from({ length: 12 }, (_, k) => { const a = k * Math.PI / 6; return line(`M${f1(106 + Math.cos(a) * 6)} ${f1(168 + Math.sin(a) * 6)} L${f1(106 + Math.cos(a) * 12)} ${f1(168 + Math.sin(a) * 12)}`, ink, 1.2); }).join('')}</g>`;
    case 'conch': return `<path d="M96 176 C92 160 110 152 118 162 C124 170 116 182 106 184 Z" fill="${C.white}" stroke="${ink}" stroke-width="1.8"/>` + line('M100 172 C104 166 110 166 114 170', ink, 1.2);
    case 'coins': return `<g fill="${g}" stroke="${ink}" stroke-width="1.2"><circle cx="100" cy="212" r="3.4"/><circle cx="106" cy="220" r="3.4"/><circle cx="98" cy="226" r="3.4"/><circle cx="108" cy="232" r="3.4"/></g>`;
    case 'book': return shape('M90 176 L120 172 L122 194 L92 198 Z', C.red, 'stripes', { lw: 0.6 });
    case 'vajra': return line('M104 196 L104 156', g, 4) + `<path d="M104 156 C96 150 96 138 104 132 C112 138 112 150 104 156 Z M104 196 C96 202 96 214 104 220 C112 214 112 202 104 196 Z" fill="${g}" stroke="${ink}" stroke-width="1.6"/>`;
    case 'veena': return line('M96 230 L132 120', C.brown, 4) + `<circle cx="96" cy="232" r="13" fill="${C.ochre}" stroke="${ink}" stroke-width="1.8"/><circle cx="130" cy="126" r="8" fill="${C.ochre}" stroke="${ink}" stroke-width="1.6"/>`;
    default: return '';
  }
}

function arm(side, skinC, L, ink, shape, extra = '', cls = '') {
  const jewel = L.jewel || L.divine ? `<path d="M93 124 h16" stroke="${C.gold}" stroke-width="4"/><path d="M97 178 h14 M97 172 h14" stroke="${L.female ? C.red : C.gold}" stroke-width="3"/>` : L.mala ? `<path d="M94 126 h15" stroke="${C.brown}" stroke-width="2.4" stroke-dasharray="1 3" stroke-linecap="round"/>` : '';
  const hand = `<path d="M96 186 C94 198 98 204 104 204 C112 204 114 196 112 186 Z" fill="${skinC}" stroke="${ink}" stroke-width="2"/>` + line('M100 196 v6 M104 197 v7 M108 196 v6', ink, 0.9);
  return `<g class="ch-arm ch-arm-${side}${cls}" style="transform-origin:100px 104px">${shape('M93 104 C90 130 95 152 97 186 L111 186 C111 152 114 130 109 104 Z', skinC, null, { lw: 0.8 })}${jewel}${hand}${extra}</g>`;
}

/** A person or deity. */
function personSvg(kind, info, o) {
  const L = { ...info.look, divine: info.divine };
  const u = `m${o.uid || kind}`.replace(/[^\w-]/g, '');
  const ink = o.ink || C.ink;
  const skinMode = o.skin || 'madhubani';
  const shape = makeShape(u, ink, skinMode);
  const skinC = SKIN[L.skin] || L.skin || SKIN.wheat;
  const mood = o.mood || 'happy';
  const female = !!L.female;

  // Halo behind the head (deities): a sun disc with petal rays, or a plain glow disc.
  let halo = '';
  if (L.halo) {
    const rays = Array.from({ length: 16 }, (_, k) => { const a = (k / 16) * Math.PI * 2; const x = 104 + Math.cos(a) * 46, y = 40 + Math.sin(a) * 46; const x2 = 104 + Math.cos(a) * 58, y2 = 40 + Math.sin(a) * 58; return `M${f1(x)} ${f1(y)} L${f1(x2)} ${f1(y2)}`; }).join(' ');
    halo = `<g class="ch-glow">${L.halo === 'sun' || skinMode === 'madhubani' ? line(rays, C.saffron, 4.2) : ''}<circle cx="104" cy="40" r="46" fill="${C.yellow}" fill-opacity=".85" stroke="${ink}" stroke-width="${skinMode === 'madhubani' ? 3.4 : 2}"/>${skinMode === 'madhubani' ? `<circle cx="104" cy="40" r="38" fill="none" stroke="${ink}" stroke-width="1.4" stroke-dasharray="2 4"/>` : ''}</g>`;
  }

  // Extra heads (Ravana's ten, Brahma's faces): smaller copies behind, to both sides.
  let extraHeads = '';
  if (L.heads > 1) {
    const n = L.heads - 1, per = Math.ceil(n / 2);
    for (let k = 0; k < n; k++) {
      const sideN = k < per ? -1 : 1, j = k < per ? k + 1 : k - per + 1;
      const dx = sideN * j * 22, dy = j * 6, kk = 0.78 - j * 0.04;
      const cy = 46 + dy - 34 * kk, cx = 104 + dx;
      extraHeads += `<g>${shape(facePath(dx, dy, kk), skinC, null, { lw: 0.7 })}${L.head === 'crown' ? shape(`M${f1(cx - 18 * kk)} ${f1(cy + 8)} L${f1(cx - 16 * kk)} ${f1(cy - 8)} L${f1(cx - 6 * kk)} ${f1(cy)} L${f1(cx)} ${f1(cy - 14 * kk)} L${f1(cx + 6 * kk)} ${f1(cy)} L${f1(cx + 16 * kk)} ${f1(cy - 8)} L${f1(cx + 18 * kk)} ${f1(cy + 8)} Z`, C.gold, 'dots', { lw: 0.6 }) : ''}${eyeAndBrow(ink, o.mood || 'angry', dx, dy, kk).replace('class="ch-eyes"', '')}</g>`;
    }
  }

  // Head: the face (person, vanara or elephant), eye, mouth, ear and earring, tilak, beard.
  let face;
  if (L.face === 'elephant') {
    // Ganesha: elephant head with a large ear, a curling trunk and one tusk.
    face = shape('M76 30 C76 6 102 0 118 8 C134 16 136 34 132 46 C130 60 140 72 146 84 C150 94 142 104 134 98 C140 92 136 84 128 76 C120 70 112 74 104 78 C90 82 76 66 76 30 Z', skinC, null)
      + shape('M86 24 C66 18 58 42 64 62 C70 80 86 82 92 70 C96 58 94 38 86 24 Z', skinC, 'dots', { lw: 0.8 })
      + `<path d="M116 66 L132 76 L118 74 Z" fill="${C.white}" stroke="${ink}" stroke-width="1.4"/>`
      + `<g class="ch-eyes"><g class="eye"><path d="M106 36 Q114 30 122 36 Q114 41 106 36 Z" fill="#fffaf0" stroke="${ink}" stroke-width="1.8"/><circle cx="116" cy="35.5" r="3" fill="${ink}"/></g></g>`
      + `<g class="ch-mouth-closed">${line('M118 70 q4 3 8 0', ink, 1.6)}</g><g class="ch-mouth-open"><ellipse cx="121" cy="71" rx="4" ry="3.4" fill="${ink}"/></g><g class="ch-vis">${'ABCDEFGH'.split('').map((k) => `<g class="v${k}"><ellipse cx="121" cy="71" rx="${k === 'A' || k === 'G' ? 3 : 4}" ry="${k === 'D' ? 3.6 : 2.4}" fill="${ink}"/></g>`).join('')}</g>`;
  } else {
    const vanara = L.face === 'vanara';
    face = shape(facePath(), skinC, null);
    if (vanara) {
      // Vanara: a pale muzzle and a fur fringe around the face.
      face += `<path d="M108 50 C116 44 136 48 136 58 C136 70 124 78 114 74 C106 70 104 58 108 50 Z" fill="#f6c99a" stroke="${ink}" stroke-width="2"/>`
        + line('M84 30 C78 40 78 62 86 72', '#f6c99a', 6)
        + `<path d="M132 54 L136 56" stroke="${ink}" stroke-width="2"/>`;
    }
    face += eyeAndBrow(ink, mood);
    face += mouthParts(ink, mood, C.red);
    // Ear with an earring.
    face += `<path d="M90 42 C84 40 82 52 90 56" fill="${skinC}" stroke="${ink}" stroke-width="1.8"/>`;
    if (L.jewel || L.female || L.divine) face += `<circle cx="90" cy="62" r="4.4" fill="${C.gold}" stroke="${ink}" stroke-width="1.4"/>`;
    // Tilak and third eye.
    if (L.tilak === 'vaishnav') face += line('M124 28 L124 18 M128 28 L129 18', C.white, 2) + line('M126 28 L126 19', C.red, 1.8);
    if (L.tilak === 'tripundra') face += line('M117 20 L128 21 M117 24 L129 25 M118 28 L129 29', C.white, 1.8);
    if (L.tilak === 'sindoor') face += line('M126 30 L126 16', C.red, 3);
    if (L.tilak === 'shiv') face += line('M118 22 L128 23 M118 26 L129 27', C.white, 1.6) + `<circle cx="126" cy="30" r="1.6" fill="${C.red}"/>`;
    if (L.tilak === 'bindi-big' || (female && !L.tilak)) face += `<circle cx="127" cy="31" r="2.2" fill="${C.red}"/>`;
    if (L.thirdEye) face += `<path d="M124 22 Q126 16 128 22 Q126 26 124 22 Z" fill="${C.white}" stroke="${ink}" stroke-width="1.2"/>`;
    if (L.moustache) face += `<path d="M120 59 C124 55 132 56 136 61 C130 59 124 60 120 63 Z" fill="${ink}"/>`;
    if (L.fangs) face += `<path d="M122 66 l2 5 l2 -5 Z" fill="${C.white}" stroke="${ink}" stroke-width="1"/>`;
    if (L.beard === 'long-white') face += shape('M92 66 C96 84 106 112 116 118 C126 110 130 86 128 66 C118 76 104 76 92 66 Z', '#ece6d8', 'hatch', { lw: 0.7 });
    if (L.beard === 'short-white') face += shape('M100 70 C104 86 118 90 128 70 C118 78 108 78 100 70 Z', '#ece6d8', 'hatch', { lw: 0.7 });
  }

  const hw = headwear(kind, L, ink, shape);
  const headG = `<g class="ch-head" style="transform-origin:100px 96px">${hairBack(L, ink)}${hw.back}${extraHeads}${face}${hw.front}</g>`;

  // Neck, torso and garments.
  const neck = shape('M95 74 L95 100 L111 100 L110 74 Z', skinC, null, { lw: 0.7 });
  const chest = L.top === 'bare' || !L.top ? skinC : L.top;
  let torso = shape(L.belly ? 'M74 102 C86 92 118 92 130 102 C144 130 146 168 128 194 L76 194 C64 168 66 130 74 102 Z' : 'M76 102 C86 94 118 94 128 102 L129 150 C124 168 125 182 127 194 L77 194 C79 180 80 166 75 150 Z',
    chest, L.top && L.top !== 'bare' ? (L.topPat || 'dots') : null);
  if (L.top === 'bare' || !L.top) torso += line('M92 132 C98 136 108 136 114 132', ink, 1.2); // chest line
  // Sacred thread, necklaces, rudraksha mala, the snake around Shiva's neck.
  if (!female && L.top === 'bare') torso += line('M88 104 C100 140 112 170 120 194', '#f6efdc', 1.8);
  if (L.jewel || L.divine) torso += `<path d="M90 102 C96 120 112 120 118 102" fill="none" stroke="${C.gold}" stroke-width="4"/><circle cx="104" cy="118" r="3.6" fill="${C.red}" stroke="${ink}" stroke-width="1.2"/>`;
  if (L.mala) torso += `<path d="M88 102 C92 140 116 140 120 102" fill="none" stroke="${C.brown}" stroke-width="3.6" stroke-dasharray="1 3.4" stroke-linecap="round"/>`;
  if (L.snake) torso += `<path d="M86 100 C92 116 116 116 122 100 C126 92 132 92 134 100" fill="none" stroke="${C.green}" stroke-width="6" stroke-linecap="round"/><path d="M86 100 C92 116 116 116 122 100 C126 92 132 92 134 100" fill="none" stroke="${ink}" stroke-width="1.2" stroke-dasharray="3 3"/><circle cx="134" cy="99" r="4" fill="${C.green}" stroke="${ink}" stroke-width="1.4"/>`;
  // The scarf (angavastram / saree pallu) across the body.
  if (L.scarf) torso += shape(female ? 'M80 100 L126 104 L128 196 L112 196 C110 160 98 126 80 100 Z' : 'M77 112 C94 120 112 128 129 140 L129 152 C110 140 94 132 76 126 Z', L.scarf, female ? 'flower' : 'chev', { lw: 0.8 });

  // Lower garment: dhoti, saree or tiger skin, flared to the ankles, with a patterned border.
  const lowerD = 'M76 188 L128 188 C134 220 140 250 146 278 L58 278 C64 250 70 220 76 188 Z';
  let lower = shape(lowerD, L.lower || C.yellow, L.lowerPat || 'stripes');
  if (L.lowerName === 'tiger-skin') lower += line('M76 210 l8 4 M92 230 l9 4 M110 214 l10 3 M118 244 l10 4 M84 256 l9 4', ink, 3);
  lower += shape('M60 266 L145 266 L146 278 L58 278 Z', C.red, 'band', { lw: 0.6 });
  // Waist sash (patka) hanging at the front.
  lower += shape('M100 188 L110 188 L114 244 L104 248 Z', L.scarf || C.red, 'hatch', { lw: 0.6 });
  if (L.belly) lower += line('M82 190 H124', C.gold, 4);

  const leg = (side) => {
    const x = side === 'l' ? 88 : 112;
    return `<g class="ch-leg ch-leg-${side}" style="transform-origin:${x}px 196px">${shape(`M${x - 6} 276 L${x + 6} 276 L${x + 6} 286 L${x - 6} 286 Z`, skinC, null, { lw: 0.6 })}<path d="M${x - 8} 286 C${x - 8} 294 ${x + 16} 295 ${x + 16} 288 C${x + 12} 284 ${x} 284 ${x - 8} 286 Z" fill="${skinC}" stroke="${ink}" stroke-width="1.8"/>${L.jewel || L.female ? `<path d="M${x - 6} 282 h12" stroke="${C.gold}" stroke-width="2.6"/>` : ''}</g>`;
  };

  // Tail (vanara): a long curl rising behind.
  const tail = L.tail ? `<path d="M84 230 C46 236 30 200 40 160 C48 130 70 128 66 150" fill="none" stroke="${skinC}" stroke-width="9" stroke-linecap="round"/><path d="M84 230 C46 236 30 200 40 160 C48 130 70 128 66 150" fill="none" stroke="${ink}" stroke-width="1.6" stroke-dasharray="${skinMode === 'madhubani' ? '4 3' : '0'}"/>` : '';
  const quiver = L.quiver ? shape('M70 104 L84 98 L96 170 L82 176 Z', C.brown, 'stripes', { lw: 0.7 }) + line('M74 100 L70 82 M78 98 L76 80 M82 96 L82 78', ink, 1.6) : '';
  const shield = L.shield ? `<circle cx="80" cy="168" r="22" fill="${C.ochre}" stroke="${ink}" stroke-width="3"/><circle cx="80" cy="168" r="6" fill="${C.gold}" stroke="${ink}" stroke-width="1.4"/>` : '';

  // Four-armed deities: two more arms, raised, behind the body.
  const arms4 = L.arms4 ? `<g style="transform-origin:100px 104px;transform:rotate(38deg)">${arm('l2', skinC, L, ink, shape, heldItem(L.arms4[1], ink, shape), ' ch-arm-x')}</g><g style="transform-origin:100px 104px;transform:rotate(-142deg)">${arm('r2', skinC, L, ink, shape, `<g transform="rotate(180 104 192)">${heldItem(L.arms4[0], ink, shape)}</g>`, ' ch-arm-x')}</g>` : '';

  // Long weapons go in the far hand (drawn behind the head), so a raised arm never covers a face;
  // small things (flute, lotus, modak…) stay in the near hand, in front.
  const long = LONG_ITEMS.has(L.item);
  const backHand = long ? heldItem(L.item, ink, shape) : '';
  const frontHand = (long ? '' : heldItem(L.item, ink, shape)) + shield;
  const body = `${tail}${quiver}${arms4}${arm('l', skinC, L, ink, shape, backHand)}${leg('l')}${leg('r')}${lower}${neck}${torso}${headG}${arm('r', skinC, L, ink, shape, frontHand)}`;
  const kidT = L.kid ? ' transform="translate(100 293) scale(0.8) translate(-100 -293)"' : '';
  const shadow = `<ellipse class="ch-shadow" cx="102" cy="293" rx="44" ry="5" fill="#00000020"/>`;
  return `<svg class="chr plan-myth skin-${skinMode}${female ? ' st-f' : ''} pose-${o.pose || 'idle'} mood-${mood}" viewBox="${VIEWBOX}" role="img" aria-label="${kind}">${patterns(u, ink)}${halo}${shadow}<g class="ch-all"${kidT}><g class="ch-body">${body}</g></g></svg>`;
}

// ── animals (side view, facing right; legs are the rig's legs so they walk) ──
function animalSvg(kind, info, o) {
  const u = `m${o.uid || kind}`.replace(/[^\w-]/g, '');
  const ink = o.ink || C.ink;
  const skinMode = o.skin || 'madhubani';
  const shape = makeShape(u, ink, skinMode);
  const eye = (x, y, r = 4) => `<g class="ch-eyes"><g class="eye"><path d="M${x - r * 1.6} ${y} Q${x} ${y - r * 1.4} ${x + r * 1.6} ${y} Q${x} ${y + r * 1.2} ${x - r * 1.6} ${y} Z" fill="#fffaf0" stroke="${ink}" stroke-width="1.6"/><circle cx="${x + 1}" cy="${y}" r="${f1(r * 0.7)}" fill="${ink}"/></g></g>`;
  const mouth = (x, y) => `<g class="ch-mouth-closed">${line(`M${x - 4} ${y} q3 2 6 0`, ink, 1.4)}</g><g class="ch-mouth-open"><ellipse cx="${x - 1}" cy="${y + 1}" rx="3" ry="3" fill="${ink}"/></g><g class="ch-vis">${'ABCDEFGH'.split('').map((k) => `<g class="v${k}"><ellipse cx="${x - 1}" cy="${y + 1}" rx="3" ry="${k === 'D' || k === 'E' ? 3 : 1.8}" fill="${ink}"/></g>`).join('')}</g>`;
  const legs4 = (xs, top, color, pat) => {
    const one = (x) => shape(`M${x - 5} ${top} L${x + 5} ${top} L${x + 4} 286 L${x - 4} 286 Z`, color, pat, { lw: 0.6 }) + `<path d="M${x - 5} 286 h10 v6 h-10 Z" fill="${ink}"/>`;
    return `<g class="ch-leg ch-leg-l" style="transform-origin:${xs[0]}px ${top}px">${one(xs[0])}${one(xs[2])}</g><g class="ch-leg ch-leg-r" style="transform-origin:${xs[1]}px ${top}px">${one(xs[1])}${one(xs[3])}</g>`;
  };
  let body = '', head = '';
  switch (info.animal) {
    case 'deer': {
      const c = '#d58a3e';
      body = legs4([62, 76, 128, 142], 216, c, null) + shape('M48 186 C50 160 90 150 120 156 C146 160 158 176 152 196 C146 222 104 226 70 220 C54 216 46 202 48 186 Z', c, 'dots')
        + `<g fill="${C.white}">${[[70, 180], [88, 172], [106, 176], [124, 170], [96, 196], [120, 196], [78, 200]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" stroke="${ink}" stroke-width="1"/>`).join('')}</g>`
        + `<path d="M50 180 C40 172 38 160 46 158" fill="none" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`;
      head = shape('M138 162 C136 132 144 112 156 104 C170 98 182 108 180 122 C178 132 168 134 160 140 C156 150 154 160 150 168 Z', c, null)
        + line('M150 108 C144 90 140 78 146 66 M146 84 L134 76 M150 98 L160 84 C164 74 170 70 176 66 M162 82 L172 84', C.brown, 3.4)
        + `<path d="M150 112 C140 104 136 112 144 118 Z" fill="${c}" stroke="${ink}" stroke-width="1.6"/>` + eye(166, 116, 3.6) + mouth(176, 126) + `<circle cx="180" cy="122" r="2.2" fill="${ink}"/>`;
      break;
    }
    case 'cow': {
      const c = '#f1ead9';
      body = legs4([58, 74, 132, 148], 220, c, null) + shape('M42 180 C44 152 90 146 130 150 C160 152 170 172 162 200 C156 224 110 228 70 224 C48 220 40 204 42 180 Z', c, 'dots')
        + shape('M84 162 C96 156 112 162 110 176 C104 190 86 186 84 162 Z', C.brown, null, { lw: 0.6 }) + `<path d="M44 176 C30 190 30 214 36 226" fill="none" stroke="${c}" stroke-width="5"/>`
        + `<path d="M110 222 C114 236 128 236 130 222 Z" fill="${C.pink}" stroke="${ink}" stroke-width="1.6"/>`;
      head = shape('M150 156 C148 130 158 112 172 110 C186 110 192 124 188 140 C186 152 178 160 166 164 Z', c, null)
        + `<path d="M160 116 C152 100 156 92 164 92 M178 112 C184 98 182 90 174 88" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
        + `<path d="M158 124 C146 120 142 128 152 132 Z" fill="${c}" stroke="${ink}" stroke-width="1.6"/>` + eye(172, 128, 3.6) + mouth(184, 150) + `<circle cx="168" cy="164" r="5" fill="${C.gold}" stroke="${ink}" stroke-width="1.4"/>`;
      break;
    }
    case 'peacock': {
      const tail = Array.from({ length: 7 }, (_, k) => { const a = -Math.PI * 0.95 + k * 0.17; const x = 96 + Math.cos(a) * 110, y = 210 + Math.sin(a) * 110; return `<path d="M96 210 L${f1(x)} ${f1(y)}" stroke="${C.green}" stroke-width="3"/><ellipse cx="${f1(x)}" cy="${f1(y)}" rx="9" ry="12" fill="${C.green}" stroke="${ink}" stroke-width="1.6" transform="rotate(${f1(a * 180 / Math.PI + 90)} ${f1(x)} ${f1(y)})"/><circle cx="${f1(x)}" cy="${f1(y)}" r="5" fill="${C.blue}" stroke="${ink}" stroke-width="1"/><circle cx="${f1(x)}" cy="${f1(y)}" r="2" fill="${C.yellow}"/>`; }).join('');
      body = `<g>${tail}</g>` + legs4([96, 106, 96, 106], 236, C.ochre, null).replace(/M\d+ 286 h10 v6 h-10 Z/g, '') + shape('M80 230 C70 200 92 176 118 182 C140 188 140 220 126 236 C112 248 90 246 80 230 Z', C.blue, 'scale');
      head = shape('M120 186 C120 160 126 130 136 112 C142 102 154 104 154 116 C154 126 146 130 142 140 C138 156 136 172 134 188 Z', C.blue, 'scale', { lw: 0.8 }) + eye(146, 114, 3) + `<path d="M154 114 L164 118 L154 122 Z" fill="${C.ochre}" stroke="${ink}" stroke-width="1.4"/>` + mouth(158, 120)
        + line('M142 104 L138 90 M146 104 L148 90 M150 106 L156 94', ink, 1.6) + `<circle cx="138" cy="88" r="2.4" fill="${C.blue}"/><circle cx="148" cy="88" r="2.4" fill="${C.blue}"/><circle cx="157" cy="92" r="2.4" fill="${C.blue}"/>`;
      break;
    }
    case 'fish': {
      body = `<g class="ch-leg ch-leg-l"></g><g class="ch-leg ch-leg-r"></g>` + shape('M40 200 C70 150 150 150 170 196 C150 240 70 240 40 200 Z', C.vermilion, 'scale') + shape('M44 200 L14 172 L18 200 L14 228 Z', C.yellow, 'stripes') + shape('M96 160 C104 146 120 146 126 158 Z', C.yellow, 'stripes', { lw: 0.6 });
      head = eye(146, 192, 5) + mouth(166, 200) + line('M128 172 C134 186 134 206 128 222', '#1c140f', 2);
      break;
    }
    case 'snake': {
      body = `<g class="ch-leg ch-leg-l"></g><g class="ch-leg ch-leg-r"></g>` + `<path d="M20 280 C60 300 90 260 70 236 C50 212 90 190 120 210 C140 224 140 180 132 150" fill="none" stroke="${ink}" stroke-width="20" stroke-linecap="round"/><path d="M20 280 C60 300 90 260 70 236 C50 212 90 190 120 210 C140 224 140 180 132 150" fill="none" stroke="${C.green}" stroke-width="15" stroke-linecap="round"/><path d="M20 280 C60 300 90 260 70 236 C50 212 90 190 120 210 C140 224 140 180 132 150" fill="none" stroke="${ink}" stroke-width="2" stroke-dasharray="5 5"/>`;
      // A hood, as in the iconography of Shesh Naag.
      head = shape('M112 150 C104 118 118 98 134 98 C152 98 162 120 152 150 C144 158 120 158 112 150 Z', C.green, 'scale') + eye(140, 120, 3) + mouth(144, 134) + line('M144 140 l4 8 m-4 -8 l-2 8', C.red, 1.6);
      break;
    }
    case 'parrot': {
      body = legs4([100, 108, 100, 108], 250, C.ochre, null).replace(/M\d+ 286 h10 v6 h-10 Z/g, '') + shape('M80 250 C60 210 80 170 112 170 C140 172 144 210 128 246 C116 266 92 268 80 250 Z', C.green, 'leaf') + shape('M86 250 L66 288 L84 280 L94 256 Z', C.leaf, 'stripes', { lw: 0.6 });
      head = shape('M106 176 C100 146 118 128 136 132 C152 136 154 156 144 170 C136 180 118 184 106 176 Z', C.green, null) + `<path d="M146 146 C160 146 164 160 154 168 C150 160 148 154 144 152 Z" fill="${C.red}" stroke="${ink}" stroke-width="1.6"/>` + eye(134, 148, 3.4) + mouth(150, 166) + line('M112 174 C124 180 136 178 146 170', C.red, 2.4);
      break;
    }
    case 'horse': {
      const c = '#f4efe4';
      body = legs4([58, 76, 136, 152], 214, c, null) + shape('M40 186 C42 156 96 148 134 150 C162 152 172 172 166 196 C160 222 110 226 70 220 C50 216 38 204 40 186 Z', c, 'dots')
        + shape('M58 164 L132 160 L134 196 L60 198 Z', C.red, 'band', { lw: 0.6 }) + `<path d="M42 182 C24 196 24 226 32 246" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round"/>`;
      head = shape('M146 160 C144 124 152 96 168 86 C182 80 196 92 192 108 L180 140 C174 152 164 160 154 166 Z', c, null) + `<path d="M150 96 C142 110 140 130 144 150" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>` + `<path d="M166 86 L160 72 L172 82 Z" fill="${c}" stroke="${ink}" stroke-width="1.6"/>` + eye(176, 100, 3.4) + mouth(188, 118) + `<circle cx="160" cy="132" r="4" fill="${C.gold}"/>`;
      break;
    }
    case 'swan': {
      body = `<g class="ch-leg ch-leg-l"></g><g class="ch-leg ch-leg-r"></g>` + shape('M40 230 C40 196 96 186 140 200 C164 208 166 236 140 250 C110 266 56 262 40 230 Z', C.white, 'leaf') + `<path d="M30 264 C60 274 140 274 170 264" fill="none" stroke="${C.blue}" stroke-width="4" stroke-dasharray="8 6"/>`;
      head = `<path d="M140 210 C150 180 120 150 132 120 C140 102 162 104 164 120" fill="none" stroke="${ink}" stroke-width="13" stroke-linecap="round"/><path d="M140 210 C150 180 120 150 132 120 C140 102 162 104 164 120" fill="none" stroke="${C.white}" stroke-width="9" stroke-linecap="round"/>` + `<path d="M162 116 L178 124 L162 128 Z" fill="${C.ochre}" stroke="${ink}" stroke-width="1.4"/>` + eye(152, 116, 2.6) + mouth(170, 126);
      break;
    }
  }
  const shadow = `<ellipse class="ch-shadow" cx="100" cy="293" rx="60" ry="5" fill="#00000020"/>`;
  return `<svg class="chr plan-myth plan-animal skin-${skinMode} pose-${o.pose || 'idle'}" viewBox="${VIEWBOX}" role="img" aria-label="${kind}">${patterns(u, ink)}${shadow}<g class="ch-all"><g class="ch-body">${body}<g class="ch-head" style="transform-origin:150px 170px">${head}</g></g></g></svg>`;
}

/** Draw a mythology kind. o: { mood, pose, skin: 'madhubani'|'flat', uid, ink } */
export function mythSvg(kind, o = {}) {
  const info = MYTH_KINDS[kind];
  if (!info) return '';
  return info.animal ? animalSvg(kind, info, o) : personSvg(kind, info, o);
}
export const isMythKind = (k) => Object.prototype.hasOwnProperty.call(MYTH_KINDS, k);

/** Lip-sync and the extra arms for these figures. */
export const MYTH_CSS = `
.chr.plan-myth .ch-vis>g{display:none}
${'ABCDEFGH'.split('').map((k) => `.chwrap[data-vis="${k}"] .chr.plan-myth .ch-vis .v${k}{display:inline}`).join('\n')}
/* With a lip-sync track the viseme shapes speak; without one, the plain open-close mouth does. */
.chwrap[data-vis]:not([data-vis=""]) .chr.plan-myth .ch-mouth-open{display:none}
.chwrap[data-vis]:not([data-vis=""]):not([data-vis="X"]) .chr.plan-myth .ch-mouth-closed{display:none}
.chwrap[data-vis]:not([data-vis=""]) .chr.plan-myth .ch-mouth-closed{opacity:1}
.chr.plan-myth .ch-arm-x{animation:none !important}
.chr.plan-myth.plan-animal .ch-arm-l,.chr.plan-myth.plan-animal .ch-arm-r{display:none}
/* Profile figures: the near arm rises up and forward, in front of the face, never across it
   (the far arm may go straight up: it is drawn behind the head). */
.chr.plan-myth.pose-wave .ch-arm-r{animation-name:my-wave}
.chr.plan-myth.pose-cheer .ch-arm-r,.chr.plan-myth.pose-dance .ch-arm-r{animation-name:my-cheer}
.chr.plan-myth.pose-think .ch-arm-r{transform:rotate(-118deg)}
@keyframes my-wave{from{transform:rotate(-98deg)}to{transform:rotate(-122deg)}}
@keyframes my-cheer{from{transform:rotate(-106deg)}to{transform:rotate(-124deg)}}
`;
