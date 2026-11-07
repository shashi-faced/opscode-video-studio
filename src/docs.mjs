// Human/LLM-readable docs generated from the spec, so docs never drift from the validator.
// templatesDoc(type) returns only what that kind of video needs, which keeps it short for small models.
import { DESIGN } from './schema/spec.mjs';
import { PRESETS } from './characters/presets.mjs';
import { TEMPLATES, COMMON_FIELDS, TOP_FIELDS, THEMES, MUSIC_STYLES, VOICES, MASCOTS, FORMATS, VIDEO_TYPES, CHARACTER_KINDS, POSES, CHARACTER_MOODS, POSITIONS, ENTRANCES, BACKGROUNDS, TIMES } from './schema/spec.mjs';
import { TYPE_RECIPES, TYPE_ALIASES } from './schema/types.mjs';
import { PLATFORMS, resolvePlatform } from './schema/platforms.mjs';

function fieldLine(name, f) {
  let t = f.type;
  if (f.type === 'str') t = `text ≤${f.max}`;
  if (f.type === 'num') t = `number ${f.min}–${f.max}`;
  if (f.type === 'enum') t = name === 'platform' ? 'see Platforms above' : f.values.length > 8 ? 'one of the list below' : f.values.join(' | ');
  if (f.type === 'list') t = `list (max ${f.max})${f.of?.type === 'str' ? ' of short text' : f.of?.type === 'obj' ? ' of {' + Object.keys(f.of.fields).join(', ') + '}' : ''}`;
  if (f.type === 'obj') t = `{ ${Object.keys(f.fields).join(', ')} }`;
  if (f.type === 'path') t = 'image file path';
  return `  - ${name}${f.required ? ' (required)' : ''}: ${t}${f.doc ? ` — ${f.doc}` : ''}`;
}

export const EXAMPLE = {
  version: 1,
  type: 'ad',
  title: 'My product reel',
  platform: 'insta-reel',
  theme: 'night-saffron',
  brand: { name: 'My Product', logo: 'shots/logo.png' },
  voice: { provider: 'edge', voice: 'en-IN-NeerjaExpressiveNeural', rate: '+4%' },
  music: { style: 'indian-electronic', volume: 0.5 },
  captions: true,
  scenes: [
    TEMPLATES.title.example,
    TEMPLATES.feature.example,
    TEMPLATES.bullets.example,
    TEMPLATES.cta.example,
  ],
};

export const STORY_EXAMPLE = {
  version: 1,
  type: 'story',
  title: 'Miko and the Fallen Star',
  format: '16:9',
  voice: { provider: 'edge', voice: 'en-IN-NeerjaExpressiveNeural' },
  cast: [
    { id: 'miko', kind: 'rabbit', name: 'Miko' },
    { id: 'tara', kind: 'star', name: 'Tara' },
    { id: 'owl', kind: 'owl', name: 'Grandpa Owl' },
  ],
  scenes: [
    { template: 'story', background: 'meadow', time: 'night', kicker: 'A bedtime story', headline: 'Miko and the *Fallen Star*', characters: [{ who: 'miko', pose: 'wave', enter: 'pop' }], narration: 'This is the story of Miko, a kind little rabbit.' },
    TEMPLATES.story.example,
    TEMPLATES.dialogue.example,
    { template: 'story', background: 'forest', time: 'night', characters: [{ who: 'miko', pose: 'walk', enter: 'walk-in' }, { who: 'tara' }, { who: 'owl', mood: 'sleepy' }], narration: 'Together they went to wise Grandpa Owl.' },
    { template: 'dialogue', lines: [{ who: 'miko', text: 'Grandpa, how can Tara go home?', mood: 'worried' }, { who: 'owl', text: 'Climb the rainbow mountain. The sky is closest there.' }] },
    { template: 'story', background: 'mountains', time: 'sunset', characters: [{ who: 'miko', pose: 'cheer' }, { who: 'tara', pose: 'jump', mood: 'happy' }], narration: 'At the top, Tara began to shine and float up into the sky.' },
    { template: 'story', background: 'meadow', time: 'night', headline: 'The End', text: 'A true friend helps you in hard times.', characters: [{ who: 'miko', pose: 'wave' }], narration: 'A true friend is the one who helps you in hard times.' },
  ],
};

// A short 3D story: a designed character, auto camera, weather, a prop and lip-synced dialogue.
export const STORY_EXAMPLE_3D = {
  version: 1,
  type: 'story',
  look: '3d',
  title: 'The Peacock King',
  platform: 'youtube',
  voice: { provider: 'edge', voice: 'en-IN-NeerjaExpressiveNeural' },
  cast: [
    { id: 'raja', name: 'Raja', design: { plan: 'bird', snout: 'beak', extras: ['tail-fan', 'crest'], accessories: ['crown'], colors: { main: '#1f6fb2', accent: '#2fa86b' } } },
    { id: 'chintu', kind: 'boy', name: 'Chintu' },
    { id: 'owl', kind: 'owl', name: 'Grandpa Owl' },
  ],
  scenes: [
    { template: 'story', background: 'forest', time: 'day', headline: 'The *Peacock King*', characters: [{ who: 'raja', pose: 'wave' }], narration: 'Deep in the forest lived Raja, the proud peacock king.' },
    { template: 'dialogue', background: 'forest', time: 'day', characters: [{ who: 'raja' }, { who: 'chintu', near: 'tree' }], lines: [{ who: 'chintu', text: 'Your feathers are so beautiful, King Raja!', mood: 'happy' }, { who: 'raja', text: 'Thank you, Chintu. But can you dance in the rain?', mood: 'surprised' }] },
    { template: 'story', background: 'forest', time: 'sunset', weather: 'rain', characters: [{ who: 'raja', pose: 'jump', mood: 'happy' }, { who: 'chintu', pose: 'cheer' }], narration: 'The rain came, and Raja danced with all his friends.' },
    { template: 'dialogue', background: 'village', time: 'night', weather: 'fireflies', characters: [{ who: 'owl', near: 'campfire' }, { who: 'chintu', pose: 'sit' }], lines: [{ who: 'owl', text: 'A true king shares his joy with everyone.' }] },
    { template: 'story', background: 'meadow', time: 'night', headline: 'The End', text: 'Joy grows when you share it.', characters: [{ who: 'raja', pose: 'wave' }, { who: 'chintu', pose: 'wave' }], narration: 'Joy grows when you share it.' },
  ],
};

const STORY_TYPES = new Set(['story', 'greeting']);

/** Video type from a type name or alias ("kids story", "tutorial"), or null. */
export function resolveType(type) {
  if (!type) return null;
  const k = String(type).trim().toLowerCase().replace(/[\s_]+/g, '-');
  return VIDEO_TYPES.includes(k) ? k : TYPE_ALIASES[k] || null;
}

/**
 * Storyboard reference. With a video type, only that type's recipe, templates and example.
 * @param type optional video type (or alias)
 */
export function templatesDoc(type, platform, look) {
  const is3d = /^(3d|3-d|three[ -]?d|cgi|pixar)/i.test(String(look || '').trim());
  const t = resolveType(type);
  const pl = resolvePlatform(platform);
  const recipe = t ? TYPE_RECIPES[t] : null;
  const names = recipe ? recipe.templates : Object.keys(TEMPLATES);
  const usesCharacters = names.some(n => n === 'story' || n === 'dialogue');
  const out = [];
  out.push('# Video Studio storyboard reference');
  out.push('Write ONE JSON file. The engine designs, animates, voices and renders it. Text with *stars* is highlighted.');

  out.push('\n## Video types (set "type"; it picks the scene recipe, theme and music)');
  for (const [k, r] of Object.entries(TYPE_RECIPES)) out.push(`- ${k}: ${r.label}. ${r.use} ${r.scenes}.`);
  if (recipe) {
    out.push(`\n## Recipe for "${t}"`);
    out.push(`- Templates to use: ${recipe.templates.join(', ')}`);
    out.push(`- First scene: ${recipe.first.join(' or ')}. Last scene: ${recipe.last.join(' or ')}.`);
    out.push(`- Defaults: theme ${recipe.theme}, music ${recipe.music}${recipe.format ? `, format ${recipe.format}` : ''}.`);
    for (const tip of recipe.tips) out.push(`- ${tip}`);
  } else {
    out.push('Tip: call video_templates with type=<one of the above> for a shorter, focused reference.');
  }

  out.push('\n## Platforms (set "platform"; it sets the frame size, safe zones, captions and extra files)');
  if (pl) {
    const P = PLATFORMS[pl];
    out.push(`- Use "platform": "${pl}" (${P.label}). Do not set "format".${P.maxSec ? ` At most ${P.maxSec} s.` : ''}${P.warnSec ? ` Best under ${P.warnSec} s.` : ''}`);
    out.push(`- Captions default to "${P.captions.style}". The engine keeps text out of the areas the app covers.`);
  } else {
    for (const [k, P] of Object.entries(PLATFORMS)) out.push(`- ${k}: ${P.label}${P.maxSec ? `, max ${P.maxSec} s` : ''}`);
    out.push('- Pick from the user\'s words: Instagram/reel = insta-reel, YouTube = youtube, Shorts = youtube-short, WhatsApp = whatsapp-status. Then do not set "format".');
  }
  out.push('- captions: true | false | { "style": "line" | "karaoke" | "pop", "position": "bottom" | "middle" | "top" }. pop = 1-3 big words at a time, timed to the voice (reels); karaoke = the spoken word lights up.');

  if (usesCharacters) {
    if (!is3d) {
      out.push('\n## 3D look (optional)');
      out.push('- Only when the user asks for 3D, Pixar style or CGI, or [Video settings] says Look: 3D: set "look": "3d" and call video_templates again with look "3d" for the 3D guide. Default is the 2D illustrated look.');
    } else {
      out.push('\n## 3D look');
      out.push('- Set "look": "3d" at the top to draw story and dialogue scenes as a 3D cartoon (3D characters in a 3D world, moving camera). Everything else stays the same: cast, poses, moods, backgrounds, times, lines.');
      out.push('- The camera directs itself (leave "camera" out): an establishing shot when the place changes, a two-shot to open a conversation, then over-the-shoulder and close-ups on whoever speaks, and reaction shots of the listener on strong feelings.');
      out.push('- Only if the user asks for a specific shot: scene "camera" = extreme-wide, wide, full, medium, medium-close, close, extreme-close, two-shot, over-shoulder, dolly-in, dolly-out, orbit, pan-left, pan-right, crane-up, crane-down, follow; or a line\'s "shot" = close, medium-close, over-shoulder, two-shot, medium, wide, reaction.');
      out.push('- "cinematic": true (16:9) gives a film look: letterbox bars, subtitles in the bottom bar, a gentle hand-held camera.');
      out.push('- 3D scene "weather": rain, snow, leaves, fireflies or sparkles. A character can stand "near" a prop: sofa, bed, desk, table, tent, campfire, tree, house, bench, bookcase, tv, fridge, stove, signpost, barrel, chest, plant-pot, rock, ship, fence, cake, lamp-floor.');
      out.push('- Extra poses in 3D and 2D: sit, talk.');
      out.push(`- Ready-made 3D characters: "design": "preset:<id>" with ${Object.keys(PRESETS).join(', ')} (kind, name and voice are filled in).`);
      out.push('- Any character in 3D: when none of the kinds fits (peacock king, crocodile, dragon, alien, snowman…), give the cast member a "design" built from these parts (pick only what you need, everything else has a default):');
      for (const [k, v] of Object.entries(DESIGN)) out.push(`  - ${k}: ${v.join(', ')}${k === 'extras' || k === 'accessories' ? ' (a list)' : ''}`);
      out.push('  - colours: design "colors" { main, belly, accent (spots, stripes, fan, cap), outfit, hair }. See raja in the example.');
      out.push('  - Check a new design with video_character action "sheet" (8 views in one picture), then "save" it to the library; any later storyboard can use it with "design": "library:<id>". video_character action "list" shows saved characters.');
    }
  }
  out.push('\n## Top-level fields');
  for (const [k, f] of Object.entries(TOP_FIELDS)) {
    if (k === 'cast' && !usesCharacters) continue;
    out.push(fieldLine(k, f));
  }
  out.push(`\nformats: ${FORMATS.join(', ')} · themes: ${THEMES.join(', ')} · music: ${MUSIC_STYLES.join(', ')} · mascots: ${MASCOTS.join(', ')}`);
  out.push(`voices: ${VOICES.map(v => `${v.id} (${v.note})`).join('; ')}`);

  if (usesCharacters) {
    out.push('\n## Characters (cast and story scenes)');
    out.push(`- kinds: ${CHARACTER_KINDS.join(', ')}`);
    out.push(`- poses: ${POSES.join(', ')} · moods: ${CHARACTER_MOODS.join(', ')}`);
    out.push(`- positions: ${POSITIONS.join(', ')} · enter: ${ENTRANCES.join(', ')} · size: small, medium, large`);
    out.push(`- backgrounds: ${BACKGROUNDS.join(', ')} · time: ${TIMES.join(', ')}`);
    out.push('- Each character speaks its lines in its own voice (child, adult, elder or big animal), picked from the narrator language.');
    out.push('- At most 4 characters per scene and 6 lines per dialogue scene; one short sentence per line.');
  }

  out.push('\n## Fields every scene can have');
  for (const [k, f] of Object.entries(COMMON_FIELDS)) {
    if (k === 'template') { out.push(`  - template (required): ${names.join(' | ')}`); continue; }
    if ((k === 'mascot' || k === 'mascotMood') && t && STORY_TYPES.has(t)) continue;
    out.push(fieldLine(k, f));
  }
  out.push('\n## Templates');
  for (const name of names) {
    const tp = TEMPLATES[name];
    out.push(`\n### "${name}" — ${tp.use}`);
    for (const [k, f] of Object.entries(tp.fields)) out.push(fieldLine(k, f));
    out.push(`  example: ${JSON.stringify(tp.example)}`);
  }
  out.push('\n## Rules that give good videos');
  out.push('- headline ≤ 6 words. narration: 1–2 short spoken sentences (≤ 25 words) per scene.');
  out.push('- Do not set "duration"; it is computed from the voice.');
  out.push('- Never draw pictures with code. Use characters, backgrounds, screenshots (video_capture) or the user\'s own images.');
  if (!t || !STORY_TYPES.has(t)) out.push('- Use "feature" for screenshots; crop screenshots to the important panel.');
  out.push('\n## Complete example storyboard');
  out.push(JSON.stringify(t === 'story' || t === 'greeting' ? (is3d ? STORY_EXAMPLE_3D : STORY_EXAMPLE) : EXAMPLE));
  return out.join('\n');
}
