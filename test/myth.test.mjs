// Plan 19: mythology figures, places of the old stories, the madhubani style, katha format, devotional music.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validate } from '../src/schema/validate.mjs';
import { buildTimeline } from '../src/timeline.mjs';
import { compile } from '../src/compiler/compile.mjs';
import { mythSvg, MYTH_KINDS } from '../src/compiler/myth.mjs';
import { characterSvg, KIND_INFO } from '../src/compiler/characters.mjs';
import { mythBackgroundHtml, MYTH_PLACES, lightHtml, drawsPlace } from '../src/compiler/mythPlaces.mjs';
import { CHARACTER_KINDS, BACKGROUNDS, POSES, CHARACTER_MOODS, MUSIC_STYLES } from '../src/schema/spec.mjs';
import { FORMAT_RECIPES, resolveFormat } from '../src/formats-guide.mjs';
import { STYLES, STYLE_ALIASES } from '../src/art/styles.mjs';
import { synthMusic } from '../src/audio/synth.mjs';
import { castVoices } from '../src/audio/tts.mjs';

const clean = (s) => s.startsWith('<svg') && !s.includes('undefined') && !s.includes('NaN');

test('every mythology figure draws in both skins, every pose and mood, on the shared rig', () => {
  for (const k of Object.keys(MYTH_KINDS)) {
    assert.ok(CHARACTER_KINDS.includes(k), `${k} is a character kind`);
    assert.equal(KIND_INFO[k].plan, 'myth');
    for (const skin of ['madhubani', 'flat']) for (const pose of POSES) for (const mood of CHARACTER_MOODS) {
      const s = mythSvg(k, { skin, pose, mood, uid: 't' });
      assert.ok(clean(s), `${k} ${skin} ${pose} ${mood}`);
      for (const part of ['ch-head', 'ch-mouth-closed', 'ch-mouth-open', 'ch-vis', 'ch-leg-l', 'ch-leg-r']) assert.ok(s.includes(part), `${k} has ${part}`);
    }
  }
  assert.match(characterSvg('hanuman', { mood: 'happy' }, 'x'), /plan-myth skin-flat/);
});

test('deities keep weapons off their faces: long weapons go in the far hand, drawn behind the head', () => {
  for (const k of ['hanuman', 'shiva', 'ram', 'krishna', 'durga']) {
    const s = mythSvg(k, { skin: 'madhubani', uid: 'w' });
    const back = s.indexOf('ch-arm-l"'), head = s.indexOf('class="ch-head"'), front = s.indexOf('ch-arm-r"');
    assert.ok(back > 0 && back < head && head < front, `${k}: far arm, head, near arm`);
  }
});

test('kinds from words: aliases, Hindi names, whole words only, and 3D keeps its presets', () => {
  const r = validate({ voice: { provider: 'none' }, cast: ['lord-hanuman', 'Shanidev', { id: 'b', kind: 'बजरंगबली' }, 'golden-deer', 'ramesh', 'kitty-cat'], scenes: [{ template: 'story', text: 'a' }, { template: 'story', text: 'b' }] });
  assert.deepEqual(r.storyboard.cast.map((c) => c.kind), ['hanuman', 'shani', 'hanuman', 'deer', 'ramesh', 'cat']);
  const r3 = validate({ look: '3d', voice: { provider: 'none' }, cast: [{ id: 'c', kind: 'cow' }], scenes: [{ template: 'story', background: 'temple', characters: [{ who: 'c' }], narration: 'a' }, { template: 'story', background: 'kailash', narration: 'b' }] });
  assert.equal(r3.storyboard.cast[0].design?.plan, 'quadruped', '3D cow uses its 3D preset, not the 2D figure');
  assert.deepEqual(r3.storyboard.scenes.map((s) => s.background), ['village', 'mountains']);
});

test('voices are cast from the figures: Sita female, Brahma old', () => {
  const v = castVoices({ voice: { provider: 'edge', voice: 'hi-IN-MadhurNeural' }, cast: [{ id: 's', kind: 'sita' }, { id: 'h', kind: 'hanuman' }] });
  assert.notEqual(v.get('s').voice, v.get('h').voice);
  assert.equal(KIND_INFO.sita.gender, 'f');
  assert.equal(KIND_INFO.brahma.age, 'old');
});

test('places of the stories draw in both skins at every time; light effects', () => {
  for (const p of MYTH_PLACES) {
    assert.ok(BACKGROUNDS.includes(p), p);
    for (const skin of ['madhubani', 'flat']) for (const t of ['day', 'sunset', 'night']) {
      const h = mythBackgroundHtml(p, t, skin);
      assert.ok(h.includes('class="bgart"') && !h.includes('undefined') && !h.includes('NaN'), `${p} ${skin} ${t}`);
    }
  }
  assert.ok(drawsPlace('meadow', 'madhubani') && !drawsPlace('meadow', 'flat') && drawsPlace('temple', 'flat'));
  for (const l of ['divine', 'petals', 'sparkles']) assert.match(lightHtml(l), new RegExp(`fx-${l}`));
  assert.equal(lightHtml('none'), '');
  const r = validate({ voice: { provider: 'none' }, scenes: [{ template: 'story', background: 'Ganga', light: 'god appears', text: 'a' }, { template: 'story', background: 'kurukshetra', light: 'flower rain', text: 'b' }] });
  assert.deepEqual(r.storyboard.scenes.map((s) => [s.background, s.light]), [['ghat', 'divine'], ['battlefield', 'petals']]);
});

test('madhubani style: painted border, Madhubani figures and places, motifs on text scenes', () => {
  assert.equal(STYLES.madhubani.base, '2d');
  assert.equal(STYLE_ALIASES.mithila, 'madhubani');
  const sb = validate(FORMAT_RECIPES.katha.example).storyboard;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ovs-'));
  const { file } = compile(sb, buildTimeline(sb), { baseDir: dir, buildDir: dir });
  const html = fs.readFileSync(file, 'utf8');
  assert.equal((html.match(/class="md-border"/g) || []).length, sb.scenes.length);
  assert.ok(html.includes('plan-myth skin-madhubani'));
  assert.ok(html.includes('class="bg mpl-madhubani"'));
  assert.ok(html.includes('class="md-motif"'), 'title and cta scenes get painted motifs');
  assert.ok(html.includes('fx-divine') && html.includes('fx-petals'));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('katha format: found by its names, example validates with no warnings', () => {
  for (const w of ['katha', 'ramayan', 'Mahabharata', 'mythology']) assert.equal(resolveFormat(w), 'katha', w);
  const r = validate(FORMAT_RECIPES.katha.example);
  assert.ok(r.ok);
  assert.deepEqual(r.warnings, []);
  assert.equal(r.storyboard.music.style, 'devotional');
});

test('devotional music: tanpura, flute and bells, never silent or broken, cues on divine scenes', () => {
  assert.ok(MUSIC_STYLES.includes('devotional'));
  const scenes = Array.from({ length: 6 }, (_, i) => ({ index: i, start: i * 3, duration: 3, ...(i === 3 ? { light: 'divine' } : {}) }));
  const [L, R] = synthMusic({ duration: 18, scenes }, { style: 'devotional' });
  let peak = 0, rms = 0;
  for (let i = 0; i < L.length; i++) { assert.ok(Number.isFinite(L[i]) && Number.isFinite(R[i])); peak = Math.max(peak, Math.abs(L[i])); rms += L[i] * L[i]; }
  assert.ok(peak > 0.9 && peak <= 1.0001);
  assert.ok(Math.sqrt(rms / L.length) > 0.03, 'audible');
  const tl = buildTimeline(validate(FORMAT_RECIPES.katha.example).storyboard);
  assert.equal(tl.scenes[3].light, 'divine');
});

test('the agent guide (video_templates) teaches katha, madhubani, the figures, places and light', async () => {
  const { templatesDoc } = await import('../src/docs.mjs');
  for (const args of [['reel', null, null, 'katha'], ['story'], []]) {
    const doc = templatesDoc(...args);
    for (const k of ['madhubani', 'devotional', 'hanuman', 'ashram']) assert.ok(doc.includes(k), `${args.join(',')}: ${k}`);
  }
  assert.ok(templatesDoc('reel', null, null, 'katha').includes('Recipe for "katha"'));
});
