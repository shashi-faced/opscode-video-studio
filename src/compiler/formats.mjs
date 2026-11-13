// Formats (plan 18 M2): scene templates for the short-form structures that do well on Shorts and Reels:
// countdown entries, rapid-fire facts, myth vs truth, quiz, would-you-rather, chat story. Plus kinetic
// typography (M3), which turns a scene's narration into big words timed to the voice.
// Reveals are timed from the scene's voice (ctx.tl), so the answer appears after the question is asked.
import { escapeHtml as esc, markup, captionTokens } from '../timeline.mjs';
import { iconSvg } from '../art/props.mjs';
import { groupWords } from '../captions/group.mjs';

const fit = (tag, cls, html, max, lines, lh = 1.06, d = 0) =>
  `<${tag} class="fit ${cls}" data-max="${max}" data-lines="${lines}" data-lh="${lh}" style="--d:${d}s">${html}</${tag}>`;
// Font sizes (in u) per format: [16:9, 9:16, 1:1]
const SZ = { kicker: [2.4, 3.1, 2.8], num: [26, 24, 22], head: [7.4, 8.4, 7.4], sub: [3.4, 4.2, 3.6], fact: [6.2, 6.6, 5.8], opt: [3.8, 4.4, 3.9], msg: [3, 3.9, 3.4], kin: [14, 13, 12] };
const sz = (k, ctx) => SZ[k][ctx.fi];
const r2 = (n) => Math.round(n * 100) / 100;

/** Seconds from the scene start to the end of its voice (or a sensible guess without one). */
function voiceEnd(ctx, fallback = 1.6) {
  const tl = ctx.tl;
  if (!tl?.parts?.length) return fallback;
  return Math.max(0.4, tl.parts.at(-1).end - tl.start);
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function icon(name, cls, d, ctx) {
  const svg = name ? iconSvg(name, { stroke: 'currentColor' }) : null;
  return svg ? `<div class="${cls} a-pop" style="--d:${d}s">${svg}</div>` : '';
}

// ───────────────────────── formats ─────────────────────────

/** One entry of a countdown ("#3 …"); several rank scenes make a Top-N video. */
function rank(sc, ctx) {
  return `<div class="in t-rank fmt">
<div class="rk-num a-slam" style="--d:.08s"><span>#</span>${esc(String(sc.number ?? ''))}</div>
<div class="rk-body">${icon(sc.icon, 'fmt-icon', 0.5, ctx)}${fit('h1', 'headline a-up', markup(sc.title || sc.headline || ''), sz('head', ctx), 2, 1.04, 0.35)}${sc.text ? fit('p', 'subline a-up', markup(sc.text), sz('sub', ctx), 3, 1.35, 0.75) : ''}</div></div>`;
}

/** One fact, big, with an optional number ("Fact #4") and icon. */
function fact(sc, ctx) {
  const label = sc.kicker || (sc.number != null ? `Fact #${sc.number}` : 'Did you know?');
  return `<div class="in t-fact fmt">
${fit('div', 'kicker a-up', esc(label), sz('kicker', ctx), 1, 1.2, 0.05)}
${icon(sc.icon, 'fmt-icon big', 0.3, ctx)}
${fit('p', 'fmt-text fact-text a-up', markup(sc.fact || ''), sz('fact', ctx), 5, 1.14, 0.45)}
${sc.source ? fit('div', 'fact-src a-up', esc(sc.source), sz('kicker', ctx), 1, 1.2, 1.1) : ''}</div>`;
}

/** When the truth shows: at the start of the narration's second sentence, else a little before half-way. */
function truthTime(ctx) {
  const w = ctx.tl?.words;
  if (w?.length > 2) {
    for (let k = 1; k < w.length; k++) {
      if (/[.!?।]\s*(<\/mark>)?$/.test(w[k - 1][0])) return clamp(w[k][1] - ctx.tl.start - 0.1, 1.4, ctx.dur - 1.2);
    }
  }
  return clamp(ctx.dur * 0.45, 1.4, ctx.dur - 1.2);
}

function myth(sc, ctx) {
  const t = r2(truthTime(ctx));
  return `<div class="in t-myth fmt" style="--rv:${t}s">
${sc.kicker ? fit('div', 'kicker a-up', esc(sc.kicker), sz('kicker', ctx), 1, 1.2, 0.05) : ''}
<div class="my-card my-myth" style="--d:.15s"><div class="my-tag"><b>✕</b> MYTH</div>${fit('p', 'fmt-text', markup(sc.myth || ''), sz('sub', ctx) * 1.25, 4, 1.25)}<i class="my-strike"></i></div>
<div class="my-card my-truth"><div class="my-tag"><b>✓</b> TRUTH</div>${fit('p', 'fmt-text', markup(sc.truth || ''), sz('sub', ctx) * 1.25, 5, 1.25)}</div></div>`;
}

function quiz(sc, ctx) {
  const opts = (sc.options || []).slice(0, 4);
  const answer = clamp(Math.round(+sc.answer || 1), 1, Math.max(1, opts.length));
  const count = clamp(Math.round(+sc.countdown || 3), 2, 10);
  // Reveal after the question is read and the countdown has run.
  const rv = r2(clamp(voiceEnd(ctx, 1.4) + count, 1.6 + count * 0.5, ctx.dur - 1.2));
  const t0 = r2(Math.max(0.6, rv - count));
  const letters = 'ABCD';
  const digits = Array.from({ length: count }, (_, k) => `<b style="--d:${r2(t0 + k)}s;--e:${r2(t0 + k + 1)}s">${count - k}</b>`).join('');
  const items = opts.map((o, j) => `<li class="qz-opt${j + 1 === answer ? ' qz-right' : ' qz-wrong'}" style="--d:${r2(0.55 + j * 0.22)}s"><span class="qz-l">${letters[j]}</span>${fit('span', 'fmt-text', markup(o), sz('opt', ctx), 2, 1.2)}</li>`).join('');
  return `<div class="in t-quiz fmt" style="--rv:${rv}s;--t0:${t0}s;--cd:${count}s">
<div class="qz-top">${fit('div', 'kicker a-up', esc(sc.kicker || 'Quiz time'), sz('kicker', ctx), 1, 1.2, 0.05)}<div class="qz-timer"><svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="17"/><circle class="qz-ring" cx="20" cy="20" r="17" pathLength="1"/></svg><div class="qz-digits">${digits}</div></div></div>
${fit('h1', 'headline a-up', markup(sc.question || ''), sz('head', ctx), 3, 1.08, 0.2)}
<ol class="qz-opts n${opts.length}">${items}</ol>
${sc.explain ? fit('p', 'subline qz-explain', markup(sc.explain), sz('sub', ctx), 2, 1.3) : ''}</div>`;
}

function poll(sc, ctx) {
  const rv = r2(clamp(voiceEnd(ctx, 1.6) + 0.2, 1.6, ctx.dur - 1));
  const a = Number.isFinite(+sc.resultA) && sc.resultA !== undefined && sc.resultA !== null ? clamp(Math.round(+sc.resultA), 0, 100) : null;
  const side = (k, text, ic, pct) => `<div class="pl-card pl-${k} a-up" style="--d:${k === 'a' ? 0.35 : 0.6}s">${icon(ic, 'fmt-icon', k === 'a' ? 0.55 : 0.8, ctx)}${fit('p', 'fmt-text', markup(text || ''), sz('opt', ctx) * 1.3, 3, 1.2)}${pct == null ? '' : `<div class="pl-bar"><i style="--p:${pct}%"></i></div><div class="pl-pct">${pct}%</div>`}</div>`;
  return `<div class="in t-poll fmt" style="--rv:${rv}s">
${fit('h1', 'headline a-up', markup(sc.question || 'Would you rather…'), sz('head', ctx), 2, 1.06, 0.1)}
<div class="pl-row">${side('a', sc.optionA, sc.iconA, a)}<div class="pl-or a-pop" style="--d:.5s">OR</div>${side('b', sc.optionB, sc.iconB, a == null ? null : 100 - a)}</div></div>`;
}

/** A message thread that appears bubble by bubble. Generic look: no real app's colours or logo. */
function chat(sc, ctx) {
  const msgs = (sc.messages || []).slice(0, 14);
  const n = Math.max(1, msgs.length);
  const span = Math.max(voiceEnd(ctx, ctx.dur - 0.8), ctx.dur - 0.9) - 0.6;
  const step = Math.max(0.8, span / n);
  const contact = sc.contact || msgs.find((m) => !isMe(m))?.from || 'Friend';
  const bubbles = msgs.map((m, j) => {
    const at = r2(0.6 + j * step);
    const me = isMe(m);
    const typing = me ? '' : `<div class="ct-typing" style="--d:${r2(Math.max(0.1, at - 0.65))}s;--e:${at}s"><i></i><i></i><i></i></div>`;
    return `${typing}<div class="ct-msg ${me ? 'me' : 'them'}" style="--d:${at}s">${fit('div', 'ct-text', markup(m.text || ''), sz('msg', ctx), 6, 1.28)}</div>`;
  }).join('');
  const initial = esc(String(contact).trim().charAt(0).toUpperCase() || '•');
  return `<div class="in t-chat fmt no-scale"><div class="ct-phone a-rise" style="--d:.05s;--rows:${n}">
<div class="ct-head"><span class="ct-av">${initial}</span><div><b>${esc(contact)}</b><small>online</small></div></div>
<div class="ct-list">${bubbles}</div></div></div>`;
}
const isMe = (m) => /^(me|i|you|self|user)$/i.test(String(m.from || '').trim()) || m.me === true;

// ───────────────────────── kinetic typography ─────────────────────────

/** Templates kinetic typography turns into big timed words (scenes with characters keep their pictures). */
export const KINETIC_TEMPLATES = new Set(['title', 'bullets', 'split', 'stat', 'quote', 'steps', 'feature', 'cta', 'fact', 'rank', 'story']);

/** Text a scene shows when it has no narration to time the words by. */
function sceneText(sc) {
  return [sc.kicker && sc.template === 'title' ? '' : '', sc.headline, sc.title, sc.subline, sc.body, sc.quote, sc.fact, sc.text,
    ...(sc.items || []).map((it) => (typeof it === 'string' ? it : `${it.value} ${it.label}`)), ...(sc.steps || [])]
    .filter(Boolean).join(' ');
}

export function kineticScene(sc, ctx) {
  const d = ctx.dur;
  let groups;
  const w = ctx.tl?.words;
  if (w?.length) {
    const tokens = w.map(([html]) => ({ html, text: html.replace(/<[^>]+>/g, '') }));
    groups = groupWords(tokens, w.map(([, a, b]) => [a - ctx.tl.start, b - ctx.tl.start]), 'pop', { maxWords: 3, maxChars: 18, clipStart: 0 });
  } else {
    const toks = captionTokens(sceneText(sc));
    const per = toks.length ? Math.max(0.35, (d - 0.6) / toks.length) : 1;
    groups = groupWords(toks, toks.map((_, k) => [0.25 + k * per, 0.25 + (k + 1) * per - 0.05]), 'pop', { maxWords: 3, maxChars: 18, clipStart: 0 });
  }
  const moves = ctx.vary?.moves || ['kt-slam', 'kt-rise', 'kt-left'];
  const beats = groups.map((g, k) => {
    const next = groups[k + 1];
    const out = next ? next.start : d + 1;
    const html = g.html.replace(/<b class="w">|<\/b>/g, '');
    const hot = /<mark>/.test(html);
    return `<div class="kt-beat${hot ? ' kt-hot' : ''}" style="--d:${r2(Math.max(0, g.start))}s;--o:${r2(out)}s;--kin:${moves[k % moves.length]}">${fit('div', 'kt-word', html, sz('kin', ctx), 3, 1.02)}</div>`;
  }).join('');
  // With a voice, the headline stays small at the top as the scene's label.
  const label = w?.length && (sc.headline || sc.title) ? `<div class="kt-label a-up" style="--d:.05s">${markup(String(sc.headline || sc.title).replace(/\*/g, ''))}</div>` : '';
  return `<div class="in t-kinetic no-scale"><div class="kt">${label}${beats}<i class="kt-bar"></i></div></div>`;
}

// ───────────────────────── plan 18 M6: post story, before / after ─────────────────────────

/**
 * A forum-style post read out by the narrator. Generic design (no real site's name, logo or colours),
 * over our own looping background (never game footage). Votes and comments count up.
 */
function post(sc, ctx) {
  const user = String(sc.user || 'anonymous').replace(/^@/, '');
  const votes = Math.max(0, Math.round(+sc.votes || 0)), comments = Math.max(0, Math.round(+sc.comments || 0));
  const count = (n, t0) => `<span class="cu" data-cu="${t0}:0|${r2(t0 + 1.4)}:${n}" data-dec="0" data-loc="en-US"><b>${n.toLocaleString('en-US')}</b></span>`;
  const meta = [sc.community, sc.time].filter(Boolean).map((x) => esc(String(x))).join(' · ');
  return `<div class="in t-post fmt no-scale"><div class="ps-bg"><i></i><i></i><i></i></div>
<div class="ps-card a-rise" style="--d:.1s">
<div class="ps-head"><span class="ps-av">${esc(user.charAt(0).toUpperCase() || '•')}</span><div><b>${esc(user)}</b>${meta ? `<small>${meta}</small>` : ''}</div>${sc.tag ? `<span class="ps-tag">${esc(sc.tag)}</span>` : ''}</div>
${fit('h1', 'ps-title', markup(sc.title || sc.headline || ''), sz('head', ctx) * 0.72, 3, 1.12, 0.25)}
${sc.body ? fit('p', 'ps-body a-up', markup(sc.body), sz('sub', ctx) * 1.05, ctx.fi === 1 ? 9 : 6, 1.35, 0.6) : ''}
<div class="ps-foot a-up" style="--d:.9s"><span class="ps-vote">▲ ${count(votes, 0.9)}</span><span class="ps-com">💬 ${count(comments, 1.1)}</span><span class="ps-share">↗ Share</span></div>
</div></div>`;
}

/** "After" first; then a wipe reveals "before"; it settles as a split showing both, labelled. */
function beforeafter(sc, ctx) {
  const side = (o) => (typeof o === 'string' ? { text: o } : o || {});
  const B = side(sc.before), A = side(sc.after);
  // The wipe starts when the narration says "before" (or a little before half-way).
  const w = ctx.tl?.words || [];
  const cue = w.find(([h]) => /^(<[^>]+>)*(before|पहले|earlier)/i.test(h));
  const t1 = r2(clamp(cue ? cue[1] - ctx.tl.start - 0.1 : Math.min(voiceEnd(ctx, ctx.dur * 0.5) * 0.45, ctx.dur * 0.4), 0.9, Math.max(1, ctx.dur - 2.4)));
  const panel = (o, k) => {
    const img = o.image ? ctx.asset(o.image) : null;
    const ic = !img && o.icon ? iconSvg(o.icon, { stroke: 'currentColor' }) : null;
    const items = (o.items || []).slice(0, ctx.fi === 1 ? 3 : 4).map((it) => `<li><b>${k === 'before' ? '✕' : '✓'}</b>${fit('span', 'ba-item', markup(it), sz('opt', ctx) * 0.9, 2, 1.2)}</li>`).join('');
    return `<div class="ba-panel ba-${k}"><div class="ba-box">
<div class="ba-label">${esc(o.label || (k === 'before' ? 'Before' : 'After'))}</div>
${img ? `<div class="ba-img"><img src="${img.src}" alt=""></div>` : ic ? `<div class="ba-ic">${ic}</div>` : ''}
${o.text ? fit('p', 'fmt-text ba-text', markup(o.text), sz('opt', ctx) * 1.25, 3, 1.18) : ''}${items ? `<ul class="ba-items">${items}</ul>` : ''}</div></div>`;
  };
  return `<div class="in t-beforeafter fmt no-scale" style="--rv:${t1}s">
${sc.headline ? fit('h1', 'headline a-up', markup(sc.headline), sz('head', ctx), 2, 1.06, 0.05) : ''}
<div class="ba">${panel(A, 'after')}${panel(B, 'before')}<i class="ba-line"><b>⇆</b></i></div></div>`;
}

export const FORMAT_HTML = { rank, fact, myth, quiz, poll, chat, post, beforeafter };

export const FORMAT_CSS = `
.fmt{left:max(var(--sl,0px),calc(var(--u)*7));right:max(var(--sr,0px),calc(var(--u)*7));top:max(var(--st,0px),calc(var(--u)*7));bottom:max(var(--sb,0px),calc(var(--u)*7));align-content:center;justify-items:center;text-align:center}
.fmt .headline{color:var(--ink)}
.fmt mark{background:none;color:var(--accent)}
.my-truth mark{color:var(--ok)}
.fmt-icon{width:calc(var(--u)*9);height:calc(var(--u)*9);border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--accent) 16%,transparent);color:var(--accent)}
.fmt-icon.big{width:calc(var(--u)*12);height:calc(var(--u)*12)}
.fmt-icon svg{width:58%;height:58%}
.a-slam{animation:slam .5s cubic-bezier(.2,1.4,.4,1) both;animation-delay:var(--d,0s)}
@keyframes slam{from{opacity:0;transform:scale(2.2) rotate(-6deg)}}

.t-rank{grid-template-columns:auto 1fr;justify-items:start;text-align:left;column-gap:calc(var(--u)*5)}
.f-9x16 .t-rank,.f-1x1 .t-rank{grid-template-columns:1fr;justify-items:center;text-align:center}
.rk-num{font:900 calc(var(--u)*${SZ.num[0]}) / .9 var(--display);color:var(--accent);letter-spacing:-.04em}
.f-9x16 .rk-num{font-size:calc(var(--u)*${SZ.num[1]})}.f-1x1 .rk-num{font-size:calc(var(--u)*${SZ.num[2]})}
.rk-num span{font-size:.45em;vertical-align:.9em;opacity:.7;margin-right:.05em}
.rk-body{display:flex;flex-direction:column;gap:calc(var(--u)*1.6);align-items:inherit;min-width:0;max-width:100%}
.t-rank .rk-body{align-items:flex-start}.f-9x16 .t-rank .rk-body,.f-1x1 .t-rank .rk-body{align-items:center}

.t-fact{gap:calc(var(--u)*3)}
.fact-text{font-family:var(--display);font-weight:700;color:var(--ink);max-width:100%}
.fact-text mark{background:none;color:var(--accent)}
.fact-src{color:var(--muted);font-style:italic}

.t-myth{gap:calc(var(--u)*2.4);width:auto}
.my-card{position:relative;width:min(100%,calc(var(--u)*120));border-radius:calc(var(--u)*2);padding:calc(var(--u)*2.4) calc(var(--u)*3);text-align:left;background:color-mix(in srgb,var(--ink) 6%,transparent);border:calc(var(--u)*.3) solid color-mix(in srgb,var(--ink) 14%,transparent)}
.my-tag{font:800 calc(var(--u)*2.6) var(--display);letter-spacing:.12em;margin-bottom:calc(var(--u)*1)}
.my-myth .my-tag{color:var(--alert)}.my-truth .my-tag{color:var(--ok)}
.my-tag b{display:inline-grid;place-items:center;width:1.5em;height:1.5em;border-radius:50%;color:#fff;margin-right:.3em}
.my-myth .my-tag b{background:var(--alert)}.my-truth .my-tag b{background:var(--ok)}
.my-myth{animation:up .6s cubic-bezier(.2,.8,.2,1) both .15s,my-fade .5s ease var(--rv) forwards}
.my-strike{position:absolute;left:4%;right:4%;top:58%;height:calc(var(--u)*.6);background:var(--alert);border-radius:9px;transform:scaleX(0);transform-origin:left;animation:my-strike .45s cubic-bezier(.4,0,.2,1) calc(var(--rv) - .35s) forwards}
.my-truth{opacity:0;border-color:var(--ok);background:color-mix(in srgb,var(--ok) 12%,transparent);animation:my-in .6s cubic-bezier(.2,1.2,.4,1) var(--rv) forwards}
@keyframes my-strike{to{transform:scaleX(1)}}
@keyframes my-fade{to{opacity:.45;transform:scale(.94)}}
@keyframes my-in{from{opacity:0;transform:translateY(calc(var(--u)*4)) scale(.92)}to{opacity:1;transform:none}}

.t-quiz{gap:calc(var(--u)*2.6)}
.qz-top{display:flex;align-items:center;gap:calc(var(--u)*3)}
.qz-timer{position:relative;width:calc(var(--u)*9);height:calc(var(--u)*9)}
.qz-timer svg{width:100%;height:100%;transform:rotate(-90deg)}
.qz-timer circle{fill:none;stroke:color-mix(in srgb,var(--ink) 16%,transparent);stroke-width:4}
.qz-timer .qz-ring{stroke:var(--accent);stroke-dasharray:1;stroke-dashoffset:0;animation:qz-ring var(--cd) linear var(--t0) both}
.qz-digits b{position:absolute;inset:0;display:grid;place-items:center;font:800 calc(var(--u)*4) var(--display);color:var(--ink);opacity:0;animation:qz-dig 1s steps(1) var(--d) both}
@keyframes qz-ring{to{stroke-dashoffset:1}}
@keyframes qz-dig{0%{opacity:1}100%{opacity:0}}
.qz-opts{list-style:none;margin:0;padding:0;display:grid;gap:calc(var(--u)*1.6);width:min(100%,calc(var(--u)*120))}
.f-16x9 .qz-opts.n4{grid-template-columns:1fr 1fr}
.qz-opt{display:flex;align-items:center;gap:calc(var(--u)*1.8);text-align:left;padding:calc(var(--u)*1.6) calc(var(--u)*2.2);border-radius:calc(var(--u)*1.6);background:color-mix(in srgb,var(--ink) 7%,transparent);border:calc(var(--u)*.3) solid color-mix(in srgb,var(--ink) 14%,transparent)}
.qz-l{flex:none;width:calc(var(--u)*5);height:calc(var(--u)*5);border-radius:50%;display:grid;place-items:center;font:800 calc(var(--u)*2.6) var(--display);background:var(--accent);color:var(--onAccent)}
.qz-opt .fmt-text{flex:1;min-width:0;font-weight:700;color:var(--ink)}
.qz-right{animation:up .7s cubic-bezier(.2,.8,.2,1) both var(--d),qz-ok .45s cubic-bezier(.2,1.4,.4,1) var(--rv) forwards}
.qz-wrong{animation:up .7s cubic-bezier(.2,.8,.2,1) both var(--d),qz-no .4s ease var(--rv) forwards}
@keyframes qz-ok{to{background:var(--ok);border-color:var(--ok);transform:scale(1.05)}}
@keyframes qz-no{to{opacity:.38}}
.qz-explain{opacity:0;animation:up .6s cubic-bezier(.2,.8,.2,1) calc(var(--rv) + .35s) forwards}

.t-poll{gap:calc(var(--u)*3)}
.pl-row{display:flex;align-items:stretch;gap:calc(var(--u)*2.4);width:100%;justify-content:center}
.f-9x16 .pl-row{flex-direction:column;align-items:center}
.pl-card{flex:1;max-width:calc(var(--u)*62);min-width:0;display:flex;flex-direction:column;align-items:center;gap:calc(var(--u)*1.6);padding:calc(var(--u)*3);border-radius:calc(var(--u)*2.4);background:color-mix(in srgb,var(--accent) 12%,transparent);border:calc(var(--u)*.35) solid var(--accent)}
.pl-b{background:color-mix(in srgb,var(--accent2) 12%,transparent);border-color:var(--accent2)}
.pl-b .fmt-icon{background:color-mix(in srgb,var(--accent2) 16%,transparent);color:var(--accent2)}
.f-9x16 .pl-card{width:100%}
.pl-card .fmt-text{font-weight:800;color:var(--ink)}
.pl-or{align-self:center;flex:none;width:calc(var(--u)*8);height:calc(var(--u)*8);border-radius:50%;display:grid;place-items:center;font:900 calc(var(--u)*2.8) var(--display);background:var(--ink);color:var(--bg)}
.pl-bar{width:100%;height:calc(var(--u)*1.6);border-radius:9px;background:color-mix(in srgb,var(--ink) 12%,transparent);overflow:hidden}
.pl-bar i{display:block;height:100%;width:0;background:var(--accent);animation:pl-fill .9s cubic-bezier(.2,.8,.2,1) var(--rv) forwards}
.pl-b .pl-bar i{background:var(--accent2)}
.pl-pct{font:800 calc(var(--u)*4) var(--display);color:var(--ink);opacity:0;animation:qz-show .3s ease calc(var(--rv) + .5s) forwards}
@keyframes pl-fill{to{width:var(--p)}}
@keyframes qz-show{to{opacity:1}}

#stage .in.t-chat{left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:max(var(--st,0px),calc(var(--u)*6)) calc(var(--u)*5) max(calc(var(--u)*15),calc(var(--sb,0px) + var(--u)*11))}
#stage.f-9x16 .in.t-chat{padding-bottom:max(calc(var(--u)*31),calc(var(--sb,0px) + var(--u)*16))}
.ct-phone{width:min(100%,calc(var(--u)*78));flex:1 1 auto;min-height:0;max-height:min(calc(var(--u)*150),calc(var(--u)*var(--rows,8)*14 + var(--u)*24));display:flex;flex-direction:column;border-radius:calc(var(--u)*3.2);overflow:hidden;background:color-mix(in srgb,var(--bg) 92%,var(--ink));border:calc(var(--u)*.35) solid color-mix(in srgb,var(--ink) 16%,transparent);box-shadow:0 calc(var(--u)*2.4) calc(var(--u)*6) #0003}
.f-16x9 .ct-phone{width:calc(var(--u)*62)}
.ct-head{flex:none;display:flex;align-items:center;gap:calc(var(--u)*1.6);padding:calc(var(--u)*1.8) calc(var(--u)*2.4);background:color-mix(in srgb,var(--ink) 8%,var(--bg));text-align:left}
.ct-head b{display:block;font:700 calc(var(--u)*2.6) var(--body);color:var(--ink)}
.ct-head small{font:500 calc(var(--u)*1.8) var(--body);color:var(--ok)}
.ct-av{width:calc(var(--u)*5.2);height:calc(var(--u)*5.2);border-radius:50%;display:grid;place-items:center;background:var(--accent2);color:#fff;font:800 calc(var(--u)*2.6) var(--display)}
.ct-list{flex:1;min-height:0;overflow:hidden;display:flex;flex-direction:column;justify-content:flex-end;gap:0;padding:calc(var(--u)*1.6) calc(var(--u)*2)}
.ct-msg{max-width:78%;max-height:0;opacity:0;margin:0;padding:0 calc(var(--u)*1.8);border-radius:calc(var(--u)*2.2);text-align:left;overflow:hidden;animation:ct-in .32s cubic-bezier(.2,1.2,.4,1) var(--d) forwards}
.ct-msg.them{align-self:flex-start;background:color-mix(in srgb,var(--ink) 10%,var(--bg));color:var(--ink);border-bottom-left-radius:calc(var(--u)*.6)}
.ct-msg.me{align-self:flex-end;background:var(--accent);color:var(--onAccent);border-bottom-right-radius:calc(var(--u)*.6)}
.ct-text{font-weight:600}
.ct-msg.me .ct-text mark{background:none;color:inherit;text-decoration:underline}
@keyframes ct-in{to{max-height:calc(var(--u)*40);opacity:1;margin:calc(var(--u)*.7) 0;padding:calc(var(--u)*1.3) calc(var(--u)*1.8)}}
.ct-typing{align-self:flex-start;display:flex;gap:calc(var(--u)*.6);max-height:0;opacity:0;overflow:hidden;padding:0 calc(var(--u)*1.6);border-radius:calc(var(--u)*2);background:color-mix(in srgb,var(--ink) 10%,var(--bg));animation:ct-type-on .2s ease var(--d) forwards,ct-type-off .01s linear var(--e) forwards}
.ct-typing i{width:calc(var(--u)*1.1);height:calc(var(--u)*1.1);border-radius:50%;background:var(--muted);animation:ct-dot .9s ease-in-out infinite}
.ct-typing i:nth-child(2){animation-delay:.15s}.ct-typing i:nth-child(3){animation-delay:.3s}
@keyframes ct-type-on{to{max-height:calc(var(--u)*6);opacity:1;margin:calc(var(--u)*.7) 0;padding:calc(var(--u)*1.4) calc(var(--u)*1.6)}}
@keyframes ct-type-off{to{max-height:0;opacity:0;margin:0;padding:0 calc(var(--u)*1.6)}}
@keyframes ct-dot{50%{transform:translateY(calc(var(--u)*-.6));opacity:.5}}
/* plan 18 M6: post story */
#stage .in.t-post{left:0;right:0;top:0;bottom:0;display:flex;align-items:center;justify-content:center;padding:max(var(--st,0px),calc(var(--u)*7)) calc(var(--u)*6) max(calc(var(--u)*13),calc(var(--sb,0px) + var(--u)*10))}
#stage.f-9x16 .in.t-post{padding-bottom:max(calc(var(--u)*30),calc(var(--sb,0px) + var(--u)*15));padding-left:calc(var(--u)*4.5);padding-right:calc(var(--u)*4.5)}
.ps-bg{position:absolute;inset:0;overflow:hidden;background:linear-gradient(135deg,color-mix(in srgb,var(--accent2) 55%,#0d1020),color-mix(in srgb,var(--accent) 45%,#0d1020))}
.ps-bg i{position:absolute;width:70%;aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,#ffffff2e,transparent);animation:ps-orbit 7s ease-in-out infinite alternate}
.ps-bg i:nth-child(1){left:-20%;top:-20%}.ps-bg i:nth-child(2){right:-25%;top:30%;animation-duration:9s;animation-direction:alternate-reverse}.ps-bg i:nth-child(3){left:20%;bottom:-40%;animation-duration:11s}
.ps-bg::after{content:"";position:absolute;inset:-50%;background:repeating-linear-gradient(45deg,#ffffff08 0 calc(var(--u)*3),transparent calc(var(--u)*3) calc(var(--u)*6));animation:ps-slide 6s linear infinite}
@keyframes ps-orbit{to{transform:translate(12%,10%) scale(1.15)}}
@keyframes ps-slide{to{transform:translate(calc(var(--u)*8.5),calc(var(--u)*8.5))}}
.ps-card{position:relative;width:min(100%,calc(var(--u)*110));background:#ffffff;color:#1a1c22;border-radius:calc(var(--u)*2.2);padding:calc(var(--u)*3) calc(var(--u)*3.4) calc(var(--u)*2.4);box-shadow:0 calc(var(--u)*2) calc(var(--u)*7) #0006;display:flex;flex-direction:column;gap:calc(var(--u)*1.6);max-height:100%;min-height:0}
.ps-head{display:flex;align-items:center;gap:calc(var(--u)*1.4);font:500 calc(var(--u)*2.3) var(--body);color:#5b606b}
#stage.f-9x16 .ps-head{font-size:calc(var(--u)*3)}
.ps-head b{display:block;color:#1a1c22;font-weight:700}
.ps-head small{font-size:.85em}
.ps-av{flex:none;display:grid;place-items:center;width:2.4em;height:2.4em;border-radius:50%;background:var(--accent);color:#fff;font-weight:700}
.ps-tag{margin-left:auto;font-size:.8em;font-weight:700;color:var(--accent);border:calc(var(--u)*.2) solid currentColor;border-radius:99px;padding:.15em .8em;white-space:nowrap}
.ps-title{margin:0;font-family:var(--display);font-weight:700;color:#1a1c22;line-height:1.12}
.ps-title mark,.ps-body mark{background:none;color:var(--accent)}
.ps-body{margin:0;color:#343844;min-height:0}
.ps-foot{display:flex;gap:calc(var(--u)*3);font:600 calc(var(--u)*2.3) var(--body);color:#5b606b;border-top:calc(var(--u)*.15) solid #e6e8ee;padding-top:calc(var(--u)*1.4)}
#stage.f-9x16 .ps-foot{font-size:calc(var(--u)*3)}
.ps-vote{color:var(--accent)}
.ps-share{margin-left:auto}

/* plan 18 M6: before / after */
#stage .in.t-beforeafter{left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;gap:calc(var(--u)*2.4);padding:max(var(--st,0px),calc(var(--u)*6)) calc(var(--u)*6) max(calc(var(--u)*12),calc(var(--sb,0px) + var(--u)*9))}
#stage.f-9x16 .in.t-beforeafter{padding-bottom:max(calc(var(--u)*30),calc(var(--sb,0px) + var(--u)*15));padding-left:calc(var(--u)*4.5);padding-right:calc(var(--u)*4.5)}
.t-beforeafter .headline{text-align:center;margin:0;flex:none}
.ba{position:relative;flex:1 1 auto;min-height:0;border-radius:calc(var(--u)*2);overflow:hidden;box-shadow:0 calc(var(--u)*1) calc(var(--u)*4) #0003;animation:dt-in .5s ease .1s both}
.ba-panel{position:absolute;inset:0;display:flex}
.ba-after{background:linear-gradient(160deg,color-mix(in srgb,var(--ok) 22%,var(--bg)),color-mix(in srgb,var(--ok) 40%,var(--bg)))}
.ba-before{background:linear-gradient(160deg,color-mix(in srgb,var(--ink) 12%,var(--bg)),color-mix(in srgb,var(--ink) 24%,var(--bg)));filter:saturate(.6);clip-path:inset(0 100% 0 0);animation:ba-wipe 2.6s cubic-bezier(.6,0,.3,1) var(--rv) both}
.ba-box{position:absolute;top:0;bottom:0;width:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:calc(var(--u)*1.6);padding:calc(var(--u)*3);box-sizing:border-box;text-align:center}
.ba-before .ba-box{left:0}
.ba-after .ba-box{left:25%;animation:ba-move 2.6s cubic-bezier(.6,0,.3,1) var(--rv) both}
.ba-label{font:700 calc(var(--u)*2.6) var(--display);letter-spacing:.14em;text-transform:uppercase;padding:0 .8em;border-radius:99px;color:#fff;box-shadow:0 0 0 .3em var(--c)}
.ba-before .ba-label{--c:var(--alert);background:var(--alert)}
.ba-after .ba-label{--c:var(--ok);background:var(--ok)}
.lang-deva .ba-label{letter-spacing:0}
.ba-text{margin:0;font-weight:700;color:var(--ink);width:100%}
.ba-ic{width:calc(var(--u)*12);height:calc(var(--u)*12);color:var(--ink)}
.ba-ic svg{width:100%;height:100%}
.ba-img{width:100%;flex:0 1 46%;min-height:0;border-radius:calc(var(--u)*1.4);overflow:hidden}
.ba-img img{width:100%;height:100%;object-fit:cover}
.ba-items{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*.8);width:100%;text-align:left}
.ba-items li{display:flex;align-items:center;gap:calc(var(--u)*1.2);font-weight:600;color:var(--ink)}
.ba-items li>b{flex:none;width:1.5em;height:1.5em;display:grid;place-items:center;border-radius:50%;color:#fff;font-size:.8em}
.ba-before .ba-items li>b{background:var(--alert)}
.ba-after .ba-items li>b{background:var(--ok)}
.ba-items .ba-item{flex:1;min-width:0}
.ba-line{position:absolute;top:0;bottom:0;left:0;width:calc(var(--u)*.6);margin-left:calc(var(--u)*-.3);background:#fff;box-shadow:0 0 calc(var(--u)*1.5) #0006;opacity:0;animation:ba-line 2.6s cubic-bezier(.6,0,.3,1) var(--rv) both}
.ba-line b{position:absolute;top:50%;left:50%;width:calc(var(--u)*6);height:calc(var(--u)*6);margin:calc(var(--u)*-3) 0 0 calc(var(--u)*-3);border-radius:50%;background:#fff;color:#222;display:grid;place-items:center;font-size:calc(var(--u)*3);box-shadow:0 0 calc(var(--u)*1.2) #0005}
@keyframes ba-wipe{0%{clip-path:inset(0 100% 0 0)}45%,62%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 50% 0 0)}}
@keyframes ba-move{0%,62%{left:25%}100%{left:50%}}
@keyframes ba-line{0%{left:0;opacity:0}4%{opacity:1}45%,62%{left:100%;opacity:1}100%{left:50%;opacity:1}}
/* 9:16: the split is top / bottom */
#stage.f-9x16 .ba-box{left:0 !important;width:100%;height:50%;top:0;bottom:auto}
#stage.f-9x16 .ba-box{gap:calc(var(--u)*.9);padding:calc(var(--u)*2.2) calc(var(--u)*3)}
#stage.f-9x16 .ba-ic{width:calc(var(--u)*8);height:calc(var(--u)*8)}
#stage.f-9x16 .ba-img{flex-basis:38%}
#stage.f-9x16 .ba-items{gap:calc(var(--u)*.4)}
#stage.f-9x16 .ba{min-height:calc(var(--u)*90)}
#stage.f-9x16 .ba-after .ba-box{top:25%;animation-name:ba-move-v}
#stage.f-9x16 .ba-before{animation-name:ba-wipe-v}
#stage.f-9x16 .ba-line{left:0;right:0;width:auto;top:0;bottom:auto;height:calc(var(--u)*.6);margin:calc(var(--u)*-.3) 0 0;animation-name:ba-line-v}
@keyframes ba-wipe-v{0%{clip-path:inset(0 0 100% 0)}45%,62%{clip-path:inset(0 0 0 0)}100%{clip-path:inset(0 0 50% 0)}}
@keyframes ba-move-v{0%,62%{top:25%}100%{top:50%}}
@keyframes ba-line-v{0%{top:0;opacity:0}4%{opacity:1}45%,62%{top:100%;opacity:1}100%{top:50%;opacity:1}}
@keyframes dt-in{from{opacity:0;transform:translateY(calc(var(--u)*1.2))}to{opacity:1;transform:none}}

`;
