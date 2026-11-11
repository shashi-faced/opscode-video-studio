// The authoring rules for a HyperFrames composition, written for small models: short, exact, with one
// complete example. The starter project made by hyperframes_project is built from the same example.

export const FORMATS = {
  '9:16': { w: 1080, h: 1920, resolution: 'portrait' },
  '16:9': { w: 1920, h: 1080, resolution: 'landscape' },
  '1:1': { w: 1080, h: 1080, resolution: 'square' },
};

export function resolveFormat(f) {
  const s = String(f || '9:16').toLowerCase().replace(/\s/g, '');
  if (/^(16:9|landscape|youtube|wide|horizontal)$/.test(s)) return '16:9';
  if (/^(1:1|square)$/.test(s)) return '1:1';
  return '9:16';
}

/** Fonts copied into every project (assets/fonts), so a video never needs the internet for type. */
export const PROJECT_FONTS = [
  { family: 'Poppins', weight: 600, file: 'poppins-latin-600-normal.woff2' },
  { family: 'Poppins', weight: 700, file: 'poppins-latin-700-normal.woff2' },
  { family: 'Hind', weight: 400, file: 'hind-latin-400-normal.woff2' },
  { family: 'Hind', weight: 600, file: 'hind-latin-600-normal.woff2' },
  { family: 'Hind', weight: 700, file: 'hind-latin-700-normal.woff2' },
  { family: 'Hind', weight: 400, file: 'hind-devanagari-400-normal.woff2', range: 'U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF' },
  { family: 'Hind', weight: 600, file: 'hind-devanagari-600-normal.woff2', range: 'U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20B9, U+25CC, U+A830-A839, U+A8E0-A8FF' },
];

/** assets/fonts.css: the font declarations, loaded by one line in the page (less for a model to copy). */
export const FONTS_CSS = PROJECT_FONTS.map((f) => `@font-face { font-family: "${f.family}"; font-weight: ${f.weight}; src: url("fonts/${f.file}") format("woff2");${f.range ? ` unicode-range: ${f.range};` : ''} }`).join('\n') + '\n';
export const FONTS_LINK = '<link rel="stylesheet" href="assets/fonts.css" />';

/** A complete, valid starter composition: 2 scenes, 8 seconds. */
export function starterHtml(format = '9:16') {
  const { w, h } = FORMATS[resolveFormat(format)];
  const head = w > h ? 150 : 120, body = w > h ? 56 : 52;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<script src="assets/gsap.min.js"></script>
${FONTS_LINK}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${w}px; height: ${h}px; overflow: hidden; background: #0b1020; font-family: "Hind", sans-serif; color: #f8fafc; }
  #root { position: relative; width: ${w}px; height: ${h}px; overflow: hidden; }
  .clip { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 100px; text-align: center; }
  h1 { font-family: "Poppins", "Hind", sans-serif; font-size: ${head}px; font-weight: 700; line-height: 1.1; }
  h1 span { color: #fbbf24; }
  p { font-size: ${body}px; margin-top: 40px; opacity: 0.85; }
  .line { width: 400px; height: 10px; background: #fbbf24; margin-top: 50px; transform-origin: left; }
</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="8" data-width="${w}" data-height="${h}">
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
`;
}

export function guideText(format = '9:16') {
  const f = resolveFormat(format);
  const { w, h } = FORMATS[f];
  return `# HyperFrames video: how to write it

A HyperFrames video is ONE web page, \`index.html\`, rendered to video frame by frame. Use it for motion design: kinetic text, product and feature launches, animated charts, numbered steps, quotes. For characters, stories, 3D or stickman videos use the storyboard tools (video_templates, video_render) instead.

## Steps
1. hyperframes_project { action: "init", dir: "my-video", format: "${f}" } makes the project with a working starter index.html.
2. If the video has a voice-over (most do): hyperframes_voice { dir, lines: ["one spoken sentence per scene", …] }. It makes the voice (Hindi or English), music and captions, and returns the exact data-start and data-duration of every scene and the 3 lines to paste. Build the page to those times. Without a voice, choose the times yourself (3 to 5 seconds a scene).
3. Rewrite index.html with write_file. Keep its structure; change scenes, text, style and timeline.
4. hyperframes_check { dir }. Fix every error with edit_file and check again until it passes.
5. hyperframes_preview { dir, at: [1, 5, 9] } and LOOK at the frames: text readable, nothing cut off or overlapping.
6. hyperframes_render { dir }.

## Structure rules
- Canvas is fixed in pixels: ${w}x${h} for ${f} (9:16 = 1080x1920, 16:9 = 1920x1080, 1:1 = 1080x1080). \`html, body\` exactly that size, \`margin:0; overflow:hidden\`.
- One root: \`<div id="root" data-composition-id="main" data-start="0" data-duration="TOTAL" data-width="${w}" data-height="${h}">\`. TOTAL = video length in seconds.
- Each scene is a direct child of root: \`<section id="s1" class="clip" data-start="0" data-duration="4" data-track-index="0">\`. It is shown only from its start to start + duration. Scenes follow each other with no gaps; the last one ends exactly at TOTAL.
- \`.clip { position:absolute; inset:0; }\` and flexbox inside. Keep text 80px or more from every edge. Headlines 90px or larger, other text 44px or larger.
- The head keeps exactly these two lines: \`<script src="assets/gsap.min.js"></script>\` and \`<link rel="stylesheet" href="assets/fonts.css" />\`. Never load scripts, fonts or images from the internet.
- Sound and captions come from hyperframes_voice: paste the lines it gives you (an \`<audio>\` and \`<div id="captions">\` as the last children of root, and \`<script src="assets/captions.js"></script>\` after the timeline script). With captions on, keep your own text out of the bottom 30% of a 9:16 frame (20% of 16:9). Never write an <audio> for a file that does not exist in assets/.
- Screen text is short (a headline, a number, 2 to 5 words); the full sentence is spoken and shown by the captions. Do not repeat the whole spoken line on screen.

## Animation rules
- ONE timeline at the end of body: \`const tl = gsap.timeline({ paused: true });\` … \`window.__timelines = window.__timelines || {}; window.__timelines["main"] = tl;\`
- Only \`tl.set\`, \`tl.to\`, \`tl.from\`, \`tl.fromTo\`, always with the absolute time in video seconds as the last argument: \`tl.from("#s2-title", { opacity: 0, y: 60, duration: 0.6, ease: "power3.out" }, 4.2);\`
- Animate an element only while its scene is on screen. Animate only opacity, x, y, scale, scaleX, scaleY, rotation, width, height.
- Never use CSS \`animation\` or \`transition\`, \`setTimeout\`, \`setInterval\`, \`requestAnimationFrame\`, \`Date\`, \`Math.random\`, \`repeat: -1\`, \`tl.play()\`.
- Every animated element has a unique id.
- Frame 0 must already show the title: do not fade the first headline in from opacity 0. Animate its scale, or another element.
- Something moves at least every 2 seconds.

## Look
- 1 background colour, 1 text colour, 1 accent colour, strong contrast.
- Fonts: only "Poppins" (headlines, weights 600 and 700) and "Hind" (all other text and all Hindi, weights 400 and 600). Keep the line \`<link rel="stylesheet" href="assets/fonts.css" />\` in the head; it loads them. Any other font name is an error.
- Shapes are plain divs or inline svg. Chart bars are divs animated from \`scaleY: 0\` with \`transform-origin: bottom\`.
- Ready-made blocks (charts, kinetic titles, transitions): hyperframes_guide { search: "chart" }, then hyperframes_project { action: "add", dir, blocks: ["data-chart"] }.

## Starter (complete and valid)
\`\`\`html
${starterHtml(f)}\`\`\`
`;
}
