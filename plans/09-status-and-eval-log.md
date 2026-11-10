# Status and evaluation log

## Phase status (2026-11-02)

| Phase | Status | Notes |
|---|---|---|
| 01 Schema + validator | Done | Normaliser handles aliases, comma lists, pixel coords hint, null fields |
| 02 Compiler + templates | Done | 7 templates × 3 formats, 5 themes, 3 mascots, auto-fit, captions, seekable runtime |
| 03 Recorder + encoder | Done | Frame-stepped CDP capture piped to ffmpeg; ~1.9 s render per output second at 1080×1920 |
| 04 Audio | Done | Edge TTS (cached), JS music synth (3 styles), ducking mixer, −14 LUFS |
| 05 QA check | Done | text-too-long, crowded, off-stage, overlap, caption, missing/tiny image + contact sheet |
| 06 CLI + tools + prompt | Done | 6 tools, JSON last line, `--b64` params |
| 07 Packaging + app hook | Done | Store "Download" installs the tagged GitHub archive (~1 MB) + npm deps (~19 MB); system ffmpeg, bundled fonts |
| 08 Tests + eval | Started | 12 unit tests pass; one free-model end-to-end run below |

## Free-model run #1

- Model: gateway route `openrouter/free` (whatever free model it picked).
- Input: the agent system prompt + `video_templates` output + request: *"Vertical reel for Sharma Sweets, Jaipur. Diwali sale 30% off until 15 Nov, free delivery above ₹999, 8 AM–11 PM. Hindi female voice. No photos."*
- Output: [examples/free-model-diwali.json](../examples/free-model-diwali.json), 5 scenes (title, bullets, stat, quote, cta), sensible theme (`warm-paper`) and voice (`hi-IN-SwaraNeural`).
- Validation: 1 error, `brand.logo: null`. With the error fed back, the model fixed it in one round.
- Tool fix made from this: the normaliser now drops `null`/empty optional fields (with a warning), so the original output passes with zero rounds.
- Preview: 0 layout issues. Render: 27 s 9:16 MP4 in 40 s.

## v0.2.0 (2026-11-04): video types and characters

- `type` field with 8 recipes (story, ad, demo, explainer, howto, greeting, announcement, reel): theme, music, format defaults and per-type first/last/template checks.
- Character rig (`characters.mjs`): 21 kinds × 8 poses × 6 moods, shaded SVG, CSS animations (seekable): blink, breathe, talk, wave, walk, jump, cheer, dance; entrances.
- 14 illustrated backgrounds (`backgrounds.mjs`) with day/sunset/night palettes and moving parts (clouds, stars, waves, bubbles, diyas, fireworks).
- New templates `story`, `dialogue`, `steps`. Dialogue lines are voiced per character (`castVoices`): language from the narrator, gender and age set voice and pitch; parts joined with 0.35 s gaps; the timeline keeps per-line windows for bubbles and mouths.
- Music styles `playful` and `festive`; themes `storybook` and `festive`.
- `video_templates` takes `type` and returns only that recipe (story doc ≈ 9.5 KB vs 12 KB full).
- Validator accepts loose model output: "Name: text" lines, speaker/says fields, kind and background aliases (bunny, garden, diwali), mood/pose aliases; unknown speakers are errors that list the cast.
- QA: bubbles off-stage, text covering a character.
- Test render: examples/kids-story.json (Hindi, 3 characters, 8 scenes) → 52 s 1080p in 3 min 15 s; 21 tests pass.

## v0.3.0 (2026-11-04): platforms and word captions (plan 10, Phase A)

- `platform` field (`schema/platforms.mjs`): youtube, youtube-short, insta-reel, insta-post, insta-story, whatsapp-status, tiktok, square, linkedin, with aliases ("Insta Reel", "yt shorts", "WhatsApp"). Sets format, caption style, progress bar and extras; an explicit `format` still wins. Type `reel` defaults to insta-reel.
- New 4:5 format (1080×1350), using the square layout rules.
- Safe zones: stage CSS vars `--st/--sb/--sl/--sr`; content box, captions, brand and story text use `max(normal, safe)`, so old storyboards without a platform render exactly as before. QA check `in-unsafe-zone`.
- Word timings: Edge TTS word boundaries saved next to each cached clip (`*.words.json`), shifted by the trimmed lead-in. `alignWords` maps them to the written words (punctuation and highlight spans kept; unmatched words interpolated).
- Caption styles: `line` (now word-timed), `karaoke` (spoken word lights up), `pop` (1–3 big outlined words, pop-in, current word yellow). Positions bottom/middle/top.
- Extras: cover (first scene settled, no caption), 3:4 profile-grid crop, YouTube 1280×720 thumbnail, description .txt with chapters (≥ 3, each ≥ 10 s, first at 0:00), WhatsApp 60 s parts (keyframes forced at cut points, split without re-encode).
- Length: validator estimates speech length per platform (error over the max); QA and render report the real length.
- Test renders: examples/insta-reel.json, 41.5 s in 79 s, pop captions in sync, text clear of the safe zones; youtube-ad.json with thumbnail + description; 4:5 karaoke. 32 tests pass.

## v0.6.0 (2026-11-07): films (plan 11, Phase 1)

- New `film.json`: the storyboard's top fields plus `sequences[]` of `shots[]` (a shot is a normal scene with an optional `id`). A plain storyboard is read as one sequence. Up to 400 shots and 24 cast members; errors point at `sequences[i].shots[k]`.
- `film-render` (tool `video_film_render`):
  - every shot is compiled on its own and rendered to a silent H.264 segment (x264 veryfast, crf 18);
  - a pool of Chrome workers renders them (default cores − 2, max 6), longest shots first;
  - segments are cached by a hash of engine version, encoder settings, fps, size and the compiled page; unchanged shots are reused;
  - `--only` renders chosen shots; a failed shot does not stop the others.
- Voice is synthesised once per shot in parallel batches; the film timeline uses whole-frame shot lengths, so sound never drifts. Music: one synth cue per sequence (its own style if set), crossfaded at sequence cuts. Mix and −14 LUFS as before.
- Joined with the concat demuxer (no re-encode). Extras: `.srt` captions, chapters (one per sequence), poster. `project.json` keeps per-shot status; `film-status` (tool `video_film_status`) reports it.
- New `cut` transition; film shots cut by default (the default fade made each shot fade in from the empty stage).
- Chrome draws on the graphics card when it can (Vulkan through ANGLE; probed once per run; `OPSCODE_VIDEO_GPU=0/1` to force). Short renders keep CPU drawing.
- Test machine: i7-1165G7 (4 cores / 8 threads), Intel Xe, 31 GB.

| Test | Result |
|---|---|
| 8 shots, 42 s, no voice: CPU drawing, 4 workers | 103 s (CPU ~80 % busy, Chrome's GPU process the bottleneck) |
| same, graphics card, 4 or 6 workers | 66–67 s |
| same, x264 ultrafast | 59 s but 6× larger file, so not used |
| No changes since last render | 3 s (all 8 shots cached) |
| One shot's text edited | 25 s (1 shot rendered, 7 reused) |
| **60 shots, 12 sequences, 6 min 29 s, Hindi voice, 2 music styles** | **5 min 49 s** (0.9 s per second of film), 36 MB, 12 chapters |
| Short reel (`render`, unchanged path) | 37.9 s video in 61 s, as before |

- Phase 1 target was "5-min film in < 4 min with 6 workers": reached 0.9 s/s (5 min ≈ 4.5 min) on this laptop; the CPU is saturated, so more speed needs fewer pixels per frame or a faster machine.
- App: package tool calls named `*film_render*` may run 3 h (others 25 min); a cut-off render resumes from the cache.
- 39 tests pass (7 new in `test/film.test.mjs`).

## v0.7.0 (2026-11-07): 3D look, Phase 1 (plan 12)

- **Research:** `reports/3D cartoon video engine stack.md` (Opscode IDE workspace) chose three.js r187 (MIT), the Iris Xe GPU through ANGLE/Vulkan, procedural toon characters first, kit assets later, and FilmAgent-style staging. Benchmarks are in `bench/3d/`.
- **`look: "3d"`** (top or per scene), per-scene `camera`, and new poses `sit` and `talk`. Aliases: "Pixar style" and "CGI" become 3d, "close up" becomes close, "zoom in" becomes dolly-in.
- **`src/compiler/world3d.js`** (browser module, offline; three.js copied into each build):
  - procedural cel-shaded characters for all 21 kinds (human, animal, owl, robot, float plans);
  - 10 poses and 6 moods; blink, talking mouth, ear and tail sway; entrances (walk-in, fly-in, pop);
  - 14 places × day/sunset/night with moving parts (clouds, waves, fish, bubbles, fireflies, lights, diyas, fireworks);
  - light presets and ink outlines (inverted hull);
  - camera shots as pure functions of t; dialogue auto-cuts to the speaker.
- Speech bubbles follow the projected head positions. Titles, story text and captions stay HTML.
- 3D builds render with the GPU when it works (renderer, preview and film).
- **Bug found and fixed:** one WebGL renderer draws every scene, so it must clear colour and depth before each frame. Without that, characters from an earlier scene showed through in later ones.

| Test | Result |
|---|---|
| kids-story-3d.json, 52 s, Hindi voice, `render` (1 worker, screenshots) | **119 s** (the 2D version takes 195 s) |
| same, `film-render`, 4 workers | **54 s** |
| Same frames rendered in two runs, different seek order | identical hashes (deterministic) |
| All 21 kinds × poses in 6 places | build and render; faces readable after the hair-cap fix |
| Tests | 43 pass (4 new in `test/three3d.test.mjs`) |

## v0.7.1 (2026-11-07): 3D fast capture, Phase 2 (plan 12)

- **Fast capture of 3D frames** (`grab()` in `render/browser.mjs`, `grab/compose` in the page runtime):
  - The HTML text layer (titles, story text, bubbles, captions) is captured as a transparent PNG only when its content key changes. The key covers caption, active word, bubble state and position, and animation progress.
  - It is drawn as a flat overlay inside WebGL, and the WebGL canvas is encoded as JPEG in the page. There is no CDP screenshot for these frames.
  - Frames whose text is still animating in (or a bubble popping) use a normal screenshot, which is cheaper for one-off layers.
  - Progress-bar fills are drawn every frame in WebGL.
- Speech bubbles move in 0.5 % / 8 px steps, and talking shots (medium, close) no longer drift. Both keep the cached layer valid.
- **Parallel single renders:** for 3D on the GPU, `render` splits the frames into chunks over 4 workers (`--workers N`). Each worker writes an x264 veryfast segment; segments are joined without re-encoding and the sound is added once. WhatsApp split videos and 2D keep one worker.
- **No-GPU profile:** 3D draws at 2/3 resolution with no shadows (`lowres`), and the HTML text stays sharp.
- Film shots use the fast capture too.

| Test (kids-story-3d.json, 52 s, 1080p) | Before | After |
|---|---|---|
| One worker, per frame (screenshot vs composed) | 69 ms | 40 ms composed (25 ms of it is GPU readback + JPEG encode) |
| `render`, 1 worker, no voice | 119 s* | 89 s |
| `render`, 2 / 3 / 4 / 6 workers | — | 56 / 48 / **45** / 45 s (CPU-bound from 4 workers on this 4-core laptop) |
| `render` with Hindi voice (default 4 workers) | 119 s | **53 s** |
| `film-render` 3D, 4 workers, no voice (42 s film) | 54 s | 44 s |
| Composed vs screenshot frame | — | PSNR 45–62 dB (visually identical) |
| SwiftShader, per frame, full vs `lowres` | — | 461 vs 229 ms |
| 2D reel (unchanged path) | 61 s | 65 s |

\* with voice; the no-voice time before Phase 2 was about the same.

## v0.7.2 (2026-11-07): 3D faces and lip-sync, Phase 5 (plan 12)

- **Word timings for every dialogue line:** Edge TTS boundaries were already cached per clip; they are now passed on as `partWords`.
- **`src/audio/visemes.mjs`:** text plus word timings become a track of 9 cartoon mouth shapes (X rest, A M/B/P, B teeth, C E/I, D A, E O, F U/W, G F/V, H L).
  - **English:** letter and digraph rules (th, sh, oo, ee, ou…), silent final e.
  - **Hindi:** Devanagari rules by place of articulation, vowel signs, inherent "a" after consonants, virama, nukta, anusvara, and word-final schwa deletion.
  - Latin-script Hinglish uses the English rules.
  - Each word's sounds are spread over its spoken time (vowels longer); the mouth rests in pauses over 0.12 s; flickers under 50 ms are dropped.
  - No audio analysis and no external tools.
- `buildTimeline` adds `parts[].visemes` for every line. With no voice, the words are spread evenly over the estimated time.
- **3D mouth** (world3d.js): an opening, teeth, tongue and lip ring, shaped per mouth shape and blended over 60 ms. Closed shapes show the lip line.
- **Gaze:** the speaker looks at the nearest listener, listeners look at the speaker, and everyone turns towards the camera during narration (head turns blend over 0.35 s). There is a nod at each line start and a head tilt at the end of a question.
- **Examples:** `examples/lipsync-en-3d.json` (English, fox and panda).

| Test | Result |
|---|---|
| Tara's Hindi line, frame by frame | lips close on म/ब/प, open with tongue on आ, teeth on consonants, round on ओ/उ |
| lipsync-en-3d.json (21 s, English, 4 lines) | renders in 47 s; mouths and head turns follow the dialogue |
| kids-story-3d.json (52 s, Hindi) | 59 s (was 53 s; first run fetched word timings for the line clips) |
| Same frames rendered twice, different seek order | identical hashes |
| Tests | 47 pass (4 new in `test/visemes.test.mjs`) |

## v0.7.3 (2026-11-07): 3D director and camera, Phase 7 (plan 12)

- **Director** (`planShots` in world3d.js): each 3D scene gets a shot list once; the camera at t is a pure function of the shot covering t.
  - **New place:** a new place or time of day opens with an establishing crane-down. The compiler marks `newPlace`; film shots pass the previous shot's place.
  - **Narration:** a walk-in gets a follow shot, then a wide push-in.
  - **Dialogue:** opens on a two-shot of the two most talkative characters, then alternates over-the-shoulder and close-ups on each speaker. Cuts land 80 ms before a line; shots are at least 1.2 s.
  - **Reactions:** a long line with a strong mood (sad, surprised, angry, worried) ends on a reaction close-up of the listener.
  - **Variety:** never three shots of the same size in a row; one-character scenes alternate medium-close and close.
- **Shot solver:** extreme-wide, wide, full, medium, two-shot, medium-close, close, extreme-close, over-shoulder, follow, plus moves (dolly, orbit, pan, crane up/down).
  - Framing: headroom, eyes near the upper third, lead room toward the facing side.
  - Over-the-shoulder: behind and just outside the listener's shoulder, always on the audience side (180-degree rule).
  - Talking shots hold still, so speech bubbles and the cached text layer stay valid.
- **Schema:**
  - more scene `camera` values;
  - per-line `shot` (close, medium-close, over-shoulder, two-shot, medium, wide, reaction), with aliases (OTS, MCU, ECU, tracking…);
  - top-level `cinematic`: 2.39:1 letterbox bars, subtitles inside the bottom bar, no progress bar, a gentle seeded hand-held float.
- **QA (preview):** `speaker-off-screen` (speaker's head outside the frame at the middle of the line) and `same-shot-size` (three in a row), each with a fix.
- **Example:** `examples/cinematic-3d.json`.

| Test | Result |
|---|---|
| cinematic-3d.json (25 s, 3 scenes, 5 lines) | plan: establish, wide / two-shot, OTS, reaction, close, OTS, close / orbit; renders in 33 s |
| kids-story-3d.json (52 s) | wides, dolly, two-shots, over-the-shoulders and an establishing shot at the new place; 53 s |
| Same frames rendered twice, different seek order | identical hashes |
| Preview QA on both | no camera issues |
| Tests | 48 pass (1 new) |

## v0.8.0 (2026-11-07): 3D character pack, Phase 3 (plan 12)

- **`src/assets/3d-starter.json`:** 11 rigged, animated Quaternius models (CC0 1.0), all hosted on Poly Pizza. Each model's licence was checked on its page on 2026-11-07, and each has a pinned URL, size and SHA-256.
  - The repo ships only this manifest; files download to `~/.opscode/agents/video-studio/cache/video-assets/3d/`.
  - Quaternius's August 2026 licence forbids redistribution, so nothing is mirrored.
- **`src/assets/assets.mjs`:** status, install (3 tries, SHA-256 check, atomic write, `.ok` marker), remove, and `modelFor(kind)`.
  - Tool `video_assets` (list/install/remove), CLI `assets`, and a `doctor` line.
  - Install: 11/11 models, 5.8 MB.
- **Compiler:** copies the models a video uses, plus three.js `GLTFLoader`, `SkeletonUtils` and `BufferGeometryUtils`, into the build.
- **world3d.js:** loads each model with top-level await.
  - Converts its materials to the same toon look and outlines.
  - Measures it in the idle pose and scales it to the kind's height, feet on the ground.
  - Maps clips to poses with fallbacks (idle, walk, wave, jump, cheer, dance, sit…), ignoring prefixes like `Robot_`.
  - Clones per character; `mixer.setTime(t + phase)`, so animation is a pure function of t.
  - Gaze and nods rotate the head bone about world axes, since bone axes differ between packs.
  - The bubble anchor follows the head bone. Cast colours recolour the model's main material when it has one.
- **Choice:**
  - Cast `"model"` and top-level `"models"`: `auto` | `built-in` | `pack`.
  - `auto` uses only the models curated as good for kids' cartoons: **panda, robot, fox, woman, dog**.
  - Boy (Minecraft-style, faced away), "girl" (a blue creature suit), man (untextured mannequin), rabbit (holds a sword), cat (sizing) and mouse (realistic rat) are used only with `"pack"`. The two backwards-facing models get a 180° turn.
- **Camera fix found by the new QA:**
  - Close shots aimed at the body centre, so a four-legged fox's head was off screen (`speaker-off-screen` fired twice).
  - Tight shots now aim at the head itself, and QA is clean.

| Test | Result |
|---|---|
| All 11 models in close-up ("full" shot) | load, animate, toon outline; quality review above |
| cinematic-3d.json with pack (fox + panda models) | QA clean after the fix; renders in 27 s (25 s video) |
| Same frames rendered twice, different seek order (with models) | identical hashes |
| Same storyboard with no pack (empty home) | falls back to built-in characters; spec has no models |
| Tests | 51 pass (3 new in `test/assets.test.mjs`) |

## v0.9.0 (2026-11-07): 3D worlds from kits, Phase 4 (plan 12)

- **World pack `src/assets/3d-world.json`:** 55 Kenney models (CC0 1.0, 2.2 MB, 452 checked on Kenney's Poly Pizza profile), each with a pinned URL, SHA-256 and a real-world size (`fit`: height or width in metres, because model units vary from 7 cm houses to 4 m trees).
  - Kenney's own site hides its zips behind an interactive donate step, so Poly Pizza's direct files are used.
  - It includes furniture, trees, rocks, tent, campfire, fences, houses, city buildings, a ship, a shipwreck, spacecraft and food.
- **Asset manager:** multiple sets; `video_assets` with optional `set`; CLI `assets install 3d-world`; doctor lists both packs.
- **`src/compiler/scenery.json`:** the props each location uses, plus the props allowed for `near`. The compiler copies only those into the build.
- **world3d.js:**
  - loads props, converts them to toon materials, fits them to size and sits them on the ground;
  - places them with the scene's seeded random numbers, outside the stage area.
  - **Swapped in when installed:** trees (Kenney trees replace the round built-in trees; pines stay built-in), village houses, city buildings and all indoor furniture (home, bedroom, classroom, office).
  - **Added:** a forest camp (tent and campfire), meadow signpost and grass, a pirate ship and beach props, spacecraft, satellite and speeder in space, a shipwreck underwater, festival food tables.
- **Schema:**
  - per character `near` (23 props, placed beside them; big ones behind and to the side so they never hide anyone);
  - per scene `weather` (rain, snow, leaves, fireflies, sparkles), all particles computed from (seed, index, t), with dimmer light and fog for rain;
  - top-level `scenery`: `auto` | `built-in`.
- **Bug fixed:** "near house" first put the house between the camera and the character.

| Test | Result |
|---|---|
| All 14 places with the pack, weather in 5 of them, `near` in 5 | all render; furniture and set pieces placed; QA clean |
| Same frames rendered twice, different seek order (props + weather) | identical hashes |
| No packs installed (empty home) | built-in places and characters; spec has no props or models |
| kids-story-3d.json with kit scenery + fireflies + leaves (52 s, Hindi) | 49 s |
| Tests | 52 pass (1 new) |

## v0.10.0 (2026-11-07): any character in 3D, Phase 6 (plan 12)

- **Designs (`DESIGN` in `spec.mjs`):** a cast member's `design` names only parts from fixed lists, so a small model cannot write geometry:
  - 8 body plans: biped, animal, quadruped, bird, fish, snake, blob, robot;
  - size, build, head, ears, eyes, snout, horns, hair, outfit;
  - lists of extras (tails, wings, mane, shell, fins, spikes, crest, whiskers, stripes, spots, cape, sting) and accessories (crown, caps and hats, glasses, halo, wand, flute, kettle, umbrella, book…);
  - colours in `colors`: main, belly, accent, outfit, hair.
- **Validation:** loose wording is corrected ("Bird" → bird, "long snout" → long, "long tail" → tail-long, extras as a comma string). A design with no `kind` gets one from its plan, so the voice still has a sensible default.
- **world3d.js `buildDesigned`:** builds the character from parts in code, with the same toon look, faces, lip-sync, poses and moods as the built-in kinds. Designed characters never use pack models.
- **Turnaround sheet (`src/characters/sheet.mjs`):** 8 views (front, 3/4, side, back, happy, sad, surprised, walk) tiled into one PNG with ffmpeg.
- **Character library (`src/characters/library.mjs`):** saved under `~/.opscode/agents/video-studio/characters/`; storyboards use `"design": "library:<id>"`.
- **Tool and CLI:** `video_character` (sheet, save, list); `opscode-video character`.
- **Bugs fixed while testing:** a cap covered the whole head; the cow's spots were invisible; the sheet's cloud floor hid feet (meadow now); birds had no beak by default.

| Test | Result |
|---|---|
| 20 designs (peacock king, croc, robot tea-seller, dragon, tortoise, monkey with cap, ghost, astronaut girl, cow, goat, parrot, snake, elephant queen, tiger, frog, bee, snowman, teddy, alien, wizard) | all build and render |
| Sheets for a peacock king and a wizard | 8 views each, correct |
| Saved peacock + new monkey in dialogue, then forest (8.6 s) | renders in 19 s; deterministic |
| Tests | 56 pass (4 new in `test/design.test.mjs`) |

## v0.11.0 (2026-11-07): agent, app and eval for 3D, Phase 8 (plan 12)

- **Agent:**
  - `video_templates` takes `look: "3d"`. The 3D guide (2.9 KB: camera, weather, props, presets, design parts) is sent only then, with a complete 3D example (`STORY_EXAMPLE_3D`). 2D requests get one line pointing to it.
  - New system-prompt rule: Look: 3D, "3D", "Pixar style" or "CGI" → pass look "3d", set `"look": "3d"`, leave the camera to the director.
  - The aliases from the plan (3D, Pixar, CGI, close up, zoom in, 360…) were already in place and are now tested.
- **Presets (`src/characters/presets.mjs`):** 20 ready-made designs, used with `"design": "preset:<id>"`; kind, name and voice are filled in. An unknown preset gives one clear error that lists them all.
- **Speed and GPU:**
  - `video_render` reports the 3D speed (frames/s, GPU or CPU, workers), with a hint to fix the graphics drivers when 3D falls back to the CPU.
  - `doctor` checks the GPU.
- **Library thumbnails:** `video_character save` also stores a 192 px front-view picture; `list` returns it.
- **Gallery pictures (`scripts/gallery-3d.mjs`):** 41 characters (21 kinds + 20 presets) and 14 places, rendered with built-in models in about 7 s (428 KB).
- **Opscode app (Hecto):**
  - The **3D cartoon** look card is enabled (it was "Soon").
  - With 3D chosen, the setup panel shows three picture galleries:
    - **3D characters:** 41, up to 4;
    - **My characters:** loaded from the character library through `video_character list`, refreshed when the agent saves one;
    - **Places:** 14, up to 3.
  - The 2D character picker hides when 3D is chosen.
  - New setup-field features: `image` options, `gallery` and `places` layouts, `hideWhen`, run-time `source`.
  - Checked in the browser pane; the `[Video settings]` text the agent receives was checked too.
  - The planned in-app fps display is not built: the app shows no live render progress, so the speed line in the render result covers it for now.
- **Eval harness (`eval/3d/`):**
  - 10 prompts from the plan; 4 come with app settings, 6 are plain words. They cover a story, a festival in Hindi, an explainer, a comedy, action, night, underwater, a classroom, series episode 2 (`library:raja`) and a 5-minute film.
  - `ask` builds the exact system prompt and message the app sends; `score` validates, previews, renders and checks lip-sync and determinism; `report` writes the table below.
  - Definitions:
    - critic score = 10 − 2 × layout errors − 0.5 × warnings (the vision rubric is not automated yet);
    - lip-sync = the share of each spoken line with the mouth open.

| Test | Result |
|---|---|
| Harness on the bundled 3D example (not a model run) | valid in round 1; preview 0 errors, 1 warning; critic 9.5; 24.7 s video in 32 s (22.8 fps, GPU, 4 workers); lip-sync 0.85 on 3 lines; deterministic |
| Gallery: 41 characters + 14 places | all render; checked by eye |
| App type check (`tsc --noEmit`) | clean |
| Tests | 62 pass (6 new in `test/agent3d.test.mjs`) |

**Model eval: run on LongCat-2.5** (the gateway's active route on 2026-11-07; the route was not changed). See the next entry.

## v0.12.0 (2026-11-07): 3D eval run and fixes, Phase 8 (plan 12)

**How it was run:**
- Model: LongCat-2.5, the gateway's active route on 2026-11-07; the route was not changed. One model only, not three.
- Each prompt went to the model as one request with the agent's system prompt plus the `video_templates` result. Rounds 2 and 3 sent the validator's feedback back with a short "apply each FIX" prompt.
- Six prompts used the full guide, exactly as the app sends it: story, comedy, action, night, underwater, classroom. Four used a shortened copy, because the gateway timed out or the request was hand-trimmed: festival, explainer, series-ep2, film-5min. The film also needed two attempts.
- The film's round 2 was a value mapping for 13 invalid `near` words, not a full rewrite.

| Prompt | Valid in round | 3D | Scenes | Designed chars | Preview errors / warnings | Critic | Render (video / time, fps, GPU) | Lip-sync open | Deterministic |
|---|---|---|---|---|---|---|---|---|---|
| story | 2 | yes | 6 | 1 | 0 / 1 | 9.5 | 43.8 s / 53 s, 24.8, GPU | 0.78 (2 lines) | yes |
| festival | 2 | yes | 5 | 0 | 0 / 1 | 9.5 | 32.6 s / 47 s, 20.9, GPU | 0.98 (4 lines) | yes |
| explainer | 1 | yes | 4 | 0 | 0 / 1 | 9.5 | 41.5 s / 43 s, 28.7, GPU | 0.89 (5 lines) | yes |
| comedy | 2 | yes | 9 | 1 | 0 / 4 | 8 | 59.6 s / 85 s, 21.1, GPU | 0.79 (8 lines) | yes |
| action | 2 | yes | 5 | 1 | 0 / 4 | 8 | 36 s / 48 s, 22.5, GPU | 0.8 (4 lines) | yes |
| night | 2 | yes | 5 | 0 | 0 / 0 | 10 | 43.8 s / 42 s, 31.2, GPU | 0.9 (4 lines) | yes |
| underwater | 2 | yes | 7 | 3 | 0 / 1 | 9.5 | 43.6 s / 59 s, 22.3, GPU | 0.8 (4 lines) | yes |
| classroom | 2 | yes | 5 | 0 | 0 / 2 | 9 | 34.6 s / 46 s, 22.8, GPU | 0.79 (5 lines) | yes |
| series-ep2 | 3 | yes | 5 | 2 | 0 / 2 | 9 | 42.5 s / 52 s, 24.7, GPU | 0.71 (4 lines) | yes |
| film-5min | 2 | yes | 25 | 2 | – | – | 156.7 s / 146 s, 32.2, GPU | – | – |

Valid on the first or second round: 9/10 (90 %).

**Findings:**
- **Target met:** 9 of 10 prompts were valid by round 2 (90 %; the target is 80 %). Every video rendered on the GPU at 21–32 frames/s and every frame was deterministic. The worst critic score was 8 (layout warnings only; no layout errors anywhere).
- **Round-1 errors were almost all invented words:**
  - poses: sleep, perch, fly, smile, look-up, curl-up;
  - moods: confident, shy, gentle, warm, sly, thoughtful, cheer;
  - props: `near` set to a character, or to "spaceship", "crater", "map";
  - cameras written as sentences;
  - weather "bubbles", accessories ["none"];
  - kind "monkey", and `"library": "raja"` instead of `"design": "library:raja"`.
- **Validator fixed (v0.12.0):** unknown poses, moods, props, cameras, weather and "none" accessories are guessed or dropped with a warning. A kind that matches a preset (monkey, turtle, crocodile, peacock, …) uses it. `library` becomes `design: "library:…"`.
  - **Re-scored on the same round-1 replies:** 10 of 10 valid in round 1 (before: 1 of 10).
- **Bad fixes the old messages caused:** the monkey became a boy, and Raja became `kind: "man"` plus his design. The new corrections avoid both.
- **Determinism bug found and fixed:** pack models (the fox) could give a different frame depending on what was drawn before. three.js only writes a bone when its value changed since its last write, so head turns piled up and bones not moved by the current clip kept older poses.
  - Fix: reset every bone to its rest pose and clear the mixer's cached values before each seek.
  - This could also have caused small pose jumps where parallel render chunks meet.
  - Regression test added; it fails without the fix.
- **Harness:** the determinism check draws one warm-up frame and allows up to 3/255 per channel. The text layer's progress bar edge differed by 2/255 on 2 pixels.
- **Open quality notes (not fixed):**
  - the over-the-shoulder shot can fill a third of the frame with the near character (night: the fox);
  - a classroom shot had a dark prop slab at the frame edge;
  - Hindi lip-sync kept the mouth open 98 % of the time (English: 71–90 %);
  - a Devanagari title gives the output file the name "video";
  - the "5 minute" film came out at 2 min 37 s (25 shots), because the model wrote too few shots;
  - the critic score is from layout checks only; the vision rubric is not automated.

| Test | Result |
|---|---|
| Tests | 64 pass (2 new: invented-word corrections; pack determinism) |

## v0.13.0-dev: Whisper captions, Phase 1 spike (2026-11-10)

Plan 13. Engine: transformers.js 4.3.2 (ONNX Runtime on the CPU, 8 cores, no GPU), models `onnx-community/whisper-{base,small}_timestamped` at q8, word timestamps.

Ground truth: 20 cached Edge TTS clips (10 English, 10 Hindi) and their word boundaries. The long test joins 24 English clips with 0.8 s gaps.

| | base, English | small, English | base, Hindi | small, Hindi |
|---|---|---|---|---|
| WER | 5.7% | **1.9%** | 107% (written in Urdu or Latin letters) | 35% (Devanagari, spelling slips) |
| Words matched to the script | 95% | 99% | 0% | 66% |
| Start error, raw (median / p90) | 250 / 377 ms | 255 / 372 ms | — | 193 / 253 ms |
| Start error after removing the fixed shift (median / p90) | 68 / 135 ms | **60 / 120 ms** | — | **31 / 66 ms** |
| Speed (seconds of work per second of audio) | 0.17–0.19 | 0.34 | 0.30 | 0.81 (short clips, each padded to 30 s) |
| Model load | 12.5 s | 28.9 s | | |
| Peak RAM | 0.9 GB | 1.7 GB | | |
| Download | 76 MB | 241 MB | | |

**Long audio (small):** 148.9 s of speech took 49.8 s (0.33× real time). 95% of 315 words were matched. Start error after the shift is 64 / 145 ms. Drift from start to end is −28 ms, and times always increase, so the 30 s windows join cleanly.

**Invented words (small, 20 s each):**
- silence: "you";
- pink noise: "Thank you.";
- music: "Thank you for watching!".

A guard is required.

**Fixed shift:** the sound actually starts at about 0.21 s.
- Edge's first word is at 0.10 s, about 110 ms early. Today's captions are slightly early, which is harmless.
- Whisper is about 140 ms late (base: 0.30–0.58 s).
- Whisper's word spacing is accurate, so one calibrated constant per model fixes it.

**Install size:** `npm install @huggingface/transformers` is 745 MB. Of that, onnxruntime-node is 548 MB: all operating systems, plus a 260 MB CUDA library. Linux x64 CPU needs about 45 MB, so the installer must trim the rest.

whisper.cpp: not built (no `cmake` on this machine).

**Decision:** transformers.js; small by default; base as the fast English option.

## Next

1. Run the 10-prompt task set from plan 08 on 3–4 small models through the real app loop and log results here.
2. (done) Standalone GitHub repo, tagged releases.
3. Windows support for the install script (PowerShell variant).
4. More templates: `timeline`, `comparison`, `logo-reveal`; per-word karaoke captions.
