// Clean-up of heard words (plan 13, Phase 2). Pure functions, testable without a model:
//  - correct Whisper's late timing by measuring it on this file (speech after a pause starts where the sound rises);
//  - drop words Whisper invents over silence, noise and music;
//  - make the times tidy (in order, inside the audio, not too short or too long).
import { levels, peakIn, onsetNear } from './audio.mjs';

const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');

// What Whisper says when it hears no speech (YouTube subtitles in its training data). A segment
// made only of one of these phrases is dropped. Normalised (no spaces or punctuation).
export const STOCK = new Set([
  'you', 'thankyou', 'thankyouverymuch', 'thankyousomuch', 'thanks', 'thanksforwatching', 'thankyouforwatching',
  'thankyousomuchforwatching', 'thankyouforwatchingpleasesubscribe', 'pleasesubscribe', 'subscribe', 'pleaselikeandsubscribe',
  'likeandsubscribe', 'bye', 'byebye', 'byeeveryone', 'seeyounexttime', 'seeyouinthenextvideo', 'music', 'applause', 'laughter',
  'so', 'okay', 'oh', 'uh', 'um', 'hmm', 'ah', 'yeah',
  'धन्यवाद', 'शुक्रिया', 'सब्सक्राइब', 'सब्सक्राइब करें', 'कृपया सब्सक्राइब करें', 'चैनल को सब्सक्राइब करें',
]);
const STOCK_N = new Set([...STOCK].map(norm));
const STOCK_PREFIX = new Set([...STOCK_N].flatMap(s => [...s].map((_, i) => s.slice(0, i + 1))));

/** Default lateness (s) when a file has too few pauses to measure it (from the Phase 1 calibration). */
export const DEFAULT_SHIFT = { en: 0.13, other: 0.05 };
export const SILENCE_RMS = 0.004;   // about -48 dBFS: nothing audible is said below this
const GAP = 0.15;                   // a word after at least this much quiet starts a phrase
const SEGMENT_GAP = 0.8;            // words further apart than this are different segments

/**
 * How late Whisper's words are in this file: median of (heard start − real sound onset) over
 * words that follow a pause. Returns { shift, measured, samples }.
 */
export function measureShift(words, rms, language = 'en') {
  const fallback = language === 'en' ? DEFAULT_SHIFT.en : DEFAULT_SHIFT.other;
  if (!rms || !rms.length) return { shift: fallback, measured: false, samples: 0 };
  const { thr, level, floor } = levels(rms);
  if (level < SILENCE_RMS || level - floor < SILENCE_RMS) return { shift: fallback, measured: false, samples: 0 };
  const d = [];
  words.forEach((w, i) => {
    if (i > 0 && w.start - words[i - 1].end < GAP) return;
    const on = onsetNear(rms, w.start, thr);
    if (on != null) d.push(w.start - on);
  });
  if (d.length < 3) return { shift: fallback, measured: false, samples: d.length };
  d.sort((a, b) => a - b);
  const med = d[d.length >> 1];
  return { shift: +Math.max(-0.1, Math.min(0.35, med)).toFixed(3), measured: true, samples: d.length };
}

/** Group words into segments separated by pauses longer than SEGMENT_GAP. */
export function segmentsOf(words) {
  const segs = [];
  for (const w of words) {
    const last = segs.at(-1);
    if (last && w.start - last.at(-1).end <= SEGMENT_GAP) last.push(w); else segs.push([w]);
  }
  return segs;
}

/**
 * Whisper sometimes hears a symbol as its own word ("30" "%", "₹" "999"). Join it to the word it belongs
 * to: %, punctuation and closing marks to the word before; ₹ $ € £ # @ and opening marks to the word after.
 */
export function glueSymbols(words) {
  const out = [];
  let carry = null;
  for (const w0 of words) {
    const w = { ...w0, text: String(w0.text).trim() };
    if (!w.text) continue;
    if (!norm(w.text) && /^[%.,!?;:।)\]}"'”’…-]+$/.test(w.text) && out.length && w.start - out.at(-1).end < 0.5) {
      out.at(-1).text += w.text; out.at(-1).end = Math.max(out.at(-1).end, w.end); continue;
    }
    if (!norm(w.text) && /^[₹$€£#@(\[{"'“‘]+$/.test(w.text)) { carry = carry ? { ...carry, text: carry.text + w.text } : w; continue; }
    if (carry) { if (w.start - carry.end < 0.5) { w.text = carry.text + w.text; w.start = carry.start; } else out.push(carry); carry = null; }
    out.push(w);
  }
  if (carry) out.push(carry);
  return out;
}

/**
 * Drop invented words. Returns { words, dropped: [{ text, start, reason }] }.
 * keep: normalised phrases that are really said (from a known script), never dropped as stock phrases.
 */
export function guard(words, { rms = null, duration = Infinity, keep = new Set() } = {}) {
  const dropped = [];
  const drop = (w, reason) => dropped.push({ text: w.text, start: w.start, reason });
  let out = [];
  for (const w of glueSymbols(words)) {
    if (!norm(w.text)) { drop(w, 'no letters'); continue; }
    if (/^[\s([♪*].*[\])♪*]\s*$/.test(w.text) || /♪/.test(w.text)) { drop(w, 'sound label'); continue; }
    if (!(w.start < duration - 0.02) || w.end <= 0) { drop(w, 'after the end of the audio'); continue; }
    if (rms && peakIn(rms, w.start - 0.05, Math.min(duration, w.end) + 0.05) < SILENCE_RMS) { drop(w, 'silence'); continue; }
    out.push(w);
  }
  // Stock phrases heard on their own (Whisper may spread one over several pauses: "Thank … you for watching!"),
  // and a word or phrase looping 4+ times.
  const segs = segmentsOf(out).map(s => ({ words: s, n: s.map(w => norm(w.text)).join('') }));
  const kept = [];
  for (let i = 0; i < segs.length; i++) {
    let n = '', j = i, hit = -1;
    for (; j < Math.min(segs.length, i + 4); j++) {
      n += segs[j].n;
      if (!STOCK_PREFIX.has(n)) break;
      if (STOCK_N.has(n) && !keep.has(n)) hit = j;
    }
    if (hit >= 0) {
      for (let k = i; k <= hit; k++) segs[k].words.forEach(w => drop(w, 'stock phrase over no speech'));
      i = hit;
      continue;
    }
    kept.push(...segs[i].words);
  }
  out = [];
  for (let i = 0; i < kept.length; i++) {
    let looped = false;
    for (const len of [1, 2, 3]) {
      if (out.length < len * 3) continue;
      const cur = kept.slice(i, i + len).map(w => norm(w.text)).join(' ');
      let reps = 0;
      for (let r = 1; r <= 3; r++) if (out.slice(out.length - len * r, out.length - len * (r - 1)).map(w => norm(w.text)).join(' ') === cur) reps++;
      if (reps === 3) { looped = true; break; }
    }
    if (looped) drop(kept[i], 'repeated loop'); else out.push(kept[i]);
  }
  return { words: out, dropped };
}

/** In order, inside [0, duration], each word 60 ms – 1.5 s, ends not after the next start. */
export function tidy(words, duration = Infinity) {
  const w = words.map(x => ({ ...x, text: String(x.text).trim() })).sort((a, b) => a.start - b.start);
  for (let i = 0; i < w.length; i++) {
    const x = w[i];
    x.start = Math.max(0, Math.min(x.start, duration), i ? w[i - 1].start : 0);
    if (!(x.end > x.start)) x.end = x.start + 0.06;
    x.end = Math.min(x.end, x.start + 1.5, duration);
  }
  for (let i = 0; i < w.length; i++) {
    const next = w[i + 1];
    if (next && w[i].end > next.start) w[i].end = Math.max(next.start, w[i].start + 0.06);
    if (w[i].end - w[i].start < 0.06) w[i].end = Math.min(duration, w[i].start + 0.06);
    w[i].start = +w[i].start.toFixed(3);
    w[i].end = +w[i].end.toFixed(3);
  }
  return w;
}

/** Shift every word earlier by `shift` seconds. */
export const applyShift = (words, shift) => words.map(w => ({ ...w, start: w.start - shift, end: w.end - shift }));
