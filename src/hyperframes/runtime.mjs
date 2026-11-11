// HyperFrames engine (plan 16): the open-source HTML-to-video renderer (Apache 2.0, heygen-com/hyperframes),
// installed on request into the agent's home at a pinned version, like the speech runtime. Only its local
// commands are ever called; its cloud, publish, share and paid commands are not reachable from here.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { HOME_DIR, findChrome, findFfmpeg } from '../deps/locate.mjs';
import { UserError } from '../render/browser.mjs';

export const HF_DIR = path.join(HOME_DIR, 'hyperframes');
export const HF_VERSION = '0.9.33';
export const GSAP_VERSION = '3.14.2';
const FFPROBE_PKG = '@ffprobe-installer/ffprobe';
const FFPROBE_VERSION = '2.1.2';
export const MIN_NODE = 22;
const EXE = process.platform === 'win32' ? '.exe' : '';

/** The only HyperFrames commands this agent runs. Anything that uploads or bills is left out on purpose. */
export const ALLOWED_COMMANDS = new Set(['init', 'add', 'catalog', 'lint', 'check', 'snapshot', 'render', 'info', 'docs', 'compositions']);

const dirSize = (d) => {
  let n = 0;
  try {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) n += dirSize(p); else if (e.isFile()) n += fs.statSync(p).size;
    }
  } catch { /* missing */ }
  return n;
};
const pkgVersion = (name) => { try { return JSON.parse(fs.readFileSync(path.join(HF_DIR, 'node_modules', name, 'package.json'), 'utf8')).version; } catch { return null; } };

export const nodeMajor = () => +process.versions.node.split('.')[0];

/** ffprobe: next to our ffmpeg, on PATH, or the copy installed with the HyperFrames runtime. */
export function findFfprobe() {
  if (process.env.OPSCODE_VIDEO_FFPROBE && fs.existsSync(process.env.OPSCODE_VIDEO_FFPROBE)) return process.env.OPSCODE_VIDEO_FFPROBE;
  const ff = findFfmpeg();
  if (ff && path.isAbsolute(ff)) {
    const sib = path.join(path.dirname(ff), `ffprobe${EXE}`);
    if (fs.existsSync(sib)) return sib;
  }
  for (const d of String(process.env.PATH || '').split(path.delimiter)) {
    if (d && fs.existsSync(path.join(d, `ffprobe${EXE}`))) return path.join(d, `ffprobe${EXE}`);
  }
  const plat = `${process.platform}-${process.arch}`;
  const own = path.join(HF_DIR, 'node_modules', '@ffprobe-installer', plat, `ffprobe${EXE}`);
  return fs.existsSync(own) ? own : null;
}

export function gsapFile() {
  const f = path.join(HF_DIR, 'node_modules', 'gsap', 'dist', 'gsap.min.js');
  return fs.existsSync(f) ? f : null;
}

export function runtimeStatus() {
  const version = pkgVersion('hyperframes');
  return {
    installed: !!version && !!gsapFile(), version, wanted: HF_VERSION, dir: HF_DIR,
    node: process.version, nodeOk: nodeMajor() >= MIN_NODE,
    ffprobe: findFfprobe(), chrome: findChrome() || null,
    sizeMB: version ? Math.round(dirSize(path.join(HF_DIR, 'node_modules')) / 1048576) : 0,
  };
}

function needNode() {
  if (nodeMajor() < MIN_NODE) {
    throw new UserError(`HyperFrames needs Node.js ${MIN_NODE} or newer; this computer runs ${process.version}`,
      `install Node.js ${MIN_NODE}+ (nodejs.org), restart the app, and try again. Until then make this video with the storyboard tools (video_templates, video_render)`);
  }
}

function run(cmd, args, cwd) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: process.platform === 'win32' });
    let err = '';
    p.stdout.on('data', () => {});
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.slice(0, 2).join(' ')} failed (${code}): ${err.slice(-400)}`))));
  });
}

/** Install (or repair) the HyperFrames runtime: about 125 MB, plus ffprobe (80 MB) when the computer has none. */
export async function installRuntime({ onProgress = () => {}, force = false } = {}) {
  needNode();
  const st = runtimeStatus();
  if (!force && st.installed && st.version === HF_VERSION && st.ffprobe) return { ...st, already: true };
  fs.mkdirSync(HF_DIR, { recursive: true });
  const pj = path.join(HF_DIR, 'package.json');
  if (!fs.existsSync(pj)) fs.writeFileSync(pj, JSON.stringify({ name: 'opscode-video-hyperframes', private: true, type: 'module' }, null, 2));
  const pkgs = [`hyperframes@${HF_VERSION}`, `gsap@${GSAP_VERSION}`];
  if (!findFfprobe()) pkgs.push(`${FFPROBE_PKG}@${FFPROBE_VERSION}`);
  onProgress({ stage: 'hyperframes-runtime', step: 'npm install' });
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', ...pkgs], HF_DIR);
  return runtimeStatus();
}

export function removeRuntime() {
  for (const d of ['node_modules', 'cache']) fs.rmSync(path.join(HF_DIR, d), { recursive: true, force: true });
  fs.rmSync(path.join(HF_DIR, 'package-lock.json'), { force: true });
  return runtimeStatus();
}

/** Environment for every HyperFrames call: no usage tracking, no skill installs, our Chrome/ffmpeg, our cache folder. */
export function hfEnv() {
  const chrome = findChrome(), ffmpeg = findFfmpeg(), ffprobe = findFfprobe();
  return {
    ...process.env,
    DO_NOT_TRACK: '1', HYPERFRAMES_NO_TELEMETRY: '1', HYPERFRAMES_SKIP_SKILLS: '1', CI: '1', NO_UPDATE_NOTIFIER: '1',
    HYPERFRAMES_CACHE_DIR: path.join(HF_DIR, 'cache'),
    ...(chrome ? { HYPERFRAMES_BROWSER_PATH: chrome } : {}),
    ...(ffmpeg && path.isAbsolute(ffmpeg) ? { HYPERFRAMES_FFMPEG_PATH: ffmpeg } : {}),
    ...(ffprobe ? { HYPERFRAMES_FFPROBE_PATH: ffprobe, PATH: `${path.dirname(ffprobe)}${path.delimiter}${process.env.PATH || ''}` } : {}),
  };
}

function needRuntime() {
  needNode();
  const st = runtimeStatus();
  if (!st.installed) throw new UserError('the HyperFrames engine is not installed yet', 'call hyperframes_project with action "init" (it installs the engine once, about 125 MB), then continue');
  if (!st.ffprobe) throw new UserError('ffprobe was not found (HyperFrames needs it to read media files)', 'call hyperframes_project with action "init" again to install it, or install ffmpeg with ffprobe (sudo apt install ffmpeg / brew install ffmpeg)');
  return st;
}

/**
 * Run one HyperFrames command. Returns { code, stdout, stderr, json } where json is the JSON object
 * the command printed (with --json), or null. `onLine` receives progress lines as they come.
 */
export function hf(args, { cwd, timeoutMs = 120000, onLine } = {}) {
  needRuntime();
  if (!ALLOWED_COMMANDS.has(args[0])) throw new Error(`HyperFrames command "${args[0]}" is not allowed here`);
  const entry = path.join(HF_DIR, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs');
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [entry, ...args], { cwd, env: hfEnv() });
    let stdout = '', stderr = '';
    const feed = (d) => { for (const l of String(d).split(/\r?\n|\r/)) if (l.trim()) onLine?.(l); };
    p.stdout.on('data', d => { stdout += d; feed(d); });
    p.stderr.on('data', d => { stderr += d; if (stderr.length > 200000) stderr = stderr.slice(-100000); feed(d); });
    const timer = setTimeout(() => { p.kill('SIGKILL'); }, timeoutMs);
    p.on('error', (e) => { clearTimeout(timer); resolve({ code: 1, stdout, stderr: String(e.message || e), json: null }); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code: code ?? 1, stdout, stderr, json: lastJson(stdout) }); });
  });
}

/** The last complete JSON object or array in a command's output. */
export function lastJson(text) {
  const t = String(text || '');
  for (let i = t.length - 1; i >= 0; i--) {
    const c = t[i];
    if (c !== '}' && c !== ']') continue;
    const open = c === '}' ? '{' : '[';
    for (let j = t.lastIndexOf(open, i); j !== -1; j = j > 0 ? t.lastIndexOf(open, j - 1) : -1) {
      try { return JSON.parse(t.slice(j, i + 1)); } catch { /* try an earlier opening bracket */ }
    }
    return null;
  }
  return null;
}

/** Version check without spawning: used by video_doctor. */
export function quickCheck() {
  const st = runtimeStatus();
  const r = st.installed && st.nodeOk ? spawnSync(process.execPath, [path.join(HF_DIR, 'node_modules', 'hyperframes', 'bin', 'hyperframes.mjs'), '--version'], { encoding: 'utf8', env: hfEnv(), timeout: 20000 }) : null;
  return { ...st, runs: !!r && r.status === 0 };
}
