// Documentary and data templates (plan 18 M4): charts (bar, line, pie, bar race), a timeline, a map
// with highlighted countries, pins and routes, and a generic newsroom layout.
// Reveals follow the voice: an item appears when the narration names it, else they are spread over
// the speech. Numbers count up (runtime.js reads data-cu="t:value|t:value", in seconds from scene start).
import { escapeHtml as esc, markup } from '../timeline.mjs';
import { iconSvg } from '../art/props.mjs';
import { country, place, regionBox, fitView, countryPath, allCountries } from '../art/maps.mjs';

const fit = (tag, cls, html, max, lines, lh = 1.06, d = 0) =>
  `<${tag} class="fit ${cls}" data-max="${max}" data-lines="${lines}" data-lh="${lh}" style="--d:${d}s">${html}</${tag}>`;
// Font sizes (in u) per format: [16:9, 9:16, 1:1]
const SZ = { kicker: [2.3, 3, 2.7], head: [6, 7, 6.2], sub: [3, 3.8, 3.3], lab: [2.5, 3.2, 2.8], big: [8, 9, 8], ev: [3.6, 5, 3.6], year: [3.6, 4.4, 3.8], news: [5.2, 5.6, 5] };
const sz = (k, ctx) => SZ[k][ctx.fi];
const r2 = (n) => Math.round(n * 100) / 100;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const plain = (s) => String(s ?? '').replace(/<[^>]+>/g, '').replace(/\*/g, '');

/** Seconds from the scene start to the end of its voice (or a guess without one). */
function voiceEnd(ctx, fallback) {
  const tl = ctx.tl;
  if (!tl?.parts?.length) return fallback ?? Math.max(1.2, ctx.dur - 1);
  return Math.max(0.6, tl.parts.at(-1).end - tl.start);
}

const fold = (s) => plain(s).toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
/**
 * Reveal times for a list of labels: when the narration names an item, at that word (a little early);
 * the rest spread evenly between their neighbours. Always in order, between `from` and `to`.
 */
export function cueTimes(ctx, labels, from = 0.5, to = null) {
  const end = to ?? clamp(voiceEnd(ctx) - 0.2, from + 0.3, ctx.dur - 0.6);
  const w = (ctx.tl?.words || []).map(([html, a]) => [fold(html), a - ctx.tl.start]);
  const n = labels.length, at = new Array(n).fill(null);
  let k0 = 0;
  for (let j = 0; j < n; j++) {
    const key = fold(labels[j]).split(' ').filter((x) => x.length >= 3 || /^\d+$/.test(x))[0];
    if (!key) continue;
    for (let k = k0; k < w.length; k++) {
      if (w[k][0].startsWith(key) || (key.length >= 5 && w[k][0].startsWith(key.slice(0, key.length - 1)))) { at[j] = clamp(w[k][1] - 0.15, from, ctx.dur - 0.4); k0 = k + 1; break; }
    }
  }
  // Fill the gaps evenly; drop cues that would go backwards.
  let last = from - 0.001;
  for (let j = 0; j < n; j++) { if (at[j] != null && at[j] < last) at[j] = null; if (at[j] != null) last = at[j]; }
  for (let j = 0; j < n; j++) {
    if (at[j] != null) continue;
    let a = j - 1; while (a >= 0 && at[a] == null) a--;
    let b = j + 1; while (b < n && at[b] == null) b++;
    const ta = a >= 0 ? at[a] : from;
    if (b < n) at[j] = ta + (at[b] - ta) * (j - a) / (b - a); // between two cues (or from the start to a cue)
    else if (a >= 0) at[j] = ta + (end - ta) * (j - a) / (n - 1 - a); // after the last cue, up to the end
    else at[j] = from + (end - from) * j / Math.max(1, n - 1); // no cues at all
  }
  return at.map(r2);
}

// ───────────────────────── numbers ─────────────────────────

const DEVANAGARI = /[ऀ-ॿ]/;
function numFmt(sc) {
  const unit = String(sc.prefix || '') + String(sc.suffix || sc.unit || '');
  const indian = /₹|rs\.?|inr|lakh|crore/i.test(unit) || DEVANAGARI.test(`${sc.headline || ''}${sc.title || ''}`);
  return { loc: indian ? 'en-IN' : 'en-US', pre: sc.prefix || '', suf: sc.suffix ?? (sc.unit ? ` ${sc.unit}` : '') };
}
const decimals = (vals) => Math.min(2, Math.max(0, ...vals.map((v) => (String(v).split('.')[1] || '').length)));
function fmt(v, dec, loc, grp = true) {
  return Number(v).toLocaleString(loc, { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: grp });
}
/** A number that counts between stops [[t, value], …] (seconds from scene start). */
function counter(stops, { dec = 0, loc = 'en-US', pre = '', suf = '', grp = true, cls = '' } = {}) {
  const last = stops.at(-1)[1];
  return `<span class="cu ${cls}" data-cu="${stops.map(([t, v]) => `${r2(t)}:${v}`).join('|')}" data-dec="${dec}" data-loc="${loc}"${grp ? '' : ' data-grp="0"'}>${esc(pre)}<b>${fmt(last, dec, loc, grp)}</b>${esc(suf)}</span>`;
}
/** Short axis labels: 1.2K, 3.4M, 2B (or lakh/crore for Indian numbers). */
function short(v, loc, big = false) {
  const a = Math.abs(v);
  if (loc === 'en-IN') {
    if (a >= 1e7) return `${+(v / 1e7).toFixed(1)} Cr`;
    if (a >= 1e5) return `${+(v / 1e5).toFixed(1)} L`;
  }
  if (a >= 1e9) return `${+(v / 1e9).toFixed(1)}B`;
  if (a >= 1e6) return `${+(v / 1e6).toFixed(1)}M`;
  if (a >= 1e4 || (big && a >= 1e3)) return `${+(v / 1e3).toFixed(a >= 1e4 ? 0 : 1)}K`;
  return String(+v.toFixed(2));
}
function niceMax(v) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v)), m = v / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c || '') ? c.toLowerCase() : /^#[0-9a-f]{3}$/i.test(c || '') ? '#' + c.slice(1).split('').map((x) => x + x).join('').toLowerCase() : null);
function mix(a, b, f) {
  const p = (h, i) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map((i) => Math.round(p(a, i) * f + p(b, i) * (1 - f)).toString(16).padStart(2, '0')).join('');
}
/** Series colours from the theme: its own colours first (no repeats), then blends of them. */
export function palette(theme = {}) {
  const base = [theme.accent, theme.accent2, theme.ok, theme.alert].map(hex).filter(Boolean);
  const out = [];
  const far = (c) => out.every((o) => [0, 1, 2].reduce((d, i) => d + Math.abs(parseInt(o.slice(1 + i * 2, 3 + i * 2), 16) - parseInt(c.slice(1 + i * 2, 3 + i * 2), 16)), 0) > 110);
  for (const c of base) if (far(c)) out.push(c);
  const ink = hex(theme.ink) || '#222222', bg = hex(theme.bg) || '#ffffff';
  for (const c of [...base.slice(0, 2).map((c) => mix(c, ink, 0.6)), ...base.slice(0, 2).map((c) => mix(c, bg, 0.55)), mix(ink, bg, 0.45), ...base.slice(0, 2).map((c) => mix(c, ink, 0.35))]) if (out.length < 8 && far(c)) out.push(c);
  while (out.length < 8) out.push(mix(ink, bg, 0.25 + out.length * 0.07));
  return out;
}
const isHi = (sc, item, j) => sc.highlight != null && (String(sc.highlight).toLowerCase() === String(item.label).toLowerCase() || +sc.highlight === j + 1);

function head(sc, ctx) {
  return `<div class="dt-head">${sc.kicker ? fit('div', 'kicker a-up', esc(sc.kicker), sz('kicker', ctx), 1, 1.2, 0.05) : ''}${sc.headline ? fit('h1', 'headline a-up', markup(sc.headline), sz('head', ctx), 2, 1.06, 0.15) : ''}</div>`;
}
const foot = (sc, ctx) => (sc.source ? `<div class="dt-src a-up" style="--d:.9s">${esc(sc.source)}</div>` : '');

// ───────────────────────── charts ─────────────────────────

export const CHART_KINDS = ['bar', 'line', 'pie', 'race'];

function chart(sc, ctx) {
  const kind = CHART_KINDS.includes(sc.kind) ? sc.kind : 'bar';
  const body = { bar: barChart, line: lineChart, pie: pieChart, race: raceChart }[kind](sc, ctx);
  return `<div class="in t-chart dt ch-${kind} no-scale">${head(sc, ctx)}<div class="dt-body">${body}</div>${foot(sc, ctx)}</div>`;
}

function barChart(sc, ctx) {
  const data = (sc.data || []).slice(0, 10);
  const max = Math.max(...data.map((d) => +d.value || 0), 0) || 1;
  const nf = numFmt(sc), dec = decimals(data.map((d) => d.value));
  const times = cueTimes(ctx, data.map((d) => d.label), 0.6);
  const hi = sc.highlight != null;
  const rows = data.map((d, j) => {
    const t = times[j], v = +d.value || 0;
    const col = d.color || (hi ? (isHi(sc, d, j) ? 'var(--accent)' : 'color-mix(in srgb,var(--ink) 28%,var(--bg))') : 'var(--accent)');
    return `<div class="cb-row${hi && isHi(sc, d, j) ? ' hot' : ''}" style="--d:${t}s">
<div class="cb-lab">${esc(plain(d.label))}</div><div class="cb-track"><i style="--w:${r2((v / max) * 100)}%;background:${col}"></i>${counter([[t, 0], [t + 0.9, v]], { dec, ...nf, cls: 'cb-val' })}</div></div>`;
  }).join('');
  return `<div class="cb" style="--n:${data.length}">${rows}</div>`;
}

const PLOT = [[1000, 330], [1000, 860], [1000, 740]];
function lineChart(sc, ctx) {
  const data = (sc.data || []).slice(0, 24);
  const [W, H] = PLOT[ctx.fi];
  const nf = numFmt(sc), dec = decimals(data.map((d) => d.value));
  const vals = data.map((d) => +d.value || 0);
  const lo = Math.min(0, ...vals), hiV = niceMax(Math.max(...vals, 0));
  const L = 92, R = 40, T = 24, B = ctx.fi === 0 ? 50 : 66;
  const x = (j) => L + (data.length < 2 ? 0.5 : j / (data.length - 1)) * (W - L - R);
  const y = (v) => T + (1 - (v - lo) / (hiV - lo || 1)) * (H - T - B);
  const pts = data.map((d, j) => [r2(x(j)), r2(y(vals[j]))]);
  // Draw window: from 0.6 s to the end of the voice; each point is reached in proportion to path length.
  const t0 = 0.6, t1 = clamp(voiceEnd(ctx) - 0.2, t0 + 1.2, ctx.dur - 0.5);
  const seg = pts.slice(1).map((p, j) => Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1]));
  const total = seg.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  const at = [t0, ...seg.map((s) => { acc += s; return t0 + (t1 - t0) * acc / total; })];
  const d = 'M' + pts.map((p) => p.join(' ')).join('L');
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const v = lo + (hiV - lo) * f, yy = r2(y(v));
    return `<line x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="ln-y" x="${L - 14}" y="${yy + 9}">${esc(nf.pre)}${short(v, nf.loc, hiV >= 1e4)}</text>`;
  }).join('');
  const every = Math.ceil(data.length / (ctx.fi === 1 ? 5 : 8));
  const xl = data.map((p, j) => (j % every === 0 || j === data.length - 1 ? `<text class="ln-x" x="${pts[j][0]}" y="${H - (ctx.fi === 0 ? 14 : 22)}">${esc(plain(p.label))}</text>` : '')).join('');
  const dots = pts.map((p, j) => `<circle class="ln-dot${j === pts.length - 1 ? ' last' : ''}" cx="${p[0]}" cy="${p[1]}" r="${j === pts.length - 1 ? 11 : 7}" style="--d:${r2(at[j])}s"/>`).join('');
  const area = `M${pts[0][0]} ${r2(y(lo))}L${pts.map((p) => p.join(' ')).join('L')}L${pts.at(-1)[0]} ${r2(y(lo))}Z`;
  const big = counter(data.map((p, j) => [at[j], vals[j]]), { dec, ...nf, cls: 'ln-big' });
  return `<div class="ln"><div class="ln-now a-up" style="--d:.4s"><small>${esc(plain(data.at(-1)?.label ?? ''))}</small>${big}</div>
<svg class="ln-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet"><defs><linearGradient id="lg${ctx.index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".35"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
<g class="ln-grid">${grid}</g>${xl}<path class="ln-area" d="${area}" fill="url(#lg${ctx.index})" style="--d:${r2(t1 - 0.2)}s"/>
<path class="ln-line" d="${d}" pathLength="1" style="--d:${t0}s;--dd:${r2(t1 - t0)}s"/>${dots}</svg></div>`;
}

function pieChart(sc, ctx) {
  const data = (sc.data || []).slice(0, 8);
  const sum = data.reduce((a, d) => a + (+d.value || 0), 0) || 1;
  const times = cueTimes(ctx, data.map((d) => d.label), 0.6);
  const pal = palette(ctx.theme);
  let off = 0;
  const segs = data.map((d, j) => {
    const p = r2(((+d.value || 0) / sum) * 100);
    const col = d.color || pal[j % pal.length];
    const s = `<circle class="pc-seg" r="15.9155" cx="21" cy="21" pathLength="100" style="--p:${p};--off:${r2(-off)};--d:${times[j]}s;stroke:${col}"/>`;
    off += p;
    return { s, p, col };
  });
  const hiIdx = data.findIndex((d, j) => isHi(sc, d, j));
  const focus = hiIdx >= 0 ? hiIdx : segs.reduce((b, s, j) => (s.p > segs[b].p ? j : b), 0);
  const legend = data.map((d, j) => `<li class="a-up${j === focus ? ' hot' : ''}" style="--d:${times[j]}s"><i style="background:${segs[j].col}"></i><span>${esc(plain(d.label))}</span>${counter([[times[j], 0], [times[j] + 0.8, segs[j].p]], { dec: segs[j].p % 1 ? 1 : 0, suf: '%', cls: 'pc-pct' })}</li>`).join('');
  return `<div class="pc"><div class="pc-ring"><svg viewBox="0 0 42 42"><circle class="pc-bg" r="15.9155" cx="21" cy="21"/>${segs.map((s) => s.s).join('')}</svg>
<div class="pc-mid">${counter([[times[focus], 0], [times[focus] + 0.8, segs[focus].p]], { dec: 0, suf: '%', cls: 'pc-big' })}<small>${esc(plain(data[focus]?.label ?? ''))}</small></div></div><ol class="pc-leg">${legend}</ol></div>`;
}

/** Bar-chart race: bars grow and swap places step by step (years). */
function raceChart(sc, ctx) {
  const steps = (sc.steps || sc.years || []).map(String);
  const series = (sc.data || []).filter((d) => Array.isArray(d.values)).slice(0, 16);
  const n = Math.max(2, Math.min(steps.length, ...series.map((d) => d.values.length)));
  const top = clamp(Math.round(+sc.top || Math.min(8, series.length)), 2, Math.min(10, series.length || 2));
  const nf = numFmt(sc), dec = decimals(series.flatMap((d) => d.values));
  const t0 = 0.8, t1 = clamp(Math.max(voiceEnd(ctx), ctx.dur - 1.2), t0 + n * 0.6, ctx.dur - 0.5);
  const T = (k) => t0 + (t1 - t0) * k / (n - 1);
  const span = t1 - t0;
  const ranks = [], maxes = [];
  for (let k = 0; k < n; k++) {
    const order = series.map((d, j) => [j, +d.values[k] || 0]).sort((a, b) => b[1] - a[1]);
    const r = new Array(series.length); order.forEach(([j], i) => { r[j] = i; });
    ranks.push(r); maxes.push(order[0]?.[1] || 1);
  }
  const id = `rc${ctx.index}`, pal = palette(ctx.theme);
  const kf = [];
  const rows = series.map((d, j) => {
    const frames = [], widths = [];
    for (let k = 0; k < n; k++) {
      const pct = r2(((T(k) - t0) / span) * 100);
      const rk = Math.min(ranks[k][j], top);
      frames.push(`${pct}%{transform:translateY(${rk * 100}%);opacity:${ranks[k][j] < top ? 1 : 0}}`);
      widths.push(`${pct}%{width:${r2(Math.max(0.5, ((+d.values[k] || 0) / maxes[k]) * 100))}%}`);
    }
    kf.push(`@keyframes ${id}p${j}{${frames.join('')}}@keyframes ${id}w${j}{${widths.join('')}}`);
    const col = d.color || pal[j % pal.length];
    const stops = Array.from({ length: n }, (_, k) => [T(k), +d.values[k] || 0]);
    return `<div class="rc-row" style="animation:${id}p${j} ${r2(span)}s ease-in-out ${t0}s both"><div class="rc-lab">${esc(plain(d.label))}</div><div class="rc-track"><div class="rc-bar" style="background:${col};animation:${id}w${j} ${r2(span)}s linear ${t0}s both"></div>${counter(stops, { dec, ...nf, cls: 'rc-val' })}</div></div>`;
  }).join('');
  const numeric = steps.slice(0, n).every((s) => /^\d{1,4}$/.test(s));
  const year = numeric
    ? counter(steps.slice(0, n).map((s, k) => [T(k), +s]), { grp: false, cls: 'rc-year' })
    : `<span class="rc-year rc-names">${steps.slice(0, n).map((s, k) => `<b style="--d:${r2(k ? T(k) - 0.3 : 0)}s;--e:${r2(k < n - 1 ? T(k + 1) - 0.3 : ctx.dur + 1)}s">${esc(s)}</b>`).join('')}</span>`;
  return `<style>${kf.join('')}</style><div class="rc" style="--top:${top}">${rows}<div class="rc-step">${year}</div></div>`;
}

// ───────────────────────── timeline ─────────────────────────

function timeline(sc, ctx) {
  const ev = (sc.events || []).slice(0, 7);
  const times = cueTimes(ctx, ev.map((e) => e.year ?? e.date ?? e.title), 0.6);
  const n = ev.length || 1;
  const items = ev.map((e, j) => {
    const ic = e.icon ? iconSvg(e.icon, { stroke: 'currentColor' }) : null;
    return `<li class="tl-ev${j % 2 ? ' alt' : ''}" style="--d:${times[j]}s;--k:${j}">
<i class="tl-dot"></i><div class="tl-card">${ic ? `<span class="tl-ic">${ic}</span>` : ''}<b class="tl-year">${esc(plain(e.year ?? e.date ?? ''))}</b>${fit('div', 'tl-title', markup(e.title || ''), sz('ev', ctx), 2, 1.15)}${e.text ? fit('div', 'tl-text', markup(e.text), sz('ev', ctx) * 0.78, 3, 1.25) : ''}</div></li>`;
  }).join('');
  const t0 = times[0] ?? 0.6, t1 = times.at(-1) ?? t0 + 1;
  return `<div class="in t-timeline dt no-scale">${head(sc, ctx)}<div class="dt-body"><ol class="tl n${n}" style="--n:${n}"><i class="tl-axis"></i><i class="tl-fill" style="--d:${t0}s;--dd:${r2(Math.max(0.4, t1 - t0))}s"></i>${items}</ol></div>${foot(sc, ctx)}</div>`;
}

// ───────────────────────── map ─────────────────────────

// Room left for the headline at the top and for captions at the bottom, as a share of the frame height.
const MAP_BANDS = [[0.2, 0.12], [0.2, 0.26], [0.2, 0.16]];
const MAP_W = [[1000, 562], [1000, 1778], [1000, 1000]];

function mapScene(sc, ctx) {
  const hiNames = [].concat(sc.highlight || sc.countries || []).filter(Boolean);
  const hi = hiNames.map((nm) => ({ nm, c: country(nm) })).filter((x) => x.c);
  const pins = [].concat(sc.pins || []).map((p) => ({ p, at: place(p) })).filter((x) => x.at);
  const route = [].concat(sc.route || []).map(place).filter(Boolean);
  const boxes = hi.map((x) => x.c.box);
  if (sc.region) { const rb = regionBox(sc.region) || country(sc.region)?.box; if (rb) boxes.push(rb); }
  const [W, H] = MAP_W[ctx.fi];
  const [top, bottom] = MAP_BANDS[ctx.fi];
  const view = fitView({ boxes, points: [...pins.map((x) => x.at), ...route], aspect: W / (H * (1 - top - bottom)), W });
  // Extend the view up and down so the content sits between the headline and the captions.
  const inner = view.H, full = inner / (1 - top - bottom);
  const dy = full * top;
  const proj = (lon, lat) => { const [x, y] = view.project(lon, lat); return [x, y + dy]; };
  const v2 = { ...view, H: Math.round(full), project: proj };
  const hiSet = new Set(hi.map((x) => x.c.name));
  const land = allCountries().filter((c) => c.name !== 'Antarctica' || hiSet.has(c.name))
    .map((c) => countryPath(c, v2)).filter(Boolean).join('');
  const labelSz = [20, 34, 26][ctx.fi];
  // Timing: highlighted countries, then pins, then the route, each when the narration names it.
  const labels = [...hi.map((x) => x.nm), ...pins.map((x) => x.at.name || x.p.label || ''), ...route.map((r) => r.name)];
  const times = cueTimes(ctx, labels, 0.7);
  let k = 0;
  // Places with their own label (pins, route stops): a country name too close to one is left out.
  const named = [...pins.map((x) => proj(x.at.lon, x.at.lat)), ...route.filter((r) => r.kind !== 'country').map((r) => proj(r.lon, r.lat))];
  const hiSvg = hi.map((x, j) => {
    const t = times[k++];
    const [cx, cy] = proj(...x.c.center);
    const crowded = named.some(([px, py]) => Math.abs(px - cx) < labelSz * 3 && Math.abs(py - cy) < labelSz * 1.6);
    return `<path class="mp-hi" d="${countryPath(x.c, v2)}" style="--d:${t}s;--mc:${j % 2 ? 'var(--accent2)' : 'var(--accent)'}"/>` +
      (sc.labels === false || crowded ? '' : `<text class="mp-name" x="${r2(cx)}" y="${r2(cy)}" style="--d:${r2(t + 0.25)}s;font-size:${labelSz}px">${esc(plain(x.nm))}</text>`);
  }).join('');
  const pinSvg = pins.map((x) => {
    const t = times[k++];
    const [px, py] = proj(x.at.lon, x.at.lat);
    const label = plain(x.p.label || x.at.name || '');
    return `<g class="mp-pin" style="--d:${t}s" transform="translate(${r2(px)} ${r2(py)})"><circle class="mp-ping" r="${labelSz * 0.9}"/><circle r="${labelSz * 0.42}"/>${label ? `<text x="${labelSz * 0.8}" y="${labelSz * 0.36}" style="font-size:${labelSz}px">${esc(label)}</text>` : ''}</g>`;
  }).join('');
  const rt = route.map((r) => proj(r.lon, r.lat));
  const rtTimes = times.slice(k);
  const routeSvg = rt.slice(1).map((b, j) => {
    const a = rt[j];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    // Bow the line upwards a little, like a flight path.
    const nx = -(b[1] - a[1]) / (len || 1), ny = (b[0] - a[0]) / (len || 1), bow = len * 0.22 * (ny > 0 ? -1 : 1);
    const t = rtTimes[j] ?? 1, t2 = rtTimes[j + 1] ?? t + 1.2;
    return `<path class="mp-route" d="M${r2(a[0])} ${r2(a[1])}Q${r2(mx + nx * bow)} ${r2(my + ny * bow)} ${r2(b[0])} ${r2(b[1])}" pathLength="1" style="--d:${r2(t)}s;--dd:${r2(clamp(t2 - t, 0.6, 2.2))}s"/>`;
  }).join('') + rt.map(([x, y], j) => `<circle class="mp-stop" cx="${r2(x)}" cy="${r2(y)}" r="${labelSz * 0.32}" style="--d:${r2(rtTimes[j] ?? 1)}s"/>`).join('') +
    route.map((r, j) => (r.kind === 'city' || r.kind === 'point' ? `<text class="mp-name small" x="${r2(rt[j][0] + labelSz * 0.6)}" y="${r2(rt[j][1] - labelSz * 0.5)}" style="--d:${r2(rtTimes[j] ?? 1)}s;font-size:${labelSz * 0.8}px">${esc(plain(r.name))}</text>` : '')).join('');
  return `<div class="in t-map dt no-scale"><svg class="mp" viewBox="0 0 ${W} ${v2.H}" preserveAspectRatio="xMidYMid slice" style="--sd:${r2(ctx.dur)}s"><rect class="mp-sea" x="-50" y="-50" width="${W + 100}" height="${v2.H + 100}"/>
<g><path class="mp-land" d="${land}"/>${hiSvg}${routeSvg}${pinSvg}</g></svg>
<div class="mp-text">${head(sc, ctx)}${sc.subline ? fit('p', 'subline a-up', markup(sc.subline), sz('sub', ctx), 2, 1.3, 0.4) : ''}</div>${foot(sc, ctx)}</div>`;
}

// ───────────────────────── newsroom ─────────────────────────

/** A generic news layout: tag, headline bar, details and a ticker. No real channel's name or colours. */
function news(sc, ctx) {
  const img = sc.image ? ctx.asset(sc.image) : null;
  const ticker = [].concat(sc.ticker || []).map((t) => `<span>${esc(plain(t))}</span>`).join('<i>●</i>');
  const tag = sc.kicker || 'Breaking news';
  const meta = [sc.place, sc.date].filter(Boolean).map((x) => esc(plain(x))).join(' · ');
  return `<div class="in t-news no-scale">
<div class="nw-vis">${img ? `<img class="nw-img" src="${img.src}" alt="" style="--sd:${r2(ctx.dur)}s">` : `<div class="nw-bg"><i></i><i></i><i></i></div>`}</div>
<div class="nw-live a-pop" style="--d:.15s"><i></i>LIVE</div>
<div class="nw-lower">
<div class="nw-tag" style="--d:.25s">${esc(plain(tag))}</div>
<div class="nw-bar" style="--d:.4s">${fit('h1', 'nw-head', markup(sc.headline || ''), sz('news', ctx), 2, 1.08)}</div>
${sc.subline || meta ? `<div class="nw-sub a-up" style="--d:.9s">${meta ? `<b>${meta}</b>` : ''}${sc.subline ? fit('span', 'nw-subtext', markup(sc.subline), sz('sub', ctx), 2, 1.25) : ''}</div>` : ''}
</div>
${ticker ? `<div class="nw-ticker" style="--d:.6s"><b>LATEST</b><div class="nw-tk"><div class="nw-run" style="--sd:${r2(ctx.dur)}s">${ticker}<i>●</i>${ticker}</div></div></div>` : ''}</div>`;
}

export const DATA_HTML = { chart, timeline, map: mapScene, news };

// ───────────────────────── CSS ─────────────────────────

export const DATA_CSS = `
/* plan 18 M4: data and documentary templates */
#stage .in.dt{left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;padding:max(var(--st,0px),calc(var(--u)*6)) max(var(--sr,0px),calc(var(--u)*7)) max(calc(var(--u)*12),calc(var(--sb,0px) + var(--u)*9)) max(var(--sl,0px),calc(var(--u)*7));gap:calc(var(--u)*2.4)}
#stage.f-9x16 .in.dt{padding-bottom:max(calc(var(--u)*30),calc(var(--sb,0px) + var(--u)*15));padding-left:calc(var(--u)*5);padding-right:calc(var(--u)*5)}
.dt-head{display:flex;flex-direction:column;gap:calc(var(--u)*.8);flex:none}
.dt .headline{margin:0}
.dt-body{flex:1 1 auto;min-height:0;position:relative;display:flex;align-items:center;justify-content:center}
.dt-src{position:absolute;right:max(var(--sr,0px),calc(var(--u)*3));bottom:calc(var(--u)*2.2);font-size:calc(var(--u)*1.7);color:var(--muted);opacity:.85}
#stage.f-9x16 .dt-src{bottom:max(calc(var(--u)*26),calc(var(--sb,0px) + var(--u)*11))}
.cu b{font-weight:inherit}

/* bar */
.cb{width:100%;display:flex;flex-direction:column;justify-content:center;gap:calc(var(--u)*1.6);height:100%;max-height:calc(var(--u)*var(--n)*12)}
.cb-row{display:grid;grid-template-columns:minmax(0,24%) 1fr;align-items:center;gap:calc(var(--u)*2);flex:1 1 0;min-height:0;max-height:calc(var(--u)*11);opacity:0;animation:dt-in .45s ease var(--d) both}
#stage.f-9x16 .cb-row{grid-template-columns:1fr;gap:calc(var(--u)*.8);max-height:calc(var(--u)*15)}
#stage.f-9x16 .cb{max-height:calc(var(--u)*var(--n)*16)}
.cb-lab{font:600 calc(var(--u)*3.2) var(--body);color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:right}
#stage.f-9x16 .cb-lab{text-align:left;font-size:calc(var(--u)*4.2)}
.cb-track{position:relative;display:flex;align-items:center;gap:calc(var(--u)*1.4);height:100%;min-height:calc(var(--u)*3.6);max-height:calc(var(--u)*7.5)}
#stage.f-9x16 .cb-track{height:calc(var(--u)*7.5);max-height:none}
.cb-track>i{display:block;height:100%;width:calc(var(--w) * .8);border-radius:calc(var(--u)*.7);transform-origin:left;animation:cb-grow .9s cubic-bezier(.2,.8,.2,1) var(--d) both}
.cb-val{font:700 calc(var(--u)*3.6) var(--display);color:var(--ink);white-space:nowrap}
#stage.f-9x16 .cb-val{font-size:calc(var(--u)*4.6)}
.cb-row.hot .cb-lab,.cb-row.hot .cb-val{color:var(--accent)}
@keyframes cb-grow{from{transform:scaleX(0)}}
@keyframes dt-in{from{opacity:0;transform:translateY(calc(var(--u)*1.2))}to{opacity:1;transform:none}}

/* line */
.ln{width:100%;height:100%;display:flex;flex-direction:column;gap:calc(var(--u)*1)}
.ln-now{display:flex;align-items:baseline;gap:calc(var(--u)*1.6);flex:none}
.ln-now small{font:600 calc(var(--u)*2.4) var(--body);color:var(--muted);text-transform:uppercase;letter-spacing:.08em}
.ln-big{font:700 calc(var(--u)*7) var(--display);color:var(--accent);line-height:1}
#stage.f-9x16 .ln-big{font-size:calc(var(--u)*9)}
.ln-svg{flex:1 1 auto;min-height:0;width:100%;overflow:visible}
.ln-grid line{stroke:var(--ink);stroke-opacity:.12;stroke-width:2}
.ln-y,.ln-x{fill:var(--muted);font:600 22px var(--body)}
#stage.f-9x16 .ln-y,#stage.f-9x16 .ln-x{font-size:38px}
.ln-y{text-anchor:end}.ln-x{text-anchor:middle}
.ln-line{fill:none;stroke:var(--accent);stroke-width:7;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:ln-draw var(--dd) linear var(--d) forwards}
#stage.f-9x16 .ln-line{stroke-width:10}
.ln-area{opacity:0;animation:dt-fade .8s ease var(--d) forwards}
.ln-dot{fill:var(--bg);stroke:var(--accent);stroke-width:4;transform-box:fill-box;transform-origin:center;animation:dt-pop .35s cubic-bezier(.3,1.6,.5,1) var(--d) both}
.ln-dot.last{fill:var(--accent)}
@keyframes ln-draw{to{stroke-dashoffset:0}}
@keyframes dt-fade{to{opacity:1}}
@keyframes dt-pop{from{transform:scale(0)}}

/* pie */
.pc{display:flex;align-items:center;justify-content:center;gap:calc(var(--u)*5);width:100%;height:100%}
#stage.f-9x16 .pc{flex-direction:column;gap:calc(var(--u)*3)}
.pc-ring{position:relative;height:min(100%,calc(var(--u)*46));aspect-ratio:1;flex:none}
#stage.f-9x16 .pc-ring{height:auto;width:min(80%,calc(var(--u)*62))}
.pc-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
.pc-bg{fill:none;stroke:var(--ink);stroke-opacity:.08;stroke-width:6.5}
.pc-seg{fill:none;stroke-width:6.5;stroke-dasharray:0 100;stroke-dashoffset:var(--off);animation:pc-grow .9s cubic-bezier(.3,.8,.3,1) var(--d) forwards}
@keyframes pc-grow{to{stroke-dasharray:var(--p) calc(100 - var(--p))}}
.pc-mid{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
.pc-big{font:700 calc(var(--u)*8) var(--display);color:var(--ink);line-height:1}
.pc-mid small{font:600 calc(var(--u)*2.2) var(--body);color:var(--muted);max-width:60%}
.pc-leg{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*1.3);min-width:0}
#stage.f-9x16 .pc-leg{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*1.4) calc(var(--u)*3)}
.pc-leg li{display:flex;align-items:center;gap:calc(var(--u)*1.2);font:600 calc(var(--u)*3.2) var(--body);color:var(--ink);min-width:0}
#stage.f-9x16 .pc-leg li{font-size:calc(var(--u)*4.2)}
.pc-leg li i{width:calc(var(--u)*2.2);height:calc(var(--u)*2.2);border-radius:50%;flex:none}
.pc-leg li span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pc-pct{margin-left:auto;padding-left:calc(var(--u)*1.2);font-family:var(--display);font-weight:700}
.pc-leg li.hot{color:var(--accent)}

/* race */
.rc{position:relative;width:100%;height:100%}
.rc-row{position:absolute;left:0;right:0;top:0;height:calc(100% / var(--top));display:grid;grid-template-columns:minmax(0,22%) 1fr;align-items:center;gap:calc(var(--u)*1.6);padding:calc(var(--u)*.45) 0}
#stage.f-9x16 .rc-row{grid-template-columns:minmax(0,30%) 1fr}
.rc-lab{font:600 calc(var(--u)*2.8) var(--body);color:var(--ink);text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#stage.f-9x16 .rc-lab{font-size:calc(var(--u)*3.8)}
.rc-track{display:flex;align-items:center;gap:calc(var(--u)*1.2);height:100%;min-width:0}
.rc-bar{height:100%;max-width:78%;border-radius:calc(var(--u)*.6)}
.rc-val{font:700 calc(var(--u)*2.9) var(--display);color:var(--ink);white-space:nowrap}
#stage.f-9x16 .rc-val{font-size:calc(var(--u)*3.8)}
.rc-step{position:absolute;right:0;bottom:0;pointer-events:none}
.rc-year{display:block;font:700 calc(var(--u)*10) var(--display);color:var(--ink);opacity:.22;line-height:1;position:relative}
#stage.f-9x16 .rc-year{font-size:calc(var(--u)*13)}
span.rc-names b{position:absolute;right:0;bottom:0;white-space:nowrap;opacity:0;animation:dt-fade .25s ease var(--d) forwards,kt-out .2s ease var(--e) forwards}
@keyframes kt-out{to{opacity:0}}

/* timeline */
.tl{position:relative;list-style:none;margin:0;padding:0;width:100%;height:100%;display:grid;grid-template-columns:repeat(var(--n),minmax(0,1fr));align-items:center}
.tl-axis,.tl-fill{position:absolute;left:0;right:0;top:50%;height:calc(var(--u)*.6);margin-top:calc(var(--u)*-.3);background:var(--ink);opacity:.15;border-radius:9px}
.tl-fill{opacity:1;background:var(--accent);transform-origin:left;transform:scaleX(0);animation:tl-fill var(--dd) linear var(--d) forwards}
@keyframes tl-fill{from{transform:scaleX(calc(.5 / var(--n)))}to{transform:scaleX(calc(1 - .5 / var(--n)))}}
.tl-ev{position:relative;height:100%;display:flex;flex-direction:column;align-items:center}
.tl-ev .tl-card{position:absolute;left:4%;right:4%;bottom:calc(50% + var(--u)*3);display:flex;flex-direction:column;align-items:center;text-align:center;gap:calc(var(--u)*.6);opacity:0;animation:dt-in .5s ease var(--d) both}
.tl-ev.alt .tl-card{bottom:auto;top:calc(50% + var(--u)*3)}
.tl-dot{position:absolute;left:50%;top:50%;width:calc(var(--u)*2.6);height:calc(var(--u)*2.6);margin:calc(var(--u)*-1.3) 0 0 calc(var(--u)*-1.3);border-radius:50%;background:var(--bg);border:calc(var(--u)*.6) solid var(--accent);z-index:1;animation:dt-pop .4s cubic-bezier(.3,1.6,.5,1) var(--d) both}
.tl-year{font:700 calc(var(--u)*4.6) var(--display);color:var(--accent);line-height:1}
.tl-title{font-weight:700;color:var(--ink);width:100%}
.tl-text{color:var(--muted);width:100%}
.tl-ic{width:calc(var(--u)*6);height:calc(var(--u)*6);color:var(--ink)}
.tl-ic svg{width:100%;height:100%}
#stage.f-9x16 .tl{grid-template-columns:1fr;grid-template-rows:repeat(var(--n),minmax(0,1fr));align-items:stretch}
#stage.f-9x16 .tl-axis,#stage.f-9x16 .tl-fill{left:calc(var(--u)*3);right:auto;top:0;bottom:0;width:calc(var(--u)*.7);height:auto;margin:0 0 0 calc(var(--u)*-.35)}
#stage.f-9x16 .tl-fill{transform-origin:top;transform:scaleY(0);animation-name:tl-fill-v}
@keyframes tl-fill-v{from{transform:scaleY(calc(.5 / var(--n)))}to{transform:scaleY(calc(1 - .5 / var(--n)))}}
#stage.f-9x16 .tl-ev{flex-direction:row;align-items:center;justify-content:flex-start;padding-left:calc(var(--u)*8)}
#stage.f-9x16 .tl-dot{left:calc(var(--u)*3);top:50%}
#stage.f-9x16 .tl-ev .tl-card,#stage.f-9x16 .tl-ev.alt .tl-card{position:static;align-items:flex-start;text-align:left;flex-direction:column}
#stage.f-9x16 .tl-year{font-size:calc(var(--u)*5.6)}
#stage.f-9x16 .tl-ic{display:none}

/* map */
#stage .in.t-map{left:0;right:0;top:0;bottom:0}
.mp{position:absolute;inset:0;width:100%;height:100%;transform-origin:50% 55%;animation:mp-push var(--sd) linear both}
.mp-sea{fill:var(--bg2)}
@keyframes mp-push{from{transform:scale(1)}to{transform:scale(1.07)}}
.mp-land{fill:color-mix(in srgb,var(--ink) 16%,var(--bg2));stroke:var(--bg2);stroke-width:1.2;stroke-linejoin:round}
.mp-hi{fill:var(--mc);stroke:var(--bg2);stroke-width:1.2;opacity:0;animation:dt-fade .7s ease var(--d) forwards}
.mp-name{fill:var(--ink);font-family:var(--display);font-weight:700;text-anchor:middle;paint-order:stroke;stroke:var(--bg2);stroke-width:6px;stroke-linejoin:round;opacity:0;animation:dt-fade .5s ease var(--d) forwards}
.mp-name.small{text-anchor:start;font-family:var(--body)}
.mp-pin{animation:dt-fade .01s linear var(--d) both}
.mp-pin circle{fill:var(--alert);stroke:var(--bg);stroke-width:3}
.mp-pin .mp-ping{fill:var(--alert);stroke:none;opacity:0;transform-box:fill-box;transform-origin:center;animation:mp-ping 1.2s ease-out var(--d) 2}
@keyframes mp-ping{from{opacity:.55;transform:scale(.3)}to{opacity:0;transform:scale(1.6)}}
.mp-pin text{fill:var(--ink);font-family:var(--body);font-weight:700;paint-order:stroke;stroke:var(--bg2);stroke-width:6px;stroke-linejoin:round}
.mp-route{fill:none;stroke:var(--accent);stroke-width:5;stroke-linecap:round;stroke-dasharray:1;stroke-dashoffset:1;animation:ln-draw var(--dd) ease-in-out var(--d) forwards}
#stage.f-9x16 .mp-route{stroke-width:8}
.mp-stop{fill:var(--accent);stroke:var(--bg);stroke-width:3;transform-box:fill-box;transform-origin:center;animation:dt-pop .35s cubic-bezier(.3,1.6,.5,1) var(--d) both}
.mp-text{position:absolute;left:max(var(--sl,0px),calc(var(--u)*6));right:max(var(--sr,0px),calc(var(--u)*6));top:max(var(--st,0px),calc(var(--u)*5));display:flex;flex-direction:column;gap:calc(var(--u)*.8);padding:calc(var(--u)*2) calc(var(--u)*2.6);border-radius:calc(var(--u)*1.4);background:color-mix(in srgb,var(--bg) 82%,transparent);backdrop-filter:blur(6px);max-width:calc(var(--u)*90)}
#stage.f-9x16 .mp-text{max-width:none}
.t-map .dt-src{bottom:calc(var(--u)*2.2)}

/* newsroom */
#stage .in.t-news{left:0;right:0;top:0;bottom:0}
.nw-vis{position:absolute;inset:0;overflow:hidden}
.nw-img{width:100%;height:100%;object-fit:cover;animation:mp-push var(--sd) linear both}
.nw-bg{position:absolute;inset:0;background:radial-gradient(120% 90% at 70% 30%,color-mix(in srgb,var(--accent2) 45%,#0b1220),#070b14 70%)}
.nw-bg i{position:absolute;border-radius:50%;border:calc(var(--u)*.3) solid #ffffff14}
.nw-bg i:nth-child(1){width:70%;aspect-ratio:1;right:-15%;top:-25%}
.nw-bg i:nth-child(2){width:45%;aspect-ratio:1;right:0;top:-5%}
.nw-bg i:nth-child(3){width:110%;aspect-ratio:1;left:-60%;bottom:-70%}
.nw-vis::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,transparent 40%,#000a 100%)}
.nw-live{position:absolute;left:max(var(--sl,0px),calc(var(--u)*5));top:max(var(--st,0px),calc(var(--u)*4.5));display:flex;align-items:center;gap:calc(var(--u)*1);padding:calc(var(--u)*.7) calc(var(--u)*1.6);background:#d62828;color:#fff;font:700 calc(var(--u)*2.2) "Poppins",var(--body);letter-spacing:.12em;border-radius:calc(var(--u)*.5)}
.nw-live i{width:calc(var(--u)*1.2);height:calc(var(--u)*1.2);border-radius:50%;background:#fff;animation:nw-blink 1s steps(2) infinite}
@keyframes nw-blink{50%{opacity:.2}}
.nw-lower{position:absolute;left:max(var(--sl,0px),calc(var(--u)*5));right:max(var(--sr,0px),calc(var(--u)*5));bottom:calc(var(--u)*13);display:flex;flex-direction:column;align-items:flex-start}
#stage.f-9x16 .nw-lower{bottom:max(calc(var(--u)*44),calc(var(--sb,0px) + var(--u)*30))}
.nw-tag{background:#d62828;color:#fff;font:700 calc(var(--u)*2.4) "Poppins",var(--body);text-transform:uppercase;letter-spacing:.08em;padding:calc(var(--u)*.8) calc(var(--u)*2);clip-path:inset(0 100% 0 0);animation:nw-wipe .45s cubic-bezier(.3,.8,.3,1) var(--d) forwards}
.nw-bar{align-self:stretch;background:#ffffff;color:#101318;padding:calc(var(--u)*1.6) calc(var(--u)*2.4);clip-path:inset(0 100% 0 0);animation:nw-wipe .6s cubic-bezier(.3,.8,.3,1) var(--d) forwards}
.nw-head{margin:0;font-family:var(--display);font-weight:800;line-height:1.08;color:#101318}
.nw-head mark{background:none;color:#d62828}
.nw-sub{align-self:stretch;display:flex;flex-direction:column;gap:calc(var(--u)*.4);background:#101318e6;color:#fff;padding:calc(var(--u)*1.1) calc(var(--u)*2.4)}
.nw-sub b{font:700 calc(var(--u)*1.9) "Poppins",var(--body);letter-spacing:.08em;text-transform:uppercase;color:#ffd166}
.nw-subtext{color:#fff}
@keyframes nw-wipe{to{clip-path:inset(0 0 0 0)}}
.nw-ticker{position:absolute;left:0;right:0;bottom:calc(var(--u)*5);height:calc(var(--u)*5.4);display:flex;align-items:stretch;background:#101318;color:#fff;font:600 calc(var(--u)*2.4) var(--body);opacity:0;animation:dt-fade .3s ease var(--d) forwards}
#stage.f-9x16 .nw-ticker{bottom:max(calc(var(--u)*36),calc(var(--sb,0px) + var(--u)*22));height:calc(var(--u)*6.4);font-size:calc(var(--u)*3)}
.nw-ticker b{flex:none;display:flex;align-items:center;padding:0 calc(var(--u)*2);background:#ffd166;color:#101318;font-family:"Poppins",var(--body);letter-spacing:.08em}
.nw-tk{flex:1;overflow:hidden;display:flex;align-items:center}
.nw-run{display:flex;gap:calc(var(--u)*2.4);white-space:nowrap;padding-left:calc(var(--u)*3);animation:nw-run var(--sd) linear both}
.nw-run i{font-style:normal;color:#ffd166;font-size:.6em;align-self:center}
@keyframes nw-run{from{transform:translateX(10%)}to{transform:translateX(-55%)}}
`;
