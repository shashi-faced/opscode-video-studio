// video_captions (plan 13, Phase 5): word-by-word captions for any video file.
//   listen (Whisper) → words → caption chunks (heard words, or the user's script with heard timing)
//   → .srt / .vtt / .words.json → burned into a new MP4 (optional).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { findFfmpeg } from '../deps/locate.mjs';
import { PLATFORMS, resolvePlatform } from '../schema/platforms.mjs';
import { CAPTION_STYLES, CAPTION_POSITIONS } from '../schema/spec.mjs';
import { captionTokens } from '../timeline.mjs';
import { alignWords, matchRate } from './align.mjs';
import { captionsFromWords, maxCharsFor } from './build.mjs';
import { groupWords } from './group.mjs';
import { writeSubtitles } from './formats.mjs';
import { burnCaptions, probeVideo } from './burn.mjs';

function userError(message, fix) { const e = new Error(message); e.fix = fix; return e; }
const STYLE_ALIASES = { word: 'karaoke', words: 'karaoke', highlight: 'karaoke', 'word-by-word': 'pop', big: 'pop', reel: 'pop', tiktok: 'pop', subtitle: 'line', subtitles: 'line', sentence: 'line', classic: 'line' };

/** Params → settled options (style from the platform or the frame shape when not given). */
export function captionOptions(p, video) {
  const platform = p.platform ? resolvePlatform(p.platform) : null;
  let style = String(p.style || '').toLowerCase();
  style = CAPTION_STYLES.includes(style) ? style : STYLE_ALIASES[style] || null;
  if (!style) style = platform ? PLATFORMS[platform].captions.style : video.height > video.width * 1.1 ? 'pop' : 'karaoke';
  const position = CAPTION_POSITIONS.includes(p.position) ? p.position : 'bottom';
  return { platform, style, position, highlight: typeof p.highlight === 'string' && /^#[0-9a-f]{3,8}$|^[a-z]+$/i.test(p.highlight) ? p.highlight : undefined };
}

/** The script text from a string or a .txt / .md file path. */
function readScript(script, cwd) {
  if (!script) return null;
  const s = String(script);
  const f = path.resolve(cwd, s);
  if (/\.(txt|md|srt)$/i.test(s) && fs.existsSync(f)) return fs.readFileSync(f, 'utf8').replace(/^\d+\s*$|^\d\d:\d\d:\d\d[,.]\d+ --> .*$/gm, ' ');
  return s;
}

/**
 * @returns { ok, text, videoFile?, imageFile?, data }
 */
export async function videoCaptions(params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  if (!params.input) throw userError('missing "input" (the video file to caption)', 'pass input: "path/to/video.mp4"');
  const input = path.resolve(cwd, String(params.input));
  const video = probeVideo(input);
  if (!video.hasAudio && !params.words) throw userError(`${params.input} has no sound track, so there is nothing to hear`, 'pass words: an edited .words.json, or use a video with speech');
  const opt = captionOptions(params, video);
  const burn = params.burn !== false;
  const stem = path.basename(input, path.extname(input));
  const outFile = params.out ? path.resolve(cwd, String(params.out)) : path.join(path.dirname(input), `${stem}-captions.mp4`);
  const base = outFile.replace(/\.mp4$/i, '');
  const maxChars = maxCharsFor(video.width, video.height);
  const script = readScript(params.script, cwd);

  // 1. Words: from an edited words.json (no listening) or from Whisper.
  let words, meta;
  if (params.words) {
    const wf = path.resolve(cwd, String(params.words));
    if (!fs.existsSync(wf)) throw userError(`words file not found: ${params.words}`, 'pass the .words.json written by an earlier video_captions call');
    let j;
    try { j = JSON.parse(fs.readFileSync(wf, 'utf8')); } catch (e) { throw userError(`${params.words} is not valid JSON: ${e.message}`, 'fix the JSON (each word: { "text", "start", "end" })'); }
    words = (Array.isArray(j) ? j : j.words || []).filter(w => w && String(w.text || '').trim() && Number.isFinite(+w.start) && Number.isFinite(+w.end))
      .map(w => ({ text: String(w.text).trim(), start: +w.start, end: Math.max(+w.start + 0.05, +w.end) })).sort((a, b) => a.start - b.start);
    if (!words.length) throw userError(`${params.words} has no words`, 'each word needs "text", "start" and "end" in seconds');
    meta = { source: 'edited', language: j.language || null, model: j.model || null };
  } else {
    const { transcribe } = await import('../asr/transcribe.mjs');
    const keep = script ? captionTokens(script).map(t => t.text) : [];
    const t = await transcribe(input, { language: params.language || 'auto', quality: params.quality || 'balanced', keep, onProgress });
    words = t.words;
    meta = { source: 'heard', language: t.language, model: t.model, languageDetected: t.languageDetected, shift: t.shift, dropped: t.dropped.length, notes: t.notes, cached: !!t.cached };
    if (!words.length) {
      return { ok: false, text: `No speech was heard in ${params.input} (${Math.round(video.duration || 0)} s${t.dropped.length ? `; ${t.dropped.length} invented word(s) over music or silence were removed` : ''}). Nothing was written. If there is speech, try again with its language set (e.g. language "${t.language === 'en' ? 'hi' : 'en'}")${(params.quality || 'balanced') === 'fast' ? ' and quality "balanced"' : ''}.`, data: { ...meta, words: 0 } };
    }
  }

  // 2. Caption chunks: the user's script (their spelling) timed by the heard words, or the heard words.
  let captions, timed, scriptMatch = null;
  if (script) {
    const tokens = captionTokens(script.replace(/\s+/g, ' '));
    const times = alignWords(tokens, words, video.duration || words.at(-1).end);
    scriptMatch = +matchRate(tokens, words).toFixed(2);
    captions = groupWords(tokens, times, opt.style, { maxChars, clipStart: 0 });
    timed = tokens.map((tk, i) => ({ text: tk.text, start: times[i][0], end: times[i][1] }));
  } else {
    captions = captionsFromWords(words, opt.style, { maxChars });
    timed = words.map(({ text, start, end }) => ({ text, start, end }));
  }

  // 3. Files: subtitles and the editable word list.
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const subs = writeSubtitles(base, captions, { maxChars });
  const wordsFile = `${base}.words.json`;
  fs.writeFileSync(wordsFile, JSON.stringify({ about: 'Edit any "text" (or times, in seconds) and call video_captions again with words: this file, to burn the captions again without listening.', input, ...meta, words: timed }, null, 1));

  // 4. Burn into a new video, and one frame to show.
  let burned = null, imageFile;
  if (burn) {
    burned = await burnCaptions({ input, captions, out: outFile, style: opt.style, position: opt.position, platform: opt.platform, highlight: opt.highlight, onProgress });
    const mid = captions[Math.min(captions.length - 1, Math.floor(captions.length / 3))];
    const at = mid.words ? mid.words.at(-1)[0] + 0.02 : (mid.start + mid.end) / 2;
    imageFile = `${base}-preview.jpg`;
    try { execFileSync(findFfmpeg(), ['-y', '-v', 'error', '-ss', at.toFixed(3), '-i', outFile, '-frames:v', '1', '-vf', `scale='min(720,iw)':-2`, '-q:v', '3', imageFile]); } catch { imageFile = undefined; }
  }

  const lang = meta.language ? `${meta.language}${meta.languageDetected ? ' (detected)' : ''}` : 'from the edited file';
  const lines = [
    burn ? `Captions burned in: ${outFile}` : 'Caption files written (not burned in; burn: false).',
    `${timed.length} words, ${captions.length} captions, style ${opt.style}, ${opt.position}${opt.platform ? `, ${PLATFORMS[opt.platform].label}` : ''}. Language: ${lang}${meta.model ? `, ${meta.model}` : ''}.`,
    script ? `Script spelling used; ${Math.round(scriptMatch * 100)}% of its words were heard as written (the rest were timed from the words around them).` : '',
    meta.dropped ? `${meta.dropped} invented word(s) heard over music or silence were removed.` : '',
    ...(meta.notes || []).map(n => `Note: ${n}.`),
    `Subtitles: ${subs.srt}, ${subs.vtt}`,
    `Words (editable): ${wordsFile}. To fix a word, edit its "text" there and call video_captions with words: that file (no listening again).`,
    burned ? `Took ${burned.seconds} s for ${Math.round(burned.duration)} s of video. Tell the user where the video is, and offer another style (line, karaoke, pop) or a fix.` : '',
  ].filter(Boolean);
  return {
    ok: true,
    text: lines.join('\n'),
    videoFile: burned ? outFile : undefined,
    imageFile,
    data: { file: burned ? outFile : null, srt: subs.srt, vtt: subs.vtt, words: wordsFile, wordCount: timed.length, captions: captions.length, style: opt.style, position: opt.position, platform: opt.platform, scriptMatch, ...meta, width: video.width, height: video.height, duration: video.duration, seconds: burned?.seconds },
  };
}
