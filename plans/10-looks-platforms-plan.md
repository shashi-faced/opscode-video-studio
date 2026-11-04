# Plan 10: Looks, platforms and characters (v0.3 → v0.5)

**Goal.** Before a video is made, the user picks:

- **Frame / platform:** Instagram Reel, YouTube, YouTube Shorts, Insta post, WhatsApp status and so on.
- **Look:** 2D cartoon, 3D, text-based, motion graphics or real images.
- **Video type:** ad, story, explainer and the rest (already in v0.2).
- **Characters:** picked from a gallery.

The engine keeps today's method throughout.

**Short answer: yes, the same method works for every look.** Today the engine writes the video as an HTML page, Chrome steps through it frame by frame, and ffmpeg encodes the frames. Every new look is one more kind of layer on that page, and each layer can jump to any time t:

| Look | What draws it in the page | How it jumps to time t |
|---|---|---|
| 2D cartoon (today) | SVG and CSS keyframes | `animation-delay` (already done) |
| Text-based | HTML text and CSS keyframes | same as today |
| Motion graphics | SVG, CSS and optional Lottie JSON | CSS seek and `lottie.goToAndStop(frame, true)` |
| Real images | `<img>` with CSS pan/zoom (Ken Burns) | CSS seek |
| 3D | three.js in a `<canvas>` (WebGL) | `seek(t)` sets every pose, then `renderer.render()` |
| Video clips (later) | ffmpeg composite under a transparent HTML layer | ffmpeg `-ss` / frame index |

### Tested on this machine (no GPU) on 2026-11-04

- Headless Chrome gives WebGL through SwiftShader on the CPU: *"ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero))"*. The current `--disable-gpu` flag still allows it.
- Test 3D scene: three.js r170 with 3 characters, 40 trees, shadows, fog and antialiasing.
  - It takes about 170 ms per frame at 1080×1920 and 160 ms at 1920×1080, with one Chrome.
  - That is about 5 s of rendering per second of video, so a 30 s reel takes about 2.5 min.
  - With 4 parallel workers (Phase F) it drops to about 40 s.
- For comparison, today's 2D render takes about 1.9 s per second of video.

So 3D is practical without a GPU as long as scenes stay low-poly. Photorealistic 3D, AI image generation and AI video are not practical here and are not in this plan.

---

## 1. The new storyboard fields

These are new top-level fields. Everything stays optional and the defaults come from `type`, so old storyboards keep working.

```jsonc
{
  "type": "story",
  "platform": "insta-reel",   // NEW: sets size, safe zones, length limit, caption style, extras
  "look": "3d",               // NEW: cartoon | 3d | text | motion | photo | mixed
  "cast": [ { "id": "miko", "kind": "rabbit", "outfit": "scarf", "color": "#f6a" } ],
  "scenes": [ { "template": "story", "look": "photo", ... } ]   // a scene may override look
}
```

`format` stays as a low-level override: `platform` sets it, and `format` wins if both are given.

### 1.1 Platforms (`src/schema/platforms.mjs`, new)

| id | Size | Max length | Safe zone (kept clear of app buttons) | Defaults | Extras |
|---|---|---|---|---|---|
| `youtube` | 1920×1080 | none (warn > 10 min) | 5% all sides | captions off, chapters on | thumbnail 1280×720 JPG, chapter list, title/description .txt |
| `youtube-short` | 1080×1920 | 3 min (warn > 60 s) | top 12%, bottom 22%, right 12% | big word-by-word captions | cover frame |
| `insta-reel` | 1080×1920 | 3 min (best 15–45 s) | top 14%, bottom 25%, right 14% | big word-by-word captions, fast cuts | cover frame (also exported as 1080×1350) |
| `insta-post` | 1080×1350 (4:5) | 60 s | 4% | captions on | — |
| `insta-story` / `whatsapp-status` | 1080×1920 | 60 s / 30 s per clip | top 12%, bottom 18% | captions on | splits into 30 s parts for WhatsApp |
| `square` | 1080×1080 | — | 4% | — | — |
| `linkedin` | 1920×1080 or 1080×1080 | 10 min | 5% | captions on (often watched muted) | — |

How it is built:

- `FORMATS` gains `4:5`.
- `compile.mjs` exposes `--safe-top/--safe-bottom/--safe-right`, and every template's layout reads them, so text is never hidden under Instagram's like/comment buttons.
- QA gets a new check, `in-unsafe-zone`: text or a face inside the reserved zone is flagged.
- The validator warns when the narration is longer than the platform allows.

### 1.2 Word-by-word captions (needed for reels)

- msedge-tts can send word timings (`wordBoundaryEnabled: true`), so `tts.mjs` stores `[{word, start, end}]` next to each cached WAV.
- `timeline.mjs` converts these to absolute times.
- The runtime then supports three caption styles:
  - `line`: today's style.
  - `karaoke`: the whole line is shown and the current word is highlighted.
  - `pop`: 1–3 words at a time, large and centred, the usual reel look.
- New field: `captions: { style: 'pop', position: 'middle' }`. The `true`/`false` form still works.

### 1.3 Looks (`src/schema/looks.mjs`, new)

Each look sets:

- which templates fit;
- the default theme, fonts and music;
- the scene transition;
- which background kinds are allowed.

| Look | Feel | Templates | Backgrounds |
|---|---|---|---|
| `cartoon` (2D) | Today's SVG characters and illustrated stages | story, dialogue + all | 14 illustrated |
| `3d` | Low-poly 3D world, soft shadows, camera moves | story3d, dialogue (3D stage), title3d, product3d | 3D stages (§3) |
| `text` | Kinetic typography, no pictures needed | kinetic, quote, list-reveal, stat, title | gradient, grain, paper, solid |
| `motion` | Flat shapes, icons, charts, lower thirds, logo reveal | title, icons, chart, timeline, compare, steps, cta, logo-reveal | animated shape fields |
| `photo` | Real photos, pan and zoom, text overlays | photo, photo-split, gallery, before-after, photo-quote, cta | the photos themselves (blurred fill) |
| `mixed` | Picks the look per scene (default for `ad` and `explainer`) | all | all |

---

## 2. The new looks in detail

### 2.1 Text-based (`look: text`)

Words appear in time with the voice. This is the fastest look to render and needs no assets.

- **New template `kinetic`.** It takes `lines[]`, and each line has an `effect`:
  - `slam`: scale from 300% with a slight shake;
  - `type`: typewriter;
  - `slide`;
  - `split`: letters fly in;
  - `highlight`: marker sweep;
  - `stack`: words stack;
  - `count`: number roll.
- **Timing.** When `words` timings exist, each word lands on the moment it is spoken. This is the "Apple keynote" or "Reels quote" style.
- **Fonts.** Four bundled OFL display fonts: Anton, Bebas Neue, Poppins ExtraBold, and Baloo 2 (Hindi and Latin). Together about 600 KB.
- **Backgrounds.** Animated gradient, film grain, paper texture, solid with accent shapes.
- **New template `list-reveal`.** "5 reasons…" lists, one item per voice line.

### 2.2 Motion graphics (`look: motion`)

New templates:

- **`icons`:** 3–6 icons with labels, staggered pop-in, a connector line drawing.
- **`chart`:** bar, line, donut or progress. Values animate from 0, and labels count up. Data comes straight from the storyboard. Drawn as plain SVG with no chart library.
- **`timeline`:** dated milestones on a line that draws itself.
- **`compare`:** two columns that wipe in (old vs new, us vs them).
- **`logo-reveal`:** a shape burst or line trace that resolves into `brand.logo` or the brand name.
- **`lower-third`:** a name or title bar, also usable as an overlay on photo scenes.

Assets and features:

- **Icons.** A Lucide subset of about 300 SVG icons (ISC licence, about 250 KB), embedded as inline SVG. The model picks icons by name, e.g. `"icon": "truck"`, and unknown names fall back to the closest match.
- **Lottie (optional).** Uses `lottie-web` (light SVG build, MIT, about 160 KB).
  - The user can drop any `.json` Lottie file into `lottie: "file.json"` on a scene.
  - The runtime calls `goToAndStop(frame, true)` on every seek, so playback is frame-exact.
  - We do not bundle third-party Lottie files, because of licence variety.
- **Shape fields.** Floating circles and lines that drift slowly, built with CSS keyframes and seekable like everything else.

### 2.3 Real images (`look: photo`)

Where pictures come from, tried in this order:

1. **The user's own files:** `image: "photos/shop.jpg"`, or a folder (`images: "photos/"`) that the engine assigns to scenes.
2. **Screenshots:** the existing `video_capture` tool.
3. **Free stock search with no API key:**
   - **Openverse** (`api.openverse.org`) for CC0 and CC-BY photos;
   - **Wikimedia Commons** for places, monuments and famous things.
4. **Optional, with a free key in settings:** Pexels (photos and video clips) and Unsplash. They give better commercial-style photos. Without a key they are skipped.

New tools:

- **`video_image_search(query, orientation)`:** returns 6 candidates with thumbnail, size, licence and author.
- **`video_image_fetch(id or url)`:**
  - downloads into `~/.opscode/cache/video-assets/` (deduplicated by hash);
  - records the licence;
  - returns the local path.
- **Credits.** For CC-BY images, the render writes a `credits.txt`. A small credits line is added on the last scene, or in the YouTube description file.

How photos are shown:

- **Smart crop.** `smartcrop.js` (MIT, about 10 KB) runs inside the Chrome page to find the best 9:16 or 16:9 crop, so a landscape photo becomes a good vertical frame. The crop centre also sets where the pan/zoom moves.
- **Ken Burns.** Each photo slowly zooms and pans (`motion: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "auto"`).
- **Blurred fill.** A photo that does not fill the frame sits on a blurred, darkened copy of itself.
- **Templates:**
  - `photo`: full-bleed photo with headline and narration;
  - `photo-split`: photo with text panel;
  - `gallery`: 2–4 photos;
  - `before-after`: slider wipe;
  - `photo-quote`.
- **QA.** Flags photos smaller than 60% of the frame (blurry) and text placed over busy areas of the photo (contrast check on the area behind the text).

Not in scope: background removal (rembg needs Python, onnxruntime and about 150 MB) and AI image generation (no GPU). Both can be optional add-ons later; §7 says how.

### 2.4 3D (`look: 3d`)

How it works:

- **Engine.**
  - three.js r170 (MIT, 676 KB minified), bundled in the package. It is never loaded from a CDN during render.
  - The page has one full-frame `<canvas>` under the HTML text layer, so headlines, bubbles and captions stay crisp HTML.
- **Seekable by design.**
  - The runtime calls `world.seek(ms)`, which sets every character pose, camera position and moving object from `t`, then renders once.
  - Nothing uses `requestAnimationFrame` or real time, and random numbers come from a seeded generator.
  - The result is the same frame every time, so the parallel render workers in Phase F can each draw their own part of the video.
- **Characters.**
  - CC0 animated glTF packs:
    - Quaternius "Ultimate Animated Character Pack" (people);
    - Quaternius "Animated Animals";
    - Kenney "Animated Characters" and "Mini Characters".
  - Each model is 100–600 KB and includes Idle, Walk, Run, Wave, Jump, Dance and Sit clips.
  - `AnimationMixer.setTime(t)` makes these clips seekable.
  - Mouth/talk: a jaw or head bob plus a speech bubble above the head, positioned by projecting the head into screen space.
- **Same cast field as 2D.** `kind: "rabbit"` maps to the 3D rabbit model. Where a kind has no 3D model, a stylised capsule character (the test scene) with the cast colour is used. One storyboard can therefore switch `look` between `cartoon` and `3d`.
- **Stages.** Built from primitives and Kenney CC0 nature, city and furniture kits, about 2–4 MB total:
  - meadow, forest, city street, classroom, room, beach, space, stage/studio, shop, temple courtyard;
  - each with day, sunset and night lighting.
- **Camera moves:** `camera: "wide" | "close" | "orbit" | "dolly-in" | "follow" | "over-shoulder"`. A dialogue scene cuts to a close shot of whoever is speaking.
- **`product3d`.** The user's logo or a product photo on a rotating box, phone, bottle or card mockup, for ads.
- **Asset delivery.** 3D assets are not in the npm package. They download once on first 3D use into `~/.opscode/cache/video-assets/3d/` (about 15 MB for the starter set, with checksums). `video_doctor` reports them.
- **Speed guard.**
  - Antialiasing comes from rendering at 1.0× and capturing as JPEG; there are no post-processing passes.
  - The shadow map is 1024 px, and there are at most 6 characters and about 50k triangles per scene.
  - QA warns when a frame takes more than 400 ms.

### 2.5 Characters (all looks)

- **One cast, every look.** `cast[]` stays the single source of truth, so the same Miko appears in 2D, in 3D, or as a photo-scene sticker.
- **New cast fields:**
  - `outfit`: shirt, saree, kurta, school, suit, chef, doctor, superhero, scarf;
  - `accessory`: glasses, cap, crown, bow, backpack;
  - `style`: cute or normal proportions.
  - These are applied in the SVG rig (2D) and by material/attachment swaps (3D).
- **Character gallery.**
  - `video_characters` (new tool, and a CLI command) renders a contact sheet of all kinds in 2D and 3D, returned as an image. The agent (or the app picker in §4) shows it, and the user taps who they want.
- **Consistency.** Each character keeps the same voice everywhere (already done), plus the same colour and outfit. A per-video "character sheet" frame is saved next to the render for reuse.

---

## 3. Engine changes (file by file)

| File | Change |
|---|---|
| `schema/spec.mjs` | `platform`, `look`, scene `look`, `captions` object, cast `outfit/accessory/style`, scene `camera`, `motion`, `lottie`, `icon`, `chart` fields; new templates |
| `schema/platforms.mjs` (new) | Platform table: size, safe zones, limits, defaults, extras |
| `schema/looks.mjs` (new) | Look recipes, like `types.mjs`; merged as type → look → platform defaults |
| `validate.mjs` | Resolve platform/look aliases ("reel", "insta", "yt", "shorts", "3D", "real photos", "motion graphics", "typography"); check templates fit the look; length vs platform |
| `compiler/layers/` (new) | `canvas3d.mjs` (three.js world builder), `photo.mjs`, `kinetic.mjs`, `motion.mjs`; each emits HTML/CSS and registers a `seek(ms)` |
| `compiler/runtime.js` | Layer registry: `seek` calls each layer's seek; await `layer.ready` (fonts, images, glTF) before frame 1; word-caption styles |
| `compiler/templates.mjs` | Split per look: `templates/2d.mjs`, `3d.mjs`, `text.mjs`, `motion.mjs`, `photo.mjs` (file is 355 lines now; it would pass 1500) |
| `audio/tts.mjs` | Word boundaries saved with the cache entry |
| `render/render.mjs` | Parallel workers (§5); extras: thumbnail, cover, chapters, credits, WhatsApp split |
| `assets/` (new) | `assets.mjs`: download on demand with checksum, licence record, cache; `stock.mjs`: Openverse, Commons, optional Pexels/Unsplash |
| `qa/check.mjs` | `in-unsafe-zone`, `low-res-photo`, `busy-text-background`, `slow-3d-frame`, `too-long-for-platform` |
| `docs.mjs` | `templatesDoc(type, look, platform)` returns only what that combination needs (see §6) |
| `tools.mjs` | `video_image_search`, `video_image_fetch`, `video_characters`; `video_templates` gains `look` and `platform` |

---

## 4. App UX (Opscode Agent)

The aim is that the user picks with taps and does not have to type settings.

1. **Option chips above the input box.** This is a generic app feature that any agent can use.
   - The agent manifest declares `inputChips`:
     ```json
     "inputChips": [
       { "id": "platform", "label": "Frame", "options": [["insta-reel","📱 Insta Reel 9:16"],["youtube","▶ YouTube 16:9"],["youtube-short","Shorts 9:16"],["insta-post","Post 4:5"],["square","1:1"]] },
       { "id": "look", "label": "Look", "options": [["cartoon","🎨 2D Cartoon"],["3d","🧊 3D"],["text","🔤 Text"],["motion","✨ Motion graphics"],["photo","📷 Real images"]] },
       { "id": "type", "label": "Type", "options": [["ad","Ad"],["story","Story"],["explainer","Explainer"],["howto","How-to"],["greeting","Greeting"],["announcement","News"]] }
     ]
     ```
   - The app shows each chip as a small dropdown next to the + button. Choices are saved per agent and per chat, and each message gets a short structured preface: `[Video settings] platform=insta-reel look=3d type=story`.
   - The system prompt says these settings override guesses from the text.
2. **Characters chip.**
   - Opens a gallery popover with 2D/3D thumbnails generated once by `video_characters` and cached.
   - Picked characters go into the preface as `cast=rabbit:Miko,owl:Grandpa`.
3. **Start screen cards** (when the chat is empty). Six ready-made combinations, each a single tap:
   - "Insta product reel";
   - "Kids story (3D)";
   - "YouTube explainer";
   - "Festival greeting";
   - "Quote reel (text)";
   - "Photo slideshow".
   - Each fills the chips and a prompt template.
4. **Hide the git bar for Video Studio.** Done 2026-11-04 as a per-agent "Git bar" switch in Input Box settings. It defaults to on only for Build, Plan and Explore, and git polling is skipped when the bar is hidden.
5. **Render progress and preview.**
   - The engine already prints progress, so the app turns those lines into a progress bar ("Rendering 3D frames 420/900").
   - Also shown: thumbnail and cover image, a credits line, and buttons for "Download for Instagram" and "Download for YouTube" (the extras from §1.1).

Files:

- `agentStoreTypes.ts`: `inputChips` field.
- `packageAgents.ts`: passes it through.
- `AgentChatPanel.tsx`: chip bar and preface.
- `agentSettingsStore.ts`: saved chip values.
- `InputBoxSettings.tsx`: a "Show option chips" switch.

---

## 5. Speed: parallel render

- **Workers.** Chrome pages are independent and every layer is seekable, so the frame range is split across N workers (default `min(4, cores/2)`):
  - each writes JPEG frames to its own ffmpeg segment (`-f mpegts`);
  - the segments are joined with the concat demuxer, with no re-encode;
  - audio is muxed once at the end.
- **Expected speed:**
  - 2D: about 0.6 s of rendering per second of video (from 1.9);
  - 3D: about 1.4 s per second of video (from about 5).
  - These are estimates from the single-worker numbers; Phase F will measure them.
- **Quick preview.** `video_preview` gains `quick: true`: 540p, 12 fps, 3 sample frames per scene, under 10 s, so the user can approve the look before the full render.
- **Memory.** About 250 MB per Chrome worker, so 4 workers is safe with 31 GB of RAM.

---

## 6. "Skills" for the agent: small focused references

Small free models do badly with one long reference.

- **Per-look guides.** One short style guide per look (`docs/looks/*.md`, each ≤ 3 KB). Each has the look's rules, its templates and one complete example. `video_templates({type, look, platform})` merges only the three relevant sections, aiming for under 8 KB.
- **Built-in good-video rules per look:**
  - **text:** ≤ 7 words on screen, one idea per scene;
  - **photo:** one subject per photo, search queries in English nouns;
  - **3d:** ≤ 4 characters, pick a camera per scene;
  - **motion:** numbers in charts must come from the user.
- **Example storyboards.** `examples/` gains one per look × platform: 5 looks × 2 frames = 10 examples. The test suite and the eval both use them.
- **Agent system prompt.** It gains a short rule: *"If Frame, Look or Type are not in [Video settings] and the request does not say, ask once with these exact choices, then proceed."* For "make it now" requests it uses the defaults instead of asking.

---

## 7. Open-source tools (all lightweight, all run on CPU)

| Tool | Licence | Size | Use | Ships how |
|---|---|---|---|---|
| three.js r170 | MIT | 676 KB | 3D look | npm dependency, copied into build |
| Quaternius character and animal packs | CC0 | ~6 MB starter set | 3D characters with animations | on-demand download + checksum |
| Kenney nature, city, furniture, mini-characters kits | CC0 | ~6 MB starter set | 3D stages and props | on-demand download |
| lottie-web (light build) | MIT | ~160 KB | User Lottie files in motion look | npm dependency |
| Lucide icons (subset) | ISC | ~250 KB | Motion-graphics icons | bundled |
| smartcrop.js | MIT | ~10 KB | Crop photos to 9:16 / 16:9 | bundled |
| Fonts: Anton, Bebas Neue, Poppins, Baloo 2 | OFL | ~600 KB | Kinetic text, Hindi | bundled |
| Openverse API, Wikimedia Commons API | free, no key | — | Real images | HTTP |
| Pexels / Unsplash API | free key | — | Better stock photos and clips (optional) | HTTP |
| msedge-tts word boundaries | (already used) | 0 | Word-by-word captions | existing dependency |
| ffmpeg 7 | (already used) | 0 | Segments, concat, thumbnails, video-clip composite | existing |

Package size goes from about 1 MB to about 3 MB, plus about 12 MB of 3D assets on first 3D use.

**Rejected:**

| Tool | Why |
|---|---|
| Remotion | Company licence; React build step slows every render |
| Blender | 300 MB+, slow on CPU |
| Local Stable Diffusion or AI video | No GPU; minutes per image |
| rembg (background removal) | Python + onnxruntime ≈ 150 MB. Possible later as an optional "cutout" add-on installed by `video_doctor --install cutout` |
| Spline or Babylon.js | Bigger than three.js for the same job |

**AI images later, without a GPU.** If the gateway exposes an image model, a `video_image_generate` tool can call it. The result is a normal photo-look image and needs no engine change.

---

## 8. Phases

| Phase | Version | Delivers | Main files | Done when |
|---|---|---|---|---|
| **A. Platforms + captions** | 0.3.0 | `platform` field, 4:5, safe zones, pop/karaoke word captions, thumbnail/cover/chapters/credits extras, length checks | platforms.mjs, tts.mjs, runtime.js, render.mjs, qa | Same storyboard renders correctly for insta-reel and youtube; no text in unsafe zones; captions land on spoken words (±60 ms) |
| **B. Text + motion looks** | 0.3.0 | `look` field, looks.mjs, kinetic, list-reveal, icons, chart, timeline, compare, logo-reveal, lower-third, Lucide, fonts, optional Lottie | layers/kinetic.mjs, layers/motion.mjs, templates/text.mjs, templates/motion.mjs | 4 example videos per look pass QA; render speed ≤ 2D today |
| **C. Real images** | 0.4.0 | photo templates, Ken Burns, smart crop, blurred fill, Openverse/Commons search+fetch tools, credits, optional Pexels/Unsplash keys, busy-background QA | assets/stock.mjs, layers/photo.mjs, tools.mjs | "Make a 30 s Jaipur travel reel" works end-to-end with no user images and correct credits |
| **D. 3D look** | 0.5.0 | three.js layer, seeded seekable world, glTF characters with clips, 10 stages × 3 times, camera moves, product3d, asset downloader, slow-frame QA | layers/canvas3d.mjs, templates/3d.mjs, assets/assets.mjs | kids-story.json renders with `look: "3d"` unchanged otherwise; identical frames on re-render; ≤ 400 ms/frame |
| **E. App UX** | app | `inputChips` manifest field, chip bar, character gallery popover, start cards, render progress bar, platform download buttons | app files in §4 | User makes a 3D Insta reel with taps + one sentence |
| **F. Parallel render + eval** | 0.5.x | N workers + segment concat, quick preview, 10-prompt eval across looks × platforms on 3 free models | render.mjs, plans/09 log | 30 s 3D reel renders < 60 s; eval pass rate logged |

Suggested order: A → B → E → C → D → F. A and B are fast wins that make reels look professional. E makes them easy to choose. C and D are the larger builds.

**Tests per phase.**

- Unit tests for validation of every new field and alias.
- A golden-frame test per look: render frame N twice and compare hashes, which proves seeking is deterministic.
- One example storyboard per look × platform.

---

## 9. Risks and answers

| Risk | Answer |
|---|---|
| 3D too slow on older CPUs | Low-poly budget, 1024 shadow map, parallel workers, `quality: "draft"` (720p, no shadows) |
| Free models write wrong fields for new looks | Focused per-look docs; validator aliases; look/template mismatch auto-fixed with a warning, not an error |
| Stock photo licences | Only CC0/CC-BY/Pexels/Unsplash licences accepted; licence stored per file; credits auto-written |
| glTF downloads fail offline | Capsule fallback characters and primitive stages always work; doctor reports missing packs |
| Bigger templates file | Split per look (§3) |
| Word timings missing for some voices | Fall back to even split of the line by syllable count |

## 10. Decisions for the owner

1. Phase order: the suggestion is A → B → E → C → D → F.
2. Add Pexels and Unsplash keys (better photos and video clips), or stay key-free with Openverse and Commons only?
3. 3D character set: Quaternius (more animals and people, cuter) or Kenney (simpler, very small)? Both are CC0, and both can be offered.
