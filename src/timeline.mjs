import { visemeTrack } from './audio/visemes.mjs';
// Scene timing + caption chunks. Everything downstream (compiler, music, mixer)
// reads this one object so voice, picture and music always agree.

export const TEMPLATE_MIN = { title: 3.5, feature: 5, bullets: 4.5, split: 4.5, stat: 4, quote: 4.5, cta: 5, story: 3.5, dialogue: 3, steps: 5 };
// Pause between spoken parts of one scene (narration, then each dialogue line).
export const PART_GAP = 0.35;
export const LEAD_IN = 0.4;
export const TAIL = 0.7;
const READ_CPS = 15; // estimated speaking speed when there is no voice

export const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// *word* -> <mark>word</mark>; everything else escaped.
export const markup = (s) => escapeHtml(s).replace(/\*([^*]+)\*/g, '<mark>$1</mark>');
const plain = (s) => String(s ?? '').replace(/\*/g, '');

export function estimateSpeech(text) {
  const t = plain(text).trim();
  return t ? Math.max(1.2, t.length / READ_CPS) : 0;
}

// Split narration into caption chunks of <= maxWords, preferring punctuation.
export function captionChunks(text, maxWords = 7) {
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  const chunks = [];
  let cur = [];
  for (const w of words) {
    cur.push(w);
    const ends = /[.!?।]$/.test(w) || (/[,;:—]$/.test(w) && cur.length >= 3);
    if (ends || cur.length >= maxWords) { chunks.push(cur.join(' ')); cur = []; }
  }
  if (cur.length) {
    // Avoid a dangling 1-2 word chunk.
    if (cur.length <= 2 && chunks.length && chunks.at(-1).split(' ').length + cur.length <= maxWords + 2) chunks[chunks.length - 1] += ' ' + cur.join(' ');
    else chunks.push(cur.join(' '));
  }
  return chunks;
}

/**
 * Narration split into words, keeping *highlight* spans that may cover several words.
 * @returns [{ text, html }]
 */
export function captionTokens(text) {
  const out = [];
  let marked = false;
  for (const raw of String(text ?? '').trim().split(/\s+/).filter(Boolean)) {
    let html = '', plainText = '';
    for (const [k, seg] of raw.split('*').entries()) {
      if (k > 0) marked = !marked;
      if (!seg) continue;
      plainText += seg;
      html += marked ? `<mark>${escapeHtml(seg)}</mark>` : escapeHtml(seg);
    }
    if (plainText) out.push({ text: plainText, html });
  }
  return out;
}

const norm = (s) => String(s).normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}%₹$€£]/gu, '');

/**
 * Give each caption token a time window from the TTS word timings (seconds from the part start).
 * Tokens the voice did not report (punctuation, odd spellings) are placed between their neighbours.
 * Without timings, the window is shared out by word length.
 */
export function alignWords(tokens, words, span) {
  const n = tokens.length;
  const times = new Array(n).fill(null);
  if (words && words.length) {
    const b = words.map(w => ({ ...w, n: norm(w.text) })).filter(w => w.n);
    let j = 0;
    tokens.forEach((t, i) => {
      const tn = norm(t.text);
      if (!tn) return;
      for (let k = j; k < Math.min(b.length, j + 4); k++) {
        if (!(tn.startsWith(b[k].n) || b[k].n.startsWith(tn))) continue;
        // One written word may be several spoken ones ("₹999-only"): take boundaries while they fit.
        let acc = b[k].n, end = b[k].end, m = k + 1;
        while (acc.length < tn.length && m < b.length && tn.startsWith(acc + b[m].n)) { acc += b[m].n; end = b[m].end; m++; }
        times[i] = [b[k].start, end];
        j = m;
        break;
      }
    });
  }
  // Fill gaps by length between known neighbours (or the whole span).
  const len = tokens.map(t => Math.max(1, plain(t.text).length));
  let i = 0;
  while (i < n) {
    if (times[i]) { i++; continue; }
    let k = i;
    while (k < n && !times[k]) k++;
    const from = i > 0 ? times[i - 1][1] : 0;
    const to = k < n ? times[k][0] : Math.max(from, span);
    const total = len.slice(i, k).reduce((a, c) => a + c, 0);
    let t = from;
    for (let q = i; q < k; q++) { const d = (to - from) * len[q] / total; times[q] = [t, t + d]; t += d; }
    i = k;
  }
  return times.map(([a, b]) => [+a.toFixed(3), +Math.max(a + 0.05, b).toFixed(3)]);
}

/**
 * Caption chunks with times. line: up to 7 words; karaoke: same, with per-word times;
 * pop: 1-3 words, breaking at punctuation and pauses.
 */
export function timedCaptions(text, words, partStart, span, style = 'line') {
  const tokens = captionTokens(text);
  if (!tokens.length) return [];
  const times = alignWords(tokens, words, span);
  const maxWords = style === 'pop' ? 3 : 7;
  const groups = [];
  let cur = [];
  tokens.forEach((t, i) => {
    cur.push(i);
    const ends = /[.!?।]$/.test(t.text) || (/[,;:—]$/.test(t.text) && (style === 'pop' || cur.length >= 3));
    const pause = i + 1 < tokens.length && times[i + 1][0] - times[i][1] > 0.35;
    if (ends || pause || cur.length >= maxWords) { groups.push(cur); cur = []; }
  });
  if (cur.length) {
    const last = groups.at(-1);
    if (style !== 'pop' && cur.length <= 2 && last && last.length + cur.length <= maxWords + 2) last.push(...cur);
    else groups.push(cur);
  }
  return groups.map((g, k) => {
    const start = partStart + times[g[0]][0];
    const next = groups[k + 1] ? partStart + times[groups[k + 1][0]][0] : null;
    const lastEnd = partStart + times[g.at(-1)][1];
    // Stay up until the next chunk unless there is a real pause.
    const end = next != null && next - lastEnd < 0.6 ? next : lastEnd + 0.3;
    const c = { start: +Math.max(partStart, start - 0.05).toFixed(3), end: +end.toFixed(3) };
    if (style === 'line') c.html = g.map(i => tokens[i].html).join(' ');
    else {
      const tidy = (h) => (style === 'pop' ? h.replace(/[,;:—](<\/mark>)?$/, '$1') : h);
      c.html = g.map(i => `<b class="w">${tidy(tokens[i].html)}</b>`).join(' ');
      c.words = g.map(i => [+(partStart + times[i][0]).toFixed(3), +(partStart + times[i][1]).toFixed(3)]);
    }
    return c;
  });
}

/**
 * What is spoken in a scene, in order: the narration (narrator voice), then each dialogue
 * line (the speaker's voice). The voice track of a scene is these parts joined with PART_GAP.
 */
export function speechParts(sc) {
  const parts = [];
  if (sc.narration && plain(sc.narration).trim()) parts.push({ kind: 'narration', text: sc.narration });
  (sc.lines || []).forEach((l, k) => { if (l && l.text) parts.push({ kind: 'line', who: String(l.who || '').toLowerCase(), line: k, text: l.text }); });
  return parts;
}

/**
 * @param storyboard normalised storyboard
 * @param voiceLengths array (per scene) of measured voice seconds, or null where none
 * @param partLengths  array (per scene) of measured seconds per speech part, or null
 */
export function buildTimeline(storyboard, voiceLengths = [], partLengths = [], narrationWords = [], partWords = []) {
  const capStyle = storyboard.captions && typeof storyboard.captions === 'object' ? storyboard.captions.style || 'line' : 'line';
  const scenes = [];
  let t = 0;
  storyboard.scenes.forEach((sc, i) => {
    const parts = speechParts(sc);
    const narr = sc.narration ? plain(sc.narration) : '';
    const measured = voiceLengths[i];
    const estimates = parts.map(p => estimateSpeech(p.text));
    const partSecs = partLengths[i] && partLengths[i].length === parts.length ? partLengths[i]
      : measured != null && parts.length === 1 ? [measured] : estimates;
    const speech = measured ?? (parts.length ? partSecs.reduce((a, b) => a + b, 0) + PART_GAP * (parts.length - 1) : 0);
    const auto = Math.max(TEMPLATE_MIN[sc.template] ?? 4, speech ? LEAD_IN + speech + TAIL : 0);
    const duration = sc.duration ? Math.max(sc.duration, speech ? LEAD_IN + speech + 0.2 : 0) : auto;
    const start = +t.toFixed(3);
    const end = +(t + duration).toFixed(3);
    const voiceStart = speech ? start + LEAD_IN : null;
    // Absolute time window of every spoken part (used for captions, bubbles and talking mouths).
    const timed = [];
    let off = voiceStart ?? start;
    parts.forEach((p, j) => {
      const tp = { kind: p.kind, who: p.who, line: p.line, start: +off.toFixed(3), end: +(off + partSecs[j]).toFixed(3) };
      // Lip-sync: mouth shapes for a character's line, from its word timings (or spread evenly with no voice).
      if (p.kind === 'line') {
        const tokens = captionTokens(p.text);
        const rel = alignWords(tokens, partWords[i]?.[j] || null, partSecs[j]);
        tp.visemes = visemeTrack(tokens, rel.map(([a, b]) => [off + a, off + b]), off + partSecs[j]);
      }
      timed.push(tp);
      off += partSecs[j] + PART_GAP;
    });
    const captions = [];
    const narrPart = timed.find(p => p.kind === 'narration');
    if (narr && narrPart && storyboard.captions !== false) {
      captions.push(...timedCaptions(sc.narration, narrationWords[i], narrPart.start, narrPart.end - narrPart.start, capStyle));
    }
    scenes.push({ index: i, template: sc.template, start, end, duration: +duration.toFixed(3), voiceStart, voiceLength: measured ?? null, estimated: measured == null && parts.length > 0, captions, parts: timed });
    t += duration;
  });
  return { duration: +t.toFixed(3), fps: storyboard.fps || 30, scenes };
}
