// Audio mixing, replacement, and BGM overlay handler
import fs from 'node:fs';
import path from 'node:path';
import {
  execFfmpeg,
  inspectMedia,
  extractFrame,
  VideoError,
} from './ffmpegCore.mjs';

export async function audioMix(params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  const {
    video,
    audio,
    out,
    mode = 'mix',
    audioVolume = 0.3,
    originalVolume = 1.0,
    loopAudio = true,
  } = params;

  if (!video) throw new VideoError('Missing required parameter "video".', 'Provide a video file path.');
  if (!audio) throw new VideoError('Missing required parameter "audio".', 'Provide an audio or music file path.');

  const absVid = path.isAbsolute(video) ? video : path.resolve(cwd, video);
  const absAud = path.isAbsolute(audio) ? audio : path.resolve(cwd, audio);

  if (!fs.existsSync(absVid)) throw new VideoError(`Video file not found: ${video}`, 'Provide an existing video path.');
  if (!fs.existsSync(absAud)) throw new VideoError(`Audio file not found: ${audio}`, 'Provide an existing audio path.');

  onProgress({ stage: 'inspecting' });
  const vidMeta = await inspectMedia(absVid, { cwd });
  if (!vidMeta.hasVideo) throw new VideoError(`Input video has no video stream: ${video}`, 'Provide a valid video file.');

  const ext = path.extname(absVid) || '.mp4';
  const baseName = path.basename(absVid, ext);
  let outFile = out;
  if (!outFile) {
    const tag = mode === 'replace' ? 'audio_replaced' : 'with_bgm';
    outFile = path.join(path.dirname(absVid), `${baseName}_${tag}${ext}`);
  }
  const absOut = path.isAbsolute(outFile) ? outFile : path.resolve(cwd, outFile);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  onProgress({ stage: 'mixing-audio', mode, audioVolume });

  const args = ['-y', '-loglevel', 'error'];
  args.push('-i', absVid);

  // If audio looping is requested, use stream_loop
  if (loopAudio) {
    args.push('-stream_loop', '-1');
  }
  args.push('-i', absAud);

  const shouldMix = mode === 'mix' && vidMeta.hasAudio;

  if (shouldMix) {
    const aVol = Math.max(0, Math.min(5.0, Number(audioVolume) || 0.3));
    const oVol = Math.max(0, Math.min(5.0, Number(originalVolume) || 1.0));

    const filter = `[0:a]volume=${oVol}[a0];[1:a]volume=${aVol}[a1];[a0][a1]amix=inputs=2:duration=first:dropout_transition=2[outa]`;
    args.push(
      '-filter_complex', filter,
      '-map', '0:v',
      '-map', '[outa]',
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', String(vidMeta.duration),
      '-movflags', '+faststart',
      absOut
    );
  } else {
    // Replace audio track
    const aVol = Math.max(0, Math.min(5.0, Number(audioVolume) || 1.0));
    args.push(
      '-map', '0:v',
      '-map', '1:a',
      '-af', `volume=${aVol}`,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-t', String(vidMeta.duration),
      '-movflags', '+faststart',
      absOut
    );
  }

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
    fps: outMeta.fps,
    sizeMB: outMeta.sizeMB,
    mode: shouldMix ? 'mixed' : 'replaced',
    audioVolume,
    originalVolume: shouldMix ? originalVolume : 0,
  };
}
