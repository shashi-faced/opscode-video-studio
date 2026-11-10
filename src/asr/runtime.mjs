// Speech runtime (plan 13): transformers.js + ONNX Runtime, installed on request into the agent's
// home, not as a package dependency (a plain install is ~745 MB; trimmed to this computer it is far smaller).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { HOME_DIR } from '../deps/locate.mjs';

export const ASR_DIR = path.join(HOME_DIR, 'asr');
export const TRANSFORMERS_VERSION = '4.3.2';
const PKG = '@huggingface/transformers';

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

/** Installed transformers.js version, or null. */
export function runtimeVersion() {
  try { return JSON.parse(fs.readFileSync(path.join(ASR_DIR, 'node_modules', PKG, 'package.json'), 'utf8')).version; } catch { return null; }
}

export function runtimeStatus() {
  const version = runtimeVersion();
  return { installed: !!version, version, dir: ASR_DIR, sizeMB: version ? Math.round(dirSize(path.join(ASR_DIR, 'node_modules')) / 1048576) : 0 };
}

/**
 * Remove what this computer never loads: ONNX Runtime builds for other systems, the NVIDIA (CUDA/TensorRT)
 * providers, and the browser build of ONNX Runtime. Returns the bytes freed.
 */
export function trimRuntime(dir = ASR_DIR, platform = process.platform, arch = process.arch) {
  let freed = 0;
  const rm = (p) => { if (fs.existsSync(p)) { freed += fs.statSync(p).isDirectory() ? dirSize(p) : fs.statSync(p).size; fs.rmSync(p, { recursive: true, force: true }); } };
  const nm = path.join(dir, 'node_modules');
  const bin = path.join(nm, 'onnxruntime-node', 'bin');
  if (fs.existsSync(bin)) {
    for (const napi of fs.readdirSync(bin)) {
      const base = path.join(bin, napi);
      for (const os of fs.readdirSync(base)) {
        if (os !== platform) { rm(path.join(base, os)); continue; }
        for (const a of fs.readdirSync(path.join(base, os))) {
          if (a !== arch) { rm(path.join(base, os, a)); continue; }
          for (const f of fs.readdirSync(path.join(base, os, a))) if (/providers_(cuda|tensorrt)|DirectML|dxcompiler|dxil/i.test(f)) rm(path.join(base, os, a, f));
        }
      }
    }
  }
  // Browser build: Node uses onnxruntime-node. Keep its package.json so imports that only resolve it still work.
  const web = path.join(nm, 'onnxruntime-web', 'dist');
  if (fs.existsSync(web)) {
    for (const f of fs.readdirSync(web)) if (/\.(wasm|map)$/.test(f) || /^ort\.(all|webgpu|webgl|wasm|training)/.test(f) || /ort-wasm/.test(f)) rm(path.join(web, f));
  }
  return freed;
}

function run(cmd, args, cwd, onLine) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { cwd, shell: process.platform === 'win32' });
    let err = '';
    p.stdout.on('data', d => onLine?.(String(d)));
    p.stderr.on('data', d => { err += d; });
    p.on('error', reject);
    p.on('close', code => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} failed (${code}): ${err.slice(-400)}`))));
  });
}

/** Install (or repair) the speech runtime. Needs npm and the internet once. */
export async function installRuntime({ onProgress = () => {}, force = false } = {}) {
  if (!force && runtimeVersion() === TRANSFORMERS_VERSION) return { ...runtimeStatus(), already: true };
  fs.mkdirSync(ASR_DIR, { recursive: true });
  const pj = path.join(ASR_DIR, 'package.json');
  if (!fs.existsSync(pj)) fs.writeFileSync(pj, JSON.stringify({ name: 'opscode-video-asr', private: true, type: 'module' }, null, 2));
  onProgress({ stage: 'speech-runtime', step: 'npm install' });
  await run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund', '--loglevel=error', `${PKG}@${TRANSFORMERS_VERSION}`], ASR_DIR);
  onProgress({ stage: 'speech-runtime', step: 'trim' });
  const freed = trimRuntime();
  return { ...runtimeStatus(), freedMB: Math.round(freed / 1048576) };
}

export function removeRuntime() {
  fs.rmSync(path.join(ASR_DIR, 'node_modules'), { recursive: true, force: true });
  fs.rmSync(path.join(ASR_DIR, 'package-lock.json'), { force: true });
  return runtimeStatus();
}

let loaded = null;
/** The transformers.js module, loaded from the agent's home. Throws a clear error when missing. */
export async function loadTransformers() {
  if (loaded) return loaded;
  if (!runtimeVersion()) {
    const e = new Error('the speech engine for captions is not installed');
    e.fix = 'run video_assets with action "install" and set "whisper-small" (downloads the engine and a 240 MB model once)';
    throw e;
  }
  const req = createRequire(path.join(ASR_DIR, 'package.json'));
  loaded = await import(pathToFileURL(req.resolve(PKG)).href);
  return loaded;
}
