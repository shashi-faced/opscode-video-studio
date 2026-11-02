// Template library. Each template returns scene inner HTML.
// Rules: only theme tokens, sizes in --u (1% of the stage's short side),
// text in .fit boxes (auto-shrunk by the runtime), entry delays via --d.
import { escapeHtml as esc, markup } from '../timeline.mjs';
import { mascotSvg } from './mascots.mjs';

const fit = (tag, cls, html, max, lines, lh = 1.06, d = 0) =>
  `<${tag} class="fit ${cls}" data-max="${max}" data-lines="${lines}" data-lh="${lh}" style="--d:${d}s">${html}</${tag}>`;

// Font sizes (in u) per format: [16:9, 9:16, 1:1]
const SZ = {
  kicker: [2.3, 3.1, 2.8], hero: [11, 10.5, 9.5], head: [7.6, 9, 7.6], sub: [3.3, 4.2, 3.6],
  body: [3.2, 4.1, 3.5], item: [3.6, 4.4, 3.8], quote: [6.2, 7, 6], cta: [11, 12, 10], stat: [12, 13, 11],
};
const sz = (k, ctx) => SZ[k][ctx.fi];

function textBlock(sc, ctx, { hero = false, d0 = 0.1 } = {}) {
  let h = '';
  if (sc.kicker) h += fit('div', 'kicker a-up', esc(sc.kicker), sz('kicker', ctx), 1, 1.2, d0);
  if (sc.headline) h += fit('h1', 'headline a-up', markup(sc.headline), sz(hero ? 'hero' : 'head', ctx), hero ? 3 : 2, 1.04, d0 + 0.15);
  if (sc.subline) h += fit('p', 'subline a-up', markup(sc.subline), sz('sub', ctx), 3, 1.35, d0 + 0.35);
  if (sc.body) h += fit('p', 'subline a-up', markup(sc.body), sz('body', ctx), 4, 1.4, d0 + 0.35);
  return h;
}

function mascot(sc, ctx, cls = '') {
  if (!sc.mascot || sc.mascot === 'none') return '';
  return `<div class="mascot ${cls} a-pop" style="--d:.7s"><div class="floaty">${mascotSvg(sc.mascot, sc.mascotMood, `m${ctx.index}`)}</div></div>`;
}

// Image in a frame, with overlays. Sized by the runtime to fit its .media box.
function media(sc, ctx, { d = 0.3 } = {}) {
  const img = ctx.asset(sc.image);
  const framed = (sc.imageFrame || 'window') === 'window';
  const bar = framed ? `<div class="bar"><i></i><i></i><i></i>${sc.imageTitle ? `<b>${esc(sc.imageTitle)}</b>` : ''}</div>` : '';
  const hls = (sc.highlights || []).map((b, j) =>
    `<div class="hl a-hl" style="left:${b.x * 100}%;top:${b.y * 100}%;width:${b.w * 100}%;height:${b.h * 100}%;--d:${b.at ?? +(1.3 + j * 0.9).toFixed(2)}s"></div>`).join('');
  let cursor = '';
  if (sc.cursor) {
    const at = sc.cursor.at ?? 0.9;
    cursor = `<div class="cursor a-cursor" style="left:${sc.cursor.x * 100}%;top:${sc.cursor.y * 100}%;--d:${at}s"><svg viewBox="0 0 24 24"><path d="M3 2l18 9-8 2-3 8z" fill="var(--accent)" stroke="#1a1208" stroke-width="1.5" stroke-linejoin="round"/></svg></div>
<div class="ripple a-ripple" style="left:${sc.cursor.x * 100}%;top:${sc.cursor.y * 100}%;--d:${(at + 2.1).toFixed(2)}s"></div>`;
  }
  return `<div class="media"><div class="frame a-rise" data-aspect="${img.aspect}" style="--d:${d}s">${bar}<div class="imgwrap"><img src="${img.src}" alt="">${hls}${cursor}</div></div></div>`;
}

function chips(list, ctx, d0 = 1.0) {
  if (!list?.length) return '';
  return `<div class="chips">${list.map((c, j) => `<span class="chip a-up" style="--d:${(d0 + j * 0.3).toFixed(2)}s">${markup(c)}</span>`).join('')}</div>`;
}

function tags(sc, ctx) {
  const list = [...(sc.tags || []).map(t => ({ ...t }))];
  // Highlight labels become tags too, appearing with their box.
  (sc.highlights || []).forEach((b, j) => { if (b.label) list.push({ text: b.label, tone: 'accent', at: (b.at ?? 1.3 + j * 0.9) + 0.35 }); });
  if (!list.length) return '';
  const lastHl = (sc.highlights || []).length ? 1.3 + (sc.highlights.length) * 0.9 : 1.6;
  return `<div class="tags">${list.slice(0, 5).map((t, j) => `<span class="tag tone-${t.tone || 'accent'} a-pop" style="--d:${(t.at ?? lastHl + j * 0.6).toFixed(2)}s">${markup(t.text)}</span>`).join('')}</div>`;
}

export const TEMPLATE_HTML = {
  title(sc, ctx) {
    const vis = sc.image ? media(sc, ctx, { d: 0.45 }) : (sc.mascot && sc.mascot !== 'none' ? `<div class="vis-mascot">${mascot(sc, ctx, 'big')}</div>` : '');
    const extraMascot = sc.image ? mascot(sc, ctx, 'corner') : '';
    return `<div class="in t-title ${vis ? 'has-vis' : 'no-vis'}"><div class="txt">${textBlock(sc, ctx, { hero: true })}</div>${vis}${extraMascot}</div>`;
  },
  feature(sc, ctx) {
    return `<div class="in t-feature"><div class="txt">${textBlock(sc, ctx)}${ctx.fi === 0 ? chips(sc.chips, ctx) : ''}${mascot(sc, ctx, 'inline')}</div>
${ctx.fi !== 0 ? (chips(sc.chips, ctx, 0.9) || '<div class="chips"></div>') : ''}${media(sc, ctx)}${tags(sc, ctx) || '<div class="tags"></div>'}</div>`;
  },
  bullets(sc, ctx) {
    const items = (sc.items || []).map((it, j) => `<li class="a-up" style="--d:${(0.8 + j * 0.45).toFixed(2)}s"><span class="tick">✓</span>${fit('span', 'item', markup(it), sz('item', ctx), 2, 1.25)}</li>`).join('');
    return `<div class="in t-bullets"><div class="txt">${textBlock(sc, ctx)}${mascot(sc, ctx, 'inline')}</div><ul class="list">${items}</ul></div>`;
  },
  split(sc, ctx) {
    return `<div class="in t-split side-${sc.side || 'right'}"><div class="txt">${textBlock(sc, ctx)}${mascot(sc, ctx, 'inline')}</div>${media(sc, ctx)}</div>`;
  },
  stat(sc, ctx) {
    const items = (sc.items || []).map((it, j) => `<div class="stat a-pop" style="--d:${(0.5 + j * 0.4).toFixed(2)}s">${fit('div', 'value', esc(it.value), sz('stat', ctx), 1, 1)}${fit('div', 'label', esc(it.label), sz('sub', ctx), 2, 1.25)}</div>`).join('');
    return `<div class="in t-stat"><div class="txt">${textBlock(sc, ctx)}</div><div class="stats n${(sc.items || []).length}">${items}</div>${mascot(sc, ctx, 'corner')}</div>`;
  },
  quote(sc, ctx) {
    const avatar = sc.image ? `<img class="avatar a-pop" style="--d:.9s" src="${ctx.asset(sc.image).src}" alt="">` : '';
    return `<div class="in t-quote"><div class="qmark a-pop" style="--d:.05s">“</div>${fit('blockquote', 'quote a-up', markup(sc.quote), sz('quote', ctx), 4, 1.15, 0.2)}
<div class="who a-up" style="--d:.8s">${avatar}<div><b>${esc(sc.author || '')}</b><span>${esc(sc.role || '')}</span></div></div>${mascot(sc, ctx, 'corner')}</div>`;
  },
  cta(sc, ctx) {
    const logo = sc.logo || ctx.brandLogo;
    const badges = (sc.badges || []).map((b, j) => `<span class="badge a-up" style="--d:${(0.9 + j * 0.12).toFixed(2)}s">${markup(b)}</span>`).join('');
    return `<div class="in t-cta">${logo ? `<img class="logo a-pop" style="--d:.05s" src="${ctx.asset(logo).src}" alt="">` : ''}
${fit('h1', 'headline a-up', markup(sc.headline), sz('cta', ctx), 2, 1, 0.2)}
${sc.subline ? fit('p', 'subline a-up', markup(sc.subline), sz('sub', ctx), 2, 1.35, 0.4) : ''}
<div class="stripe a-up" style="--d:.55s"><i></i><i></i><i></i></div>
${badges ? `<div class="badges">${badges}</div>` : ''}
${sc.button ? `<div class="button a-pop" style="--d:1.4s">${esc(sc.button)}</div>` : ''}${mascot(sc, ctx, 'corner')}</div>`;
  },
};

export const TEMPLATE_CSS = `
#stage{position:relative;overflow:hidden;color:var(--ink);font-family:var(--body);background:radial-gradient(130% 80% at 85% 0%,var(--bg3) 0%,var(--bg2) 42%,var(--bg) 100%);--u:10.8px}
#stage *{box-sizing:border-box}
.amb{position:absolute;inset:0;pointer-events:none}
.amb .star{position:absolute;width:calc(var(--u)*.35);height:calc(var(--u)*.35);border-radius:50%;background:var(--ink);opacity:.4;animation:twinkle 3s ease-in-out infinite}
.amb .blob{position:absolute;width:calc(var(--u)*80);height:calc(var(--u)*80);border-radius:50%;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent) 22%,transparent),transparent);left:-20%;bottom:-35%;animation:drift 18s ease-in-out infinite alternate}
.amb .blob.b2{left:auto;right:-25%;top:-30%;bottom:auto;background:radial-gradient(closest-side,color-mix(in srgb,var(--accent2) 22%,transparent),transparent);animation-duration:22s}
.brand{position:absolute;z-index:5;display:flex;align-items:center;gap:calc(var(--u)*1.2);font:600 calc(var(--u)*2.4) var(--body);color:var(--ink);opacity:.9}
.brand img{width:calc(var(--u)*4);height:calc(var(--u)*4);border-radius:calc(var(--u)*1);object-fit:cover}
.prog{position:absolute;z-index:5;display:flex;gap:calc(var(--u)*.6);height:calc(var(--u)*.55)}
.prog span{flex:1;border-radius:9px;background:color-mix(in srgb,var(--ink) 18%,transparent);overflow:hidden}
.prog span i{display:block;height:100%;width:0;background:var(--ink)}
.cap{position:absolute;z-index:6;left:0;right:0;display:flex;justify-content:center;pointer-events:none}
.cap span{max-width:86%;text-align:center;font:700 calc(var(--u)*var(--capsize)) / 1.25 var(--body);color:#fff;background:#0b0d26d9;padding:calc(var(--u)*1.1) calc(var(--u)*2.6);border-radius:calc(var(--u)*1.6);box-shadow:0 calc(var(--u)*.8) calc(var(--u)*2.4) #0007;text-wrap:balance}
.cap span:empty{display:none}
.cap mark{background:none;color:var(--accent)}

.scene{position:absolute;inset:0;display:none}
.scene.on{display:block}
.in{position:absolute;display:grid;gap:calc(var(--u)*3);min-height:0;min-width:0}
.scene.tr-fade .in{animation:sc-fade .5s ease both}
.scene.tr-slide .in{animation:sc-slide .6s cubic-bezier(.2,.8,.2,1) both}
.scene.tr-zoom .in{animation:sc-zoom .7s cubic-bezier(.2,.8,.2,1) both}

.txt{display:flex;flex-direction:column;gap:calc(var(--u)*1.4);min-width:0;min-height:0;position:relative}
.fit{margin:0;overflow-wrap:anywhere}
.kicker{font-family:var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}
.headline{font-family:var(--display);font-weight:700;letter-spacing:-.005em;text-wrap:balance}
.headline mark,.subline mark,.quote mark,.item mark,.chip mark,.badge mark,.tag mark{background:none;color:var(--accent)}
.subline{color:var(--muted)}
.media{position:relative;min-width:0;min-height:0;display:flex;align-items:center;justify-content:center}
.frame{position:relative;border-radius:calc(var(--u)*1.6);overflow:hidden;background:#fff;box-shadow:0 calc(var(--u)*3) calc(var(--u)*7) calc(var(--u)*-2) var(--shadow),0 0 0 calc(var(--u)*.2) var(--card-edge)}
.frame .bar{height:calc(var(--u)*3.2);background:#e9e9f2;display:flex;align-items:center;gap:calc(var(--u)*.8);padding-left:calc(var(--u)*1.6)}
.frame .bar i{width:calc(var(--u)*1.1);height:calc(var(--u)*1.1);border-radius:50%;background:#ff5f57}
.frame .bar i:nth-child(2){background:#febc2e}.frame .bar i:nth-child(3){background:#28c840}
.frame .bar b{font:600 calc(var(--u)*1.5) var(--body);color:#4b4f6b;margin-left:calc(var(--u)*1);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.imgwrap{position:relative}
.imgwrap img{display:block;width:100%;height:auto}
.hl{position:absolute;border:calc(var(--u)*.45) solid var(--accent);border-radius:calc(var(--u)*.9);box-shadow:0 0 calc(var(--u)*2.4) color-mix(in srgb,var(--accent) 60%,transparent);background:color-mix(in srgb,var(--accent) 8%,transparent)}
.cursor{position:absolute;width:calc(var(--u)*5);height:calc(var(--u)*5);margin:calc(var(--u)*-.6) 0 0 calc(var(--u)*-.8);filter:drop-shadow(0 calc(var(--u)*.6) calc(var(--u)*1) #0008)}
.ripple{position:absolute;width:calc(var(--u)*7);height:calc(var(--u)*7);margin:calc(var(--u)*-3.5) 0 0 calc(var(--u)*-3.5);border-radius:50%;border:calc(var(--u)*.45) solid var(--accent)}
.chips{display:flex;flex-wrap:wrap;gap:calc(var(--u)*1.2)}
.chip{font:600 calc(var(--u)*var(--chipsize)) var(--body);padding:calc(var(--u)*.8) calc(var(--u)*2);border-radius:99px;background:var(--chip-bg);border:calc(var(--u)*.15) solid var(--card-edge);white-space:nowrap}
.tags{display:flex;flex-direction:column;align-items:flex-start;gap:calc(var(--u)*1)}
.tag{font:600 calc(var(--u)*var(--tagsize)) var(--mono);padding:calc(var(--u)*.7) calc(var(--u)*1.4);border-radius:calc(var(--u)*.8);color:var(--on-accent);background:var(--accent);white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.tag.tone-ok{background:var(--ok);color:#04150d}.tag.tone-alert{background:var(--alert);color:#fff}
.mascot .floaty{animation:float 3s ease-in-out infinite}
.mascot svg{width:100%;height:auto;display:block;overflow:visible}
.eye{animation:blink 4.2s infinite;transform-box:fill-box;transform-origin:center}
.vis-mascot{display:flex;align-items:center;justify-content:center;min-height:0}
.mascot.big{width:min(100%,calc(var(--u)*46))}
.mascot.inline{width:calc(var(--u)*15);margin-top:calc(var(--u)*1)}
.mascot.corner{position:absolute;width:calc(var(--u)*14);right:0;bottom:0}
.list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*1.6);justify-content:center;min-height:0}
.list li{display:flex;align-items:center;gap:calc(var(--u)*1.6);background:var(--chip-bg);border:calc(var(--u)*.15) solid var(--card-edge);border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.6) calc(var(--u)*2.2)}
.list .tick{flex:none;display:grid;place-items:center;width:calc(var(--u)*4.4);height:calc(var(--u)*4.4);border-radius:50%;background:var(--accent);color:var(--on-accent);font:700 calc(var(--u)*2.4) var(--body)}
.list .item{flex:1;min-width:0;font-weight:600}
.stats{display:grid;gap:calc(var(--u)*2.4);align-content:center}
.stat{background:var(--chip-bg);border:calc(var(--u)*.15) solid var(--card-edge);border-radius:calc(var(--u)*2);padding:calc(var(--u)*3);display:flex;flex-direction:column;gap:calc(var(--u)*.6);min-width:0}
.stat .value{font-family:var(--display);color:var(--accent);font-weight:700}
.stat .label{color:var(--muted);font-weight:600}
.t-quote{align-content:center;justify-items:start}
.qmark{font:400 calc(var(--u)*22) / .6 var(--display);color:var(--accent);height:calc(var(--u)*9)}
.quote{margin:0;font-family:var(--display);font-weight:700}
.who{display:flex;align-items:center;gap:calc(var(--u)*1.8)}
.who b{display:block;font-size:calc(var(--u)*3.2)}.who span{color:var(--muted);font-size:calc(var(--u)*2.6)}
.avatar{width:calc(var(--u)*9);height:calc(var(--u)*9);border-radius:50%;object-fit:cover}
.t-cta{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:calc(var(--u)*2.2)}
.t-cta .logo{width:calc(var(--u)*var(--logosize));height:calc(var(--u)*var(--logosize));border-radius:22%;object-fit:cover;box-shadow:0 0 calc(var(--u)*10) color-mix(in srgb,var(--accent2) 60%,transparent)}
.t-cta .headline,.t-cta .subline{max-width:100%}
.stripe{display:flex;width:calc(var(--u)*30);height:calc(var(--u)*.9);border-radius:9px;overflow:hidden}
.stripe i{flex:1;background:var(--accent)}.stripe i:nth-child(2){background:var(--ink)}.stripe i:nth-child(3){background:var(--accent2)}
.badges{display:flex;flex-wrap:wrap;justify-content:center;gap:calc(var(--u)*1.2);max-width:100%}
.badge{font:600 calc(var(--u)*var(--chipsize)) var(--body);padding:calc(var(--u)*.8) calc(var(--u)*2);border-radius:99px;border:calc(var(--u)*.18) solid var(--card-edge)}
.button{font:700 calc(var(--u)*var(--btnsize)) var(--body);padding:calc(var(--u)*2) calc(var(--u)*5);border-radius:99px;background:var(--accent);color:var(--on-accent);box-shadow:0 calc(var(--u)*1.4) calc(var(--u)*4) color-mix(in srgb,var(--accent) 45%,transparent)}

/* ---- 16:9 ---- */
.f-16x9{--capsize:3.6;--chipsize:2.3;--tagsize:2.1;--btnsize:3.4;--logosize:17}
.f-16x9 .brand{left:calc(var(--u)*6);top:calc(var(--u)*4.4)}
.f-16x9 .prog{left:calc(var(--u)*6);right:calc(var(--u)*6);top:calc(var(--u)*2)}
.f-16x9 .cap{bottom:calc(var(--u)*4)}
.f-16x9 .in{left:calc(var(--u)*7);right:calc(var(--u)*7);top:calc(var(--u)*11);bottom:calc(var(--u)*15)}
.f-16x9 .t-title.has-vis{grid-template-columns:1fr 1.15fr;align-items:center}
.f-16x9 .t-title.no-vis{grid-template-columns:1fr;align-content:center;justify-items:start;padding-right:30%}
.f-16x9 .t-title .txt{justify-content:center}
.f-16x9 .t-feature{grid-template-columns:.78fr 1.42fr;grid-template-rows:1fr auto;align-items:center}
.f-16x9 .t-feature .txt{grid-row:1/3;justify-content:center}
.f-16x9 .t-feature .media{grid-column:2;grid-row:1;height:100%}
.f-16x9 .t-feature .tags{grid-column:2;grid-row:2;flex-direction:row;flex-wrap:wrap;justify-content:center}
.f-16x9 .t-feature .chips{flex-direction:column;align-items:flex-start;margin-top:calc(var(--u)*1)}
.f-16x9 .t-bullets{grid-template-columns:.9fr 1.1fr;align-items:center}
.f-16x9 .t-split{grid-template-columns:.85fr 1.15fr;align-items:center}
.f-16x9 .t-split.side-left .media{order:-1}
.f-16x9 .t-split .media,.f-16x9 .t-title .media{height:100%}
.f-16x9 .t-stat{grid-template-rows:auto 1fr}
.f-16x9 .stats{grid-auto-flow:column;grid-auto-columns:1fr}
.f-16x9 .t-quote{padding:0 12%}

/* ---- 9:16 ---- */
.f-9x16{--capsize:4.6;--chipsize:3.1;--tagsize:2.8;--btnsize:4.4;--logosize:24}
.f-9x16 .brand{left:calc(var(--u)*5);top:calc(var(--u)*6)}
.f-9x16 .prog{left:calc(var(--u)*4);right:calc(var(--u)*4);top:calc(var(--u)*3)}
.f-9x16 .cap{bottom:calc(var(--u)*15)}
.f-9x16 .in{left:calc(var(--u)*6);right:calc(var(--u)*6);top:calc(var(--u)*13);bottom:calc(var(--u)*31)}
.f-9x16 .t-title.has-vis{grid-template-rows:auto 1fr}
.f-9x16 .t-title.no-vis{grid-template-rows:1fr;align-content:center}
.f-9x16 .t-title.no-vis .txt{justify-content:center}
.f-9x16 .t-feature{grid-template-rows:auto auto 1fr auto;gap:calc(var(--u)*2.4)}
.f-9x16 .t-feature .chips{justify-content:center}
.f-9x16 .t-feature .tags{align-items:center}
.f-9x16 .t-bullets{grid-template-rows:auto 1fr}
.f-9x16 .t-split{grid-template-rows:auto 1fr}
.f-9x16 .t-stat{grid-template-rows:auto 1fr}
.f-9x16 .t-quote{padding:0 2%}
.f-9x16 .txt:has(.mascot.inline){padding-right:calc(var(--u)*17)}
.f-9x16 .mascot.inline{position:absolute;right:0;top:0;margin:0}

/* ---- 1:1 ---- */
.f-1x1{--capsize:3.9;--chipsize:2.6;--tagsize:2.4;--btnsize:3.8;--logosize:18}
.f-1x1 .brand{left:calc(var(--u)*5);top:calc(var(--u)*4.2)}
.f-1x1 .prog{left:calc(var(--u)*4);right:calc(var(--u)*4);top:calc(var(--u)*2)}
.f-1x1 .cap{bottom:calc(var(--u)*3.5)}
.f-1x1 .in{left:calc(var(--u)*6);right:calc(var(--u)*6);top:calc(var(--u)*10.5);bottom:calc(var(--u)*15)}
.f-1x1 .t-title.has-vis,.f-1x1 .t-split,.f-1x1 .t-bullets,.f-1x1 .t-stat{grid-template-rows:auto 1fr}
.f-1x1 .t-title.no-vis{align-content:center}
.f-1x1 .t-feature{grid-template-rows:auto auto 1fr;gap:calc(var(--u)*2)}
.f-1x1 .t-feature .tags{display:none}
.f-1x1 .t-feature .chips{justify-content:center}
.f-1x1 .stats{grid-auto-flow:column;grid-auto-columns:1fr}
.f-1x1 .txt:has(.mascot.inline){padding-right:calc(var(--u)*16)}
.f-1x1 .mascot.inline{position:absolute;right:0;top:0;margin:0;width:calc(var(--u)*13)}

/* ---- motion vocabulary ---- */
.a-up{animation:up .7s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
.a-rise{animation:rise .9s cubic-bezier(.2,.8,.2,1) both;animation-delay:var(--d,0s)}
.a-pop{animation:pop .55s cubic-bezier(.3,1.5,.5,1) both;animation-delay:var(--d,0s)}
.a-hl{animation:hl .5s ease both;animation-delay:var(--d,0s)}
.a-cursor{animation:cursor 2.6s cubic-bezier(.5,0,.2,1) both;animation-delay:var(--d,0s)}
.a-ripple{animation:ripple 1s ease-out both;animation-delay:var(--d,0s)}
@keyframes up{from{opacity:0;transform:translateY(calc(var(--u)*3))}}
@keyframes rise{from{opacity:0;transform:translateY(calc(var(--u)*6)) scale(.94)}}
@keyframes pop{from{opacity:0;transform:scale(.4)}}
@keyframes hl{from{opacity:0;transform:scale(1.15)}to{opacity:1;transform:none}}
@keyframes cursor{0%{opacity:0;transform:translate(calc(var(--u)*-18),calc(var(--u)*14))}15%{opacity:1}75%{transform:none}82%{transform:scale(.82)}90%,100%{opacity:1;transform:none}}
@keyframes ripple{0%{opacity:0;transform:scale(.2)}10%{opacity:1}100%{opacity:0;transform:scale(1.7)}}
@keyframes float{50%{transform:translateY(calc(var(--u)*-1.4))}}
@keyframes blink{0%,94%,100%{transform:scaleY(1)}97%{transform:scaleY(.1)}}
@keyframes twinkle{50%{opacity:.08}}
@keyframes drift{to{transform:translate(12%,-8%)}}
@keyframes sc-fade{from{opacity:0}}
@keyframes sc-slide{from{opacity:0;transform:translateX(calc(var(--u)*8))}}
@keyframes sc-zoom{from{opacity:0;transform:scale(1.06)}}
`;
