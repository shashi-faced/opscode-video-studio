// Video aspect ratio reframing (16:9, 9:16 Reel/Shorts, 1:1 Square)
import fs from 'node:fs';
import path from 'node:path';
import {
  execFfmpeg,
  inspectMedia,
  extractFrame,
  VideoError,
} from './ffmpegCore.mjs';

const RESOLUTIONS = {
  '9:16': { width: 1080, height: 1920, name: 'Reels / Shorts / TikTok (9:16)' },
  '16:9': { width: 1920, height: 1080, name: 'YouTube / Landscape (16:9)' },
  '1:1': { width: 1080, height: 1080, name: 'Square Post (1:1)' },
  '4:5': { width: 1080, height: 1350, name: 'Instagram Portrait (4:5)' },
};

export async function reframeVideo(params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  const { input, format = '9:16', style = 'blur_pad', out } = params;

  if (!input) throw new VideoError('Missing required parameter "input" (video file path).', 'Provide a video file path.');

  const absVid = path.isAbsolute(input) ? input : path.resolve(cwd, input);
  if (!fs.existsSync(absVid)) throw new VideoError(`Video file not found: ${input}`, 'Provide an existing video path.');

  const targetSpec = RESOLUTIONS[format] || RESOLUTIONS['9:16'];
  const W = targetSpec.width;
  const H = targetSpec.height;

  onProgress({ stage: 'inspecting' });
  const meta = await inspectMedia(absVid, { cwd });
  if (!meta.hasVideo) throw new VideoError(`File has no video stream: ${input}`, 'Provide a valid video file.');

  const ext = path.extname(absVid) || '.mp4';
  const baseName = path.basename(absVid, ext);
  let outFile = out;
  if (!outFile) {
    const formatTag = format.replace(':', 'x');
    outFile = path.join(path.dirname(absVid), `${baseName}_${formatTag}_${style}${ext}`);
  }
  const absOut = path.isAbsolute(outFile) ? outFile : path.resolve(cwd, outFile);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  onProgress({ stage: 'reframing', format, style, resolution: `${W}x${H}` });

  let filter = '';
  if (style === 'crop') {
    // Fill screen and center-crop excess
    filter = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1[outv]`;
  } else if (style === 'fit') {
    // Letterbox / pillarbox with black padding
    filter = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1[outv]`;
  } else {
    // Default: 'blur_pad' — blurred, zoomed background with sharp centered video
    filter = `[0:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=25:5[bg];[0:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,setsar=1[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2[outv]`;
  }

  const args = [
    '-y',
    '-loglevel', 'error',
    '-i', absVid,
    '-filter_complex', filter,
    '-map', '[outv]',
  ];

  if (meta.hasAudio) {
    args.push('-map', '0:a', '-c:a', 'copy');
  }

  args.push(
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-crf', '20',
    '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart',
    absOut
  );

  await execFfmpeg(args, { onProgress, cwd });

  onProgress({ stage: 'post-processing' });
  const outMeta = await inspectMedia(absOut, { cwd });
  const posterOut = path.join(path.dirname(absOut), `${path.basename(absOut, ext)}_poster.jpg`);
  const poster = await extractFrame(absOut, posterOut, 1.0, { cwd });

  return {
    ok: true,
    file: absOut,
    poster: poster || undefined,
    duration: outMeta.duration,
    formattedDuration: outMeta.formattedDuration,
    width: outMeta.width,
    height: outMeta.height,
    format,
    formatDescription: targetSpec.name,
    style,
    fps: outMeta.fps,
    sizeMB: outMeta.sizeMB,
  };
}
