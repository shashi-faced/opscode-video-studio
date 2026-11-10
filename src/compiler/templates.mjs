// Template library. Each template returns scene inner HTML.
// Rules: only theme tokens, sizes in --u (1% of the stage's short side),
// text in .fit boxes (auto-shrunk by the runtime), entry delays via --d.
import { escapeHtml as esc, markup } from '../timeline.mjs';
import { mascotSvg } from './mascots.mjs';
import { characterSvg, CHARACTER_CSS, KIND_INFO } from './characters.mjs';
import { stickSvg, STICK_CSS, baseMood } from './stick.mjs';
import { sceneBackdrop, stickOptions, styleTheme } from '../art/styles.mjs';
import { propsHtml, PROP_CSS } from '../art/props.mjs';
import { backgroundHtml, BACKGROUND_CSS } from './backgrounds.mjs';

const fit = (tag, cls, html, max, lines, lh = 1.06, d = 0) =>
  `<${tag} class="fit ${cls}" data-max="${max}" data-lines="${lines}" data-lh="${lh}" style="--d:${d}s">${html}</${tag}>`;

// Font sizes (in u) per format: [16:9, 9:16, 1:1]
const SZ = {
  kicker: [2.3, 3.1, 2.8], hero: [11, 10.5, 9.5], head: [7.6, 9, 7.6], sub: [3.3, 4.2, 3.6],
  body: [3.2, 4.1, 3.5], item: [3.6, 4.4, 3.8], quote: [6.2, 7, 6], cta: [11, 12, 10], stat: [12, 13, 11],
  bubble: [3.2, 4.4, 3.7], stext: [3.4, 4.3, 3.7], stitle: [9.5, 10.5, 9],
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

// ---------- story scenes: background + characters + speech bubbles ----------
const STICK_KINDS = new Set(['boy', 'girl', 'man', 'woman', 'grandpa', 'grandma']);
const POS_X = [
  { 'far-left': 12, left: 27, center: 50, right: 73, 'far-right': 88 },   // 16:9
  { 'far-left': 18, left: 28, center: 50, right: 72, 'far-right': 82 },   // 9:16
  { 'far-left': 15, left: 28, center: 50, right: 72, 'far-right': 85 },   // 1:1
];
const SPREAD = [[50], [30, 70], [20, 50, 80], [14, 38, 62, 86]];
const SIZE = { small: 0.72, medium: 1, large: 1.22 };
const BUBBLE_W = [34, 66, 50];

/** Cast entry for a scene's "who": a cast id, a cast name or a character kind. */
export function resolveWho(who, ctx) {
  const key = String(who || '').toLowerCase();
  const c = ctx.cast?.get(key);
  if (c) return { ...c, id: c.id, name: c.name || c.id };
  const kind = KIND_INFO[key] ? key : 'rabbit';
  return { id: key, kind, name: key.charAt(0).toUpperCase() + key.slice(1) };
}

function placeCharacters(list, ctx) {
  const n = Math.min(list.length, 4);
  const crowd = ctx.fi === 0 ? 1 : n >= 3 ? 0.74 : n === 2 ? 0.9 : 1;
  return list.slice(0, 4).map((c, k) => {
    const who = resolveWho(c.who, ctx);
    const x = c.position ? POS_X[ctx.fi][c.position] : SPREAD[n - 1][k];
    const s = +(SIZE[c.size || 'medium'] * crowd).toFixed(3);
    const facing = c.facing || (x > 55 ? 'left' : 'right');
    return { ...c, who, x, s, facing };
  });
}

function storyScene(sc, ctx) {
  const lines = sc.lines || [];
  // Speakers who were not placed are added, so every bubble has someone to point at.
  const listed = [...(sc.characters || [])];
  for (const l of lines) if (!listed.some(c => String(c.who).toLowerCase() === String(l.who).toLowerCase())) listed.push({ who: l.who });
  let chars = placeCharacters(listed, ctx);
  // Stickmen are thin: drawn a little larger so faces read at phone size.
  if (!ctx.is3d?.(sc) && ctx.isStick?.(sc)) chars = chars.map(c => ({ ...c, s: +(c.s * 1.18).toFixed(3) }));
  const { ground, chh } = ctx.layout;
  // 3D look: the world module draws the place and the characters; this scene keeps its HTML text and bubbles.
  const is3d = ctx.is3d?.(sc);
  if (is3d) {
    ctx.world[ctx.index] = {
      background: sc.background || 'meadow', time: sc.time || 'day', camera: sc.camera || 'auto', template: sc.template, weather: sc.weather || 'none',
      characters: chars.map((c, k) => {
        const firstLine = lines.find(l => String(l.who).toLowerCase() === c.who.id);
        return { id: c.who.id, kind: c.who.kind, name: c.who.name, color: c.who.color || null, hair: c.who.hair || null, skin: c.who.skin || null,
          modelPref: c.who.design ? 'built-in' : c.who.model || 'auto', design: c.who.design || null, turn: c.turn ?? null, near: c.near || null, x: c.x, s: c.s, facing: c.facing, pose: c.pose || 'idle', mood: baseMood(c.mood || firstLine?.mood || 'happy'), enter: c.enter || 'none', delay: +(0.2 + k * 0.3).toFixed(2) };
      }),
      lines: lines.map(l => ({ who: String(l.who).toLowerCase(), mood: l.mood || null, shot: l.shot || null, q: /[?？]\s*$/.test(String(l.text || '')) })),
      // Film shots tell us the previous shot's place ("background|time"), so the director knows when to establish.
      prevPlace: sc._prevPlace ?? null,
    };
  }

  // Stickman look (plan 14): people are drawn as stickmen, animals and objects flat with an ink outline.
  const stick = !is3d && ctx.isStick?.(sc) ? stickOptions(ctx.art) : null;
  const charHtml = is3d ? '' : chars.map((c, k) => {
    const firstLine = lines.find(l => String(l.who).toLowerCase() === c.who.id);
    const mood = c.mood || firstLine?.mood || 'happy';
    const enter = c.enter && c.enter !== 'none' ? `enter-${c.enter}` : '';
    const from = c.x < 50 ? 'calc(var(--u)*-115)' : 'calc(var(--u)*115)';
    const svg = stick && STICK_KINDS.has(c.who.kind)
      ? stickSvg(c.who.kind, { ...stick, mood, pose: c.pose || 'idle', color: c.who.color, id: c.who.id })
      : characterSvg(c.who.kind, { mood, pose: c.pose || 'idle', color: c.who.color, hair: c.who.hair, skin: c.who.skin, flat: stick ? { ink: stick.ink } : null }, `c${ctx.index}_${k}`);
    return `<div class="chwrap ${enter}" data-who="${esc(c.who.id)}" style="left:${c.x}%;--s:${c.s};--d:${(0.2 + k * 0.3).toFixed(2)}s;--from:${from};--blink:-${(k * 1.37).toFixed(2)}s"><div class="chflip${c.facing === 'left' ? ' flip' : ''}">${svg}</div></div>`;
  }).join('');

  const bw = BUBBLE_W[ctx.fi];
  const bubbles = lines.map((l, k) => {
    const c = chars.find(x => x.who.id === String(l.who).toLowerCase()) || chars[0];
    const left = Math.min(100 - bw / 2 - 3, Math.max(bw / 2 + 3, c.x));
    const tail = Math.min(86, Math.max(14, 50 + ((c.x - left) / bw) * 100));
    const top = KIND_INFO[c.who.kind]?.plan === 'float' ? 0.72 : 0.86;
    const bottom = Math.round(ground + chh * c.s * top + 18);
    return `<div class="bubble" data-line="${k}" data-who="${esc(c.who.id)}" style="left:${left}%;width:${bw}%;bottom:${bottom}px;--tail:${tail.toFixed(1)}%"><b class="bname">${esc(c.who.name)}</b>${fit('div', 'btext', markup(l.text), sz('bubble', ctx), 4, 1.25)}</div>`;
  }).join('');

  const text = sc.text
    ? `<div class="storytext a-up${sc.headline ? ' below' : ''}" style="--d:${sc.headline ? 0.9 : 0.4}s">${fit('p', 'stext', markup(sc.text), sz('stext', ctx), 3, 1.3)}</div>` : '';
  // With a title, the story text flows right under it instead of sitting at a fixed height.
  const title = sc.headline
    ? `<div class="storytitle">${sc.kicker ? fit('div', 'kicker a-up', esc(sc.kicker), sz('kicker', ctx), 1, 1.2, 0.1) : ''}${fit('h1', 'headline a-pop', markup(sc.headline), sz('stitle', ctx), 2, 1.04, 0.25)}${text}</div>` : '';
  const t = stick ? styleTheme(ctx.art) : null;
  const props = is3d || !sc.props?.length ? '' : propsHtml(sc.props, { ink: t ? t.ink : '#2b2b33', accent: t ? t.accent : 'var(--accent)', accent2: t ? t.accent2 : 'var(--accent2)', ground: ctx.layout.ground, posX: POS_X[ctx.fi] });
  const backdrop = is3d ? '' : stick ? sceneBackdrop(ctx.art, sc) : backgroundHtml(sc.background || 'meadow', sc.time || 'day');
  return `<div class="in t-story no-scale${is3d ? ' w3d' : ''}${stick ? ' st-story' : ''}">${backdrop}${props}${charHtml}${bubbles}${title}${sc.headline ? '' : text}</div>`;
}

export const TEMPLATE_HTML = {
  story: storyScene,
  dialogue: storyScene,
  steps(sc, ctx) {
    const items = (sc.steps || []).map((st, j) => `<li class="a-up" style="--d:${(0.7 + j * 0.7).toFixed(2)}s"><span class="num">${j + 1}</span>${fit('span', 'item', markup(st), sz('item', ctx), 2, 1.25)}</li>`).join('');
    const vis = sc.image ? media(sc, ctx, { d: 0.3 }) : '';
    return `<div class="in t-steps ${vis ? 'has-vis' : 'no-vis'}"><div class="txt">${textBlock(sc, ctx)}${mascot(sc, ctx, 'inline')}</div><ol class="steps">${items}</ol>${vis}</div>`;
  },
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
.cap{position:absolute;z-index:6;left:var(--sl,0px);right:var(--sr,0px);display:flex;justify-content:center;pointer-events:none}
.cap span{max-width:86%;text-align:center;font:700 calc(var(--u)*var(--capsize)) / 1.25 var(--body);color:#fff;background:#0b0d26d9;padding:calc(var(--u)*1.1) calc(var(--u)*2.6);border-radius:calc(var(--u)*1.6);box-shadow:0 calc(var(--u)*.8) calc(var(--u)*2.4) #0007;text-wrap:balance}
.cap span:empty{display:none}
.cap mark{background:none;color:var(--accent)}
.cap .w{display:inline-block}
.cap-karaoke .cap .w{opacity:.5}.cap-karaoke .cap .w.past,.cap-karaoke .cap .w.on{opacity:1}.cap-karaoke .cap .w.on{color:var(--accent)}
.cap-pop .cap span{max-width:92%;background:none;box-shadow:none;padding:0;font:900 calc(var(--u)*var(--capsize)*1.5) / 1.12 var(--display);color:#fff;-webkit-text-stroke:calc(var(--u)*.55) #000;paint-order:stroke fill;text-shadow:0 calc(var(--u)*.5) calc(var(--u)*1.6) #000c;letter-spacing:.01em;transform-origin:50% 60%}
.cap-pop .cap .w{margin:0 .14em}.cap-pop .cap .w.on{color:#ffd23f;transform:scale(1.08)}.cap-pop .cap mark{color:#ffd23f}
.cap-middle .cap{bottom:auto !important;top:56%}
.cap-top .cap{bottom:auto !important;top:max(18%,calc(var(--st,0px) + var(--u)*8))}
.no-prog .prog{display:none}

.scene{position:absolute;inset:0;display:none}
.scene.on{display:block}
.in{position:absolute;display:grid;gap:calc(var(--u)*3);min-height:0;min-width:0}
.scene.tr-fade .in{animation:sc-fade .5s ease both}
.scene.tr-slide .in{animation:sc-slide .6s cubic-bezier(.2,.8,.2,1) both}
.scene.tr-zoom .in{animation:sc-zoom .7s cubic-bezier(.2,.8,.2,1) both}
.scene.tr-cut .in{animation:none}
#w3d{position:absolute;left:0;top:0;width:100%;height:100%;display:none}
#stage.on3d #w3d{display:block}
#stage.on3d .amb{visibility:hidden}
#stage.cine::before,#stage.cine::after{content:'';position:absolute;left:0;right:0;height:138px;background:#000;z-index:8;pointer-events:none}
#stage.cine::before{top:0}
#stage.cine::after{bottom:0}
#stage.cine .cap{z-index:9;bottom:34px !important}
#stage.cine .brand{z-index:9}
html.ovl,html.ovl body,html.ovl #stage{background:transparent !important}
html.ovl #w3d,html.ovl .amb,html.ovl .prog i{visibility:hidden !important}

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

/* ---- story, dialogue, steps ---- */
#stage .in.t-story{left:0;right:0;top:0;bottom:0;display:block;gap:0;overflow:hidden}
.bubble{position:absolute;z-index:4;transform:translateX(-50%);background:#fff;color:#1f1b2e;border-radius:calc(var(--u)*2.6);padding:calc(var(--u)*1.2) calc(var(--u)*2.2) calc(var(--u)*1.5);box-shadow:0 calc(var(--u)*.8) calc(var(--u)*2.6) #0005;opacity:0;font-family:var(--body);font-weight:600}
.bubble::after{content:'';position:absolute;left:var(--tail);bottom:calc(var(--u)*-1.7);margin-left:calc(var(--u)*-1.3);border-left:calc(var(--u)*1.3) solid transparent;border-right:calc(var(--u)*1.3) solid transparent;border-top:calc(var(--u)*1.9) solid #fff}
.bname{display:block;font:700 calc(var(--u)*1.8) var(--mono);color:var(--accent);letter-spacing:.08em;text-transform:uppercase;margin-bottom:calc(var(--u)*.3)}
.btext{margin:0}.btext mark{background:none;color:var(--accent)}
.storytitle{position:absolute;left:max(6%,var(--sl,0px));right:max(6%,var(--sr,0px));z-index:3;display:flex;flex-direction:column;align-items:center;text-align:center;gap:calc(var(--u)*1.2)}
.storytitle .headline{width:100%;color:#fff;text-shadow:0 0 calc(var(--u)*.35) #2a1640,0 calc(var(--u)*.45) 0 #2a1640,0 0 calc(var(--u)*3) #000a}
.storytitle .headline mark{color:#ffd23f}
.storytitle .kicker{color:var(--on-accent);background:var(--accent);padding:0 .9em;border-radius:99px;box-shadow:0 0 0 .32em var(--accent)}
.storytext{position:absolute;left:50%;transform:translateX(-50%);z-index:3;background:#fffaf0f2;color:#2d2a32;border-radius:calc(var(--u)*2.2);padding:calc(var(--u)*1.3) calc(var(--u)*2.8);box-shadow:0 calc(var(--u)*.6) calc(var(--u)*2.4) #0004;text-align:center}
.stext{margin:0;font-weight:600}.stext mark{background:none;color:var(--accent)}
.steps{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:calc(var(--u)*1.6);justify-content:center;min-height:0;min-width:0}
.steps li{display:flex;align-items:center;gap:calc(var(--u)*1.8);position:relative;background:var(--chip-bg);border:calc(var(--u)*.15) solid var(--card-edge);border-radius:calc(var(--u)*1.4);padding:calc(var(--u)*1.3) calc(var(--u)*2)}
.steps .num{flex:none;display:grid;place-items:center;width:calc(var(--u)*5);height:calc(var(--u)*5);border-radius:50%;background:var(--accent);color:var(--on-accent);font:700 calc(var(--u)*2.6) var(--display);box-shadow:0 0 0 calc(var(--u)*.7) color-mix(in srgb,var(--accent) 25%,transparent)}
.steps .item{flex:1;min-width:0;font-weight:600}
.storytitle .storytext.below{position:relative;left:auto;top:auto;transform:none;margin-top:calc(var(--u)*.8);width:auto;max-width:100%}
.f-16x9 .storytitle{top:max(calc(var(--u)*9),calc(var(--st,0px) + var(--u)*7))}.f-16x9 .storytext{top:max(calc(var(--u)*9),calc(var(--st,0px) + var(--u)*7));width:72%}.f-16x9 .storytitle .storytext.below{width:80%}
.f-9x16 .storytitle{top:max(calc(var(--u)*16),calc(var(--st,0px) + var(--u)*7))}.f-9x16 .storytext{top:max(calc(var(--u)*12),calc(var(--st,0px) + var(--u)*7));width:88%}.f-9x16 .storytitle .storytext.below{width:96%}
.f-1x1 .storytitle{top:max(calc(var(--u)*9),calc(var(--st,0px) + var(--u)*7))}.f-1x1 .storytext{top:max(calc(var(--u)*9),calc(var(--st,0px) + var(--u)*7));width:86%}.f-1x1 .storytitle .storytext.below{width:92%}
.f-16x9 .t-steps.no-vis{grid-template-columns:.85fr 1.15fr;align-items:center}
.f-16x9 .t-steps.has-vis{grid-template-columns:1fr 1.05fr;grid-template-rows:auto 1fr;align-items:center}
.f-16x9 .t-steps.has-vis .media{grid-column:2;grid-row:1/3;height:100%}
.f-9x16 .t-steps,.f-1x1 .t-steps{grid-template-rows:auto auto 1fr}
.f-1x1 .t-steps.no-vis{grid-template-rows:auto 1fr}
${CHARACTER_CSS}
${STICK_CSS}
${PROP_CSS}
${BACKGROUND_CSS}

/* ---- 16:9 ---- */
.f-16x9{--capsize:3.6;--chipsize:2.3;--tagsize:2.1;--btnsize:3.4;--logosize:17}
.f-16x9 .brand{left:max(calc(var(--u)*6),var(--sl,0px));top:max(calc(var(--u)*4.4),var(--st,0px))}
.f-16x9 .prog{left:calc(var(--u)*6);right:calc(var(--u)*6);top:calc(var(--u)*2)}
.f-16x9 .cap{bottom:max(calc(var(--u)*4),var(--sb,0px))}
.f-16x9 .in{left:max(calc(var(--u)*7),var(--sl,0px));right:max(calc(var(--u)*7),var(--sr,0px));top:max(calc(var(--u)*11),calc(var(--st,0px) + var(--u)*7));bottom:max(calc(var(--u)*15),calc(var(--sb,0px) + var(--u)*11))}
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
.f-9x16 .brand{left:max(calc(var(--u)*5),var(--sl,0px));top:max(calc(var(--u)*6),var(--st,0px))}
.f-9x16 .prog{left:calc(var(--u)*4);right:calc(var(--u)*4);top:calc(var(--u)*3)}
.f-9x16 .cap{bottom:max(calc(var(--u)*15),var(--sb,0px))}
.f-9x16 .in{left:max(calc(var(--u)*6),var(--sl,0px));right:max(calc(var(--u)*6),var(--sr,0px));top:max(calc(var(--u)*13),calc(var(--st,0px) + var(--u)*7));bottom:max(calc(var(--u)*31),calc(var(--sb,0px) + var(--u)*16))}
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
.f-1x1 .brand{left:max(calc(var(--u)*5),var(--sl,0px));top:max(calc(var(--u)*4.2),var(--st,0px))}
.f-1x1 .prog{left:calc(var(--u)*4);right:calc(var(--u)*4);top:calc(var(--u)*2)}
.f-1x1 .cap{bottom:max(calc(var(--u)*3.5),var(--sb,0px))}
.f-1x1 .in{left:max(calc(var(--u)*6),var(--sl,0px));right:max(calc(var(--u)*6),var(--sr,0px));top:max(calc(var(--u)*10.5),calc(var(--st,0px) + var(--u)*7));bottom:max(calc(var(--u)*15),calc(var(--sb,0px) + var(--u)*11.5))}
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
