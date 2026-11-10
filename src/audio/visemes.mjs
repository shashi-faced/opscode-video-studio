// Lip-sync: text + word timings -> a track of cartoon mouth shapes.
//
// Edge TTS gives word start/end times but no phonemes, so each word is split into sounds by simple
// letter rules (English) or Devanagari rules (Hindi), and each sound maps to one of 9 mouth shapes
// (the classic Preston Blair / Rhubarb set):
//   X rest · A closed (M B P) · B teeth, slightly open (most consonants) · C wide (E, I)
//   D open (A) · E round (O) · F small round (U, W, OO) · G lower lip under teeth (F, V) · H tongue up (L)
// The result is deterministic and needs no audio analysis.

const VOWEL = new Set(['C', 'D', 'E', 'F']);
const W = { A: 1.15, B: 0.8, C: 1.6, D: 1.8, E: 1.7, F: 1.4, G: 1, H: 0.9 };

// ---------- English (and Hinglish written in Latin letters) ----------
const EN_MULTI = [
  ['tch', ['B']], ['dge', ['B']], ['igh', ['D', 'C']], ['ough', ['E']], ['augh', ['E']],
  ['th', ['B']], ['sh', ['B']], ['ch', ['B']], ['ph', ['G']], ['wh', ['F']], ['ck', ['B']], ['ng', ['B']], ['qu', ['B', 'F']],
  ['oo', ['F']], ['ee', ['C']], ['ea', ['C']], ['ie', ['C']], ['ai', ['C']], ['ay', ['D', 'C']], ['ei', ['C']], ['ey', ['C']],
  ['ou', ['D', 'F']], ['ow', ['D', 'F']], ['oi', ['E', 'C']], ['oy', ['E', 'C']], ['au', ['E']], ['aw', ['E']], ['oa', ['E']],
  ['er', ['B']], ['ir', ['B']], ['ur', ['B']], ['aa', ['D']], ['ii', ['C']], ['uu', ['F']],
];
const EN_ONE = {
  a: 'D', e: 'C', i: 'C', o: 'E', u: 'F', y: 'C',
  b: 'A', m: 'A', p: 'A', f: 'G', v: 'G', w: 'F', l: 'H',
};

export function englishShapes(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return [];
  // Silent final e ("make", "home"), but not in short words ("he", "the").
  if (w.length > 3 && w.endsWith('e') && !/[aeiouy]e$/.test(w)) w = w.slice(0, -1);
  const out = [];
  let i = 0;
  while (i < w.length) {
    const m = EN_MULTI.find(([g]) => w.startsWith(g, i));
    if (m) { out.push(...m[1]); i += m[0].length; continue; }
    const c = w[i];
    if (c === w[i - 1] && !'aeiou'.includes(c)) { i++; continue; }   // double consonant: one sound
    out.push(EN_ONE[c] || 'B');
    i++;
  }
  return out;
}

// ---------- Hindi (Devanagari) ----------
const HI_CONS = {};
for (const c of 'पफबभम') HI_CONS[c] = 'A';
for (const c of 'व') HI_CONS[c] = 'G';
for (const c of 'ल') HI_CONS[c] = 'H';
for (const c of 'य') HI_CONS[c] = 'C';
for (const c of 'कखगघङचछजझञटठडढणतथदधनशषसहर') HI_CONS[c] = 'B';
const HI_VOWEL = { 'अ': 'D', 'आ': 'D', 'इ': 'C', 'ई': 'C', 'उ': 'F', 'ऊ': 'F', 'ए': 'C', 'ऐ': 'C', 'ओ': 'E', 'औ': 'E', 'ऋ': 'B', 'ऑ': 'E' };
const HI_MATRA = { 'ा': 'D', 'ि': 'C', 'ी': 'C', 'ु': 'F', 'ू': 'F', 'े': 'C', 'ै': 'C', 'ो': 'E', 'ौ': 'E', 'ृ': 'B', 'ॉ': 'E', 'ॅ': 'C' };
const VIRAMA = '्', NUKTA = '़';

export function hindiShapes(word) {
  const chars = [...word.normalize('NFC')].filter(c => /[ऀ-ॿ]/.test(c));
  const out = [];
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (HI_VOWEL[c]) { out.push(HI_VOWEL[c]); continue; }
    if (HI_MATRA[c]) { out.push(HI_MATRA[c]); continue; }
    if (c === 'ं' || c === 'ँ') { out.push('B'); continue; }
    if (HI_CONS[c] !== undefined) {
      let shape = HI_CONS[c];
      let j = i + 1;
      if (chars[j] === NUKTA) { if (c === 'फ') shape = 'G'; j++; }
      out.push(shape);
      const next = chars[j];
      // Inherent vowel "a" after a consonant, unless a vowel sign or virama follows; dropped at the
      // end of a word (schwa deletion: "kamal" not "kamala").
      if (next === VIRAMA) { i = j; continue; }
      if (next && HI_MATRA[next]) { i = j - 1; continue; }
      if (j < chars.length) out.push('D');
      i = j - 1;
    }
  }
  return out;
}

export function wordShapes(word) {
  return /[ऀ-ॿ]/.test(word) ? hindiShapes(word) : englishShapes(word);
}

/**
 * Mouth track for one spoken line.
 * @param tokens [{ text }] the words as written
 * @param times  [[start, end]] seconds (absolute) for each token
 * @param end    end of the line (seconds); the mouth rests after it
 * @param quiet  [[start, end]] absolute seconds where the voice audio is quiet: the mouth closes there
 *               (fluent speech, e.g. Hindi, has few pauses between words, so word times alone keep it open)
 * @returns [[t, shape], ...] sorted, each shape held until the next entry
 */
export function visemeTrack(tokens, times, end, quiet = []) {
  const segs = [];
  tokens.forEach((tok, k) => {
    const [s, e] = times[k];
    const shapes = wordShapes(tok.text);
    if (!shapes.length || e <= s) return;
    const total = shapes.reduce((n, x) => n + (W[x] || 1), 0);
    let t = s;
    for (const x of shapes) { segs.push([t, x]); t += ((e - s) * (W[x] || 1)) / total; }
    // A short pause between words closes the mouth for a moment.
    const next = times[k + 1];
    if (!next || next[0] - e > 0.12) segs.push([e, 'X']);
  });
  if (!segs.length || segs.at(-1)[1] !== 'X') segs.push([end, 'X']);
  // Merge repeats and drop shapes shorter than ~1.5 frames (they only flicker).
  const out = [];
  for (let i = 0; i < segs.length; i++) {
    const [t, x] = segs[i];
    const dur = (segs[i + 1] ? segs[i + 1][0] : end) - t;
    if (out.length && out.at(-1)[1] === x) continue;
    if (dur < 0.05 && x !== 'X' && i + 1 < segs.length) {
      // Keep vowels (they carry the word), skip short consonants.
      if (!VOWEL.has(x)) continue;
    }
    out.push([+t.toFixed(3), x]);
  }
  return quiet && quiet.length ? applyQuiet(out, quiet, end) : out;
}

/**
 * Rest the mouth (X) wherever the voice is quiet; elsewhere keep the track's shape.
 * Open stretches shorter than 40 ms left between quiet spans are closed too (they only flicker).
 */
export function applyQuiet(track, quiet, end) {
  if (!track.length) return track;
  const t0 = track[0][0];
  const q = quiet.map(([a, b]) => [Math.max(t0, a), Math.min(end, b)]).filter(([a, b]) => b > a);
  if (!q.length) return track;
  const shapeAt = (t) => { let x = 'X'; for (const [a, s] of track) { if (a <= t + 1e-9) x = s; else break; } return x; };
  const inQuiet = (t) => q.some(([a, b]) => t >= a - 1e-9 && t < b - 1e-9);
  const pts = [...new Set([...track.map(x => x[0]), ...q.flat()])].filter(t => t <= end + 1e-9).sort((a, b) => a - b);
  let out = [];
  for (const t of pts) {
    const x = inQuiet(t) ? 'X' : shapeAt(t);
    if (out.length && out.at(-1)[1] === x) continue;
    out.push([+t.toFixed(3), x]);
  }
  // Drop open stretches shorter than 40 ms that sit between rests.
  out = out.filter(([t, x], i) => {
    if (x === 'X' || i === 0) return true;
    const next = out[i + 1] ? out[i + 1][0] : end;
    return !(next - t < 0.04 && out[i - 1][1] === 'X' && (!out[i + 1] || out[i + 1][1] === 'X'));
  });
  const merged = [];
  for (const e of out) if (!merged.length || merged.at(-1)[1] !== e[1]) merged.push(e);
  return merged;
}

/** Quiet stretches (≥ minQuiet s) of a voice clip, in seconds from its start. */
export function quietSpans(rms, thr, hop = 0.01, minQuiet = 0.06) {
  const out = [];
  let q0 = null;
  for (let f = 0; f <= rms.length; f++) {
    const quiet = f < rms.length && rms[f] <= thr;
    if (quiet && q0 == null) q0 = f;
    if (!quiet && q0 != null) { if ((f - q0) * hop >= minQuiet) out.push([+(q0 * hop).toFixed(3), +(f * hop).toFixed(3)]); q0 = null; }
  }
  return out;
}
