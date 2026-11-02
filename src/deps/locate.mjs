// Find Chrome and ffmpeg. Returns paths or null with a fix hint.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export const HOME_DIR = process.env.OPSCODE_VIDEO_HOME || path.join(os.homedir(), '.opscode', 'agents', 'video-studio');

const which = (cmd) => {
  try { return execFileSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' }).split(/\r?\n/)[0].trim() || null; }
  catch { return null; }
};
const exists = (p) => p && fs.existsSync(p) ? p : null;

export function findChrome() {
  if (exists(process.env.OPSCODE_VIDEO_CHROME)) return process.env.OPSCODE_VIDEO_CHROME;
  // Browser downloaded by `doctor --install`.
  const own = path.join(HOME_DIR, 'browsers');
  if (fs.existsSync(own)) {
    const hit = walk(own, /^(chrome-headless-shell|chrome|chrome\.exe|chrome-headless-shell\.exe)$/);
    if (hit) return hit;
  }
  // Playwright's cache.
  const pwCache = process.platform === 'darwin' ? path.join(os.homedir(), 'Library/Caches/ms-playwright')
    : process.platform === 'win32' ? path.join(os.homedir(), 'AppData/Local/ms-playwright') : path.join(os.homedir(), '.cache/ms-playwright');
  if (fs.existsSync(pwCache)) {
    const hit = walk(pwCache, /^(chrome|headless_shell|chrome-headless-shell|chrome\.exe)$/);
    if (hit) return hit;
  }
  const candidates = {
    linux: ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge'].map(which),
    darwin: ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'],
    win32: [
      path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
      path.join(os.homedir(), 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    ],
  }[process.platform] || [];
  for (const c of candidates) if (exists(c)) return c;
  return null;
}

function walk(dir, re, depth = 0) {
  if (depth > 6) return null;
  let entries = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return null; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isFile() && re.test(e.name)) return p;
  }
  for (const e of entries) if (e.isDirectory()) { const r = walk(path.join(dir, e.name), re, depth + 1); if (r) return r; }
  return null;
}

const EXE = process.platform === 'win32' ? '.exe' : '';
export const OWN_FFMPEG = path.join(HOME_DIR, 'bin', `ffmpeg${EXE}`);

// System ffmpeg first (no download), then the copy `doctor --install` fetched.
export function findFfmpeg() {
  if (exists(process.env.OPSCODE_VIDEO_FFMPEG)) return process.env.OPSCODE_VIDEO_FFMPEG;
  const onPath = which('ffmpeg');
  if (onPath) return onPath;
  // Desktop launches often have a short PATH; check the usual places too.
  for (const p of [path.join(os.homedir(), '.local/bin/ffmpeg'), '/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/bin/ffmpeg']) if (exists(p)) return p;
  if (exists(OWN_FFMPEG)) return OWN_FFMPEG;
  try { const p = require('@ffmpeg-installer/ffmpeg').path; if (exists(p)) return p; } catch {}
  return null;
}
