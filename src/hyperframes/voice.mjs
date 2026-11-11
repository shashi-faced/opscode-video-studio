// Voice-over, music and captions for a HyperFrames project (plan 16, H3), made with Video Studio's own
// voices (Hindi, English and more), music synth and caption grouping. The agent gives one spoken line per
// scene; this returns the exact time of every scene, so the page is built to the voice.
import fs from 'node:fs';
import path from 'node:path';
import { synthesize } from '../audio/tts.mjs';
import { synthMusic } from '../audio/synth.mjs';
import { buildMusic, mixToWav } from '../audio/mix.mjs';
import { captionTokens } from '../timeline.mjs';
import { captionsFromWords } from '../captions/build.mjs';
import { cuesFrom } from '../captions/formats.mjs';
import { MAX_CHARS } from '../captions/group.mjs';
import { MUSIC_STYLES, VOICES } from '../schema/spec.mjs';

export const LEAD = 0.3;       // silence before the voice in each scene
export const TAIL = 0.5;       // and after it
export const MIN_SCENE = 2.5;  // a scene is never shorter than this
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;

const DEFAULT_VOICE = { hi: 'hi-IN-SwaraNeural', en: 'en-IN-NeerjaExpressiveNeural' };
const hasDevanagari = (s) => /[ऀ-ॿ]/.test(s);

/** The lines to speak: an array (one per scene), or a script split at line breaks or sentence ends. */
export function splitLines(lines, script) {
  if (Array.isArray(lines) && lines.length) return lines.map((l) => String(l || '').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const s = String(script || '').trim();
  if (!s) return [];
  const byLine = s.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (byLine.length > 1) return byLine;
  return s.split(/(?<=[.!?।])\s+/).map((l) => l.trim()).filter(Boolean);
}

export function pickVoice(voice, language, lines) {
  if (voice && VOICES.some((v) => v.id === voice)) return voice;
  if (voice && /^[a-z]{2}-[A-Z]{2}-\w+Neural$/.test(String(voice))) return String(voice);
  const lang = String(language || '').toLowerCase();
  if (/^hi|hindi/.test(lang) || (!lang && lines.some(hasDevanagari))) return DEFAULT_VOICE.hi;
  return DEFAULT_VOICE.en;
}

/**
 * Scene times from the measured voice lengths. Each scene holds its line with a short silence
 * before and after. Returns { scenes: [{ start, duration, voiceStart, voiceEnd }], total }.
 */
export function planScenes(voiceSeconds) {
  let t = 0;
  const scenes = voiceSeconds.map((v) => {
    const duration = r1(Math.max(MIN_SCENE, LEAD + (v || 0) + TAIL));
    const sc = { start: r1(t), duration, voiceStart: r3(t + LEAD), voiceEnd: r3(t + LEAD + (v || 0)) };
    t = r1(t + duration);
    return sc;
  });
  return { scenes, total: r1(t) };
}

/** Word times for a line: the voice's own when it gave them, else spread over the line by word length. */
export function wordsFor(line, words, voiceStart, seconds) {
  if (Array.isArray(words) && words.length) return words.map((w) => ({ text: String(w.text), start: r3(voiceStart + w.start), end: r3(voiceStart + w.end) }));
  const toks = captionTokens(line).map((t) => t.text);
  const total = toks.reduce((n, t) => n + [...t].length + 1, 0) || 1;
  let at = voiceStart;
  return toks.map((t) => { const d = seconds * (([...t].length + 1) / total); const w = { text: t, start: r3(at), end: r3(at + d * 0.92) }; at += d; return w; });
}

/** The script file that draws word-timed captions into <div id="captions"> on the main timeline. */
export function captionsScript(cues, { width, height, style }) {
  const tall = height > width * 1.1;
  const size = tall ? Math.round(width * 0.06) : Math.round(height * 0.052);
  const bottom = tall ? Math.round(height * 0.2) : Math.round(height * 0.09);
  const side = Math.round(width * 0.07);
  const data = cues.map((c) => ({ s: r3(c.start), e: r3(c.end), w: (c.words || [{ text: c.text, start: c.start, end: c.end }]).map((w) => [w.text, r3(w.start)]) }));
  return `// Captions for this video, made by hyperframes_voice. Do not edit by hand: run hyperframes_voice again.
(function () {
  var cues = ${JSON.stringify(data)};
  var light = ${JSON.stringify(style !== 'line')};
  var root = document.getElementById("captions");
  var tl = window.__timelines && window.__timelines["main"];
  if (!root || !tl) return;
  root.style.cssText += ";position:absolute;inset:0;pointer-events:none;display:block;padding:0;z-index:50;";
  cues.forEach(function (c, i) {
    var box = document.createElement("div");
    box.id = "cap-" + i;
    box.style.cssText = "position:absolute;left:${side}px;right:${side}px;bottom:${bottom}px;text-align:center;opacity:0;";
    var inner = document.createElement("span");
    inner.style.cssText = "display:inline-block;max-width:100%;padding:${Math.round(size * 0.28)}px ${Math.round(size * 0.55)}px;border-radius:${Math.round(size * 0.4)}px;background:rgba(8,10,20,0.78);color:#ffffff;font-family:'Hind',sans-serif;font-weight:600;font-size:${size}px;line-height:1.3;";
    c.w.forEach(function (w, j) {
      var sp = document.createElement("span");
      sp.id = "cap-" + i + "-" + j;
      sp.textContent = w[0] + (j < c.w.length - 1 ? " " : "");
      if (light) sp.style.opacity = "0.55";
      inner.appendChild(sp);
      if (light) tl.set(sp, { opacity: 1 }, Math.max(c.s, w[1]));
    });
    box.appendChild(inner);
    root.appendChild(box);
    tl.set(box, { opacity: 1 }, c.s);
    tl.set(box, { opacity: 0 }, c.e);
  });
})();
`;
}

function canvasOf(indexFile) {
  try {
    const html = fs.readFileSync(indexFile, 'utf8');
    const w = +(/data-width="(\d+)"/.exec(html)?.[1] || 0), h = +(/data-height="(\d+)"/.exec(html)?.[1] || 0);
    if (w && h) return { width: w, height: h };
  } catch { /* default below */ }
  return { width: 1080, height: 1920 };
}

export async function hfVoice(params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  if (!params.dir) return { ok: false, text: 'Give "dir": the project folder.' };
  const dir = path.resolve(cwd, String(params.dir));
  const index = path.join(dir, 'index.html');
  if (!fs.existsSync(index)) return { ok: false, text: `No HyperFrames project at ${dir} (index.html is missing). Create it with hyperframes_project { action: "init", dir }.` };
  const lines = splitLines(params.lines, params.script);
  if (!lines.length) return { ok: false, text: 'Give "lines": the sentences to speak, one per scene, e.g. ["Tea wakes you up.", "It is full of antioxidants."].' };
  if (lines.length > 40) return { ok: false, text: `Too many lines (${lines.length}). Use at most 40, one per scene.` };

  const voice = pickVoice(params.voice, params.language, lines);
  const rate = /^[+-]\d{1,2}%$/.test(String(params.rate || '')) ? params.rate : '+0%';
  const wantCaptions = params.captions !== false && params.captions !== 'off' && params.captions !== 'none';
  const capStyle = ['line', 'karaoke', 'pop'].includes(params.captions) ? params.captions : 'karaoke';
  const sb = { voice: { voice, rate }, captions: wantCaptions ? { timing: 'auto' } : false, scenes: lines.map((l) => ({ narration: l })) };

  let voices;
  try { voices = await synthesize(sb, { onProgress }); }
  catch (e) { return { ok: false, text: `The voice could not be made: ${e.message}. The voices need the internet. Check the connection and try again, or make the video without a voice.` }; }
  if (voices.some((v) => !v || !v.samples?.length)) return { ok: false, text: 'The voice service returned no sound for a line. Check the internet connection and try again.' };

  const plan = planScenes(voices.map((v) => v.seconds));
  const timeline = { duration: plan.total, scenes: plan.scenes.map((s) => ({ voiceStart: s.voiceStart })) };

  const musicStyle = params.music === false || params.music === 'none' || params.music === 'off' ? 'none' : MUSIC_STYLES.includes(params.music) ? params.music : 'ambient';
  let music;
  try {
    music = params.musicFile
      ? buildMusic({ music: { file: String(params.musicFile) } }, timeline, cwd, path)
      : synthMusic(timeline, { style: musicStyle });
  } catch (e) { return { ok: false, text: `The music file could not be read: ${e.message}. Use a WAV file, or leave musicFile out for generated music.` }; }
  const vol = Number.isFinite(+params.musicVolume) ? Math.max(0, Math.min(1, +params.musicVolume)) : 0.35;
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  const audioFile = path.join(dir, 'assets', 'audio.wav');
  mixToWav({ storyboard: { music: { volume: vol } }, timeline, voices, music, file: audioFile });

  const words = lines.flatMap((l, i) => wordsFor(l, voices[i].words, plan.scenes[i].voiceStart, voices[i].seconds));
  // HyperFrames' own transcript format, so its caption blocks and tools can use the timings too.
  fs.writeFileSync(path.join(dir, 'transcript.json'), JSON.stringify(words.map((w, i) => ({ text: w.text, start: w.start, end: w.end, id: `w${i}` })), null, 2));

  const canvas = canvasOf(index);
  let capCount = 0;
  const capFile = path.join(dir, 'assets', 'captions.js');
  if (wantCaptions) {
    const tall = canvas.height > canvas.width * 1.1;
    const cues = cuesFrom(captionsFromWords(words, capStyle === 'karaoke' ? 'karaoke' : capStyle, { maxChars: tall ? MAX_CHARS.tall : MAX_CHARS.wide }));
    capCount = cues.length;
    fs.writeFileSync(capFile, captionsScript(cues, { ...canvas, style: capStyle }));
  } else fs.rmSync(capFile, { force: true });

  const data = {
    voice: voices.voiceSummary || voice, total: plan.total, music: params.musicFile ? 'file' : musicStyle, captions: wantCaptions ? capStyle : false,
    scenes: plan.scenes.map((s, i) => ({ ...s, line: lines[i] })), notes: voices.notes || [],
  };
  fs.writeFileSync(path.join(dir, 'voice.json'), JSON.stringify(data, null, 2));

  const sceneLines = data.scenes.map((s, i) => `  scene ${i + 1}: data-start="${s.start}" data-duration="${s.duration}"  (voice ${s.voiceStart.toFixed(1)}–${s.voiceEnd.toFixed(1)} s)  "${s.line.length > 70 ? `${s.line.slice(0, 67)}…` : s.line}"`).join('\n');
  const paste = [
    `<audio id="audio" src="assets/audio.wav" data-start="0" data-duration="${plan.total}" data-track-index="1" data-volume="1"></audio>`,
    ...(wantCaptions ? [`<div id="captions" class="clip" data-start="0" data-duration="${plan.total}" data-track-index="2"></div>`] : []),
  ];
  return {
    ok: true,
    text: `Voice-over made (${voices.voiceSummary || voice}${musicStyle !== 'none' || params.musicFile ? `, with ${params.musicFile ? 'your' : musicStyle} music` : ', no music'}): ${audioFile}\n`
      + `TOTAL video length: ${plan.total} s. Set data-duration="${plan.total}" on the root, and give the ${lines.length} scene(s) exactly these times:\n${sceneLines}\n`
      + `Animate each scene inside its own time window (start an entrance about 0.2 s after the scene starts).\n`
      + `Paste as the LAST children of the root div:\n  ${paste.join('\n  ')}\n`
      + (wantCaptions ? `And add this line right AFTER the script that registers the timeline:\n  <script src="assets/captions.js"></script>\nCaptions (${capCount} lines, word by word) then appear at the bottom: keep your own text out of the bottom ${canvas.height > canvas.width * 1.1 ? '30%' : '20%'} of the frame.\n` : '')
      + `Then hyperframes_check.${data.notes.length ? `\nNote: ${data.notes.join('; ')}` : ''}`,
    data,
  };
}
