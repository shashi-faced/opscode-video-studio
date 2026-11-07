// Saved 3D character designs (plan 12, Phase 6), reusable in any video: "design": "library:<id>".
import fs from 'node:fs';
import path from 'node:path';
import { HOME_DIR } from '../deps/locate.mjs';

export const LIBRARY_DIR = path.join(HOME_DIR, 'characters');
const safe = (id) => String(id).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

export function loadLibraryCharacter(id) {
  try { return JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, `${safe(id)}.json`), 'utf8')); } catch { return null; }
}

export function saveLibraryCharacter(entry) {
  fs.mkdirSync(LIBRARY_DIR, { recursive: true });
  const id = safe(entry.id);
  const rec = { id, name: entry.name || id, kind: entry.kind, design: entry.design, savedAt: new Date().toISOString() };
  if (entry.thumb) rec.thumb = entry.thumb;
  fs.writeFileSync(path.join(LIBRARY_DIR, `${id}.json`), JSON.stringify(rec, null, 2));
  return { ...rec, file: path.join(LIBRARY_DIR, `${id}.json`) };
}

export function listLibrary() {
  try {
    return fs.readdirSync(LIBRARY_DIR).filter(f => f.endsWith('.json')).map(f => {
      try {
        const c = JSON.parse(fs.readFileSync(path.join(LIBRARY_DIR, f), 'utf8'));
        const thumb = path.join(LIBRARY_DIR, `${c.id}.jpg`);
        return fs.existsSync(thumb) ? { ...c, thumb } : c;
      } catch { return null; }
    }).filter(Boolean);
  } catch { return []; }
}
