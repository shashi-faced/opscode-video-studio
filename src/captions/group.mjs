// Timed words → caption chunks, shared by generated videos and captions on any video (plan 13, Phase 3).
//   line:    up to 7 words (and maxChars), one sentence piece at a time
//   karaoke: same chunks, each word with its own time (the spoken word lights up)
//   pop:     1–3 big words, breaking at punctuation and pauses

export const MAX_CHARS = { wide: 42, tall: 32 };
const PAUSE = 0.35;      // a gap this long ends a chunk
const HOLD = 0.6;        // a chunk stays up until the next one when the gap is shorter
const TAIL = 0.3;        // otherwise it stays this long after its last word
const MIN_SHOW = 0.7;    // and at least this long (when the next chunk leaves room)

const textLen = (s) => [...String(s).replace(/<[^>]+>/g, '')].length;

/**
 * @param tokens [{ text, html }] in order
 * @param times  [[start, end]] in seconds, same length as tokens (absolute times)
 * @param style  'line' | 'karaoke' | 'pop'
 * @param opts.maxWords  default 7 (pop: 3)
 * @param opts.maxChars  default Infinity (use MAX_CHARS.wide / .tall to keep lines short)
 * @param opts.clipStart chunks never start before this (the part start)
 * @returns [{ start, end, html, words? }]
 */
export function groupWords(tokens, times, style = 'line', { maxWords, maxChars = Infinity, clipStart = -Infinity } = {}) {
  if (!tokens.length) return [];
  const mw = maxWords || (style === 'pop' ? 3 : 7);
  const groups = [];
  let cur = [], chars = 0;
  tokens.forEach((t, i) => {
    const len = textLen(t.text);
    // Start a new chunk before this word if it would make the line too long.
    if (cur.length && chars + 1 + len > maxChars) { groups.push(cur); cur = []; chars = 0; }
    cur.push(i);
    chars += (cur.length > 1 ? 1 : 0) + len;
    const ends = /[.!?।]$/.test(t.text) || (/[,;:—]$/.test(t.text) && (style === 'pop' || cur.length >= 3));
    const pause = i + 1 < tokens.length && times[i + 1][0] - times[i][1] > PAUSE;
    if (ends || pause || cur.length >= mw) { groups.push(cur); cur = []; chars = 0; }
  });
  if (cur.length) {
    const last = groups.at(-1);
    const lastChars = last ? last.reduce((n, i) => n + textLen(tokens[i].text) + 1, 0) : 0;
    const curChars = cur.reduce((n, i) => n + textLen(tokens[i].text) + 1, 0);
    // Avoid a dangling 1-2 word chunk.
    if (style !== 'pop' && cur.length <= 2 && last && last.length + cur.length <= mw + 2 && lastChars + curChars - 1 <= maxChars) last.push(...cur);
    else groups.push(cur);
  }
  return groups.map((g, k) => {
    const start = times[g[0]][0];
    const next = groups[k + 1] ? times[groups[k + 1][0]][0] : null;
    const lastEnd = times[g.at(-1)][1];
    let end = next != null && next - lastEnd < HOLD ? next : lastEnd + TAIL;
    if (end - start < MIN_SHOW) end = next != null ? Math.max(end, Math.min(next, start + MIN_SHOW)) : start + MIN_SHOW;
    const c = { start: +Math.max(clipStart, start - 0.05).toFixed(3), end: +end.toFixed(3) };
    if (style === 'line') c.html = g.map(i => tokens[i].html).join(' ');
    else {
      const tidy = (h) => (style === 'pop' ? h.replace(/[,;:—](<\/mark>)?$/, '$1') : h);
      c.html = g.map(i => `<b class="w">${tidy(tokens[i].html)}</b>`).join(' ');
      c.words = g.map(i => [+times[i][0].toFixed(3), +times[i][1].toFixed(3)]);
    }
    return c;
  });
}
