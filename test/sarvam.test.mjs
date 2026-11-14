// Sarvam AI voices: key handling, casting speakers, speech generation, and fallback.
// Runs against a local fake of the Sarvam AI API that returns valid WAV audio.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const KEY = 'test_sarvam_sub_key_0123456789abcdef';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-sarvam-'));
const seen = { speak: [] };
let fail = null;
let wavBuffer = null;

const read = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c).toString('utf8'))); });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const body = await read(req);
  if (req.headers['api-subscription-key'] !== KEY) {
    return send(res, 401, { message: 'Invalid subscription key', code: 'unauthorized' });
  }
  if (u.pathname === '/text-to-speech' && req.method === 'POST') {
    if (fail) return send(res, fail.status, fail.body);
    const j = JSON.parse(body);
    seen.speak.push(j);
    return send(res, 200, {
      audios: [wavBuffer.toString('base64')],
    });
  }
  send(res, 404, { message: 'not found' });
});

let sarvam, tts, tool, secrets;

before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.OPSCODE_VIDEO_HOME = home;
  process.env.OPSCODE_SARVAM_BASE = `http://127.0.0.1:${server.address().port}`;
  delete process.env.OPSCODE_SARVAM_KEY;
  delete process.env.OPSCODE_ELEVENLABS_KEY;
  delete process.env.OPSCODE_IGNORE_SAVED_VOICE_KEY;

  const { findFfmpeg } = await import('../src/deps/locate.mjs');
  const f = path.join(home, 'tone.wav');
  execFileSync(findFfmpeg(), ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5', '-ar', '22050', '-ac', '1', f]);
  wavBuffer = fs.readFileSync(f);

  sarvam = await import('../src/audio/sarvam.mjs');
  tts = await import('../src/audio/tts.mjs');
  tool = await import('../src/audio/voices-tool.mjs');
  secrets = await import('../src/secrets.mjs');
});

after(() => {
  server.close();
  try { fs.rmSync(home, { recursive: true, force: true }); } catch {}
});

test('Sarvam key validation: rejects invalid key and accepts valid key', async () => {
  await assert.rejects(
    async () => { await sarvam.validateSarvamKey('wrong_key_12345678'); },
    /Sarvam AI returned HTTP 401/
  );
  await assert.doesNotReject(async () => {
    await sarvam.validateSarvamKey(KEY);
  });
});

test('voiceKeyCommand: saves Sarvam AI key and updates provider', async () => {
  const r = await tool.voiceKeyCommand({ sarvamApiKey: KEY });
  assert.equal(r.ok, true);
  assert.match(r.text, /Sarvam AI connected/);
  assert.equal(secrets.voiceProvider(), 'sarvam');
  assert.equal(r.data.provider, 'sarvam');
  assert.equal(r.data.sarvam.connected, true);
  assert.equal(r.data.sarvam.keySaved, true);
});

test('voiceKeyCommand: can switch models and speakers', async () => {
  const r = await tool.voiceKeyCommand({ provider: 'sarvam', model: 'bulbul:v2', speaker: 'arvind' });
  assert.equal(r.ok, true);
  assert.equal(r.data.sarvam.model, 'bulbul:v2');
  assert.equal(r.data.sarvam.speaker, 'arvind');
});

test('sarvamCast assigns speakers and generates speech in synthesize', async () => {
  const storyboard = {
    voice: { voice: 'hi-IN-SwaraNeural' },
    scenes: [
      {
        narration: 'एक जंगल में एक खरगोश रहता था।',
        dialogue: [{ who: 'sher', text: 'मैं जंगल का राजा हूँ!' }],
      },
    ],
    cast: [{ id: 'sher', kind: 'lion' }],
  };

  const cast = await sarvam.sarvamCast(storyboard);
  assert.ok(cast);
  assert.equal(cast.model, 'bulbul:v2');
  const narratorVoice = cast.narrator();
  assert.ok(narratorVoice.speaker);
  const lionVoice = cast.get('sher');
  assert.ok(lionVoice.speaker);
  assert.notEqual(narratorVoice.speaker, lionVoice.speaker);

  const res = await tts.synthesize(storyboard);
  assert.equal(res.provider, 'sarvam');
  assert.match(res.voiceSummary, /Sarvam AI/);
  assert.ok(seen.speak.length >= 2);
});

test('voiceKeyCommand: remove sarvam key reverts to built-in voices', async () => {
  const r = await tool.voiceKeyCommand({ remove: 'sarvam' });
  assert.equal(r.ok, true);
  assert.equal(secrets.voiceProvider(), 'edge');
  assert.equal(r.data.provider, 'edge');
  assert.equal(r.data.sarvam.keySaved, false);
});
