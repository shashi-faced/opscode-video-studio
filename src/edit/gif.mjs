// High quality animated GIF export handler
import fs from 'node:fs';
import path from 'node:path';
import {
  execFfmpeg,
  inspectMedia,
  parseSeconds,
  VideoError,
} from './ffmpegCore.mjs';

export async function videoToGif(params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  const { input, out } = params;
  if (!input) throw new VideoError('Missing required parameter "input" (video file path).', 'Provide a video file path.');

  const absVid = path.isAbsolute(input) ? input : path.resolve(cwd, input);
  if (!fs.existsSync(absVid)) throw new VideoError(`Video file not found: ${input}`, 'Provide an existing video path.');

  const meta = await inspectMedia(absVid, { cwd });
  if (!meta.hasVideo) throw new VideoError(`Input file has no video stream: ${input}`, 'Provide a valid video file.');

  const startSec = parseSeconds(params.start) ?? 0;
  const durSec = Math.min(30, Math.max(0.5, parseSeconds(params.duration) ?? 5));
  const fps = Math.min(30, Math.max(5, Number(params.fps) || 15));
  const width = Math.min(1080, Math.max(160, Number(params.width) || 480));

  const ext = path.extname(absVid);
  const baseName = path.basename(absVid, ext);
  let outFile = out;
  if (!outFile) {
    outFile = path.join(path.dirname(absVid), `${baseName}_preview.gif`);
  }
  const absOut = path.isAbsolute(outFile) ? outFile : path.resolve(cwd, outFile);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  onProgress({ stage: 'generating-gif', start: startSec, duration: durSec, fps, width });

  // Two-pass palette optimization for crisp GIF rendering
  const filter = `fps=${fps},scale=${width}:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5`;

  const args = [
    '-y',
    '-loglevel', 'error',
    '-ss', String(startSec),
    '-t', String(durSec),
    '-i', absVid,
    '-vf', filter,
    absOut,
  ];

  await execFfmpeg(args, { onProgress, cwd });

  const size = fs.existsSync(absOut) ? fs.statSync(absOut).size : 0;
  return {
    ok: true,
    file: absOut,
    duration: durSec,
    width,
    fps,
    sizeMB: +(size / 1048576).toFixed(2),
    sizeBytes: size,
  };
}
