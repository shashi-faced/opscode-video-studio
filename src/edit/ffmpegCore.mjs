// Core FFmpeg runner, parser, and media inspection utilities
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { findFfmpeg } from '../deps/locate.mjs';

export class VideoError extends Error {
  constructor(message, fix) {
    super(message);
    this.name = 'VideoError';
    this.fix = fix;
  }
}

export function getFfmpegBin() {
  const bin = findFfmpeg();
  if (!bin) {
    throw new VideoError(
      'FFmpeg binary was not found.',
      'Run video_doctor with install=true, or ensure ffmpeg is in PATH or ~/.local/bin/ffmpeg.'
    );
  }
  return bin;
}

/**
 * Parses time formats into numeric seconds:
 * - 12.5 -> 12.5
 * - "12.5" -> 12.5
 * - "12s" -> 12.0
 * - "01:23" -> 83.0 (MM:SS)
 * - "00:01:23.500" -> 83.5 (HH:MM:SS.mmm)
 */
export function parseSeconds(val) {
  if (val === undefined || val === null || val === '') return undefined;
  if (typeof val === 'number') return Math.max(0, val);
  const s = String(val).trim().replace(/s$/i, '');
  if (!s) return undefined;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.max(0, parseFloat(s));
  const parts = s.split(':').map((p) => parseFloat(p));
  if (parts.some((p) => isNaN(p))) return undefined;
  if (parts.length === 3) return Math.max(0, parts[0] * 3600 + parts[1] * 60 + parts[2]);
  if (parts.length === 2) return Math.max(0, parts[0] * 60 + parts[1]);
  return undefined;
}

export function formatSeconds(secs) {
  if (typeof secs !== 'number' || isNaN(secs) || secs < 0) secs = 0;
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const ms = Math.floor((secs % 1) * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const pad3 = (n) => String(n).padStart(3, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad3(ms)}`;
}

export async function execFfmpeg(args, { onProgress = () => {}, cwd = process.cwd() } = {}) {
  const ffmpeg = getFfmpegBin();
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      // Capture FFmpeg progress timestamp: time=00:00:15.20
      const timeMatch = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
      if (timeMatch) {
        const secs =
          parseInt(timeMatch[1], 10) * 3600 +
          parseInt(timeMatch[2], 10) * 60 +
          parseFloat(timeMatch[3]);
        onProgress({ stage: 'encoding', seconds: secs });
      }
    });

    ff.on('close', (code) => {
      if (code === 0) {
        resolve({ ok: true });
      } else {
        const lastErr = stderr
          .trim()
          .split('\n')
          .slice(-8)
          .map((l) => l.trim())
          .filter(Boolean)
          .join(' | ');
        reject(
          new VideoError(
            `FFmpeg failed (code ${code}): ${lastErr || 'Unknown error'}`,
            'Check that input file paths exist and video/audio formats are valid.'
          )
        );
      }
    });

    ff.on('error', (err) => {
      reject(new VideoError(`Failed to execute FFmpeg: ${err.message}`, 'Check system permissions and ffmpeg binary path'));
    });
  });
}

export async function inspectMedia(filePath, { cwd = process.cwd() } = {}) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);
  if (!fs.existsSync(absPath)) {
    throw new VideoError(`File not found: ${filePath}`, 'Provide an existing video or audio file path.');
  }

  const ffmpeg = getFfmpegBin();
  return new Promise((resolve, reject) => {
    const ff = spawn(ffmpeg, ['-hide_banner', '-i', absPath], { cwd, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    ff.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    ff.on('close', () => {
      // Duration: 00:01:23.45, start: 0.000000, bitrate: 1234 kb/s
      const durMatch = stderr.match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/);
      const duration = durMatch
        ? parseInt(durMatch[1], 10) * 3600 +
          parseInt(durMatch[2], 10) * 60 +
          parseFloat(durMatch[3])
        : 0;

      const bitrateMatch = stderr.match(/bitrate:\s*(\d+)\s*kb\/s/);
      const bitrateKbps = bitrateMatch ? parseInt(bitrateMatch[1], 10) : 0;

      // Stream #0:0(und): Video: h264 (High) (avc1 / ...), yuv420p(progressive), 1920x1080 [SAR 1:1 DAR 16:9], 30 fps
      const resMatch = stderr.match(/Video:.*?,\s*(\d{2,5})x(\d{2,5})/);
      const width = resMatch ? parseInt(resMatch[1], 10) : 0;
      const height = resMatch ? parseInt(resMatch[2], 10) : 0;

      const fpsMatch = stderr.match(/(\d+(?:\.\d+)?)\s*fps/);
      const fps = fpsMatch ? parseFloat(fpsMatch[1]) : 30;

      const vCodecMatch = stderr.match(/Stream #\d+:\d+.*?: Video:\s*([a-zA-Z0-9_-]+)/);
      const aCodecMatch = stderr.match(/Stream #\d+:\d+.*?: Audio:\s*([a-zA-Z0-9_-]+)/);

      const hasVideo = Boolean(resMatch || vCodecMatch);
      const hasAudio = Boolean(aCodecMatch);

      const size = fs.existsSync(absPath) ? fs.statSync(absPath).size : 0;
      const ext = path.extname(absPath).replace(/^\./, '').toLowerCase();

      resolve({
        ok: true,
        file: absPath,
        extension: ext,
        duration: +duration.toFixed(3),
        formattedDuration: formatSeconds(duration),
        width,
        height,
        aspectRatio: width && height ? `${width}:${height}` : undefined,
        fps,
        hasVideo,
        hasAudio,
        videoCodec: vCodecMatch ? vCodecMatch[1] : undefined,
        audioCodec: aCodecMatch ? aCodecMatch[1] : undefined,
        bitrateKbps,
        sizeBytes: size,
        sizeMB: +(size / 1048576).toFixed(2),
      });
    });

    ff.on('error', (err) => {
      reject(new VideoError(`FFmpeg inspection failed: ${err.message}`, 'Check ffmpeg installation'));
    });
  });
}

export async function extractFrame(videoPath, outJpg, timeSec = 1.0, { cwd = process.cwd() } = {}) {
  const absVid = path.isAbsolute(videoPath) ? videoPath : path.resolve(cwd, videoPath);
  const absOut = path.isAbsolute(outJpg) ? outJpg : path.resolve(cwd, outJpg);
  fs.mkdirSync(path.dirname(absOut), { recursive: true });

  const safeTime = Math.max(0, timeSec);
  try {
    await execFfmpeg(['-y', '-loglevel', 'error', '-ss', String(safeTime), '-i', absVid, '-frames:v', '1', '-q:v', '2', absOut], { cwd });
    if (fs.existsSync(absOut) && fs.statSync(absOut).size > 0) {
      return absOut;
    }
  } catch {
    // If seek past end or failed, try 0.0s
    try {
      await execFfmpeg(['-y', '-loglevel', 'error', '-ss', '0', '-i', absVid, '-frames:v', '1', '-q:v', '2', absOut], { cwd });
      if (fs.existsSync(absOut) && fs.statSync(absOut).size > 0) {
        return absOut;
      }
    } catch {}
  }
  return null;
}
