// Downloadable 3D assets (plan 12, Phase 3). The repo ships only a manifest (links, sizes, SHA-256,
// licence); files are downloaded on request into the user's cache and checked before use.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HOME_DIR } from '../deps/locate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const SETS = { '3d-starter': path.join(HERE, '3d-starter.json'), '3d-world': path.join(HERE, '3d-world.json') };
export const ASSET_DIR = path.join(HOME_DIR, 'cache', 'video-assets', '3d');

export const loadSet = (set = '3d-starter') => {
  const f = SETS[set];
  if (!f) throw new Error(`unknown asset set "${set}" (sets: ${Object.keys(SETS).join(', ')})`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
};

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const okMarker = (m) => path.join(ASSET_DIR, `${m.file}.ok`);

/** A model is ready when its file exists with the right size and its checksum was verified at install. */
function ready(m) {
  const f = path.join(ASSET_DIR, m.file);
  try { return fs.statSync(f).size === m.size && fs.readFileSync(okMarker(m), 'utf8').trim() === m.sha256; } catch { return false; }
}

export function assetStatus(set = '3d-starter') {
  const s = loadSet(set);
  const models = s.models.map(m => ({ kind: m.kind || null, name: m.name, file: m.file, sizeKB: Math.round(m.size / 1024), licence: m.licence, page: m.page, installed: ready(m) }));
  return {
    set: s.set, title: s.title, credit: s.credit, checked: s.checked, dir: ASSET_DIR,
    installed: models.filter(m => m.installed).length, total: models.length,
    sizeMB: +(s.models.reduce((n, m) => n + m.size, 0) / 1048576).toFixed(1),
    models,
  };
}

/** Download every missing model of the set, verifying each SHA-256. */
export async function installAssets(set = '3d-starter', { onProgress = () => {}, force = false } = {}) {
  const s = loadSet(set);
  fs.mkdirSync(ASSET_DIR, { recursive: true });
  const failed = [];
  let done = 0;
  for (const m of s.models) {
    if (!force && ready(m)) { onProgress({ stage: 'assets', done: ++done, total: s.models.length, kind: m.kind, cached: true }); continue; }
    try {
      let buf = null, lastErr = null;
      for (let attempt = 0; attempt < 3 && !buf; attempt++) {
        try {
          const r = await fetch(m.url, { signal: AbortSignal.timeout(60000) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          buf = Buffer.from(await r.arrayBuffer());
        } catch (e) { lastErr = e; await new Promise(res => setTimeout(res, 1000 * (attempt + 1))); }
      }
      if (!buf) throw lastErr || new Error('download failed');
      const got = sha256(buf);
      if (got !== m.sha256) throw new Error(`checksum mismatch (got ${got.slice(0, 12)}…, expected ${m.sha256.slice(0, 12)}…); the file changed at the source, so it was not used`);
      const f = path.join(ASSET_DIR, m.file);
      fs.writeFileSync(`${f}.tmp`, buf);
      fs.renameSync(`${f}.tmp`, f);
      fs.writeFileSync(okMarker(m), m.sha256);
    } catch (e) { failed.push({ kind: m.kind, error: e.message }); }
    onProgress({ stage: 'assets', done: ++done, total: s.models.length, kind: m.kind });
  }
  return { ...assetStatus(set), failed };
}

export function removeAssets(set = '3d-starter') {
  const s = loadSet(set);
  for (const m of s.models) for (const f of [path.join(ASSET_DIR, m.file), okMarker(m)]) fs.rmSync(f, { force: true });
  return assetStatus(set);
}

/** Installed world prop (Kenney scenery) by name, or null. */
export function propFor(name) {
  const m = loadSet('3d-world').models.find(x => x.name === name);
  return m && ready(m) ? { ...m, path: path.join(ASSET_DIR, m.file) } : null;
}

/** Installed model for a character kind, or null (then the built-in procedural character is used). */
export function modelFor(kind, set = '3d-starter') {
  const m = loadSet(set).models.find(x => x.kind === kind);
  return m && ready(m) ? { ...m, path: path.join(ASSET_DIR, m.file) } : null;
}
