// Live progress for the host app. With `--progress-file <path>` the CLI keeps one small JSON object
// in that file while a tool runs: the latest stage and how far it is. The Opscode app reads it every
// couple of seconds to answer "are you working?" with real progress ("drawing frames · 62%").
import fs from 'node:fs';

const MIN_GAP_MS = 400;

/** One progress event → the flat shape the app reads. */
export function progressRecord(p, base) {
  const done = Number.isFinite(p.done) ? p.done : Number.isFinite(p.frames) ? p.frames : undefined;
  const total = Number.isFinite(p.total) ? p.total : Number.isFinite(p.totalFrames) ? p.totalFrames : undefined;
  return {
    v: 1, ...base, at: Date.now(),
    stage: String(p.stage || ''),
    ...(p.step ? { step: String(p.step) } : {}),
    ...(done !== undefined ? { done } : {}),
    ...(total !== undefined ? { total } : {}),
    ...(done !== undefined && total > 0 ? { percent: Math.max(0, Math.min(100, Math.round((done / total) * 100))) } : {}),
    ...(Number.isFinite(p.scene) ? { scene: p.scene } : {}),
    ...(Number.isFinite(p.scenes) ? { scenes: p.scenes } : {}),
    ...(p.warning || p.note ? { note: String(p.warning || p.note).slice(0, 200) } : {}),
  };
}

/**
 * Returns fn(progressEvent) that keeps `file` up to date. Writes are spaced out (a render reports
 * every 30 frames), but a change of stage is always written at once. Never throws: progress must
 * not be able to fail a render.
 */
export function progressWriter(file, tool) {
  if (!file) return () => {};
  const base = { tool, pid: process.pid, startedAt: Date.now() };
  let lastWrite = 0, lastStage = '';
  return (p) => {
    try {
      if (!p || typeof p !== 'object') return;
      const now = Date.now();
      const stage = `${p.stage || ''}/${p.step || ''}`;
      const finished = Number.isFinite(p.done) && p.done === p.total;
      if (stage === lastStage && !finished && now - lastWrite < MIN_GAP_MS) return;
      lastStage = stage; lastWrite = now;
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(progressRecord(p, base)));
      fs.renameSync(tmp, file);
    } catch { /* progress is best effort */ }
  };
}
