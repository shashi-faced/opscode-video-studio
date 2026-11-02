// Orchestrates: validate -> voice -> timeline -> compile -> (check | render).
import fs from 'node:fs';
import path from 'node:path';
import { validateFile } from './schema/validate.mjs';
import { buildTimeline } from './timeline.mjs';
import { compile } from './compiler/compile.mjs';
import { UserError } from './render/browser.mjs';

export const slug = (s) => String(s || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'video';

export function outDirFor(storyboardFile, storyboard) {
  return path.join(path.dirname(path.resolve(storyboardFile)), 'out', slug(storyboard.title));
}

/**
 * @param opts.voice  'auto' | 'skip'  — skip uses estimated timings (fast, offline)
 * @param opts.onProgress fn(obj)
 */
export async function prepare(storyboardFile, { voice = 'auto', onProgress = () => {}, synthesize } = {}) {
  const v = validateFile(storyboardFile);
  if (!v.ok) {
    const e = new UserError(`The storyboard has ${v.errors.length} error(s).`, 'fix each item in "errors" and validate again');
    e.details = { errors: v.errors, warnings: v.warnings };
    throw e;
  }
  const storyboard = v.storyboard;
  const baseDir = path.dirname(path.resolve(storyboardFile));
  const outDir = outDirFor(storyboardFile, storyboard);
  const buildDir = path.join(outDir, 'build');
  fs.mkdirSync(buildDir, { recursive: true });

  let voices = storyboard.scenes.map(() => null);
  let voiceNote = null;
  if (voice !== 'skip' && storyboard.voice?.provider !== 'none' && synthesize) {
    try {
      voices = await synthesize(storyboard, { onProgress });
    } catch (e) {
      voiceNote = `voice skipped: ${e.message}`;
      onProgress({ stage: 'voice', warning: voiceNote });
      voices = storyboard.scenes.map(() => null);
    }
  }
  const timeline = buildTimeline(storyboard, voices.map(x => x?.seconds ?? null));
  fs.writeFileSync(path.join(buildDir, 'timeline.json'), JSON.stringify(timeline, null, 2));
  const build = compile(storyboard, timeline, { baseDir, buildDir });
  return { storyboard, warnings: v.warnings, baseDir, outDir, buildDir, timeline, build, voices, voiceNote };
}
