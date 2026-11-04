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
export function buildTimeline(storyboard, voiceLengths = [], partLengths = []) {
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
      timed.push({ kind: p.kind, who: p.who, line: p.line, start: +off.toFixed(3), end: +(off + partSecs[j]).toFixed(3) });
      off += partSecs[j] + PART_GAP;
    });
    const captions = [];
    const narrPart = timed.find(p => p.kind === 'narration');
    if (narr && narrPart && storyboard.captions !== false) {
      const chunks = captionChunks(sc.narration);
      const lens = chunks.map(p => plain(p).length);
      const total = lens.reduce((a, b) => a + b, 0) || 1;
      const span = narrPart.end - narrPart.start;
      let ct = narrPart.start;
      chunks.forEach((p, j) => {
        const d = span * lens[j] / total;
        captions.push({ start: +ct.toFixed(3), end: +(j === chunks.length - 1 ? ct + d + 0.25 : ct + d).toFixed(3), html: markup(p) });
        ct += d;
      });
    }
    scenes.push({ index: i, template: sc.template, start, end, duration: +duration.toFixed(3), voiceStart, voiceLength: measured ?? null, estimated: measured == null && parts.length > 0, captions, parts: timed });
    t += duration;
  });
  return { duration: +t.toFixed(3), fps: storyboard.fps || 30, scenes };
}
