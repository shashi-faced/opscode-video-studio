#!/usr/bin/env node
// Phase 8 eval (plan 12): does a model write valid, good-looking 3D storyboards from one sentence?
// The model call happens outside this script (any chat endpoint, MCP tool or the Opscode app), so no keys live here.
//   node eval/3d/run.mjs ask <id>                       → runs/<model>/<id>/ask.json: { system, user } as the app sends them
//   node eval/3d/run.mjs score <model> <id> <reply.txt> [--round N] [--render]
//                                                       → validates; on errors prints the feedback for the next round;
//                                                         when valid: preview issues, critic score, and with --render
//                                                         the render speed, GPU, lip-sync and frame determinism
//   node eval/3d/run.mjs report <model>                 → markdown table for plan 09
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { runTool } from '../../src/tools.mjs';
import { templatesDoc } from '../../src/docs.mjs';
import { outDirFor } from '../../src/pipeline.mjs';
import { validateFile } from '../../src/schema/validate.mjs';
import { openBuild, gpuWorks } from '../../src/render/browser.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const { prompts } = JSON.parse(fs.readFileSync(path.join(HERE, 'prompts.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'agent/manifest.json'), 'utf8'));
const [cmd, ...rest] = process.argv.slice(2);
const flags = Object.fromEntries(rest.filter(a => a.startsWith('--')).map(a => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const pos = rest.filter(a => !a.startsWith('--'));
const find = (id) => prompts.find(p => p.id === id) || (() => { throw new Error(`no prompt "${id}"`); })();
const runDir = (model, id) => path.join(HERE, 'runs', model.replace(/[^a-z0-9._-]+/gi, '-'), id);

/** What the app sends: the agent's system prompt, the video_templates result it would fetch, and the user's message. */
function ask(p) {
  const doc = templatesDoc(p.type, null, '3d');
  const system = `${manifest.systemPrompt}\n\nYou already called video_templates({ type: "${p.type}", look: "3d" }). Its result:\n\n${doc}\n\nYou cannot call tools in this conversation: reply with ONLY the JSON content of the file you would write (${p.film ? 'video/<name>/film.json' : 'video/<name>/storyboard.json'}), nothing else.`;
  const user = `${p.settings ? `[Video settings]\n${p.settings}\n(Chosen by the user before writing; follow these and do not ask about them again.)\n\n` : ''}${p.text}`;
  return { system, user };
}

function extractJson(text) {
  const t = text.replace(/^[\s\S]*?```(?:json)?\s*\n/, '').replace(/\n```[\s\S]*$/, '');
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  return JSON.parse(t.slice(a, b + 1));
}

/** Share of each spoken line where the mouth is open (not the rest shape X): about 0.5-0.85 looks like talking. */
function lipSync(timelineFile) {
  const tl = JSON.parse(fs.readFileSync(timelineFile, 'utf8'));
  const lines = tl.scenes.flatMap(s => s.parts.filter(p => p.kind === 'line' && p.visemes?.length));
  if (!lines.length) return null;
  const open = lines.map(p => {
    let o = 0;
    p.visemes.forEach(([t, x], k) => { const e = Math.min(p.end, p.visemes[k + 1]?.[0] ?? p.end); if (x !== 'X' && e > t) o += e - Math.max(t, p.start); });
    return o / Math.max(0.01, p.end - p.start);
  });
  return { lines: lines.length, open: +(open.reduce((a, b) => a + b, 0) / open.length).toFixed(2) };
}

/** Same frames drawn in two different orders must be identical. */
/** Same frames drawn in two different orders must match (up to 3/255 per channel: text-layer anti-aliasing). */
export async function deterministic(buildDir, format) {
  const { execFileSync } = await import('node:child_process');
  const { findFfmpeg } = await import('../../src/deps/locate.mjs');
  const ff = findFfmpeg();
  const html = fs.readdirSync(buildDir).find(f => f.endsWith('.html'));
  const tl = JSON.parse(fs.readFileSync(path.join(buildDir, 'timeline.json'), 'utf8'));
  const times = [0.37, 0.61, 0.83].map(f => Math.round(tl.duration * f * 1000));
  const stage = { '16:9': { width: 1920, height: 1080 }, '9:16': { width: 1080, height: 1920 }, '1:1': { width: 1080, height: 1080 }, '4:5': { width: 1080, height: 1350 } }[format] || { width: 1920, height: 1080 };
  const sess = await openBuild(path.join(buildDir, html), stage, { gpu: await gpuWorks() });
  const raw = (png) => execFileSync(ff, ['-loglevel', 'error', '-i', 'pipe:0', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { input: png, maxBuffer: 64 << 20 });
  const grab = async (ms) => { await sess.seek(ms); return raw(await sess.frame('png')); };
  try {
    await grab(0);   // warm-up
    const a = []; for (const t of times) a.push(await grab(t));
    const b = []; for (const t of [...times].reverse()) b.push(await grab(t));
    b.reverse();
    let worst = 0;
    a.forEach((x, k) => { const y = b[k]; for (let i = 0; i < x.length; i++) { const d = Math.abs(x[i] - y[i]); if (d > worst) worst = d; } });
    return worst <= 3;
  } finally { await sess.close(); }
}

async function score(model, id, replyFile) {
  const p = find(id);
  const dir = runDir(model, id);
  fs.mkdirSync(dir, { recursive: true });
  const round = Number(flags.round || 1);
  const resFile = path.join(dir, 'result.json');
  const res = fs.existsSync(resFile) && round > 1 ? JSON.parse(fs.readFileSync(resFile, 'utf8')) : { id, model, rounds: [] };
  let sb;
  try { sb = extractJson(fs.readFileSync(replyFile, 'utf8')); } catch (e) {
    res.rounds.push({ round, ok: false, errors: 1, note: `reply is not JSON: ${e.message}` });
    fs.writeFileSync(resFile, JSON.stringify(res, null, 2));
    return { ok: false, feedback: 'Your reply was not valid JSON. Reply with only the JSON file content.' };
  }
  const file = path.join(dir, sb.sequences ? 'film.json' : 'storyboard.json');
  fs.writeFileSync(file, JSON.stringify(sb, null, 2));
  const v = await runTool('video_validate', { storyboard: file });
  res.rounds.push({ round, ok: v.ok, errors: v.data?.errors?.length || 0, warnings: v.data?.warnings?.length || 0 });
  res.look3d = sb.look === '3d' || /3d/i.test(String(sb.look || ''));
  if (!v.ok) { fs.writeFileSync(resFile, JSON.stringify(res, null, 2)); return { ok: false, feedback: v.text }; }
  res.validRound = round;
  res.sceneCount = sb.sequences ? sb.sequences.reduce((n, s) => n + (s.shots?.length || 0), 0) : sb.scenes?.length;
  res.designed = (validateFile(file).storyboard?.cast || []).filter(c => c.design).length;
  if (!sb.sequences) {
    const pv = await runTool('video_preview', { storyboard: file });
    const issues = pv.data?.issues || [];
    const errs = issues.filter(i => i.severity === 'error').length, warns = issues.length - errs;
    res.preview = { errors: errs, warnings: warns, checks: [...new Set(issues.map(i => i.check))] };
    res.critic = Math.max(0, +(10 - errs * 2 - warns * 0.5).toFixed(1));
    if (flags.render) {
      const r = await runTool('video_render', { storyboard: file });
      if (r.ok) {
        const d = r.data;
        res.render = { seconds: d.seconds, duration: +d.duration.toFixed(1), fps: d.renderFps, gpu: d.gpu, workers: d.workers, file: d.file };
        const vsb = validateFile(file).storyboard;
        const buildDir = path.join(outDirFor(file, vsb), 'build');
        res.lipSync = lipSync(path.join(buildDir, 'timeline.json'));
        res.deterministic = await deterministic(buildDir, vsb.format);
      } else res.render = { error: r.text.slice(0, 300) };
    }
  }
  fs.writeFileSync(resFile, JSON.stringify(res, null, 2));
  return { ok: true, result: res };
}

function report(model) {
  const base = path.join(HERE, 'runs', model.replace(/[^a-z0-9._-]+/gi, '-'));
  const rows = prompts.map(p => { try { return JSON.parse(fs.readFileSync(path.join(base, p.id, 'result.json'), 'utf8')); } catch { return { id: p.id, rounds: [] }; } });
  const out = ['| Prompt | Valid in round | 3D | Scenes | Designed chars | Preview errors / warnings | Critic | Render (video / time, fps, GPU) | Lip-sync open | Deterministic |', '|---|---|---|---|---|---|---|---|---|---|'];
  for (const r of rows) {
    out.push(`| ${r.id} | ${r.validRound ?? `no (${r.rounds.length} rounds)`} | ${r.look3d ? 'yes' : 'no'} | ${r.sceneCount ?? '–'} | ${r.designed ?? '–'} | ${r.preview ? `${r.preview.errors} / ${r.preview.warnings}` : '–'} | ${r.critic ?? '–'} | ${r.render?.seconds != null ? `${r.render.duration} s / ${r.render.seconds} s, ${r.render.fps}, ${r.render.gpu ? 'GPU' : 'CPU'}` : r.render?.error ? 'failed' : '–'} | ${r.lipSync ? `${r.lipSync.open} (${r.lipSync.lines} lines)` : '–'} | ${r.deterministic == null ? '–' : r.deterministic ? 'yes' : 'NO'} |`);
  }
  const ok = rows.filter(r => r.validRound && r.validRound <= 2).length;
  out.push('', `Valid on the first or second round: ${ok}/${rows.length} (${Math.round((ok / rows.length) * 100)} %).`);
  return out.join('\n');
}

if (cmd === 'det') {
  const r = JSON.parse(fs.readFileSync(path.join(runDir(pos[0], pos[1]), 'result.json'), 'utf8'));
  r.deterministic = await deterministic(path.join(path.dirname(r.render.file), 'build'), validateFile(path.join(runDir(pos[0], pos[1]), 'storyboard.json')).storyboard.format);
  fs.writeFileSync(path.join(runDir(pos[0], pos[1]), 'result.json'), JSON.stringify(r, null, 2));
  console.log(pos[1], r.deterministic);
} else if (cmd === 'ask') {
  const p = find(pos[0]);
  const a = ask(p);
  const dir = runDir(flags.model || 'any', p.id); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'ask.json'), JSON.stringify(a, null, 2));
  console.log(JSON.stringify({ ok: true, file: path.join(dir, 'ask.json'), systemBytes: a.system.length, user: a.user }));
} else if (cmd === 'score') {
  const r = await score(pos[0], pos[1], pos[2]);
  console.log(JSON.stringify(r));
} else if (cmd === 'report') {
  console.log(report(pos[0]));
} else {
  console.error('usage: run.mjs ask <id> | score <model> <id> <reply.txt> [--round N] [--render] | report <model>');
  process.exit(2);
}
