// Normalise + validate a storyboard. Messages are written for an LLM:
// every error has a JSON path, what is wrong, and a concrete fix.
import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES, COMMON_FIELDS, TOP_FIELDS, DEFAULTS, FORMATS } from './spec.mjs';

const FORMAT_ALIASES = {
  '16x9': '16:9', '16/9': '16:9', landscape: '16:9', youtube: '16:9', wide: '16:9', horizontal: '16:9',
  '9x16': '9:16', '9/16': '9:16', portrait: '9:16', vertical: '9:16', reel: '9:16', reels: '9:16', shorts: '9:16', story: '9:16', tiktok: '9:16',
  '1x1': '1:1', '1/1': '1:1', square: '1:1', post: '1:1',
};
const TEMPLATE_ALIASES = {
  intro: 'title', hero: 'title', opening: 'title', cover: 'title',
  screenshot: 'feature', demo: 'feature', showcase: 'feature', screen: 'feature',
  list: 'bullets', benefits: 'bullets', features: 'bullets',
  'two-column': 'split', side: 'split', 'image-text': 'split',
  stats: 'stat', numbers: 'stat', metric: 'stat', metrics: 'stat',
  testimonial: 'quote', review: 'quote',
  outro: 'cta', end: 'cta', closing: 'cta', 'call-to-action': 'cta', download: 'cta',
};
const FIELD_ALIASES = {
  type: 'template', layout: 'template',
  title: 'headline', heading: 'headline', text: 'headline', header: 'headline',
  subtitle: 'subline', subheadline: 'subline', description: 'subline', caption: 'subline',
  voiceover: 'narration', vo: 'narration', script: 'narration', voice: 'narration', speech: 'narration',
  label: 'kicker', eyebrow: 'kicker',
  img: 'image', screenshot: 'image', src: 'image', picture: 'image',
  bullets: 'items', points: 'items',
  features: 'chips', pills: 'chips',
  cta: 'button', buttonText: 'button',
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function loadStoryboard(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Tolerate // comments and trailing commas, which small models often write.
    const cleaned = raw.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
}

export function normalise(input, warnings) {
  const sb = isObj(input) ? structuredClone(input) : {};
  const warn = (p, m) => warnings.push({ path: p, message: m });

  if (Array.isArray(input)) { warn('', 'top level was a list; treated as scenes'); return normalise({ scenes: input }, warnings); }

  if (typeof sb.format === 'string') {
    const f = sb.format.trim().toLowerCase();
    if (!FORMATS.includes(f) && FORMAT_ALIASES[f]) { warn('format', `"${sb.format}" changed to "${FORMAT_ALIASES[f]}"`); sb.format = FORMAT_ALIASES[f]; }
  }
  if (typeof sb.voice === 'string') { sb.voice = sb.voice === 'none' ? { provider: 'none' } : { provider: 'edge', voice: sb.voice }; warn('voice', 'string changed to { provider, voice }'); }
  if (sb.voice === false || sb.voice === null) sb.voice = { provider: 'none' };
  if (typeof sb.music === 'string') { sb.music = { style: sb.music }; warn('music', 'string changed to { style }'); }
  if (sb.music === false || sb.music === null) sb.music = { style: 'none' };

  // Small models often write "field": null or "" for "I have none". Treat as absent.
  const dropEmpty = (o, p) => {
    if (Array.isArray(o)) { o.forEach((v, i) => dropEmpty(v, `${p}[${i}]`)); return; }
    if (!isObj(o)) return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v === null || (typeof v === 'string' && !v.trim() && k !== 'narration')) { delete o[k]; warn(p ? `${p}.${k}` : k, 'empty value removed'); }
      else dropEmpty(v, p ? `${p}.${k}` : k);
    }
  };
  dropEmpty(sb, '');

  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (sb[k] === undefined) sb[k] = structuredClone(v);
    else if (isObj(v) && isObj(sb[k])) sb[k] = { ...v, ...sb[k] };
  }

  if (!Array.isArray(sb.scenes)) return sb;
  sb.scenes = sb.scenes.map((sc, i) => {
    if (!isObj(sc)) return sc;
    const s = {};
    for (const [k, v] of Object.entries(sc)) {
      const known = k in COMMON_FIELDS || Object.values(TEMPLATES).some(t => k in t.fields);
      const alias = FIELD_ALIASES[k];
      if (!known && alias && sc[alias] === undefined) { s[alias] = v; warn(`scenes[${i}].${k}`, `renamed to "${alias}"`); }
      else s[k] = v;
    }
    if (typeof s.template === 'string') {
      const t = s.template.trim().toLowerCase();
      if (!TEMPLATES[t] && TEMPLATE_ALIASES[t]) { warn(`scenes[${i}].template`, `"${s.template}" changed to "${TEMPLATE_ALIASES[t]}"`); s.template = TEMPLATE_ALIASES[t]; }
      else s.template = t;
    }
    if (s.template === undefined) {
      const guess = i === 0 ? 'title' : i === input.scenes.length - 1 ? 'cta' : s.image ? 'feature' : s.items ? 'bullets' : 'title';
      s.template = guess; warn(`scenes[${i}].template`, `missing; guessed "${guess}"`);
    }
    for (const key of ['chips', 'items', 'badges']) {
      if (typeof s[key] === 'string') { s[key] = s[key].split(/[,;|•]/).map(x => x.trim()).filter(Boolean); warn(`scenes[${i}].${key}`, 'comma text changed to a list'); }
    }
    if (s.template === 'stat' && Array.isArray(s.items)) {
      s.items = s.items.map(it => typeof it === 'string' ? (() => { const m = it.match(/^(\S+)\s+(.*)$/); return m ? { value: m[1], label: m[2] } : { value: it, label: '' }; })() : it);
    }
    if (typeof s.duration === 'string') s.duration = parseFloat(s.duration);
    if (s.mascot === null || s.mascot === false) s.mascot = 'none';
    return s;
  });
  return sb;
}

function checkField(spec, value, p, errors, warnings, ctx) {
  const err = (message, fix) => errors.push({ path: p, message, fix });
  switch (spec.type) {
    case 'str':
      if (typeof value !== 'string') return err(`must be text`, `write it as a string in quotes`);
      if (spec.required && !value.trim()) return err('is empty', 'write some text');
      if (spec.max && value.length > spec.max) return err(`is ${value.length} characters, limit is ${spec.max}`, `shorten to at most ${spec.soft || spec.max} characters`);
      if (spec.soft && value.length > spec.soft) warnings.push({ path: p, message: `${value.length} characters; under ${spec.soft} reads better` });
      return;
    case 'num':
      if (typeof value !== 'number' || Number.isNaN(value)) return err('must be a number', `use a number like ${spec.min}`);
      if (value < spec.min || value > spec.max) {
        if (spec.max === 1 && value > 1) return err(`is ${value}; coordinates are fractions 0-1, not pixels`, `divide by the image width/height, e.g. ${Math.min(0.99, +(value / 1000).toFixed(2))}`);
        return err(`is ${value}, must be between ${spec.min} and ${spec.max}`, `use a value from ${spec.min} to ${spec.max}`);
      }
      return;
    case 'bool':
      if (typeof value !== 'boolean') return err('must be true or false', 'use true or false without quotes');
      return;
    case 'enum':
      if (!spec.values.includes(value)) return err(`"${value}" is not allowed`, `use one of: ${spec.values.join(', ')}`);
      return;
    case 'color':
      if (typeof value !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return err('must be a hex colour', 'use a value like #ff9a3c');
      return;
    case 'path': {
      if (typeof value !== 'string' || !value.trim()) return err('must be a file path', spec.required ? 'use a path relative to the storyboard, e.g. shots/app.png' : 'if you have no file, remove this field');
      if (/^https?:\/\//.test(value)) return err('web URLs are not supported', 'capture or download the image first, then use the local file path');
      const abs = path.resolve(ctx.baseDir, value);
      if (!fs.existsSync(abs)) return err(`file not found: ${value}`, `check the path; files are looked up relative to ${ctx.baseDir}`);
      return;
    }
    case 'list': {
      if (!Array.isArray(value)) return err('must be a list', 'use [ ... ]');
      if (spec.min && value.length < spec.min) return err(`has ${value.length} items, needs at least ${spec.min}`, `add items`);
      if (spec.max && value.length > spec.max) return err(`has ${value.length} items, limit is ${spec.max}`, `keep only the ${spec.max} most important`);
      if (spec.of) value.forEach((v, i) => checkField(spec.of, v, `${p}[${i}]`, errors, warnings, ctx));
      return;
    }
    case 'obj': {
      if (!isObj(value)) return err('must be an object', 'use { ... }');
      for (const [k, fs2] of Object.entries(spec.fields)) {
        if (value[k] === undefined) { if (fs2.required) err(`missing "${k}"`, `add "${k}"`); continue; }
        checkField(fs2, value[k], `${p}.${k}`, errors, warnings, ctx);
      }
      for (const k of Object.keys(value)) if (!(k in spec.fields)) warnings.push({ path: `${p}.${k}`, message: `unknown field "${k}" ignored` });
      return;
    }
  }
}

export function validate(input, { baseDir = process.cwd() } = {}) {
  const errors = [], warnings = [];
  const sb = normalise(input, warnings);
  const ctx = { baseDir };

  for (const [k, spec] of Object.entries(TOP_FIELDS)) {
    if (sb[k] === undefined) { if (spec.required) errors.push({ path: k, message: `missing "${k}"`, fix: `add "${k}": [ ... ] with 2-12 scenes` }); continue; }
    if (k === 'scenes') continue;
    checkField(spec, sb[k], k, errors, warnings, ctx);
  }
  for (const k of Object.keys(sb)) if (!(k in TOP_FIELDS)) warnings.push({ path: k, message: `unknown field "${k}" ignored` });

  if (Array.isArray(sb.scenes)) {
    checkField({ type: 'list', min: 2, max: 12 }, sb.scenes, 'scenes', errors, warnings, ctx);
    sb.scenes.forEach((s, i) => {
      const p = `scenes[${i}]`;
      if (!isObj(s)) { errors.push({ path: p, message: 'must be an object', fix: 'use { "template": "...", ... }' }); return; }
      const tpl = TEMPLATES[s.template];
      if (!tpl) { errors.push({ path: `${p}.template`, message: `unknown template "${s.template}"`, fix: `use one of: ${Object.keys(TEMPLATES).join(', ')}` }); return; }
      const fields = { ...COMMON_FIELDS, ...tpl.fields };
      for (const [k, spec] of Object.entries(fields)) {
        if (s[k] === undefined) { if (spec.required) errors.push({ path: `${p}.${k}`, message: `template "${s.template}" needs "${k}"`, fix: `add "${k}"${spec.doc ? ` (${spec.doc})` : ''}` }); continue; }
        if (k === 'mascot' && s[k] === 'none') continue;
        checkField(spec, s[k], `${p}.${k}`, errors, warnings, ctx);
      }
      for (const k of Object.keys(s)) if (!(k in fields)) warnings.push({ path: `${p}.${k}`, message: `field "${k}" is not used by template "${s.template}"; ignored` });
      if (Array.isArray(s.highlights)) s.highlights.forEach((h, j) => {
        if (isObj(h) && h.x <= 1 && h.w <= 1 && h.x + h.w > 1.001) errors.push({ path: `${p}.highlights[${j}]`, message: 'box goes past the right edge (x + w > 1)', fix: `make w at most ${(1 - h.x).toFixed(2)}` });
        if (isObj(h) && h.y <= 1 && h.h <= 1 && h.y + h.h > 1.001) errors.push({ path: `${p}.highlights[${j}]`, message: 'box goes past the bottom edge (y + h > 1)', fix: `make h at most ${(1 - h.y).toFixed(2)}` });
      });
    });
    if (sb.scenes.length >= 2) {
      if (sb.scenes[0]?.template !== 'title') warnings.push({ path: 'scenes[0]', message: 'videos usually start with a "title" scene' });
      if (sb.scenes.at(-1)?.template !== 'cta') warnings.push({ path: `scenes[${sb.scenes.length - 1}]`, message: 'videos usually end with a "cta" scene' });
    }
    const voiced = sb.voice?.provider !== 'none';
    if (voiced && !sb.scenes.some(s => isObj(s) && s.narration)) warnings.push({ path: 'scenes', message: 'no scene has narration, so there will be no voice' });
  }
  return { ok: errors.length === 0, errors, warnings, storyboard: sb };
}

export function validateFile(file) {
  let data;
  try { data = loadStoryboard(file); }
  catch (e) { return { ok: false, errors: [{ path: '', message: `not valid JSON: ${e.message}`, fix: 'check commas, quotes and brackets; no comments' }], warnings: [] }; }
  return validate(data, { baseDir: path.dirname(path.resolve(file)) });
}
