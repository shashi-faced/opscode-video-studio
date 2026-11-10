// Video concatenation and clip merging handler
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  execFfmpeg,
  inspectMedia,
  extractFrame,
  VideoError,
} from './ffmpegCore.mjs';

export async function concatVideos(params = {}, { cwd = process.cwd(), onProgress = () => {} } = {}) {
  const inputs = Array.isArray(params.inputs)
    ? params.inputs
    : typeof params.inputs === 'string'
    ? params.inputs.split(',').map((s) => s.trim())
    : [];

  if (inputs.length < 2) {
    throw new VideoError('At least 2 input videos are required for concatenation.', 'Provide an array of video paths.');
  }

  const absInputs = inputs.map((p) => (path.isAbsolute(p) ? p : path.resolve(cwd, p)));
  for (const p of absInputs) {
    if (!fs.existsSync(p)) {
      throw new VideoError(`Video file not found: ${p}`, 'Ensure all input paths exist.');
    }
  }

  onProgress({ stage: 'inspecting-clips', total: absInputs.length });
  const metas = [];
  for (let i = 0; i < absInputs.length; i++) {
    const meta = await inspectMedia(absInputs[i], { cwd });
    if (!meta.hasVideo) {
      throw new VideoError(`File has no video stream: ${absInputs[i]}`, 'Only video files can be merged.');
    }
    metas.push(meta);
  }

  // Derive output path if not given
  const firstDir = path.dirname(absInputs[0]);
  const ext = path.extname(absInputs[0]) || '.mp4';
  let outFile = params.out;
  if (!outFile) {
    const baseName = path.basename(absInputs[0], ext);
    outFile = path.join(firstDir, `${baseName}_merged_${absInputs.length}clips${ext}`);
  }
  const absOut = path.isAbsolute(outFile) ? outFile : path.resolve(cwd, outFile);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  const targetW = metas[0].width || 1920;
  const targetH = metas[0].height || 1080;
  const targetFps = metas[0].fps || 30;

  // Check if all clips match resolution and codec for fast demuxer copy
  const canCopy =
    params.mode === 'copy' ||
    (params.mode !== 'reencode' &&
      metas.every(
        (m) =>
          m.width === targetW &&
          m.height === targetH &&
          m.videoCodec === metas[0].videoCodec &&
          m.hasAudio === metas[0].hasAudio
      ));

  if (canCopy) {
    onProgress({ stage: 'concatenating', mode: 'fast-stream-copy' });
    const listFile = path.join(os.tmpdir(), `concat_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`);
    const fileContent = absInputs.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFile, fileContent, 'utf8');

    try {
      const args = ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', absOut];
      await execFfmpeg(args, { onProgress, cwd });
    } finally {
      if (fs.existsSync(listFile)) fs.unlinkSync(listFile);
    }
  } else {
    // Re-encoding through filter_complex handles different resolutions, fps, and missing audio tracks
    onProgress({ stage: 'concatenating', mode: 'filter-complex-reencode' });

    const args = ['-y', '-loglevel', 'error'];
    for (const f of absInputs) {
      args.push('-i', f);
    }

    const filterParts = [];
    const concatInputs = [];

    for (let i = 0; i < absInputs.length; i++) {
      // Normalize video: scale & pad to target resolution and fps
      filterParts.push(
        `[${i}:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${targetFps}[v${i}]`
      );

      // Handle audio: if clip lacks audio, generate silent audio stream
      if (metas[i].hasAudio) {
        filterParts.push(`[${i}:a]aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[a${i}]`);
      } else {
        filterParts.push(`aevalsrc=0:d=${metas[i].duration || 1}:s=48000[a${i}]`);
      }

      concatInputs.push(`[v${i}][a${i}]`);
    }

    filterParts.push(`${concatInputs.join('')}concat=n=${absInputs.length}:v=1:a=1[outv][outa]`);

    args.push(
      '-filter_complex', filterParts.join(';'),
      '-map', '[outv]',
      '-map', '[outa]',
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      absOut
    );

    await execFfmpeg(args, { onProgress, cwd });
  }

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
    clipsCount: absInputs.length,
    mode: canCopy ? 'stream-copy' : 'reencode',
  };
}
