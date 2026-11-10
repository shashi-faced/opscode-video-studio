// Plan 14 Phase 0: can Gemini image (Nano Banana 2.1) draw our stickman styles well enough?
// Draws, per style, one character reference sheet, then 2 scenes at 16:9 and 9:16 using that sheet as a
// reference, plus one cut-out prop test. Measures time and size, estimates cost, saves a contact sheet.
//
//   node eval/art/spike-gemini.mjs [--dry] [--styles line-art,retro-tv,noir-thriller] [--size 1K]
//
// Key: GEMINI_API_KEY, or ~/.opscode/agents/video-studio/secrets.json { "gemini": { "apiKey": "…" } }.
// The key is never printed or written anywhere else. --dry prints the plan and cost without calling the API.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { HOME_DIR, findFfmpeg } from '../../src/deps/locate.mjs';

const args = process.argv.slice(2);
const flag = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const MODEL = flag('model', 'gemini-nano-banana-2.1');
const SIZE = flag('size', '1K');
const PRICE = { '1K': 0.0336, '2K': 0.0504, '4K': 0.113 };   // USD per output image, Gemini pricing page 2026-11-10
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const API_REVISION = '2026-05-20';

// ---------- style locks (our own wording; see plan 14 §3.4) ----------
const NO_TEXT = 'Absolutely no text, letters, numbers, captions, signs, logos or watermarks anywhere in the image.';
const STYLES = {
  'line-art': {
    look: 'Minimal hand-drawn explainer illustration on near-white paper with an extremely faint square grid. Fine, slightly irregular black ink pen lines. A few flat warm accent colours (yellow, red, green) on props only. Lots of clean empty space. Flat 2D, no shading gradients, no 3D, no photo texture.',
    character: 'a slender stick figure: modest round hollow head, single black ink lines for torso, arms and legs, about 4.5 heads tall, small oval hands and feet, expressive face with black oval eyes, clear eyebrows and a changing mouth',
    scenes: [
      'Visual metaphor for anxiety: the stick figure sits hunched inside a large birdcage whose bars are made of notification bells; worried face, sweat drops.',
      'The stick figure stares in shock at a smartphone showing a nearly empty red battery icon, one hand on head, open-mouthed panic.',
    ],
    prop: 'a hand-drawn birdcage with a small red bell on top',
  },
  'retro-tv': {
    look: 'Retro late-night television look: very dark charcoal background, soft white and light-grey rounded cartoon figures with a faint glow, subtle CRT scanlines and slight vignette, minimal flat shapes, calm and slightly mysterious.',
    character: 'a simple rounded white figure with a round white head, smooth white body and limbs, tiny dark dot eyes, no clothes, soft glow',
    scenes: [
      'A dark living room at 3 AM: an old television switches on by itself, casting cold light; the white figure peeks nervously from a doorway on the left.',
      'A small white dog with grey ears cowers beside a sofa; the white figure kneels gently nearby offering a hand.',
    ],
    prop: 'an old boxy television set',
  },
  'noir-thriller': {
    look: 'Painted cinematic 2D cartoon illustration at night: deep blue and black shadows, warm amber lamp light, detailed environment, moody suspense, clean outlines, high contrast.',
    character: 'a stick figure with a large round white head with a simple face, thin black stick arms and legs, white cartoon gloves on the hands',
    scenes: [
      'A lonely 911 dispatcher at a cluttered desk with old monitors and a desk lamp at night; the figure holds a red telephone receiver, tense.',
      'Seen from inside a dark house: the figure stands outside the window on a wet suburban path at night, wearing a yellow raincoat, face hidden in shadow.',
    ],
    prop: 'a red corded telephone',
  },
};

const sheetPrompt = (s) => `${s.look}\nCharacter reference sheet of ${s.character}: the same character shown four times in a row on a plain background — front view, three-quarter view, side view, and a surprised expression. Consistent proportions and line weight. ${NO_TEXT}`;
const scenePrompt = (s, scene, ratio) => `${s.look}\nThe main character is ${s.character}, exactly as in the reference image (same proportions, head, line weight and details).\nScene: ${scene}\nComposition: ${ratio === '16:9' ? 'keep the left third of the frame calm and uncluttered for overlay text' : 'vertical frame; keep the top fifth and the bottom fifth calm and uncluttered for overlay text'}. ${NO_TEXT}`;
const propPrompt = (s) => `${s.look}\nA single isolated object: ${s.prop}. Centered, fully visible, on a perfectly plain flat pure white background with no shadow, no floor, no other objects. ${NO_TEXT}`;

function readKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY.trim();
  const f = path.join(HOME_DIR, 'secrets.json');
  try {
    const st = fs.statSync(f);
    if (process.platform !== 'win32' && (st.mode & 0o077)) console.error(`warning: ${f} is readable by other users; run: chmod 600 ${f}`);
    return String(JSON.parse(fs.readFileSync(f, 'utf8')).gemini?.apiKey || '').trim() || null;
  } catch { return null; }
}

/** One image. Returns { file, seconds, bytes, text } or throws a cleaned error (never containing the key). */
async function draw(key, prompt, refs, ratio, file) {
  const input = [{ type: 'text', text: prompt }, ...refs.map(r => ({ type: 'image', mime_type: r.endsWith('.png') ? 'image/png' : 'image/jpeg', data: fs.readFileSync(r).toString('base64') }))];
  const body = { model: MODEL, input, response_format: { type: 'image', mime_type: 'image/png', aspect_ratio: ratio, image_size: SIZE } };
  const t0 = Date.now();
  const res = await fetch(ENDPOINT, { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json', 'Api-Revision': API_REVISION }, body: JSON.stringify(body), signal: AbortSignal.timeout(180000) });
  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${raw.replaceAll(key, '[key]').slice(0, 400)}`);
  const j = JSON.parse(raw);
  // Find image and text blocks anywhere in the response (steps[].content[] in the documented shape).
  const blocks = [];
  (function walk(o) { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) return o.forEach(walk); if (o.type === 'image' && o.data) blocks.push(o); if (o.type === 'text' && o.text) blocks.push(o); Object.values(o).forEach(walk); })(j);
  const img = blocks.filter(b => b.type === 'image').at(-1);
  if (!img) throw new Error(`no image in the response; keys: ${Object.keys(j).join(',')}; text: ${blocks.filter(b => b.type === 'text').map(b => b.text).join(' ').slice(0, 300)}`);
  const buf = Buffer.from(img.data, 'base64');
  fs.writeFileSync(file, buf);
  return { file, seconds: +((Date.now() - t0) / 1000).toFixed(1), bytes: buf.length, mime: img.mime_type, text: blocks.filter(b => b.type === 'text').map(b => b.text).join(' ').slice(0, 200), usage: j.usage || j.usage_metadata || null };
}

const styles = flag('styles', Object.keys(STYLES).join(',')).split(',').filter(s => STYLES[s]);
const jobs = styles.flatMap(st => [
  { st, kind: 'sheet', ratio: '16:9' },
  ...STYLES[st].scenes.flatMap((sc, i) => ['16:9', '9:16'].map(ratio => ({ st, kind: `scene${i + 1}`, ratio, scene: sc }))),
  { st, kind: 'prop', ratio: '1:1' },
]);
const cost = jobs.length * PRICE[SIZE];
console.log(`${MODEL}, ${SIZE}: ${jobs.length} images for ${styles.length} styles, about $${cost.toFixed(2)} (input tokens extra, small).`);
if (DRY) { for (const j of jobs) console.log(`  ${j.st} ${j.kind} ${j.ratio}`); process.exit(0); }

const key = readKey();
if (!key) { console.error('No Gemini key: set GEMINI_API_KEY or create ~/.opscode/agents/video-studio/secrets.json (see plan 14).'); process.exit(2); }

const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'runs', new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(out, { recursive: true });
const report = { model: MODEL, size: SIZE, priceUsdPerImage: PRICE[SIZE], started: new Date().toISOString(), results: [] };
for (const st of styles) {
  const sheet = path.join(out, `${st}-sheet.png`);
  for (const j of jobs.filter(x => x.st === st)) {
    const file = path.join(out, `${st}-${j.kind}-${j.ratio.replace(':', 'x')}.png`);
    const prompt = j.kind === 'sheet' ? sheetPrompt(STYLES[st]) : j.kind === 'prop' ? propPrompt(STYLES[st]) : scenePrompt(STYLES[st], j.scene, j.ratio);
    const refs = j.kind.startsWith('scene') && fs.existsSync(sheet) ? [sheet] : [];
    try {
      const r = await draw(key, prompt, refs, j.ratio, j.kind === 'sheet' ? sheet : file);
      report.results.push({ ...j, ok: true, ...r, refs: refs.length });
      console.log(`✓ ${st} ${j.kind} ${j.ratio}: ${r.seconds} s, ${Math.round(r.bytes / 1024)} KB${r.text ? ` — "${r.text.slice(0, 60)}"` : ''}`);
    } catch (e) {
      report.results.push({ ...j, ok: false, error: e.message });
      console.log(`✗ ${st} ${j.kind} ${j.ratio}: ${e.message}`);
      if (/HTTP 4(01|03)/.test(e.message)) break;
    }
  }
}
const okN = report.results.filter(r => r.ok).length;
report.estimatedUsd = +(okN * PRICE[SIZE]).toFixed(3);
report.avgSeconds = +(report.results.filter(r => r.ok).reduce((a, r) => a + r.seconds, 0) / Math.max(1, okN)).toFixed(1);
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
// Contact sheet per style: sheet, 4 scenes, prop (scaled to 320 px high).
try {
  for (const st of styles) {
    const files = fs.readdirSync(out).filter(f => f.startsWith(st) && f.endsWith('.png')).sort().map(f => path.join(out, f));
    if (!files.length) continue;
    execFileSync(findFfmpeg(), ['-y', '-v', 'error', ...files.flatMap(f => ['-i', f]), '-filter_complex', `${files.map((_, i) => `[${i}]scale=-2:320[v${i}]`).join(';')};${files.map((_, i) => `[v${i}]`).join('')}hstack=inputs=${files.length}`, path.join(out, `${st}-contact.jpg`)]);
  }
} catch (e) { console.log(`contact sheet failed: ${e.message.slice(0, 200)}`); }
console.log(`\n${okN}/${report.results.length} images, about $${report.estimatedUsd}, average ${report.avgSeconds} s each.\nFolder: ${out}`);
