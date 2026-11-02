// Dependency check + optional install of a headless Chrome.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import zlib from 'node:zlib';
import { findChrome, findFfmpeg, HOME_DIR, OWN_FFMPEG } from './locate.mjs';

// Static ffmpeg builds (GPL, from the ffmpeg-static project). Only fetched when no ffmpeg is installed.
const FFMPEG_URL = (plat, arch) => `https://github.com/eugeneware/ffmpeg-static/releases/download/b6.0/ffmpeg-${plat}-${arch}.gz`;

export async function downloadFfmpeg() {
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
  const res = await fetch(FFMPEG_URL(process.platform, arch), { redirect: 'follow' });
  if (!res.ok) throw new Error(`ffmpeg download failed: HTTP ${res.status}`);
  const bin = zlib.gunzipSync(Buffer.from(await res.arrayBuffer()));
  fs.mkdirSync(path.dirname(OWN_FFMPEG), { recursive: true });
  const tmp = OWN_FFMPEG + '.part';
  fs.writeFileSync(tmp, bin, { mode: 0o755 });
  fs.renameSync(tmp, OWN_FFMPEG);
  return OWN_FFMPEG;
}
import { fontFiles } from '../compiler/themes.mjs';

async function ttsReachable() {
  try {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    const tts = new MsEdgeTTS({ connectionTimeoutMs: 8000, synthesisTimeoutMs: 15000 });
    await tts.setMetadata('en-IN-NeerjaNeural', OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    tts.close?.();
    return true;
  } catch { return false; }
}

export async function doctor({ install = false, checkNetwork = true } = {}) {
  const report = { node: process.version, ok: true, items: [] };
  const item = (name, ok, detail, fix) => { report.items.push({ name, ok, detail, fix }); if (!ok && name !== 'voice (internet)') report.ok = false; };

  const major = +process.versions.node.split('.')[0];
  item('node', major >= 18, process.version, major >= 18 ? undefined : 'install Node.js 18 or newer');

  let chrome = findChrome();
  if (!chrome && install) {
    const dir = path.join(HOME_DIR, 'browsers');
    fs.mkdirSync(dir, { recursive: true });
    const r = spawnSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['-y', '@puppeteer/browsers@2', 'install', 'chrome-headless-shell@stable', '--path', dir], { encoding: 'utf8', timeout: 600000 });
    if (r.status !== 0) report.installLog = (r.stderr || r.stdout || '').slice(-800);
    chrome = findChrome();
  }
  item('chrome', !!chrome, chrome || 'not found', chrome ? undefined : 'run doctor with install=true, or set OPSCODE_VIDEO_CHROME to a Chrome/Chromium path');

  let ff = findFfmpeg();
  if (!ff && install) {
    try { await downloadFfmpeg(); } catch (e) { report.ffmpegInstallError = String(e.message || e); }
    ff = findFfmpeg();
  }
  let ffv = null;
  if (ff) { try { ffv = execFileSync(ff, ['-version'], { encoding: 'utf8' }).split('\n')[0]; } catch {} }
  item('ffmpeg', !!ffv, ffv ? `${ffv.slice(0, 60)} (${ff})` : 'not found', ffv ? undefined : 'install ffmpeg (sudo apt install ffmpeg / brew install ffmpeg), or run doctor with install=true to download it');

  const fonts = fontFiles();
  item('fonts', fonts.length >= 8, `${fonts.length} bundled font files`, fonts.length >= 8 ? undefined : 'reinstall the agent (npm install)');

  if (checkNetwork) {
    const net = await ttsReachable();
    item('voice (internet)', net, net ? 'Edge neural voices reachable' : 'not reachable', net ? undefined : 'videos still render; voice is skipped and captions remain');
  }
  report.home = HOME_DIR;
  return report;
}
