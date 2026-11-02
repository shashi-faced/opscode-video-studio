// Deterministic music synthesis shaped to the video timeline.
// Styles: indian-electronic, corporate-upbeat, ambient. All sounds are built from
// sine waves, noise and plucked-string physics (Karplus-Strong). Nothing sampled.
import { SR } from './wav.mjs';

function rngFrom(seed) {
  let a = seed >>> 0;
  const uni = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = () => { const u = Math.max(1e-9, uni()), v = uni(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return { uni, gauss };
}
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const TAU = Math.PI * 2;

export function synthMusic(timeline, { style = 'indian-electronic', seed = 7 } = {}) {
  const T = timeline.duration + 0.3;
  const N = Math.ceil(T * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  if (style === 'none') return [L, R];
  const rnd = rngFrom(seed);

  const add = (sig, t, g = 1, pan = 0) => {
    const i0 = Math.round(t * SR);
    if (i0 >= N) return;
    const gl = g * Math.sqrt((1 - pan) / 2), gr = g * Math.sqrt((1 + pan) / 2);
    const s = Math.max(0, -i0), e = Math.min(sig.length, N - i0);
    for (let j = s; j < e; j++) { L[i0 + j] += sig[j] * gl; R[i0 + j] += sig[j] * gr; }
  };
  const env = (n, a = 0.005, d = 0.3) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = Math.min(1, t / a) * Math.exp(-t / d); } return o; };
  const lp = (x, cut) => { const y = new Float32Array(x.length); let acc = 0; for (let i = 0; i < x.length; i++) { const c = typeof cut === 'function' ? cut(i) : cut; const a = Math.exp(-TAU * c / SR); acc = (1 - a) * x[i] + a * acc; y[i] = acc; } return y; };
  const noise = (n) => { const o = new Float32Array(n); for (let i = 0; i < n; i++) o[i] = rnd.gauss(); return o; };
  const mul = (a, b) => { for (let i = 0; i < a.length; i++) a[i] *= b[i]; return a; };
  const sweepSine = (n, f) => { const o = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { ph += TAU * f(i / SR) / SR; o[i] = Math.sin(ph); } return o; };

  // ---- instruments ----
  const kick = (() => { const n = Math.round(0.4 * SR); return mul(sweepSine(n, t => 45 + 95 * Math.exp(-t * 30)), env(n, 0.001, 0.17)); })();
  const na = (() => { const n = Math.round(0.4 * SR), o = new Float32Array(n), e1 = env(n, 0.001, 0.09), e2 = env(n, 0.0003, 0.004);
    for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(TAU * 660 * t) + 0.5 * Math.sin(TAU * 1340 * t) + 0.3 * Math.sin(TAU * 2010 * t)) * e1[i] * 0.6 + rnd.gauss() * e2[i] * 0.4; } return o; })();
  const bayan = (depth = 40) => { const n = Math.round(0.45 * SR); return mul(sweepSine(n, t => 82 + depth * (1 - Math.exp(-t * 7))), env(n, 0.002, 0.22)); };
  const BAY = bayan(40), GE = bayan(55);
  const DHA = (() => { const o = BAY.slice(); for (let i = 0; i < na.length; i++) o[i] += 0.5 * na[i]; return o; })();
  const tin = (() => { const n = Math.round(0.2 * SR), o = new Float32Array(n), e = env(n, 0.001, 0.04); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = (Math.sin(TAU * 1050 * t) + 0.4 * Math.sin(TAU * 2300 * t)) * e[i]; } return o; })();
  const hiss = (n, hp) => { const x = noise(n), l = lp(x, hp); for (let i = 0; i < n; i++) x[i] -= l[i]; return x; };
  const shaker = mul(hiss(Math.round(0.08 * SR), 5000), env(Math.round(0.08 * SR), 0.01, 0.025));
  const hat = mul(hiss(Math.round(0.06 * SR), 7000), env(Math.round(0.06 * SR), 0.001, 0.018));
  const clap = (() => { const n = Math.round(0.25 * SR), x = hiss(n, 900), o = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; let e = 0; for (const d of [0, 0.012, 0.024]) if (t >= d) e += Math.exp(-(t - d) / 0.01); e += 0.6 * Math.exp(-t / 0.08); o[i] = x[i] * e * Math.min(1, t / 0.001); } return o; })();
  const whoosh = (() => { const dur = 0.9, n = Math.round(dur * SR), x = noise(n);
    const y = lp(x, i => 400 + 5000 * Math.sin(Math.PI * i / n) ** 2); for (let i = 0; i < n; i++) y[i] *= Math.sin(Math.PI * i / n) ** 2; return y; })();
  const tanpuraCache = new Map();
  const tanpura = (m, dur = 4.2) => {
    const key = m; if (tanpuraCache.has(key)) return tanpuraCache.get(key);
    const f = hz(m), n = Math.round(dur * SR), o = new Float32Array(n), e = env(n, 0.08, dur * 0.45);
    for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; for (let k = 1; k <= 11; k++) s += Math.sin(TAU * f * k * t) * Math.pow(k, -0.9) * (0.5 + 0.5 * Math.sin(TAU * (0.15 + 0.07 * k) * t + k)); o[i] = s * e[i]; }
    tanpuraCache.set(key, o); return o;
  };
  const pluckCache = new Map();
  const pluck = (m, dur = 0.9, bend = 0, buzz = true, decay = 0.996) => {
    const key = `${m}|${dur}|${bend}|${buzz}|${decay}`; if (pluckCache.has(key)) return pluckCache.get(key);
    const f = hz(m), n = Math.round(dur * SR), p = Math.max(2, Math.round(SR / f));
    const buf = new Float32Array(p); for (let i = 0; i < p; i++) buf[i] = rnd.uni() * 2 - 1;
    let out = new Float32Array(n);
    for (let i = 0; i < n; i++) { const j = i % p; out[i] = buf[j]; buf[j] = decay * 0.5 * (buf[j] + buf[(j + 1) % p]); }
    if (bend) { const src = out; out = new Float32Array(n); let idx = 0; for (let i = 0; i < n; i++) { const r = Math.pow(2, bend / 12 * Math.min(1, (i / SR) / 0.12)); const i0 = Math.floor(idx), fr = idx - i0; out[i] = i0 + 1 < n ? src[i0] * (1 - fr) + src[i0 + 1] * fr : 0; idx += r; } }
    const e = env(n, 0.002, 0.7), e2 = env(n, 0.002, 0.4);
    for (let i = 0; i < n; i++) { let v = buzz ? Math.tanh(out[i] * 2.5) : out[i]; v += (buzz ? 0.3 : 0.12) * Math.sin(TAU * f * (buzz ? 3 : 2) * i / SR) * e2[i]; out[i] = v * e[i]; }
    pluckCache.set(key, out); return out;
  };
  const bassNote = (m) => { const n = Math.round(0.5 * SR), o = new Float32Array(n), e = env(n, 0.005, 0.25), f = hz(m); for (let i = 0; i < n; i++) o[i] = Math.tanh(2 * Math.sin(TAU * f * i / SR)) * e[i]; return o; };
  const pad = (notes, dur) => { const n = Math.round(dur * SR), o = new Float32Array(n);
    for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; for (const m of notes) s += Math.sin(TAU * hz(m) * t) + 0.3 * Math.sin(TAU * hz(m) * 2.003 * t); o[i] = s * Math.min(1, t / 0.3, (dur - t) / 0.3); } return o; };

  // ---- structure from the timeline ----
  const cuts = timeline.scenes.slice(1).map(s => s.start);
  const last = timeline.scenes.at(-1);
  const FIN = timeline.scenes.length > 1 ? last.start : T; // finale on the last (CTA) scene
  const cfg = {
    'indian-electronic': { bpm: 100, prog: [[38, [50, 54, 57]], [36, [48, 52, 55]], [43, [50, 55, 59]], [45, [49, 52, 57]]] },
    'corporate-upbeat': { bpm: 112, prog: [[36, [60, 64, 67]], [43, [59, 62, 67]], [45, [60, 64, 69]], [41, [60, 65, 69]]] },
    ambient: { bpm: 80, prog: [[38, [62, 66, 69, 73]], [35, [62, 66, 69, 71]], [43, [62, 67, 71, 74]], [45, [61, 64, 69, 73]]] },
  }[style] || null;
  if (!cfg) return [L, R];
  const B = 60 / cfg.bpm, BAR = 4 * B;
  const FULL = Math.min(cuts[0] ?? 2 * BAR, 2 * BAR); // full groove from first cut or 2 bars

  const bars = [];
  for (let b0 = 0; b0 < FIN - 0.05; b0 += BAR) bars.push(b0);

  if (style === 'indian-electronic') {
    for (let t0 = 0; t0 < T - 1; t0 += BAR) [[45, -0.4], [50, 0.3], [50, 0.1], [38, -0.1]].forEach(([m, p], j) => add(tanpura(m), t0 + j * B, 0.024, p));
    const pat = ['dha', 'ge', 'na', 'tin', 'na', 'ka', 'dhi', 'na'];
    for (const b0 of bars) {
      const full = b0 >= FULL - 1e-6;
      if (full) {
        for (let s = 0; s < 4; s++) add(kick, b0 + s * B, 0.55);
        for (const s of [1, 3]) add(clap, b0 + s * B, 0.18, 0.1);
        for (let s = 0; s < 16; s++) add(shaker, b0 + s * B / 4, s % 2 ? 0.07 : 0.11, 0.6);
      }
      pat.forEach((st, k) => {
        const t0 = b0 + k * B / 2;
        if (st === 'dha' || st === 'dhi') add(DHA, t0, 0.42, -0.2);
        else if (st === 'ge') add(GE, t0, 0.38, -0.3);
        else if (st === 'tin') add(tin, t0, 0.24, 0.3);
        else if (st === 'ka') add(na, t0, 0.12, 0.3);
        else add(na, t0, 0.28, 0.25);
      });
    }
    const motif = [[62, 0, 0], [64, 1, 0], [66, 2, 0], [69, 3, 2], [66, 5, 0], [64, 6, 0], [62, 7, 0], [60, 8, 0], [62, 9, 0], [64, 10, 0], [67, 11, 0], [66, 12, -1], [64, 13, 0], [62, 14, 0]];
    const answer = [[69, 0, 0], [71, 1, 0], [69, 2, 0], [66, 3, 0], [67, 4, 2], [66, 6, 0], [64, 7, 0], [66, 8, 0], [64, 9, 0], [62, 10, 0], [64, 11, 2], [62, 13, 0]];
    let ph = 0;
    for (let p0 = FULL; p0 < FIN - 0.1; p0 += 2 * BAR, ph++) for (const [m, st, bd] of ph % 2 ? answer : motif) { const t = p0 + st * B / 2; if (t < FIN) add(pluck(m, 0.9, bd), t, 0.13, 0.25); }
  } else if (style === 'corporate-upbeat') {
    for (const b0 of bars) {
      const full = b0 >= FULL - 1e-6;
      if (full) { for (let s = 0; s < 4; s++) add(kick, b0 + s * B, 0.55); for (const s of [1, 3]) add(clap, b0 + s * B, 0.2, 0.1); }
      for (let s = 0; s < 8; s++) add(hat, b0 + s * B / 2, s % 2 ? 0.09 : 0.05, 0.5);
    }
    let bi = 0;
    for (let p0 = FULL; p0 < FIN - 0.1; p0 += BAR, bi++) {
      const [, ch] = cfg.prog[bi % 4];
      const arp = [ch[0], ch[1], ch[2], ch[1] + 12, ch[2], ch[1], ch[0] + 12, ch[2]];
      arp.forEach((m, k) => { const t = p0 + k * B / 2; if (t < FIN) add(pluck(m, 0.6, 0, false, 0.994), t, 0.16, k % 2 ? 0.3 : -0.3); });
    }
  } else if (style === 'ambient') {
    let bi = 0;
    for (let p0 = 0; p0 < FIN - 0.1; p0 += BAR, bi++) {
      const [, ch] = cfg.prog[bi % 4];
      [0, 1, 2, 3, 2, 1, 0, 2].forEach((ix, k) => { const t = p0 + k * B / 2; if (t < FIN) add(pluck(ch[ix % ch.length] + 12, 1.4, 0, false, 0.998), t, 0.1, k % 2 ? 0.4 : -0.4); });
    }
  }
  // bass + pad on every style
  bars.forEach((b0, bi) => {
    const [root, ch] = cfg.prog[bi % 4];
    if (b0 >= FULL - 1e-6 && style !== 'ambient') for (const dt of [0, 1.5, 2, 3]) add(bassNote(root), b0 + dt * B, 0.2);
    add(pad(ch, BAR), b0, style === 'ambient' ? 0.05 : 0.03);
  });
  if (style !== 'ambient') {
    for (const c of cuts) add(whoosh, c - 0.45, 0.2);
    const n = Math.round(1.8 * SR), x = noise(n); const y = lp(x, i => 300 + 4000 * (i / n) ** 2); for (let i = 0; i < n; i++) y[i] *= (i / n) ** 2;
    add(y, FULL - 1.8, 0.28);
  }
  // finale: big chord, hit, flourish
  if (FIN < T) {
    const n = Math.round((T - FIN) * SR), o = new Float32Array(n);
    const chord = style === 'corporate-upbeat' ? [36, 48, 52, 55, 60, 64] : [38, 50, 54, 57, 62, 66];
    for (let i = 0; i < n; i++) { const t = i / SR; let s = 0; for (const m of chord) s += Math.sin(TAU * hz(m) * t) + 0.25 * Math.sin(TAU * hz(m) * 2 * t); o[i] = s * Math.min(1, t / 0.05) * Math.exp(-t / 3.2); }
    add(o, FIN, 0.07);
    if (style !== 'ambient') { add(kick, FIN, 0.8); add(BAY, FIN, 0.6); }
    const fl = style === 'corporate-upbeat' ? [60, 64, 67, 72] : [62, 66, 69, 74];
    fl.forEach((m, k) => add(pluck(m, 1.6, 0, style === 'indian-electronic'), FIN + 0.05 + k * 0.12, 0.15, 0.2));
    if (style === 'indian-electronic') for (let t0 = FIN + 4 * B; t0 < T - 1.5; t0 += 2 * B) add(BAY, t0, 0.13);
  }
  // fade out + normalise
  const fl = Math.min(N, Math.round(2 * SR));
  for (let i = 0; i < fl; i++) { const g = i / fl; L[N - 1 - i] *= g; R[N - 1 - i] *= g; }
  let m = 0; for (let i = 0; i < N; i++) m = Math.max(m, Math.abs(L[i]), Math.abs(R[i]));
  if (m > 0) for (let i = 0; i < N; i++) { L[i] /= m; R[i] /= m; }
  return [L, R];
}
