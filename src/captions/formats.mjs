// Subtitle files from caption chunks (plan 13, Phase 3): SRT, WebVTT (with per-word times for
// karaoke-capable players), and a words.json that can be edited and burned in again.
import fs from 'node:fs';
import { MAX_CHARS } from './group.mjs';

const pad = (n, w = 2) => String(n).padStart(w, '0');
function clock(t, sep) {
  const ms = Math.max(0, Math.round(t * 1000));
  return `${pad(Math.floor(ms / 3600000))}:${pad(Math.floor(ms / 60000) % 60)}:${pad(Math.floor(ms / 1000) % 60)}${sep}${pad(ms % 1000, 3)}`;
}
export const srtTime = (t) => clock(t, ',');
export const vttTime = (t) => clock(t, '.');

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
/** Caption html → plain text. */
export const plainCaption = (html) => unescape(String(html).replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

/** Words of a caption's html (one per <b class="w">, or split on spaces). */
function captionWords(html) {
  const ws = [...String(html).matchAll(/<b class="w">([\s\S]*?)<\/b>/g)].map(m => plainCaption(m[1]));
  return ws.length ? ws : plainCaption(html).split(' ').filter(Boolean);
}

/** At most 2 lines: break near the middle when the text is longer than maxChars. */
export function twoLines(text, maxChars = MAX_CHARS.wide) {
  if ([...text].length <= maxChars) return text;
  const words = text.split(' ');
  let best = 1, bestDiff = Infinity;
  for (let k = 1; k < words.length; k++) {
    const d = Math.abs([...words.slice(0, k).join(' ')].length - [...words.slice(k).join(' ')].length);
    if (d < bestDiff) { bestDiff = d; best = k; }
  }
  return `${words.slice(0, best).join(' ')}\n${words.slice(best).join(' ')}`;
}

/**
 * Captions (from the timeline or from groupWords) → cues { start, end, text, words? }.
 * Overlaps are trimmed so each cue ends where the next starts; empty captions are dropped.
 */
export function cuesFrom(captions) {
  const cues = captions
    .map(c => ({ start: c.start, end: c.end, text: plainCaption(c.html), words: c.words && captionWords(c.html).length === c.words.length ? captionWords(c.html).map((w, i) => ({ text: w, start: c.words[i][0], end: c.words[i][1] })) : null }))
    .filter(c => c.text && c.end > c.start)
    .sort((a, b) => a.start - b.start);
  for (let i = 0; i + 1 < cues.length; i++) if (cues[i].end > cues[i + 1].start) cues[i].end = Math.max(cues[i].start + 0.05, cues[i + 1].start);
  return cues;
}

export function toSrt(cues, { maxChars } = {}) {
  return cues.map((c, k) => `${k + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${twoLines(c.text, maxChars)}\n`).join('\n');
}

/** WebVTT. With per-word times, each word after the first gets an inline <hh:mm:ss.mmm> timestamp. */
export function toVtt(cues, { maxChars, words = true } = {}) {
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = cues.map(c => {
    let text;
    if (words && c.words && c.words.length > 1) {
      const lines = twoLines(c.words.map(w => w.text).join(' '), maxChars).split('\n');
      let k = 0;
      text = lines.map(line => line.split(' ').map(w => { const ww = c.words[k++]; return k === 1 ? esc(w) : `<${vttTime(ww.start)}>${esc(w)}`; }).join(' ')).join('\n');
    } else text = esc(twoLines(c.text, maxChars));
    return `${vttTime(c.start)} --> ${vttTime(c.end)}\n${text}\n`;
  }).join('\n');
  return `WEBVTT\n\n${body}`;
}

/** Every word with its time, for editing and burning in again ({ words: [{ text, start, end }] }). */
export function toWordsJson(cues, meta = {}) {
  const words = cues.flatMap(c => c.words || c.text.split(' ').map((w, i, a) => ({ text: w, start: +(c.start + (c.end - c.start) * i / a.length).toFixed(3), end: +(c.start + (c.end - c.start) * (i + 1) / a.length).toFixed(3) })));
  return JSON.stringify({ ...meta, words }, null, 1);
}

/**
 * Write <base>.srt and <base>.vtt for these captions. Returns { srt, vtt, cues } or {} when there is nothing to write.
 */
export function writeSubtitles(base, captions, { maxChars } = {}) {
  const cues = cuesFrom(captions || []);
  if (!cues.length) return {};
  const srt = `${base}.srt`, vtt = `${base}.vtt`;
  fs.writeFileSync(srt, toSrt(cues, { maxChars }));
  fs.writeFileSync(vtt, toVtt(cues, { maxChars }));
  return { srt, vtt, cues: cues.length };
}
