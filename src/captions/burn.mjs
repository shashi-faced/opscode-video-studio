// Burn captions into an existing video (plan 13, Phase 4).
//  1. caption chunks → distinct caption states with time windows (page.mjs);
//  2. headless Chrome draws each state once as a transparent PNG with the studio's caption CSS
//     (any script, incl. Devanagari, shaped correctly — this ffmpeg has no HarfBuzz for ASS);
//  3. one ffmpeg pass lays the PNG sequence (concat list with durations) over the video;
//     the sound is copied as it is.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { findFfmpeg } from '../deps/locate.mjs';
import { launchBrowser } from '../render/browser.mjs';
import { writeCaptionPage, captionStates } from './page.mjs';

function userError(message, fix) { const e = new Error(message); e.fix = fix; return e; }

/** Size (after rotation), fps, length and whether there is sound, from one decoded frame. */
export function probeVideo(file) {
  const ff = findFfmpeg();
  if (!ff) throw userError('ffmpeg not found', 'run video_doctor with install=true');
  if (!fs.existsSync(file)) throw userError(`file not found: ${file}`, 'check the path (relative to the workspace)');
  const r = spawnSync(ff, ['-hide_banner', '-i', file, '-map', '0:v:0?', '-vf', 'showinfo', '-frames:v', '1', '-f', 'null', '-'], { encoding: 'utf8' });
  const err = r.stderr || '';
  const s = err.match(/showinfo[^\n]*\ss:(\d+)x(\d+)/);
  if (!s) throw userError(`${file} has no video picture`, 'use a video file (for audio only, make a video first)');
  const dur = err.match(/Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/);
  const fps = err.match(/,\s*(\d+(?:\.\d+)?)\s*fps/);
  return {
    width: +s[1], height: +s[2],
    duration: dur ? +dur[1] * 3600 + +dur[2] * 60 + +dur[3] : null,
    fps: fps ? +fps[1] : 30,
    hasAudio: /Stream #0:\d+[^\n]*: Audio:/.test(err),
  };
}

function runFfmpeg(args, { onTime, total } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(findFfmpeg(), args);
    let err = '';
    p.stderr.on('data', d => {
      err += d; if (err.length > 20000) err = err.slice(-10000);
      const m = String(d).match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m && onTime) onTime(Math.min(total || Infinity, +m[1] * 3600 + +m[2] * 60 + +m[3]));
    });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`ffmpeg failed: ${err.trim().split('\n').slice(-3).join(' ')}`))));
  });
}

/**
 * @param o.input     video file
 * @param o.captions  caption chunks [{ start, end, html, words? }] (absolute seconds)
 * @param o.out       output .mp4
 * @param o.style, o.position, o.platform, o.theme, o.highlight  look (see page.mjs)
 * @param o.workDir   folder for the caption stills (kept for re-burns; removed when done unless keep)
 * @returns { file, width, height, duration, states, stills, seconds }
 */
export async function burnCaptions({ input, captions, out, style = 'pop', position = 'bottom', platform, theme, highlight, workDir, keep = false, crf = 18, onProgress = () => {} }) {
  const t0 = Date.now();
  const v = probeVideo(input);
  const duration = v.duration || Math.max(0, ...captions.map(c => c.end));
  const dir = workDir || path.join(path.dirname(path.resolve(out)), `.captions-${path.basename(out, path.extname(out))}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const states = captionStates(captions, duration, style);

  // 2. Draw each distinct state once.
  const page = writeCaptionPage(dir, { width: v.width, height: v.height, style, position, platform, theme, highlight });
  const files = new Map();
  const blank = path.join(dir, 'blank.png');
  const browser = await launchBrowser();
  try {
    const p = await browser.newPage({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1 });
    await p.goto(pathToFileURL(page).href);
    await p.evaluate(() => window.ready);
    const cdp = await p.context().newCDPSession(p);
    await cdp.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
    const shoot = async (file) => {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false, optimizeForSpeed: true });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
    };
    await p.evaluate(() => window.setCaption('', -1, 1));
    await shoot(blank);
    const unique = [...new Set(states.filter(s => s.html).map(s => JSON.stringify([s.html, s.on, s.scale])))];
    let done = 0;
    for (const key of unique) {
      const [html, on, scale] = JSON.parse(key);
      const f = path.join(dir, `s${crypto.createHash('sha1').update(key).digest('hex').slice(0, 12)}.png`);
      await p.evaluate(([h, o, s]) => window.setCaption(h, o, s), [html, on, scale]);
      await shoot(f);
      files.set(key, f);
      if (++done % 25 === 0 || done === unique.length) onProgress({ stage: 'captions', step: 'draw', done, total: unique.length });
    }
  } finally { await browser.close().catch(() => {}); }

  // 3. One overlay pass. The concat list repeats the last file without a duration (ffmpeg's rule).
  const list = path.join(dir, 'states.txt');
  const q = (f) => `file '${f.replace(/'/g, "'\\''")}'`;
  const lines = [];
  for (const s of states) {
    const f = s.html ? files.get(JSON.stringify([s.html, s.on, s.scale])) : blank;
    lines.push(q(f), `duration ${(s.t1 - s.t0).toFixed(4)}`);
  }
  lines.push(q(blank));
  fs.writeFileSync(list, lines.join('\n') + '\n');
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  const tmp = out.replace(/\.mp4$/i, '') + '.part.mp4';
  const args = ['-y', '-hide_banner', '-i', input, '-f', 'concat', '-safe', '0', '-i', list,
    '-filter_complex', '[0:v][1:v]overlay=0:0:format=auto:eof_action=pass,format=yuv420p[v]',
    '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf),
    '-c:a', 'copy', '-movflags', '+faststart', tmp];
  await runFfmpeg(args, { total: duration, onTime: (t) => onProgress({ stage: 'captions', step: 'encode', done: Math.round(t), total: Math.round(duration) }) });
  fs.renameSync(tmp, out);
  const stills = files.size + 1;
  if (!keep) fs.rmSync(dir, { recursive: true, force: true });
  return { file: path.resolve(out), width: v.width, height: v.height, duration: +duration.toFixed(3), states: states.length, stills, seconds: +((Date.now() - t0) / 1000).toFixed(1) };
}
