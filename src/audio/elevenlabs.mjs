// ElevenLabs voices (optional, needs the user's API key): many distinct, expressive voices, so every
// character in a story can sound like a different person. Uses only the official API:
//   GET  /v1/user/subscription                        credits left
//   GET  /v1/models                                   which speech models the account can use
//   GET  /v2/voices                                   the account's voices with gender/age/accent labels
//   POST /v1/text-to-speech/{voice_id}/with-timestamps  speech plus the time of every character
import fs from 'node:fs';
import path from 'node:path';
import { HOME_DIR } from '../deps/locate.mjs';
import { elevenKey } from '../secrets.mjs';

let BASE = 'https://api.elevenlabs.io';
// Tests point this at a fake API on this machine; anything that is not local is ignored.
if (/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(String(process.env.OPSCODE_ELEVENLABS_BASE || ''))) BASE = process.env.OPSCODE_ELEVENLABS_BASE;

/** Newest and most expressive first; the first one the account has is used. */
export const MODEL_PREFERENCE = ['eleven_v4', 'eleven_v3', 'eleven_multilingual_v2', 'eleven_flash_v2_5'];
const LIST_CACHE = path.join(HOME_DIR, 'cache', 'elevenlabs-account.json');
const LIST_TTL = 12 * 3600 * 1000;

export class ElevenError extends Error {
  constructor(message, { status, code } = {}) { super(message); this.status = status; this.code = code; }
}

/** A plain reason for a failed call, without the key or raw JSON. */
export function explain(status, body) {
  const d = body?.detail;
  const code = typeof d === 'object' ? d?.status || d?.code : '';
  const msg = typeof d === 'string' ? d : d?.message || '';
  if (status === 401) return { code: 'bad_key', text: 'the ElevenLabs API key was not accepted. Open Settings → Voices and save a valid key' };
  if (status === 402 || /quota|credit|insufficient/i.test(`${code} ${msg}`)) return { code: 'no_credit', text: 'the ElevenLabs account has no credits left for this text' };
  if (status === 429) return { code: 'busy', text: 'ElevenLabs is busy (too many requests)' };
  if (status === 404 || /voice_not_found/i.test(code)) return { code: 'voice_not_found', text: 'that ElevenLabs voice does not exist in this account' };
  if (status === 403 || /permission|not_allowed|subscription/i.test(`${code} ${msg}`)) return { code: 'not_allowed', text: `ElevenLabs refused this on the current plan${msg ? `: ${String(msg).slice(0, 140)}` : ''}` };
  return { code: code || `http_${status}`, text: `ElevenLabs error ${status}${msg ? `: ${String(msg).slice(0, 160)}` : ''}` };
}

async function api(pathname, { method = 'GET', body, key = elevenKey(), timeoutMs = 60000 } = {}) {
  if (!key) throw new ElevenError('no ElevenLabs API key is saved (Settings → Voices)', { code: 'no_key' });
  let res;
  try {
    res = await fetch(`${BASE}${pathname}`, {
      method, signal: AbortSignal.timeout(timeoutMs),
      headers: { 'xi-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (e) { throw new ElevenError(`could not reach ElevenLabs (${e.cause?.code || e.name || e.message}). Check the internet connection`, { code: 'network' }); }
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : {}; } catch { /* not JSON */ }
  if (!res.ok) { const x = explain(res.status, json); throw new ElevenError(x.text, { status: res.status, code: x.code }); }
  return json;
}

/** Credits: { tier, used, limit, left }. Also the cheapest way to check a key. */
export async function account(key) {
  const s = await api('/v1/user/subscription', { key });
  const used = Number(s.character_count) || 0, limit = Number(s.character_limit) || 0;
  return { tier: String(s.tier || ''), used, limit, left: Math.max(0, limit - used) };
}

const low = (s) => String(s || '').toLowerCase();

/** One voice from the API → the fields we choose by. */
export function voiceInfo(v) {
  const l = v.labels || {};
  return {
    id: v.voice_id, name: String(v.name || '').trim(), category: low(v.category),
    gender: low(l.gender), age: low(l.age).replace(/[-\s]/g, '_'), accent: low(l.accent), language: low(l.language),
    useCase: low(l.use_case || l['use case']).replace(/[\s-]/g, '_'), tone: low(l.descriptive || l.description),
    description: String(v.description || '').slice(0, 160),
  };
}

/** The account's voices and usable speech models (cached for 12 hours; `fresh` reads them again). */
export async function library({ fresh = false } = {}) {
  if (!fresh) {
    try {
      const c = JSON.parse(fs.readFileSync(LIST_CACHE, 'utf8'));
      if (c.base === BASE && Date.now() - c.at < LIST_TTL && c.voices?.length) return c;
    } catch { /* read it again */ }
  }
  const voices = [];
  let token = '';
  for (let page = 0; page < 5; page++) {
    const r = await api(`/v2/voices?page_size=100${token ? `&next_page_token=${encodeURIComponent(token)}` : ''}`);
    for (const v of r.voices || []) if (v.voice_id) voices.push(voiceInfo(v));
    if (!r.has_more || !r.next_page_token) break;
    token = r.next_page_token;
  }
  let models = [];
  try { models = (await api('/v1/models')).filter?.((m) => m.can_do_text_to_speech !== false).map((m) => m.model_id) || []; } catch { /* fall back to the default below */ }
  const out = { at: Date.now(), base: BASE, voices, models };
  try { fs.mkdirSync(path.dirname(LIST_CACHE), { recursive: true }); fs.writeFileSync(LIST_CACHE, JSON.stringify(out)); } catch { /* cache is optional */ }
  return out;
}

export function clearLibraryCache() { fs.rmSync(LIST_CACHE, { force: true }); }

/** The model to speak with: the user's choice if the account has it, else the best one it has. */
export function pickModel(models, wanted) {
  if (wanted && (!models?.length || models.includes(wanted))) return wanted;
  return MODEL_PREFERENCE.find((m) => models?.includes(m)) || 'eleven_multilingual_v2';
}

/** Character timings → word timings [{ text, start, end }]. */
export function wordsFromAlignment(a) {
  const ch = a?.characters, st = a?.character_start_times_seconds, en = a?.character_end_times_seconds;
  if (!Array.isArray(ch) || !Array.isArray(st) || !Array.isArray(en) || ch.length !== st.length) return null;
  const words = [];
  let cur = null;
  for (let i = 0; i < ch.length; i++) {
    if (/\s/.test(ch[i]) || ch[i] === '') { if (cur) { words.push(cur); cur = null; } continue; }
    if (!cur) cur = { text: '', start: +Number(st[i]).toFixed(3), end: 0 };
    cur.text += ch[i];
    cur.end = +Number(en[i]).toFixed(3);
  }
  if (cur) words.push(cur);
  // Audio tags such as [laughs] are instructions, not spoken words.
  return words.filter((w) => !/^\[[^\]]*\]$/.test(w.text) && w.end >= w.start);
}

/**
 * Speak `text`. Returns { mp3: Buffer, words: [{text,start,end}] | null, characters }.
 * `speed` 0.7–1.2. `language` (ISO 639-1) is sent only to models that accept it.
 */
export async function speak({ voiceId, text, model, language, speed, previous, next }) {
  const body = {
    text, model_id: model,
    ...(language && model !== 'eleven_multilingual_v2' ? { language_code: language } : {}),
    ...(Number.isFinite(speed) && Math.abs(speed - 1) > 0.01 ? { voice_settings: { speed: Math.max(0.7, Math.min(1.2, +speed.toFixed(2))) } } : {}),
    ...(previous ? { previous_text: String(previous).slice(-300) } : {}),
    ...(next ? { next_text: String(next).slice(0, 300) } : {}),
  };
  const r = await api(`/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_128`, { method: 'POST', body, timeoutMs: 120000 });
  if (!r?.audio_base64) throw new ElevenError('ElevenLabs returned no audio', { code: 'no_audio' });
  return { mp3: Buffer.from(r.audio_base64, 'base64'), words: wordsFromAlignment(r.alignment || r.normalized_alignment), characters: [...String(text)].length };
}

// ───────────────────────── choosing a voice for each character ─────────────────────────

const AGE_LABEL = { kid: ['young'], adult: ['middle_aged', 'young'], old: ['old'], big: ['middle_aged', 'old'], robot: ['middle_aged'] };
const LANG_WORDS = { hi: ['hindi', 'india', 'indian'], en: ['english', 'american', 'british', 'indian', 'australian'] };

/**
 * How well a voice fits a part. need = { gender: 'm'|'f', age: 'kid'|'adult'|'old'|'big'|'robot', lang: 'hi'|'en', role: 'narrator'|'character' }.
 */
export function scoreVoice(v, need) {
  let s = 0;
  const g = need.gender === 'm' ? 'male' : need.gender === 'f' ? 'female' : '';
  if (g && v.gender) s += v.gender === g ? 40 : -60;
  const ages = AGE_LABEL[need.age] || AGE_LABEL.adult;
  if (v.age) s += v.age === ages[0] ? 20 : ages.includes(v.age) ? 8 : -10;
  const hay = `${v.accent} ${v.language} ${v.description.toLowerCase()} ${v.name.toLowerCase()}`;
  if ((LANG_WORDS[need.lang] || []).some((w) => hay.includes(w))) s += need.lang === 'hi' ? 25 : 6;
  if (need.role === 'narrator') { if (/narrat|story|documentary|informative|educational/.test(`${v.useCase} ${v.tone}`)) s += 15; }
  else if (/character|animation|cartoon|games/.test(`${v.useCase} ${v.tone}`)) s += 15;
  if (need.age === 'kid' && /child|kid|cute|playful|young/.test(`${v.tone} ${v.description.toLowerCase()} ${v.name.toLowerCase()}`)) s += 12;
  if (need.age === 'old' && /old|elder|grand|wise|mature|deep/.test(`${v.tone} ${v.description.toLowerCase()}`)) s += 12;
  if (need.age === 'robot' && /robot|android|synthetic|ai\b/.test(`${v.tone} ${v.description.toLowerCase()} ${v.name.toLowerCase()}`)) s += 30;
  if (need.age === 'big' && /deep|gravel|gruff|strong|villain|giant/.test(`${v.tone} ${v.description.toLowerCase()}`)) s += 12;
  if (v.category === 'professional' || v.category === 'premade') s += 3;
  return s;
}

/** A voice the storyboard named (by name or id), or null. */
export function findVoice(voices, wanted) {
  const w = low(wanted).replace(/^(eleven(labs)?:)/, '').trim();
  if (!w) return null;
  return voices.find((v) => v.id === String(wanted).trim() || low(v.id) === w) || voices.find((v) => low(v.name) === w)
    || voices.find((v) => low(v.name).split(/[\s\-–—]+/)[0] === w) || voices.find((v) => low(v.name).startsWith(w)) || null;
}

/**
 * A different voice for every part, best fit first. parts = [{ key, gender, age, lang, role, wanted? }].
 * Returns Map key → voice. The same list of parts always gets the same voices.
 */
export function assignVoices(voices, parts) {
  const out = new Map();
  const taken = new Set();
  // Voices the storyboard named are used as given.
  const open = [];
  for (const p of parts) {
    const v = p.wanted ? findVoice(voices, p.wanted) : null;
    if (v) { out.set(p.key, v); taken.add(v.id); } else open.push(p);
  }
  // Then the strongest part-and-voice match first, so the result does not depend on the cast order.
  const best = (p) => {
    let top = null;
    for (const x of voices) {
      const s = scoreVoice(x, p) - (taken.has(x.id) ? 1000 : 0);
      if (!top || s > top.s || (s === top.s && (x.name.localeCompare(top.x.name) || x.id.localeCompare(top.x.id)) < 0)) top = { x, s };
    }
    return top;
  };
  while (open.length) {
    let pick = -1, choice = null;
    open.forEach((p, i) => {
      const b = best(p);
      if (b && (!choice || b.s > choice.s || (b.s === choice.s && String(p.key) < String(open[pick].key)))) { choice = b; pick = i; }
    });
    if (pick === -1) break;
    out.set(open[pick].key, choice.x);
    taken.add(choice.x.id);
    open.splice(pick, 1);
  }
  return out;
}
