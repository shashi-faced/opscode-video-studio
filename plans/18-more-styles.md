# Plan 18: More video styles and formats

Status (2026-11-13): **M1–M4 released as v0.17.0; M5 released as v0.18.0. M6 released as v0.19.0. M7 (app gallery) done; v0.19.1 has the watercolor title fix and the tile scenes.** M8 not started.

## 0. M1–M3 as built

- **Styles for every look** (`src/art/styles.mjs`): each style has a `base` (stickman, 2d, motion); `styleBase()`; a style name in `look` or `art` picks the right look. CSS is scoped `#stage.st-<id>`. New: `whiteboard`, `chalkboard` (stickman), `kinetic` (motion), `flat-vector` (2d), with aliases ("whiteboard animation", "kinetic typography", "flat design", "chalk").
- **Per-video variety** (`src/art/variety.mjs`): a seed from `seed|title|style` picks the entrance, transition set, accent pair, backdrop, ground, kinetic moves and flat decoration. The same storyboard renders the same; 8 titles give at least 6 different looks (tested). A user-set accent wins.
- **Formats** (`src/compiler/formats.mjs`, schemas in `spec.mjs`): `rank`, `fact`, `myth`, `quiz`, `poll`, `chat`, with aliases ("top 10", "did you know", "trivia", "would you rather", "whatsapp" → generic chat). Reveals follow the voice: quiz answer after the countdown, truth at the second sentence, poll results after the voice, chat messages spread over the speech with typing dots. The timeline adds `afterVoice` and `minDuration`, and word times per scene.
- **Whiteboard and chalkboard draw-on** (`runtime.js` `planDraw`/`drawAt`, `src/compiler/draw.mjs`): each block is revealed line by line (figures and icons top-down) inside the voice's time span, with a marker or chalk hand following the pen. Normal entrances are off in these styles; format reveals keep working.
- **Kinetic typography**: narration words grouped into beats of up to 3 words, each with its own move, *starred* words in the accent colour; scenes with characters keep their picture.
- **Agent guide**: `video_templates` takes `format` and returns the style notes and that format's recipe (`src/formats-guide.mjs`); the agent prompt has a "STYLES AND FORMATS" section.
- **Tests**: `test/styles-formats.test.mjs` (14, including a Chrome test of the hand reveal); full suite **182/182**. Tests no longer read the user's saved ElevenLabs key (`test/setup.mjs`).
- **Checked by eye** on rendered contact sheets: whiteboard, chalkboard, kinetic and flat-vector, Hindi and English, 9:16 and 16:9, every format.
- **M4 data and documentary**: `chart` (bar, line, pie, race; numbers count up via `data-cu` in runtime.js), `timeline`, `map` (Natural Earth 1:110m via world-atlas in `src/data/`, ~200 cities, Hindi names, pins, routes, view fitted to the frame), `news` (generic lower third and ticker), style `documentary`. Items light up when the narration names them (`cueTimes`). Recipes `data`, `documentary`, `news`. Tests: `test/data-templates.test.mjs`. Full suite 194/194.
- **M5 looks batch 2** (`src/art/looks2.mjs`, seed in `src/art/seed.mjs`): `neon` (stickman, glowing; synthwave sun, horizon and rolling grid), `horror` (stickman; desaturated dark, fog, flicker, grain, heavy vignette, creeping zoom of the whole scene, whispered lower-case captions), `retro-pixel` (2D; pictures pixelated by an SVG filter, mono text with hard shadows, motion in steps, pixel stars and ground), `paper-cutout` (2D; torn paper layers and shapes, stop-motion jitter, white sticker edges, paper texture), `watercolor` (2D; painted washes, paint-edged backgrounds and characters, paper grain, serif titles), `comic` (2D; tilted panel with halftone, action lines, outlined characters, narration boxes, oval bubbles, and a new scene field `sfx` for a "POW!" burst), `isometric` (2D; a platform of rising blocks with data flowing between them, placed beside text, faint behind lists and small on centred scenes). Each has 4–5 accent pairs for per-video variety; scenery per scene is seeded and seeked, so frames repeat exactly. Aliases (synthwave, spooky, 8-bit, collage, storybook, comic book, 2.5d…); "horror" now means the horror look, not the survival thriller. Guide notes, "pick by mood" hint and prompt updated. Tests: `test/looks2.test.mjs` (7, one in Chrome). Full suite **201/201**. Rendered and checked: every look in its own format (9:16, 16:9, 1:1) with title, story, quiz or steps, and cta; horror and retro pixel in Hindi 9:16 with voice. Watercolor renders slowest (about 4× real time) because of its paint filters.
- **M6, 3D presets and two formats**: styles `clay` and `low-poly` (base `3d`; a style name in `look` or `art` sets look "3d"). The 3D engine (`world3d.js`, `SPEC.preset`) swaps every toon material for a physical one after a scene is built: clay is matte with a seeded fingerprint bump texture, low-poly is flat-shaded with coarse versions of the shared shapes (heads, bodies, spheres, cylinders). No outlines in either; the ground light is kept near neutral so faces stay warm. Formats: `post` (a generic forum-style post card read out over our own moving background, votes and comments counting up; aliases "reddit story", "pov", "forum post", with upvotes like "24.8k" read as numbers) and `beforeafter` ("after" first, then a wipe reveals "before" when the narration says it, settling as a labelled split; top/bottom in 9:16; aliases "before and after", "transformation", "then and now", and "then"/"now" fields). Recipes `post` and `beforeafter`; prompt says never to name or imitate a real site. Tests: `test/m6.test.mjs` (6, one in Chrome). Full suite **207/207**. Rendered and checked: plain, clay and low-poly 3D side by side; post and before/after in English 16:9 (clay text scenes) and Hindi 9:16 with voice.
- **M7, app gallery** (app repo): all 24 styles are tiles with their own 4-second preview from `scripts/style-previews.mjs` (which now has a sample scene for every style), in tabs All, Hand-drawn, Flat & clean, Retro & fun, Cinematic and 3D; a Format chips row (11 formats) that asks the agent for that recipe; 3D character and place pickers show for clay and low-poly; 2D character picker stays for 2D styles. The Store points at v0.19.0. Checked in the browser on a temporary page; `tests/video_styles_gallery_qa_test.js` 8/8. Engine fix found on the way: watercolor story titles are light with a soft shadow (dark ink was unreadable on painted scenery).
- **Known gaps**: Natural Earth draws Kashmir along de facto lines, not India's official boundary; maps for Indian audiences may need official boundary data. Flat-vector dialogue and story scenes still use the old illustrated backgrounds; the app gallery has no tiles or Format chips yet (M7).

## 1. Goal

The user picks from a much larger gallery: not just "what it looks like" but also "how the video is told". Every new choice is free (drawn by our own engine, no API key) and works in Hindi and English, 9:16 and 16:9, with voice, captions and music as today.

## 2. What exists today

- **Looks:** `2d` cartoon, `3d`, `stickman` (10 art styles), plus the HyperFrames motion-design engine.
- **Scene templates (10):** title, feature, bullets, split, stat, quote, story, dialogue, steps, cta.
- **Video types (8):** ad, demo, explainer, story, reel, howto, greeting, announcement.
- **App gallery:** 10 stickman tiles, a disabled "Character Explainer", and the Look cards (cartoon, motion, text, photo, 3D, faceless).

## 3. What the research says (read 2026-11-12)

Sources: tubelab.net (30 niches, 8 formats), videogenie.io (niche → style), adwave.com (15 explainer styles), virvid.ai (6 viral Shorts structures), easyviral.ai (8 patterns of viral faceless Shorts).

- **A style is two choices stacked:** the *visual treatment* (whiteboard, paper cut-out, motion graphics…) and the *narrative format* (countdown, myth vs truth, story with a reveal…). We build both and let them combine.
- **Most-used explainer looks:** 2D animated, whiteboard, motion graphics, kinetic typography, data and stat-driven, character-driven, how-it-works, comparison, problem-solution.
- **Most-used short-form structures:** story hook and reveal, countdown, rapid-fire facts, myth vs truth, before and after, POV or forum-post narration. Also quizzes and on-screen text stories.
- **Highest-paying faceless niches** (finance, tech, history, true crime, science) lean on data visuals, maps and timelines, and cinematic or documentary moods.
- **Hook rule:** the first second carries picture, on-screen text and voice together; no greetings. Text sits in the middle, clear of the platform's buttons.
- **Platform risk (important):** YouTube now demonetises or removes "templated" and "reused" faceless content, and asks for disclosure of realistic synthetic media. **Every style must vary from video to video** (layout, colour accents, motion and transitions chosen per video from a seed), so two videos in one style do not look like copies.

## 4. The new visual styles (12)

All drawn in code by our engine, so they are free. "Base" is the character system each one uses.

| # | Style | What it looks like | Made for | Base |
|---|---|---|---|---|
| V1 | **Whiteboard** | White board; a hand with a marker draws each line and word as the voice speaks; black ink with one colour accent | Teaching, step-by-step logic, B2B explainers | stickman + props |
| V2 | **Chalkboard** | Dark green or slate board, chalk texture and dust; hand-lettered titles | School topics, maths, science | stickman + props |
| V3 | **Paper cut-out / collage** | Layered paper shapes with soft shadows and torn edges; pieces slide and flap in; slight jitter | Stories, history, finance explainers | 2D characters, paper skin |
| V4 | **Flat vector** | Clean geometric shapes, flat colours, simple characters, smooth easing | Tech, SaaS, finance explainers | 2D characters |
| V5 | **Isometric** | 3/4-angle blocks: buildings, servers, desks, flows between them | How-it-works, systems, logistics | new iso props + 2D icons |
| V6 | **Kinetic typography** | The words are the picture: word-by-word on the beat of the voice, size and weight for emphasis | Quotes, motivation, manifestos, sound-off feeds | motion (no characters) |
| V7 | **Neon / synthwave** | Dark, glowing lines, grid horizon, slight bloom | Tech, gaming, futurism, "what if" | stickman (glow head) or motion |
| V8 | **Retro pixel** | Pixel-art frames, chunky text, 8-bit sound cues | Gaming, nostalgia, fun facts | pixelated render of 2D characters |
| V9 | **Comic panels** | Panel grid, speech bubbles, halftone dots, action lines, "POW" words | Stories, satire, kids, before and after | 2D or stickman inside panels |
| V10 | **Watercolor storybook** | Soft painted paper texture, pastel washes, rounded serif titles | Kids stories, bedtime, festivals | 2D characters, paint skin |
| V11 | **Documentary / cinematic** | Dark grade, slow pushes on maps and photos, film grain, serif titles, lower thirds | History, true crime, business stories | motion + maps + user photos |
| V12 | **Horror / mystery** | Desaturated, flicker, vignette, creeping zooms, whisper-style captions | Creepy facts, unsolved mysteries | stickman (hollow) or motion |

**3D presets** (with the existing 3D engine): **Clay** (soft plasticine material, rounded light) and **Low-poly** (flat-shaded facets).

Painted, AI-illustrated looks stay in plan 14 Phase 3 (needs a Gemini key).

## 5. The new formats (10)

Formats are new scene templates plus a "recipe" (what order, how long, where the hook goes). Any format can use any visual style.

| # | Format | How it is told | Template(s) |
|---|---|---|---|
| F1 | **Countdown / Top N** | "5 … 4 … 3 … 2 … 1", each item a little stronger, number 1 last | `rank` |
| F2 | **Rapid-fire facts** | One fact every 4–6 s, numbered, no filler | `fact` |
| F3 | **Myth vs truth** | "MYTH" stamped, then crossed out, then "TRUTH" with the evidence | `myth` |
| F4 | **Quiz / trivia** | Question, 3–4 options, a ticking countdown, then the answer lights up | `quiz` |
| F5 | **Would you rather / poll** | Two choices side by side, then the "results" bar | `poll` |
| F6 | **Chat story** | A message thread appears bubble by bubble with a typing indicator; generic chat look, no real app's branding | `chat` |
| F7 | **Post story (POV)** | A forum-style post card is read out, then the story plays; generic design, no real site's branding; our own looping background, never game footage | `post` |
| F8 | **Before / after** | The "after" first, then a wipe back to "before", then the steps | `beforeafter` |
| F9 | **Map and timeline** | Country or world map with a route line, pins and labels; a timeline that scrolls through years | `map`, `timeline` |
| F10 | **Data chart** | Bar, line, pie, and a bar-chart race, with numbers counting up | `chart` |

Also a **newsroom** layout (headline bar, lower third, ticker) for news-style updates, as a variant of `title` and `feature`.

## 6. How it fits in the engine

- **One style system for every look** (it is stickman-only today). A style becomes `{ base, palette, fonts, texture, line, motion, transitions, captions, music, sfx }`:
  - texture: paper, chalk, grain, scanlines, halftone, watercolor;
  - line: clean, wobbly, chalk, marker;
  - motion: entrances and easing;
  - captions, music and sfx are defaults the user can still change.

  The 10 stickman styles move into it unchanged. `art.style` works with `look: 2d`, `stickman`, `motion` and `3d`.
- **Per-video variety:** a seed from the title picks layout variants, accent colour, transition set and entrance mix inside the style. The same storyboard renders the same; different videos differ.
- **Whiteboard and chalkboard draw-on:** strokes are drawn along their path in time with the voice's word timings, with a hand or chalk cursor following the pen tip. This builds on the props' existing draw-on.
- **Maps:** Natural Earth 1:110m country shapes (public domain), bundled as a small file. India states at 1:50m for Indian topics. Pins and routes by country name or lat/lon.
- **Charts:** our own SVG charts in the page (no library). Numbers count up; a bar race comes from a small table in the storyboard.
- **Validator:** new templates with fix hints. Aliases ("top 10" → `rank`, "whatsapp chat" → `chat` with a generic look, "whiteboard animation" → style `whiteboard`).
- **Agent guide:** `video_templates` returns the chosen style's short guide and the format's recipe, under 3 KB each, with one complete example.

## 7. App changes

- The Video style gallery grows from 10 tiles to about 24 (12 new looks, 2 3D presets). Each has a 4-second preview rendered by our engine (`scripts/style-previews.mjs`).
- A new **Format** row under the gallery, as chips with a small icon: Countdown, Facts, Myth vs truth, Quiz, Would you rather, Chat story, Post story, Before/after, Map & timeline, Chart, News.
- "Try this example" gives an example topic per style and per format.

## 8. Phases

| Phase | What | Size |
|---|---|---|
| **M1** | One style system for all looks; move the 10 stickman styles in; per-video variety seed; tests that two videos in one style differ | 1 day |
| **M2** | Formats for short-form: countdown, rapid-fire facts, myth vs truth, quiz, would you rather, chat story | 2 days |
| **M3** | Looks batch 1: whiteboard (hand draw-on synced to the voice), chalkboard, kinetic typography, flat vector | 2 days |
| **M4** | Documentary and data: map, timeline, charts (bar, line, pie, race), newsroom layout, documentary look | 2 days |
| **M5** | Looks batch 2: paper cut-out, comic panels, neon, retro pixel, watercolor, horror, isometric | 2.5 days |
| **M6** | 3D presets: clay and low-poly; post story and before/after formats | 1 day |
| **M7** | App: bigger gallery, Format chips, previews; release; eval | 1 day |
| **M8** | Eval: every style × 3 formats, Hindi and English, 9:16 and 16:9; contact sheets; no extra questions; render times | 1 day |

M1–M3 give the most-asked-for pieces first (whiteboard and the viral short-form formats). Release v0.17.0 after M3, v0.18.0 after M6.

## 9. Done when

- Each new style and format renders from "Try this example" with voice, captions and music, in Hindi and English, 9:16 and 16:9, without extra questions.
- Two videos in the same style and format look clearly different (layout, colour accents, motion).
- The gallery shows every style with a real preview from our engine.
- All existing tests pass; each new template has validator tests and a render test.

## 10. Rules and risks

- **No imitation:** no real app's chat look, no forum's branding, no specific YouTube channel's style, no game footage. Generic designs only. (The reference repo's GIFs are not bundled, as in plan 15.)
- **Licences:** fonts OFL, map data public domain, music and sound effects our own.
- **Effort risk:** whiteboard draw-on timed to the voice and the map module are the hardest parts; they get their own tests.
- **Too many choices:** the gallery groups styles (Hand-drawn, Flat & clean, Retro & fun, Cinematic, 3D) and keeps "Let the agent choose" as the first tile.
