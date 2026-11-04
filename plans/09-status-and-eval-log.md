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

## Next

1. Run the 10-prompt task set from plan 08 on 3–4 small models through the real app loop and log results here.
2. (done) Standalone GitHub repo, tagged releases.
3. Windows support for the install script (PowerShell variant).
4. More templates: `timeline`, `comparison`, `logo-reveal`; per-word karaoke captions.
