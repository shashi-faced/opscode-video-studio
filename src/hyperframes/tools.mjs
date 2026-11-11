// HyperFrames tools (plan 16): write a video as an HTML page, check it, look at frames, render it.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { findFfmpeg } from '../deps/locate.mjs';
import { hf, installRuntime, runtimeStatus, gsapFile, HF_VERSION } from './runtime.mjs';
import { guideText, starterHtml, resolveFormat, FORMATS, PROJECT_FONTS, FONTS_CSS, FONTS_LINK } from './guide.mjs';
import { hfVoice } from './voice.mjs';

const FONT_SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'fonts');

export const HF_TOOL_DEFS = [
  { name: 'hyperframes_guide', description: 'How to make a motion-design video with HyperFrames (a web page rendered to video): the rules and a complete starter. Call first. For characters, stories, 3D or stickman videos use video_templates instead. With "search", finds ready-made blocks (charts, kinetic titles, transitions).', parameters: { type: 'object', properties: { format: { type: 'string', enum: ['9:16', '16:9', '1:1'], description: 'video shape (default 9:16)' }, search: { type: 'string', description: 'find ready-made blocks by keyword, e.g. "chart", "kinetic", "transition"' }, topic: { type: 'string', enum: ['data-attributes', 'gsap', 'compositions', 'rendering'], description: 'extra reference on one topic' } }, required: [] } },
  { name: 'hyperframes_project', description: 'Create or change a HyperFrames project folder. init: makes the folder with a working starter index.html (the first use installs the HyperFrames engine once, about 200 MB). add: installs ready-made blocks as editable files and returns the snippet to paste. info: length and size of the composition.', parameters: { type: 'object', properties: { action: { type: 'string', enum: ['init', 'add', 'info'] }, dir: { type: 'string', description: 'project folder, relative to the workspace, e.g. "videos/launch"' }, format: { type: 'string', enum: ['9:16', '16:9', '1:1'], description: 'init only (default 9:16)' }, blocks: { type: 'array', items: { type: 'string' }, description: 'add only: block names from hyperframes_guide search' } }, required: ['action', 'dir'] } },
  { name: 'hyperframes_voice', description: 'Make the voice-over (and background music and word-by-word captions) for a HyperFrames project with Video Studio\'s voices, including Hindi. Give one spoken line per scene. Returns the exact start and length of every scene: build the page to those times. Call after init and before writing index.html.', parameters: { type: 'object', properties: { dir: { type: 'string', description: 'project folder' }, lines: { type: 'array', items: { type: 'string' }, description: 'what to say, one short sentence per scene, in the video\'s language' }, language: { type: 'string', description: 'hi or en (default: from the text)' }, voice: { type: 'string', description: 'optional voice id, e.g. hi-IN-MadhurNeural (male Hindi), en-IN-PrabhatNeural' }, music: { type: 'string', enum: ['ambient', 'corporate-upbeat', 'indian-electronic', 'playful', 'festive', 'none'], description: 'generated background music (default ambient)' }, musicFile: { type: 'string', description: 'your own music WAV file instead' }, musicVolume: { type: 'number', description: '0 to 1 (default 0.35)' }, captions: { type: 'string', enum: ['karaoke', 'line', 'pop', 'none'], description: 'karaoke = the spoken word lights up (default); line = plain lines; pop = 1-3 big words; none' } }, required: ['dir', 'lines'] } },
  { name: 'hyperframes_check', description: 'Check a HyperFrames project: structure, script errors, missing files, text cut off or overlapping, contrast. Returns each error with what to fix. Always run after editing index.html and before rendering.', parameters: { type: 'object', properties: { dir: { type: 'string', description: 'project folder' } }, required: ['dir'] } },
  { name: 'hyperframes_preview', description: 'Frames of the HyperFrames video at chosen seconds, as one image, to look at before rendering.', parameters: { type: 'object', properties: { dir: { type: 'string', description: 'project folder' }, at: { type: 'array', items: { type: 'number' }, description: 'times in seconds (up to 6); default: evenly spread' } }, required: ['dir'] } },
  { name: 'hyperframes_render', description: 'Render a HyperFrames project to a video file. Runs the check first and stops if it has errors.', parameters: { type: 'object', properties: { dir: { type: 'string', description: 'project folder' }, out: { type: 'string', description: 'output file (default <dir>/<name>.mp4)' }, quality: { type: 'string', enum: ['draft', 'standard', 'high'], description: 'draft is fastest; default standard' }, fps: { type: 'number', description: '24, 25, 30 (default) or 60' }, format: { type: 'string', enum: ['mp4', 'webm', 'gif'], description: 'default mp4' } }, required: ['dir'] } },
];

export const isHfTool = (name) => HF_TOOL_DEFS.some((t) => t.name === name);

/** Findings that are about HyperFrames' own studio conventions, not about the video being wrong. */
const IGNORED = new Set(['nested_structure_needs_subcomposition', 'audio_none']);
const SECTIONS = ['lint', 'runtime', 'layout', 'motion', 'contrast', 'craft', 'audio'];

/** A check result → { errors, warnings }, each { code, message, where }. Exported for tests. */
export function readCheck(json) {
  const errors = [], warnings = [];
  for (const sec of SECTIONS) {
    for (const f of json?.[sec]?.findings || []) {
      if (IGNORED.has(f.code)) continue;
      const item = { code: String(f.code || sec), message: String(f.message || '').replace(/\s+/g, ' ').slice(0, 400), where: [f.selector, Number.isFinite(f.time) && f.time > 0 ? `at ${f.time}s` : ''].filter(Boolean).join(' '), fix: f.fix || f.hint || undefined };
      (f.severity === 'error' ? errors : f.severity === 'warning' ? warnings : []).push(item);
    }
  }
  return { errors, warnings };
}

const fmt = (list) => list.map((f, i) => `${i + 1}. [${f.code}]${f.where ? ` ${f.where}:` : ''} ${f.message}${f.fix ? ` FIX: ${f.fix}` : ''}`).join('\n');

/** Problems we can see in the file before running anything (things the engine tolerates but we do not want). */
export function ownFindings(html) {
  const out = [];
  if (/<script[^>]+src=["']https?:/i.test(html)) out.push({ code: 'remote_script', message: 'a script is loaded from the internet', where: '<head>', fix: 'use exactly <script src="assets/gsap.min.js"></script> and no other script files' });
  if (/<link[^>]+href=["']https?:|@import\s+url\(["']?https?:/i.test(html)) out.push({ code: 'remote_style', message: 'a stylesheet or font is loaded from the internet', where: '<head>', fix: `remove it; keep ${FONTS_LINK} and use font-family "Poppins" or "Hind"` });
  if (!/assets\/fonts\.css/.test(html) && !/@font-face/.test(html)) out.push({ code: 'fonts_not_loaded', message: 'the page does not load the project fonts, so text (and all Hindi) would fall back to a wrong font', where: '<head>', fix: `add this line in the head: ${FONTS_LINK}  and use only font-family "Poppins" or "Hind"` });
  if (/\b(setTimeout|setInterval|requestAnimationFrame)\s*\(|Math\.random\s*\(|new Date\s*\(|Date\.now\s*\(/.test(html)) out.push({ code: 'not_deterministic', message: 'the page uses timers, Date or Math.random, so frames would differ between renders', where: 'script', fix: 'animate only with the GSAP timeline (tl.to / tl.from / tl.fromTo at absolute times)' });
  return out;
}

function project(cwd, dir) {
  if (!dir) return { err: { ok: false, text: 'Give "dir": the project folder, e.g. "videos/launch".' } };
  const abs = path.resolve(cwd, String(dir));
  return { abs, index: path.join(abs, 'index.html') };
}
const needIndex = (p) => (fs.existsSync(p.index) ? null : { ok: false, text: `No HyperFrames project at ${p.abs} (index.html is missing). Create it with hyperframes_project { action: "init", dir }.` });

async function check(p) {
  const html = fs.readFileSync(p.index, 'utf8');
  const own = ownFindings(html);
  const r = await hf(['check', '--json'], { cwd: p.abs, timeoutMs: 180000 });
  if (!r.json) return { ok: false, errors: [...own, { code: 'check_failed', message: (r.stderr || r.stdout || 'the checker gave no result').replace(/\s+/g, ' ').slice(-400), where: '' }], warnings: [] };
  const { errors, warnings } = readCheck(r.json);
  return { ok: errors.length + own.length === 0, errors: [...own, ...errors], warnings, duration: r.json.layout?.duration };
}

function contactSheet(frames, out) {
  const ff = findFfmpeg();
  const n = frames.length;
  const args = ['-y', '-v', 'error'];
  for (const f of frames) args.push('-i', f);
  const scaled = frames.map((_, i) => `[${i}:v]scale=-2:540[v${i}]`).join(';');
  args.push('-filter_complex', n === 1 ? '[0:v]scale=-2:540[o]' : `${scaled};${frames.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${n}[o]`, '-map', '[o]', '-frames:v', '1', '-q:v', '4', out);
  execFileSync(ff, args);
  return out;
}

export async function runHfTool(name, params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  try {
    switch (name) {
      case 'hyperframes_guide': {
        if (params.search) {
          const st = runtimeStatus();
          if (!st.installed) return { ok: true, text: `${guideText(params.format)}\n\n(Block search works after the first hyperframes_project init, which installs the engine.)` };
          const r = await hf(['catalog', '--json'], { cwd, timeoutMs: 60000 });
          const items = Array.isArray(r.json) ? r.json : r.json?.items || [];
          const q = String(params.search).toLowerCase().split(/\s+/).filter(Boolean);
          const hits = items.map((it) => ({ it, text: `${it.name} ${it.title || ''} ${it.description || ''} ${(it.tags || []).join(' ')}`.toLowerCase() }))
            .filter((x) => q.every((w) => x.text.includes(w))).slice(0, 12).map((x) => x.it);
          if (!hits.length) return { ok: true, text: `No ready-made block matches "${params.search}" (${items.length} in the catalog). Try one word, e.g. chart, title, transition, caption, map, logo. Or build it yourself with divs and the timeline.`, data: { hits: [] } };
          return { ok: true, text: `Blocks matching "${params.search}":\n${hits.map((h) => `- ${h.name} (${String(h.type || '').replace('hyperframes:', '')}): ${String(h.description || h.title || '').slice(0, 160)}`).join('\n')}\nInstall with hyperframes_project { action: "add", dir, blocks: ["name"] }; it returns the snippet to paste into index.html.`, data: { hits: hits.map((h) => h.name) } };
        }
        if (params.topic) {
          if (!runtimeStatus().installed) return { ok: true, text: guideText(params.format) };
          const r = await hf(['docs', String(params.topic)], { cwd, timeoutMs: 30000 });
          return { ok: r.code === 0, text: (r.stdout || r.stderr).trim().slice(0, 6000) };
        }
        return { ok: true, text: guideText(params.format), data: { format: resolveFormat(params.format) } };
      }

      case 'hyperframes_project': {
        const p = project(cwd, params.dir); if (p.err) return p.err;
        const action = params.action || 'init';
        if (action === 'init') {
          const st = await installRuntime({ onProgress });
          if (fs.existsSync(p.index)) return { ok: false, text: `${p.abs} already has an index.html. Edit it, or choose another folder.` };
          const format = resolveFormat(params.format);
          fs.mkdirSync(path.join(p.abs, 'assets'), { recursive: true });
          // HyperFrames' own scaffold gives the project files it expects; then our starter replaces its page.
          const tmpName = `.hf-init-${process.pid}`;
          const r = await hf(['init', tmpName, '--example', 'blank', '--non-interactive', '--skip-skills', '--resolution', FORMATS[format].resolution], { cwd: p.abs, timeoutMs: 120000 });
          const tmp = path.join(p.abs, tmpName);
          if (r.code !== 0 || !fs.existsSync(path.join(tmp, 'hyperframes.json'))) { fs.rmSync(tmp, { recursive: true, force: true }); return { ok: false, text: `Could not create the project: ${(r.stderr || r.stdout).replace(/\s+/g, ' ').slice(-300)}` }; }
          for (const f of ['hyperframes.json', 'meta.json']) fs.copyFileSync(path.join(tmp, f), path.join(p.abs, f));
          fs.rmSync(tmp, { recursive: true, force: true });
          try { const meta = JSON.parse(fs.readFileSync(path.join(p.abs, 'meta.json'), 'utf8')); meta.name = path.basename(p.abs); meta.id = path.basename(p.abs); fs.writeFileSync(path.join(p.abs, 'meta.json'), JSON.stringify(meta, null, 2)); } catch { /* keep the scaffold's */ }
          fs.copyFileSync(gsapFile(), path.join(p.abs, 'assets', 'gsap.min.js'));
          fs.mkdirSync(path.join(p.abs, 'assets', 'fonts'), { recursive: true });
          for (const f of PROJECT_FONTS) fs.copyFileSync(path.join(FONT_SRC, f.file), path.join(p.abs, 'assets', 'fonts', f.file));
          fs.writeFileSync(path.join(p.abs, 'assets', 'fonts.css'), FONTS_CSS);
          fs.writeFileSync(p.index, starterHtml(format));
          return { ok: true, text: `Project created: ${p.abs} (${format}, ${FORMATS[format].w}x${FORMATS[format].h}).${st.already ? '' : ` HyperFrames engine ${HF_VERSION} installed (${st.sizeMB} MB).`}\nNext: rewrite ${p.index} for this video (keep the structure of the starter), then hyperframes_check.`, data: { dir: p.abs, index: p.index, format } };
        }
        const miss = needIndex(p); if (miss) return miss;
        if (action === 'add') {
          const blocks = (Array.isArray(params.blocks) ? params.blocks : [params.blocks]).filter(Boolean).map(String).slice(0, 6);
          if (!blocks.length) return { ok: false, text: 'Give "blocks": names from hyperframes_guide { search }.' };
          const lines = []; let ok = true;
          for (const b of blocks) {
            if (!/^[a-z0-9][a-z0-9-]*$/i.test(b)) { ok = false; lines.push(`✗ ${b}: not a block name`); continue; }
            const r = await hf(['add', b, '--json'], { cwd: p.abs, timeoutMs: 60000 });
            if (r.json?.ok) lines.push(`✓ ${b}: ${(r.json.written || []).map((f) => path.relative(p.abs, f)).join(', ')}\n  paste inside root (set data-start, and data-duration if you want it shorter): ${r.json.snippet}`);
            else { ok = false; lines.push(`✗ ${b}: ${String(r.json?.error?.message || r.stderr || 'not found').replace(/\s+/g, ' ').slice(0, 200)}`); }
          }
          return { ok, text: lines.join('\n') };
        }
        if (action === 'info') {
          const r = await hf(['info', '--json'], { cwd: p.abs, timeoutMs: 60000 });
          if (!r.json) return { ok: false, text: `Could not read the project: ${(r.stderr || r.stdout).replace(/\s+/g, ' ').slice(-300)}` };
          return { ok: true, text: `${r.json.name}: ${r.json.width}x${r.json.height}, ${r.json.duration} s, ${r.json.elements} element(s) on ${r.json.tracks} track(s).`, data: r.json };
        }
        return { ok: false, text: 'action must be "init", "add" or "info".' };
      }

      case 'hyperframes_voice':
        return await hfVoice(params, { cwd, onProgress });

      case 'hyperframes_check': {
        const p = project(cwd, params.dir); if (p.err) return p.err;
        const miss = needIndex(p); if (miss) return miss;
        const c = await check(p);
        const warn = c.warnings.length ? `\nWorth improving (not blocking):\n${fmt(c.warnings.slice(0, 5))}` : '';
        if (c.ok) return { ok: true, text: `The composition is valid${c.duration ? ` (${c.duration} s)` : ''}. Next: hyperframes_preview to look at frames, then hyperframes_render.${warn}`, data: { warnings: c.warnings } };
        return { ok: false, text: `The composition has ${c.errors.length} error(s). Fix each one in ${p.index} with edit_file, then call hyperframes_check again:\n${fmt(c.errors.slice(0, 15))}${warn}`, data: { errors: c.errors, warnings: c.warnings } };
      }

      case 'hyperframes_preview': {
        const p = project(cwd, params.dir); if (p.err) return p.err;
        const miss = needIndex(p); if (miss) return miss;
        let at = (Array.isArray(params.at) ? params.at : []).map(Number).filter((n) => Number.isFinite(n) && n >= 0).slice(0, 6);
        if (!at.length) {
          const info = await hf(['info', '--json'], { cwd: p.abs, timeoutMs: 60000 });
          const d = Number(info.json?.duration) || 8;
          at = [0.1, 0.3, 0.5, 0.7, 0.9].map((k) => Math.round(d * k * 10) / 10);
        }
        const r = await hf(['snapshot', '--at', at.join(','), '--json'], { cwd: p.abs, timeoutMs: 180000 });
        const frames = (r.json?.frames || []).map((f) => f.path).filter((f) => f && fs.existsSync(f));
        if (!frames.length) return { ok: false, text: `Could not draw the frames: ${String(r.json?.error?.message || r.stderr || r.stdout).replace(/\s+/g, ' ').slice(-300)}\nRun hyperframes_check and fix its errors first.` };
        const sheet = contactSheet(frames, path.join(p.abs, 'preview.jpg'));
        return { ok: true, text: `Frames at ${at.map((t) => `${t}s`).join(', ')} (left to right): ${sheet}\nLook at them: is all text readable and inside the frame, nothing overlapping, the look right? If not, edit index.html and check again.`, image: `data:image/jpeg;base64,${fs.readFileSync(sheet).toString('base64')}`, imageFile: sheet, data: { at, sheet } };
      }

      case 'hyperframes_render': {
        const p = project(cwd, params.dir); if (p.err) return p.err;
        const miss = needIndex(p); if (miss) return miss;
        onProgress({ stage: 'checking' });
        const c = await check(p);
        if (!c.ok) return { ok: false, text: `Not rendered: the composition has ${c.errors.length} error(s). Fix them, then render again:\n${fmt(c.errors.slice(0, 15))}`, data: { errors: c.errors } };
        const format = ['mp4', 'webm', 'gif'].includes(params.format) ? params.format : 'mp4';
        const out = params.out ? path.resolve(cwd, String(params.out)) : path.join(p.abs, `${path.basename(p.abs)}.${format}`);
        fs.mkdirSync(path.dirname(out), { recursive: true });
        const quality = params.quality === 'draft' ? 'draft' : params.quality === 'high' ? 'delivery' : 'looks';
        const args = ['render', '--output', out, '--quality', quality, '--format', format];
        if ([24, 25, 30, 50, 60].includes(Number(params.fps))) args.push('--fps', String(params.fps));
        const t0 = Date.now();
        onProgress({ stage: 'render' });
        const r = await hf(args, { cwd: p.abs, timeoutMs: 45 * 60000, onLine: (l) => { if (/encod|mux|audio/i.test(l)) onProgress({ stage: 'encode' }); } });
        if (r.code !== 0 || !fs.existsSync(out) || fs.statSync(out).size === 0) {
          return { ok: false, text: `Render failed: ${String(r.json?.error?.message || r.stderr || r.stdout).replace(/\s+/g, ' ').slice(-400)}${r.json?.error?.hint ? `\nFIX: ${r.json.error.hint}` : ''}` };
        }
        const secs = Math.round((Date.now() - t0) / 1000);
        return { ok: true, text: `Rendered with HyperFrames: ${out} (${c.duration ? `${c.duration} s, ` : ''}${Math.round(fs.statSync(out).size / 1024)} KB, took ${secs} s).${/<audio\b/i.test(fs.readFileSync(p.index, 'utf8')) ? '' : '\nIt has no sound: for a voice-over, music and captions call hyperframes_voice, add its lines to index.html and render again.'}`, videoFile: format === 'gif' ? undefined : out, data: { file: out, seconds: secs, duration: c.duration } };
      }

      default:
        return { ok: false, text: `Unknown tool "${name}".` };
    }
  } catch (e) {
    return { ok: false, text: `${e.message}${e.fix ? `\nFIX: ${e.fix}` : ''}`, data: { error: e.message } };
  }
}
