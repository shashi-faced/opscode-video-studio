// Plan 18 M5: the second batch of looks. Neon and horror draw stickmen; retro pixel, paper cut-out,
// watercolor, comic and isometric use the 2D characters with a "skin" (filters and overlays) so story
// scenes fit the look. Each look has scenery per scene (looksDecor), placed by the video's seed, whose
// animations are seeked with the scene, so every frame renders the same way every time.
import { seeded } from './seed.mjs';

const T = (o) => ({ dark: false, onAccent: '#ffffff', ...o });

export const LOOKS2 = {
  neon: {
    label: 'Neon Synthwave', base: 'stickman', kind: 'paper', head: 'glow', lw: 6.4, wobble: 0.4, ink: '#f6f0ff', limb: '#f6f0ff', look2: 'neon',
    theme: T({ dark: true, bg: '#0b0420', bg2: '#140a33', bg3: '#1d1047', ink: '#f6f0ff', muted: '#b7a8e0', accent: '#ff3cc7', accent2: '#2ef2ff', ok: '#7dffb2', alert: '#ff4f6d', onAccent: '#0b0420', display: 'Poppins' }),
    font: { display: '"Poppins","Hind"', body: '"Poppins","Hind"' },
    stage: 'linear-gradient(180deg,#07021a 0%,#1a0838 52%,#2a0b4a 62%,#0b0420 100%)', caption: 'box', underline: false, upper: true,
    accents: [['#ff3cc7', '#2ef2ff'], ['#ff7a18', '#ff3cc7'], ['#2ef2ff', '#b14bff'], ['#f7ff4a', '#ff3cc7'], ['#7dffb2', '#2ef2ff']],
  },
  horror: {
    label: 'Horror / Mystery', base: 'stickman', kind: 'paper', head: 'hollow', lw: 4.4, wobble: 2.4, ink: '#d9d4c9', limb: '#d9d4c9', look2: 'horror',
    theme: T({ dark: true, bg: '#0a0b0c', bg2: '#121416', bg3: '#1a1d20', ink: '#e4dfd4', muted: '#8f8a80', accent: '#c3162f', accent2: '#7e8f86', ok: '#8fa89a', alert: '#c3162f', onAccent: '#f4efe6', display: 'Rozha One' }),
    font: { display: '"Rozha One","Hind"', body: '"Hind"' },
    stage: 'radial-gradient(100% 80% at 50% 40%,#181b1d 0%,#0a0b0c 70%,#030304 100%)', caption: 'box', underline: false,
    accents: [['#c3162f', '#7e8f86'], ['#9e1b1b', '#8a8f6a'], ['#d4a017', '#5d6b73'], ['#6fae9c', '#c3162f']],
    grounds: ['radial-gradient(100% 80% at 50% 40%,#181b1d 0%,#0a0b0c 70%,#030304 100%)', 'radial-gradient(100% 80% at 40% 30%,#12181a 0%,#070a0b 70%)', 'radial-gradient(100% 80% at 60% 35%,#1b1513 0%,#0b0807 70%)'],
  },
  'retro-pixel': {
    label: 'Retro Pixel', base: '2d', kind: 'paper', look2: 'pixel', flatInk: true,
    theme: T({ dark: true, bg: '#1a1c3a', bg2: '#25285a', bg3: '#30347a', ink: '#f7f7f2', muted: '#a9acd6', accent: '#ffd319', accent2: '#ff4f7b', ok: '#3df58b', alert: '#ff4f4f', onAccent: '#1a1c3a', display: 'JetBrains Mono' }),
    font: { display: '"JetBrains Mono","Hind"', body: '"JetBrains Mono","Hind"' },
    stage: '#1a1c3a', caption: 'box', underline: false, upper: true,
    accents: [['#ffd319', '#ff4f7b'], ['#3df58b', '#ffd319'], ['#4fc3ff', '#ff4f7b'], ['#ff8a3d', '#4fc3ff'], ['#ff4f7b', '#3df58b']],
    grounds: ['#1a1c3a', '#16213e', '#2a173e', '#10291f'],
  },
  'paper-cutout': {
    label: 'Paper Cut-out', base: '2d', kind: 'paper', look2: 'paper',
    theme: T({ bg: '#ecdfc6', bg2: '#e3d3b4', bg3: '#d8c5a0', ink: '#2c2520', muted: '#6d5f50', accent: '#e4572e', accent2: '#2e86ab', ok: '#4c9f70', alert: '#c8341f', display: 'Poppins' }),
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: '#ecdfc6', caption: 'box', underline: false,
    accents: [['#e4572e', '#2e86ab'], ['#f2a541', '#3e7cb1'], ['#4c9f70', '#e4572e'], ['#d6336c', '#f2a541'], ['#3e7cb1', '#f2a541']],
    grounds: ['#ecdfc6', '#e6e0d2', '#f0d9c4', '#dfe5d6'],
  },
  watercolor: {
    label: 'Watercolor Storybook', base: '2d', kind: 'paper', look2: 'watercolor',
    theme: T({ bg: '#fbf6ee', bg2: '#f4ece0', bg3: '#ebe0cf', ink: '#3b3946', muted: '#77717d', accent: '#d9607f', accent2: '#5b93c9', ok: '#77b07c', alert: '#d9534f', display: 'Rozha One' }),
    font: { display: '"Rozha One","Hind"', body: '"Hind"' },
    stage: '#fbf6ee', caption: 'box', underline: false,
    accents: [['#d9607f', '#5b93c9'], ['#e59a4f', '#7a9ed6'], ['#7fb07c', '#d9607f'], ['#9a7ad1', '#e5a24f'], ['#4fa3a5', '#e07a8b']],
  },
  comic: {
    label: 'Comic Panels', base: '2d', kind: 'paper', look2: 'comic', flatInk: true,
    theme: T({ bg: '#fff6d8', bg2: '#ffefc0', bg3: '#ffe3a0', ink: '#141414', muted: '#4b4b4b', accent: '#e8202a', accent2: '#1c6dd0', ok: '#1f9d55', alert: '#e8202a', display: 'Poppins' }),
    font: { display: '"Poppins","Hind"', body: '"Poppins","Hind"' },
    stage: '#fff6d8', caption: 'box', underline: false, upper: true,
    accents: [['#e8202a', '#1c6dd0'], ['#1c6dd0', '#ffcc00'], ['#ff7a00', '#7a2bd1'], ['#00a86b', '#e8202a'], ['#d6249f', '#ffcc00']],
    grounds: ['#fff6d8', '#e8f4ff', '#ffeaea', '#f1ffe6'],
  },
  isometric: {
    label: 'Isometric', base: '2d', kind: 'paper', look2: 'iso', flatInk: true,
    theme: T({ bg: '#eef2fb', bg2: '#e2e8f7', bg3: '#d5def3', ink: '#22304a', muted: '#5b6884', accent: '#5b6cff', accent2: '#ff8a5b', ok: '#2bc4a0', alert: '#ef4565', display: 'Poppins' }),
    font: { display: '"Poppins","Hind"', body: '"Hind"' },
    stage: 'linear-gradient(180deg,#f3f6fd,#e6ecf8)', caption: 'box-light', underline: false,
    accents: [['#5b6cff', '#ff8a5b'], ['#2bc4a0', '#5b6cff'], ['#ef4565', '#3da9fc'], ['#7f5af0', '#2cb67d'], ['#ff8906', '#3da9fc']],
  },
};

export const LOOK2_ALIASES = {
  neon: 'neon', synthwave: 'neon', 'neon synthwave': 'neon', cyberpunk: 'neon', retrowave: 'neon', vaporwave: 'neon', glow: 'neon', '80s': 'neon', outrun: 'neon',
  horror: 'horror', scary: 'horror', creepy: 'horror', mystery: 'horror', spooky: 'horror', haunted: 'horror', ghost: 'horror', 'unsolved mystery': 'horror', 'creepy facts': 'horror',
  pixel: 'retro-pixel', 'pixel art': 'retro-pixel', 'retro pixel': 'retro-pixel', '8-bit': 'retro-pixel', '8 bit': 'retro-pixel', '8bit': 'retro-pixel', 'retro game': 'retro-pixel', arcade: 'retro-pixel', 'video game': 'retro-pixel',
  'paper cut-out': 'paper-cutout', 'paper cutout': 'paper-cutout', 'paper cut out': 'paper-cutout', papercut: 'paper-cutout', 'paper craft': 'paper-cutout', collage: 'paper-cutout', 'cut-out': 'paper-cutout', cutout: 'paper-cutout', 'stop motion': 'paper-cutout',
  watercolor: 'watercolor', watercolour: 'watercolor', 'water color': 'watercolor', storybook: 'watercolor', 'story book': 'watercolor', painted: 'watercolor', pastel: 'watercolor',
  comic: 'comic', comics: 'comic', 'comic book': 'comic', 'comic panels': 'comic', manga: 'comic', 'pop art': 'comic', 'graphic novel': 'comic', superhero: 'comic',
  isometric: 'isometric', iso: 'isometric', '3d isometric': 'isometric', '2.5d': 'isometric', 'isometric illustration': 'isometric',
};

// ───────────────────────── SVG filters (once per page) ─────────────────────────

const DEFS = {
  pixel: '<filter id="lk-px" x="0" y="0" width="100%" height="100%"><feFlood x="4" y="4" height="1" width="1"/><feComposite width="9" height="9"/><feTile result="a"/><feComposite in="SourceGraphic" in2="a" operator="in"/><feMorphology operator="dilate" radius="4"/></filter>',
  watercolor: '<filter id="lk-wc" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>' +
    '<filter id="lk-wash" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="4" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="90" xChannelSelector="R" yChannelSelector="G" result="d"/><feGaussianBlur in="d" stdDeviation="6"/></filter>',
  paper: '<filter id="lk-torn" x="-5%" y="-10%" width="110%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".09" numOctaves="2" seed="11" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>',
};
/** Hidden SVG with the filters a look needs (empty for looks without filters). */
export function looksDefs(style) {
  const d = style?.look2 && DEFS[style.look2];
  return d ? `<svg class="lk-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${d}</defs></svg>` : '';
}

const noise = (freq, alpha, color = '1 1 1') => `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='260' height='260'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='${freq}' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 ${color.split(' ')[0]}  0 0 0 0 ${color.split(' ')[1]}  0 0 0 0 ${color.split(' ')[2]}  0 0 0 ${alpha} 0'/></filter><rect width='260' height='260' filter='url(#n)'/></svg>`)}")`;
const HALFTONE = (c, size = 1.15) => `radial-gradient(circle,${c} ${size * 0.42}px,transparent ${size * 0.42 + 0.6}px) 0 0/${size * 9}px ${size * 9}px`;
const CARDS = '.chip,.tag,.badge,.stat,.steps li,.my-card,.qz-opt,.pl-card,.storytext,.mp-text,.ct-phone';

// ───────────────────────── CSS per look ─────────────────────────

export function looksCss(s, t, sel) {
  const L = s.look2;
  if (!L) return '';
  const o = [];
  o.push(`${sel} .amb{display:none}`);
  o.push(`${sel} .scene>.lk{position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden}`);
  o.push(`${sel} .scene>.in{z-index:1}`);
  if (s.flatInk) o.push(`${sel} .t-story .bg{filter:saturate(1.1)}`);

  if (L === 'neon') {
    o.push(`${sel} .headline,${sel} .kt-word,${sel} .rk-num{color:#fff;text-shadow:0 0 calc(var(--u)*.3) #fff,0 0 calc(var(--u)*1.2) var(--accent),0 0 calc(var(--u)*3) var(--accent)}`);
    o.push(`${sel} .headline mark{color:var(--accent2);text-shadow:0 0 calc(var(--u)*1.2) var(--accent2),0 0 calc(var(--u)*3) var(--accent2)}`);
    o.push(`${sel} .kicker{color:var(--accent2);text-shadow:0 0 calc(var(--u)*1) var(--accent2);letter-spacing:.18em}`);
    o.push(`${sel}.lang-deva .kicker{letter-spacing:.02em}`);
    o.push(`${sel} .chwrap svg{filter:drop-shadow(0 0 calc(var(--u)*.4) var(--accent2)) drop-shadow(0 0 calc(var(--u)*1.4) var(--accent))}`);
    o.push(`${sel} .st-ground path{stroke:var(--accent2);filter:drop-shadow(0 0 calc(var(--u)*.6) var(--accent2))}`);
    o.push(`${sel} ${CARDS.split(',').join(`,${sel} `)}{background:#0b0420cc;border:calc(var(--u)*.25) solid var(--accent2);box-shadow:0 0 calc(var(--u)*1.2) color-mix(in srgb,var(--accent2) 60%,transparent),inset 0 0 calc(var(--u)*1.2) color-mix(in srgb,var(--accent2) 30%,transparent);color:var(--ink)}`);
    o.push(`${sel} .button{box-shadow:0 0 calc(var(--u)*2) var(--accent)}`);
    o.push(`${sel} .cap span{background:#0b0420d9;color:#fff;box-shadow:0 0 calc(var(--u)*1.4) color-mix(in srgb,var(--accent) 55%,transparent);border:calc(var(--u)*.2) solid var(--accent)}`);
    o.push(`${sel} .bubble{background:#0b0420;color:#fff;border:calc(var(--u)*.3) solid var(--accent2);box-shadow:0 0 calc(var(--u)*1.4) var(--accent2)}`);
    o.push(`${sel} .bubble::after{border-top-color:var(--accent2)}`);
    // Synthwave sun, horizon and a grid floor that rolls towards the viewer.
    o.push(`${sel} .nx-sun{position:absolute;left:50%;bottom:36%;width:min(46%,calc(var(--u)*60));aspect-ratio:1;transform:translateX(-50%);border-radius:50%;background:linear-gradient(180deg,var(--accent2) 0%,var(--accent) 70%);-webkit-mask:linear-gradient(180deg,#000 48%,transparent 48% 53%,#000 53% 62%,transparent 62% 66%,#000 66% 74%,transparent 74% 77%,#000 77% 85%,transparent 85% 87%,#000 87%);mask:linear-gradient(180deg,#000 48%,transparent 48% 53%,#000 53% 62%,transparent 62% 66%,#000 66% 74%,transparent 74% 77%,#000 77% 85%,transparent 85% 87%,#000 87%);opacity:.85;filter:drop-shadow(0 0 calc(var(--u)*4) var(--accent))}`);
    o.push(`${sel} .nx-floor{position:absolute;left:-50%;right:-50%;bottom:-6%;height:42%;transform-origin:50% 0;transform:perspective(calc(var(--u)*40)) rotateX(62deg);background:linear-gradient(transparent 0 calc(100% - 3px),var(--accent) calc(100% - 3px)) 0 0/100% calc(var(--u)*7),linear-gradient(90deg,transparent 0 calc(100% - 3px),var(--accent) calc(100% - 3px)) 0 0/calc(var(--u)*7) 100%;animation:nx-roll 1.2s linear infinite;opacity:.75;-webkit-mask:linear-gradient(180deg,transparent,#000 40%);mask:linear-gradient(180deg,transparent,#000 40%)}`);
    o.push(`${sel} .nx-horizon{position:absolute;left:0;right:0;bottom:36%;height:calc(var(--u)*.35);background:var(--accent2);box-shadow:0 0 calc(var(--u)*2) var(--accent2)}`);
    o.push(`${sel} .nx-star{position:absolute;width:calc(var(--u)*.35);height:calc(var(--u)*.35);border-radius:50%;background:#fff;animation:nx-tw 2.4s ease-in-out infinite}`);
    o.push('@keyframes nx-roll{to{background-position:0 calc(var(--u)*7),0 0}}');
    o.push('@keyframes nx-tw{50%{opacity:.25}}');
    // Text scenes keep the sun small and low so it never sits behind the words.
    o.push(`${sel} .lk.txt .nx-sun{bottom:20%;width:min(30%,calc(var(--u)*24));opacity:.55}`);
    o.push(`${sel} .lk.txt .nx-horizon{bottom:20%}`);
    o.push(`${sel} .lk.txt .nx-floor{height:26%}`);
  }

  if (L === 'horror') {
    o.push(`${sel} .scene{animation:hr-creep var(--sd,8s) linear both;transform-origin:50% 45%}`);
    o.push('@keyframes hr-creep{from{transform:scale(1)}to{transform:scale(1.06)}}');
    o.push(`${sel} .headline{font-weight:400;color:var(--ink);text-shadow:0 0 calc(var(--u)*2) #000,0 0 calc(var(--u)*.3) #000}`);
    o.push(`${sel} .headline mark{color:var(--accent);text-shadow:0 0 calc(var(--u)*1.6) color-mix(in srgb,var(--accent) 60%,transparent)}`);
    o.push(`${sel} .kicker{color:var(--muted);letter-spacing:.3em;text-transform:uppercase;font-weight:400}`);
    o.push(`${sel}.lang-deva .kicker{letter-spacing:.02em}`);
    o.push(`${sel} .chwrap svg{filter:drop-shadow(0 0 calc(var(--u)*1.2) #000)}`);
    o.push(`${sel} .st-ground{opacity:.4}`);
    o.push(`${sel} ${CARDS.split(',').join(`,${sel} `)}{background:#0d0f10e6;border:calc(var(--u)*.15) solid #ffffff1f;box-shadow:0 calc(var(--u)*1) calc(var(--u)*4) #000c;color:var(--ink)}`);
    // Whispered captions: no box, soft, lower case.
    o.push(`${sel} .cap span{background:none;box-shadow:none;color:#ece6da;font-style:italic;font-weight:500;letter-spacing:.03em;text-transform:lowercase;text-shadow:0 0 calc(var(--u)*.8) #000,0 0 calc(var(--u)*2.4) #000,0 0 calc(var(--u)*4) #000}`);
    o.push(`${sel} .bubble{background:#e9e4d8;color:#141414;box-shadow:0 0 calc(var(--u)*3) #000}`);
    o.push(`${sel} .bubble::after{border-top-color:#e9e4d8}`);
    o.push(`${sel}::before{content:"";position:absolute;inset:0;z-index:6;pointer-events:none;background:${noise(1.2, 0.16)};opacity:.7}`);
    o.push(`${sel}::after{content:"";position:absolute;inset:0;z-index:6;pointer-events:none;background:radial-gradient(90% 75% at 50% 45%,transparent 35%,#000e 100%)}`);
    o.push(`${sel} .hr-fog{position:absolute;left:-30%;right:-30%;height:45%;background:radial-gradient(50% 50% at 30% 50%,#c8cfd420,transparent 70%),radial-gradient(40% 50% at 70% 60%,#c8cfd418,transparent 70%);filter:blur(calc(var(--u)*2));animation:hr-drift 9s ease-in-out infinite alternate}`);
    o.push(`${sel} .hr-fog.f2{animation-duration:13s;animation-direction:alternate-reverse;opacity:.8}`);
    o.push(`${sel} .hr-flick{position:absolute;inset:0;background:#000;opacity:0;animation:hr-flick 3.7s steps(1) infinite;z-index:5}`);
    o.push('@keyframes hr-drift{from{transform:translateX(-8%)}to{transform:translateX(8%)}}');
    o.push('@keyframes hr-flick{0%,100%{opacity:0}31%{opacity:.35}33%{opacity:0}35%{opacity:.5}36%{opacity:0}74%{opacity:.25}75%{opacity:0}}');
  }

  if (L === 'pixel') {
    // Pictures are pixelated; text is chunky mono with hard shadows; motion moves in steps.
    o.push(`${sel} .t-story .bg,${sel} .chwrap,${sel} .fmt-icon,${sel} .st-prop,${sel} .media img,${sel} .frame img{filter:url(#lk-px)}`);
    o.push(`${sel} .headline,${sel} .rk-num,${sel} .kt-word{font-weight:700;letter-spacing:.02em;text-shadow:calc(var(--u)*.45) calc(var(--u)*.45) 0 #000}`);
    o.push(`${sel} .headline mark{color:var(--accent)}`);
    o.push(`${sel} .kicker{color:var(--accent2);text-shadow:calc(var(--u)*.3) calc(var(--u)*.3) 0 #000}`);
    // The mono font has no Devanagari; Hindi falls back to Hind but keeps the wide mono space.
    o.push(`${sel}.lang-deva .headline,${sel}.lang-deva .fmt-text,${sel}.lang-deva .subline,${sel}.lang-deva .item,${sel}.lang-deva .btext,${sel}.lang-deva .cap span,${sel}.lang-deva .kicker{word-spacing:-.32em}`);
    o.push(`${sel} ${CARDS.split(',').join(`,${sel} `)},${sel} .button{border-radius:0 !important;border:calc(var(--u)*.5) solid var(--ink);box-shadow:calc(var(--u)*.7) calc(var(--u)*.7) 0 #000;background:var(--bg2);color:var(--ink)}`);
    o.push(`${sel} .button{background:var(--accent);color:var(--on-accent)}`);
    o.push(`${sel} .a-up,${sel} .a-pop,${sel} .a-rise,${sel} .chwrap,${sel} .cb-row,${sel} .tl-card{animation-timing-function:steps(4,end) !important}`);
    o.push(`${sel} .cap span{border-radius:0;background:#000;color:#fff;box-shadow:calc(var(--u)*.5) calc(var(--u)*.5) 0 var(--accent);font-family:"JetBrains Mono","Hind",monospace;font-weight:600}`);
    o.push(`${sel} .bubble{border-radius:0;border:calc(var(--u)*.45) solid #000;box-shadow:calc(var(--u)*.6) calc(var(--u)*.6) 0 #000;font-family:"JetBrains Mono","Hind",monospace}`);
    o.push(`${sel} .bubble::after{border-top-color:#000}`);
    o.push(`${sel} .px-star{position:absolute;width:calc(var(--u)*.8);height:calc(var(--u)*.8);background:#fff;animation:px-blink 1.6s steps(2) infinite}`);
    o.push(`${sel} .px-ground{position:absolute;left:0;right:0;bottom:0;height:calc(var(--u)*5);background:linear-gradient(90deg,var(--bg3) 50%,var(--bg2) 50%) 0 0/calc(var(--u)*5) 50%,linear-gradient(90deg,var(--bg2) 50%,var(--bg3) 50%) 0 100%/calc(var(--u)*5) 50%;background-repeat:repeat-x;border-top:calc(var(--u)*.8) solid var(--ok)}`);
    o.push(`${sel} .px-scan{position:absolute;inset:0;background:repeating-linear-gradient(0deg,#0000 0 3px,#0000001f 3px 5px)}`);
    o.push(`${sel} .px-cloud{position:absolute;height:calc(var(--u)*3);background:#ffffff26;box-shadow:calc(var(--u)*3) calc(var(--u)*-3) 0 #ffffff26,calc(var(--u)*6) 0 0 #ffffff26;animation:px-drift 16s steps(32) infinite}`);
    o.push('@keyframes px-blink{50%{opacity:.2}}');
    o.push('@keyframes px-drift{to{transform:translateX(calc(var(--u)*30))}}');
  }

  if (L === 'paper') {
    o.push(`${sel}::after{content:"";position:absolute;inset:0;z-index:6;pointer-events:none;background:${noise(0.75, 0.13, '.35 .25 .15')};mix-blend-mode:multiply}`);
    o.push(`${sel} .chwrap svg{filter:drop-shadow(calc(var(--u)*.3) 0 0 #fff) drop-shadow(calc(var(--u)*-.3) 0 0 #fff) drop-shadow(0 calc(var(--u)*.3) 0 #fff) drop-shadow(0 calc(var(--u)*-.3) 0 #fff) drop-shadow(0 calc(var(--u)*.9) calc(var(--u)*.7) #0005);animation:pc-jit .5s steps(1) infinite}`);
    o.push(`${sel} .t-story .bg{filter:saturate(.8) sepia(.12)}`);
    o.push(`${sel} ${CARDS.split(',').join(`,${sel} `)}{background:#fffaf0;border:none;border-radius:calc(var(--u)*.3);box-shadow:0 calc(var(--u)*.4) 0 #0001,0 calc(var(--u)*1) calc(var(--u)*1.4) #0003;color:var(--ink)}`);
    o.push(`${sel} .headline{font-weight:700}`);
    o.push(`${sel} .headline mark{background:var(--accent);color:#fff;padding:0 .18em;box-decoration-break:clone;-webkit-box-decoration-break:clone;box-shadow:0 calc(var(--u)*.5) calc(var(--u)*.8) #0003;border-radius:calc(var(--u)*.2)}`);
    // No vertical padding on fitted text (the fit counts it as height): the strip is drawn by box-shadow.
    o.push(`${sel} .kicker{background:var(--accent2);color:#fff;padding:0 .5em;transform:rotate(-2deg);box-shadow:0 0 0 .2em var(--accent2),0 calc(var(--u)*.5) calc(var(--u)*.8) .2em #0003;width:fit-content;max-width:100%}`);
    o.push(`${sel} .pc-layer{position:absolute;left:-4%;right:-4%;filter:url(#lk-torn) drop-shadow(0 calc(var(--u)*-.6) calc(var(--u)*.8) #0003);animation:pc-slide .7s cubic-bezier(.2,.9,.3,1.2) both,pc-jit .5s steps(1) infinite}`);
    o.push(`${sel} .pc-cut{position:absolute;filter:url(#lk-torn) drop-shadow(0 calc(var(--u)*.6) calc(var(--u)*.6) #0004);animation:pc-flap .6s cubic-bezier(.2,.9,.3,1.3) both}`);
    o.push('@keyframes pc-jit{0%{transform:rotate(0)}25%{transform:rotate(.5deg) translateY(1px)}50%{transform:rotate(-.3deg)}75%{transform:rotate(.25deg) translateX(1px)}}');
    o.push('@keyframes pc-slide{from{transform:translateY(60%)}}');
    o.push('@keyframes pc-flap{from{transform:rotate(-25deg) scale(.3);opacity:0}}');
  }

  if (L === 'watercolor') {
    o.push(`${sel}::after{content:"";position:absolute;inset:0;z-index:6;pointer-events:none;background:${noise(0.55, 0.1, '.45 .4 .35')};mix-blend-mode:multiply}`);
    o.push(`${sel} .t-story .bg{filter:url(#lk-wc) saturate(.75) brightness(1.06) contrast(.92)}`);
    o.push(`${sel} .chwrap svg{filter:url(#lk-wc) saturate(.85)}`);
    o.push(`${sel} .headline{font-weight:400;color:var(--ink)}`);
    o.push(`${sel} .headline mark{background:none;color:var(--accent)}`);
    o.push(`${sel} .kicker{color:var(--accent2);font-style:italic}`);
    o.push(`${sel} ${CARDS.split(',').join(`,${sel} `)}{background:color-mix(in srgb,var(--bg) 70%,transparent);border:none;border-radius:calc(var(--u)*2.6);box-shadow:0 0 0 calc(var(--u)*.2) color-mix(in srgb,var(--accent2) 30%,transparent);color:var(--ink)}`);
    o.push(`${sel} .cap span{background:#fffdf8e6;color:#3b3946;box-shadow:0 calc(var(--u)*.4) calc(var(--u)*1.6) #0002;font-family:var(--body)}`);
    o.push(`${sel} .wc-wash{position:absolute;border-radius:50%;filter:url(#lk-wash);mix-blend-mode:multiply;animation:wc-bloom 1.6s ease-out both}`);
    o.push('@keyframes wc-bloom{from{transform:scale(.6);opacity:0}}');
  }

  if (L === 'comic') {
    o.push(`${sel} .headline,${sel} .rk-num{font-weight:700;font-style:italic;letter-spacing:.01em;color:var(--ink);text-shadow:calc(var(--u)*.35) calc(var(--u)*.35) 0 #fff,calc(var(--u)*.7) calc(var(--u)*.7) 0 var(--ink)}`);
    o.push(`${sel} .headline mark{background:none;color:var(--accent)}`);
    o.push(`${sel} .kicker{background:#ffe14d;color:#111;padding:0 .6em;box-shadow:0 0 0 .2em #ffe14d,0 0 0 calc(.2em + var(--u)*.3) #111,calc(var(--u)*.6) calc(var(--u)*.6) 0 calc(.2em + var(--u)*.3) #111;font-weight:700;width:fit-content;max-width:100%;margin:calc(var(--u)*.6) 0}`);
    o.push(`${sel} ${CARDS.split(',').join(`,${sel} `)}{background:#fff;border:calc(var(--u)*.35) solid #111;border-radius:calc(var(--u)*.4);box-shadow:calc(var(--u)*.7) calc(var(--u)*.7) 0 #111;color:#111}`);
    o.push(`${sel} .chwrap svg{filter:drop-shadow(calc(var(--u)*.25) 0 0 #111) drop-shadow(calc(var(--u)*-.25) 0 0 #111) drop-shadow(0 calc(var(--u)*.25) 0 #111) drop-shadow(0 calc(var(--u)*-.25) 0 #111)}`);
    o.push(`${sel} .t-story .bg{filter:saturate(1.35) contrast(1.1)}`);
    o.push(`${sel} .t-story::after{content:"";position:absolute;inset:0;z-index:2;pointer-events:none;background:${HALFTONE('#0000002e', 1.3)};mix-blend-mode:multiply}`);
    o.push(`${sel} .bubble{background:#fff;color:#111;border:calc(var(--u)*.35) solid #111;border-radius:50% / 42%;padding:calc(var(--u)*2) calc(var(--u)*3);box-shadow:none;font-weight:700;text-transform:uppercase}`);
    o.push(`${sel} .bubble::after{border-top-color:#111}`);
    o.push(`${sel} .cap span{background:#ffe14d;color:#111;border:calc(var(--u)*.3) solid #111;border-radius:0;box-shadow:calc(var(--u)*.5) calc(var(--u)*.5) 0 #111;font-weight:700}`);
    o.push(`${sel} .cm-panel{position:absolute;inset:calc(var(--u)*2.2);border:calc(var(--u)*.9) solid #111;background:${HALFTONE('color-mix(in srgb,var(--accent2) 22%,transparent)', 1.2)},var(--bg);box-shadow:calc(var(--u)*1.1) calc(var(--u)*1.1) 0 #111;animation:cm-in .35s cubic-bezier(.2,.9,.3,1.3) both}`);
    o.push(`${sel} .cm-burst{position:absolute;inset:-20%;background:repeating-conic-gradient(from 0deg at 50% 50%,transparent 0 5deg,color-mix(in srgb,var(--accent) 16%,transparent) 5deg 8deg);-webkit-mask:radial-gradient(closest-side,transparent 30%,#000 70%);mask:radial-gradient(closest-side,transparent 30%,#000 70%);animation:cm-spin 30s linear infinite}`);
    o.push(`${sel} .cm-sfx{position:absolute;display:grid;place-items:center;width:calc(var(--u)*24);aspect-ratio:1.2;background:#ffe14d;clip-path:polygon(50% 0,61% 22%,85% 6%,79% 33%,100% 40%,80% 55%,96% 80%,70% 74%,62% 100%,48% 78%,30% 98%,28% 72%,3% 82%,17% 58%,0 38%,22% 32%,14% 8%,38% 22%);font:700 italic calc(var(--u)*5.2) "Poppins",var(--body);color:var(--accent);text-shadow:calc(var(--u)*.3) calc(var(--u)*.3) 0 #111;transform:rotate(-12deg);animation:cm-pop .4s cubic-bezier(.2,1.6,.4,1) both;z-index:3}`);
    o.push('@keyframes cm-in{from{transform:scale(.94);opacity:0}}');
    o.push('@keyframes cm-spin{to{transform:rotate(360deg)}}');
    o.push('@keyframes cm-pop{from{transform:rotate(-12deg) scale(0)}}');
  }

  if (L === 'iso') {
    o.push(`${sel} ${CARDS.split(',').join(`,${sel} `)}{background:#fff;border:none;border-radius:calc(var(--u)*1.2);box-shadow:calc(var(--u)*.8) calc(var(--u)*.8) 0 color-mix(in srgb,var(--accent) 22%,#c9d3ea);color:var(--ink)}`);
    o.push(`${sel} .headline{font-weight:700}`);
    o.push(`${sel} .headline mark{background:none;color:var(--accent)}`);
    o.push(`${sel} .iso{position:absolute;overflow:visible}`);
    o.push(`${sel} .iso .blk{transform-box:fill-box;transform-origin:50% 100%;animation:iso-rise .7s cubic-bezier(.2,.9,.3,1.15) both}`);
    o.push(`${sel} .iso .flow{fill:none;stroke-width:3;stroke-dasharray:8 10;stroke-linecap:round;animation:iso-flow 1s linear infinite}`);
    o.push(`${sel} .iso .plate{animation:dt-fade .5s ease both}`);
    o.push('@keyframes iso-rise{from{transform:scaleY(0)}}');
    o.push('@keyframes iso-flow{to{stroke-dashoffset:-36}}');
    o.push('@keyframes dt-fade{from{opacity:0}}');
  }
  return o.join('\n');
}

// ───────────────────────── scenery per scene ─────────────────────────

const r1 = (n) => Math.round(n * 10) / 10;
const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c : null);
function shade(c, f) { // f > 0 lighter, f < 0 darker
  const h = hex(c); if (!h) return c;
  return '#' + [0, 1, 2].map((i) => { const v = parseInt(h.slice(1 + i * 2, 3 + i * 2), 16); return Math.round(f > 0 ? v + (255 - v) * f : v * (1 + f)).toString(16).padStart(2, '0'); }).join('');
}
const TEXT_TEMPLATES = new Set(['bullets', 'steps', 'stat', 'quote', 'split', 'feature', 'chart', 'timeline', 'quiz', 'myth', 'poll', 'chat', 'fact', 'rank']);

/** Scenery behind one scene, or ''. sc: the scene; fi: format index (0 16:9, 1 9:16, 2 1:1). */
export function looksDecor(style, v, index, theme, sc = {}, fi = 0) {
  const L = style?.look2;
  if (!L) return '';
  const rnd = seeded(`${v?.decor ?? 0}|${index}|${L}`);
  const story = sc.template === 'story' || sc.template === 'dialogue';
  const busy = TEXT_TEMPLATES.has(sc.template);
  if (sc.template === 'map' || sc.template === 'news') return ''; // they draw their own picture

  if (L === 'neon') {
    const stars = Array.from({ length: 22 }, (_, k) => `<i class="nx-star" style="left:${r1(rnd() * 100)}%;top:${r1(rnd() * 55)}%;animation-delay:-${r1(rnd() * 2.4)}s;opacity:${(0.4 + rnd() * 0.6).toFixed(2)}"></i>`).join('');
    return `<div class="lk${story ? '' : ' txt'}">${stars}<div class="nx-sun"></div><div class="nx-horizon"></div><div class="nx-floor"></div></div>`;
  }
  if (L === 'horror') {
    return `<div class="lk"><div class="hr-fog" style="bottom:${r1(rnd() * 10)}%"></div><div class="hr-fog f2" style="bottom:${r1(18 + rnd() * 18)}%"></div><div class="hr-flick" style="animation-delay:-${r1(rnd() * 3.7)}s"></div></div>`;
  }
  if (L === 'pixel') {
    const stars = Array.from({ length: 18 }, () => `<i class="px-star" style="left:${r1(rnd() * 100)}%;top:${r1(rnd() * 60)}%;animation-delay:-${r1(rnd() * 1.6)}s"></i>`).join('');
    const clouds = story ? '' : Array.from({ length: 2 }, () => `<i class="px-cloud" style="left:${r1(-10 + rnd() * 70)}%;top:${r1(8 + rnd() * 30)}%;width:calc(var(--u)*${r1(6 + rnd() * 6)})"></i>`).join('');
    return `<div class="lk">${stars}${clouds}${story ? '' : '<div class="px-ground"></div>'}<div class="px-scan"></div></div>`;
  }
  if (L === 'paper') {
    if (story) return '';
    const cols = [theme.accent2, theme.ok, theme.accent, shade(theme.bg, -0.12)];
    const layers = [0, 1, 2].map((k) => {
      const h = 9 + k * 5 + rnd() * 5, c = cols[(k + Math.floor(rnd() * 4)) % cols.length];
      const d = `M0 ${r1(30 + rnd() * 20)} ${Array.from({ length: 6 }, (_, j) => `Q${(j * 2 + 1) * 50 / 3} ${r1(rnd() * 40)} ${(j + 1) * 100 / 3} ${r1(15 + rnd() * 35)}`).join(' ')} L200 100 L0 100 Z`;
      return `<svg class="pc-layer" viewBox="0 0 200 100" preserveAspectRatio="none" style="bottom:${r1(-2 - k * 2)}%;height:${r1(h + (fi === 1 ? 4 : 0))}%;animation-delay:${(0.05 + (2 - k) * 0.12).toFixed(2)}s,-${r1(rnd())}s;z-index:${3 - k}"><path d="${d}" fill="${c}"/></svg>`;
    }).reverse().join('');
    const cuts = Array.from({ length: 3 }, (_, k) => {
      const sz = 7 + rnd() * 9, x = k === 0 ? 3 + rnd() * 10 : k === 1 ? 80 + rnd() * 12 : 60 + rnd() * 25, y = k === 2 ? 4 + rnd() * 10 : 6 + rnd() * 30;
      const shape = ['50%', '12%', '50% 50% 0 50%'][Math.floor(rnd() * 3)];
      return `<i class="pc-cut" style="left:${r1(x)}%;top:${r1(y)}%;width:calc(var(--u)*${r1(sz)});height:calc(var(--u)*${r1(sz)});border-radius:${shape};background:${cols[(k + 1) % 3]};animation-delay:${(0.2 + k * 0.12).toFixed(2)}s;opacity:.9"></i>`;
    }).join('');
    return `<div class="lk">${layers}${cuts}</div>`;
  }
  if (L === 'watercolor') {
    const cols = [theme.accent, theme.accent2, theme.ok, shade(theme.accent2, 0.3)];
    const n = story ? 2 : 4;
    const washes = Array.from({ length: n }, (_, k) => {
      const w = 30 + rnd() * 35, x = k % 2 ? 55 + rnd() * 35 : -15 + rnd() * 30, y = -15 + rnd() * (story ? 25 : 95);
      return `<i class="wc-wash" style="left:${r1(x)}%;top:${r1(y)}%;width:${r1(w)}%;aspect-ratio:${(1 + rnd() * 0.6).toFixed(2)};background:radial-gradient(closest-side,${cols[k % cols.length]}66,${cols[k % cols.length]}22 70%,transparent);animation-delay:${(0.05 + k * 0.15).toFixed(2)}s"></i>`;
    }).join('');
    return `<div class="lk">${washes}</div>`;
  }
  if (L === 'comic') {
    const rot = (rnd() * 1.6 - 0.8).toFixed(2);
    const burst = !busy && !story ? '<div class="cm-burst"></div>' : '';
    const sfx = sc.sfx ? `<div class="cm-sfx" style="${fi === 1 ? 'right:6%;top:30%' : 'right:7%;top:12%'};animation-delay:.3s">${String(sc.sfx).replace(/[<>&"]/g, '')}</div>` : '';
    return story ? `<div class="lk" style="z-index:3">${sfx}</div>` : `<div class="lk"><div class="cm-panel" style="transform:rotate(${rot}deg)">${burst}</div>${sfx}</div>`;
  }
  if (L === 'iso') return story ? '' : isoScene(rnd, theme, fi, busy ? 'busy' : ['cta', 'quote'].includes(sc.template) ? 'center' : 'side');
  return '';
}

/** An isometric platform with blocks (buildings, servers) and data flowing between them. */
function isoScene(rnd, theme, fi, mode) {
  const W = 600, H = 420, cx = 300, cy = 150, a = 34.64, b = 20; // one grid step: 40 units at 30°
  const P = (gx, gy, z = 0) => [cx + (gx - gy) * a, cy + (gx + gy) * b - z];
  const pts = (arr) => arr.map((p) => p.map(r1).join(',')).join(' ');
  const N = 5;
  const plate = `<g class="plate"><polygon points="${pts([P(0, 0), P(N, 0), P(N, N), P(0, N)])}" fill="${shade(theme.bg3 || '#d5def3', 0.25)}"/><polygon points="${pts([P(0, N), P(N, N), P(N, N, -14), P(0, N, -14)])}" fill="${shade(theme.bg3 || '#d5def3', -0.12)}"/><polygon points="${pts([P(N, 0), P(N, N), P(N, N, -14), P(N, 0, -14)])}" fill="${shade(theme.bg3 || '#d5def3', -0.25)}"/>` +
    Array.from({ length: N - 1 }, (_, k) => `<line x1="${r1(P(k + 1, 0)[0])}" y1="${r1(P(k + 1, 0)[1])}" x2="${r1(P(k + 1, N)[0])}" y2="${r1(P(k + 1, N)[1])}"/><line x1="${r1(P(0, k + 1)[0])}" y1="${r1(P(0, k + 1)[1])}" x2="${r1(P(N, k + 1)[0])}" y2="${r1(P(N, k + 1)[1])}"/>`).join('').replace(/<line /g, `<line stroke="${theme.bg || '#fff'}" stroke-width="1.5" `) + '</g>';
  const cells = [];
  for (let gx = 0; gx < N; gx++) for (let gy = 0; gy < N; gy++) cells.push([gx, gy]);
  cells.sort(() => rnd() - 0.5);
  const cols = [theme.accent, theme.accent2, theme.ok, shade(theme.ink, 0.35)];
  const blocks = cells.slice(0, 5 + Math.floor(rnd() * 2)).map(([gx, gy], k) => ({ gx, gy, h: 30 + rnd() * 90, c: cols[k % cols.length], kind: rnd() < 0.5 ? 'server' : 'tower' }));
  const draw = blocks.slice().sort((p, q) => p.gx + p.gy - (q.gx + q.gy)).map((bk, k) => {
    const { gx, gy, h, c } = bk, i = 0.12, j = 0.88;
    const top = [P(gx + i, gy + i, h), P(gx + j, gy + i, h), P(gx + j, gy + j, h), P(gx + i, gy + j, h)];
    const left = [P(gx + i, gy + j, h), P(gx + j, gy + j, h), P(gx + j, gy + j), P(gx + i, gy + j)];
    const right = [P(gx + j, gy + i, h), P(gx + j, gy + j, h), P(gx + j, gy + j), P(gx + j, gy + i)];
    const lines = bk.kind === 'server'
      ? Array.from({ length: Math.floor(h / 22) }, (_, s) => { const z = 12 + s * 22; const p1 = P(gx + i + 0.08, gy + j, z), p2 = P(gx + j - 0.08, gy + j, z); return `<line x1="${r1(p1[0])}" y1="${r1(p1[1])}" x2="${r1(p2[0])}" y2="${r1(p2[1])}" stroke="${shade(c, 0.55)}" stroke-width="3" stroke-linecap="round"/>`; }).join('')
      : Array.from({ length: Math.floor(h / 26) }, (_, s) => { const z = 14 + s * 26; const p1 = P(gx + j, gy + i + 0.2, z), p2 = P(gx + j, gy + j - 0.2, z); return `<line x1="${r1(p1[0])}" y1="${r1(p1[1])}" x2="${r1(p2[0])}" y2="${r1(p2[1])}" stroke="${shade(c, -0.45)}" stroke-width="4" stroke-dasharray="6 6"/>`; }).join('');
    return `<g class="blk" style="animation-delay:${(0.15 + k * 0.12).toFixed(2)}s"><polygon points="${pts(left)}" fill="${c}"/><polygon points="${pts(right)}" fill="${shade(c, -0.25)}"/><polygon points="${pts(top)}" fill="${shade(c, 0.35)}"/>${lines}</g>`;
  }).join('');
  const flows = blocks.slice(0, 4).map((bk, k) => {
    const nx = blocks[(k + 1) % blocks.length];
    const p1 = P(bk.gx + 0.5, bk.gy + 0.5, 0), p2 = P(nx.gx + 0.5, nx.gy + 0.5, 0);
    const m = P(bk.gx + 0.5, nx.gy + 0.5, 0);
    return `<polyline class="flow" points="${pts([p1, m, p2])}" stroke="${k % 2 ? theme.accent2 : theme.accent}" style="animation-delay:-${r1(rnd())}s"/>`;
  }).join('');
  // Where it sits: beside the text in 16:9, low in 9:16 and 1:1; faint behind text-heavy scenes.
  const place = {
    busy: ['right:-4%;bottom:-6%;width:46%;opacity:.35', 'left:-10%;right:-10%;bottom:16%;opacity:.25', 'right:-8%;bottom:-6%;width:62%;opacity:.3'],
    center: ['right:-2%;bottom:-12%;width:30%', 'left:22%;right:22%;bottom:17%;opacity:.7', 'right:-4%;bottom:-9%;width:38%'],
    side: ['right:1%;bottom:4%;width:48%', 'left:4%;right:4%;bottom:22%', 'right:2%;bottom:2%;width:60%'],
  }[mode][fi];
  return `<div class="lk"><svg class="iso" viewBox="0 0 ${W} ${H}" style="${place}">${plate}${flows}${draw}</svg></div>`;
}
