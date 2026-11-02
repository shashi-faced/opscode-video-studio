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

## Next

1. Run the 10-prompt task set from plan 08 on 3–4 small models through the real app loop and log results here.
2. (done) Standalone GitHub repo, tagged releases.
3. Windows support for the install script (PowerShell variant).
4. More templates: `timeline`, `comparison`, `logo-reveal`; per-word karaoke captions.
