// Known words (a script) ↔ heard words with times (TTS boundaries or Whisper). Plan 13, Phase 3.
//
// 1. Text pass: each script word finds the next heard word that spells the same (within 8 words).
//    One written word may be several spoken ones ("₹999-only").
// 2. Gaps between matched words take their times from the heard words between those anchors,
//    shared by letter count. This also aligns a whole script whose words were heard in another
//    spelling or script (Hindi heard in Latin or Urdu letters): order and length are enough.
// 3. Gaps with no heard words between their anchors are shared out by length (the old rule).

const plain = (s) => String(s ?? '').replace(/\*/g, '');
export const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}%₹$€£]/gu, '');

const SEARCH = 8;

/** Fraction of script tokens the text pass matched (0–1), for reports and tests. */
export function matchRate(tokens, words) {
  return tokens.length ? textPass(tokens, words).filter(Boolean).length / tokens.length : 0;
}

function textPass(tokens, words) {
  const hit = new Array(tokens.length).fill(null);
  if (!words || !words.length) return hit;
  const b = words.map((w, idx) => ({ ...w, idx, n: norm(w.text) })).filter(w => w.n);
  let j = 0;
  tokens.forEach((t, i) => {
    const tn = norm(t.text);
    if (!tn) return;
    for (let k = j; k < Math.min(b.length, j + SEARCH); k++) {
      if (!(tn.startsWith(b[k].n) || b[k].n.startsWith(tn))) continue;
      let acc = b[k].n, end = b[k].end, m = k + 1;
      while (acc.length < tn.length && m < b.length && tn.startsWith(acc + b[m].n)) { acc += b[m].n; end = b[m].end; m++; }
      hit[i] = { t: [b[k].start, end], from: b[k].idx, to: b[m - 1].idx };
      j = m;
      break;
    }
  });
  return hit;
}

/**
 * Times for tokens i..k-1 from heard words (letters spread evenly over each word's time).
 * Heard words are the evidence; tokens are placed at the same letter fraction.
 */
function spreadOver(tokens, i, k, heard, lens) {
  const hl = heard.map(w => Math.max(1, norm(w.text).length));
  const H = hl.reduce((a, c) => a + c, 0);
  const T = lens.slice(i, k).reduce((a, c) => a + c, 0);
  // Letter position x (0..H) → time.
  const at = (x) => {
    let c = 0;
    for (let q = 0; q < heard.length; q++) {
      if (x <= c + hl[q] || q === heard.length - 1) return heard[q].start + (heard[q].end - heard[q].start) * Math.min(1, Math.max(0, (x - c) / hl[q]));
      c += hl[q];
    }
    return heard.at(-1).end;
  };
  const out = [];
  let c = 0;
  for (let q = i; q < k; q++) {
    const a = at((c / T) * H), b = at(((c + lens[q]) / T) * H);
    out.push([a, b]);
    c += lens[q];
  }
  return out;
}

/**
 * Give each caption token a time window (seconds from the part start).
 * @param tokens [{ text }]
 * @param words  heard words [{ text, start, end }] or null
 * @param span   length of the part (used when nothing was heard)
 */
export function alignWords(tokens, words, span) {
  const n = tokens.length;
  const hit = textPass(tokens, words);
  const times = hit.map(h => (h ? h.t : null));
  const lens = tokens.map(t => Math.max(1, plain(t.text).length));
  const heardWords = (words || []).filter(w => norm(w.text));
  const idxOf = new Map((words || []).map((w, q) => [w, q]));
  let i = 0;
  while (i < n) {
    if (times[i]) { i++; continue; }
    let k = i;
    while (k < n && !times[k]) k++;
    // Heard words strictly between the anchors (or before the first / after the last).
    const lo = i > 0 ? hit[i - 1].to : -1;
    const hi = k < n ? hit[k].from : Infinity;
    const between = heardWords.filter(w => { const q = idxOf.get(w); return q > lo && q < hi; });
    if (between.length) {
      const t = spreadOver(tokens, i, k, between, lens);
      for (let q = i; q < k; q++) times[q] = t[q - i];
    } else {
      const from = i > 0 ? times[i - 1][1] : 0;
      const to = k < n ? times[k][0] : Math.max(from, span);
      const total = lens.slice(i, k).reduce((a, c) => a + c, 0);
      let t = from;
      for (let q = i; q < k; q++) { const d = (to - from) * lens[q] / total; times[q] = [t, t + d]; t += d; }
    }
    i = k;
  }
  // In order, never backwards.
  for (let q = 1; q < n; q++) if (times[q][0] < times[q - 1][0]) times[q] = [times[q - 1][0], Math.max(times[q - 1][0], times[q][1])];
  return times.map(([a, b]) => [+a.toFixed(3), +Math.max(a + 0.05, b).toFixed(3)]);
}
