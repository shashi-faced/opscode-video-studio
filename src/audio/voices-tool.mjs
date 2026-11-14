// video_voices: which voice service is in use (built-in Edge, ElevenLabs, or Sarvam AI),
// the voices to choose from, and a short test.
// Also the key command the app's Settings screen calls. The key itself is never returned anywhere.
import fs from 'node:fs';
import path from 'node:path';
import { loadSecrets, updateSecrets, elevenKey, sarvamKey, voiceProvider } from '../secrets.mjs';
import { account, library, clearLibraryCache, pickModel, findVoice, speak, scoreVoice, MODEL_PREFERENCE } from './elevenlabs.mjs';
import { validateSarvamKey, normalizeSarvamModel, SARVAM_MODELS, SARVAM_SPEAKERS, speakSarvam } from './sarvam.mjs';

const WHERE = 'Settings → Voices';
const describe = (v) => `${v.name}: ${[v.gender, v.age.replace(/_/g, ' '), v.accent || v.language, v.useCase.replace(/_/g, ' ')].filter(Boolean).join(', ')}${v.tone ? ` (${v.tone})` : ''}`;

export async function voicesStatus() {
  const s = loadSecrets();
  const hasEleven = !!elevenKey();
  const hasSarvam = !!sarvamKey();
  const provider = voiceProvider();

  const data = {
    provider,
    elevenlabs: { connected: false, keySaved: hasEleven },
    sarvam: {
      connected: hasSarvam,
      keySaved: hasSarvam,
      model: normalizeSarvamModel(s.voice?.sarvamModel),
      speaker: s.voice?.sarvamSpeaker || 'shubh',
    },
  };

  if (hasEleven) {
    try {
      const [acc, lib] = [await account(), await library()];
      const model = pickModel(lib.models, s.voice?.model);
      data.elevenlabs = {
        connected: true,
        keySaved: true,
        tier: acc.tier,
        charactersLeft: acc.left,
        charactersLimit: acc.limit,
        voices: lib.voices.length,
        model,
      };
    } catch (e) {
      data.elevenlabs = { connected: false, keySaved: true, error: e.message };
    }
  }

  let text = '';
  if (provider === 'sarvam') {
    text = `Voices: Sarvam AI (${data.sarvam.model}, speaker: ${data.sarvam.speaker}). Natural Indic voices for Hindi and Indian English.`;
  } else if (provider === 'elevenlabs') {
    text = data.elevenlabs.connected
      ? `Voices: ElevenLabs (${data.elevenlabs.model}), ${data.elevenlabs.voices} voices, ${data.elevenlabs.charactersLeft?.toLocaleString('en-US')} of ${data.elevenlabs.charactersLimit?.toLocaleString('en-US')} characters left this period. Every character gets its own voice automatically; call video_voices with action "list" to choose by name.`
      : `Voices: built-in for now. ElevenLabs is not usable: ${data.elevenlabs.error || 'unavailable'}.`;
  } else if (hasEleven && data.elevenlabs.connected) {
    text = `Voices: built-in (the user switched ElevenLabs off in ${WHERE}; its key is saved, ${data.elevenlabs.charactersLeft?.toLocaleString('en-US')} characters left).`;
  } else if (hasSarvam) {
    text = `Voices: built-in (the user switched Sarvam AI off in ${WHERE}; its key is saved).`;
  } else {
    text = `Voices: built-in (free). For a different, expressive voice for every character, the user can configure Sarvam AI or ElevenLabs in ${WHERE}.`;
  }

  return { ok: true, text, data };
}

export async function runVoicesTool(params = {}, { cwd = process.cwd() } = {}) {
  const action = params.action || 'status';
  const provider = voiceProvider();

  try {
    if (action === 'status') return await voicesStatus();

    // ── Sarvam AI voice listing and test ──
    if (provider === 'sarvam') {
      if (!sarvamKey()) return { ok: false, text: `Sarvam AI is not connected. Add an API key in ${WHERE}.` };

      if (action === 'list') {
        const lines = SARVAM_SPEAKERS.map((s) => `- ${s.name} (${s.id}): ${s.gender}, ${s.role} — ${s.hint}`);
        return {
          ok: true,
          text: `Sarvam AI speakers:\n${lines.join('\n')}`,
          data: { speakers: SARVAM_SPEAKERS, models: SARVAM_MODELS },
        };
      }

      if (action === 'test') {
        const s = loadSecrets();
        const speaker = params.voice || s.voice?.sarvamSpeaker || 'shubh';
        const model = normalizeSarvamModel(params.model || s.voice?.sarvamModel);
        const text = String(params.text || 'नमस्ते! मैं Sarvam AI की आवाज़ हूँ। Hello from Sarvam AI.').slice(0, 200);
        const r = await speakSarvam({ text, speaker, model });
        const out = path.resolve(cwd, `voice-test-sarvam-${speaker}.wav`);
        fs.writeFileSync(out, r.audio);
        return {
          ok: true,
          text: `Test of Sarvam AI (${speaker}, ${model}): ${out}`,
          data: { file: out, speaker, characters: r.characters },
          files: [{ path: out, kind: 'wav' }],
        };
      }
    }

    // ── ElevenLabs voice listing and test ──
    if (!elevenKey()) return { ok: false, text: `ElevenLabs is not connected. The user can add a key in ${WHERE}. Without it, videos use the built-in voices.` };
    const lib = await library({ fresh: !!params.refresh });
    if (action === 'list') {
      const lang = /^hi/i.test(String(params.language || '')) ? 'hi' : 'en';
      const want = { gender: /^m/i.test(params.gender || '') ? 'm' : /^f/i.test(params.gender || '') ? 'f' : '', age: params.age || 'adult', lang, role: params.role === 'narrator' ? 'narrator' : 'character' };
      const q = String(params.search || '').toLowerCase().split(/\s+/).filter(Boolean);
      let list = lib.voices.filter((v) => q.every((w) => `${v.name} ${v.gender} ${v.age} ${v.accent} ${v.language} ${v.useCase} ${v.tone} ${v.description}`.toLowerCase().includes(w)));
      if (want.gender) list = list.filter((v) => !v.gender || v.gender === (want.gender === 'm' ? 'male' : 'female'));
      list = list.map((v) => ({ v, s: scoreVoice(v, want) })).sort((a, b) => b.s - a.s || a.v.name.localeCompare(b.v.name)).slice(0, 25).map((x) => x.v);
      if (!list.length) return { ok: true, text: `No voice matches (${lib.voices.length} in the account). Try fewer words, or leave "voice" out and one is chosen automatically.`, data: { voices: [] } };
      return { ok: true, text: `ElevenLabs voices (best match first):\n${list.map((v) => `- ${describe(v)}`).join('\n')}`, data: { voices: list.map((v) => ({ name: v.name, gender: v.gender, age: v.age, accent: v.accent })) } };
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
 * Called by the app's Settings screen:
 *   { apiKey, provider?: "elevenlabs"|"sarvam" }
 *   { sarvamApiKey }
 *   { provider: "edge"|"elevenlabs"|"sarvam", model?, speaker? }
 *   { remove: true|"sarvam"|"elevenlabs" }
 *   {} status only
 */
export async function voiceKeyCommand(p = {}) {
  // Remove key(s)
  if (p.remove) {
    if (p.remove === 'sarvam' || p.provider === 'sarvam') {
      updateSecrets((s) => {
        delete s.sarvam;
        if (s.voice?.provider === 'sarvam') delete s.voice.provider;
      });
      return { ok: true, text: 'The Sarvam AI key was removed from this computer. Videos will use the built-in voices.', data: (await voicesStatus()).data };
    }
    if (p.remove === 'elevenlabs' || p.provider === 'elevenlabs' || p.remove === true) {
      updateSecrets((s) => {
        delete s.elevenlabs;
        if (s.voice?.provider === 'elevenlabs') delete s.voice.provider;
      });
      clearLibraryCache();
      return { ok: true, text: 'The ElevenLabs key was removed from this computer. Videos will use the built-in voices.', data: (await voicesStatus()).data };
    }
  }

  // Save Sarvam AI key
  if (p.sarvamApiKey !== undefined || (p.apiKey !== undefined && p.provider === 'sarvam')) {
    const key = String(p.sarvamApiKey || p.apiKey || '').trim();
    if (key.length < 8 || /\s/.test(key)) return { ok: false, text: 'That does not look like a Sarvam AI API subscription key.' };
    try {
      await validateSarvamKey(key);
    } catch (e) {
      return { ok: false, text: `The key was not saved: ${e.message}.` };
    }
    updateSecrets((s) => {
      s.sarvam = { apiKey: key, savedAt: Date.now() };
      s.voice = { ...(s.voice || {}), provider: 'sarvam' };
    });
    return { ok: true, text: 'Sarvam AI connected! Expressive Indic voices enabled for narration and characters.', data: (await voicesStatus()).data };
  }

  // Save ElevenLabs key
  if (p.apiKey !== undefined && p.provider !== 'sarvam') {
    const key = String(p.apiKey || '').trim();
    if (key.length < 20 || /\s/.test(key)) return { ok: false, text: 'That does not look like an ElevenLabs API key.' };
    let acc;
    try { acc = await account(key); } catch (e) { return { ok: false, text: `The key was not saved: ${e.message}.` }; }
    updateSecrets((s) => {
      s.elevenlabs = { apiKey: key, savedAt: Date.now() };
      s.voice = { ...(s.voice || {}), provider: 'elevenlabs' };
    });
    clearLibraryCache();
    let voices = 0;
    try { voices = (await library({ fresh: true })).voices.length; } catch { /* shown as 0 */ }
    return { ok: true, text: `ElevenLabs connected: ${acc.tier || 'account'} plan, ${acc.left.toLocaleString('en-US')} characters left, ${voices} voices. New videos use it; every character gets its own voice.`, data: (await voicesStatus()).data };
  }

  // Switch provider or model or speaker
  if (p.provider || p.model !== undefined || p.speaker !== undefined) {
    if (p.provider && !['edge', 'elevenlabs', 'sarvam'].includes(p.provider)) {
      return { ok: false, text: 'provider must be "edge", "elevenlabs" or "sarvam".' };
    }
    updateSecrets((s) => {
      s.voice = {
        ...(s.voice || {}),
        ...(p.provider ? { provider: p.provider } : {}),
        ...(p.model !== undefined ? (p.provider === 'sarvam' || s.voice?.provider === 'sarvam' ? { sarvamModel: p.model } : { model: p.model || undefined }) : {}),
        ...(p.speaker !== undefined ? { sarvamSpeaker: p.speaker } : {}),
      };
    });
  }

  const st = await voicesStatus();
  return { ok: true, text: st.text, data: st.data };
}
