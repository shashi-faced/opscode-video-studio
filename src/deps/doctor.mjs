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
  // Graphics card for 3D (optional: without it 3D still renders on the CPU, slower and at 2/3 resolution).
  if (chrome) {
    try {
      const { gpuWorks } = await import('../render/browser.mjs');
      const g = await gpuWorks();
      report.items.push({ name: 'GPU for 3D (optional)', ok: true, detail: g ? 'graphics card works in Chrome (fast 3D)' : 'not available; 3D draws on the CPU, slower and at 2/3 resolution', fix: g ? undefined : 'update the graphics drivers (Linux: Mesa with Vulkan, e.g. sudo apt install mesa-vulkan-drivers)' });
    } catch { /* GPU probe failed: nothing to report */ }
  }
  // Optional HyperFrames engine for motion-design videos (never required: storyboards do not use it).
  try {
    const { runtimeStatus, MIN_NODE, HF_VERSION } = await import('../hyperframes/runtime.mjs');
    const h = runtimeStatus();
    report.items.push({
      name: 'HyperFrames engine (optional)', ok: true,
      detail: !h.nodeOk ? `needs Node.js ${MIN_NODE} or newer (this is ${h.node}); storyboard videos are not affected`
        : h.installed ? `installed ${h.version} (${h.sizeMB} MB)${h.version !== HF_VERSION ? `, this release expects ${HF_VERSION}` : ''}${h.ffprobe ? '' : '; ffprobe is missing'}`
          : 'not installed (about 200 MB, installed the first time a HyperFrames video is made)',
      fix: !h.nodeOk ? `install Node.js ${MIN_NODE}+ to use HyperFrames videos` : undefined,
    });
  } catch { /* optional */ }
  // Optional 3D character pack (never required: 3D characters are built in code without it).
  try {
    const { assetStatus } = await import('../assets/assets.mjs');
    for (const [set, label] of [['3d-starter', '3D character pack'], ['3d-world', '3D world pack']]) {
      const a = assetStatus(set);
      report.items.push({ name: `${label} (optional)`, ok: true, detail: a.installed ? `${a.installed}/${a.total} installed (CC0)` : 'not installed; 3D uses models made in code', fix: a.installed < a.total ? `opscode-video assets install ${set} (${a.sizeMB} MB)` : undefined });
    }
  } catch { /* manifest missing: nothing to report */ }
  // Speech models for word-by-word captions from any video (optional: captions of generated videos use voice timings).
  try {
    const { runtimeStatus } = await import('../asr/runtime.mjs');
    const { modelStatus } = await import('../asr/models.mjs');
    const rt = runtimeStatus(), ms = modelStatus(), have = ms.filter(m => m.installed);
    report.items.push({ name: 'speech for captions (optional)', ok: true,
      detail: rt.installed && have.length ? `Whisper ${have.map(m => m.id).join(', ')} installed, engine ${rt.sizeMB} MB` : 'not installed; captions of generated videos still follow the voice',
      fix: rt.installed && have.length ? undefined : 'video_assets install whisper-small (about 340 MB with the engine) for captions on any video' });
  } catch { /* manifest missing: nothing to report */ }
  return report;
}
