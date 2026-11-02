# Phase 2 — Compiler, templates and seekable timeline

Turns a validated storyboard plus a timeline (scene start/end, caption timings) into **one self-contained HTML file**. The same file is used for preview in a browser and for frame-exact rendering.

## Output
`<out>/build/index.html` with:
- inline CSS: theme tokens + template styles + animation keyframes;
- inline JS runtime (`runtime.js`) exposing `window.__video = { duration, seek(ms), play() }`;
- images copied into `build/assets/` (or inlined as data URIs when small).

## Stage and units
- Stage is a fixed pixel box: 1920×1080, 1080×1920 or 1080×1080.
- Everything inside is sized in **container units** (`cqw`), so templates have one layout per format, not per resolution.
- Each template has three layout variants selected by a class on the stage: `.f-16x9`, `.f-9x16`, `.f-1x1`.

## Themes
Presets are token sets: `--bg`, `--bg2`, `--ink`, `--muted`, `--accent`, `--accent2`, `--ok`, font roles.
- `night-saffron` (default; the Opscode ads), `clean-light`, `midnight-neon`, `corporate-blue`, `warm-paper`.
- `accent` override recolours emphasis, buttons, highlights.
- Fonts are bundled locally (`assets/fonts`) so rendering needs no network. Fallback stacks are always set.

## Templates
Each template is a function `(scene, ctx) → html` in `src/compiler/templates/*.js`. Rules every template follows:
- Uses only theme tokens.
- Every text slot is wrapped in `.fit` with a max box; the runtime shrinks the font until it fits (binary search on font-size, done once at load, before any frame is captured).
- Entry animations are declared with CSS `animation-delay` relative to the scene start.
- Images get a "window" frame (title bar dots) or a plain rounded card; tall images in a short box use a slow pan.

## Motion vocabulary (shared keyframes)
`rise`, `fade-up`, `pop`, `slide-in`, `fan`, `float` (infinite), `blink` (infinite), `twinkle`, `cursor-move`, `ripple`, `highlight-in`, `pan`, `typewriter`. Templates combine these; models never write keyframes.

## Mascots
Hand-built SVG characters in `src/compiler/mascots.js`: `robot` (Ops), `dev` (developer at laptop, moods happy/worried), `founder` (with phone). They blink and float. More can be added without touching templates.

## Captions
- Captions come from narration split into chunks of ≤ 7 words at punctuation.
- Each chunk's time is proportional to its character count inside the measured voice clip.
- `*emphasis*` in narration is shown in the accent colour.
- Position: bottom safe area (above platform UI in 9:16).

## Seekable runtime (key to determinism)
```
seek(ms):
  find scene i with start ≤ ms < end
  mark scene i .on, others off
  for every Animation in scene i (document.getAnimations):
      anim.pause(); anim.currentTime = ms - sceneStart   // infinite ones loop naturally
  progress bars, caption text = f(ms)
```
- `play()` drives `seek(performance.now() - t0)` with requestAnimationFrame for live preview.
- Because rendering calls `seek` per frame, output does not depend on machine speed.

## Done when
- `opscode-video preview examples/reel.json` writes `build/index.html`, which plays in a normal browser.
- Every template renders in all three formats without overflow on the long-text fixture.
