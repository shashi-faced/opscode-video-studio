// Agent tool handlers. Each returns { ok, text, image?, data } where `text` is what
// the model reads: short, concrete, and always says what to do next.
import fs from 'node:fs';
import path from 'node:path';
import { validateFile } from './schema/validate.mjs';
import { prepare } from './pipeline.mjs';
import { runCheck } from './qa/check.mjs';
import { render } from './render/render.mjs';
import { doctor } from './deps/doctor.mjs';
import { templatesDoc, EXAMPLE, STORY_EXAMPLE, STORY_EXAMPLE_3D, resolveType } from './docs.mjs';
import { capture } from './render/capture.mjs';

// FFmpeg Editing Suite handlers
import { trimVideo } from './edit/trim.mjs';
import { concatVideos } from './edit/concat.mjs';
import { audioMix } from './edit/mixAudio.mjs';
import { reframeVideo } from './edit/reframe.mjs';
import { videoToGif } from './edit/gif.mjs';
import { inspectMedia } from './edit/ffmpegCore.mjs';
import { validateFilmFile, isFilm } from './film/film.mjs';
import { loadStoryboard } from './schema/validate.mjs';

const fmtErrors = (errs) => errs.map((e, i) => `${i + 1}. ${e.path || '(file)'}: ${e.message}${e.fix ? ` → FIX: ${e.fix}` : ''}`).join('\n');
const fmtWarn = (w) => w.length ? `\nAuto-corrected / notes:\n${w.slice(0, 12).map(x => `- ${x.path}: ${x.message}`).join('\n')}` : '';
const needFile = (p) => {
  if (!p) return { ok: false, text: 'Missing parameter "storyboard" (path to storyboard.json).' };
  if (!fs.existsSync(p)) return { ok: false, text: `File not found: ${p}. Write the storyboard with write_file first.` };
  return null;
};
const imageData = (file) => fs.existsSync(file) ? `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}` : undefined;

export const TOOL_DEFS = [
  { name: 'video_templates', description: 'Get the storyboard reference for one kind of video: its scene recipe, templates, fields, characters, voices and a complete example. Call once before writing a storyboard.', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['ad', 'demo', 'explainer', 'story', 'reel', 'howto', 'greeting', 'announcement'], description: 'kind of video: ad, demo (app walkthrough), explainer (teach an idea), story (kids story / cartoon with characters), reel (short vertical), howto (steps), greeting (festival or birthday wishes), announcement' }, platform: { type: 'string', enum: ['youtube', 'youtube-short', 'insta-reel', 'insta-post', 'insta-story', 'whatsapp-status', 'tiktok', 'square', 'linkedin'], description: 'where the video will be posted (optional)' }, look: { type: 'string', enum: ['2d', '3d'], description: '3d for a 3D cartoon (adds the 3D guide: camera, weather, props, designed characters)' } }, required: [] } },
  { name: 'video_validate', description: 'Validate a storyboard JSON file. Returns errors, each with an exact fix.', parameters: { type: 'object', properties: { storyboard: { type: 'string', description: 'path to storyboard.json' } }, required: ['storyboard'] } },
  { name: 'video_preview', description: 'Build the video without rendering and run layout checks. Returns problems with fixes and a contact sheet image of every scene. Run before video_render.', parameters: { type: 'object', properties: { storyboard: { type: 'string', description: 'path to storyboard.json' } }, required: ['storyboard'] } },
  { name: 'video_render', description: 'Render the final MP4 with voiceover, music and captions. Takes 1-3 minutes.', parameters: { type: 'object', properties: { storyboard: { type: 'string', description: 'path to storyboard.json' }, out: { type: 'string', description: 'optional output .mp4 path' }, fps: { type: 'number', description: 'optional, default 30' } }, required: ['storyboard'] } },
  { name: 'video_film_render', description: 'Render a long video (film) made of sequences of short shots: { "title", ...storyboard fields, "sequences": [ { "id", "title", "music": { "style" }, "shots": [ <scene with optional "id">, ... ] } ] }. Shots render in parallel and are cached, so changing one shot re-renders only that shot. Also accepts a normal storyboard. Can take several minutes for long films.', parameters: { type: 'object', properties: { film: { type: 'string', description: 'path to film.json (or storyboard.json)' }, workers: { type: 'number', description: 'parallel render workers (default: CPU cores - 2, max 6)' }, only: { type: 'array', items: { type: 'string' }, description: 'optional: render only these shot ids' }, force: { type: 'boolean', description: 'ignore the cache and render every shot again' }, out: { type: 'string', description: 'optional output .mp4 path' } }, required: ['film'] } },
  { name: 'video_film_status', description: 'Show a film project: sequences, shots done / failed / not rendered yet, last render. Use it to resume a long render.', parameters: { type: 'object', properties: { film: { type: 'string', description: 'path to film.json' } }, required: ['film'] } },
  { name: 'video_assets', description: 'Manage the downloadable 3D packs used by "look": "3d": characters (5.8 MB, CC0 by Quaternius) and world scenery (2.2 MB, CC0 by Kenney: furniture, trees, houses, city buildings, ships, spacecraft, food). action: list, install (download and verify), remove; optional set: 3d-starter or 3d-world (default both). Without them, 3D is built in code.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['list', 'install', 'remove'] }, set: { type: 'string', enum: ['3d-starter', '3d-world'] } }, required: ['action'] } },
  { name: 'video_character', description: 'Designed 3D characters (cast "design"). action sheet: render a turnaround sheet (front, 3/4, side, back, moods, walk) of cast member "id" from the storyboard and return it as an image to check; save: store that design in the character library so any video can use "design": "library:<id>"; list: show saved characters.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['sheet', 'save', 'list'] }, storyboard: { type: 'string' }, id: { type: 'string', description: 'cast id' } }, required: ['action'] } },
  { name: 'video_capture', description: 'Screenshot a web page or local app URL into a PNG for use in a storyboard. Optional crop in pixels.', parameters: { type: 'object', properties: { url: { type: 'string' }, out: { type: 'string', description: 'output .png path' }, width: { type: 'number' }, height: { type: 'number' }, crop: { type: 'string', description: 'x,y,w,h in pixels (optional)' }, waitMs: { type: 'number' } }, required: ['url', 'out'] } },
  { name: 'video_doctor', description: 'Check that Chrome, ffmpeg and voices work. Use install=true to download a missing browser.', parameters: { type: 'object', properties: { install: { type: 'boolean' } }, required: [] } },

  // FFmpeg Video Editing Suite tools
  {
    name: 'video_trim',
    description: 'Cut, shorten, or trim a video between start and end timestamps. Supports frame-accurate re-encoding or fast lossless cut.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'path to input video file (e.g. video/demo.mp4)' },
        start: { type: 'string', description: 'start time in seconds (e.g. 5.5) or timestamp ("00:00:05.5")' },
        end: { type: 'string', description: 'end time in seconds (e.g. 20.0) or timestamp ("00:00:20")' },
        duration: { type: 'number', description: 'optional cut duration in seconds (alternative to end)' },
        mode: { type: 'string', enum: ['exact', 'fast'], description: 'cut mode: "exact" (frame-accurate re-encode, default) or "fast" (lossless stream copy)' },
        out: { type: 'string', description: 'optional output .mp4 path' },
      },
      required: ['input'],
    },
  },
  {
    name: 'video_concat',
    description: 'Merge or splice multiple video clips sequentially into a single video file. Normalizes resolutions and audio tracks automatically.',
    parameters: {
      type: 'object',
      properties: {
        inputs: {
          type: 'array',
          items: { type: 'string' },
          description: 'ordered list of video file paths to merge',
        },
        mode: { type: 'string', enum: ['auto', 'copy', 'reencode'], description: 'concat mode: "auto" (default), "copy" (lossless if formats match), or "reencode"' },
        out: { type: 'string', description: 'optional output .mp4 path' },
      },
      required: ['inputs'],
    },
  },
  {
    name: 'video_audio_mix',
    description: 'Mix background music (BGM) with video narration, replace audio track, or adjust volume balance.',
    parameters: {
      type: 'object',
      properties: {
        video: { type: 'string', description: 'path to video file' },
        audio: { type: 'string', description: 'path to audio/music file (MP3, WAV, AAC, M4A)' },
        mode: { type: 'string', enum: ['mix', 'replace'], description: '"mix" overlays audio onto existing video audio (default); "replace" swaps audio entirely' },
        audioVolume: { type: 'number', description: 'volume factor for added audio track (0.0 to 2.0, default 0.3 for BGM)' },
        originalVolume: { type: 'number', description: 'volume factor for original video audio (default 1.0)' },
        loopAudio: { type: 'boolean', description: 'loop audio to cover entire video length if audio is shorter (default true)' },
        out: { type: 'string', description: 'optional output .mp4 path' },
      },
      required: ['video', 'audio'],
    },
  },
  {
    name: 'video_reframe',
    description: 'Change video aspect ratio between landscape 16:9, vertical 9:16 (Instagram Reel / YouTube Shorts / TikTok), and 1:1 Square. Uses smart blurred background padding, center crop, or letterbox.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'path to input video file' },
        format: { type: 'string', enum: ['9:16', '16:9', '1:1', '4:5'], description: 'target aspect ratio: "9:16" (Reels/Shorts), "16:9" (YouTube/landscape), "1:1" (Square), "4:5" (Portrait feed)' },
        style: { type: 'string', enum: ['blur_pad', 'crop', 'fit'], description: 'reframing style: "blur_pad" (blurred zoomed video background, default), "crop" (center-crop to fill), "fit" (letterboxed with black padding)' },
        out: { type: 'string', description: 'optional output .mp4 path' },
      },
      required: ['input', 'format'],
    },
  },
  {
    name: 'video_inspect',
    description: 'Inspect a video or audio file and return detailed metadata: duration, resolution, fps, bitrate, audio channels, codecs, and size.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'path to video or audio file to inspect' },
      },
      required: ['input'],
    },
  },
  {
    name: 'video_to_gif',
    description: 'Convert a video or trimmed segment into a high-quality animated GIF with 256-color palette optimization.',
    parameters: {
      type: 'object',
      properties: {
        input: { type: 'string', description: 'path to input video file' },
        start: { type: 'string', description: 'start time in seconds or timestamp (default 0)' },
        duration: { type: 'number', description: 'GIF duration in seconds (default 5, max 30)' },
        fps: { type: 'number', description: 'frames per second (default 15, max 30)' },
        width: { type: 'number', description: 'max pixel width (default 480)' },
        out: { type: 'string', description: 'optional output .gif path' },
      },
      required: ['input'],
    },
  },
];

/** Speed of a render, and a hint when 3D could not use the graphics card. */
export function speedText(r) {
  if (!r.has3d) return '';
  return r.gpu
    ? `\n3D speed: ${r.renderFps} frames/s on the graphics card (GPU), ${r.workers} worker(s).`
    : `\n3D speed: ${r.renderFps} frames/s on the CPU (no GPU found; 3D drawn at 2/3 resolution). Tell the user: rendering is faster with working graphics drivers (run video_doctor).`;
}

function extrasText(x = {}) {
  const out = [];
  if (x.thumbnail) out.push(`YouTube thumbnail: ${x.thumbnail}`);
  if (x.description) out.push(`Title/description${x.chapters ? ` with ${x.chapters} chapters` : ''}: ${x.description}`);
  if (x.cover) out.push(`Cover image: ${x.cover}`);
  if (x.coverGrid) out.push(`Profile-grid cover (3:4): ${x.coverGrid}`);
  if (x.parts?.length) out.push(`Split into ${x.parts.length} parts for WhatsApp status: ${x.parts.join(', ')}`);
  if (x.error) out.push(x.error);
  return out.length ? '\n' + out.join('\n') : '';
}

export async function runTool(name, params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  const abs = (p) => (p ? path.resolve(cwd, String(p)) : p);
  switch (name) {
    case 'video_templates':
      return { ok: true, text: templatesDoc(params.type, params.platform, params.look), data: { type: resolveType(params.type), example: resolveType(params.type) === 'story' ? (/3d|cgi|pixar/i.test(String(params.look || '')) ? STORY_EXAMPLE_3D : STORY_EXAMPLE) : EXAMPLE } };

    case 'video_validate': {
      const file = abs(params.storyboard); const miss = needFile(file); if (miss) return miss;
      let raw = null; try { raw = loadStoryboard(file); } catch { /* reported by validateFile */ }
      if (isFilm(raw)) {
        const f = validateFilmFile(file);
        if (f.ok) return { ok: true, text: `Film is valid: ${f.sequences.length} sequence(s), ${f.shots.length} shot(s). Next: call video_film_render.${fmtWarn(f.warnings)}`, data: { warnings: f.warnings, sequences: f.sequences } };
        return { ok: false, text: `Film has ${f.errors.length} error(s). Fix each one, then call video_validate again:\n${fmtErrors(f.errors)}${fmtWarn(f.warnings)}`, data: { errors: f.errors, warnings: f.warnings } };
      }
      const v = validateFile(file);
      if (v.ok) return { ok: true, text: `Storyboard is valid (${v.storyboard.scenes.length} scenes, format ${v.storyboard.format}). Next: call video_preview.${fmtWarn(v.warnings)}`, data: { warnings: v.warnings } };
      return { ok: false, text: `Storyboard has ${v.errors.length} error(s). Fix each one with edit_file, then call video_validate again:\n${fmtErrors(v.errors)}${fmtWarn(v.warnings)}`, data: { errors: v.errors, warnings: v.warnings } };
    }

    case 'video_preview': {
      const file = abs(params.storyboard); const miss = needFile(file); if (miss) return miss;
      let p;
      try { p = await prepare(file, { voice: 'skip', onProgress }); }
      catch (e) { if (e.details) return { ok: false, text: `Storyboard is not valid yet:\n${fmtErrors(e.details.errors)}`, data: e.details }; throw e; }
      const r = await runCheck({ build: p.build, storyboard: p.storyboard, outDir: p.outDir });
      const lines = r.issues.map((i, k) => `${k + 1}. [${i.severity}] scene ${i.scene} (${i.template}): ${i.message} → FIX: ${i.fix}`);
      const head = r.errors ? `Found ${r.errors} layout error(s) and ${r.warnings} warning(s). Fix the errors, then call video_preview again.`
        : r.warnings ? `No layout errors. ${r.warnings} warning(s) you may fix. When happy, call video_render.`
        : 'Layout looks clean. Next: call video_render.';
      return {
        ok: r.ok,
        text: `${head}\nEstimated length: ${Math.round(r.duration)} s (final length follows the voice).\nPreview page: ${p.build.file}\nContact sheet: ${r.contactSheet}${lines.length ? '\n' + lines.join('\n') : ''}`,
        image: imageData(r.contactSheet),
        imageFile: r.contactSheet,
        data: { issues: r.issues, contactSheet: r.contactSheet, preview: p.build.file },
      };
    }

    case 'video_render': {
      const file = abs(params.storyboard); const miss = needFile(file); if (miss) return miss;
      try {
        const r = await render(file, { out: abs(params.out), fps: params.fps ? Number(params.fps) : undefined, workers: params.workers ? Number(params.workers) : undefined, onProgress });
        return {
          ok: true,
          text: `Video rendered: ${r.file}\n${r.width}×${r.height} ${r.format}${r.platform ? ` for ${r.platform}` : ''}, ${r.duration.toFixed(1)} s, ${r.sizeMB} MB, voice: ${r.voice}, music: ${r.music}, captions: ${r.captions}. Took ${r.seconds} s.${speedText(r)}\nPoster frame: ${r.poster}${extrasText(r.extras)}${r.lengthNote ? `\nNote: ${r.lengthNote}` : ''}\nTell the user where the file is${r.extras && Object.keys(r.extras).length ? ' and list the extra files' : ''}.`,
          image: r.poster ? imageData(r.poster) : undefined,
          imageFile: r.poster || undefined,
          data: r,
        };
      } catch (e) {
        if (e.details) return { ok: false, text: `Storyboard is not valid:\n${fmtErrors(e.details.errors)}`, data: e.details };
        return { ok: false, text: `Render failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}` };
      }
    }

    case 'video_film_render': {
      const file = abs(params.film || params.storyboard); const miss = needFile(file); if (miss) return miss;
      try {
        const { renderFilm } = await import('./film/renderFilm.mjs');
        const r = await renderFilm(file, { out: abs(params.out), workers: params.workers ? Number(params.workers) : undefined, only: params.only, force: !!params.force, onProgress });
        if (!r.ok) return { ok: false, text: `Film not finished: ${r.error}.\n${r.failures.map(f => `- shot ${f.shot}: ${f.error}`).join('\n')}${r.notRendered.length ? `\nNot rendered: ${r.notRendered.join(', ')}` : ''}\nFIX: ${r.fix}`, data: r };
        const mins = (s) => (s >= 60 ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : `${Math.round(s)} s`);
        return {
          ok: true,
          text: `Film rendered: ${r.file}\n${r.width}×${r.height}, ${mins(r.duration)}, ${r.sequences} sequence(s), ${r.shots} shots (${r.rendered} rendered, ${r.cached} reused), ${r.workers} workers, ${r.sizeMB} MB. Took ${mins(r.seconds)}.${r.srt ? `\nCaptions: ${r.srt}` : ''}${r.chapters ? `\nChapters: ${r.chapters}` : ''}\nProject folder: ${r.project}\nTell the user where the file is.`,
          image: r.poster ? imageData(r.poster) : undefined,
          imageFile: r.poster || undefined,
          data: r,
        };
      } catch (e) {
        if (e.details) return { ok: false, text: `Film is not valid:\n${fmtErrors(e.details.errors)}`, data: e.details };
        return { ok: false, text: `Film render failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}` };
      }
    }

    case 'video_film_status': {
      const file = abs(params.film || params.storyboard); const miss = needFile(file); if (miss) return miss;
      const { filmStatus } = await import('./film/renderFilm.mjs');
      const s = filmStatus(file);
      if (!s.project) return { ok: false, text: `Film is not valid:\n${fmtErrors(s.errors)}`, data: s };
      const failed = s.rows.filter(r => r.status === 'failed').map(r => `- ${r.id}: ${r.error}`);
      return { ok: true, text: `"${s.title}": ${s.shots} shots in ${s.sequences.length} sequence(s). Done ${s.done}, failed ${s.failed}, waiting ${s.queued}, never rendered ${s.new}.${s.lastRender ? `\nLast film: ${s.lastRender.file} (${Math.round(s.lastRender.duration)} s)` : ''}${failed.length ? `\nFailed:\n${failed.join('\n')}` : ''}\nCall video_film_render to finish (finished shots are reused).`, data: s };
    }

    case 'video_assets': {
      const { assetStatus, installAssets, removeAssets, SETS } = await import('./assets/assets.mjs');
      const act = params.action || 'list';
      const sets = params.set && SETS[params.set] ? [params.set] : Object.keys(SETS);
      const parts = [];
      let ok = true;
      const data = {};
      for (const set of sets) {
        const st = act === 'install' ? await installAssets(set, { onProgress }) : act === 'remove' ? removeAssets(set) : assetStatus(set);
        data[set] = st;
        if (st.failed?.length) ok = false;
        const lines = set === '3d-starter' ? st.models.map(m => `  ${m.installed ? '✓' : '·'} ${m.kind}: ${m.name} (${m.sizeKB} KB)`) : [`  ${st.models.filter(m => m.installed).length} props: ${st.models.map(m => m.name).join(', ')}`];
        parts.push(`${st.title}: ${st.installed}/${st.total} installed (${st.sizeMB} MB)\n${lines.join('\n')}${st.failed?.length ? `\n  Failed: ${st.failed.map(f => `${f.kind || f.name}: ${f.error}`).join('; ')}` : ''}\n  Credit: ${st.credit}`);
      }
      return { ok, text: `${parts.join('\n')}\nFolder: ${Object.values(data)[0].dir}\n${act === 'list' ? 'Run with action "install" to download (one time). Without them, 3D characters and places are built in code.' : 'Installed packs are used automatically in 3D videos.'}`, data };
    }

    case 'video_character': {
      const act = params.action || 'list';
      if (act === 'list') {
        const { listLibrary, LIBRARY_DIR } = await import('./characters/library.mjs');
        const all = listLibrary();
        return { ok: true, text: all.length ? `${all.length} saved character(s) in ${LIBRARY_DIR}:\n${all.map(c => `- ${c.id}: ${c.name} (${c.design?.plan || c.kind})`).join('\n')}\nUse one with "design": "library:<id>" in a cast entry.` : 'No saved characters yet. Design one in "cast" (design), check it with action sheet, then action save.', data: all };
      }
      const file = abs(params.storyboard); const miss = needFile(file); if (miss) return miss;
      if (!params.id) return { ok: false, text: 'Missing "id" (the cast id of the character).' };
      if (act === 'save') {
        const v = validateFile(file);
        const entry = (v.storyboard?.cast || []).find(c => c.id === String(params.id).toLowerCase());
        if (!entry || !entry.design) return { ok: false, text: `Cast member "${params.id}" has no "design" to save.` };
        const { saveLibraryCharacter, LIBRARY_DIR } = await import('./characters/library.mjs');
        const rec = saveLibraryCharacter(entry);
        // Thumbnail for galleries: the front view of the turnaround sheet (rendered now if there is none).
        try {
          let sheet = path.join(path.dirname(file), 'out', `character-${entry.id}.png`);
          if (!fs.existsSync(sheet)) { const { characterSheet } = await import('./characters/sheet.mjs'); sheet = (await characterSheet(file, entry.id)).file; }
          const { findFfmpeg } = await import('./deps/locate.mjs');
          const { execFileSync } = await import('node:child_process');
          execFileSync(findFfmpeg(), ['-y', '-loglevel', 'error', '-i', sheet, '-vf', 'crop=360:360:0:0,scale=192:192', '-q:v', '4', path.join(LIBRARY_DIR, `${rec.id}.jpg`)]);
        } catch { /* the character is saved; only the picture is missing */ }
        return { ok: true, text: `Saved "${rec.name}" to the character library (${rec.file}). Any video can now use: { "id": "${rec.id}", "design": "library:${rec.id}" }.`, data: rec };
      }
      try {
        const { characterSheet } = await import('./characters/sheet.mjs');
        const r = await characterSheet(file, params.id, { out: abs(params.out) });
        return { ok: true, text: `Character sheet for ${r.name}: ${r.file} (${r.views.join(', ')}). Check it: does it look like the description? If not, change the design fields and run sheet again. When it is right, run action save.`, image: `data:image/png;base64,${fs.readFileSync(r.file).toString('base64')}`, imageFile: r.file, data: r };
      } catch (e) { return { ok: false, text: `Character sheet failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}` }; }
    }

    case 'video_capture': {
      try {
        const r = await capture({ url: String(params.url), out: abs(params.out), width: params.width, height: params.height, crop: params.crop, waitMs: params.waitMs });
        return { ok: true, text: `Saved ${r.out} (${r.width}×${r.height}). Use it as "image" in a scene (path relative to the storyboard).`, image: `data:image/png;base64,${fs.readFileSync(r.out).toString('base64')}`, imageFile: r.out, data: r };
      } catch (e) { return { ok: false, text: `Capture failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}` }; }
    }

    case 'video_doctor': {
      const r = await doctor({ install: !!params.install });
      const lines = r.items.map(i => `${i.ok ? '✓' : '✗'} ${i.name}: ${i.detail}${i.fix ? ` → ${i.fix}` : ''}`);
      return { ok: r.ok, text: `${r.ok ? 'Ready to make videos.' : 'Something is missing.'}\n${lines.join('\n')}`, data: r };
    }

    // FFmpeg Editing Suite Tool Cases
    case 'video_trim': {
      try {
        const r = await trimVideo(params, { cwd, onProgress });
        return {
          ok: true,
          videoFile: r.file,
          text: `Video trimmed successfully: ${r.file}\nDuration: ${r.duration.toFixed(1)} s (${r.formattedDuration}), ${r.width}×${r.height}, ${r.sizeMB} MB (mode: ${r.mode}, cut from ${r.start}s to ${r.end}s).`,
          image: r.poster ? imageData(r.poster) : undefined,
          imageFile: r.poster,
          data: r,
        };
      } catch (e) {
        return { ok: false, text: `Trim failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}`, data: { error: e.message } };
      }
    }

    case 'video_concat': {
      try {
        const r = await concatVideos(params, { cwd, onProgress });
        return {
          ok: true,
          videoFile: r.file,
          text: `Merged ${r.clipsCount} clips into: ${r.file}\nTotal duration: ${r.duration.toFixed(1)} s (${r.formattedDuration}), ${r.width}×${r.height}, ${r.sizeMB} MB.`,
          image: r.poster ? imageData(r.poster) : undefined,
          imageFile: r.poster,
          data: r,
        };
      } catch (e) {
        return { ok: false, text: `Concat failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}`, data: { error: e.message } };
      }
    }

    case 'video_audio_mix': {
      try {
        const r = await audioMix(params, { cwd, onProgress });
        return {
          ok: true,
          videoFile: r.file,
          text: `Audio ${r.mode} successful: ${r.file}\nDuration: ${r.duration.toFixed(1)} s, ${r.width}×${r.height}, ${r.sizeMB} MB (audio vol: ${r.audioVolume}, original vol: ${r.originalVolume}).`,
          image: r.poster ? imageData(r.poster) : undefined,
          imageFile: r.poster,
          data: r,
        };
      } catch (e) {
        return { ok: false, text: `Audio mix failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}`, data: { error: e.message } };
      }
    }

    case 'video_reframe': {
      try {
        const r = await reframeVideo(params, { cwd, onProgress });
        return {
          ok: true,
          videoFile: r.file,
          text: `Video reframed to ${r.format} (${r.formatDescription}): ${r.file}\nResolution: ${r.width}×${r.height}, style: ${r.style}, duration: ${r.duration.toFixed(1)} s, ${r.sizeMB} MB.`,
          image: r.poster ? imageData(r.poster) : undefined,
          imageFile: r.poster,
          data: r,
        };
      } catch (e) {
        return { ok: false, text: `Reframe failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}`, data: { error: e.message } };
      }
    }

    case 'video_inspect': {
      try {
        const r = await inspectMedia(params.input, { cwd });
        const summary = [
          `File: ${r.file} (${r.sizeMB} MB)`,
          `Duration: ${r.formattedDuration} (${r.duration} s)`,
          r.hasVideo ? `Video: ${r.width}×${r.height} (${r.aspectRatio}), ${r.fps} fps, codec: ${r.videoCodec}` : 'Video: None',
          r.hasAudio ? `Audio: codec ${r.audioCodec}` : 'Audio: None',
          r.bitrateKbps ? `Bitrate: ${r.bitrateKbps} kbps` : '',
        ].filter(Boolean).join('\n');
        return {
          ok: true,
          text: summary,
          data: r,
        };
      } catch (e) {
        return { ok: false, text: `Inspect failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}`, data: { error: e.message } };
      }
    }

    case 'video_to_gif': {
      try {
        const r = await videoToGif(params, { cwd, onProgress });
        return {
          ok: true,
          text: `Animated GIF created: ${r.file}\nWidth: ${r.width}px, ${r.fps} fps, length: ${r.duration}s, size: ${r.sizeMB} MB.`,
          image: `data:image/gif;base64,${fs.readFileSync(r.file).toString('base64')}`,
          imageFile: r.file,
          data: r,
        };
      } catch (e) {
        return { ok: false, text: `GIF creation failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}`, data: { error: e.message } };
      }
    }

    default:
      return { ok: false, text: `Unknown tool "${name}". Available: ${TOOL_DEFS.map(t => t.name).join(', ')}` };
  }
}
