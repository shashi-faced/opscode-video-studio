// HyperFrames engine (plan 16, H1–H2): runtime rules, the guide and starter, and the five tools.
// Tests that need the engine (about 200 MB, Node 22+) are skipped when it is not installed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ALLOWED_COMMANDS, hfEnv, lastJson, runtimeStatus, nodeMajor, MIN_NODE, HF_DIR } from '../src/hyperframes/runtime.mjs';
import { guideText, starterHtml, resolveFormat, FORMATS, PROJECT_FONTS } from '../src/hyperframes/guide.mjs';
import { HF_TOOL_DEFS, readCheck, ownFindings, runHfTool } from '../src/hyperframes/tools.mjs';
import { TOOL_DEFS, runTool } from '../src/tools.mjs';
import { splitLines, pickVoice, planScenes, wordsFor, captionsScript, LEAD, TAIL, MIN_SCENE } from '../src/hyperframes/voice.mjs';

test('only local commands are reachable: nothing that uploads, publishes or bills', () => {
  for (const c of ['cloud', 'publish', 'share', 'lambda', 'cloudrun', 'billing', 'templates', 'reverse', 'skills', 'upgrade', 'update', 'open', 'transcribe', 'tts'])
    assert.equal(ALLOWED_COMMANDS.has(c), false, c);
  for (const c of ['init', 'add', 'catalog', 'check', 'snapshot', 'render', 'info', 'docs']) assert.equal(ALLOWED_COMMANDS.has(c), true, c);
});

test('every call turns usage tracking and skill installs off and keeps the cache in our folder', () => {
  const e = hfEnv();
  assert.equal(e.DO_NOT_TRACK, '1');
  assert.equal(e.HYPERFRAMES_NO_TELEMETRY, '1');
  assert.equal(e.HYPERFRAMES_SKIP_SKILLS, '1');
  assert.equal(e.HYPERFRAMES_CACHE_DIR, path.join(HF_DIR, 'cache'));
});

test('lastJson finds the result object after progress lines', () => {
  assert.deepEqual(lastJson('[info] x\n{"a":1}\nnoise {"ok":true,"n":[1,2]}\n'), { ok: true, n: [1, 2] });
  assert.deepEqual(lastJson('[{"name":"a"}]'), [{ name: 'a' }]);
  assert.equal(lastJson('no json here'), null);
  assert.equal(lastJson(''), null);
});

test('formats: names and aliases', () => {
  assert.equal(resolveFormat('16:9'), '16:9');
  assert.equal(resolveFormat('YouTube'), '16:9');
  assert.equal(resolveFormat('square'), '1:1');
  assert.equal(resolveFormat(undefined), '9:16');
  assert.equal(resolveFormat('reel'), '9:16');
});

test('starter: right canvas, local script and fonts, one registered timeline, nothing from the internet', () => {
  for (const f of Object.keys(FORMATS)) {
    const html = starterHtml(f);
    const { w, h } = FORMATS[f];
    assert.ok(html.includes(`data-width="${w}" data-height="${h}"`), f);
    assert.ok(html.includes(`width: ${w}px; height: ${h}px`), f);
    assert.ok(html.includes('<script src="assets/gsap.min.js"></script>'));
    assert.ok(html.includes('<link rel="stylesheet" href="assets/fonts.css" />'));
    assert.ok(html.includes('window.__timelines["main"] = tl;'));
    assert.doesNotMatch(html, /https?:\/\//);
    assert.deepEqual(ownFindings(html), []);
    // Scenes follow each other and end at the total.
    const total = +/data-composition-id="main" data-start="0" data-duration="(\d+)"/.exec(html)[1];
    const scenes = [...html.matchAll(/<section[^>]*data-start="(\d+)" data-duration="(\d+)"/g)].map((m) => [+m[1], +m[2]]);
    assert.deepEqual(scenes.map((s) => s[0]), scenes.map((_, i) => scenes.slice(0, i).reduce((a, s) => a + s[1], 0)));
    assert.equal(scenes.reduce((a, s) => a + s[1], 0), total);
  }
  for (const f of PROJECT_FONTS) assert.ok(fs.existsSync(path.join('fonts', f.file)), f.file);
  assert.ok(PROJECT_FONTS.some((f) => f.family === 'Hind' && /0900-097F/.test(f.range || '')), 'Devanagari is covered');
});

test('guide: steps, rules and the starter, sized to the format', () => {
  const g = guideText('16:9');
  for (const s of ['hyperframes_project', 'hyperframes_check', 'hyperframes_preview', 'hyperframes_render', '1920x1080', 'window.__timelines["main"] = tl;', 'Frame 0 must already show the title', '"Poppins"', '"Hind"']) assert.ok(g.includes(s), s);
  assert.ok(g.includes(starterHtml('16:9')));
  assert.ok(Buffer.byteLength(g) < 8000, 'short enough for small models');
});

test('check results: errors block, warnings do not, studio-only findings are left out', () => {
  const r = readCheck({
    lint: { findings: [{ code: 'nested_structure_needs_subcomposition', severity: 'warning', message: 'x' }, { code: 'gsap_timeline_not_registered', severity: 'error', message: 'GSAP timeline is created   but never registered', selector: '[data-composition-id]' }] },
    layout: { findings: [{ code: 'text_box_overflow', severity: 'error', message: 'Text extends outside', selector: '#s2-text', time: 4 }, { code: 'canvas_overflow', severity: 'warning', message: 'w', selector: '#a', time: 0 }] },
    audio: { findings: [{ code: 'audio_none', severity: 'info', message: 'no sound' }] },
  });
  assert.deepEqual(r.errors.map((e) => [e.code, e.where]), [['gsap_timeline_not_registered', '[data-composition-id]'], ['text_box_overflow', '#s2-text at 4s']]);
  assert.equal(r.errors[0].message, 'GSAP timeline is created but never registered');
  assert.deepEqual(r.warnings.map((e) => e.code), ['canvas_overflow']);
  assert.deepEqual(readCheck(null), { errors: [], warnings: [] });
});

test('our own findings: scripts or fonts from the internet, timers and randomness', () => {
  const codes = (h) => ownFindings(h).map((f) => f.code);
  const F = '<link rel="stylesheet" href="assets/fonts.css" />';
  assert.deepEqual(codes(`${F}<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>`), ['remote_script']);
  assert.deepEqual(codes(`${F}<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter">`), ['remote_style']);
  assert.deepEqual(codes(`${F}<script>setTimeout(() => tl.play(), 100); const r = Math.random();</script>`), ['not_deterministic']);
  assert.deepEqual(codes('<a href="https://example.com">x</a><script src="assets/gsap.min.js"></script><link rel="stylesheet" href="assets/fonts.css" />'), []);
  assert.deepEqual(codes('<script src="assets/gsap.min.js"></script>'), ['fonts_not_loaded']);
});

test('the five tools are part of the agent, and reach the same code through runTool', async () => {
  const names = TOOL_DEFS.map((t) => t.name);
  for (const t of HF_TOOL_DEFS) { assert.ok(names.includes(t.name), t.name); assert.ok(t.description.length > 40 && t.parameters.type === 'object'); }
  assert.equal(HF_TOOL_DEFS.length, 6);
  const g = await runTool('hyperframes_guide', { format: '1:1' });
  assert.equal(g.ok, true);
  assert.ok(g.text.includes('1080x1080'));
  const manifest = JSON.parse(fs.readFileSync('agent/manifest.json', 'utf8'));
  for (const t of HF_TOOL_DEFS) assert.ok(manifest.allowedTools.includes(t.name), `${t.name} allowed`);
  assert.match(manifest.systemPrompt, /MOTION DESIGN WITH HYPERFRAMES/);
});

test('plain messages for a missing folder, a missing project and a wrong action', async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-hf-'));
  assert.match((await runHfTool('hyperframes_check', {}, { cwd: d })).text, /Give "dir"/);
  for (const t of ['hyperframes_check', 'hyperframes_preview', 'hyperframes_render']) {
    const r = await runHfTool(t, { dir: 'nope' }, { cwd: d });
    assert.equal(r.ok, false);
    assert.match(r.text, /No HyperFrames project at .*nope.*hyperframes_project/);
  }
  fs.rmSync(d, { recursive: true, force: true });
});

test('voice: lines from an array or a script, in Hindi and English', () => {
  assert.deepEqual(splitLines([' Tea  wakes you up. ', '', 'Drink it.'], null), ['Tea wakes you up.', 'Drink it.']);
  assert.deepEqual(splitLines(null, 'चाय पियो। ताज़ा रहो।'), ['चाय पियो।', 'ताज़ा रहो।']);
  assert.deepEqual(splitLines(null, 'One line\nTwo. Still two.'), ['One line', 'Two. Still two.']);
  assert.deepEqual(splitLines([], ''), []);
});

test('voice: the voice follows the language of the text unless one is named', () => {
  assert.equal(pickVoice(null, null, ['चाय के फ़ायदे']), 'hi-IN-SwaraNeural');
  assert.equal(pickVoice(null, null, ['Tea is good']), 'en-IN-NeerjaExpressiveNeural');
  assert.equal(pickVoice(null, 'Hindi', ['Tea']), 'hi-IN-SwaraNeural');
  assert.equal(pickVoice('hi-IN-MadhurNeural', 'en', ['Tea']), 'hi-IN-MadhurNeural');
  assert.equal(pickVoice('not a voice', null, ['Tea']), 'en-IN-NeerjaExpressiveNeural');
});

test('voice: scenes are timed to the voice, follow each other and never run short', () => {
  const p = planScenes([2.6, 0.8, 4.11]);
  assert.deepEqual(p.scenes.map((s) => [s.start, s.duration]), [[0, 3.4], [3.4, 2.5], [5.9, 4.9]]);
  assert.equal(p.total, 10.8);
  p.scenes.forEach((s, i) => {
    assert.ok(Math.abs(s.voiceStart - (s.start + LEAD)) < 1e-9);
    assert.ok(s.voiceEnd + TAIL <= s.start + s.duration + 0.051, `scene ${i} holds its line`);
    assert.ok(s.duration >= MIN_SCENE);
  });
  assert.deepEqual(planScenes([]), { scenes: [], total: 0 });
});

test('voice: word times come from the voice, or are spread over the line when it gave none', () => {
  assert.deepEqual(wordsFor('Hi there', [{ text: 'Hi', start: 0.1, end: 0.3 }, { text: 'there', start: 0.35, end: 0.8 }], 3.7, 1),
    [{ text: 'Hi', start: 3.8, end: 4 }, { text: 'there', start: 4.05, end: 4.5 }]);
  const w = wordsFor('चाय बहुत अच्छी है', null, 2, 2);
  assert.deepEqual(w.map((x) => x.text), ['चाय', 'बहुत', 'अच्छी', 'है']);
  assert.equal(w[0].start, 2);
  assert.ok(w.every((x, i) => x.end > x.start && (i === 0 || x.start >= w[i - 1].end)) && w.at(-1).end <= 4.001);
});

test('captions script: shows each line in its time, lights up words on the main timeline, sized to the frame', () => {
  const cues = [{ start: 0.25, end: 2.9, text: 'चाय के फ़ायदे', words: [{ text: 'चाय', start: 0.3, end: 0.6 }, { text: 'के', start: 0.62, end: 0.8 }, { text: 'फ़ायदे', start: 0.82, end: 1.4 }] }];
  const tall = captionsScript(cues, { width: 1080, height: 1920, style: 'karaoke' });
  assert.ok(tall.includes('"s":0.25,"e":2.9') && tall.includes('["चाय",0.3]'));
  assert.ok(tall.includes('window.__timelines["main"]') && tall.includes('tl.set(box, { opacity: 1 }, c.s)') && tall.includes('tl.set(box, { opacity: 0 }, c.e)'));
  assert.ok(tall.includes('var light = true') && tall.includes('font-size:65px') && tall.includes('bottom:384px'));
  const wide = captionsScript(cues, { width: 1920, height: 1080, style: 'line' });
  assert.ok(wide.includes('var light = false') && wide.includes('font-size:56px') && wide.includes('bottom:97px'));
  assert.doesNotMatch(tall, /https?:|setTimeout|Math\.random|Date/);
  new Function('window', 'document', tall)({ __timelines: {} }, { getElementById: () => null }); // runs, and does nothing without the page
});

const st = runtimeStatus();
const engine = st.installed && st.ffprobe && st.chrome && nodeMajor() >= MIN_NODE ? false : 'HyperFrames engine not installed (or Node older than 22)';

test('engine: init makes a valid offline project; check, preview and render work; a model-written page passes', { skip: engine, timeout: 300000 }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-hf-'));
  const ctx = { cwd: d };
  const init = await runHfTool('hyperframes_project', { action: 'init', dir: 'promo', format: '9:16' }, ctx);
  assert.equal(init.ok, true, init.text);
  const P = path.join(d, 'promo');
  assert.deepEqual(fs.readdirSync(P).sort(), ['assets', 'hyperframes.json', 'index.html', 'meta.json']);
  assert.ok(fs.existsSync(path.join(P, 'assets', 'gsap.min.js')));
  assert.equal(fs.readdirSync(path.join(P, 'assets', 'fonts')).length, PROJECT_FONTS.length);
  assert.ok(fs.readFileSync(path.join(P, 'assets', 'fonts.css'), 'utf8').includes('hind-devanagari-600-normal.woff2'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(P, 'meta.json'), 'utf8')).name, 'promo');
  assert.match((await runHfTool('hyperframes_project', { action: 'init', dir: 'promo' }, ctx)).text, /already has an index\.html/);

  const ok = await runHfTool('hyperframes_check', { dir: 'promo' }, ctx);
  assert.equal(ok.ok, true, ok.text);
  assert.match(ok.text, /valid \(8 s\)/);

  // A composition written by a model from our rules (eval/hyperframes/samples), with Hindi text added.
  const sample = fs.readFileSync('eval/hyperframes/samples/longcat-taskflow.html', 'utf8').replace('Plan less. Do more.', 'कम योजना, ज़्यादा काम।');
  fs.writeFileSync(path.join(P, 'index.html'), sample);
  const c2 = await runHfTool('hyperframes_check', { dir: 'promo' }, ctx);
  assert.equal(c2.ok, true, c2.text);

  const pv = await runHfTool('hyperframes_preview', { dir: 'promo', at: [1, 5] }, ctx);
  assert.equal(pv.ok, true, pv.text);
  assert.ok(fs.statSync(pv.imageFile).size > 5000);

  const events = [];
  const r = await runHfTool('hyperframes_render', { dir: 'promo', quality: 'draft' }, { ...ctx, onProgress: (p) => events.push(p.stage) });
  assert.equal(r.ok, true, r.text);
  assert.equal(r.videoFile, path.join(P, 'promo.mp4'));
  assert.ok(fs.statSync(r.videoFile).size > 20000);
  assert.deepEqual(events.slice(0, 2), ['checking', 'render']);
  fs.rmSync(d, { recursive: true, force: true });
});

test('engine: a broken page is refused with fixes, and is not rendered', { skip: engine, timeout: 200000 }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-hf-'));
  const ctx = { cwd: d };
  await runHfTool('hyperframes_project', { action: 'init', dir: 'bad', format: '16:9' }, ctx);
  const f = path.join(d, 'bad', 'index.html');
  fs.writeFileSync(f, fs.readFileSync(f, 'utf8')
    .replace('<script src="assets/gsap.min.js"></script>', '<script src="https://cdn.jsdelivr.net/npm/gsap@3/dist/gsap.min.js"></script>')
    .replace('window.__timelines["main"] = tl;', ''));
  const c = await runHfTool('hyperframes_check', { dir: 'bad' }, ctx);
  assert.equal(c.ok, false);
  const codes = c.data.errors.map((e) => e.code);
  for (const code of ['remote_script', 'gsap_timeline_not_registered']) assert.ok(codes.includes(code), `${code} in ${codes}`);
  // Text that does not fit is found on an otherwise valid page.
  await runHfTool('hyperframes_project', { action: 'init', dir: 'wide', format: '9:16' }, ctx);
  const w = path.join(d, 'wide', 'index.html');
  fs.writeFileSync(w, fs.readFileSync(w, 'utf8').replace('<p id="s2-text">', '<p id="s2-text" style="width:2400px;font-size:160px;white-space:nowrap">'));
  const c3 = await runHfTool('hyperframes_check', { dir: 'wide' }, ctx);
  assert.equal(c3.ok, false, c3.text);
  assert.ok(c3.data.errors.some((e) => /overflow/.test(e.code) && /#s2-text/.test(e.where)), JSON.stringify(c3.data.errors.map((e) => e.code)));
  assert.match(c.text, /FIX: use exactly <script src="assets\/gsap\.min\.js">/);
  const r = await runHfTool('hyperframes_render', { dir: 'bad' }, ctx);
  assert.equal(r.ok, false);
  assert.match(r.text, /Not rendered/);
  assert.equal(fs.existsSync(path.join(d, 'bad', 'bad.mp4')), false);
  fs.rmSync(d, { recursive: true, force: true });
});

test('engine + voice: a Hindi video with voice, music and word captions renders with sound', { skip: engine, timeout: 300000 }, async (t) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-hf-'));
  const ctx = { cwd: d };
  await runHfTool('hyperframes_project', { action: 'init', dir: 'chai', format: '9:16' }, ctx);
  const v = await runHfTool('hyperframes_voice', { dir: 'chai', lines: ['चाय के दो बड़े फ़ायदे जानिए।', 'यह आपको तुरंत ताज़गी देती है।'], music: 'ambient' }, ctx);
  if (!v.ok && /internet|voice service/.test(v.text)) { fs.rmSync(d, { recursive: true, force: true }); return t.skip('the voice service is not reachable'); }
  assert.equal(v.ok, true, v.text);
  assert.equal(v.data.voice, 'hi-IN-SwaraNeural');
  assert.equal(v.data.scenes.length, 2);
  assert.match(v.text, /scene 2: data-start="[\d.]+" data-duration="[\d.]+"/);
  const P = path.join(d, 'chai');
  for (const f of ['assets/audio.wav', 'assets/captions.js', 'transcript.json', 'voice.json']) assert.ok(fs.existsSync(path.join(P, f)), f);
  const words = JSON.parse(fs.readFileSync(path.join(P, 'transcript.json'), 'utf8'));
  assert.ok(words.length >= 8 && words.every((w, i) => w.id === `w${i}` && w.end > w.start && w.end <= v.data.total));
  // Build the page to the returned times, the way the agent is told to.
  const [a, b] = v.data.scenes, T = v.data.total;
  let html = fs.readFileSync(path.join(P, 'index.html'), 'utf8')
    .replace('data-start="0" data-duration="8" data-width', `data-start="0" data-duration="${T}" data-width`)
    .replace('id="s1" class="clip" data-start="0" data-duration="4"', `id="s1" class="clip" data-start="${a.start}" data-duration="${a.duration}"`)
    .replace('id="s2" class="clip" data-start="4" data-duration="4"', `id="s2" class="clip" data-start="${b.start}" data-duration="${b.duration}"`)
    .replace(/  tl\.to\("#s[12]-title".*\n/g, '')
    .replace('}, 4.2);', `}, ${b.start + 0.2});`).replace('}, 5.0);', `}, ${b.start + 0.7});`)
    .replace('  </section>\n</div>', `  </section>\n  <audio id="audio" src="assets/audio.wav" data-start="0" data-duration="${T}" data-track-index="1" data-volume="1"></audio>\n  <div id="captions" class="clip" data-start="0" data-duration="${T}" data-track-index="2"></div>\n</div>`)
    .replace('</script>\n</body>', '</script>\n<script src="assets/captions.js"></script>\n</body>');
  fs.writeFileSync(path.join(P, 'index.html'), html);
  const c = await runHfTool('hyperframes_check', { dir: 'chai' }, ctx);
  assert.equal(c.ok, true, c.text);
  const r = await runHfTool('hyperframes_render', { dir: 'chai', quality: 'draft' }, ctx);
  assert.equal(r.ok, true, r.text);
  assert.doesNotMatch(r.text, /has no sound/);
  const { probeVideo } = await import('../src/captions/burn.mjs');
  const info = probeVideo(r.videoFile);
  assert.ok(Math.abs(info.duration - T) < 0.3, `length ${info.duration} vs ${T}`);
  assert.equal(info.hasAudio, true);
  fs.rmSync(d, { recursive: true, force: true });
});
