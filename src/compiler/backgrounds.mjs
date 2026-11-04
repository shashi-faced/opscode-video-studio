// Illustrated scene backgrounds for story and dialogue scenes.
// Art is drawn on a 1600×1600 canvas and shown with preserveAspectRatio "xMidYMax slice",
// so every format crops it from the bottom centre:
//   16:9 sees the whole width but only y ≥ 700; 9:16 sees x 350–1250 at full height.
// Characters stand on the ground line GROUND_Y. Keep important art inside y ≥ 700 and
// x 350–1250 so it shows in every format. Moving parts are CSS animations (seekable).

export const ART = 1600;
export const GROUND_Y = 1420;

export const BACKGROUND_ALIASES = {
  garden: 'meadow', field: 'meadow', grass: 'meadow', park: 'meadow', farm: 'meadow', outside: 'meadow', outdoors: 'meadow', hill: 'meadow', hills: 'meadow', meadows: 'meadow',
  jungle: 'forest', woods: 'forest', trees: 'forest',
  mountain: 'mountains', 'rainbow-mountain': 'mountains', valley: 'mountains', 'rainbow-hills': 'mountains',
  sea: 'beach', seaside: 'beach', shore: 'beach', ocean: 'beach', river: 'beach', lake: 'beach',
  gaon: 'village', countryside: 'village', town: 'village',
  street: 'city', road: 'city', market: 'city', downtown: 'city', buildings: 'city',
  sky: 'sky', clouds: 'sky', heaven: 'sky', 'night-sky': 'sky', stars: 'sky', air: 'sky',
  galaxy: 'space', planet: 'space', planets: 'space', moon: 'space', 'outer-space': 'space',
  'under-water': 'underwater', 'under-the-sea': 'underwater', reef: 'underwater', aquarium: 'underwater',
  house: 'home', 'living-room': 'home', room: 'home', kitchen: 'home', inside: 'home', indoors: 'home',
  'bed-room': 'bedroom', bed: 'bedroom', bedtime: 'bedroom', nursery: 'bedroom',
  school: 'classroom', class: 'classroom', library: 'classroom',
  workplace: 'office', desk: 'office', startup: 'office', meeting: 'office',
  diwali: 'festival', celebration: 'festival', party: 'festival', holi: 'festival', eid: 'festival', christmas: 'festival', 'new-year': 'festival', birthday: 'festival', fireworks: 'festival',
};
export const TIME_ALIASES = { morning: 'day', noon: 'day', afternoon: 'day', daytime: 'day', evening: 'sunset', dusk: 'sunset', dawn: 'sunset', sunrise: 'sunset', midnight: 'night', nighttime: 'night', dark: 'night' };

// Deterministic pseudo-random numbers so renders never change between runs.
const rnd = (k, n) => ((Math.sin(k * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;

const PAL = {
  day:    { sky: ['#5ec4ff', '#bfeaff'], hills: ['#9fdc78', '#7cc95c', '#5bb04a'], ground: '#6cbf4f', far: '#b6e0f5', light: '#fffbe6', tint: 0 },
  sunset: { sky: ['#ff7e5f', '#ffc98b'], hills: ['#b9a35f', '#8f8a4a', '#6c7a3d'], ground: '#6f8f40', far: '#e7a98f', light: '#ffe2b8', tint: 0.1 },
  night:  { sky: ['#0b1838', '#2a3f78'], hills: ['#2f4a63', '#243c52', '#1a2f42'], ground: '#1e3a3a', far: '#3b5276', light: '#c9d6ff', tint: 0.4 },
};

let uidCounter = 0;
const svgOpen = (id, pal) => `<svg class="bgart" viewBox="0 0 ${ART} ${ART}" preserveAspectRatio="xMidYMax slice"><defs>
<linearGradient id="${id}sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.sky[0]}"/><stop offset="1" stop-color="${pal.sky[1]}"/></linearGradient>
<radialGradient id="${id}glow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#fff7c2"/><stop offset=".35" stop-color="#ffe066" stop-opacity=".6"/><stop offset="1" stop-color="#ffe066" stop-opacity="0"/></radialGradient>
<linearGradient id="${id}fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".18"/></linearGradient></defs>`;

// ---------- shared pieces ----------
const sky = (id) => `<rect width="${ART}" height="${ART}" fill="url(#${id}sky)"/>`;
const stars = (count = 90, yMax = 1100) => `<g class="bg-stars">${Array.from({ length: count }, (_, k) => `<circle cx="${(rnd(k, 1) * ART).toFixed(0)}" cy="${(rnd(k, 2) * yMax).toFixed(0)}" r="${(1.5 + rnd(k, 3) * 3).toFixed(1)}" fill="#fff" style="animation-delay:-${(rnd(k, 4) * 3).toFixed(2)}s"/>`).join('')}</g>`;
const sunOrMoon = (id, time, x = 1180, y = 860) => time === 'night'
  ? `<circle cx="${x}" cy="${y}" r="150" fill="url(#${id}glow)" opacity=".5"/><circle cx="${x}" cy="${y}" r="62" fill="#fff6d6"/><circle cx="${x + 26}" cy="${y - 18}" r="58" fill="${PAL.night.sky[1]}" opacity=".0"/><circle cx="${x - 18}" cy="${y + 10}" r="9" fill="#efe2b0"/><circle cx="${x + 20}" cy="${y - 20}" r="6" fill="#efe2b0"/>`
  : `<circle cx="${x}" cy="${y}" r="220" fill="url(#${id}glow)"/><circle cx="${x}" cy="${y}" r="78" fill="${time === 'sunset' ? '#ffb35c' : '#ffe45c'}"/>`;
const cloud = (x, y, s = 1, op = 0.95, k = 0) => `<g class="bg-cloud" style="animation-duration:${(26 + rnd(k, 5) * 14).toFixed(1)}s;animation-delay:-${(rnd(k, 6) * 20).toFixed(1)}s"><g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity="${op}"><ellipse cx="0" cy="0" rx="90" ry="44"/><circle cx="-46" cy="-14" r="44"/><circle cx="18" cy="-38" r="56"/><circle cx="66" cy="-8" r="40"/></g></g>`;
const hills = (pal) => `<path d="M0 1180 Q300 1040 620 1150 T1240 1120 T1600 1150 V1600 H0Z" fill="${pal.hills[0]}"/>
<path d="M0 1260 Q380 1140 760 1240 T1600 1220 V1600 H0Z" fill="${pal.hills[1]}"/>
<path d="M0 ${GROUND_Y} Q400 ${GROUND_Y - 40} 800 ${GROUND_Y} T1600 ${GROUND_Y} V1600 H0Z" fill="${pal.hills[2]}"/>
<rect y="${GROUND_Y + 10}" width="${ART}" height="${ART - GROUND_Y}" fill="${pal.hills[2]}"/>`;
const tree = (x, y, s = 1, leaf = '#3fa34d', trunk = '#7a4b2a') => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-16" y="-150" width="32" height="150" rx="10" fill="${trunk}"/><circle cx="0" cy="-200" r="92" fill="${leaf}"/><circle cx="-62" cy="-160" r="62" fill="${leaf}"/><circle cx="64" cy="-158" r="60" fill="${leaf}"/><circle cx="-24" cy="-236" r="44" fill="#ffffff" opacity=".12"/></g>`;
const pine = (x, y, s = 1, c = '#2f7d4f') => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-12" y="-60" width="24" height="60" fill="#6b4226"/><path d="M0 -330 L110 -60 H-110Z M0 -400 L90 -180 H-90Z" fill="${c}"/></g>`;
const flowers = (y, count, k0 = 0) => Array.from({ length: count }, (_, k) => {
  const x = 60 + rnd(k + k0, 7) * 1480, yy = y + rnd(k + k0, 8) * 160, c = ['#ff6fa8', '#ffd23f', '#ffffff', '#ff9a3c', '#b388ff'][k % 5];
  return `<g transform="translate(${x.toFixed(0)} ${yy.toFixed(0)})"><path d="M0 0 V28" stroke="#3f8f3a" stroke-width="5"/><circle r="11" fill="${c}"/><circle r="4.5" fill="#fff3a0"/></g>`;
}).join('');
const grassTufts = (y, count, c) => Array.from({ length: count }, (_, k) => `<path d="M${(rnd(k, 9) * ART).toFixed(0)} ${(y + rnd(k, 10) * 200).toFixed(0)} l10 -26 l6 22 l10 -30 l8 32" stroke="${c}" stroke-width="5" fill="none" stroke-linejoin="round"/>`).join('');
const rainbow = (x, y, r) => ['#ff595e', '#ff924c', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].map((c, k) => `<path d="M${x - r + k * 22} ${y} A${r - k * 22} ${r - k * 22} 0 0 1 ${x + r - k * 22} ${y}" stroke="${c}" stroke-width="22" fill="none" opacity=".85"/>`).join('');
const windowRect = (x, y, w, h, time) => `<g><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="#8b5a3c"/><rect x="${x + 14}" y="${y + 14}" width="${w - 28}" height="${h - 28}" rx="8" fill="${time === 'night' ? '#203a6b' : time === 'sunset' ? '#ffb38a' : '#a9e1ff'}"/>${time === 'night' ? `<circle cx="${x + w * 0.7}" cy="${y + h * 0.35}" r="${w * 0.1}" fill="#fff6d6"/>` : `<circle cx="${x + w * 0.3}" cy="${y + h * 0.45}" r="${w * 0.12}" fill="#fff" opacity=".8"/>`}<path d="M${x + w / 2} ${y + 14} V${y + h - 14} M${x + 14} ${y + h / 2} H${x + w - 14}" stroke="#8b5a3c" stroke-width="10"/></g>`;
const floorAndWall = (wall, floor, trim = '#00000018') => `<rect width="${ART}" height="${GROUND_Y}" fill="${wall}"/><rect y="${GROUND_Y - 120}" width="${ART}" height="20" fill="${trim}"/><rect y="${GROUND_Y}" width="${ART}" height="${ART - GROUND_Y}" fill="${floor}"/>${Array.from({ length: 9 }, (_, k) => `<path d="M${k * 200} ${GROUND_Y} L${k * 200 - 120} ${ART}" stroke="#00000014" stroke-width="6"/>`).join('')}`;
const lampLight = (time) => time === 'night' ? '<rect width="1600" height="1600" fill="#1a2350" opacity=".28"/>' : '';
const nightShade = (time) => time === 'night' ? '<rect width="1600" height="1600" fill="#0a1238" opacity=".32"/>' : time === 'sunset' ? '<rect width="1600" height="1600" fill="#ff7e3f" opacity=".1"/>' : '';

// ---------- backgrounds ----------
const BG = {
  meadow(id, t, pal) {
    return `${sky(id)}${t === 'night' ? stars() : ''}${sunOrMoon(id, t)}${cloud(500, 820, 1, 0.9, 1)}${cloud(1000, 760, 0.8, 0.85, 2)}${cloud(300, 420, 1.1, 0.9, 3)}${cloud(1200, 300, 0.9, 0.9, 4)}
${hills(pal)}${tree(260, 1290, 1.1, t === 'night' ? '#1f5a3a' : '#3fa34d')}${tree(1380, 1300, 0.9, t === 'night' ? '#1f5a3a' : '#4cb35a')}${flowers(1380, 26)}${grassTufts(1360, 30, pal.hills[1])}${nightShade(t)}`;
  },
  forest(id, t, pal) {
    const leaf = t === 'night' ? ['#123c2c', '#18503a', '#1f6447'] : ['#2f7d4f', '#3f9a5a', '#56b46a'];
    return `${sky(id)}${t === 'night' ? stars(60, 900) : ''}${sunOrMoon(id, t, 820, 820)}
${Array.from({ length: 9 }, (_, k) => pine(100 + k * 180, 1180, 1.2 + rnd(k, 1) * 0.3, leaf[0])).join('')}
<path d="M0 1200 H1600 V1600 H0Z" fill="${pal.hills[0]}"/>${Array.from({ length: 7 }, (_, k) => pine(40 + k * 260, 1300, 1.4, leaf[1])).join('')}
<path d="M0 ${GROUND_Y} Q800 ${GROUND_Y - 30} 1600 ${GROUND_Y} V1600 H0Z" fill="${pal.hills[2]}"/>${tree(150, 1380, 1.2, leaf[2])}${tree(1460, 1390, 1.1, leaf[2])}
${[[520, 1420], [1100, 1440], [880, 1460]].map(([x, y]) => `<g transform="translate(${x} ${y})"><rect x="-8" y="-30" width="16" height="30" rx="6" fill="#fff3e0"/><ellipse cx="0" cy="-34" rx="30" ry="18" fill="#e5383b"/><circle cx="-10" cy="-38" r="5" fill="#fff"/><circle cx="10" cy="-32" r="4" fill="#fff"/></g>`).join('')}
${t !== 'night' ? `<g opacity=".18">${[300, 700, 1100].map(x => `<path d="M${x} 700 L${x + 140} 700 L${x + 40} 1350 L${x - 100} 1350Z" fill="#fff8d6"/>`).join('')}</g>` : `<g class="bg-fireflies">${Array.from({ length: 18 }, (_, k) => `<circle cx="${(300 + rnd(k, 11) * 1000).toFixed(0)}" cy="${(900 + rnd(k, 12) * 400).toFixed(0)}" r="5" fill="#fff59d" style="animation-delay:-${(rnd(k, 13) * 3).toFixed(2)}s"/>`).join('')}</g>`}${nightShade(t)}`;
  },
  mountains(id, t, pal) {
    const m = t === 'night' ? ['#2c3e66', '#3a4f7a'] : t === 'sunset' ? ['#8c6a8e', '#a77f8f'] : ['#7c96c8', '#9ab3dd'];
    return `${sky(id)}${t === 'night' ? stars() : ''}${sunOrMoon(id, t, 380, 820)}${cloud(1150, 760, 0.8, 0.8, 7)}${cloud(500, 400, 1, 0.85, 8)}
<path d="M-50 1250 L300 820 L520 1050 L800 700 L1080 1040 L1300 840 L1650 1250Z" fill="${m[0]}"/><path d="M300 820 L360 900 L330 890 L300 930 L270 895 L240 900Z M800 700 L870 790 L830 780 L800 820 L770 785 L730 790Z M1300 840 L1360 915 L1330 905 L1300 940 L1270 910 L1240 915Z" fill="#fff"/>
${t === 'night' ? '' : rainbow(800, 1250, 430)}<path d="M-50 1260 L420 1000 L760 1200 L1120 980 L1650 1260Z" fill="${m[1]}"/>${hills(pal)}${tree(1300, 1300, 0.8)}${flowers(1380, 14, 40)}${nightShade(t)}`;
  },
  beach(id, t, pal) {
    const sea = t === 'night' ? '#173a63' : t === 'sunset' ? '#3f7fb5' : '#2fa4e7';
    return `${sky(id)}${t === 'night' ? stars() : ''}${sunOrMoon(id, t, 1150, 960)}${cloud(450, 820, 0.9, 0.9, 9)}${cloud(900, 420, 1, 0.85, 10)}
<rect y="1060" width="${ART}" height="320" fill="${sea}"/><g class="bg-waves">${Array.from({ length: 4 }, (_, k) => `<path d="M-200 ${1110 + k * 60} q100 -22 200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0 t200 0" stroke="#ffffff" stroke-opacity=".45" stroke-width="7" fill="none" style="animation-delay:-${k * 0.8}s"/>`).join('')}</g>
<path d="M0 1300 Q800 1250 1600 1300 V1600 H0Z" fill="#f6dca0"/><rect y="${GROUND_Y + 8}" width="${ART}" height="300" fill="#f2cf86"/>
<g transform="translate(300 1330)"><path d="M0 0 Q-20 -220 30 -420" stroke="#8b5a2b" stroke-width="26" fill="none"/>${[-40, 10, 60, 120, 170].map(a => `<path d="M30 -420 q${Math.cos(a * Math.PI / 180) * 120} ${-40 + Math.sin(a * Math.PI / 180) * 60} ${Math.cos(a * Math.PI / 180) * 200} ${80}" stroke="#2f9e44" stroke-width="30" fill="none" stroke-linecap="round"/>`).join('')}</g>
<g transform="translate(1250 1420)"><path d="M-40 0 a40 40 0 0 1 80 0Z" fill="#ff8fab"/><path d="M0 -40 V0 M-28 -28 L0 0 M28 -28 L0 0" stroke="#fff" stroke-width="4"/></g>${nightShade(t)}`;
  },
  village(id, t, pal) {
    const hut = (x, y, s, wall = '#e8b27a', roof = '#9c5b2e') => `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-110" y="-150" width="220" height="150" fill="${wall}"/><path d="M-150 -140 L0 -280 L150 -140Z" fill="${roof}"/><path d="M-150 -140 L0 -280 L150 -140" stroke="#6b3a1c" stroke-width="10" fill="none"/><rect x="-28" y="-90" width="56" height="90" rx="26" fill="#6b3a1c"/><rect x="50" y="-110" width="40" height="40" fill="${t === 'night' ? '#ffd166' : '#5b3a22'}"/></g>`;
    return `${sky(id)}${t === 'night' ? stars() : ''}${sunOrMoon(id, t, 1250, 820)}${cloud(500, 800, 0.9, 0.9, 11)}${cloud(900, 380, 1, 0.9, 12)}${hills(pal)}
${hut(330, 1300, 1.05)}${hut(1260, 1290, 0.9, '#f0c48a', '#8a4b23')}${tree(760, 1250, 0.85, t === 'night' ? '#1f5a3a' : '#3f9a5a')}
<g transform="translate(560 1330)"><circle cx="0" cy="-40" r="40" fill="none" stroke="#8b5a2b" stroke-width="10"/><rect x="-60" y="-14" width="120" height="14" fill="#8b5a2b"/></g>${grassTufts(1370, 24, pal.hills[1])}${flowers(1400, 12, 60)}${nightShade(t)}`;
  },
  city(id, t, pal) {
    const lit = t === 'night';
    const building = (x, w, h, c, k) => `<g><rect x="${x}" y="${GROUND_Y - 40 - h}" width="${w}" height="${h}" fill="${c}"/>${Array.from({ length: Math.floor(h / 70) * Math.floor(w / 60) }, (_, j) => { const cols = Math.floor(w / 60); const wx = x + 18 + (j % cols) * 60, wy = GROUND_Y - 20 - h + Math.floor(j / cols) * 70; return `<rect x="${wx}" y="${wy}" width="30" height="40" rx="4" fill="${lit ? (rnd(k * 31 + j, 2) > 0.45 ? '#ffd166' : '#2b3557') : '#bfe3ff'}"/>`; }).join('')}</g>`;
    const cols = lit ? ['#2b3a67', '#33457a', '#3c4f88'] : t === 'sunset' ? ['#a26a7a', '#b77c86', '#8e5f75'] : ['#6c8ebf', '#7fa1d1', '#5a7fb3'];
    return `${sky(id)}${lit ? stars(70, 800) : ''}${sunOrMoon(id, t, 1300, 760)}${cloud(400, 760, 0.8, 0.8, 13)}
${[[0, 220, 520], [240, 180, 640], [440, 240, 460], [700, 200, 700], [920, 260, 540], [1200, 200, 620], [1420, 220, 500]].map(([x, w, h], k) => building(x, w, h, cols[k % 3], k)).join('')}
<rect y="${GROUND_Y - 40}" width="${ART}" height="60" fill="#9aa3b5"/><rect y="${GROUND_Y + 20}" width="${ART}" height="${ART - GROUND_Y}" fill="#4a5063"/>${Array.from({ length: 8 }, (_, k) => `<rect x="${k * 220 + 40}" y="${GROUND_Y + 120}" width="120" height="14" fill="#f5f5f5"/>`).join('')}
${[200, 800, 1400].map(x => `<g><rect x="${x}" y="${GROUND_Y - 300}" width="12" height="270" fill="#3a3f52"/><circle cx="${x + 6}" cy="${GROUND_Y - 300}" r="${lit ? 22 : 14}" fill="${lit ? '#fff2b3' : '#e0e0e0'}"/></g>`).join('')}${nightShade(t)}`;
  },
  sky(id, t, pal) {
    return `${sky(id)}${t === 'night' ? stars(160, 1600) : ''}${sunOrMoon(id, t, 1200, 840)}
${[[300, 900, 1.3], [900, 1000, 1.6], [1400, 1100, 1.2], [600, 1250, 1.8], [1200, 1300, 1.5], [200, 1400, 1.6], [800, 1450, 2], [1450, 1450, 1.6], [400, 500, 1.2], [1100, 400, 1.3]].map(([x, y, s], k) => cloud(x, y, s, t === 'night' ? 0.35 : 0.95, k + 20)).join('')}
<path d="M0 ${GROUND_Y + 30} Q200 ${GROUND_Y - 30} 400 ${GROUND_Y + 20} Q600 ${GROUND_Y - 40} 800 ${GROUND_Y + 10} Q1000 ${GROUND_Y - 40} 1200 ${GROUND_Y + 20} Q1400 ${GROUND_Y - 30} 1600 ${GROUND_Y + 30} V1600 H0Z" fill="#ffffff" opacity="${t === 'night' ? 0.4 : 0.95}"/>`;
  },
  space(id) {
    const planet = (x, y, r, c, ring) => `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * 0.3}" cy="${y - r * 0.3}" r="${r * 0.55}" fill="#fff" opacity=".15"/>${ring ? `<ellipse cx="${x}" cy="${y}" rx="${r * 1.7}" ry="${r * 0.4}" fill="none" stroke="#ffd59e" stroke-width="12" opacity=".9"/>` : ''}</g>`;
    return `<rect width="${ART}" height="${ART}" fill="#0b0f2e"/><circle cx="800" cy="600" r="700" fill="#3a2a7a" opacity=".35"/>${stars(200, 1600)}
${planet(1250, 820, 110, '#ff9a5c', true)}${planet(420, 900, 70, '#6fd3ff', false)}${planet(1000, 420, 50, '#c38bff', false)}
<path d="M0 ${GROUND_Y} Q800 ${GROUND_Y - 60} 1600 ${GROUND_Y} V1600 H0Z" fill="#9ea7c9"/><rect y="${GROUND_Y + 20}" width="${ART}" height="300" fill="#8a93b8"/>${[[300, 1420, 50], [900, 1460, 34], [1300, 1400, 60], [620, 1500, 26]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.4}" fill="#6f789e"/>`).join('')}`;
  },
  underwater(id) {
    return `<defs><linearGradient id="${id}sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2bb3e8"/><stop offset="1" stop-color="#0b4f86"/></linearGradient></defs><rect width="${ART}" height="${ART}" fill="url(#${id}sea)"/>
<g opacity=".15">${[200, 600, 1000, 1400].map(x => `<path d="M${x} 0 L${x + 160} 0 L${x + 40} 1400 L${x - 80} 1400Z" fill="#fff"/>`).join('')}</g>
<g class="bg-bubbles">${Array.from({ length: 26 }, (_, k) => `<circle cx="${(200 + rnd(k, 14) * 1200).toFixed(0)}" cy="${(800 + rnd(k, 15) * 600).toFixed(0)}" r="${(6 + rnd(k, 16) * 12).toFixed(0)}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="3" style="animation-delay:-${(rnd(k, 17) * 6).toFixed(2)}s"/>`).join('')}</g>
${[[300, '#ff6f91'], [1300, '#ffc75f'], [180, '#845ec2'], [1460, '#00c9a7']].map(([x, c], k) => `<g transform="translate(${x} ${GROUND_Y})"><path d="M0 0 C-30 -80 30 -120 0 -200 C-20 -240 20 -260 10 -300" stroke="${c}" stroke-width="22" fill="none" stroke-linecap="round" class="bg-sway" style="animation-delay:-${k}s"/></g>`).join('')}
<path d="M0 ${GROUND_Y} Q800 ${GROUND_Y - 50} 1600 ${GROUND_Y} V1600 H0Z" fill="#e9d29a"/><rect y="${GROUND_Y + 20}" width="${ART}" height="300" fill="#dcc283"/>
${[[520, 1000, '#ffb703'], [1100, 900, '#fb5607']].map(([x, y, c], k) => `<g class="bg-fish" style="animation-delay:-${k * 4}s"><g transform="translate(${x} ${y})"><ellipse rx="44" ry="26" fill="${c}"/><path d="M40 0 L76 -24 L76 24Z" fill="${c}"/><circle cx="-20" cy="-6" r="6" fill="#222"/></g></g>`).join('')}`;
  },
  home(id, t) {
    return `${floorAndWall('#ffe8c7', '#c98f5a')}${windowRect(1040, 760, 340, 300, t)}
<g transform="translate(260 ${GROUND_Y})"><rect x="-180" y="-170" width="380" height="120" rx="40" fill="#e76f51"/><rect x="-200" y="-110" width="420" height="90" rx="30" fill="#f4845f"/><rect x="-180" y="-30" width="20" height="30" fill="#6b3a1c"/><rect x="180" y="-30" width="20" height="30" fill="#6b3a1c"/></g>
<g transform="translate(700 ${GROUND_Y})"><rect x="-60" y="-150" width="120" height="16" rx="6" fill="#8b5a3c"/><rect x="-8" y="-140" width="16" height="140" fill="#8b5a3c"/><ellipse cx="0" cy="-168" rx="34" ry="22" fill="#9ccc65"/></g>
<rect x="520" y="820" width="220" height="160" rx="8" fill="#8b5a3c"/><rect x="536" y="836" width="188" height="128" fill="#bde0fe"/><path d="M536 964 L600 880 L650 930 L700 870 L724 964Z" fill="#7cc95c"/>
<g transform="translate(1380 ${GROUND_Y})"><rect x="-12" y="-260" width="24" height="260" fill="#6b4226"/><path d="M-70 -260 L70 -260 L44 -340 L-44 -340Z" fill="#ffd166"/></g>${lampLight(t)}`;
  },
  bedroom(id, t) {
    return `${floorAndWall(t === 'night' ? '#4b5a9a' : '#cfe3ff', '#a77b56')}${windowRect(1060, 700, 300, 300, t)}${t === 'night' ? stars(20, 600) : ''}
<g transform="translate(330 ${GROUND_Y})"><rect x="-260" y="-260" width="40" height="260" rx="12" fill="#8b5a3c"/><rect x="-240" y="-150" width="520" height="110" rx="20" fill="#fefae0"/><rect x="-100" y="-170" width="380" height="140" rx="30" fill="#ff8fab"/><ellipse cx="-170" cy="-170" rx="70" ry="34" fill="#fff"/><rect x="-240" y="-40" width="520" height="40" fill="#8b5a3c"/></g>
${Array.from({ length: 10 }, (_, k) => `<path d="M${120 + k * 140} 640 l12 24 26 4 -19 18 5 26 -24 -12 -24 12 5 -26 -19 -18 26 -4z" fill="#fff3b0" opacity="${t === 'night' ? 0.85 : 0.5}"/>`).join('')}
<g transform="translate(860 ${GROUND_Y})"><rect x="-50" y="-110" width="100" height="110" rx="10" fill="#8b5a3c"/><rect x="-8" y="-180" width="16" height="70" fill="#6b4226"/><path d="M-46 -180 L46 -180 L30 -230 L-30 -230Z" fill="#ffd166"/>${t === 'night' ? '<circle cx="0" cy="-200" r="120" fill="#ffd166" opacity=".18"/>' : ''}</g>${t === 'night' ? '<rect width="1600" height="1600" fill="#0a1238" opacity=".2"/>' : ''}`;
  },
  classroom(id, t) {
    return `${floorAndWall('#fff3d6', '#b9895c')}<rect x="420" y="720" width="760" height="380" rx="16" fill="#2f5d50"/><rect x="420" y="720" width="760" height="380" rx="16" fill="none" stroke="#8b5a3c" stroke-width="20"/>
<g stroke="#f1f1f1" stroke-width="6" fill="none" stroke-linecap="round"><path d="M500 820 h120 M500 870 h200 M760 820 q40 -40 80 0 t80 0"/><text x="760" y="960" fill="#f1f1f1" stroke="none" font-family="Poppins,sans-serif" font-size="70" font-weight="700">A B C</text><text x="500" y="1000" fill="#f1f1f1" stroke="none" font-family="Poppins,sans-serif" font-size="56" font-weight="700">1 + 2 = 3</text></g>
${windowRect(1260, 760, 240, 260, t)}<circle cx="260" cy="800" r="70" fill="#fff" stroke="#8b5a3c" stroke-width="12"/><path d="M260 800 V752 M260 800 L294 820" stroke="#333" stroke-width="8" stroke-linecap="round"/>
${[[300, 1300], [1300, 1310]].map(([x, y]) => `<g transform="translate(${x} ${y})"><rect x="-130" y="-30" width="260" height="30" rx="8" fill="#d4a373"/><rect x="-110" y="0" width="16" height="70" fill="#8b5a3c"/><rect x="94" y="0" width="16" height="70" fill="#8b5a3c"/><rect x="-60" y="-70" width="60" height="40" rx="6" fill="#ef476f"/><rect x="10" y="-60" width="70" height="30" rx="6" fill="#118ab2"/></g>`).join('')}${lampLight(t)}`;
  },
  office(id, t) {
    return `${floorAndWall('#eef2f8', '#9aa5b8')}${windowRect(1100, 700, 380, 360, t)}<rect x="300" y="760" width="420" height="260" rx="14" fill="#fff" stroke="#c8d1e0" stroke-width="10"/><path d="M340 980 L420 900 L480 940 L560 840 L660 880" stroke="#4f5bff" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
<g transform="translate(800 ${GROUND_Y})"><rect x="-320" y="-180" width="640" height="30" rx="10" fill="#6c4f3d"/><rect x="-300" y="-150" width="20" height="150" fill="#4a3428"/><rect x="280" y="-150" width="20" height="150" fill="#4a3428"/><rect x="-140" y="-340" width="250" height="160" rx="10" fill="#222b45"/><rect x="-126" y="-326" width="222" height="132" rx="6" fill="#4f5bff"/><rect x="-20" y="-180" width="20" height="10" fill="#222b45"/><rect x="170" y="-250" width="60" height="70" rx="8" fill="#ff9a3c"/></g>
<g transform="translate(180 ${GROUND_Y})"><rect x="-40" y="-110" width="80" height="110" rx="10" fill="#bc6c25"/><circle cx="0" cy="-150" r="60" fill="#40916c"/><circle cx="-40" cy="-130" r="40" fill="#52b788"/><circle cx="40" cy="-130" r="40" fill="#52b788"/></g>${lampLight(t)}`;
  },
  festival(id, t) {
    const night = t !== 'day';
    const burst = (x, y, c, k) => `<g class="bg-burst" style="animation-delay:-${(k * 0.7).toFixed(1)}s;transform-origin:${x}px ${y}px">${Array.from({ length: 14 }, (_, j) => { const a = j * Math.PI * 2 / 14; return `<path d="M${x + Math.cos(a) * 30} ${y + Math.sin(a) * 30} L${(x + Math.cos(a) * 120).toFixed(0)} ${(y + Math.sin(a) * 120).toFixed(0)}" stroke="${c}" stroke-width="8" stroke-linecap="round"/>`; }).join('')}</g>`;
    const diya = (x, k) => `<g transform="translate(${x} ${GROUND_Y + 30})"><path d="M-46 0 Q0 46 46 0Z" fill="#c1440e"/><path d="M-46 0 H46" stroke="#ffb703" stroke-width="6"/><path class="bg-flame" d="M0 -8 Q-14 -34 0 -60 Q14 -34 0 -8Z" fill="#ffd166" style="animation-delay:-${(k * 0.3).toFixed(1)}s"/><circle cx="0" cy="-30" r="44" fill="#ffd166" opacity=".18"/></g>`;
    return `<defs><linearGradient id="${id}fest" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${night ? '#1a0b3b' : '#ffcf8a'}"/><stop offset="1" stop-color="${night ? '#5a1a5e' : '#ff9e7a'}"/></linearGradient></defs><rect width="${ART}" height="${ART}" fill="url(#${id}fest)"/>${night ? stars(80, 900) : ''}
${night ? [[420, 820, '#ffd166'], [1180, 760, '#ff5e78'], [800, 520, '#7bdff2'], [300, 400, '#c77dff'], [1300, 360, '#ffd166']].map(([x, y, c], k) => burst(x, y, c, k)).join('') : ''}
<path d="M0 740 Q400 860 800 740 T1600 740" stroke="#ffd166" stroke-width="5" fill="none"/>${Array.from({ length: 16 }, (_, k) => { const x = k * 100 + 50, y = 740 + Math.sin((k / 16) * Math.PI * 2) * 60 + 30; return `<circle cx="${x}" cy="${y.toFixed(0)}" r="13" fill="${['#ff5e78', '#ffd166', '#7bdff2', '#c77dff'][k % 4]}" class="bg-bulb" style="animation-delay:-${(k * 0.2).toFixed(1)}s"/>`; }).join('')}
<g transform="translate(800 1200)" opacity=".9">${Array.from({ length: 8 }, (_, k) => `<ellipse rx="44" ry="110" transform="rotate(${k * 22.5})" fill="${['#ff5e78', '#ffd166'][k % 2]}" opacity=".5"/>`).join('')}<circle r="50" fill="#ffd166"/></g>
<path d="M0 ${GROUND_Y} H1600 V1600 H0Z" fill="${night ? '#3a1240' : '#e76f51'}"/><rect y="${GROUND_Y}" width="1600" height="14" fill="#ffd166" opacity=".6"/>${[200, 420, 1180, 1400].map((x, k) => diya(x, k)).join('')}`;
  },
};

export const BACKGROUND_CSS = `
.bg{position:absolute;inset:0;z-index:0;overflow:hidden}
.bgart{position:absolute;inset:0;width:100%;height:100%;display:block}
.bg-cloud{animation:bg-drift 30s linear infinite alternate}
.bg-stars circle{animation:twinkle 3s ease-in-out infinite}
.bg-fireflies circle{animation:twinkle 2.2s ease-in-out infinite}
.bg-waves path{animation:bg-wave 3s ease-in-out infinite alternate}
.bg-bubbles circle{animation:bg-rise 6s linear infinite}
.bg-sway{transform-box:fill-box;transform-origin:50% 100%;animation:bg-sway 3s ease-in-out infinite alternate}
.bg-fish{animation:bg-swim 9s ease-in-out infinite alternate}
.bg-flame{transform-box:fill-box;transform-origin:50% 100%;animation:bg-flicker .5s ease-in-out infinite alternate}
.bg-bulb{animation:twinkle 1.6s ease-in-out infinite}
.bg-burst{animation:bg-burst 2.8s ease-out infinite}
@keyframes bg-drift{from{transform:translateX(-60px)}to{transform:translateX(60px)}}
@keyframes bg-wave{from{transform:translateX(-30px)}to{transform:translateX(30px)}}
@keyframes bg-rise{from{transform:translateY(0);opacity:0}15%{opacity:1}to{transform:translateY(-600px);opacity:0}}
@keyframes bg-sway{from{transform:rotate(-6deg)}to{transform:rotate(6deg)}}
@keyframes bg-swim{from{transform:translateX(-120px)}to{transform:translateX(160px)}}
@keyframes bg-flicker{from{transform:scale(.9,.85)}to{transform:scale(1.05,1.1)}}
@keyframes bg-burst{0%{transform:scale(.1);opacity:0}15%{opacity:1}60%{transform:scale(1);opacity:.9}100%{transform:scale(1.15);opacity:0}}
`;

/** Full-bleed background markup for a scene. */
export function backgroundHtml(name, time = 'day') {
  const fn = BG[name] || BG.meadow;
  const t = PAL[time] ? time : 'day';
  const id = `bg${uidCounter++}`;
  return `<div class="bg">${svgOpen(id, PAL[t])}${fn(id, t, PAL[t])}</svg></div>`;
}

/**
 * Where the ground line and characters sit, in px, per format. The art is scaled by
 * s = max(W, H) / 1600 and bottom-aligned, so the ground is (1600 - GROUND_Y) * s above
 * the bottom edge.
 */
export function stageLayout(width, height) {
  const s = Math.max(width, height) / ART;
  const wide = width > height * 1.2, tall = height > width * 1.2;
  // Characters may stand a little behind the drawn ground line (still on the ground),
  // which keeps their feet clear of the captions in tall and square videos.
  const ground = Math.max((ART - GROUND_Y) * s, wide ? 0 : tall ? height * 0.15 : height * 0.14);
  const chh = wide ? height * 0.5 : tall ? height * 0.32 : height * 0.45;
  return { ground: Math.round(ground), chh: Math.round(chh) };
}
