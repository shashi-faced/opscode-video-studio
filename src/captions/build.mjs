// Caption chunks for a video file (plan 13): from heard words alone, or from a known script whose
// words get the heard times (the user's spelling, Whisper's timing).
import { captionTokens, escapeHtml } from '../timeline.mjs';
import { alignWords } from './align.mjs';
import { groupWords, MAX_CHARS } from './group.mjs';

/** Frame shape → line length limit. */
export const maxCharsFor = (width, height) => (height > width * 1.1 ? MAX_CHARS.tall : MAX_CHARS.wide);

/** Heard words [{ text, start, end }] → caption chunks. */
export function captionsFromWords(words, style = 'pop', { maxChars = MAX_CHARS.wide } = {}) {
  const ws = (words || []).filter(w => String(w.text).trim());
  const tokens = ws.map(w => ({ text: String(w.text).trim(), html: escapeHtml(String(w.text).trim()) }));
  return groupWords(tokens, ws.map(w => [w.start, w.end]), style, { maxChars, clipStart: 0 });
}

/**
 * A known script (*stars* highlight words) timed by the heard words → caption chunks.
 * Returns { captions, matched } where matched is the share of script words found by spelling.
 */
export function captionsFromScript(script, words, duration, style = 'pop', { maxChars = MAX_CHARS.wide } = {}) {
  const tokens = captionTokens(String(script || '').replace(/\s+/g, ' '));
  if (!tokens.length) return { captions: [], tokens: 0 };
  const times = alignWords(tokens, words, duration);
  return { captions: groupWords(tokens, times, style, { maxChars, clipStart: 0 }), tokens: tokens.length };
}
