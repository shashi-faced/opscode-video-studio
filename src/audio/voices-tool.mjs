// video_voices: which voice service is in use, the ElevenLabs voices to choose from, and a short test.
// Also the key command the app's Settings screen calls. The key itself is never returned anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { loadSecrets, updateSecrets, elevenKey, voiceProvider } from '../secrets.mjs';
import { account, library, clearLibraryCache, pickModel, findVoice, speak, scoreVoice, MODEL_PREFERENCE } from './elevenlabs.mjs';

const WHERE = 'Settings → Voices';
const describe = (v) => `${v.name}: ${[v.gender, v.age.replace(/_/g, ' '), v.accent || v.language, v.useCase.replace(/_/g, ' ')].filter(Boolean).join(', ')}${v.tone ? ` (${v.tone})` : ''}`;

export async function voicesStatus() {
  const s = loadSecrets();
  const hasKey = !!elevenKey();
  const provider = voiceProvider();
  const data = { provider, elevenlabs: { connected: false, keySaved: hasKey } };
  if (!hasKey) return { ok: true, text: `Voices: built-in (free). For a different, expressive voice for every character, the user can add an ElevenLabs key in ${WHERE}.`, data };
  try {
    const [acc, lib] = [await account(), await library()];
    const model = pickModel(lib.models, s.voice?.model);
    data.elevenlabs = { connected: true, keySaved: true, tier: acc.tier, charactersLeft: acc.left, charactersLimit: acc.limit, voices: lib.voices.length, model };
    return {
      ok: true,
      text: provider === 'elevenlabs'
        ? `Voices: ElevenLabs (${model}), ${lib.voices.length} voices, ${acc.left.toLocaleString('en-US')} of ${acc.limit.toLocaleString('en-US')} characters left this period. Every character gets its own voice automatically; call video_voices with action "list" to choose by name.`
        : `Voices: built-in (the user switched ElevenLabs off in ${WHERE}; its key is saved, ${acc.left.toLocaleString('en-US')} characters left).`,
      data,
    };
  } catch (e) {
    return { ok: true, text: `Voices: built-in for now. ElevenLabs is not usable: ${e.message}.`, data: { ...data, error: e.message } };
  }
}

export async function runVoicesTool(params = {}, { cwd = process.cwd() } = {}) {
  const action = params.action || 'status';
  try {
    if (action === 'status') return await voicesStatus();
    if (!elevenKey()) return { ok: false, text: `ElevenLabs is not connected. The user can add a key in ${WHERE}. Without it, videos use the built-in voices (set "voice" to a built-in voice id from video_templates).` };
    const lib = await library({ fresh: !!params.refresh });
    if (action === 'list') {
      const lang = /^hi/i.test(String(params.language || '')) ? 'hi' : 'en';
      const want = { gender: /^m/i.test(params.gender || '') ? 'm' : /^f/i.test(params.gender || '') ? 'f' : '', age: params.age || 'adult', lang, role: params.role === 'narrator' ? 'narrator' : 'character' };
      const q = String(params.search || '').toLowerCase().split(/\s+/).filter(Boolean);
      let list = lib.voices.filter((v) => q.every((w) => `${v.name} ${v.gender} ${v.age} ${v.accent} ${v.language} ${v.useCase} ${v.tone} ${v.description}`.toLowerCase().includes(w)));
      if (want.gender) list = list.filter((v) => !v.gender || v.gender === (want.gender === 'm' ? 'male' : 'female'));
      list = list.map((v) => ({ v, s: scoreVoice(v, want) })).sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name)).slice(0, 25).map((x) => x.v);
      if (!list.length) return { ok: true, text: `No voice matches (${lib.voices.length} in the account). Try fewer words, or leave "voice" out and one is chosen automatically.`, data: { voices: [] } };
      return { ok: true, text: `ElevenLabs voices (best match first). Use the name as "voice" on a cast member, or as voice.narrator:\n${list.map((v) => `- ${describe(v)}`).join('\n')}`, data: { voices: list.map((v) => ({ name: v.name, gender: v.gender, age: v.age, accent: v.accent })) } };
    }
    if (action === 'test') {
      const v = findVoice(lib.voices, params.voice);
      if (!v) return { ok: false, text: `No ElevenLabs voice is called "${params.voice}". Call video_voices with action "list" for the names.` };
      const text = String(params.text || (/^hi/i.test(String(params.language || '')) ? 'नमस्ते! मैं इस कहानी की आवाज़ हूँ।' : 'Hello! I am the voice of this story.')).slice(0, 200);
      const model = pickModel(lib.models, loadSecrets().voice?.model);
      const r = await speak({ voiceId: v.id, text, model, language: /[\u0900-\u097F]/.test(text) ? 'hi' : 'en' });
      const out = path.resolve(cwd, `voice-test-${v.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'voice'}.mp3`);
      fs.writeFileSync(out, r.mp3);
      return { ok: true, text: `Test of ${describe(v)}: ${out} (${r.characters} characters billed).`, data: { file: out, voice: v.name, characters: r.characters }, files: [{ path: out, kind: 'mp3' }] };
    }
    return { ok: false, text: 'action must be "status", "list" or "test".' };
  } catch (e) {
    return { ok: false, text: `${e.message}.` };
  }
}

/**
 * Called by the app's Settings screen, with the params on standard input:
 *   { apiKey }                 check the key with ElevenLabs, then save it
 *   { provider: "edge"|"elevenlabs", model? }   switch the service without touching the key
 *   { remove: true }           delete the key from this computer
 *   {}                         status only
 */
export async function voiceKeyCommand(p = {}) {
  if (p.remove) {
    updateSecrets((s) => { delete s.elevenlabs; if (s.voice) delete s.voice.provider; });
    clearLibraryCache();
    return { ok: true, text: 'The ElevenLabs key was removed from this computer. Videos use the built-in voices.', data: (await voicesStatus()).data };
  }
  if (p.apiKey !== undefined) {
    const key = String(p.apiKey || '').trim();
    if (key.length < 20 || /\s/.test(key)) return { ok: false, text: 'That does not look like an ElevenLabs API key.' };
    let acc;
    try { acc = await account(key); } catch (e) { return { ok: false, text: `The key was not saved: ${e.message}.` }; }
    updateSecrets((s) => { s.elevenlabs = { apiKey: key, savedAt: Date.now() }; s.voice = { ...(s.voice || {}), provider: 'elevenlabs' }; });
    clearLibraryCache();
    let voices = 0;
    try { voices = (await library({ fresh: true })).voices.length; } catch { /* shown as 0 */ }
    return { ok: true, text: `ElevenLabs connected: ${acc.tier || 'account'} plan, ${acc.left.toLocaleString('en-US')} characters left, ${voices} voices. New videos use it; every character gets its own voice.`, data: (await voicesStatus()).data };
  }
  if (p.provider || p.model !== undefined) {
    if (p.provider && !['edge', 'elevenlabs'].includes(p.provider)) return { ok: false, text: 'provider must be "edge" or "elevenlabs".' };
    if (p.model && !MODEL_PREFERENCE.includes(p.model) && !/^eleven_[a-z0-9_]+$/.test(p.model)) return { ok: false, text: 'That is not an ElevenLabs model id.' };
    updateSecrets((s) => { s.voice = { ...(s.voice || {}), ...(p.provider ? { provider: p.provider } : {}), ...(p.model !== undefined ? { model: p.model || undefined } : {}) }; });
  }
  const st = await voicesStatus();
  return { ok: true, text: st.text, data: st.data };
}
