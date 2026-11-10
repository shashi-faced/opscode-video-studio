// Whisper models (plan 13): pinned files with SHA-256 from whisper-models.json, downloaded on request
// into the agent's home in the folder layout transformers.js reads (models/whisper/<repo>/...).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { HOME_DIR } from '../deps/locate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const MODEL_DIR = path.join(HOME_DIR, 'models', 'whisper');
export const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, 'whisper-models.json'), 'utf8'));

/** quality → model id. "fast" is English-only in practice (base writes Hindi in other scripts). */
export const QUALITY = { fast: 'base', balanced: 'small' };
export const SET_PREFIX = 'whisper-';

export function modelInfo(id) {
  const m = MANIFEST.models.find(x => x.id === id);
  if (!m) throw new Error(`unknown speech model "${id}" (models: ${MANIFEST.models.map(x => x.id).join(', ')})`);
  return m;
}

const marker = (m) => path.join(MODEL_DIR, m.repo, '.ok');
const fileOf = (m, f) => path.join(MODEL_DIR, m.repo, f.file);

/** Installed = every file has the right size and the install wrote the pinned revision to the marker. */
export function modelReady(id) {
  const m = modelInfo(id);
  try {
    if (fs.readFileSync(marker(m), 'utf8').trim() !== m.revision) return false;
    return m.files.every(f => fs.statSync(fileOf(m, f)).size === f.size);
  } catch { return false; }
}

export function modelStatus() {
  return MANIFEST.models.map(m => ({ id: m.id, set: SET_PREFIX + m.id, label: m.label, languages: m.languages, sizeMB: Math.round(m.size / 1048576), installed: modelReady(m.id), revision: m.revision.slice(0, 8) }));
}

const sha256File = (p) => new Promise((resolve, reject) => {
  const h = crypto.createHash('sha256');
  fs.createReadStream(p).on('data', d => h.update(d)).on('error', reject).on('end', () => resolve(h.digest('hex')));
});

async function download(url, dest, onBytes) {
  const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30 * 60000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const tmp = dest + '.part';
  const out = fs.createWriteStream(tmp);
  for await (const chunk of r.body) { out.write(chunk); onBytes(chunk.length); }
  await new Promise((res, rej) => out.end(err => (err ? rej(err) : res())));
  return tmp;
}

/** Download (or verify files already present) and check every SHA-256. */
export async function installModel(id, { onProgress = () => {}, force = false } = {}) {
  const m = modelInfo(id);
  if (!force && modelReady(id)) return { ...modelStatus().find(x => x.id === id), already: true };
  fs.rmSync(marker(m), { force: true });
  let done = 0;
  const total = m.size;
  for (const f of m.files) {
    const dest = fileOf(m, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    // A file left by an earlier download is kept when its checksum is right.
    if (!force && fs.existsSync(dest) && fs.statSync(dest).size === f.size && await sha256File(dest) === f.sha256) {
      done += f.size; onProgress({ stage: 'model', model: id, done, total }); continue;
    }
    let lastErr = null, ok = false;
    for (let attempt = 0; attempt < 3 && !ok; attempt++) {
      const start = done;
      try {
        const tmp = await download(f.url, dest, (n) => { done += n; onProgress({ stage: 'model', model: id, done, total }); });
        const got = await sha256File(tmp);
        if (got !== f.sha256) { fs.rmSync(tmp, { force: true }); throw new Error(`checksum mismatch for ${f.file}; the file changed at the source, so it was not used`); }
        fs.renameSync(tmp, dest);
        ok = true;
      } catch (e) { lastErr = e; done = start; await new Promise(r => setTimeout(r, 1500 * (attempt + 1))); }
    }
    if (!ok) throw new Error(`could not download the ${m.label} model (${f.file}): ${lastErr?.message || lastErr}`);
  }
  fs.writeFileSync(marker(m), m.revision);
  return modelStatus().find(x => x.id === id);
}

export function removeModel(id) {
  const m = modelInfo(id);
  fs.rmSync(path.join(MODEL_DIR, m.repo), { recursive: true, force: true });
  return modelStatus().find(x => x.id === id);
}
