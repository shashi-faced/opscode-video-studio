# Plan 16: HyperFrames as a second video engine in Video Studio

Status (2026-11-11): **built and released as v0.15.0** (H0 to H4; see 5b to 5e). Still open: a real pass rate for models writing compositions (H5 eval), measured in the app.

## 1. Goal

Video Studio gets real HyperFrames tools. The agent writes a video as an HTML page with timed animations, checks it, looks at frames, and renders it to MP4 with the HyperFrames engine, with our voice-over, captions and music on top. The "Faceless Explainer (HyperFrames)" option in the app, which today points at a look that does not exist, starts working.

## 2. What HyperFrames is (checked 2026-11-11)

- [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes): "Write HTML. Render video. Built for agents." Apache 2.0, about 82k stars, updated today.
- A video is an `index.html` with `data-start`, `data-duration` and `data-track-index` attributes and a paused GSAP timeline (CSS, Lottie, Three.js and others also work). The renderer seeks every frame in headless Chrome and encodes with ffmpeg, the same idea as our own renderer.
- npm package `hyperframes` 0.9.33, with a non-interactive CLI: `init`, `add` (about 450 ready-made blocks: transitions, kinetic type, charts, maps, captions), `lint`, `check`, `validate`, `snapshot`, `render`, `docs`, `doctor`. All have `--json` output.
- It also has paid and cloud parts (HeyGen cloud render, publish, share, Pro style templates, reverse-any-video). **We do not use those.**

**Measured on this machine:**

| Check | Result |
|---|---|
| Install | 78 packages, 122 MB, 3 seconds |
| Needs | **Node 22 or newer** (Video Studio itself needs only 18), ffmpeg, **ffprobe**, Chrome |
| ffprobe | **Missing here**: render stops with "FFprobe not found". Our ffmpeg is a static build without ffprobe. A separate ffprobe is 79 MB |
| Chrome | Found and reused the headless Chrome already in `~/.cache/puppeteer` |
| Lint | `lint --json` returns `{ok, errorCount, findings}` |
| Render | 4 seconds of 1080×1920 at 30 fps in about 5 seconds |
| Hindi | Devanagari text rendered correctly |
| Network | The blank template loads GSAP from a CDN and fetches fonts from Google Fonts on first use (then cached) |
| GPU | WebGL was not available here, so it used software drawing; shader transitions may be slow or missing |

## 3. When each engine is used

| | Storyboard engine (today) | HyperFrames engine (new) |
|---|---|---|
| The agent writes | A JSON storyboard with ready templates | HTML, CSS and a GSAP timeline |
| Best for | Characters, kids stories, dialogue with lip-sync, 3D, stickman styles, quick social videos | Kinetic typography, product and feature launches, animated charts and maps, code and website walkthroughs, custom brand designs |
| Small models | Reliable: they only fill in fields | Harder: real code. Needs the guide, blocks and the check loop |
| Freedom of design | Limited to our templates | Anything a web page can draw |

The agent picks by the request, and the user can force it with the setup option. Character and story videos stay on the storyboard engine.

## 4. Design

### 4.1 Installed on demand
Like the Whisper runtime: HyperFrames is not bundled. The first use installs a **pinned version** into `~/.opscode/agents/video-studio/hyperframes/` (122 MB), plus ffprobe (79 MB) when the system has none. `video_doctor` reports the state and installs with `install=true`.
- **Node 22 check:** if the Node that runs Video Studio is older than 22, the tools say so plainly ("HyperFrames needs Node 22 or newer; this computer has 20") instead of failing inside the CLI.
- **Chrome and ffmpeg:** reuse the ones Video Studio already found.
- **Pinned version:** upgrades happen only with a Video Studio release, after our tests pass on the new version.

### 4.2 Tools (five, all under `src/hyperframes/`)

| Tool | What it does |
|---|---|
| `hyperframes_guide({topic?, search?})` | The authoring rules in under 4 KB with one complete example, written by us for small models. `topic` returns the matching CLI doc (`data-attributes`, `gsap`, `compositions`, `rendering`). `search` looks up ready-made blocks by keyword |
| `hyperframes_project({action, dir, format, blocks})` | `init` a project in the workspace (9:16, 16:9 or 1:1), `add` blocks from the catalog as editable source, `info` (duration, tracks, clips) |
| `hyperframes_check({dir})` | Lint plus runtime check in Chrome: JS errors, missing files, layout and contrast problems, each with a fix hint. The agent must pass this before rendering |
| `hyperframes_preview({dir, at})` | PNG frames at chosen seconds as one contact sheet, so the agent can look before rendering |
| `hyperframes_render({dir, out, quality, fps, format})` | MP4 (or WebM, GIF). Writes our progress file, so `/btw` shows the percentage. Returns the video for the chat player |

The agent edits `index.html` with its normal file tools; no special tool for that.

### 4.3 Voice, captions and music come from Video Studio
HyperFrames' own voice needs a Python model (Kokoro) and has no good Hindi voice. Ours already does Hindi and 5 other languages. So:
- `hyperframes_voice({dir, script, voice, language})` makes the narration with our TTS, puts the audio in the project's `assets/`, and writes the word timings as the project's transcript, so the agent can time each visual to the words.
- Music: our generated music or a file, placed as an audio track.
- Captions: either HyperFrames caption blocks driven by that transcript, or our `video_captions` burned onto the finished MP4 (the route that is proven for Devanagari).
- The finished MP4 works with every existing editing tool (trim, reframe, concat) and with publishing.

### 4.4 Safety and privacy
- **No cloud features.** `cloud`, `publish`, `share`, `lambda`, `billing`, `templates` and `reverse` are never called: they upload the user's content to HeyGen or need a paid plan.
- **Telemetry off** (`DO_NOT_TRACK=1`), and the CLI's own skill installer is off (`HYPERFRAMES_SKIP_SKILLS=1`), so it does not write files into the user's home folder.
- **Offline-friendly.** GSAP is copied into the project instead of loaded from a CDN; fonts come from our bundled fonts (including Devanagari) first. Catalog blocks need the network only when added.
- **The page runs code.** A composition is a web page written by the model and run in headless Chrome. It runs with the same sandbox flags as our renderer, and the project must stay inside the workspace folder.
- **Licence:** Apache 2.0; we add its NOTICE to our licences folder. Nothing of theirs is copied into our repo except through the pinned npm install.

### 4.5 App changes (`Hecto`)
- Setup panel: the **Faceless Explainer** option stops sending the invalid `look: "faceless"`. It becomes an **Engine** choice: "Motion design (HyperFrames)", with the badge showing "Installs on first use (about 200 MB)" until installed.
- Agent prompt (manifest): when to use which engine, and the loop: guide → project → write HTML → check → preview → voice → render.
- Read-only tools (`hyperframes_guide`, `_check`, `_preview`) need no approval, like `video_validate` today.
- Status panel words: "checking the composition", "rendering with HyperFrames · 62%".
- The Store skill "Faceless Explainer (HyperFrames)" stays as a text guide; its description says the real tools are in Video Studio.

## 5. Phases

| Phase | What | Size |
|---|---|---|
| **H0** | Spike, no product code: can a small model (the app's free route) write a valid 20-second composition from our guide and pass `check` within 3 tries? Also confirm the transcript format, audio tracks with our WAV, a catalog block offline, and behaviour on Node 20 | 0.5 day |
| **H1** | Runtime: pinned install on demand, ffprobe, Node 22 check, reuse Chrome and ffmpeg, `video_doctor` rows, telemetry and skills off | 1 day |
| **H2** | Tools: `hyperframes_guide`, `_project`, `_check`, `_preview`, `_render` with progress file; local GSAP and fonts; tests against real renders | 1.5 days |
| **H3** | `hyperframes_voice`: our TTS and word timings into the project; music track; captions (both routes) checked in Hindi and English | 1 day |
| **H4** | App: Engine option, manifest prompt, safe-tool list, status words, Store skill text | 0.5 day |
| **H5** | Eval and release v0.15.0: 8 prompts (launch promo, chart video, kinetic quote, Hindi explainer with voice, 9:16 and 16:9) on two models; pass rate, tries needed, render time; contact sheets reviewed | 1 day |

**H0 decides the shape.** If small models cannot write valid compositions reliably, H2 adds a "recipe" layer: the agent fills in a few ready compositions (kinetic title, chart, steps, quote) with variables, and writes free HTML only on capable models.

## 5b. H0 spike results (2026-11-11)

Run in a scratch folder with `hyperframes@0.9.33`. The draft guide is in `eval/hyperframes/guide-draft.md` (4.8 KB).

| Question | Result |
|---|---|
| Does our guide's example pass the checker? | **Yes.** `check --json` returns `ok: true`. It reports style warnings only (`nested_structure_needs_subcomposition`, `first_frame_empty`); the guide now tells the model to show the title on frame 0 |
| Checker output | One JSON object: `ok`, then `lint`, `runtime`, `layout`, `motion`, `contrast`, `craft`, `audio`, each with findings (`severity`, `code`, `message`). Good for fix hints. A check takes 2 to 3 seconds |
| Audio track with our WAV | **Works.** `<audio src="assets/voice.wav" data-start data-duration data-volume>` inside the root; the MP4 has AAC 48 kHz stereo |
| Transcript | `hyperframes transcribe <file>` **imports `.vtt`, `.srt` and `.json`** into `transcript.json` (`[{text, start, end, id}]`). Our SRT/VTT import as cues; word-level import from our `words.json` is to be confirmed in H3 |
| Catalog | 448 items (210 blocks, 238 components), listed as JSON. `add data-chart` wrote one editable file in under a second and returned the snippet to paste. Needs the network (GitHub raw) |
| Frames to look at | `snapshot --at 1,5` in about 2 seconds |
| Local GSAP (no CDN) | **Works** with `assets/gsap.min.js`. GSAP's licence is its own "no charge" standard licence, not MIT: we install it from npm at setup and do not copy it into our repo |
| Node 20 | Stops at once with "HyperFrames requires Node.js >= 22 (current: 20.20.0)". We show the same in plain words before calling it |
| Its own Chrome | By default it **downloaded its own Chrome: 261 MB** into `~/.cache/hyperframes/chrome`. With `HYPERFRAMES_BROWSER_PATH` set to the Chrome Video Studio already uses, it renders without that download (8 s clip: 12 s with full Chrome, 6.5 s with its headless one) |
| Paths we control | `HYPERFRAMES_BROWSER_PATH`, `HYPERFRAMES_FFMPEG_PATH`, `HYPERFRAMES_FFPROBE_PATH`, `HYPERFRAMES_CACHE_DIR` (all confirmed in the package; the first, third and fourth used in a real render) |
| Telemetry | The package contains PostHog and honours `DO_NOT_TRACK` and `HYPERFRAMES_NO_TELEMETRY`. We set both on every call. A network watch during a render is still to do in H1 |
| Render speed | 8 s of 1080×1920 with audio: 6.5 s (draft quality) |

**Changes to the plan from this:**
- H1 sets the four path variables, so the install is about **200 MB** (runtime plus ffprobe), not 460 MB, and nothing is written to `~/.cache/hyperframes`.
- Ignore the two style warnings above when deciding pass or fail; errors only.
- `hyperframes_preview` uses `snapshot`; `hyperframes_guide search` uses `catalog --json`.

**Not answered: can the app's models write valid compositions?** The only model reachable from here is the gateway's active route (LongCat-2.0, a reasoning model), and both attempts to have it write a 12-second composition **timed out** at the gateway tool; a one-word request worked. So there is no pass rate yet. Ways to get it: test through the app once H2's tools exist (the real conditions), or switch the gateway route to a faster model for the test (needs the user's OK).

## 5c. H1–H2 status (2026-11-11)

**Model test (the open H0 question), first data point:** on a retry the gateway's active model (LongCat-2.0) wrote a complete 8-second composition from the short rules. It **passed the real checker on the first try** and rendered. It is kept as `eval/hyperframes/samples/longcat-taskflow.html` and used in the tests. One sample is not a pass rate; H5 measures it properly through the app.

**Built:**
- `src/hyperframes/runtime.mjs`: pinned install on demand (`hyperframes@0.9.33`, `gsap@3.14.2`, and ffprobe when the computer has none) into `~/.opscode/agents/video-studio/hyperframes/`. Measured: **196 MB, 3 seconds**. Node 22 check with a plain message. Every call sets `DO_NOT_TRACK`, `HYPERFRAMES_NO_TELEMETRY` and `HYPERFRAMES_SKIP_SKILLS`, uses our Chrome, ffmpeg and ffprobe, and keeps its cache in our folder. Only 10 local commands are allowed; cloud, publish, share, billing and the rest cannot be called.
- `src/hyperframes/guide.mjs`: the rules (6.6 KB with the starter) and a valid starter for 9:16, 16:9 and 1:1.
- `src/hyperframes/tools.mjs`: `hyperframes_guide` (rules, block search, topics), `hyperframes_project` (init, add, info), `hyperframes_check`, `hyperframes_preview`, `hyperframes_render`. Registered in `TOOL_DEFS`, allowed in the manifest, and described in the agent prompt ("MOTION DESIGN WITH HYPERFRAMES").
- `video_doctor` has a "HyperFrames engine (optional)" row.

**Changes from the plan:**
- **Fonts are fully offline.** HyperFrames rejects font names it cannot supply. Every project gets our bundled Poppins and Hind (with Devanagari) in `assets/fonts`, and the starter declares them. Hindi renders correctly.
- **Our own checks** run before theirs: scripts or fonts loaded from the internet, and timers, `Date` or `Math.random`.
- **Render refuses a composition with errors.**
- **No live percentage for HyperFrames renders.** Its CLI prints no progress when it is not in a terminal. The progress file gets the stages only (checking, render, encode); `/btw` still shows the process as alive and busy.
- The CLI's `render --json` prints nothing on success, so success is "exit code 0 and the file exists".

**Checked:** 12 new tests in `test/hyperframes.test.mjs` (the engine tests run because the engine is installed here), full suite 151/151. By hand through the CLI bridge: init in all three formats, the model's sample, a Hindi page (frames looked at), a broken page (6 errors with fixes, not rendered), block search, adding `data-chart`, a wrong block name, a missing project. An 8-second 9:16 video rendered in about 10 seconds.

**Not done yet:**
- A network watch during a render to confirm nothing is sent (the two off switches are set, not verified on the wire).
- The app does not show these tools until Video Studio is released and the app's option is fixed (H4, H5).
- Renders use our full Chrome, which is about twice as slow as HyperFrames' own headless build (it falls back to screenshot capture). Worth revisiting if renders feel slow.

## 5d. H3 status (2026-11-11)

**Built:** `src/hyperframes/voice.mjs` and the sixth tool, `hyperframes_voice { dir, lines, language, voice, music, musicFile, musicVolume, captions }`.
- **Voice first.** The agent gives one spoken sentence per scene. The tool makes the voice with our TTS (Hindi or English picked from the text, or a named voice) and returns the exact `data-start` and `data-duration` of every scene (0.3 s before the voice, 0.5 s after, never under 2.5 s), plus the total. The page is then built to those times.
- **One sound file.** Voice and music are mixed by our existing mixer (music ducks under the voice, limiter) into `assets/audio.wav`. Music is one of our generated styles (default ambient), the user's WAV, or none.
- **Captions in the page.** `assets/captions.js` draws word-timed captions into `<div id="captions">` on the main timeline: karaoke (the spoken word lights up, default), line, or pop grouping from our caption code; Hind font; sized and placed for 9:16 or 16:9. The agent pastes three lines. This replaces the plan's idea of using HyperFrames' caption blocks, which would need the network and their fonts.
- Also written: `transcript.json` in HyperFrames' own word format, and `voice.json` with the scene times.
- The guide and the agent prompt now put the voice step before writing the page, and tell the agent to keep on-screen text short and out of the caption area.

**Checked on real renders:**
- Hindi 9:16, 3 lines, ambient music, karaoke captions: voice made in about 5 s; the page built to the returned times passes the check; frames looked at (captions correct in Devanagari, spoken words bright, coming words dim); MP4 is 11.1 s with AAC sound, mean level -15.8 dB, peak -1.0 dB.
- English 16:9, script split into 2 sentences, male voice, no music, line captions: passes and renders.
- Messages for no lines and a missing project.
- 6 new tests (18 in `test/hyperframes.test.mjs`), full suite **157/157**. The voice test skips itself when the voice service cannot be reached.

**Limits:**
- The voice needs the internet (Edge neural voices), as in storyboard videos.
- Changing a spoken line means running `hyperframes_voice` again and updating the scene times in the page.
- `video_captions` on the finished MP4 still works as the other caption route.

## 5e. H4–H5 status (2026-11-11)

**Privacy check (was open):** every network connection during check, preview and render was traced, with process names.
- **HyperFrames itself (the Node process) made no internet connection.** Telemetry is off in practice, not just by setting.
- All 294 internet connections came from Chrome's own network process, to Google addresses (its background services and DNS). That is the user's installed Google Chrome, the same one storyboard renders use.
- With the internet cut off (only the computer's own loopback left on), check, preview and render all succeed.

**Easier for models:** the fonts moved from seven long `@font-face` lines in the page to one line, `<link rel="stylesheet" href="assets/fonts.css" />`. A page without it gets a `fonts_not_loaded` error with the line to add. The guide is 6.3 KB.

**App (H4):**
- The "Faceless Explainer" option keeps its name and badge but now tells the agent to make a HyperFrames video with the six tools (it used to set a look that does not exist).
- `hyperframes_guide`, `hyperframes_check` and `hyperframes_preview` need no approval.
- Status words for the six tools and the install stage; HyperFrames tools count as long steps, so the process check covers them.
- The installed `faceless-explainer` skill (attached to Video Studio by default) got a short note at the top: use the HyperFrames tools, and their rules win over the skill's CSS-animation snippets and its old `"look": "faceless"` text. A backup of the old file is next to it.

**Model eval (H5): not done.** Three more requests to the gateway's model (a Hindi video with voice timings, a chart, a retry) all timed out; only the one earlier sample exists (valid on the first try). That sample was written under the earlier rules, so it was edited to the current ones (font link, Hind instead of Inter) before being used as a test fixture. The pass rate has to be measured in the app: watch how many `hyperframes_check` rounds real requests need. If small models struggle, add the "recipe" layer from section 5.

## 6. Done when
- "Make a 20-second kinetic launch video for my app, Hindi voice" produces an MP4 through the HyperFrames tools, with voice and captions, in 9:16 and 16:9.
- The agent passes `hyperframes_check` before every render, and a broken composition comes back with fix hints, not a crash.
- First use installs the runtime with a clear size and progress; a machine with Node older than 22 gets a plain message.
- Nothing is sent to HeyGen: no cloud calls, telemetry off (checked by watching network calls during a render).
- Character, story, 3D and stickman videos still use the storyboard engine; all existing tests pass.

## 7. Risks
- **Small models and raw HTML.** The main risk; H0 measures it and the recipe layer is the fallback.
- **Size:** about 200 MB more on disk (runtime plus ffprobe). On demand only.
- **Node 22.** Users on Node 18 or 20 cannot use this engine until they update Node; the storyboard engine still works for them.
- **Fast-moving dependency** (0.9.x, released today). Pinned version, upgraded only with our release.
- **No GPU:** shader transitions and 3D blocks may be slow or unavailable in software drawing; the guide steers to 2D blocks unless a GPU is found.
