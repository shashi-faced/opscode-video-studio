// Browser runtime: layout (text fit + media sizing), frame-exact seek, preview playback, QA inspect.
(() => {
  const TL = JSON.parse(document.getElementById('timeline').textContent);
  const stage = document.getElementById('stage');
  const U = 10.8;
  const sceneEls = [...stage.querySelectorAll('.scene')];
  const amb = stage.querySelector('.amb');
  const capEl = stage.querySelector('.cap span');
  const bars = [...stage.querySelectorAll('.prog i')];
  let cur = -1, lastCap = null;
  const popCaps = stage.classList.contains('cap-pop');

  // Numbers that count (plan 18 M4): data-cu="t:value|t:value" in seconds from the scene start.
  const counters = sceneEls.map((el) => [...el.querySelectorAll('[data-cu]')].map((c) => {
    const dec = +c.dataset.dec || 0;
    const nf = new Intl.NumberFormat(c.dataset.loc || 'en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: c.dataset.grp !== '0' });
    return { b: c.querySelector('b'), nf, stops: c.dataset.cu.split('|').map((x) => x.split(':').map(Number)), last: null };
  }));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  function countAt(i, t) {
    for (const c of counters[i]) {
      const s = c.stops;
      let v = s[0][1];
      if (t >= s[s.length - 1][0]) v = s[s.length - 1][1];
      else for (let k = 1; k < s.length; k++) {
        if (t < s[k][0]) { if (t > s[k - 1][0]) { const f = (t - s[k - 1][0]) / (s[k][0] - s[k - 1][0]); v = s[k - 1][1] + (s[k][1] - s[k - 1][1]) * (s.length > 2 ? f : ease(f)); } else v = s[k - 1][1]; break; }
      }
      const txt = c.nf.format(v);
      if (txt !== c.last) { c.b.textContent = txt; c.last = txt; }
    }
  }

  function fitOne(el, scale) {
    const base = +el.dataset.max * U;
    const max = base * scale, lines = +el.dataset.lines || 2, lh = +el.dataset.lh || 1.1, min = base * 0.38;
    let s = max;
    el.style.lineHeight = lh;
    for (let k = 0; k < 40; k++) {
      el.style.fontSize = s + 'px';
      const tooTall = el.offsetHeight > lines * lh * s * 1.04 + 1;
      const tooWide = el.scrollWidth > el.clientWidth + 1;
      if ((!tooTall && !tooWide) || s <= min) break;
      s = Math.max(min, s * 0.95);
    }
    el.dataset.fit = (s / base).toFixed(3);
  }

  function sizeMedia(scene) {
    for (const frame of scene.querySelectorAll('.frame')) {
      const box = frame.parentElement; // .media
      const aspect = +frame.dataset.aspect || 1.6;
      const bar = frame.querySelector('.bar');
      const barH = bar ? bar.offsetHeight : 0;
      const W = box.clientWidth, H = box.clientHeight;
      if (!W || !H) { frame.style.width = W ? W + 'px' : '60%'; continue; }
      const w = Math.max(10, Math.min(W, (H - barH) * aspect));
      frame.style.width = w + 'px';
    }
  }

  function layoutScene(scene) {
    const fits = [...scene.querySelectorAll('.fit')];
    const inner = scene.querySelector('.in');
    const mediaBox = scene.querySelector('.media');
    let scale = 1;
    // Story scenes are full-bleed pictures: only their text boxes need fitting.
    if (inner && inner.classList.contains('no-scale')) {
      fits.forEach(el => fitOne(el, 1));
      scene.dataset.scale = '1';
      return;
    }
    // Collapse images while measuring text, so a large picture can't push text out.
    for (const f of scene.querySelectorAll('.frame')) f.style.width = '8px';
    for (let k = 0; k < 12; k++) {
      fits.forEach(el => fitOne(el, scale));
      const over = inner.scrollHeight > inner.clientHeight + 2 || inner.scrollWidth > inner.clientWidth + 2;
      const squashed = mediaBox && !stage.classList.contains('f-16x9') && mediaBox.clientHeight < inner.clientHeight * 0.32;
      if (!over && !squashed) break;
      scale *= 0.92;
    }
    scene.dataset.scale = scale.toFixed(3);
    sizeMedia(scene);
  }

  // ---------- whiteboard / chalkboard: a hand draws each block in turn (plan 18) ----------
  const drawOn = stage.classList.contains('draw-on');
  const hand = stage.querySelector('.wb-hand');
  const drawPlan = [];   // per scene: [{ el, x, y, w, h, lines, t0, t1, clip }]
  const DRAW_SEL = '.fit, .chwrap, .st-prop, .num, .tick, .frame, .fmt-icon, .qz-l, .my-tag, .pl-or, .rk-num, .stripe, .button, .chip, .tag, .badge, .avatar, .logo, .qz-timer';
  function planDraw(i) {
    const scene = sceneEls[i];
    const sr = stage.getBoundingClientRect(), k = stage.offsetWidth / (sr.width || 1);
    const sc = TL.scenes[i];
    const items = [];
    if (scene.querySelector('.t-chat, .t-kinetic')) { drawPlan[i] = items; return; }
    for (const el of scene.querySelectorAll(DRAW_SEL)) {
      // Speech bubbles, captions and anything that appears at a reveal (truth card, quiz answer) keep their own timing.
      if (el.closest('.bubble, .cap, .my-truth, .qz-explain, .pl-pct, .pl-bar') || items.some(it => it.el.contains(el))) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const isText = el.classList.contains('fit');
      const len = (el.textContent || '').trim().length;
      const lh = isText ? (parseFloat(getComputedStyle(el).fontSize) || 20) * (+el.dataset.lh || 1.15) * (1 / k) : 0;
      const lines = isText ? Math.max(1, Math.round(r.height / Math.max(1, lh))) : 1;
      const d = isText ? Math.min(1.9, Math.max(0.45, 0.3 + len * 0.035)) : el.classList.contains('chwrap') ? 1.0 : el.classList.contains('frame') ? 1.2 : el.classList.contains('st-prop') ? 0.7 : 0.45;
      const down = /\b(chwrap|st-prop|fmt-icon|avatar|logo)\b/.test(el.className.baseVal ?? el.className);
      items.push({ el, x: (r.left - sr.left) * k, y: (r.top - sr.top) * k, w: r.width * k, h: r.height * k, lines, d, down, clip: null });
    }
    // Draw in order, starting just after the scene starts; follow the voice when there is one.
    const gap = 0.06;
    let total = items.reduce((n, it) => n + it.d + gap, 0);
    const voiceSpan = sc.parts && sc.parts.length ? sc.parts[sc.parts.length - 1].end - sc.start - 0.15 : 0;
    let f = 1;
    if (voiceSpan > 0 && total < voiceSpan * 0.7) f = Math.min(2, (voiceSpan * 0.7) / total);
    if (total * f > sc.duration * 0.85) f = (sc.duration * 0.85) / total;
    let t = 0.15;
    for (const it of items) { it.t0 = t; it.t1 = t + it.d * f; t = it.t1 + gap * f; }
    drawPlan[i] = items;
  }
  function setClip(it, v) { if (it.clip !== v) { it.el.style.clipPath = v; it.clip = v; } }
  function drawAt(i, t) {
    const items = drawPlan[i];
    if (!items) return;
    let pen = null;
    for (const it of items) {
      if (t < it.t0) { setClip(it, 'inset(0 100% 0 0)'); continue; }
      if (t >= it.t1) { setClip(it, ''); continue; }
      const p = (t - it.t0) / (it.t1 - it.t0);
      if (it.lines > 1) {
        // Line by line: earlier lines whole, the current one up to the pen.
        const line = Math.min(it.lines - 1, Math.floor(p * it.lines));
        const q = p * it.lines - line;
        const top = (line / it.lines) * 100, bot = ((line + 1) / it.lines) * 100, x = q * 100;
        setClip(it, `polygon(0 0,100% 0,100% ${top}%,${x}% ${top}%,${x}% ${bot}%,0 ${bot}%)`);
        pen = { x: it.x + q * it.w, y: it.y + (line + 0.75) * (it.h / it.lines) };
      } else if (it.down) {
        // Figures and icons: drawn from the top down, the pen moving side to side like shading.
        setClip(it, `inset(0 0 ${(100 - p * 100).toFixed(2)}% 0)`);
        const zig = Math.abs(((p * 7) % 2) - 1);
        pen = { x: it.x + it.w * (0.2 + 0.6 * zig), y: it.y + p * it.h };
      } else {
        setClip(it, `inset(0 ${(100 - p * 100).toFixed(2)}% 0 0)`);
        pen = { x: it.x + p * it.w, y: it.y + it.h * 0.62 };
      }
    }
    if (!hand) return;
    if (pen) {
      hand.style.display = 'block';
      hand.style.left = pen.x.toFixed(1) + 'px';
      hand.style.top = pen.y.toFixed(1) + 'px';
      hand.dataset.last = `${pen.x}|${pen.y}`;
    } else {
      // Between blocks the hand waits where it stopped; after the last block it leaves the board.
      const last = items.length ? items[items.length - 1].t1 : 0;
      const waiting = items.some(it => t < it.t0) && t > 0.15;
      hand.style.display = waiting || (t < last + 0.25 && t >= last) ? 'block' : 'none';
    }
  }

  async function layout() {
    await document.fonts.ready;
    await Promise.all([...stage.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    for (const scene of sceneEls) {
      scene.classList.add('on');
      layoutScene(scene);
      if (drawOn) planDraw(sceneEls.indexOf(scene));
      scene.classList.remove('on');
    }
  }

  function sceneAt(ms) {
    const i = TL.scenes.findIndex(s => ms < s.end * 1000);
    return i < 0 ? TL.scenes.length - 1 : i;
  }

  // Speaking characters move their mouths; each line's bubble pops in and stays until the next.
  function speech(i, ms) {
    const sc = TL.scenes[i], el = sceneEls[i];
    const parts = sc.parts || [];
    if (!parts.length) return;
    const t = ms / 1000;
    for (const w of el.querySelectorAll('.chwrap')) {
      const who = w.dataset.who;
      const p = parts.find(p => p.kind === 'line' && p.who === who && t >= p.start && t < p.end);
      w.classList.toggle('talking', !!p);
      // Mouth shape from the line's viseme track (stickmen draw one mouth per shape).
      let vis = '';
      if (p && p.visemes) for (const [vt, shape] of p.visemes) { if (vt <= t) vis = shape; else break; }
      if (w.dataset.vis !== vis) w.dataset.vis = vis;
    }
    const lines = parts.filter(p => p.kind === 'line');
    lines.forEach((p, k) => {
      const b = el.querySelector(`.bubble[data-line="${p.line}"]`);
      if (!b) return;
      const until = k + 1 < lines.length ? lines[k + 1].start - 0.05 : sc.end;
      const a = Math.max(0, Math.min(1, (t - p.start + 0.12) / 0.25));
      const on = t >= p.start - 0.12 && t < until;
      const e = 1 - Math.pow(1 - a, 3);
      b.style.opacity = on ? String(a) : '0';
      b.style.transform = `translateX(-50%) scale(${on ? (0.7 + 0.3 * e).toFixed(3) : 0.7})`;
      b.style.transformOrigin = `var(--tail) 100%`;
    });
  }

  // 3D look: the world module draws scene i and reports where each character's head is on screen;
  // speech bubbles follow the heads (the camera moves, so fixed bubble positions would drift).
  let world = null;
  function place3d(i, heads) {
    const el = sceneEls[i];
    const W = stage.offsetWidth, H = stage.offsetHeight;
    const cs = getComputedStyle(stage);
    const safeTop = parseFloat(cs.getPropertyValue('--st')) || 0;
    for (const b of el.querySelectorAll('.bubble')) {
      const h = heads[b.dataset.who];
      if (!h) continue;
      const bw = (parseFloat(b.style.width) || 40) / 100 * W;
      const half = bw / 2 / W * 100;
      const left = Math.min(100 - half - 2, Math.max(half + 2, h.x));
      const tail = Math.min(86, Math.max(14, 50 + ((h.x - left) / (bw / W * 100)) * 100));
      // Above the head, but never above the top of the frame.
      const bh = b.offsetHeight || 80;
      const bottom = Math.min(H - h.y + 24, H - bh - Math.max(24, safeTop));
      // Rounded so a slow camera move changes the text layer only every few frames (fast capture caches it).
      b.style.left = (Math.round(left * 2) / 2).toFixed(1) + '%';
      b.style.bottom = (Math.round(Math.max(20, bottom) / 8) * 8) + 'px';
      b.style.setProperty('--tail', (Math.round(tail * 2) / 2).toFixed(1) + '%');
    }
  }

  function seek(ms) {
    const i = sceneAt(ms);
    const sc = TL.scenes[i];
    if (i !== cur) { sceneEls.forEach((el, k) => el.classList.toggle('on', k === i)); cur = i; }
    speech(i, ms);
    const local = Math.max(0, ms - sc.start * 1000);
    if (world) {
      const heads = world.seek(i, local);
      stage.classList.toggle('on3d', !!heads);
      if (heads) place3d(i, heads);
    }
    for (const a of sceneEls[i].getAnimations({ subtree: true })) { a.pause(); a.currentTime = local; }
    if (drawOn) drawAt(i, local / 1000);
    if (counters[i].length) countAt(i, local / 1000);
    if (amb) for (const a of amb.getAnimations({ subtree: true })) { a.pause(); a.currentTime = ms; }
    let capObj = null;
    for (const c of sc.captions) if (ms >= c.start * 1000 && ms < c.end * 1000) capObj = c;
    const cap = capObj ? capObj.html : '';
    if (capEl && cap !== lastCap) { capEl.innerHTML = cap; lastCap = cap; }
    if (capEl && capObj && capObj.words) {
      // Light up the word being spoken; earlier words stay lit (karaoke).
      const t = ms / 1000;
      const ws = capEl.querySelectorAll('.w');
      let on = -1;
      capObj.words.forEach(([a], k) => { if (t >= a) on = k; });
      ws.forEach((w, k) => { w.classList.toggle('on', k === on); w.classList.toggle('past', k < on); });
      if (popCaps) {
        const a = Math.max(0, Math.min(1, (t - capObj.start) / 0.14));
        capEl.style.transform = `scale(${(0.82 + 0.18 * (1 - Math.pow(1 - a, 3))).toFixed(3)})`;
      }
    }
    bars.forEach((b, k) => {
      const s = TL.scenes[k];
      b.style.width = k < i ? '100%' : k > i ? '0%' : Math.min(100, (ms - s.start * 1000) / (s.duration * 10)) + '%';
    });
  }

  // ---------- fast capture (3D scenes) ----------
  // A 3D frame is the WebGL canvas plus the HTML text layer (titles, bubbles, captions). The text layer
  // changes only now and then, so it is captured once as a transparent image (by the renderer, through
  // a screenshot) and reused; each frame is then composed here and encoded as JPEG without a screenshot.
  const w3d = document.getElementById('w3d');
  let overlay = null, overlayKey = null, comp = null, compCtx = null;
  const round3 = (x) => Math.round(x * 1000) / 1000;
  function layerKey(i) {
    if (!w3d || !stage.classList.contains('on3d')) return null;
    const el = sceneEls[i];
    const anims = [];
    for (const a of el.getAnimations({ subtree: true })) {
      const ct = a.effect && a.effect.getComputedTiming();
      if (!ct || ct.iterations === Infinity) return null;   // endless CSS animation: no caching
      const p = ct.progress ?? -1;
      // Text still animating in: this frame's layer is used once, so a plain screenshot is cheaper.
      if (p > 0 && p < 1) return null;
      anims.push(round3(p));
    }
    const bubbles = [];
    for (const b of el.querySelectorAll('.bubble')) {
      const op = parseFloat(b.style.opacity || '1');
      if (op > 0.001 && op < 0.999) return null;           // bubble popping in
      bubbles.push([op > 0.5 ? 1 : 0, b.style.transform, b.style.left, b.style.bottom, b.style.getPropertyValue('--tail')].join('|'));
    }
    if (capEl && capEl.style.transform && !/scale\(1(\.0+)?\)/.test(capEl.style.transform)) return null;   // pop caption growing
    const words = capEl ? [...capEl.querySelectorAll('.w')].map(w => (w.classList.contains('on') ? 2 : w.classList.contains('past') ? 1 : 0)).join('') : '';
    return JSON.stringify([i, capEl ? capEl.innerHTML : '', capEl ? capEl.style.transform : '', words, bubbles, anims]);
  }
  function grab(ms, q) {
    seek(ms);
    const key = layerKey(cur);
    if (key == null) return { mode: 'shot' };
    if (key !== overlayKey) return { mode: 'overlay', key };
    return { mode: 'jpeg', data: compose(q) };
  }
  function overlayMode(on) {
    document.documentElement.classList.toggle('ovl', on);
  }
  async function setOverlay(b64, key) {
    const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
    if (overlay && overlay.close) overlay.close();
    overlay = await createImageBitmap(blob, { premultiplyAlpha: 'none' });
    overlayKey = key;
  }
  function barRects() {
    if (!bars.length || getComputedStyle(stage.querySelector('.prog')).display === 'none') return [];
    const sr = stage.getBoundingClientRect();
    return bars.map(b => {
      const r = b.parentElement.getBoundingClientRect();
      return { x: r.left - sr.left, y: r.top - sr.top, w: r.width * Math.min(1, (parseFloat(b.style.width) || 0) / 100), h: r.height, color: getComputedStyle(b).backgroundColor };
    });
  }
  function compose(q) {
    // Fastest: draw the text layer inside WebGL and encode the WebGL canvas directly.
    if (world && world.composite) return world.composite(overlay, barRects(), q);
    const W = stage.offsetWidth, H = stage.offsetHeight;
    if (!comp) { comp = document.createElement('canvas'); comp.width = W; comp.height = H; compCtx = comp.getContext('2d'); }
    compCtx.drawImage(w3d, 0, 0, W, H);
    if (overlay) compCtx.drawImage(overlay, 0, 0);
    // Progress bar fills change every frame, so they are drawn here rather than in the cached layer.
    if (bars.length && getComputedStyle(stage.querySelector('.prog')).display !== 'none') {
      const sr = stage.getBoundingClientRect();
      for (const b of bars) {
        const pct = parseFloat(b.style.width) || 0;
        if (pct <= 0) continue;
        const r = b.parentElement.getBoundingClientRect();
        compCtx.fillStyle = getComputedStyle(b).backgroundColor;
        compCtx.beginPath();
        compCtx.roundRect(r.left - sr.left, r.top - sr.top, r.width * Math.min(1, pct / 100), r.height, Math.min(9, r.height / 2));
        compCtx.fill();
      }
    }
    return comp.toDataURL('image/jpeg', q).slice(23);
  }

  // ---------- QA ----------
  const NAMES = [['.kicker', 'kicker'], ['.headline', 'headline'], ['.subline', 'subline'], ['.quote', 'quote'], ['.chips', 'chips'], ['.tags', 'tags'],
    ['.frame', 'image'], ['.mascot', 'mascot'], ['.list', 'items'], ['.stats', 'stats'], ['.badges', 'badges'], ['.button', 'button'], ['.logo', 'logo'], ['.who', 'author'],
    ['.chwrap', 'character'], ['.bubble', 'bubble'], ['.storytext', 'story text'], ['.storytitle', 'title'], ['.steps', 'steps']];
  // Characters may overlap each other, captions and scenery; bubbles never show together.
  const SOFT = new Set(['mascot', 'character']);
  const nameOf = (el) => (NAMES.find(([sel]) => el.matches(sel)) || [, 'element'])[1];
  const area = (r) => Math.max(0, r.width) * Math.max(0, r.height);
  const inter = (a, b) => area({ width: Math.min(a.right, b.right) - Math.max(a.left, b.left), height: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });

  function inspect() {
    const issues = [];
    const sr = stage.getBoundingClientRect();
    TL.scenes.forEach((sc, i) => {
      // Settle: after the last entry animation, before the scene ends.
      const settle = Math.min(sc.start + sc.duration * 0.92, sc.start + 3.6) * 1000;
      seek(settle);
      const scene = sceneEls[i];
      const add = (check, element, message, extra = {}) => issues.push({ scene: i, template: sc.template, check, element, message, ...extra });
      for (const el of scene.querySelectorAll('.fit')) {
        const r = +el.dataset.fit;
        if (r < 0.62) add('text-too-long', nameOf(el), `text had to shrink to ${Math.round(r * 100)}% to fit`, { severity: r < 0.5 ? 'error' : 'warning', chars: el.textContent.length });
      }
      if (+scene.dataset.scale < 0.75) add('crowded', 'scene', `the scene content had to shrink to ${Math.round(+scene.dataset.scale * 100)}%`, { severity: 'warning' });
      const parts = NAMES.flatMap(([sel]) => [...scene.querySelectorAll(sel)]).filter(el => el.offsetParent !== null && !el.closest('.chips,.tags,.list,.stats,.badges,.who,.storytitle,.steps,.bubble') || ['chips', 'tags', 'items', 'stats', 'badges', 'author', 'title', 'steps', 'bubble'].includes(nameOf(el)));
      const uniq = [...new Set(parts)].filter(el => !parts.some(p => p !== el && p.contains(el)));
      const rects = uniq.map(el => ({ el, name: nameOf(el), r: el.getBoundingClientRect() }));
      for (const { name, r } of rects) {
        if (area(r) < 4) continue;
        if (r.left < sr.left - 2 || r.top < sr.top - 2 || r.right > sr.right + 2 || r.bottom > sr.bottom + 2) add('off-stage', name, `${name} goes outside the video frame`, { severity: 'error' });
      }
      // Text under the platform's own buttons and captions (Reels/Shorts safe zone).
      if (stage.dataset.platform) {
        const cs = getComputedStyle(stage), px = (v) => parseFloat(cs.getPropertyValue(v)) || 0;
        const st = px('--st'), sb = px('--sb'), sl = px('--sl'), srr = px('--sr'), srf = px('--srf');
        for (const { name, r } of rects) {
          if (SOFT.has(name) || name === 'image' || area(r) < 4) continue;
          const y0 = r.top - sr.top, y1 = r.bottom - sr.top, x0 = r.left - sr.left, x1 = r.right - sr.left;
          const where = y0 < st - 4 ? 'top' : y1 > sr.height - sb + 4 ? 'bottom' : x0 < sl - 4 ? 'left' : (x1 > sr.width - srr + 4 && y1 > srf) ? 'right' : '';
          if (where) add('in-unsafe-zone', name, `the ${name} is in the ${where} area that ${stage.dataset.platform} covers with its own buttons or text`, { severity: 'warning', side: where });
        }
      }
      for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
        const A = rects[a], B = rects[b];
        // Text or a bubble covering a character's face matters; anything else may overlap characters.
        const ch = A.name === 'character' ? A : B.name === 'character' ? B : null;
        const other = ch === A ? B : A;
        if (ch && other.name !== 'character' && ['title', 'story text', 'headline', 'kicker'].includes(other.name)) {
          const cov = inter(ch.r, other.r) / Math.max(1, area(ch.r));
          if (cov > 0.06) add('covers-character', other.name, `the ${other.name} covers a character`, { severity: 'warning' });
          continue;
        }
        if (SOFT.has(A.name) || SOFT.has(B.name)) continue;
        if (A.name === 'bubble' && B.name === 'bubble') continue;
        const ov = inter(A.r, B.r) / Math.max(1, Math.min(area(A.r), area(B.r)));
        if (ov > 0.08) add('overlap', `${A.name}+${B.name}`, `${A.name} overlaps ${B.name} (${Math.round(ov * 100)}%)`, { severity: ov > 0.25 ? 'error' : 'warning' });
      }
      // Caption vs content: show the longest caption of the scene.
      if (capEl && sc.captions.length) {
        const longest = sc.captions.reduce((x, y) => (y.html.length > x.html.length ? y : x));
        capEl.innerHTML = longest.html; lastCap = null;
        const cr = capEl.getBoundingClientRect();
        const lh = parseFloat(getComputedStyle(capEl).lineHeight) || 40;
        if (cr.height > lh * 2.6 + 30) add('caption-long', 'caption', 'a caption runs to 3+ lines', { severity: 'warning' });
        for (const { name, r } of rects) {
          if (SOFT.has(name)) continue;
          const ov = inter(cr, r) / Math.max(1, area(cr));
          if (ov > 0.1) add('caption-overlap', name, `the caption covers the ${name}`, { severity: 'warning' });
        }
      }
      for (const img of scene.querySelectorAll('img')) if (!img.naturalWidth) add('missing-image', 'image', `image did not load: ${img.getAttribute('src')}`, { severity: 'error' });
      // 3D camera checks: the speaker must be visible while speaking; shot sizes should vary.
      const shots = world && world.plan ? world.plan(i) : null;
      if (shots) {
        const W = stage.offsetWidth, H = stage.offsetHeight;
        for (const p of (sc.parts || []).filter(x => x.kind === 'line')) {
          const mid = ((p.start + p.end) / 2 - sc.start) * 1000;
          const heads = world.seek(i, mid);
          const h = heads && heads[p.who];
          const shot = shots.find(x => mid / 1000 < x.end) || shots.at(-1);
          if (shot && shot.reaction) continue;
          if (!h || !h.onScreen || h.x < 2 || h.x > 98 || h.y < H * 0.02 || h.y > H * 0.98) add('speaker-off-screen', 'character', `"${p.who}" speaks line ${p.line + 1} but is off screen in the ${shot ? shot.type : ''} shot`, { severity: 'warning', fix: 'set the line\'s "shot" to two-shot or medium, or the scene "camera" to wide' });
        }
        const SIZE = { 'extreme-wide': 0, establish: 0, wide: 1, full: 2, 'two-shot': 3, medium: 3, follow: 3, 'over-shoulder': 4, 'medium-close': 4, close: 5, 'extreme-close': 6 };
        for (let k = 2; k < shots.length; k++) {
          const a = SIZE[shots[k - 2].type], b = SIZE[shots[k - 1].type], c = SIZE[shots[k].type];
          if (a != null && a === b && b === c) { add('same-shot-size', 'camera', `three ${shots[k].type} shots in a row`, { severity: 'warning', fix: 'vary the "shot" of one of these lines' }); break; }
        }
        seek(Math.min(sc.start + sc.duration * 0.92, sc.start + 3.6) * 1000);
      }
      for (const f of scene.querySelectorAll('.frame')) {
        const r = f.getBoundingClientRect();
        if (r.width < sr.width * 0.35 && r.height < sr.height * 0.35) add('tiny-image', 'image', `the screenshot is shown small (${Math.round(r.width)}×${Math.round(r.height)} px)`, { severity: 'warning' });
      }
    });
    cur = -1;
    return issues;
  }

  // ---------- preview playback ----------
  const params = new URLSearchParams(location.search);
  const rendering = params.has('render');
  let playing = false, t0 = 0, pos = 0;
  function frame(now) {
    if (playing) { pos = (now - t0) % (TL.duration * 1000); seek(pos); }
    requestAnimationFrame(frame);
  }
  function play() { playing = true; t0 = performance.now() - pos; }
  function pause() { playing = false; }
  function fitWindow() {
    const s = Math.min(innerWidth / stage.offsetWidth, (innerHeight - 40) / stage.offsetHeight);
    stage.style.transform = `scale(${s})`; stage.style.transformOrigin = '0 0';
    document.body.style.height = stage.offsetHeight * s + 'px';
    document.body.style.width = stage.offsetWidth * s + 'px';
  }

  const ready = layout().then(async () => {
    if (window.__worldReady) world = await window.__worldReady;
    seek(0);
    if (!rendering) {
      fitWindow(); addEventListener('resize', fitWindow);
      stage.addEventListener('click', () => (playing ? pause() : play()));
      play(); requestAnimationFrame(frame);
    }
    return true;
  });

  window.__video = { timeline: TL, duration: TL.duration, ready, seek, play, pause, inspect, grab, overlayMode, setOverlay, compose };
})();
