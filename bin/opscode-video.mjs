#!/usr/bin/env node
// opscode-video CLI. Progress is printed as JSON lines {"progress":...};
// the LAST line of stdout is always one JSON result object.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runTool, TOOL_DEFS } from '../src/tools.mjs';
import { validateFile } from '../src/schema/validate.mjs';
import { templatesDoc, EXAMPLE } from '../src/docs.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const cmd = argv[0];
const flags = {};
const pos = [];
for (let i = 1; i < argv.length; i++) {
  const a = argv[i];
  if (a.startsWith('--')) { const [k, v] = a.slice(2).split('='); flags[k] = v ?? (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true); }
  else pos.push(a);
}
const quiet = !!flags.quiet;
const progress = (p) => { if (!quiet) process.stdout.write(JSON.stringify({ progress: p }) + '\n'); };
const done = (obj, code = 0) => { process.stdout.write(JSON.stringify(obj) + '\n'); process.exit(code); };

const HELP = `opscode-video — storyboard JSON to animated MP4

  doctor [--install]            check / install Chrome, ffmpeg, voices
  templates [type] [platform]   storyboard reference (optionally for one video type / platform)
  init <dir> [--format 9:16]    write a starter storyboard
  validate <storyboard.json>    validate, with fix hints
  check <storyboard.json>       layout QA + contact sheet (no audio)
  preview <storyboard.json>     build the HTML preview page
  render <storyboard.json> [--out file.mp4] [--fps 30] [--workers 4] [--no-voice]
  film-render <film.json> [--workers 6] [--only id1,id2] [--force] [--no-voice] [--out file.mp4]
                                long video from sequences of shots; parallel, cached, resumable
  film-status <film.json>       shots done / failed / not rendered
  assets [list|install|remove] [set]  3D packs: characters (5.8 MB) and world scenery (2.2 MB), CC0, downloaded on request
  character <sheet|save|list> [storyboard.json] [id]  designed 3D characters: turnaround sheet, save to library
  capture <url> <out.png> [--width 1440 --height 900 --crop x,y,w,h]
  tool <name> '<json params>'   generic bridge used by the Opscode app
  tools                         list tool definitions (JSON)
  agent-manifest                manifest + tools for the Opscode app`;

async function main() {
  try {
    switch (cmd) {
      case 'templates':
        if (flags.json) return done({ ok: true, example: EXAMPLE });
        process.stdout.write(templatesDoc(pos[0], pos[1]) + '\n');
        return done({ ok: true });
      case 'tools':
        return done({ ok: true, tools: TOOL_DEFS });
      case 'agent-manifest': {
        // Read by the Opscode app after install: manifest + tool definitions + entry point.
        const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent', 'manifest.json'), 'utf8'));
        return done({ ok: true, manifest: { ...manifest, package: { installDir: ROOT, entry: 'bin/opscode-video.mjs', runtime: 'node', nodePath: process.execPath, tools: TOOL_DEFS } } });
      }
      case 'init': {
        const dir = path.resolve(pos[0] || 'video');
        fs.mkdirSync(path.join(dir, 'shots'), { recursive: true });
        const file = path.join(dir, 'storyboard.json');
        if (fs.existsSync(file) && !flags.force) return done({ ok: false, error: `${file} exists`, fix: 'use --force to overwrite' }, 1);
        const sb = structuredClone(EXAMPLE);
        sb.format = flags.format || sb.format;
        delete sb.brand.logo;
        sb.scenes = sb.scenes.filter(s => !s.image);
        fs.writeFileSync(file, JSON.stringify(sb, null, 2));
        return done({ ok: true, storyboard: file, shots: path.join(dir, 'shots') });
      }
      case 'validate': {
        const { isFilm, validateFilmFile } = await import('../src/film/film.mjs');
        let raw = null; try { raw = JSON.parse(fs.readFileSync(pos[0], 'utf8')); } catch { /* reported below */ }
        const r = isFilm(raw) ? validateFilmFile(pos[0]) : validateFile(pos[0]);
        return done({ ok: r.ok, errors: r.errors, warnings: r.warnings }, r.ok ? 0 : 2);
      }
      case 'check':
      case 'preview': {
        const r = await runTool('video_preview', { storyboard: pos[0] }, { onProgress: progress });
        delete r.image;
        if (cmd === 'preview' && !flags.quiet) process.stderr.write(`Open in a browser: ${r.data?.preview}\n`);
        return done({ ok: r.ok, ...r.data, text: r.text }, r.ok ? 0 : 2);
      }
      case 'render': {
        const { render } = await import('../src/render/render.mjs');
        const r = await render(pos[0], { out: flags.out, fps: flags.fps ? +flags.fps : undefined, workers: flags.workers ? +flags.workers : undefined, voice: flags['no-voice'] ? 'skip' : 'auto', onProgress: progress });
        return done(r);
      }
      case 'film-render': {
        const { renderFilm } = await import('../src/film/renderFilm.mjs');
        const r = await renderFilm(pos[0], { out: flags.out, fps: flags.fps ? +flags.fps : undefined, workers: flags.workers ? +flags.workers : undefined, only: flags.only ? String(flags.only).split(',') : undefined, force: !!flags.force, voice: flags['no-voice'] ? 'skip' : 'auto', onProgress: progress });
        return done(r, r.ok ? 0 : 2);
      }
      case 'film-status': {
        const { filmStatus } = await import('../src/film/renderFilm.mjs');
        const r = filmStatus(pos[0]);
        return done(r, r.ok ? 0 : 2);
      }
      case 'assets': {
        const r = await runTool('video_assets', { action: pos[0] || 'list', set: pos[1] }, { onProgress: progress });
        if (!quiet) process.stderr.write(r.text + '\n');
        return done({ ok: r.ok, sets: r.data }, r.ok ? 0 : 1);
      }
      case 'character': {
        const r = await runTool('video_character', { action: pos[0] || 'list', storyboard: pos[1], id: pos[2], out: flags.out });
        if (!quiet) process.stderr.write(r.text + '\n');
        return done({ ok: r.ok, text: r.text, data: r.data }, r.ok ? 0 : 1);
      }
      case 'capture': {
        const r = await runTool('video_capture', { url: pos[0], out: pos[1], width: flags.width, height: flags.height, crop: flags.crop, waitMs: flags.wait });
        delete r.image;
        return done(r, r.ok ? 0 : 1);
      }
      case 'doctor': {
        const r = await runTool('video_doctor', { install: !!flags.install });
        return done({ ok: r.ok, ...r.data }, r.ok ? 0 : 1);
      }
      case 'tool': {
        const name = pos[0];
        let params = {};
        const raw = pos[1] ?? flags.params;
        if (flags.b64) params = JSON.parse(Buffer.from(String(flags.b64), 'base64').toString('utf8'));
        else if (raw) params = raw.startsWith('@') ? JSON.parse(fs.readFileSync(raw.slice(1), 'utf8')) : JSON.parse(raw);
        const r = await runTool(name, params, { cwd: flags.cwd || process.cwd(), onProgress: progress });
        // --image-path: return the image as a file path instead of inline base64, so
        // hosts with output limits (the Opscode app keeps 64 KB) get a small result line.
        if (flags['image-path']) return done({ ok: r.ok, text: r.text, imageFile: r.imageFile, data: r.data }, 0);
        return done({ ok: r.ok, text: r.text, image: r.image, data: r.data }, 0);
      }
      case undefined: case 'help': case '--help': case '-h':
        process.stdout.write(HELP + '\n');
        return done({ ok: true, root: ROOT });
      default:
        return done({ ok: false, error: `unknown command "${cmd}"`, fix: 'run opscode-video help' }, 1);
    }
  } catch (e) {
    return done({ ok: false, error: e.message, fix: e.fix, details: e.details }, 1);
  }
}
main();
