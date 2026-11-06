// Film render: every shot becomes its own video segment, rendered by a pool of Chrome
// workers and cached by a hash of exactly what it draws. Voice and music are made once
// for the whole film, so they flow across cuts. Segments are joined without re-encoding.
//
// Project folder (next to the film file): out/<title>/
//   project.json          status of every shot, timings, last result
//   shots/<id>/build/     compiled page for the shot
//   shots/<id>/segment.mp4 + segment.json (hash, frames, fps)
//   audio.wav, <title>.mp4, <title>.srt, <title>-chapters.txt, poster.jpg
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { validateFilmFile } from './film.mjs';
import { buildTimeline } from '../timeline.mjs';
import { compile } from '../compiler/compile.mjs';
import { synthesize } from '../audio/tts.mjs';
import { buildMusic, mixToWav } from '../audio/mix.mjs';
import { synthMusic } from '../audio/synth.mjs';
import { SR } from '../audio/wav.mjs';
import { launchBrowser, openBuild, gpuWorks, UserError } from '../render/browser.mjs';
import { findFfmpeg } from '../deps/locate.mjs';
import { slug, outDirFor } from '../pipeline.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const ENGINE_VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

export const defaultWorkers = () => Math.max(1, Math.min(6, os.cpus().length - 2));

const sha = (...parts) => { const h = crypto.createHash('sha256'); for (const p of parts) h.update(typeof p === 'string' ? p : JSON.stringify(p)); return h.digest('hex'); };
const readJson = (f, fallback = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const writeJson = (f, v) => { fs.mkdirSync(path.dirname(f), { recursive: true }); const tmp = `${f}.tmp`; fs.writeFileSync(tmp, JSON.stringify(v, null, 2)); fs.renameSync(tmp, f); };

/** Run fn over items with at most `limit` at once; results keep the input order. */
async function pool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async (_, w) => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i], i, w); }
  }));
  return out;
}

/** Shift a one-scene shot timeline to its place in the film. */
function shiftScene(sc, off) {
  const s = (x) => (x == null ? x : +(x + off).toFixed(3));
  return {
    ...sc,
    start: s(sc.start), end: s(sc.end), voiceStart: s(sc.voiceStart),
    parts: sc.parts.map(p => ({ ...p, start: s(p.start), end: s(p.end) })),
    captions: sc.captions.map(c => ({ ...c, start: s(c.start), end: s(c.end), ...(c.words ? { words: c.words.map(([a, b]) => [s(a), s(b)]) } : {}) })),
  };
}

/** Render one shot's frames into a silent H.264 segment. */
async function renderSegment({ ffmpeg, browser, shot, fps, onFrames }) {
  const tmp = path.join(shot.dir, 'segment.tmp.mp4');
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
    '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-frames:v', String(shot.frames), tmp];
  const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', d => { ffErr += d; });
  const ffDone = new Promise((res, rej) => ff.on('close', code => (code === 0 ? res() : rej(new Error(`ffmpeg: ${ffErr.trim().split('\n').slice(-4).join(' | ')}`)))));
  ff.stdin.on('error', () => {});
  const sess = await openBuild(shot.build.file, shot.build.stage, { shared: browser });
  try {
    for (let f = 0; f < shot.frames; f++) {
      await sess.seek((f * 1000) / fps);
      const buf = await sess.frame('jpeg', 92);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f === Math.min(shot.frames - 1, Math.round(fps * 1.2))) fs.writeFileSync(path.join(shot.dir, 'thumb.jpg'), buf);
      if (f % 15 === 14) onFrames(15);
    }
    onFrames(shot.frames % 15);
  } finally {
    await sess.close();
    ff.stdin.end();
  }
  await ffDone;
  fs.renameSync(tmp, path.join(shot.dir, 'segment.mp4'));
}

/** Music for the whole film: one cue per sequence (its own style if set), crossfaded at sequence cuts. */
function filmMusic({ storyboard, sequences, seqSpans, timeline, baseDir }) {
  if (storyboard.music?.file) return buildMusic(storyboard, timeline, baseDir, path);
  const N = Math.ceil((timeline.duration + 0.3) * SR);
  const L = new Float32Array(N), R = new Float32Array(N);
  const fade = Math.round(1.2 * SR);
  sequences.forEach((seq, si) => {
    const span = seqSpans[si];
    if (!span || span.duration <= 0) return;
    const local = { duration: span.duration, scenes: span.scenes.map(sc => ({ ...sc, start: +(sc.start - span.start).toFixed(3), end: +(sc.end - span.start).toFixed(3) })) };
    const style = seq.music?.style || storyboard.music?.style || 'indian-electronic';
    const [mL, mR] = synthMusic(local, { style, seed: 7 + si * 13 });
    const i0 = Math.round(span.start * SR);
    const len = Math.min(mL.length, N - i0);
    const last = si === sequences.length - 1;
    for (let j = 0; j < len; j++) {
      let g = 1;
      if (si > 0 && j < fade) g *= j / fade;                         // fade in after a sequence cut
      const tail = Math.round(span.duration * SR) - j;
      if (!last && tail < fade / 2) g *= Math.max(0, tail + fade / 2) / fade; // fade out across the cut
      L[i0 + j] += mL[j] * g; R[i0 + j] += mR[j] * g;
    }
  });
  return [L, R];
}

const srtTime = (t) => {
  const ms = Math.max(0, Math.round(t * 1000));
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const plainCaption = (html) => String(html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
const clock = (sec) => { const t = Math.floor(sec); return t >= 3600 ? `${Math.floor(t / 3600)}:${String(Math.floor(t / 60) % 60).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };

/**
 * @param opts.workers   parallel Chrome workers (default: cores - 2, at most 6)
 * @param opts.voice     'auto' | 'skip'
 * @param opts.only      list of shot ids to (re)render; others must already be cached
 * @param opts.force     ignore the cache
 */
export async function renderFilm(filmFile, { out, fps, workers, voice = 'auto', only, force = false, onProgress = () => {} } = {}) {
  const t0 = Date.now();
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new UserError('ffmpeg was not found.', 'run video_doctor with install=true');

  const v = validateFilmFile(filmFile);
  if (!v.ok) {
    const e = new UserError(`The film has ${v.errors.length} error(s).`, 'fix each item in "errors" and validate again');
    e.details = { errors: v.errors, warnings: v.warnings };
    throw e;
  }
  const { storyboard: sb, shots: shotRefs, sequences } = v;
  fps = fps || sb.fps || 30;
  workers = Math.max(1, Math.min(16, workers || defaultWorkers()));
  const baseDir = path.dirname(path.resolve(filmFile));
  const projectDir = outDirFor(filmFile, sb);
  const projectFile = path.join(projectDir, 'project.json');
  const project = readJson(projectFile, { shots: {} });
  project.title = sb.title;
  project.film = path.resolve(filmFile);
  project.engine = ENGINE_VERSION;
  project.shots = project.shots || {};
  const save = () => { project.updatedAt = new Date().toISOString(); writeJson(projectFile, project); };

  // 1. Voice for every shot (each clip is cached on disk by text and voice), several batches at once.
  let voices = sb.scenes.map(() => null);
  let voiceNote = null;
  if (voice !== 'skip' && sb.voice?.provider !== 'none') {
    const batches = [];
    for (let i = 0; i < sb.scenes.length; i += 6) batches.push(i);
    let doneShots = 0;
    const failed = [];
    await pool(batches, 4, async (from) => {
      const scenes = sb.scenes.slice(from, from + 6);
      try {
        const res = await synthesize({ ...sb, scenes });
        res.forEach((r, k) => { voices[from + k] = r; });
      } catch (e) { failed.push(`${shotRefs[from].id}…: ${e.message}`); }
      doneShots += scenes.length;
      onProgress({ stage: 'voice', done: doneShots, total: sb.scenes.length });
    });
    if (failed.length) { voiceNote = `voice missing for some shots (${failed[0]})`; onProgress({ stage: 'voice', warning: voiceNote }); }
  }

  // 2. Build every shot's page and work out its hash and length.
  const shots = shotRefs.map((ref, i) => {
    const dir = path.join(projectDir, 'shots', ref.id);
    // In a film, shots cut straight to each other unless the shot asks for a transition.
    const rawShot = v.film.sequences[ref.seqIndex]?.shots?.[ref.index];
    const scene = rawShot && rawShot.transition ? sb.scenes[i] : { ...sb.scenes[i], transition: 'cut' };
    const mini = { ...sb, scenes: [scene] };
    const vo = voices[i];
    const timeline = buildTimeline(mini, [vo?.seconds ?? null], [vo?.parts ?? null], [vo?.words ?? null]);
    const build = compile(mini, timeline, { baseDir, buildDir: path.join(dir, 'build'), progress: false });
    const html = fs.readFileSync(build.file, 'utf8');
    const frames = Math.max(1, Math.round(timeline.duration * fps));
    const hash = sha(ENGINE_VERSION, 'x264-veryfast-crf18', String(fps), `${build.stage.width}x${build.stage.height}`, html);
    const meta = readJson(path.join(dir, 'segment.json'));
    const cached = !force && meta?.hash === hash && fs.existsSync(path.join(dir, 'segment.mp4'));
    return { ...ref, i, dir, build, timeline, frames, seconds: frames / fps, hash, cached };
  });
  onProgress({ stage: 'compile', shots: shots.length, cached: shots.filter(s => s.cached).length });

  // 3. Render missing or changed shots on the worker pool.
  const onlySet = only ? new Set([].concat(only).map(String)) : null;
  const todo = shots.filter(s => !s.cached && (!onlySet || onlySet.has(s.id)));
  const blocked = shots.filter(s => !s.cached && onlySet && !onlySet.has(s.id));
  for (const s of shots) {
    const prev = project.shots[s.id] || {};
    project.shots[s.id] = { ...prev, seq: s.seq, hash: s.hash, seconds: +s.seconds.toFixed(3), status: s.cached ? 'done' : todo.includes(s) ? 'queued' : 'stale', ...(s.cached ? { error: undefined } : {}) };
  }
  // Shots that are no longer in the film.
  for (const id of Object.keys(project.shots)) if (!shots.some(s => s.id === id)) delete project.shots[id];
  save();

  const totalFrames = todo.reduce((n, s) => n + s.frames, 0);
  let framesDone = 0, shotsDone = 0;
  const failures = [];
  let gpu = false;
  if (todo.length) {
    // Long shots first, so one big shot does not finish last on its own.
    const order = [...todo].sort((a, b) => b.frames - a.frames);
    gpu = await gpuWorks();
    onProgress({ stage: 'render', gpu, workers, shots: todo.length });
    const browsers = [];
    try {
      await pool(order, workers, async (shot, _i, w) => {
        if (!browsers[w]) browsers[w] = await launchBrowser({ gpu });
        const started = Date.now();
        project.shots[shot.id].status = 'rendering';
        try {
          await renderSegment({ ffmpeg, browser: browsers[w], shot, fps, onFrames: (n) => { framesDone += n; } });
          writeJson(path.join(shot.dir, 'segment.json'), { hash: shot.hash, frames: shot.frames, fps, seconds: shot.seconds, renderedAt: new Date().toISOString() });
          Object.assign(project.shots[shot.id], { status: 'done', renderSeconds: +((Date.now() - started) / 1000).toFixed(1), error: undefined });
        } catch (e) {
          failures.push({ shot: shot.id, error: e.message });
          Object.assign(project.shots[shot.id], { status: 'failed', error: e.message });
          // A crashed browser is replaced on the next shot.
          try { await browsers[w]?.close(); } catch { /* already gone */ }
          browsers[w] = null;
        }
        shotsDone++;
        save();
        onProgress({ stage: 'shots', done: shotsDone, total: todo.length, frames: framesDone, totalFrames, shot: shot.id, workers });
      });
    } finally {
      await Promise.all(browsers.filter(Boolean).map(b => b.close().catch(() => {})));
    }
  }

  const missing = [...failures.map(f => f.shot), ...blocked.map(s => s.id)];
  if (missing.length) {
    save();
    return {
      ok: false,
      project: projectDir,
      error: failures.length ? `${failures.length} shot(s) failed to render` : `${blocked.length} shot(s) changed but were not in "only"`,
      failures,
      notRendered: blocked.map(s => s.id),
      fix: failures.length ? 'fix or simplify those shots, then render again (finished shots are reused)' : 'render again without "only" (or include those shots)',
      rendered: todo.length - failures.length,
      seconds: Math.round((Date.now() - t0) / 1000),
    };
  }

  // 4. Film timeline (shot lengths rounded to whole frames, so sound and picture never drift).
  onProgress({ stage: 'audio' });
  let off = 0;
  const filmScenes = [];
  const seqSpans = sequences.map(() => null);
  for (const s of shots) {
    const sc = shiftScene(s.timeline.scenes[0], off);
    sc.end = +(off + s.seconds).toFixed(3);
    sc.duration = +s.seconds.toFixed(3);
    sc.index = filmScenes.length;
    filmScenes.push(sc);
    const span = seqSpans[s.seqIndex] || (seqSpans[s.seqIndex] = { start: off, duration: 0, scenes: [] });
    span.duration = +(off + s.seconds - span.start).toFixed(3);
    span.scenes.push(sc);
    off += s.seconds;
  }
  const filmTimeline = { duration: +off.toFixed(3), fps, scenes: filmScenes };
  const music = filmMusic({ storyboard: sb, sequences, seqSpans, timeline: filmTimeline, baseDir });
  const audio = mixToWav({ storyboard: sb, timeline: filmTimeline, voices, music, file: path.join(projectDir, 'audio.wav') });

  // 5. Join the segments (no re-encode) and add the sound.
  onProgress({ stage: 'assemble' });
  const outFile = path.resolve(out || path.join(projectDir, `${slug(sb.title)}.mp4`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const list = path.join(projectDir, 'segments.txt');
  fs.writeFileSync(list, shots.map(s => `file '${path.join(s.dir, 'segment.mp4').replace(/'/g, "'\\''")}'`).join('\n') + '\n');
  const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
  if (audio.hasAudio) args.push('-i', audio.file, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k');
  args.push('-c:v', 'copy', '-t', String(filmTimeline.duration), '-movflags', '+faststart', outFile);
  try { execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (e) { throw new UserError(`joining the shots failed: ${String(e.stderr || e.message).trim().split('\n').slice(-3).join(' | ')}`, 'render again with force=true'); }

  // 6. Extras: captions file, chapters (one per sequence), poster.
  const base = outFile.replace(/\.mp4$/i, '');
  const caps = filmScenes.flatMap(sc => sc.captions).filter(c => plainCaption(c.html));
  let srt = null;
  if (caps.length) {
    srt = `${base}.srt`;
    fs.writeFileSync(srt, caps.map((c, k) => `${k + 1}\n${srtTime(c.start)} --> ${srtTime(c.end)}\n${plainCaption(c.html)}\n`).join('\n'));
  }
  const chapters = [];
  seqSpans.forEach((span, si) => { if (span && (!chapters.length || span.start - chapters.at(-1).start >= 10)) chapters.push({ start: chapters.length ? span.start : 0, title: sequences[si].title }); });
  let chaptersFile = null;
  if (chapters.length >= 2) {
    chaptersFile = `${base}-chapters.txt`;
    fs.writeFileSync(chaptersFile, `${sb.title}\n\nChapters\n${chapters.map(c => `${clock(c.start)} ${c.title}`).join('\n')}\n`);
  }
  const poster = path.join(projectDir, 'poster.jpg');
  try { execFileSync(ffmpeg, ['-y', '-loglevel', 'error', '-ss', String(Math.min(1.5, filmTimeline.duration / 2)), '-i', outFile, '-frames:v', '1', '-q:v', '3', poster], { stdio: 'ignore' }); } catch { /* optional */ }

  const result = {
    ok: true,
    file: outFile,
    project: projectDir,
    poster: fs.existsSync(poster) ? poster : null,
    srt,
    chapters: chaptersFile,
    duration: filmTimeline.duration,
    fps,
    width: shots[0].build.stage.width,
    height: shots[0].build.stage.height,
    sequences: sequences.length,
    shots: shots.length,
    rendered: todo.length,
    cached: shots.filter(s => s.cached).length,
    workers,
    gpu,
    voice: voiceNote || (voices.some(Boolean) ? sb.voice?.voice || 'on' : 'none'),
    sizeMB: +(fs.statSync(outFile).size / 1048576).toFixed(2),
    warnings: v.warnings.slice(0, 20),
    seconds: Math.round((Date.now() - t0) / 1000),
  };
  project.lastRender = { file: outFile, duration: result.duration, seconds: result.seconds, rendered: result.rendered, cached: result.cached, at: new Date().toISOString() };
  save();
  return result;
}

/** Status of a film's project: which shots are done, stale (changed since render), failed or never rendered. */
export function filmStatus(filmFile) {
  const v = validateFilmFile(filmFile);
  if (!v.storyboard) return { ok: false, errors: v.errors };
  const projectDir = outDirFor(filmFile, v.storyboard);
  const project = readJson(path.join(projectDir, 'project.json'), { shots: {} });
  const rows = v.shots.map(s => {
    const p = project.shots?.[s.id];
    const seg = readJson(path.join(projectDir, 'shots', s.id, 'segment.json'));
    return { id: s.id, seq: s.seq, status: p?.status || 'new', seconds: p?.seconds ?? null, rendered: !!seg, error: p?.error };
  });
  const count = (st) => rows.filter(r => r.status === st).length;
  return {
    ok: v.ok,
    project: projectDir,
    title: v.storyboard.title,
    sequences: v.sequences.map(s => ({ id: s.id, title: s.title, shots: s.shots.length })),
    shots: rows.length,
    done: count('done'), failed: count('failed'), new: count('new'), queued: count('queued') + count('rendering') + count('stale'),
    lastRender: project.lastRender || null,
    errors: v.errors, rows,
    note: 'Status is from the last render. A shot edited since then is re-rendered next time (its hash changes).',
  };
}
