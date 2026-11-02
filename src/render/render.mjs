// Full pipeline: prepare -> audio -> frame-stepped capture piped into ffmpeg.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { prepare, slug } from '../pipeline.mjs';
import { synthesize } from '../audio/tts.mjs';
import { buildMusic, mixToWav } from '../audio/mix.mjs';
import { openBuild, UserError } from './browser.mjs';
import { findFfmpeg } from '../deps/locate.mjs';

export async function render(storyboardFile, { out, fps, onProgress = () => {}, voice = 'auto' } = {}) {
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

  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-'];
  if (audio.hasAudio) args.push('-i', audio.file, '-map', '0:v', '-map', '1:a', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-ar', '48000', '-c:a', 'aac', '-b:a', '192k');
  args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', String(fps), '-t', String(timeline.duration), '-movflags', '+faststart', outFile);
  const ff = spawn(ffmpeg, args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let ffErr = '';
  ff.stderr.on('data', d => { ffErr += d; });
  const ffDone = new Promise((res, rej) => ff.on('close', code => code === 0 ? res() : rej(new UserError(`ffmpeg failed: ${ffErr.trim().split('\n').slice(-8).join(' | ')}`, 'check that image files are valid PNG/JPEG/WebP'))));
  ff.stdin.on('error', () => {});

  const sess = await openBuild(build.file, build.stage);
  let poster = null;
  try {
    for (let f = 0; f < frames; f++) {
      const ms = (f * 1000) / fps;
      await sess.seek(ms);
      const buf = await sess.frame('jpeg', 92);
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (!poster && ms >= Math.min(1500, timeline.duration * 500)) { poster = path.join(outDir, 'poster.jpg'); fs.writeFileSync(poster, buf); }
      if (f % 30 === 0 || f === frames - 1) onProgress({ stage: 'frames', done: f + 1, total: frames });
    }
  } finally {
    await sess.close();
    ff.stdin.end();
  }
  onProgress({ stage: 'encode' });
  await ffDone;
  const size = fs.statSync(outFile).size;
  return {
    ok: true,
    file: outFile,
    poster,
    duration: timeline.duration,
    fps,
    format: storyboard.format,
    width: build.stage.width,
    height: build.stage.height,
    sizeMB: +(size / 1048576).toFixed(2),
    voice: p.voiceNote ? p.voiceNote : (p.voices.some(Boolean) ? storyboard.voice.voice : 'none'),
    music: storyboard.music?.file ? 'file' : storyboard.music?.style,
    scenes: timeline.scenes.map(s => ({ template: s.template, start: s.start, duration: s.duration })),
    warnings: p.warnings,
    seconds: Math.round((Date.now() - t0) / 1000),
  };
}
