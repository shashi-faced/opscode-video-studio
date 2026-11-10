// Video trimming and cutting handler
import fs from 'node:fs';
import path from 'node:path';
import {
  execFfmpeg,
  inspectMedia,
  extractFrame,
  parseSeconds,
  formatSeconds,
  VideoError,
} from './ffmpegCore.mjs';

export async function trimVideo(params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  const { input, out, mode = 'exact' } = params;
  if (!input) {
    throw new VideoError('Missing required parameter "input" (video file path).', 'Provide path to a video file.');
  }

  const absInput = path.isAbsolute(input) ? input : path.resolve(cwd, input);
  if (!fs.existsSync(absInput)) {
    throw new VideoError(`Video file not found: ${input}`, 'Check the file path and try again.');
  }

  onProgress({ stage: 'inspecting' });
  const meta = await inspectMedia(absInput, { cwd });
  if (!meta.hasVideo) {
    throw new VideoError(`File does not appear to contain a video stream: ${input}`, 'Provide a valid video file.');
  }

  const startSec = parseSeconds(params.start) ?? 0;
  let endSec = parseSeconds(params.end);
  const durParam = parseSeconds(params.duration);

  if (durParam !== undefined && endSec === undefined) {
    endSec = startSec + durParam;
  }

  if (endSec !== undefined && endSec <= startSec) {
    throw new VideoError(
      `End time (${endSec}s) must be greater than start time (${startSec}s).`,
      'Set end time after start time.'
    );
  }

  if (meta.duration > 0 && startSec >= meta.duration) {
    throw new VideoError(
      `Start time (${startSec}s) is beyond total video length (${meta.duration}s).`,
      `Specify start time within 0 to ${meta.duration}s.`
    );
  }

  // Derive output path if omitted
  const ext = path.extname(absInput) || '.mp4';
  const baseName = path.basename(absInput, ext);
  let outFile = out;
  if (!outFile) {
    const startTag = Math.floor(startSec);
    const endTag = endSec ? Math.floor(endSec) : 'end';
    outFile = path.join(path.dirname(absInput), `${baseName}_cut_${startTag}s-${endTag}s${ext}`);
  }
  const absOut = path.isAbsolute(outFile) ? outFile : path.resolve(cwd, outFile);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  onProgress({ stage: 'trimming', start: startSec, end: endSec, mode });

  const args = ['-y', '-loglevel', 'error'];

  if (mode === 'fast') {
    // Lossless stream copy mode
    if (startSec > 0) args.push('-ss', String(startSec));
    args.push('-i', absInput);
    if (endSec !== undefined) {
      const cutDuration = endSec - startSec;
      args.push('-t', String(cutDuration));
    }
    args.push('-c', 'copy', '-avoid_negative_ts', '1', absOut);
  } else {
    // Frame-accurate re-encode mode (default)
    if (startSec > 0) args.push('-ss', String(startSec));
    args.push('-i', absInput);
    if (endSec !== undefined) {
      const cutDuration = endSec - startSec;
      args.push('-t', String(cutDuration));
    }
    args.push(
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '19',
      '-pix_fmt', 'yuv420p'
    );
    if (meta.hasAudio) {
      args.push('-c:a', 'aac', '-b:a', '192k', '-ar', '48000');
    }
    args.push('-movflags', '+faststart', absOut);
  }

  await execFfmpeg(args, { onProgress, cwd });

  onProgress({ stage: 'post-processing' });
  const outMeta = await inspectMedia(absOut, { cwd });
  const posterOut = path.join(path.dirname(absOut), `${path.basename(absOut, ext)}_poster.jpg`);
  const poster = await extractFrame(absOut, posterOut, Math.min(1.0, outMeta.duration * 0.5), { cwd });

  return {
    ok: true,
    file: absOut,
    poster: poster || undefined,
    duration: outMeta.duration,
    formattedDuration: outMeta.formattedDuration,
    width: outMeta.width,
    height: outMeta.height,
    fps: outMeta.fps,
    sizeMB: outMeta.sizeMB,
    mode,
    start: startSec,
    end: endSec || outMeta.duration,
  };
}
