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

## Next

1. Run the 10-prompt task set from plan 08 on 3–4 small models through the real app loop and log results here.
2. (done) Standalone GitHub repo, tagged releases.
3. Windows support for the install script (PowerShell variant).
4. More templates: `timeline`, `comparison`, `logo-reveal`; per-word karaoke captions.
