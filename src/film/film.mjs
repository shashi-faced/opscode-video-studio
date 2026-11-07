// Films: long videos made of sequences of short shots.
//
//   { "title", "format", "voice", "music", "cast", ...same top fields as a storyboard,
//     "sequences": [ { "id", "title", "music": { "style" }, "shots": [ <scene>, ... ] } ] }
//
// A shot is a storyboard scene (same templates and fields) plus an optional "id".
// A plain storyboard ("scenes") is read as a film with one sequence, one shot per scene.
import path from 'node:path';
import { loadStoryboard, validate } from '../schema/validate.mjs';

export const MAX_SHOTS = 1000;
export const MAX_CAST = 24;
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const idOk = (s) => /^[a-z0-9][a-z0-9_-]{0,39}$/.test(s);
const slugId = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 40);

/** True when the JSON is a film (has sequences). */
export const isFilm = (data) => isObj(data) && Array.isArray(data.sequences);

/**
 * Validate a film file. Returns
 *   { ok, errors, warnings, film, storyboard (all shots as one normalised storyboard), shots: [{ id, seq, seqIndex, index }], sequences }
 * Error paths point at the film ("sequences[1].shots[4].narration"), not at the flattened list.
 */
export function validateFilmFile(file) {
  let data;
  try { data = loadStoryboard(file); }
  catch (e) { return { ok: false, errors: [{ path: '', message: `not valid JSON: ${e.message}`, fix: 'check commas, quotes and brackets; no comments' }], warnings: [] }; }
  return validateFilm(data, { baseDir: path.dirname(path.resolve(file)) });
}

export function validateFilm(data, { baseDir = process.cwd() } = {}) {
  const errors = [], warnings = [];
  if (!isObj(data)) return { ok: false, errors: [{ path: '', message: 'a film must be a JSON object', fix: 'use { "title": "...", "sequences": [ ... ] }' }], warnings };

  // Plain storyboard: one sequence, every scene a shot.
  const film = isFilm(data) ? structuredClone(data) : (() => {
    const { scenes, ...rest } = data;
    return { ...rest, sequences: [{ id: 'main', title: data.title || 'Main', shots: Array.isArray(scenes) ? scenes : [] }] };
  })();

  const sequences = [];
  const shots = [];
  const flat = [];
  const usedIds = new Set();
  const seqIds = new Set();
  film.sequences.forEach((seq, si) => {
    const sp = `sequences[${si}]`;
    if (!isObj(seq)) { errors.push({ path: sp, message: 'must be an object', fix: 'use { "id": "intro", "title": "...", "shots": [ ... ] }' }); return; }
    let sid = seq.id ? slugId(seq.id) : `seq${si + 1}`;
    if (seqIds.has(sid)) { errors.push({ path: `${sp}.id`, message: `sequence id "${sid}" is used twice`, fix: 'give every sequence its own id' }); sid = `${sid}-${si + 1}`; }
    seqIds.add(sid);
    if (!Array.isArray(seq.shots) || !seq.shots.length) { errors.push({ path: `${sp}.shots`, message: 'a sequence needs at least one shot', fix: 'add "shots": [ { "template": "story", ... } ]' }); return; }
    const entry = { id: sid, title: String(seq.title || sid), music: isObj(seq.music) ? seq.music : null, shots: [] };
    seq.shots.forEach((shot, k) => {
      const p = `${sp}.shots[${k}]`;
      let id = isObj(shot) && shot.id != null ? String(shot.id).toLowerCase() : `${sid}-${String(k + 1).padStart(3, '0')}`;
      if (!idOk(id)) { warnings.push({ path: `${p}.id`, message: `id "${shot.id}" changed to "${slugId(shot.id) || `${sid}-${k + 1}`}" (letters, digits, - and _ only)` }); id = slugId(shot.id) || `${sid}-${k + 1}`; }
      if (usedIds.has(id)) { errors.push({ path: `${p}.id`, message: `shot id "${id}" is used twice`, fix: 'give every shot its own id' }); id = `${id}-${k + 1}`; }
      usedIds.add(id);
      const scene = isObj(shot) ? { ...shot } : shot;
      if (isObj(scene)) delete scene.id;
      shots.push({ id, seq: sid, seqIndex: si, index: k, path: p });
      entry.shots.push(id);
      flat.push(scene);
    });
    sequences.push(entry);
  });

  const { sequences: _s, ...top } = film;
  const v = validate({ ...top, scenes: flat }, { baseDir, limits: { scenes: MAX_SHOTS, cast: MAX_CAST, minScenes: 1 } });
  // Point messages at the film structure.
  const remap = (x) => {
    const m = /^scenes\[(\d+)\](.*)$/.exec(x.path || '');
    if (!m) return x;
    const s = shots[+m[1]];
    return s ? { ...x, path: `${s.path}${m[2]}`, shot: s.id } : x;
  };
  // Type recipes (first/last template) are for short videos; in a film they only apply to the first and last shot,
  // which the flattened check already does. Platform length notes stay as they are.
  errors.push(...v.errors.map(remap));
  warnings.push(...v.warnings.map(remap));
  return { ok: errors.length === 0, errors, warnings, film, storyboard: v.storyboard, shots, sequences };
}
