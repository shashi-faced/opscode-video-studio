# HyperFrames composition: the rules (draft for the H0 spike)

You write ONE file, `index.html`. It is a web page that is rendered to video frame by frame. Follow every rule; a checker rejects pages that break them.

## Structure
- Fixed canvas in pixels: 1080x1920 (9:16), 1920x1080 (16:9) or 1080x1080. Set `html, body` to exactly that size, `margin:0; overflow:hidden`.
- One root element: `<div id="root" data-composition-id="main" data-start="0" data-duration="TOTAL" data-width="W" data-height="H">`. TOTAL is the video length in seconds.
- Each scene is a direct child of root: `<section id="s1" class="clip" data-start="0" data-duration="5" data-track-index="0">`. The renderer shows a clip only between its start and start+duration. Scenes follow each other: the next `data-start` = previous start + duration. The last scene ends exactly at TOTAL.
- Style `.clip { position:absolute; inset:0; }`. Lay out content inside with flexbox. Keep text at least 80px from every edge. Body text 44px or larger, headlines 90px or larger.
- Load GSAP with exactly: `<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>` in `<head>`.

## Animation
- ONE timeline for the whole video, at the end of `<body>`:
  `const tl = gsap.timeline({ paused: true });` … `window.__timelines = window.__timelines || {}; window.__timelines["main"] = tl;`
- Use only `tl.set`, `tl.to`, `tl.from`, `tl.fromTo`, always with an absolute time in seconds as the last argument: `tl.from("#s2 h1", { opacity: 0, y: 60, duration: 0.6, ease: "power3.out" }, 5.2);`
- Times are in video seconds. Animate an element only while its scene is on screen (scene start ≤ time, and time + duration ≤ scene end).
- Animate only: opacity, x, y, scale, scaleX, scaleY, rotation, width, height.
- Never use: CSS `animation` or `transition`, `setTimeout`, `setInterval`, `requestAnimationFrame`, `Date`, `Math.random`, `repeat: -1`, `tl.play()`, video or image files you were not given.
- Every element you animate must have a unique `id` or a selector that matches only inside its scene (`#s2 .bar`).

## Look
- Pick 1 background colour, 1 text colour and 1 accent colour with strong contrast. Use `font-family: "Inter", sans-serif` (for Hindi: `"Noto Sans Devanagari", "Inter", sans-serif`).
- Draw shapes with plain `div`s or inline `<svg>`. Charts: bars are `div`s animated from `scaleY: 0` with `transform-origin: bottom`.
- Something should move at least every 2 seconds; never leave a scene static.
- The very first frame (0 s) must already show the title: do not fade the first headline in from opacity 0. Animate something else in scene 1 (a line, a subtitle, a gentle scale).

## Complete example (9:16, 8 seconds, 2 scenes)
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; background: #0b1020; font-family: "Inter", sans-serif; color: #f8fafc; }
  #root { position: relative; width: 1080px; height: 1920px; overflow: hidden; }
  .clip { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px; text-align: center; }
  h1 { font-size: 120px; font-weight: 800; line-height: 1.05; }
  h1 span { color: #fbbf24; }
  p { font-size: 52px; margin-top: 40px; opacity: 0.85; }
  .line { width: 400px; height: 10px; background: #fbbf24; margin-top: 50px; transform-origin: left; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="8" data-width="1080" data-height="1920">
  <section id="s1" class="clip" data-start="0" data-duration="4" data-track-index="0">
    <h1 id="s1-title">Drink more <span>water</span></h1>
    <div id="s1-line" class="line"></div>
  </section>
  <section id="s2" class="clip" data-start="4" data-duration="4" data-track-index="0">
    <h1 id="s2-title">8 glasses</h1>
    <p id="s2-text">Your brain is 75% water.</p>
  </section>
</div>
<script>
  const tl = gsap.timeline({ paused: true });
  tl.from("#s1-title", { scale: 0.92, duration: 0.8, ease: "power3.out" }, 0);
  tl.from("#s1-line", { scaleX: 0, duration: 0.6, ease: "power2.out" }, 1.0);
  tl.to("#s1-title", { scale: 1.06, duration: 1.6, ease: "sine.inOut" }, 2.0);
  tl.from("#s2-title", { opacity: 0, scale: 0.6, duration: 0.6, ease: "back.out(1.6)" }, 4.2);
  tl.from("#s2-text", { opacity: 0, y: 40, duration: 0.6, ease: "power2.out" }, 5.0);
  tl.to("#s2-title", { y: -20, duration: 1.4, ease: "sine.inOut" }, 6.2);
  window.__timelines = window.__timelines || {};
  window.__timelines["main"] = tl;
</script>
</body>
</html>
```

Reply with the complete `index.html` only, inside one ```html block.
