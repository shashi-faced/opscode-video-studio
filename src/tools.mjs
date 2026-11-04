// Agent tool handlers. Each returns { ok, text, image?, data } where `text` is what
// the model reads: short, concrete, and always says what to do next.
import fs from 'node:fs';
import path from 'node:path';
import { validateFile } from './schema/validate.mjs';
import { prepare } from './pipeline.mjs';
import { runCheck } from './qa/check.mjs';
import { render } from './render/render.mjs';
import { doctor } from './deps/doctor.mjs';
import { templatesDoc, EXAMPLE, STORY_EXAMPLE, resolveType } from './docs.mjs';
import { capture } from './render/capture.mjs';

const fmtErrors = (errs) => errs.map((e, i) => `${i + 1}. ${e.path || '(file)'}: ${e.message}${e.fix ? ` → FIX: ${e.fix}` : ''}`).join('\n');
const fmtWarn = (w) => w.length ? `\nAuto-corrected / notes:\n${w.slice(0, 12).map(x => `- ${x.path}: ${x.message}`).join('\n')}` : '';
const needFile = (p) => {
  if (!p) return { ok: false, text: 'Missing parameter "storyboard" (path to storyboard.json).' };
  if (!fs.existsSync(p)) return { ok: false, text: `File not found: ${p}. Write the storyboard with write_file first.` };
  return null;
};
const imageData = (file) => fs.existsSync(file) ? `data:image/jpeg;base64,${fs.readFileSync(file).toString('base64')}` : undefined;

export const TOOL_DEFS = [
  { name: 'video_templates', description: 'Get the storyboard reference for one kind of video: its scene recipe, templates, fields, characters, voices and a complete example. Call once before writing a storyboard.', parameters: { type: 'object', properties: { type: { type: 'string', enum: ['ad', 'demo', 'explainer', 'story', 'reel', 'howto', 'greeting', 'announcement'], description: 'kind of video: ad, demo (app walkthrough), explainer (teach an idea), story (kids story / cartoon with characters), reel (short vertical), howto (steps), greeting (festival or birthday wishes), announcement' } }, required: [] } },
  { name: 'video_validate', description: 'Validate a storyboard JSON file. Returns errors, each with an exact fix.', parameters: { type: 'object', properties: { storyboard: { type: 'string', description: 'path to storyboard.json' } }, required: ['storyboard'] } },
  { name: 'video_preview', description: 'Build the video without rendering and run layout checks. Returns problems with fixes and a contact sheet image of every scene. Run before video_render.', parameters: { type: 'object', properties: { storyboard: { type: 'string', description: 'path to storyboard.json' } }, required: ['storyboard'] } },
  { name: 'video_render', description: 'Render the final MP4 with voiceover, music and captions. Takes 1-3 minutes.', parameters: { type: 'object', properties: { storyboard: { type: 'string', description: 'path to storyboard.json' }, out: { type: 'string', description: 'optional output .mp4 path' }, fps: { type: 'number', description: 'optional, default 30' } }, required: ['storyboard'] } },
  { name: 'video_capture', description: 'Screenshot a web page or local app URL into a PNG for use in a storyboard. Optional crop in pixels.', parameters: { type: 'object', properties: { url: { type: 'string' }, out: { type: 'string', description: 'output .png path' }, width: { type: 'number' }, height: { type: 'number' }, crop: { type: 'string', description: 'x,y,w,h in pixels (optional)' }, waitMs: { type: 'number' } }, required: ['url', 'out'] } },
  { name: 'video_doctor', description: 'Check that Chrome, ffmpeg and voices work. Use install=true to download a missing browser.', parameters: { type: 'object', properties: { install: { type: 'boolean' } }, required: [] } },
];

export async function runTool(name, params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  const abs = (p) => (p ? path.resolve(cwd, String(p)) : p);
  switch (name) {
    case 'video_templates':
      return { ok: true, text: templatesDoc(params.type), data: { type: resolveType(params.type), example: resolveType(params.type) === 'story' ? STORY_EXAMPLE : EXAMPLE } };

    case 'video_validate': {
      const file = abs(params.storyboard); const miss = needFile(file); if (miss) return miss;
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
        const r = await render(file, { out: abs(params.out), fps: params.fps ? Number(params.fps) : undefined, onProgress });
        return {
          ok: true,
          text: `Video rendered: ${r.file}\n${r.width}×${r.height} ${r.format}, ${r.duration.toFixed(1)} s, ${r.sizeMB} MB, voice: ${r.voice}, music: ${r.music}. Took ${r.seconds} s.\nPoster frame: ${r.poster}\nTell the user where the file is.`,
          image: r.poster ? imageData(r.poster) : undefined,
          imageFile: r.poster || undefined,
          data: r,
        };
      } catch (e) {
        if (e.details) return { ok: false, text: `Storyboard is not valid:\n${fmtErrors(e.details.errors)}`, data: e.details };
        return { ok: false, text: `Render failed: ${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}` };
      }
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

    default:
      return { ok: false, text: `Unknown tool "${name}". Available: ${TOOL_DEFS.map(t => t.name).join(', ')}` };
  }
}
