import { visemeTrack } from './audio/visemes.mjs';
import { alignWords } from './captions/align.mjs';
import { groupWords, MAX_CHARS } from './captions/group.mjs';

export { alignWords };
// Scene timing + caption chunks. Everything downstream (compiler, music, mixer)
// reads this one object so voice, picture and music always agree.

export const TEMPLATE_MIN = { title: 3.5, feature: 5, bullets: 4.5, split: 4.5, stat: 4, quote: 4.5, cta: 5, story: 3.5, dialogue: 3, steps: 5 };
// Pause between spoken parts of one scene (narration, then each dialogue line).
export const PART_GAP = 0.35;
export const LEAD_IN = 0.4;
export const TAIL = 0.7;
const READ_CPS = 15; // estimated speaking speed when there is no voice

export const escapeHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/**
 * Delivery tags such as [laughs], [whispers] or [excited] tell an expressive voice (ElevenLabs) how to
 * say a line. They are never shown on screen, never in captions, and never read aloud by other voices.
 */
export const stripTags = (s) => String(s ?? '').replace(/\[[A-Za-z][A-Za-z ,'-]{1,28}\]/g, ' ').replace(/[ \t]{2,}/g, ' ').trim();
// *word* -> <mark>word</mark>; everything else escaped.
export const markup = (s) => escapeHtml(stripTags(s)).replace(/\*([^*]+)\*/g, '<mark>$1</mark>');
const plain = (s) => stripTags(s).replace(/\*/g, '');

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
  for (const raw of stripTags(text).split(/\s+/).filter(Boolean)) {
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

/**
 * Caption chunks with times. line: up to 7 words; karaoke: same, with per-word times;
 * pop: 1-3 words, breaking at punctuation and pauses. maxChars keeps lines short (tall frames: 32).
 */
export function timedCaptions(text, words, partStart, span, style = 'line', { maxChars = Infinity } = {}) {
  const tokens = captionTokens(text);
  if (!tokens.length) return [];
  const times = alignWords(tokens, words, span).map(([a, b]) => [partStart + a, partStart + b]);
  return groupWords(tokens, times, style, { maxChars, clipStart: partStart });
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
export function buildTimeline(storyboard, voiceLengths = [], partLengths = [], narrationWords = [], partWords = [], partQuiet = []) {
  const capStyle = storyboard.captions && typeof storyboard.captions === 'object' ? storyboard.captions.style || 'line' : 'line';
  // Short lines on tall frames (reels, stories) so a caption never runs to 3 lines.
  const maxChars = /^(9:16|4:5)$/.test(storyboard.format || '') ? MAX_CHARS.tall : MAX_CHARS.wide;
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
        const quiet = (partQuiet[i]?.[j] || []).map(([a, b]) => [off + a, off + b]);
        tp.visemes = visemeTrack(tokens, rel.map(([a, b]) => [off + a, off + b]), off + partSecs[j], quiet);
      }
      timed.push(tp);
      off += partSecs[j] + PART_GAP;
    });
    const captions = [];
    const narrPart = timed.find(p => p.kind === 'narration');
    if (narr && narrPart && storyboard.captions !== false) {
      captions.push(...timedCaptions(sc.narration, narrationWords[i], narrPart.start, narrPart.end - narrPart.start, capStyle, { maxChars }));
    }
    // Dialogue lines as captions too (captions.lines), each timed by its speaker's voice.
    if (storyboard.captions && storyboard.captions.lines) {
      timed.forEach((tp, j) => {
        if (tp.kind !== 'line') return;
        captions.push(...timedCaptions(parts[j].text, partWords[i]?.[j] || null, tp.start, tp.end - tp.start, capStyle, { maxChars }));
      });
      captions.sort((a, b) => a.start - b.start);
    }
    scenes.push({ index: i, template: sc.template, start, end, duration: +duration.toFixed(3), voiceStart, voiceLength: measured ?? null, estimated: measured == null && parts.length > 0, captions, parts: timed });
    t += duration;
  });
  return { duration: +t.toFixed(3), fps: storyboard.fps || 30, scenes };
}
