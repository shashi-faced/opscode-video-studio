// Sarvam AI Text-to-Speech (Bulbul) integration for Indian languages and English.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { HOME_DIR } from '../deps/locate.mjs';
import { sarvamKey, voiceProvider, loadSecrets } from '../secrets.mjs';
import { decodeMono, trimSilenceLead, normalisePeak } from './wav.mjs';
import { stripTags } from '../timeline.mjs';
import { KIND_INFO } from '../compiler/characters.mjs';

const SARVAM_API_BASE = process.env.OPSCODE_SARVAM_BASE || 'https://api.sarvam.ai';
const CACHE_DIR = path.join(HOME_DIR, 'cache', 'sarvam');

export const SARVAM_MODELS = [
  { id: 'bulbul:v3', label: 'Bulbul v3: Natural Indic prosody & 11 languages (Default)' },
  { id: 'bulbul:v4-flash', label: 'Bulbul v4-flash: Ultra-low latency' },
];

export const SARVAM_SPEAKERS = [
  { id: 'shubh', name: 'Shubh', gender: 'male', role: 'narrator', hint: 'Deep, dramatic and clear narration' },
  { id: 'priya', name: 'Priya', gender: 'female', role: 'narrator', hint: 'Warm and natural storyteller' },
  { id: 'ritu', name: 'Ritu', gender: 'female', role: 'character', hint: 'Calm, gentle and clear' },
  { id: 'ratan', name: 'Ratan', gender: 'male', role: 'character', hint: 'Authoritative, news and formal' },
  { id: 'amit', name: 'Amit', gender: 'male', role: 'character', hint: 'Conversational and relatable' },
  { id: 'kavya', name: 'Kavya', gender: 'female', role: 'character', hint: 'Expressive and friendly' },
  { id: 'ishita', name: 'Ishita', gender: 'female', role: 'character', hint: 'Professional and lively' },
  { id: 'rahul', name: 'Rahul', gender: 'male', role: 'character', hint: 'Youthful and energetic' },
  { id: 'simran', name: 'Simran', gender: 'female', role: 'character', hint: 'Polite and clear' },
  { id: 'manan', name: 'Manan', gender: 'male', role: 'character', hint: 'Warm and conversational' },
  { id: 'pooja', name: 'Pooja', gender: 'female', role: 'character', hint: 'Bright and cheerful' },
  { id: 'dev', name: 'Dev', gender: 'male', role: 'character', hint: 'Youthful and casual' },
];

export function normalizeSarvamModel(model) {
  if (!model || model === 'bulbul:v1' || model === 'bulbul:v2') return 'bulbul:v3';
  if (model === 'bulbul:v4-flash') return 'bulbul:v4-flash';
  return 'bulbul:v3';
}

export class SarvamError extends Error {
  constructor(message, { code = 'error', status = 0 } = {}) {
    super(message);
    this.name = 'SarvamError';
    this.code = code;
    this.status = status;
  }
}

/** Check if a Sarvam AI API subscription key is valid. */
export async function validateSarvamKey(key = sarvamKey()) {
  const k = String(key || '').trim();
  if (!k) throw new SarvamError('No Sarvam AI API subscription key provided', { code: 'no_key' });

  // Test the key with a short greeting on bulbul:v3
  const res = await fetch(`${SARVAM_API_BASE}/text-to-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': k,
    },
    body: JSON.stringify({
      inputs: ['नमस्ते'],
      target_language_code: 'hi-IN',
      speaker: 'shubh',
      model: 'bulbul:v3',
      speech_sample_rate: 22050,
    }),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errJson = await res.json();
      const raw = errJson.message || errJson.error || errJson.detail;
      detail = typeof raw === 'object' ? JSON.stringify(raw) : (raw || JSON.stringify(errJson));
    } catch {}
    throw new SarvamError(`Sarvam AI returned HTTP ${res.status}: ${detail}`, { status: res.status });
  }

  const json = await res.json();
  if (!json.audios || !Array.isArray(json.audios) || !json.audios.length) {
    throw new SarvamError('Sarvam AI returned no audio', { code: 'no_audio' });
  }

  return true;
}

/**
 * Generate speech for a piece of text with Sarvam AI.
 * Returns { audio: Buffer, characters: number, format: 'wav', cached: boolean }
 */
export async function speakSarvam({
  text,
  language = 'hi-IN',
  speaker = 'shubh',
  model = 'bulbul:v3',
  pace = 1.0,
  apiKey,
} = {}) {
  const k = String(apiKey || sarvamKey() || '').trim();
  if (!k) throw new SarvamError('No Sarvam AI API subscription key configured', { code: 'no_key' });

  const cleanText = stripTags(text || '').replace(/\*/g, '').trim();
  if (!cleanText) return { audio: Buffer.alloc(0), characters: 0, format: 'wav', cached: true };

  const validModel = normalizeSarvamModel(model);
  const validSpeaker = speaker || (validModel === 'bulbul:v4-flash' ? 'shubh_enhi_ads' : 'shubh');

  // Determine target language code
  let langCode = language || 'hi-IN';
  if (/^hi/i.test(langCode)) langCode = 'hi-IN';
  else if (/^en/i.test(langCode)) langCode = 'en-IN';
  else if (/^bn/i.test(langCode)) langCode = 'bn-IN';
  else if (/^ta/i.test(langCode)) langCode = 'ta-IN';
  else if (/^te/i.test(langCode)) langCode = 'te-IN';
  else if (/^kn/i.test(langCode)) langCode = 'kn-IN';
  else if (/^ml/i.test(langCode)) langCode = 'ml-IN';
  else if (/^mr/i.test(langCode)) langCode = 'mr-IN';
  else if (/^gu/i.test(langCode)) langCode = 'gu-IN';
  else if (/^pa/i.test(langCode)) langCode = 'pa-IN';
  else if (/^od/i.test(langCode)) langCode = 'od-IN';

  // Check cache
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const hash = crypto.createHash('sha256').update(`${cleanText}|${langCode}|${validSpeaker}|${validModel}|${pace}`).digest('hex');
  const cacheFile = path.join(CACHE_DIR, `${hash}.wav`);
  if (fs.existsSync(cacheFile)) {
    try {
      const audio = fs.readFileSync(cacheFile);
      return { audio, characters: cleanText.length, format: 'wav', cached: true };
    } catch {}
  }

  const payload = {
    inputs: [cleanText],
    target_language_code: langCode,
    speaker: validSpeaker,
    model: validModel,
    pace: typeof pace === 'number' ? Math.max(0.5, Math.min(2.0, pace)) : 1.0,
    speech_sample_rate: 22050,
  };

  const res = await fetch(`${SARVAM_API_BASE}/text-to-speech`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': k,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const errJson = await res.json();
      const raw = errJson.message || errJson.error || errJson.detail;
      detail = typeof raw === 'object' ? JSON.stringify(raw) : (raw || JSON.stringify(errJson));
    } catch {}
    throw new SarvamError(`Sarvam AI returned ${res.status}: ${detail}`, { status: res.status });
  }

  const json = await res.json();
  if (!json.audios || !Array.isArray(json.audios) || !json.audios.length) {
    throw new SarvamError('Sarvam AI returned no audio', { code: 'no_audio' });
  }

  const audio = Buffer.from(json.audios[0], 'base64');
  try {
    fs.writeFileSync(cacheFile, audio);
  } catch {}

  return { audio, characters: cleanText.length, format: 'wav', cached: false };
}

/** Assign Sarvam speakers to storyboard cast members. */
export function assignSarvamSpeakers(parts, defaultSpeaker = 'shubh') {
  const out = new Map();
  const taken = new Set();

  for (const p of parts) {
    const isMale = p.gender === 'm';
    const pool = SARVAM_SPEAKERS.filter((s) => s.gender === (isMale ? 'male' : 'female'));
    let chosen = pool.find((s) => !taken.has(s.id)) || pool[0] || SARVAM_SPEAKERS[0];
    if (p.wanted) {
      const found = SARVAM_SPEAKERS.find((s) => s.id === p.wanted.toLowerCase() || s.name.toLowerCase() === p.wanted.toLowerCase());
      if (found) chosen = found;
    }
    out.set(p.key, chosen);
    taken.add(chosen.id);
  }
  return out;
}

/**
 * Sarvam AI casting for a storyboard, or null when it is not in use.
 */
export async function sarvamCast(storyboard, notes = []) {
  if (voiceProvider() !== 'sarvam') return null;
  const key = sarvamKey();
  if (!key) return null;
  const s = loadSecrets();
  const narratorEdge = storyboard.voice?.voice || 'hi-IN-SwaraNeural';
  const lang = String(narratorEdge).slice(0, 2).toLowerCase() === 'en' ? 'en-IN' : 'hi-IN';
  const isMaleNarrator = /Madhur|Prabhat|Andrew|Ryan|shubh|arvind|amartya|amrish|ratan|amit|rahul|manan|dev/i.test(narratorEdge);

  const model = normalizeSarvamModel(s.voice?.sarvamModel);
  const defaultNarratorSpeaker = s.voice?.sarvamSpeaker || (isMaleNarrator ? 'shubh' : 'priya');

  const parts = [{ key: '\u0000narrator', gender: isMaleNarrator ? 'm' : 'f', wanted: storyboard.voice?.narrator || defaultNarratorSpeaker }];
  const keyOf = new Map();
  for (const c of storyboard.cast || []) {
    const info = KIND_INFO[c.kind] || KIND_INFO.rabbit;
    const key = String(c.id).toLowerCase();
    parts.push({ key, gender: info.gender === 'm' ? 'm' : 'f', wanted: c.voice });
    keyOf.set(key, key);
    if (c.name) keyOf.set(String(c.name).toLowerCase(), key);
  }

  const map = assignSarvamSpeakers(parts, defaultNarratorSpeaker);
  return {
    model,
    lang,
    map,
    narrator: () => ({ speaker: map.get('\u0000narrator')?.id || defaultNarratorSpeaker }),
    get(who) {
      let k = keyOf.get(String(who || '').toLowerCase());
      if (!k) {
        k = String(who || '').toLowerCase();
        const info = KIND_INFO[k] || KIND_INFO.rabbit;
        const one = assignSarvamSpeakers([{ key: k, gender: info.gender === 'm' ? 'm' : 'f' }], defaultNarratorSpeaker);
        map.set(k, one.get(k));
      }
      return { speaker: map.get(k)?.id || defaultNarratorSpeaker };
    },
    summary() {
      const order = [...parts.map((p) => p.key), ...[...map.keys()].filter((k) => !parts.some((p) => p.key === k))];
      const names = order.filter((k) => map.has(k)).map((k) => `${k === '\u0000narrator' ? 'narrator' : k}: ${map.get(k)?.name || map.get(k)?.id}`);
      return `Sarvam AI (${model}) — ${names.join('; ')}`;
    },
  };
}

/** Speak one clip with Sarvam AI, cached on disk. */
export async function speakSarvamCached(sarvam, v, text, usage, cacheDir = CACHE_DIR) {
  const clean = stripTags(text).replace(/\*/g, '');
  const key = crypto.createHash('sha1').update(JSON.stringify(['sarvam', sarvam.model, v.speaker, sarvam.lang, clean])).digest('hex').slice(0, 16);
  const wav = path.join(cacheDir, `sarvam-${key}.wav`);
  if (!fs.existsSync(wav) || fs.statSync(wav).size < 500) {
    const r = await speakSarvam({ text: clean, language: sarvam.lang, speaker: v.speaker, model: sarvam.model });
    fs.writeFileSync(wav, r.audio);
    usage.characters += r.characters;
  } else {
    usage.cached++;
  }
  const { samples } = trimSilenceLead(decodeMono(wav));
  return { samples: normalisePeak(samples), file: wav, words: null };
}
