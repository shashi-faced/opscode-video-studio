// Maps (plan 18 M4): country shapes from Natural Earth 1:110m (public domain, via world-atlas; see
// src/data/LICENSE-world-atlas.txt), looked up by name (English, common short names, some Hindi),
// a small table of big cities, a Mercator projection and a view fitted to what the scene shows.
import fs from 'node:fs';

let WORLD = null;
/** name -> { name, polys: [[[lon,lat],…] rings…][], box: [w,s,e,n] of the main shape, center: [lon,lat] } */
function world() {
  if (WORLD) return WORLD;
  const topo = JSON.parse(fs.readFileSync(new URL('../data/world-110m.json', import.meta.url), 'utf8'));
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map((arc) => {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
  });
  const ring = (ids) => {
    const out = [];
    for (const id of ids) {
      const a = id < 0 ? arcs[~id].slice().reverse() : arcs[id];
      out.push(...(out.length ? a.slice(1) : a));
    }
    // Shapes that cross the 180° meridian (Russia, Fiji) jump from +180 to -180; keep them continuous
    // (past 180) so no edge is drawn across the whole map.
    let shift = 0;
    return out.map(([lon, lat], i) => {
      if (i) { const d = lon - out[i - 1][0]; if (d > 180) shift -= 360; else if (d < -180) shift += 360; }
      return [lon + shift, lat];
    });
  };
  WORLD = new Map();
  for (const g of topo.objects.countries.geometries) {
    const polys = g.type === 'Polygon' ? [g.arcs.map(ring)] : g.type === 'MultiPolygon' ? g.arcs.map((p) => p.map(ring)) : [];
    if (!polys.length) continue;
    // The main shape (largest area) gives the box and the label point, so France is not stretched to
    // French Guiana and the USA is not stretched to Alaska.
    let main = polys[0], best = -1;
    for (const p of polys) { const a = Math.abs(area(p[0])); if (a > best) { best = a; main = p; } }
    WORLD.set(g.properties.name, { name: g.properties.name, polys, box: bbox(main[0]), center: centroid(main[0]) });
  }
  return WORLD;
}

function area(r) { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] * r[i][1] - r[i][0] * r[j][1]); return s / 2; }
function bbox(r) {
  let w = 180, s = 90, e = -180, n = -90;
  for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
  return [w, s, e, n];
}
function centroid(r) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
    cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f; a += f;
  }
  if (!a) { const b = bbox(r); return [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; }
  return [cx / (3 * a), cy / (3 * a)];
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKC').replace(/[.'’]/g, '').replace(/[\s_-]+/g, ' ').trim();
const COUNTRY_ALIASES = {
  usa: 'United States of America', us: 'United States of America', 'united states': 'United States of America', america: 'United States of America', 'u s a': 'United States of America',
  uk: 'United Kingdom', britain: 'United Kingdom', 'great britain': 'United Kingdom', england: 'United Kingdom', scotland: 'United Kingdom', wales: 'United Kingdom',
  uae: 'United Arab Emirates', dubai: 'United Arab Emirates', 'czech republic': 'Czechia', 'bosnia and herzegovina': 'Bosnia and Herz.', bosnia: 'Bosnia and Herz.',
  'drc': 'Dem. Rep. Congo', 'dr congo': 'Dem. Rep. Congo', 'democratic republic of the congo': 'Dem. Rep. Congo', 'republic of the congo': 'Congo',
  'central african republic': 'Central African Rep.', 'south sudan': 'S. Sudan', 'dominican republic': 'Dominican Rep.', 'equatorial guinea': 'Eq. Guinea',
  'western sahara': 'W. Sahara', 'ivory coast': "Côte d'Ivoire", 'cote divoire': "Côte d'Ivoire", swaziland: 'eSwatini', eswatini: 'eSwatini', 'north macedonia': 'Macedonia',
  'east timor': 'Timor-Leste', burma: 'Myanmar', korea: 'South Korea', 'republic of korea': 'South Korea', persia: 'Iran', holland: 'Netherlands', 'the netherlands': 'Netherlands',
  turkiye: 'Turkey', 'türkiye': 'Turkey', 'solomon islands': 'Solomon Is.', 'falkland islands': 'Falkland Is.', ussr: 'Russia', 'russian federation': 'Russia', ceylon: 'Sri Lanka',
  // Hindi
  'भारत': 'India', 'हिंदुस्तान': 'India', 'हिन्दुस्तान': 'India', 'चीन': 'China', 'अमेरिका': 'United States of America', 'अमरीका': 'United States of America', 'जापान': 'Japan',
  'पाकिस्तान': 'Pakistan', 'रूस': 'Russia', 'ब्रिटेन': 'United Kingdom', 'इंग्लैंड': 'United Kingdom', 'नेपाल': 'Nepal', 'बांग्लादेश': 'Bangladesh', 'श्रीलंका': 'Sri Lanka',
  'फ्रांस': 'France', 'जर्मनी': 'Germany', 'इटली': 'Italy', 'ऑस्ट्रेलिया': 'Australia', 'कनाडा': 'Canada', 'ब्राज़ील': 'Brazil', 'ब्राजील': 'Brazil', 'मिस्र': 'Egypt',
  'ईरान': 'Iran', 'इराक': 'Iraq', 'अफ़ग़ानिस्तान': 'Afghanistan', 'अफगानिस्तान': 'Afghanistan', 'भूटान': 'Bhutan', 'म्यांमार': 'Myanmar', 'इंडोनेशिया': 'Indonesia',
  'सऊदी अरब': 'Saudi Arabia', 'इज़राइल': 'Israel', 'इजराइल': 'Israel', 'यूक्रेन': 'Ukraine', 'दक्षिण अफ्रीका': 'South Africa', 'मेक्सिको': 'Mexico', 'स्पेन': 'Spain', 'तुर्की': 'Turkey',
  'दक्षिण कोरिया': 'South Korea', 'उत्तर कोरिया': 'North Korea', 'थाईलैंड': 'Thailand', 'वियतनाम': 'Vietnam', 'मलेशिया': 'Malaysia', 'ग्रीस': 'Greece',
};
let NAME_INDEX = null;
/** A country by name, or null. Accepts the map's own names, common names and some Hindi names. */
export function country(name) {
  const W = world();
  if (!NAME_INDEX) { NAME_INDEX = new Map(); for (const k of W.keys()) NAME_INDEX.set(norm(k), k); }
  const n = norm(name);
  const hit = NAME_INDEX.get(n) || COUNTRY_ALIASES[n] || COUNTRY_ALIASES[String(name || '').trim()];
  return hit && W.get(hit) ? W.get(hit) : null;
}
export const countryNames = () => [...world().keys()];

// Big cities [lat, lon] (to about 0.1°, plenty at this map scale). Hindi names point to the same place.
const CITIES = {
  delhi: [28.61, 77.21], 'new delhi': [28.61, 77.21], mumbai: [19.08, 72.88], bombay: [19.08, 72.88], kolkata: [22.57, 88.36], calcutta: [22.57, 88.36], chennai: [13.08, 80.27], madras: [13.08, 80.27],
  bengaluru: [12.97, 77.59], bangalore: [12.97, 77.59], hyderabad: [17.39, 78.49], ahmedabad: [23.02, 72.57], pune: [18.52, 73.86], jaipur: [26.91, 75.79], lucknow: [26.85, 80.95],
  varanasi: [25.32, 82.97], patna: [25.59, 85.14], bhopal: [23.26, 77.41], kochi: [9.93, 76.27], goa: [15.3, 74.12], amritsar: [31.63, 74.87], agra: [27.18, 78.01], srinagar: [34.08, 74.8],
  guwahati: [26.14, 91.74], chandigarh: [30.73, 76.78], surat: [21.17, 72.83], indore: [22.72, 75.86], nagpur: [21.15, 79.09], kanpur: [26.45, 80.33], dehradun: [30.32, 78.03], shimla: [31.1, 77.17],
  karachi: [24.86, 67.0], lahore: [31.52, 74.36], islamabad: [33.68, 73.05], dhaka: [23.81, 90.41], kathmandu: [27.72, 85.32], colombo: [6.93, 79.86], thimphu: [27.47, 89.64], kabul: [34.56, 69.21],
  beijing: [39.9, 116.4], shanghai: [31.23, 121.47], 'hong kong': [22.32, 114.17], tokyo: [35.68, 139.69], osaka: [34.69, 135.5], seoul: [37.57, 126.98], singapore: [1.35, 103.82],
  bangkok: [13.76, 100.5], jakarta: [-6.2, 106.85], manila: [14.6, 120.98], 'kuala lumpur': [3.14, 101.69], hanoi: [21.03, 105.85], taipei: [25.03, 121.57],
  dubai: [25.2, 55.27], 'abu dhabi': [24.45, 54.38], riyadh: [24.71, 46.68], mecca: [21.39, 39.86], doha: [25.29, 51.53], tehran: [35.69, 51.39], baghdad: [33.31, 44.36], jerusalem: [31.77, 35.21],
  istanbul: [41.01, 28.98], cairo: [30.04, 31.24], nairobi: [-1.29, 36.82], lagos: [6.52, 3.38], johannesburg: [-26.2, 28.05], 'cape town': [-33.92, 18.42], addis: [9.03, 38.74], 'addis ababa': [9.03, 38.74],
  london: [51.51, -0.13], paris: [48.86, 2.35], berlin: [52.52, 13.4], rome: [41.9, 12.5], madrid: [40.42, -3.7], lisbon: [38.72, -9.14], amsterdam: [52.37, 4.9], moscow: [55.76, 37.62],
  athens: [37.98, 23.73], vienna: [48.21, 16.37], stockholm: [59.33, 18.07], kyiv: [50.45, 30.52], warsaw: [52.23, 21.01], zurich: [47.38, 8.54], geneva: [46.2, 6.14],
  'new york': [40.71, -74.01], washington: [38.91, -77.04], 'los angeles': [34.05, -118.24], 'san francisco': [37.77, -122.42], chicago: [41.88, -87.63], 'silicon valley': [37.39, -122.08],
  seattle: [47.61, -122.33], miami: [25.76, -80.19], toronto: [43.65, -79.38], vancouver: [49.28, -123.12], 'mexico city': [19.43, -99.13], 'sao paulo': [-23.55, -46.63], 'são paulo': [-23.55, -46.63],
  'rio de janeiro': [-22.91, -43.17], 'buenos aires': [-34.6, -58.38], lima: [-12.05, -77.04], bogota: [4.71, -74.07], sydney: [-33.87, 151.21], melbourne: [-37.81, 144.96], auckland: [-36.85, 174.76],
  muscat: [23.59, 58.41], venice: [45.44, 12.32], alexandria: [31.2, 29.92], samarkand: [39.65, 66.96], tashkent: [41.3, 69.24], lhasa: [29.65, 91.1], kanyakumari: [8.08, 77.55],
  kozhikode: [11.26, 75.78], calicut: [11.26, 75.78], madurai: [9.93, 78.12], mysuru: [12.3, 76.64], mysore: [12.3, 76.64], rameswaram: [9.29, 79.31], 'port blair': [11.62, 92.73], leh: [34.15, 77.58],
  gangtok: [27.33, 88.61], 'bodh gaya': [24.7, 84.99], ayodhya: [26.8, 82.2], prayagraj: [25.43, 81.85], allahabad: [25.43, 81.85], haridwar: [29.95, 78.16], rishikesh: [30.09, 78.27], ujjain: [23.18, 75.78],
  dwarka: [22.24, 68.97], puri: [19.81, 85.83], hampi: [15.33, 76.46], bhubaneswar: [20.3, 85.82], raipur: [21.25, 81.63], ranchi: [23.34, 85.31], thiruvananthapuram: [8.52, 76.94], visakhapatnam: [17.69, 83.22],
  coimbatore: [11.02, 76.96], udaipur: [24.59, 73.71], jodhpur: [26.24, 73.02], jaisalmer: [26.92, 70.91], mathura: [27.49, 77.67], 'kedarnath': [30.73, 79.07], shillong: [25.58, 91.89], imphal: [24.82, 93.94],
  genoa: [44.41, 8.93], seville: [37.39, -5.98], basra: [30.51, 47.81], aden: [12.79, 45.03], zanzibar: [-6.16, 39.19], malacca: [2.19, 102.25], guangzhou: [23.13, 113.26], canton: [23.13, 113.26],
  "xian": [34.34, 108.94], kyoto: [35.01, 135.77], hiroshima: [34.39, 132.46], boston: [42.36, -71.06], houston: [29.76, -95.37], 'las vegas': [36.17, -115.14], havana: [23.11, -82.37],
  'panama city': [8.98, -79.52], santiago: [-33.45, -70.67], brussels: [50.85, 4.35], prague: [50.08, 14.44], budapest: [47.5, 19.04], dublin: [53.35, -6.26], edinburgh: [55.95, -3.19],
  oslo: [59.91, 10.75], helsinki: [60.17, 24.94], copenhagen: [55.68, 12.57], barcelona: [41.39, 2.17], milan: [45.46, 9.19], munich: [48.14, 11.58], frankfurt: [50.11, 8.68],
  'st petersburg': [59.93, 30.36], 'saint petersburg': [59.93, 30.36], 'tel aviv': [32.09, 34.78], beirut: [33.89, 35.5], damascus: [33.51, 36.29], amman: [31.95, 35.93], 'kuwait city': [29.38, 47.98],
  male: [4.18, 73.51], yangon: [16.84, 96.17], 'ho chi minh city': [10.82, 106.63], saigon: [10.82, 106.63], 'phnom penh': [11.56, 104.92], bali: [-8.34, 115.09], perth: [-31.95, 115.86],
  brisbane: [-27.47, 153.03], wellington: [-41.29, 174.78], accra: [5.6, -0.19], dakar: [14.72, -17.47], casablanca: [33.57, -7.59], marrakesh: [31.63, -7.99], tunis: [36.81, 10.18],
  kinshasa: [-4.44, 15.27], mombasa: [-4.04, 39.67], durban: [-29.86, 31.02], shenzhen: [22.54, 114.06], wuhan: [30.59, 114.31], chongqing: [29.56, 106.55], ulaanbaatar: [47.89, 106.91],
  medina: [24.47, 39.61], jeddah: [21.49, 39.19], 'new orleans': [29.95, -90.07], montreal: [45.5, -73.57], ottawa: [45.42, -75.7], canberra: [-35.28, 149.13],
  'दिल्ली': [28.61, 77.21], 'नई दिल्ली': [28.61, 77.21], 'मुंबई': [19.08, 72.88], 'कोलकाता': [22.57, 88.36], 'चेन्नई': [13.08, 80.27], 'बेंगलुरु': [12.97, 77.59], 'हैदराबाद': [17.39, 78.49],
  'जयपुर': [26.91, 75.79], 'लखनऊ': [26.85, 80.95], 'वाराणसी': [25.32, 82.97], 'पटना': [25.59, 85.14], 'आगरा': [27.18, 78.01], 'अमृतसर': [31.63, 74.87], 'पुणे': [18.52, 73.86],
  'अहमदाबाद': [23.02, 72.57], 'भोपाल': [23.26, 77.41], 'काठमांडू': [27.72, 85.32], 'ढाका': [23.81, 90.41], 'कराची': [24.86, 67.0], 'लाहौर': [31.52, 74.36], 'लंदन': [51.51, -0.13],
  'पेरिस': [48.86, 2.35], 'न्यूयॉर्क': [40.71, -74.01], 'टोक्यो': [35.68, 139.69], 'बीजिंग': [39.9, 116.4], 'दुबई': [25.2, 55.27], 'मॉस्को': [55.76, 37.62], 'सिंगापुर': [1.35, 103.82],
};
export const cityNames = () => Object.keys(CITIES).filter((k) => /^[a-z]/.test(k));

// Regions as [west, south, east, north].
const REGIONS = {
  world: [-170, -58, 180, 80], asia: [25, -10, 150, 60], 'south asia': [60, 5, 98, 37], europe: [-25, 34, 45, 71], africa: [-20, -36, 53, 38],
  'north america': [-170, 7, -50, 75], 'south america': [-83, -56, -33, 13], americas: [-170, -56, -33, 75], 'middle east': [25, 12, 63, 42],
  oceania: [110, -48, 180, 0], 'east asia': [95, 18, 146, 54], 'southeast asia': [92, -11, 141, 24], 'central asia': [46, 35, 88, 56],
};
REGIONS['एशिया'] = REGIONS.asia; REGIONS['यूरोप'] = REGIONS.europe; REGIONS['अफ्रीका'] = REGIONS.africa; REGIONS['दुनिया'] = REGIONS.world; REGIONS['विश्व'] = REGIONS.world;

/**
 * A place as { lat, lon, name, kind }: { lat, lon } as given, a city from the table, or a country's
 * label point. Returns null for an unknown name.
 */
export function place(p) {
  if (p && typeof p === 'object' && Number.isFinite(+p.lat) && Number.isFinite(+p.lon)) return { lat: +p.lat, lon: +p.lon, name: p.label || p.name || p.place || '', kind: 'point' };
  const name = typeof p === 'string' ? p : p?.place || p?.name || p?.label;
  if (!name) return null;
  const c = CITIES[norm(name)] || CITIES[String(name).trim()];
  if (c) return { lat: c[0], lon: c[1], name, kind: 'city' };
  const k = country(name);
  if (k) return { lat: k.center[1], lon: k.center[0], name, kind: 'country', country: k.name };
  return null;
}
export const regionBox = (name) => REGIONS[norm(name)] || REGIONS[String(name || '').trim()] || null;

// ───────────────────────── projection and view ─────────────────────────

const RAD = Math.PI / 180;
const mx = (lon) => lon * RAD;
const my = (lat) => -Math.log(Math.tan(Math.PI / 4 + Math.max(-82, Math.min(84, lat)) * RAD / 2));

/**
 * Fits a view: a box in projected units around the boxes and points given, padded, at least `minSpan`
 * degrees wide, widened to `aspect` (width / height). Returns a projector to a W×H viewBox.
 */
export function fitView({ boxes = [], points = [], aspect = 16 / 9, pad = 0.28, minSpan = 9, W = 1000 } = {}) {
  let w = 180, s = 90, e = -180, n = -90;
  for (const b of boxes) { w = Math.min(w, b[0]); s = Math.min(s, b[1]); e = Math.max(e, b[2]); n = Math.max(n, b[3]); }
  for (const p of points) { w = Math.min(w, p.lon); e = Math.max(e, p.lon); s = Math.min(s, p.lat); n = Math.max(n, p.lat); }
  if (w > e) [w, s, e, n] = REGIONS.world;
  let x0 = mx(w), x1 = mx(e), y0 = my(n), y1 = my(s);
  const min = minSpan * RAD;
  if (x1 - x0 < min) { const c = (x0 + x1) / 2; x0 = c - min / 2; x1 = c + min / 2; }
  if (y1 - y0 < min * 0.6) { const c = (y0 + y1) / 2; y0 = c - min * 0.3; y1 = c + min * 0.3; }
  const pw = (x1 - x0) * pad, ph = (y1 - y0) * pad;
  x0 -= pw; x1 += pw; y0 -= ph; y1 += ph;
  // Widen to the frame's shape.
  const cw = x1 - x0, ch = y1 - y0;
  if (cw / ch < aspect) { const d = (ch * aspect - cw) / 2; x0 -= d; x1 += d; } else { const d = (cw / aspect - ch) / 2; y0 -= d; y1 += d; }
  // Not wider than the world.
  if (x1 - x0 > 2 * Math.PI) { const c = (x0 + x1) / 2, k = (2 * Math.PI) / (x1 - x0); x0 = c - Math.PI; x1 = c + Math.PI; const cy = (y0 + y1) / 2; y0 = cy - (cy - y0) * k; y1 = cy + (y1 - cy) * k; }
  const H = W / aspect, sc = W / (x1 - x0);
  const project = (lon, lat) => [(mx(lon) - x0) * sc, (my(lat) - y0) * sc];
  const viewBox = [mx(-180), my(84), mx(180), my(-82)];
  return { W, H: Math.round(H), project, degPerUnit: 1 / (sc * RAD), view: [x0, y0, x1, y1], worldBox: viewBox };
}

const r1 = (v) => Math.round(v * 10) / 10;
/** SVG path data for a country in a view, skipping shapes outside it. Antarctica is left out unless asked. */
export function countryPath(c, view) {
  const { project, W, H } = view;
  let d = '';
  for (const poly of c.polys) {
    for (const ring of poly) {
      let pts = ring.map(([lon, lat]) => project(lon, lat));
      let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
      for (const [x, y] of pts) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
      if (maxx < -20 || minx > W + 20 || maxy < -20 || miny > H + 20) continue;
      // Drop points closer than half a unit to the last one kept.
      const out = [];
      for (const [x, y] of pts) { const l = out.at(-1); if (!l || Math.abs(l[0] - x) + Math.abs(l[1] - y) > 0.6) out.push([r1(x), r1(y)]); }
      if (out.length < 3) continue;
      d += 'M' + out.map(([x, y]) => `${x} ${y}`).join('L') + 'Z';
    }
  }
  return d;
}

export function allCountries() { return [...world().values()]; }
