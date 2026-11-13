// ElevenLabs voices: key handling, choosing a voice per character, speech with word timings, delivery
// tags. Runs against a local fake of the ElevenLabs API that returns real MP3 audio; no key, no cost.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { execFileSync } from 'node:child_process';

const KEY = 'sk_test_0123456789abcdef0123456789abcdef';
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-el-'));
const seen = { speak: [], voicesCalls: 0 };
let fail = null;   // { status, body } to make the next speech calls fail
let mp3 = null;

const VOICES = [
  { voice_id: 'v-nar-f', name: 'Asha - Warm Narrator', category: 'premade', labels: { gender: 'female', age: 'middle_aged', accent: 'indian', use_case: 'narrative_story', descriptive: 'warm' }, description: 'Calm Hindi and English narration' },
  { voice_id: 'v-boy', name: 'Kabir', category: 'premade', labels: { gender: 'male', age: 'young', accent: 'indian', use_case: 'characters_animation', descriptive: 'playful' }, description: 'A cheerful young boy, cute and playful' },
  { voice_id: 'v-gma', name: 'Dadi Sharda', category: 'premade', labels: { gender: 'female', age: 'old', accent: 'indian', use_case: 'characters_animation', descriptive: 'wise' }, description: 'A wise old grandmother' },
  { voice_id: 'v-man', name: 'Rohan', category: 'premade', labels: { gender: 'male', age: 'middle_aged', accent: 'indian', use_case: 'conversational', descriptive: 'confident' }, description: 'Confident adult man' },
  { voice_id: 'v-us-f', name: 'Rachel', category: 'premade', labels: { gender: 'female', age: 'young', accent: 'american', use_case: 'narration', descriptive: 'calm' }, description: 'American narrator' },
  { voice_id: 'v-robot', name: 'Unit 7', category: 'generated', labels: { gender: 'male', age: 'middle_aged', accent: 'american', use_case: 'characters_animation', descriptive: 'robotic' }, description: 'A synthetic robot voice' },
];

const read = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c).toString('utf8'))); });
const send = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1');
  const body = await read(req);
  if (req.headers['xi-api-key'] !== KEY) return send(res, 401, { detail: { status: 'invalid_api_key', message: 'Invalid API key' } });
  if (u.pathname === '/v1/user/subscription') return send(res, 200, { tier: 'creator', character_count: 2500, character_limit: 100000 });
  if (u.pathname === '/v1/models') return send(res, 200, [{ model_id: 'eleven_v4', can_do_text_to_speech: true }, { model_id: 'eleven_multilingual_v2', can_do_text_to_speech: true }, { model_id: 'eleven_english_sts_v2', can_do_text_to_speech: false }]);
  if (u.pathname === '/v2/voices') {
    seen.voicesCalls++;
    const second = u.searchParams.get('next_page_token') === 'p2';
    return send(res, 200, second ? { voices: VOICES.slice(3), has_more: false } : { voices: VOICES.slice(0, 3), has_more: true, next_page_token: 'p2' });
  }
  const m = /^\/v1\/text-to-speech\/([^/]+)\/with-timestamps$/.exec(u.pathname);
  if (m && req.method === 'POST') {
    if (fail) return send(res, fail.status, fail.body);
    const j = JSON.parse(body);
    seen.speak.push({ voice: m[1], model: j.model_id, text: j.text, language: j.language_code, speed: j.voice_settings?.speed, format: u.searchParams.get('output_format') });
    const chars = [...j.text];
    const step = 0.9 / chars.length;
    return send(res, 200, { audio_base64: mp3.toString('base64'), alignment: { characters: chars, character_start_times_seconds: chars.map((_, i) => +(0.05 + i * step).toFixed(3)), character_end_times_seconds: chars.map((_, i) => +(0.05 + (i + 1) * step).toFixed(3)) } });
  }
  send(res, 404, { detail: 'not found' });
});

let el, tts, tool, secrets, timeline, tools;
before(async () => {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  process.env.OPSCODE_VIDEO_HOME = home;
  process.env.OPSCODE_ELEVENLABS_BASE = `http://127.0.0.1:${server.address().port}`;
  delete process.env.OPSCODE_ELEVENLABS_KEY;
  delete process.env.OPSCODE_IGNORE_SAVED_VOICE_KEY; // this file uses its own home folder and a fake API
  const { findFfmpeg } = await import('../src/deps/locate.mjs');
  const f = path.join(home, 'tone.mp3');
  execFileSync(findFfmpeg(), ['-y', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=330:duration=1', '-ar', '44100', '-b:a', '128k', f]);
  mp3 = fs.readFileSync(f);
  el = await import('../src/audio/elevenlabs.mjs');
  tts = await import('../src/audio/tts.mjs');
  tool = await import('../src/audio/voices-tool.mjs');
  secrets = await import('../src/secrets.mjs');
  timeline = await import('../src/timeline.mjs');
  tools = await import('../src/tools.mjs');
});
after(() => { server.close(); fs.rmSync(home, { recursive: true, force: true }); });

test('without a key the built-in voices are used and nothing is sent', async () => {
  assert.equal(secrets.voiceProvider(), 'edge');
  assert.equal(await tts.elevenCast({ cast: [] }), null);
  const st = await tool.voicesStatus();
  assert.equal(st.data.provider, 'edge');
  assert.match(st.text, /Settings → Voices/);
  assert.match((await tool.runVoicesTool({ action: 'list' })).text, /not connected/);
  assert.equal(seen.voicesCalls, 0);
});

test('key command: a wrong key is refused and not saved; a good key is saved privately and never shown', async () => {
  const bad = await tool.voiceKeyCommand({ apiKey: 'sk_wrong_0123456789abcdef0123456789' });
  assert.equal(bad.ok, false);
  assert.match(bad.text, /not saved.*API key was not accepted/);
  assert.equal(fs.existsSync(secrets.SECRETS_FILE), false);
  assert.equal((await tool.voiceKeyCommand({ apiKey: 'short' })).ok, false);

  const ok = await tool.voiceKeyCommand({ apiKey: `  ${KEY}  ` });
  assert.equal(ok.ok, true, ok.text);
  assert.match(ok.text, /creator plan, 97,500 characters left, 6 voices/);
  assert.equal(JSON.stringify(ok).includes(KEY), false, 'the key is not in the result');
  assert.equal(fs.statSync(secrets.SECRETS_FILE).mode & 0o777, 0o600);
  assert.equal(secrets.voiceProvider(), 'elevenlabs');
  assert.deepEqual(ok.data.elevenlabs, { connected: true, keySaved: true, tier: 'creator', charactersLeft: 97500, charactersLimit: 100000, voices: 6, model: 'eleven_v4' });
});

test('plain reasons for failed calls', () => {
  assert.equal(el.explain(401, {}).code, 'bad_key');
  assert.equal(el.explain(402, {}).code, 'no_credit');
  assert.equal(el.explain(400, { detail: { status: 'quota_exceeded', message: 'You have 12 credits remaining' } }).code, 'no_credit');
  assert.equal(el.explain(429, {}).code, 'busy');
  assert.equal(el.explain(404, { detail: { status: 'voice_not_found' } }).code, 'voice_not_found');
  assert.match(el.explain(500, { detail: 'boom' }).text, /ElevenLabs error 500: boom/);
});

test('model: newest the account has, or the user\'s choice', () => {
  assert.equal(el.pickModel(['eleven_multilingual_v2', 'eleven_v3']), 'eleven_v3');
  assert.equal(el.pickModel(['eleven_v4', 'eleven_v3']), 'eleven_v4');
  assert.equal(el.pickModel(['eleven_v4'], 'eleven_v3'), 'eleven_v4');
  assert.equal(el.pickModel(['eleven_v4', 'eleven_v3'], 'eleven_v3'), 'eleven_v3');
  assert.equal(el.pickModel([]), 'eleven_multilingual_v2');
});

test('character times become word times; delivery tags are not words', () => {
  const text = '[laughs] Hi दोस्त!';
  const ch = [...text];
  const w = el.wordsFromAlignment({ characters: ch, character_start_times_seconds: ch.map((_, i) => i * 0.1), character_end_times_seconds: ch.map((_, i) => i * 0.1 + 0.1) });
  assert.deepEqual(w.map((x) => x.text), ['Hi', 'दोस्त!']);
  assert.ok(w[0].start >= 0.9 && w[1].end > w[1].start);
  assert.equal(el.wordsFromAlignment(null), null);
  assert.equal(el.wordsFromAlignment({ characters: ['a'], character_start_times_seconds: [], character_end_times_seconds: [] }), null);
});

test('every part gets a different, fitting voice; named voices are respected; the choice is stable', async () => {
  const lib = await el.library();
  assert.equal(lib.voices.length, 6, 'both pages were read');
  const parts = [
    { key: 'narrator', gender: 'f', age: 'adult', lang: 'hi', role: 'narrator' },
    { key: 'aman', gender: 'm', age: 'kid', lang: 'hi', role: 'character' },
    { key: 'dadi', gender: 'f', age: 'old', lang: 'hi', role: 'character' },
    { key: 'papa', gender: 'm', age: 'adult', lang: 'hi', role: 'character' },
    { key: 'bot', gender: 'm', age: 'robot', lang: 'hi', role: 'character' },
  ];
  const a = el.assignVoices(lib.voices, parts);
  assert.deepEqual(Object.fromEntries([...a].map(([k, v]) => [k, v.name])), { narrator: 'Asha - Warm Narrator', aman: 'Kabir', dadi: 'Dadi Sharda', papa: 'Rohan', bot: 'Unit 7' });
  assert.equal(new Set([...a.values()].map((v) => v.id)).size, 5);
  assert.deepEqual([...el.assignVoices(lib.voices, [...parts].reverse())].map(([k, v]) => [k, v.id]).sort(), [...a].map(([k, v]) => [k, v.id]).sort());
  const named = el.assignVoices(lib.voices, [{ ...parts[0], wanted: 'rachel' }, { ...parts[1], wanted: 'v-man' }]);
  assert.equal(named.get('narrator').name, 'Rachel');
  assert.equal(named.get('aman').name, 'Rohan');
  assert.equal(el.findVoice(lib.voices, 'Asha').id, 'v-nar-f');
  assert.equal(el.findVoice(lib.voices, 'elevenlabs:Dadi Sharda').id, 'v-gma');
  assert.equal(el.findVoice(lib.voices, 'nobody'), null);
});

test('delivery tags never reach the screen, the captions or the built-in voices', () => {
  assert.equal(timeline.stripTags('[laughs] अरे वाह!  [whispers] चुप'), 'अरे वाह! चुप');
  assert.equal(timeline.stripTags('Price [2024] and [a] list [see note 12]'), 'Price [2024] and [a] list [see note 12]', 'only word tags are removed');
  assert.deepEqual(timeline.captionTokens('[excited] यह *कमाल* है').map((t) => t.text), ['यह', 'कमाल', 'है']);
  assert.equal(timeline.markup('[sad] I *lost* it'), 'I <mark>lost</mark> it');
  assert.equal(tts.isEdgeVoice('hi-IN-SwaraNeural'), true);
  assert.equal(tts.isEdgeVoice('Dadi Sharda'), false);
  // A cast member with an ElevenLabs voice name still gets a valid built-in voice as the fallback.
  assert.equal(tts.castVoices({ voice: { voice: 'hi-IN-SwaraNeural' }, cast: [{ id: 'dadi', kind: 'grandma', voice: 'Dadi Sharda' }] }).get('dadi').voice, 'hi-IN-SwaraNeural');
});

const story = () => ({
  voice: { provider: 'edge', voice: 'hi-IN-SwaraNeural' }, captions: { timing: 'tts' },
  cast: [{ id: 'aman', kind: 'boy', name: 'अमन' }, { id: 'dadi', kind: 'grandma', name: 'दादी' }],
  scenes: [
    { narration: 'एक दिन अमन ने दादी से पूछा।' },
    { lines: [{ who: 'aman', text: '[excited] दादी, चाय कैसे बनती है?' }, { who: 'dadi', text: '[laughs] आओ बेटा, सिखाती हूँ।' }] },
    { narration: 'और दोनों रसोई में चले गए।' },
  ],
});

test('a Hindi story: narrator, boy and grandmother each speak with their own voice, with word times', async () => {
  seen.speak.length = 0;
  const out = await tts.synthesize(story());
  assert.equal(out.provider, 'elevenlabs');
  assert.deepEqual(seen.speak.map((s) => s.voice), ['v-nar-f', 'v-boy', 'v-gma', 'v-nar-f']);
  assert.ok(seen.speak.every((s) => s.model === 'eleven_v4' && s.language === 'hi' && s.format === 'mp3_44100_128'));
  assert.equal(seen.speak[1].text, '[excited] दादी, चाय कैसे बनती है?', 'the newest model gets the delivery tag');
  assert.equal(seen.speak[1].speed, 1.05, 'a child speaks a little faster');
  assert.equal(seen.speak[2].speed, 0.93, 'a grandparent a little slower');
  assert.equal(seen.speak[0].speed, undefined);
  assert.equal(out.length, 3);
  assert.ok(out[0].samples.length > 20000 && out[1].parts.length === 2);
  assert.deepEqual(out[0].words.map((w) => w.text), ['एक', 'दिन', 'अमन', 'ने', 'दादी', 'से', 'पूछा।']);
  assert.deepEqual(out[1].partWords[0].map((w) => w.text), ['दादी,', 'चाय', 'कैसे', 'बनती', 'है?'], 'no tag in the word times');
  assert.match(out.voiceSummary, /^ElevenLabs \(eleven_v4\) — narrator: Asha - Warm Narrator; aman: Kabir; dadi: Dadi Sharda \(\d+ characters billed\)$/);
  assert.equal(JSON.stringify(out.notes).includes(KEY), false);
});

test('the same story again costs nothing: every clip comes from the cache', async () => {
  seen.speak.length = 0;
  const out = await tts.synthesize(story());
  assert.equal(seen.speak.length, 0);
  assert.match(out.voiceSummary, /0 characters billed, 4 clip\(s\) reused from cache/);
});

test('named voices: voice.narrator and a cast member\'s voice', async () => {
  seen.speak.length = 0;
  const sb = story();
  sb.voice.narrator = 'Rachel';
  sb.cast[0].voice = 'Rohan';
  sb.scenes = [{ narration: 'नई कहानी।' }, { lines: [{ who: 'aman', text: 'नमस्ते।' }, { who: 'dog', text: 'भौं भौं।' }] }];
  const out = await tts.synthesize(sb);
  assert.deepEqual(seen.speak.map((s) => s.voice).slice(0, 2), ['v-us-f', 'v-man']);
  assert.ok(!['v-us-f', 'v-man', 'v-gma'].includes(seen.speak[2].voice), 'a speaker outside the cast gets a voice nobody else has');
  assert.match(out.voiceSummary, /narrator: Rachel; aman: Rohan/);
});

test('an older model never receives delivery tags (it would read them aloud)', async () => {
  await tool.voiceKeyCommand({ model: 'eleven_multilingual_v2' });
  seen.speak.length = 0;
  const sb = story();
  sb.scenes = [{ lines: [{ who: 'dadi', text: '[whispers] सो जाओ बेटा।' }] }];
  await tts.synthesize(sb);
  assert.deepEqual(seen.speak.map((s) => [s.model, s.text, s.language]), [['eleven_multilingual_v2', 'सो जाओ बेटा।', undefined]]);
  await tool.voiceKeyCommand({ model: '' });
});

test('video_voices: status, list by need, and a test clip', async () => {
  const st = await tools.runTool('video_voices', { action: 'status' });
  assert.match(st.text, /^Voices: ElevenLabs \(eleven_v4\), 6 voices, 97,500 of 100,000 characters left/);
  const list = await tools.runTool('video_voices', { action: 'list', gender: 'female', language: 'hi', age: 'old' });
  assert.match(list.text.split('\n')[1], /^- Dadi Sharda: female, old, indian, characters animation \(wise\)$/);
  assert.ok(!/Kabir|Rohan/.test(list.text));
  assert.match((await tools.runTool('video_voices', { action: 'list', search: 'robot' })).text, /Unit 7/);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-elt-'));
  const t = await tools.runTool('video_voices', { action: 'test', voice: 'Kabir', language: 'hi' }, { cwd: d });
  assert.equal(t.ok, true, t.text);
  assert.ok(fs.statSync(path.join(d, 'voice-test-kabir.mp3')).size > 1000);
  assert.match((await tools.runTool('video_voices', { action: 'test', voice: 'Nobody' })).text, /No ElevenLabs voice is called "Nobody"/);
  fs.rmSync(d, { recursive: true, force: true });
  assert.ok(tools.TOOL_DEFS.some((x) => x.name === 'video_voices'));
  assert.ok(JSON.parse(fs.readFileSync('agent/manifest.json', 'utf8')).allowedTools.includes('video_voices'));
});

test('switching back to the built-in voices keeps the key; removing the key deletes it', async () => {
  await tool.voiceKeyCommand({ provider: 'edge' });
  assert.equal(secrets.voiceProvider(), 'edge');
  assert.equal(await tts.elevenCast(story()), null);
  assert.match((await tool.voicesStatus()).text, /built-in \(the user switched ElevenLabs off/);
  await tool.voiceKeyCommand({ provider: 'elevenlabs' });
  assert.equal(secrets.voiceProvider(), 'elevenlabs');
  const r = await tool.voiceKeyCommand({ remove: true });
  assert.equal(r.ok, true);
  assert.equal(secrets.loadSecrets().elevenlabs, undefined);
  assert.equal(secrets.voiceProvider(), 'edge');
});

test('if ElevenLabs cannot be reached at the start, the built-in voices are used with a note', async () => {
  await tool.voiceKeyCommand({ apiKey: KEY });
  el.clearLibraryCache();
  const saved = secrets.loadSecrets();
  secrets.saveSecrets({ ...saved, elevenlabs: { apiKey: 'sk_revoked_0123456789abcdef0123456789' } });
  const notes = [];
  assert.equal(await tts.elevenCast(story(), notes), null);
  assert.match(notes[0], /ElevenLabs was not used \(the ElevenLabs API key was not accepted.*built-in voices were used/);
  secrets.saveSecrets(saved);
});
