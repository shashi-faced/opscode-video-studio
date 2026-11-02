// Human/LLM-readable docs generated from the spec, so docs never drift from the validator.
import { TEMPLATES, COMMON_FIELDS, TOP_FIELDS, THEMES, MUSIC_STYLES, VOICES, MASCOTS, FORMATS } from './schema/spec.mjs';

function fieldLine(name, f) {
  let t = f.type;
  if (f.type === 'str') t = `text ≤${f.max}`;
  if (f.type === 'num') t = `number ${f.min}–${f.max}`;
  if (f.type === 'enum') t = f.values.join(' | ');
  if (f.type === 'list') t = `list (max ${f.max})${f.of?.type === 'str' ? ' of short text' : f.of?.type === 'obj' ? ' of {' + Object.keys(f.of.fields).join(', ') + '}' : ''}`;
  if (f.type === 'obj') t = `{ ${Object.keys(f.fields).join(', ')} }`;
  if (f.type === 'path') t = 'image file path';
  return `  - ${name}${f.required ? ' (required)' : ''}: ${t}${f.doc ? ` — ${f.doc}` : ''}`;
}

export const EXAMPLE = {
  version: 1,
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

export function templatesDoc() {
  const out = [];
  out.push('# Video Studio storyboard reference');
  out.push('Write ONE JSON file. The engine designs, animates, voices and renders it. Text with *stars* is highlighted.');
  out.push('Image coordinates (highlights, cursor) are FRACTIONS of the image: x=0.5 means the middle.');
  out.push('\n## Top-level fields');
  for (const [k, f] of Object.entries(TOP_FIELDS)) out.push(fieldLine(k, f));
  out.push(`\nformats: ${FORMATS.join(', ')} · themes: ${THEMES.join(', ')} · music styles: ${MUSIC_STYLES.join(', ')} · mascots: ${MASCOTS.join(', ')}`);
  out.push(`voices: ${VOICES.map(v => `${v.id} (${v.note})`).join('; ')}`);
  out.push('\n## Fields every scene can have');
  for (const [k, f] of Object.entries(COMMON_FIELDS)) out.push(fieldLine(k, f));
  out.push('\n## Templates');
  for (const [name, t] of Object.entries(TEMPLATES)) {
    out.push(`\n### "${name}" — ${t.use}`);
    for (const [k, f] of Object.entries(t.fields)) out.push(fieldLine(k, f));
    out.push(`  example: ${JSON.stringify(t.example)}`);
  }
  out.push('\n## Rules that give good videos');
  out.push('- 5 to 8 scenes, 25–50 seconds total. First scene "title", last scene "cta".');
  out.push('- headline ≤ 6 words. narration: 1–2 short spoken sentences (≤ 25 words) per scene.');
  out.push('- Use "feature" for screenshots; crop screenshots to the important panel.');
  out.push('- Do not set "duration"; it is computed from the voice.');
  out.push('\n## Complete example storyboard');
  out.push(JSON.stringify(EXAMPLE, null, 2));
  return out.join('\n');
}
