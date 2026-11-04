// Human/LLM-readable docs generated from the spec, so docs never drift from the validator.
// templatesDoc(type) returns only what that kind of video needs, which keeps it short for small models.
import { TEMPLATES, COMMON_FIELDS, TOP_FIELDS, THEMES, MUSIC_STYLES, VOICES, MASCOTS, FORMATS, VIDEO_TYPES, CHARACTER_KINDS, POSES, CHARACTER_MOODS, POSITIONS, ENTRANCES, BACKGROUNDS, TIMES } from './schema/spec.mjs';
import { TYPE_RECIPES, TYPE_ALIASES } from './schema/types.mjs';

function fieldLine(name, f) {
  let t = f.type;
  if (f.type === 'str') t = `text ≤${f.max}`;
  if (f.type === 'num') t = `number ${f.min}–${f.max}`;
  if (f.type === 'enum') t = f.values.length > 8 ? 'one of the list below' : f.values.join(' | ');
  if (f.type === 'list') t = `list (max ${f.max})${f.of?.type === 'str' ? ' of short text' : f.of?.type === 'obj' ? ' of {' + Object.keys(f.of.fields).join(', ') + '}' : ''}`;
  if (f.type === 'obj') t = `{ ${Object.keys(f.fields).join(', ')} }`;
  if (f.type === 'path') t = 'image file path';
  return `  - ${name}${f.required ? ' (required)' : ''}: ${t}${f.doc ? ` — ${f.doc}` : ''}`;
}

export const EXAMPLE = {
  version: 1,
  type: 'ad',
  title: 'My product reel',
  format: '9:16',
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
export function templatesDoc(type) {
  const t = resolveType(type);
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
  out.push(JSON.stringify(t === 'story' || t === 'greeting' ? STORY_EXAMPLE : EXAMPLE, null, 2));
  return out.join('\n');
}
