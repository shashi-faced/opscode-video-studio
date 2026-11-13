// Keys and provider choices the user saved for this agent: ~/.opscode/agents/video-studio/secrets.json,
// readable only by the user (mode 0600). Keys are typed in the app's settings, never in the chat, and
// nothing here ever returns a key to a tool result.
import fs from 'node:fs';
import path from 'node:path';
import { HOME_DIR } from './deps/locate.mjs';

export const SECRETS_FILE = path.join(HOME_DIR, 'secrets.json');

export function loadSecrets() {
  try { const j = JSON.parse(fs.readFileSync(SECRETS_FILE, 'utf8')); return j && typeof j === 'object' ? j : {}; } catch { return {}; }
}

export function saveSecrets(next) {
  fs.mkdirSync(HOME_DIR, { recursive: true });
  const tmp = `${SECRETS_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, SECRETS_FILE);
  try { fs.chmodSync(SECRETS_FILE, 0o600); } catch { /* best effort on Windows */ }
}

/** Change part of the file: updateSecrets(s => { s.elevenlabs = { apiKey }; }). */
export function updateSecrets(fn) {
  const s = loadSecrets();
  fn(s);
  saveSecrets(s);
  return s;
}

// OPSCODE_IGNORE_SAVED_VOICE_KEY (set by the test runner) keeps tests away from the user's own key and credits.
export const elevenKey = () => String(process.env.OPSCODE_ELEVENLABS_KEY || (process.env.OPSCODE_IGNORE_SAVED_VOICE_KEY ? '' : loadSecrets().elevenlabs?.apiKey) || '').trim();

/** Which voice service to use: 'elevenlabs' when a key is saved and the user did not switch back, else 'edge'. */
export function voiceProvider() {
  const s = loadSecrets();
  if (s.voice?.provider === 'edge') return 'edge';
  return elevenKey() ? 'elevenlabs' : 'edge';
}
