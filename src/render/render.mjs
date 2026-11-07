// Full pipeline: prepare -> audio -> frame-stepped capture piped into ffmpeg.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { prepare, slug } from '../pipeline.mjs';
import { synthesize } from '../audio/tts.mjs';
import { buildMusic, mixToWav } from '../audio/mix.mjs';
import { openBuild, launchBrowser, gpuWorks, UserError } from './browser.mjs';
import { findFfmpeg } from '../deps/locate.mjs';
import { PLATFORMS } from '../schema/platforms.mjs';
import { execFileSync } from 'node:child_process';

const plainText = (s) => String(s ?? '').replace(/\*/g, '').replace(/\s+/g, ' ').trim();
const clock = (sec) => {
  const t = Math.floor(sec);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
};

/** Short label for a scene: its headline, else its kicker, else the start of its narration. */
function sceneLabel(sc, i) {
  const h = plainText(sc.headline) || plainText(sc.kicker) || plainText(sc.quote);
  if (h) return h.slice(0, 60);
  const n = plainText(sc.narration).split(' ').slice(0, 6).join(' ');
  return n ? n.replace(/[.,!?।]+$/, '') : `Part ${i + 1}`;
}

/**
 * YouTube chapters: first at 0:00, at least 3, each at least 10 s (short scenes are merged
 * into the chapter before them). Returns [] when the video is too short for chapters.
 */
export function youtubeChapters(storyboard, timeline) {
  const ch = [];
  timeline.scenes.forEach((s, i) => {
    if (!ch.length || s.start - ch.at(-1).start >= 10) ch.push({ start: ch.length ? s.start : 0, label: sceneLabel(storyboard.scenes[i], i) });
  });
  if (ch.length > 1 && timeline.duration - ch.at(-1).start < 10) ch.pop();
  return ch.length >= 3 ? ch : [];
}

/** Files the platform wants next to the video: thumbnail, covers, description, split parts. */
function writeExtras({ ffmpeg, storyboard, timeline, outFile, outDir, coverFrame, stage }) {
  const plat = PLATFORMS[storyboard.platform];
  if (!plat) return {};
  const base = outFile.replace(/\.mp4$/i, '');
  const run = (args) => execFileSync(ffmpeg, ['-y', '-loglevel', 'error', ...args], { stdio: ['ignore', 'ignore', 'pipe'] });
  const out = {};
  const want = new Set(plat.extras || []);
  if (coverFrame && want.has('cover')) { out.cover = `${base}-cover.jpg`; fs.copyFileSync(coverFrame, out.cover); }
  if (coverFrame && want.has('cover-grid')) {
    // Instagram's profile grid shows a 3:4 centre crop of the reel cover.
    out.coverGrid = `${base}-cover-grid.jpg`;
    run(['-i', coverFrame, '-vf', `crop=${stage.width}:${Math.round(stage.width * 4 / 3)}`, '-q:v', '2', out.coverGrid]);
  }
  if (coverFrame && want.has('thumbnail')) {
    out.thumbnail = `${base}-thumbnail.jpg`;
    run(['-i', coverFrame, '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2', '-q:v', '2', out.thumbnail]);
  }
  if (want.has('chapters') || want.has('thumbnail')) {
    const chapters = want.has('chapters') ? youtubeChapters(storyboard, timeline) : [];
    const lines = [plainText(storyboard.title), ''];
    if (chapters.length) { lines.push('Chapters', ...chapters.map(c => `${clock(c.start)} ${c.label}`), ''); out.chapters = chapters.length; }
    lines.push('Made with Opscode Video Studio. Voice: Microsoft Edge neural TTS.');
    out.description = `${base}-description.txt`;
    fs.writeFileSync(out.description, lines.join('\n') + '\n');
  }
  if (want.has('split') && plat.splitSec && timeline.duration > plat.splitSec + 1) {
    // Cut at the keyframes forced every splitSec seconds during encoding: no re-encode.
    run(['-i', outFile, '-c', 'copy', '-map', '0', '-f', 'segment', '-segment_time', String(plat.splitSec), '-reset_timestamps', '1', `${base}-part%d.mp4`]);
    out.parts = fs.readdirSync(path.dirname(outFile)).filter(f => f.startsWith(path.basename(base) + '-part') && f.endsWith('.mp4')).sort().map(f => path.join(path.dirname(outFile), f));
  }
  return out;
}

export async function render(storyboardFile, { out, fps, workers, onProgress = () => {}, voice = 'auto' } = {}) {
  const t0 = Date.now();
  const ffmpeg = findFfmpeg();
  if (!ffmpeg) throw new UserError('ffmpeg was not found.', 'run video_doctor with install=true');

  onProgress({ stage: 'prepare' });
  const p = await prepare(storyboardFile, { voice, onProgress, synthesize });
  const { storyboard, timeline, build, outDir, baseDir } = p;
  fps = fps || storyboard.fps || 30;

  onProgress({ stage: 'music', style: storyboard.music?.file ? 'file' : storyboard.music?.style });
  const music = buildMusic(storyboard, timeline, baseDir, path);
  const audioFile = path.join(p.buildDir, 'audio.wav');
  const audio = mixToWav({ storyboard, timeline, voices: p.voices, music, file: audioFile });

  const outFile = path.resolve(out || path.join(outDir, `${slug(storyboard.title)}.mp4`));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  const frames = Math.ceil(timeline.duration * fps);

  const plat = PLATFORMS[storyboard.platform];
  const splitParts = !!(plat?.splitSec && timeline.duration > plat.splitSec + 1);
  // 3D scenes draw on the graphics card when Chrome can use it (15-25x faster than software drawing);
  // with no GPU they draw at 2/3 resolution (lowres) to stay usable.
  const gpu = build.has3d ? await gpuWorks() : false;
  const lowres = build.has3d && !gpu;
  // Several Chrome workers each render a chunk of frames when the GPU does the drawing (3D);
  // 2D and software drawing are CPU-bound, so they keep one worker unless asked.
  let nWorkers = Math.max(1, Math.min(8, workers || (build.has3d && gpu ? Math.min(4, Math.max(1, Math.floor(os.cpus().length / 2))) : 1)));
  if (splitParts || frames < fps * 8) nWorkers = 1;

  let poster = null;
  // Cover/thumbnail: the first scene once its entry animations have settled.
  const s0 = timeline.scenes[0];
  const coverAt = Math.min(s0.start + s0.duration * 0.92, s0.start + 3.6) * 1000;
  const posterAt = Math.min(1500, timeline.duration * 500);
  let coverFrame = null;
  const grabCover = async (sess) => {
    await sess.seek(coverAt);
    await sess.page.evaluate(() => { const c = document.querySelector('.cap'); if (c) c.style.visibility = 'hidden'; });
    coverFrame = path.join(p.buildDir, 'cover.jpg');
    fs.writeFileSync(coverFrame, await sess.frame('jpeg', 95));
    await sess.page.evaluate(() => { const c = document.querySelector('.cap'); if (c) c.style.visibility = ''; });
  };
  const ffFail = (err) => new UserError(`ffmpeg failed: ${err.trim().split('\n').slice(-8).join(' | ')}`, 'check that image files are valid PNG/JPEG/WebP');
  const encoder = (args) => {
    const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = '';
    ff.stderr.on('data', d => { ffErr += d; });
    const done = new Promise((res, rej) => ff.on('close', code => (code === 0 ? res() : rej(ffFail(ffErr)))));
    ff.stdin.on('error', () => {});
    return { ff, done, write: async (buf) => { if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r)); } };
  };
  const stats = { composed: 0, overlays: 0, screenshots: 0 };
  const addStats = (st) => { for (const k in stats) stats[k] += st[k] || 0; };

  if (nWorkers === 1) {
    const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
    if (audio.hasAudio) args.push('-i', audio.file, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k');
    if (splitParts) args.push('-force_key_frames', `expr:gte(t,n_forced*${plat.splitSec})`);
    args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(timeline.duration), '-movflags', '+faststart', outFile);
    const enc = encoder(args);
    const sess = await openBuild(build.file, build.stage, { gpu, lowres });
    try {
      for (let f = 0; f < frames; f++) {
        const ms = (f * 1000) / fps;
        const buf = await sess.grab(ms, 92);
        await enc.write(buf);
        if (!poster && ms >= posterAt) { poster = path.join(outDir, 'poster.jpg'); fs.writeFileSync(poster, buf); }
        if (!coverFrame && ms >= coverAt) await grabCover(sess);
        if (f % 30 === 0 || f === frames - 1) onProgress({ stage: 'frames', done: f + 1, total: frames });
      }
    } finally {
      addStats(sess.stats);
      await sess.close();
      enc.ff.stdin.end();
    }
    onProgress({ stage: 'encode' });
    await enc.done;
  } else {
    // Parallel: each worker renders a contiguous chunk into its own segment; segments are joined
    // without re-encoding and the sound is added once.
    const per = Math.ceil(frames / nWorkers);
    const chunks = Array.from({ length: nWorkers }, (_, w) => [w * per, Math.min(frames, (w + 1) * per)]).filter(([a, b]) => b > a);
    let done = 0;
    const segs = await Promise.all(chunks.map(async ([a, b], w) => {
      const seg = path.join(p.buildDir, `chunk-${w}.mp4`);
      const enc = encoder(['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-', '-an',
        '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-frames:v', String(b - a), seg]);
      const browser = await launchBrowser({ gpu });
      try {
        const sess = await openBuild(build.file, build.stage, { shared: browser, gpu, lowres });
        try {
          for (let f = a; f < b; f++) {
            const ms = (f * 1000) / fps;
            const buf = await sess.grab(ms, 92);
            await enc.write(buf);
            if (w === 0 && !poster && ms >= posterAt) { poster = path.join(outDir, 'poster.jpg'); fs.writeFileSync(poster, buf); }
            if (++done % 30 === 0 || done === frames) onProgress({ stage: 'frames', done, total: frames, workers: chunks.length });
          }
        } finally { addStats(sess.stats); await sess.close(); }
      } finally {
        enc.ff.stdin.end();
        await browser.close().catch(() => {});
      }
      await enc.done;
      return seg;
    }));
    // Cover frame (screenshot without the caption), from a fresh page.
    const sess = await openBuild(build.file, build.stage, { gpu, lowres });
    try { await grabCover(sess); } finally { await sess.close(); }
    onProgress({ stage: 'encode' });
    const list = path.join(p.buildDir, 'chunks.txt');
    fs.writeFileSync(list, segs.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n') + '\n');
    const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list];
    if (audio.hasAudio) args.push('-i', audio.file, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k');
    args.push('-c:v', 'copy', '-t', String(timeline.duration), '-movflags', '+faststart', outFile);
    try { execFileSync(ffmpeg, args, { stdio: ['ignore', 'ignore', 'pipe'] }); }
    catch (e) { throw ffFail(String(e.stderr || e.message)); }
  }
  const size = fs.statSync(outFile).size;
  let extras = {};
  try { extras = writeExtras({ ffmpeg, storyboard, timeline, outFile, outDir, coverFrame, stage: build.stage }); }
  catch (e) { extras = { error: `extra files failed: ${e.message}` }; }
  const lengthNote = plat?.maxSec && timeline.duration > plat.maxSec ? `${Math.round(timeline.duration)} s is longer than ${plat.label} allows (${plat.maxSec} s)`
    : plat?.warnSec && timeline.duration > plat.warnSec ? `${Math.round(timeline.duration)} s; ${plat.label} works best under ${plat.warnSec} s` : null;
  return {
    ok: true,
    file: outFile,
    poster,
    duration: timeline.duration,
    fps,
    format: storyboard.format,
    platform: storyboard.platform || null,
    captions: storyboard.captions ? storyboard.captions.style : 'off',
    extras,
    ...(lengthNote ? { lengthNote } : {}),
    width: build.stage.width,
    height: build.stage.height,
    sizeMB: +(size / 1048576).toFixed(2),
    voice: p.voiceNote ? p.voiceNote : (p.voices.some(Boolean) ? storyboard.voice.voice : 'none'),
    music: storyboard.music?.file ? 'file' : storyboard.music?.style,
    scenes: timeline.scenes.map(s => ({ template: s.template, start: s.start, duration: s.duration })),
    warnings: p.warnings,
    workers: nWorkers,
    gpu,
    has3d: !!build.has3d,
    renderFps: +((timeline.duration * fps) / Math.max(1, (Date.now() - t0) / 1000)).toFixed(1),
    capture: stats,
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}
