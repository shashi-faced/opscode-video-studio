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

  async function layout() {
    await document.fonts.ready;
    await Promise.all([...stage.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
    for (const scene of sceneEls) {
      scene.classList.add('on');
      layoutScene(scene);
      scene.classList.remove('on');
    }
  }

  function sceneAt(ms) {
    const i = TL.scenes.findIndex(s => ms < s.end * 1000);
    return i < 0 ? TL.scenes.length - 1 : i;
  }

  function seek(ms) {
    const i = sceneAt(ms);
    const sc = TL.scenes[i];
    if (i !== cur) { sceneEls.forEach((el, k) => el.classList.toggle('on', k === i)); cur = i; }
    const local = Math.max(0, ms - sc.start * 1000);
    for (const a of sceneEls[i].getAnimations({ subtree: true })) { a.pause(); a.currentTime = local; }
    if (amb) for (const a of amb.getAnimations({ subtree: true })) { a.pause(); a.currentTime = ms; }
    let cap = '';
    for (const c of sc.captions) if (ms >= c.start * 1000 && ms < c.end * 1000) cap = c.html;
    if (capEl && cap !== lastCap) { capEl.innerHTML = cap; lastCap = cap; }
    bars.forEach((b, k) => {
      const s = TL.scenes[k];
      b.style.width = k < i ? '100%' : k > i ? '0%' : Math.min(100, (ms - s.start * 1000) / (s.duration * 10)) + '%';
    });
  }

  // ---------- QA ----------
  const NAMES = [['.kicker', 'kicker'], ['.headline', 'headline'], ['.subline', 'subline'], ['.quote', 'quote'], ['.chips', 'chips'], ['.tags', 'tags'],
    ['.frame', 'image'], ['.mascot', 'mascot'], ['.list', 'items'], ['.stats', 'stats'], ['.badges', 'badges'], ['.button', 'button'], ['.logo', 'logo'], ['.who', 'author']];
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
      const parts = NAMES.flatMap(([sel]) => [...scene.querySelectorAll(sel)]).filter(el => el.offsetParent !== null && !el.closest('.chips,.tags,.list,.stats,.badges,.who') || ['chips', 'tags', 'items', 'stats', 'badges', 'author'].includes(nameOf(el)));
      const uniq = [...new Set(parts)].filter(el => !parts.some(p => p !== el && p.contains(el)));
      const rects = uniq.map(el => ({ el, name: nameOf(el), r: el.getBoundingClientRect() }));
      for (const { name, r } of rects) {
        if (area(r) < 4) continue;
        if (r.left < sr.left - 2 || r.top < sr.top - 2 || r.right > sr.right + 2 || r.bottom > sr.bottom + 2) add('off-stage', name, `${name} goes outside the video frame`, { severity: 'error' });
      }
      for (let a = 0; a < rects.length; a++) for (let b = a + 1; b < rects.length; b++) {
        const A = rects[a], B = rects[b];
        if (A.name === 'mascot' || B.name === 'mascot') continue;
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
          if (name === 'mascot') continue;
          const ov = inter(cr, r) / Math.max(1, area(cr));
          if (ov > 0.1) add('caption-overlap', name, `the caption covers the ${name}`, { severity: 'warning' });
        }
      }
      for (const img of scene.querySelectorAll('img')) if (!img.naturalWidth) add('missing-image', 'image', `image did not load: ${img.getAttribute('src')}`, { severity: 'error' });
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

  const ready = layout().then(() => {
    seek(0);
    if (!rendering) {
      fitWindow(); addEventListener('resize', fitWindow);
      stage.addEventListener('click', () => (playing ? pause() : play()));
      play(); requestAnimationFrame(frame);
    }
    return true;
  });

  window.__video = { timeline: TL, duration: TL.duration, ready, seek, play, pause, inspect };
})();
