// Layout QA: run the in-page inspector and build a contact sheet.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { openBuild, gpuWorks } from '../render/browser.mjs';
import { findFfmpeg } from '../deps/locate.mjs';
import { PLATFORMS } from '../schema/platforms.mjs';

const FIELD_FOR = { headline: 'headline', subline: 'subline or body', kicker: 'kicker', quote: 'quote', chips: 'chips', tags: 'tags or highlight labels', items: 'items', stats: 'items', badges: 'badges', button: 'button' };

function fixHint(issue, scene) {
  const field = FIELD_FOR[issue.element] || issue.element;
  switch (issue.check) {
    case 'text-too-long': {
      const target = Math.max(8, Math.round((issue.chars || 40) * 0.65));
      return `shorten scenes[${issue.scene}].${field} to about ${target} characters`;
    }
    case 'crowded': return `remove something from scenes[${issue.scene}]: fewer chips/items, a shorter subline, or split it into two scenes`;
    case 'off-stage': return issue.element === 'bubble'
      ? `shorten that line in scenes[${issue.scene}].lines (one short sentence) or use size "small" for the speaker`
      : `scenes[${issue.scene}].${field} is too big; shorten it or use fewer items`;
    case 'overlap':
      if (/chips|tags/.test(issue.element)) return `use at most 3 short chips/tags in scenes[${issue.scene}]`;
      return `shorten the text in scenes[${issue.scene}] or switch to template "split"`;
    case 'caption-long': return `split the narration of scenes[${issue.scene}] into shorter sentences`;
    case 'caption-overlap': return `fine for most videos; if it hides something important, shorten scenes[${issue.scene}] content`;
    case 'covers-character': return `shorten scenes[${issue.scene}].${issue.element === 'story text' ? 'text' : 'headline'}, use size "small" for the characters, or move the text to another scene`;
    case 'in-unsafe-zone': return issue.side === 'bottom' || issue.side === 'top'
      ? `shorten scenes[${issue.scene}].${field} so it fits in the middle of the frame`
      : `shorten scenes[${issue.scene}].${field}; long lines run under the like/comment buttons`;
    case 'missing-image': return `check the image path in scenes[${issue.scene}]`;
    case 'speaker-off-screen': return `in scenes[${issue.scene}] set that line's "shot" to "two-shot" or "medium", or the scene "camera" to "wide"`;
    case 'same-shot-size': return `in scenes[${issue.scene}] give one of those lines a different "shot" (close, over-shoulder, two-shot)`;
    case 'tiny-image': return `crop the screenshot in scenes[${issue.scene}] to the important panel so it shows larger`;
    default: return '';
  }
}

export async function runCheck({ build, storyboard, outDir }) {
  const sess = await openBuild(build.file, build.stage, { gpu: build.has3d ? await gpuWorks() : false });
  try {
    const raw = await sess.inspect();
    const issues = raw.map(i => ({ ...i, severity: i.severity || 'warning', fix: fixHint(i, storyboard.scenes[i.scene]) }));
    // Contact sheet: one settled frame per scene.
    const tl = await sess.page.evaluate(() => window.__video.timeline);
    const tmp = path.join(outDir, 'build', 'sheet');
    fs.rmSync(tmp, { recursive: true, force: true });
    fs.mkdirSync(tmp, { recursive: true });
    for (const [k, sc] of tl.scenes.entries()) {
      const t = Math.min(sc.start + sc.duration * 0.92, sc.start + 3.6) * 1000;
      await sess.seek(t);
      fs.writeFileSync(path.join(tmp, `s${String(k).padStart(2, '0')}.jpg`), await sess.frame('jpeg', 85));
    }
    const plat = PLATFORMS[storyboard.platform];
    if (plat?.maxSec && tl.duration > plat.maxSec) issues.push({ scene: null, check: 'too-long-for-platform', element: 'video', severity: 'error', message: `${Math.round(tl.duration)} s; ${plat.label} allows at most ${plat.maxSec} s`, fix: 'cut scenes or shorten narration' });
    else if (plat?.warnSec && tl.duration > plat.warnSec) issues.push({ scene: null, check: 'too-long-for-platform', element: 'video', severity: 'warning', message: `${Math.round(tl.duration)} s; ${plat.label} works best under ${plat.warnSec} s`, fix: 'shorter is better here: trim the weakest scenes' });
    const sheet = path.join(outDir, 'contact-sheet.jpg');
    const n = tl.scenes.length;
    const vertical = build.stage.height > build.stage.width;
    const cols = vertical ? Math.min(n, 6) : Math.min(n, 3);
    const rows = Math.ceil(n / cols);
    const tileW = vertical ? 300 : 560;
    execFileSync(findFfmpeg(), ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(tmp, 's%02d.jpg'),
      '-vf', `scale=${tileW}:-2,tile=${cols}x${rows}:padding=10:margin=10:color=0x222222`,
      '-frames:v', '1', sheet], { stdio: ['ignore', 'ignore', 'pipe'] });
    return {
      ok: !issues.some(i => i.severity === 'error'),
      errors: issues.filter(i => i.severity === 'error').length,
      warnings: issues.filter(i => i.severity !== 'error').length,
      issues,
      contactSheet: sheet,
      duration: tl.duration,
    };
  } finally {
    await sess.close();
  }
}
