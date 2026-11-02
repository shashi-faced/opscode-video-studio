# Video Studio Agent — Overview

A downloadable Opscode agent that makes animated videos (ads, product demos, explainers, reels) with motion graphics, voiceover, music and captions. It is **not** a default agent: users install it from the Agent Store. All of its code lives in its own repository (`github.com/shashi-faced/opscode-video-studio`), apart from one small, generic hook in the app.

## 1. How the first videos were made (the manual method)

No model can "generate video" directly in Opscode. The two ads were produced by a large model improvising a pipeline:

| Step | What was done | Tool |
|---|---|---|
| Real screens | Ran the app's dev server, filled its Zustand stores with sample data, screenshotted | Playwright + Chrome |
| Animation | Wrote an HTML page: scenes as layers, CSS keyframes, SVG characters, container-unit layout | Hand-written HTML/CSS/JS |
| Recording | Opened the page at 1920×1080 in headless Chrome, captured the screencast frames with timestamps | Chrome DevTools Protocol |
| Encoding | Joined frames by timestamp into 30 fps H.264 | ffmpeg |
| Voice | Generated each line, trimmed silence, measured lengths, re-timed scenes to fit | edge-tts |
| Music | Synthesised tanpura, tabla, sitar, kick, bass from sine waves and noise | numpy |
| Mix | Placed voice clips, ducked music under speech, limiter, −14 LUFS | numpy + ffmpeg |
| QA | Looked at contact sheets of frames, fixed overlaps and misplaced highlights | Vision + edits |

## 2. Why a large model succeeded and smaller ones fail

The task needed no special permission, only these model-level skills:

1. **Seeing the indirect route.** "I can't make video" is the easy answer; connecting HTML → screencast → ffmpeg → TTS → synth music is the hard part.
2. **Long-horizon execution.** About 40 dependent tool calls, each building on the last.
3. **Error recovery.** ffmpeg missing, venv broken, scratch folder wiped, clicks failing, a tab forcing itself to the front, arrays of different lengths. Every one needed diagnosis and a new route.
4. **Design taste in raw code.** Layout in container units, timing, typography, motion that looks professional.
5. **Visual self-checking.** Reading frames and noticing a box is 20 px too low.
6. **Audio engineering knowledge.** Ducking, loudness standards, synthesis.

A smaller model is weak at exactly these: it stops early, gives up on the first error, writes HTML that overflows, and cannot reliably judge its own frames.

## 3. Design principle: move the skill into the tools

Everything that needed intelligence becomes deterministic code. The model's job shrinks to **writing one JSON storyboard** (text, images, which template, what to say), which even small models do well.

| Skill the big model needed | Replaced by |
|---|---|
| Finding the pipeline | One command: `opscode-video render storyboard.json` |
| 40-step execution | The engine runs every step in order |
| Error recovery | `doctor` checks and installs dependencies. Every error message says how to fix it |
| Design taste | A template library with tested layouts for 16:9, 9:16 and 1:1, plus theme presets |
| Text fitting | Auto-fit: text shrinks to its box, it can never overflow |
| Timing | Scene length is computed from measured voice length |
| Visual self-check | `check` runs DOM measurements (overflow, overlap, off-stage) and returns JSON issues with fixes; it also returns a contact sheet for models that can see |
| Audio engineering | Built-in music styles, automatic ducking and loudness |
| Deterministic output | Frame-stepped rendering: the same storyboard gives the same video on any machine speed |

The result: the agent works with a "flash" or free model, because the model never writes HTML, never runs ffmpeg and never mixes audio.

## 4. Architecture

```
User prompt ──► Video Studio agent (any LLM)
                 │  1. video_templates  → learns templates + fields
                 │  2. browser/screenshot tools (optional) → captures real screens
                 │  3. write_file storyboard.json
                 │  4. video_validate   → JSON errors with fix hints  (repair loop)
                 │  5. video_preview    → contact sheet + layout issues (repair loop)
                 │  6. video_render     → MP4
                 ▼
        opscode-video engine (this module, Node ≥ 18)
        ┌────────────┬──────────────┬─────────────┬───────────┬──────────┐
        │ schema +   │ voice (TTS)  │ timeline    │ compiler  │ recorder │
        │ validator  │ edge / none  │ durations   │ HTML/CSS  │ Chrome   │
        └────────────┴──────────────┴─────────────┴───────────┴────┬─────┘
                       music synth ─► mixer (duck, limit) ─► ffmpeg mux (−14 LUFS) ─► MP4
```

## 5. Plan files (build in order)

| File | Phase |
|---|---|
| [01-storyboard-schema.md](01-storyboard-schema.md) | The JSON contract the model writes; validation and repair hints |
| [02-compiler-templates.md](02-compiler-templates.md) | Storyboard → HTML; templates, themes, mascots, auto-fit, captions, seekable timeline |
| [03-recorder-encoder.md](03-recorder-encoder.md) | Frame-stepped Chrome capture piped to ffmpeg |
| [04-audio.md](04-audio.md) | TTS, timing, music synthesis, mixing, loudness |
| [05-qa-check.md](05-qa-check.md) | Layout checks, contact sheets, issue list |
| [06-agent-tools-prompt.md](06-agent-tools-prompt.md) | CLI, tool definitions, system prompt for small models |
| [07-packaging-store.md](07-packaging-store.md) | Downloadable package, Agent Store entry, generic app hook |
| [08-testing-eval.md](08-testing-eval.md) | Unit tests, golden renders, small-model evaluation |

## 6. Folder layout

```
opscode-video-studio/
  plans/                 this plan
  package.json           standalone package (not part of the app build)
  agent/manifest.json    Agent Store manifest: prompt, tools, install info
  bin/opscode-video.mjs  CLI entry
  src/
    schema/              storyboard JSON Schema + validator
    compiler/            HTML compiler, templates, themes, mascots, runtime.js
    render/              browser launch, frame stepping, ffmpeg
    audio/               tts, synth (music), mixer, wav utils
    qa/                  layout checks, contact sheet
    deps/                doctor: find Chrome/ffmpeg, install missing
  examples/              sample storyboards (16:9 ad, 9:16 reel)
  test/                  unit + golden tests
```

## 7. Scope limits (v1)

- Motion graphics only: animated UI, illustrations, text, screenshots. No photo-real footage.
- Synthesised music is clean but not studio quality. A user-supplied music file can replace it.
- Edge TTS needs internet. With no network, voice is skipped and captions still show.
