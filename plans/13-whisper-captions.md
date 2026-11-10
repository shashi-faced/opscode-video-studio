# Plan 13: Word-by-word captions with Whisper

Status: planned (2026-11-10). Target version: v0.13.0.

## 1. Goal

Word-by-word captions for **any video**, with each word lit up at the moment it is spoken:

1. **Any video file**: recorded, uploaded, or cut with the editing tools (`video_trim`, `video_concat`, …). Today these get no captions at all.
2. **Generated videos** (storyboards and films): more accurate word timing, captions for dialogue lines too, and better lip-sync.

Whisper listens to the audio and returns every word with its start and end time. The caption engine groups the words into lines and draws them in the existing styles (`line`, `karaoke`, `pop`). It burns them into the video and also writes `.srt` and `.vtt` files.

Everything runs on the user's computer: no API key and no upload. Speech recognition works offline after a one-time model download.

## 2. What exists today

| Area | Today | Gap |
|---|---|---|
| Caption timing | Edge TTS `WordBoundary` metadata (`src/audio/tts.mjs` → `parseWordBoundaries`) | Works only for our own TTS voice. Some clips have no timings. Hindi timings are poor (the mouth stays open 98% of the time, plan 09). |
| Alignment | `alignWords()` in `src/timeline.mjs` matches script tokens to TTS words and fills gaps by word length | Matches by text only. If the spoken text is written differently (Whisper writing Hindi in Latin or Urdu letters), every match fails. |
| Grouping | `timedCaptions()` makes line, karaoke and pop chunks | Tied to narration text plus TTS words. It can't take a plain word list. |
| Drawing | Chrome runtime (`runtime.js` `seek()`), `.w` / `.on` / `.past` classes, pop scale-in | Only inside the storyboard renderer. It can't draw over an existing MP4. |
| What gets captions | Narration only | Dialogue lines (`sc.lines`) never get captions. |
| Subtitle files | none | No `.srt` or `.vtt` for YouTube or Instagram uploads. |
| Editing suite | `src/edit/*.mjs` (trim, concat, mix, reframe, inspect, gif) | **Only in the installed copy** `~/.opscode/agents/video-studio/0.3.0/src/edit/`, not in git. The tool definitions are hard-coded in the app (`VIDEO_STUDIO_EXTRA_TOOLS` in `packageAgents.ts`). See Phase 0. |

Facts about this machine that shape the plan:
- ffmpeg 7.0.2 static: it has libass, freetype and fribidi, but **no HarfBuzz**. Burning ASS subtitles would break Devanagari (vowel signs land in the wrong place). It also has no `whisper` filter, which needs ffmpeg 8 built with whisper.cpp.
- 8 CPU cores, 31 GB RAM, no NVIDIA GPU. Whisper must run fast enough on the CPU.
- 140 cached TTS clips with Edge word timings in `~/.opscode/agents/video-studio/cache/tts/`. These are free ground truth for the eval (Phase 8).

## 3. Engine choice

| Option | Install for users | CPU speed | Word timestamps | Hindi | Verdict |
|---|---|---|---|---|---|
| **transformers.js** (`@huggingface/transformers` 4.x, ONNX Whisper, `return_timestamps: 'word'`) | npm package plus onnxruntime-node (prebuilt for Linux, macOS and Windows) | good with quantized models | yes (cross-attention + DTW, on `*_timestamped` models) | small or medium needed | **Default.** Same install path on all 3 OSes, no compiler needed |
| whisper.cpp (`whisper-cli`, ggml models) | Linux needs cmake and a C++ compiler; no official Linux binaries | fastest on CPU | yes (`-ml 1`, `--dtw`) | same models | **Optional fast engine** when the binary is found (`OPSCODE_VIDEO_WHISPER` or on PATH) |
| faster-whisper / WhisperX (Python) | Python, venv, CTranslate2, torch for alignment | fast | WhisperX has the best alignment (wav2vec2) | good | No: a Python stack is too heavy to ship |
| ffmpeg 8 `whisper` filter | needs a custom ffmpeg build | fast | segment-level only | — | No |
| Cloud Whisper API | API key, uploads audio | — | yes | good | No: breaks offline use and privacy |

Both engines go behind one interface (`src/asr/engine.mjs`), so the choice can change after the Phase 1 spike.

### Models (downloaded on first use, like the 3D packs)

| Preset | Model | Size (q8) | Use |
|---|---|---|---|
| `fast` | whisper-base | ~80 MB | English, quick drafts |
| `balanced` (default) | whisper-small | ~250 MB | English, Hinglish, Hindi |
| `accurate` | whisper-medium or large-v3-turbo | ~800 MB | difficult audio, long films |

Models live in `~/.opscode/agents/video-studio/models/whisper/`. The assets manager installs them: `video_assets install whisper-small` downloads, checks the hash and shows progress. The model is never fetched without telling the user the size first.

**onnxruntime-node is large** (about 60–90 MB of native files). Keep it out of the agent's main `dependencies` so the store install stays small. Install it into `~/.opscode/agents/video-studio/asr/` on first use, the same way the 3D packs work. Phase 1 confirms this works.

## 4. Design

### 4.1 Modules (new)

```
src/asr/
  engine.mjs        pick engine (whisper.cpp if found, else transformers.js); one API
  transformers.mjs  transformers.js backend (pipeline, chunking, word timestamps)
  whispercpp.mjs    whisper-cli backend (spawn, parse JSON with word times)
  models.mjs        model presets, download + verify, cache dir, doctor info
  audio.mjs         ffmpeg -> 16 kHz mono float32 PCM; energy map for silence checks
  transcribe.mjs    transcribe(file, opts) -> Transcript; caching by audio hash
src/captions/
  align.mjs         known script <-> heard words (text match + timing DTW fallback)
  group.mjs         words -> caption chunks (line / karaoke / pop), shared by both paths
  formats.mjs       SRT, WebVTT (with word cues), ASS, words.json
  burn.mjs          draw captions onto an existing MP4 (Chrome caption stills + ffmpeg overlay)
  page.mjs          small HTML page that draws one caption state (same CSS as runtime.js)
```

### 4.2 The `Transcript` object (`*.words.json`)

```json
{
  "engine": "transformers", "model": "whisper-small", "language": "hi",
  "duration": 61.4, "audioHash": "sha1:…",
  "words": [ { "text": "नमस्ते", "start": 0.42, "end": 0.88, "p": 0.93 } ],
  "segments": [ { "start": 0.42, "end": 4.1, "text": "…" } ]
}
```

- Cache it by the SHA-1 of the extracted PCM plus model plus language. The same audio is never transcribed twice, and rendering a film again costs nothing.
- `p` is the word's probability. Words with p < 0.5 are reported to the agent as "check these words".

### 4.3 Transcription details

- **Audio**: `ffmpeg -i in -vn -ac 1 -ar 16000 -f f32le -` streamed into a Float32Array. A 1-hour file is about 230 MB of RAM, so audio longer than 20 minutes is processed in 10-minute windows with 5 s overlap. Words in the overlap are merged by time.
- **Chunking**: Whisper's 30 s window with `chunk_length_s: 30, stride_length_s: 5`.
- **Language**: `auto` (Whisper detects it) or a code. For generated videos, the language comes from the narrator voice (`hi-IN-…` means `hi`).
- **Hallucination guard**: Whisper invents text over silence and music. Drop words that fall where the audio energy is below the floor, and repeated n-grams ("Thank you. Thank you.") in quiet stretches. Never let a word run past the end of the audio.
- **Timing clean-up**: make times increase monotonically, give every word at least 60 ms, and cap a word at 1.5 s (Whisper sometimes stretches the last word over a pause).
- **Progress**: report `{ stage: 'listen', done, total }` per 30 s chunk through the existing `onProgress`, so the app shows a progress bar.
- **Determinism**: decoding is greedy (temperature 0) with a fixed thread count, so the same input gives the same words.json. A test checks this.

### 4.4 Alignment (when the words are already known)

Generated videos have the exact script, so Whisper only needs to supply **timing**, not spelling.

1. Normalize both sides (`norm()` from `timeline.mjs`, plus digits↔number words: "999" ↔ "nine ninety nine").
2. **Text pass**: the existing `alignWords` forward search, widened from 4 to 8 words.
3. **Timing pass (new)**: if fewer than 60% of tokens matched (typical when Hindi is transcribed in Urdu or Latin letters), use DTW. Cost = |cumulative share of script characters − cumulative share of heard time|. Each script token is pinned to the Whisper word boundaries closest in sequence. This works in any script because it uses only order and length.
4. Gaps are filled the way they are today.

The user can also pass a script to `video_captions` (`script: "file.txt"` or text). Then captions use their spelling (brand names, Hindi in Devanagari) with Whisper's timing.

### 4.5 Grouping (shared)

Refactor `timedCaptions()` into `group.mjs`: `groupWords(tokens /* {text, html, start, end} */, style, { maxWords, maxChars, minShow })`.
- line: up to 7 words or 42 characters (32 on vertical platforms), at most 2 lines.
- karaoke: same chunks, with per-word times.
- pop: 1–3 words, break at punctuation and at pauses over 0.35 s.
- Each chunk stays on screen at least 0.7 s, and stays until the next chunk if the gap is under 0.6 s (current rule).

`timeline.mjs` then calls `groupWords`, so generated videos and file captions look the same. The existing timeline tests must still pass unchanged.

### 4.6 Burning captions into an existing MP4 (`burn.mjs`)

ASS through libass is fast, but this ffmpeg has no HarfBuzz, so Hindi would render wrongly, and the styles would not match the studio's. Instead:

1. Build the list of **caption states**: each change of visible chunk or active word is one state with a `[start, end)` window. Pop adds 3 extra states for its 140 ms scale-in. About 2.5 states per second of speech.
2. Open `page.mjs` in the existing headless Chrome at the video's size, with a transparent background and the same fonts, CSS, platform safe zone and position as `runtime.js`. Screenshot each state to a PNG with alpha (`omitBackground`). Identical states are deduplicated by HTML hash. A 1-hour video is about 9,000 small PNGs, about 3 minutes.
3. Write an ffmpeg concat list (`file s0001.png` / `duration 0.42` …) and run one overlay pass:
   `ffmpeg -i in.mp4 -f concat -i states.txt -filter_complex "[0:v][1:v]overlay=0:0:format=auto" -c:a copy out.mp4`.
   Audio is copied, not re-encoded. Video is re-encoded at the source's codec settings (CRF 18, same fps).
4. Optional soft subtitles: `-c:s mov_text` embeds a subtitle track the viewer can turn off. That's for YouTube, not Reels.

Phase 4 measures this against ASS for English. If ASS is much faster and looks right, keep ASS as a fast path for Latin-only text.

### 4.7 New tool: `video_captions`

```js
{ name: 'video_captions',
  description: 'Add word-by-word captions to any video (recorded, uploaded or edited): Whisper hears every word and its time, then the captions are burned in and saved as .srt/.vtt. Also writes words.json, which can be edited and passed back to re-burn without listening again.',
  parameters: { input, style: line|karaoke|pop (default: from platform or pop), position: bottom|middle|top,
    language: 'auto'|'en'|'hi'|…, quality: fast|balanced|accurate, script: text or .txt path (exact wording),
    words: path to an edited words.json (skip listening), burn: true, formats: ['srt','vtt'],
    platform: (safe zones and caption size), highlight: color, translate: false (Whisper to English), out } }
```

Result: `{ ok, text, videoFile, files: { srt, vtt, words }, imageFile: one frame with captions, data: { language, words, lowConfidence: [...], seconds, engine, model } }`.

The text reply tells the agent what to show the user: the detected language, the word count, the words to check, and the paths.

### 4.8 Generated videos (storyboard and film)

New caption fields (the validator adds defaults, and old storyboards keep working):

```json
"captions": { "style": "karaoke", "timing": "auto", "lines": true }
```

- `timing`:
  - `tts` (today's behavior);
  - `whisper` (always listen to each voice clip);
  - `auto` (default): listen only when a clip has no TTS word timings, when fewer than 80% of tokens matched, or when the language is not English.
  - The result is cached next to the TTS clip as `<key>.heard.json`, so it costs nothing after the first render.
- `lines: true`: dialogue lines also get captions. For 3D and bubble-less scenes this is the main way to read dialogue. When speech bubbles are visible, keep line captions off by default so the text doesn't show twice.
- **Lip-sync**: `visemeTrack` uses the same better-aligned word times, which should fix the Hindi mouth-open problem.
- **Films**: each shot is cached, so a changed shot is the only one that listens again.
- **Sidecar files**: `video_render` and `video_film_render` also write `<title>.srt` and `.vtt` from the timeline, with or without Whisper. That's a quick win in Phase 3.

## 5. Phases

Each phase ends with tests passing (`npm test`), an entry in `plans/09-status-and-eval-log.md`, and a version bump.

### Phase 0: Put the editing suite in git ✅ (2026-11-10)
Done:
- `src/edit/*.mjs` is copied from the installed 0.3.0 copy.
- The 6 tools are in `TOOL_DEFS`, and in the CLI help with commands `trim`, `concat`, `mix`, `reframe`, `inspect` and `gif`.
- `manifest.json` has the allowed tools, the store text and an editing section in the prompt.
- `test/edit.test.mjs` has 11 tests. 75 of 75 pass.
- The `--image-path` bridge line now carries `videoFile`.

Left in the app on purpose: `VIDEO_STUDIO_EXTRA_TOOLS` and the `video_`/`doc_` fallback in `packageAgents.ts`. The store still installs v0.3.0 from GitHub, which has no editing tools, so removing them now would hide editing from users. Remove them in Phase 7, together with the catalog moving to a release that contains `src/edit/`.

Original scope:
- Copy `src/edit/*.mjs` and the `tools.mjs` wiring from `~/.opscode/agents/video-studio/0.3.0/` into the repo, and merge them onto the current `tools.mjs` (v0.12+).
- Add the 6 tool definitions to `TOOL_DEFS` and `agent/manifest.json`.
- Turn `tests/video_studio_ffmpeg_qa_test.js` (app repo) into `test/edit.test.mjs` here.
- Remove `VIDEO_STUDIO_EXTRA_TOOLS` and the `video_`/`doc_` name fallback from the app's `packageAgents.ts`, because the package now declares the tools itself.
- Done when: a fresh install from git has all editing tools, and the app tests pass.

### Phase 1: Spike and engine decision ✅ (2026-11-10)
**Decision:**
- Engine: transformers.js 4.3.2, with the `onnx-community/whisper-*_timestamped` models at q8.
- Default model: **small** (241 MB) for all languages.
- **base** (76 MB) is the `fast` choice, for English only.
- whisper.cpp is not built: it needs `cmake`, which this machine doesn't have, and users won't have it either. It stays an optional engine for later.
- The full numbers are in `plans/09-status-and-eval-log.md` (v0.13.0-dev). They come from `eval/asr/spike.mjs` and `eval/asr/long.mjs`.

**What Phase 2 must add, from the spike:**
1. **Fix a fixed timing shift.**
   - The real sound starts about 0.21 s into a clip. Edge reports the first word about 110 ms early; Whisper reports it 140–250 ms late.
   - Shift Whisper words earlier by a calibrated constant for each model. Check it in tests against the sound's onset.
   - With the shift removed, the error is 60 ms median in English and 31 ms in Hindi (target 80 ms).
2. **Guard against invented words. This is required.**
   - On 20 s with no speech, small heard "you" on silence, "Thank you." on pink noise and "Thank you for watching!" on music.
   - Use an energy floor for each word, plus a blocklist of Whisper's stock phrases when the clip is quiet or musical.
3. **Install a trimmed runtime.**
   - Plain `npm install` is 745 MB: onnxruntime-node ships binaries for every OS, plus a 260 MB NVIDIA (CUDA) library.
   - Keep only `bin/napi-v6/<platform>/<arch>` without `*providers_cuda*`, which is about 45 MB on Linux x64.
   - Also test whether `onnxruntime-web` (141 MB) can be removed in Node.
4. **Group short clips.** Whisper pads every window to 30 s, so a 5 s clip costs almost as much as 30 s (Hindi short clips: 0.8× real time). For generated videos, listen to a whole scene's voice track at once, not each line.
5. **Hindi spelling.** small writes correct Devanagari but makes spelling slips (35% WER, e.g. गाव for गाँव). Use the known script for spelling whenever we have it. For Hindi files with no script, test `turbo` in Phase 8.
6. **RAM.** small peaks at 1.7 GB, base at 0.9 GB. Load one model per process and free it after a job.

Original scope:
- Script `eval/asr/spike.mjs`: transcribe 20 cached TTS clips (10 English, 10 Hindi), whose Edge timings are ground truth, with transformers.js base and small, and with whisper.cpp if it builds.
- Measure:
  - word start error (median and p90);
  - word error rate (WER);
  - real-time factor on this 8-core CPU;
  - peak RAM;
  - the size of the extra install.
- Confirm: transformers.js word timestamps work with the chosen ONNX model; onnxruntime-node can be installed on demand into the agent home; Hindi output script (Devanagari or not).
- **Gate:** pick the engine and default model. Write the numbers in the log.

### Phase 2: Transcription core ✅ (2026-11-10)
Built:
- `src/asr/runtime.mjs`: install, trim, remove and load the engine. A fresh install takes 51 s and is 102 MB.
- `models.mjs`: `whisper-models.json` pins each model's revision and every file's SHA-256 (generated by `scripts/whisper-manifest.mjs`).
- `audio.mjs`: PCM extraction and the loudness map.
- `clean.mjs`: the timing shift, the invented-word guard and tidy.
- `transcribe.mjs`.
- `video_assets` sets `whisper-small` and `whisper-base`. The first model also installs the engine, and removing the last model removes the engine.
- `video_doctor` shows a speech line.
- `test/asr.test.mjs`: 17 tests (4 listen with the real model when it's installed), with English and Hindi fixtures in `test/fixtures/asr/`. 92 of 92 pass.

Changes from the design above, from what Phase 2 found:
- **Timing shift is measured per file, not fixed per model.** English is 127 ms late but Hindi only 35 ms, so the shift is the median of (heard start − sound onset) over words that follow a pause. If fewer than 3 such words are found, it uses en 0.13 s or other 0.05 s.
- **Language detection is our own.** transformers.js silently assumes English. We pick the language token the model scores highest on the loudest 30 s. It costs about 3 s per file and was right on 20 of 20 clips.
- **Windows are 2 minutes long with 5 s overlap,** not 10 minutes: that gives finer progress and the same result.
- **No per-word probability (`p`).** transformers.js doesn't return it. A "check these words" list will have to come from the guard's drop reasons and from the script comparison in Phase 3.
- **Stock phrases also match across pauses:** Whisper spread "Thank … you for watching!" over 4 s of music.
- **The `fast` model (base) switches itself to small** when the language isn't English, if small is installed. base writes Hindi in Urdu or Latin letters.
- `whispercpp.mjs` was not built (see Phase 1).

Original scope:
- `src/asr/*`: audio extraction, engine interface, models manager (install, remove and list through `video_assets`), cache, hallucination guard, timing clean-up, progress.
- `video_doctor` reports the speech engine and the installed models.
- Tests:
  - a synthetic 3-word clip (from Edge TTS, cached in the fixtures) gives 3 words in order, with starts within 150 ms;
  - the same input gives identical JSON;
  - pure silence and music-only input give no words;
  - a missing model gives a clear error with the install command.

### Phase 3: Caption engine refactor plus subtitle files ✅ (2026-11-10, branch `version13`)
Built:
- `src/captions/align.mjs`: a text pass with an 8-word search window.
- `group.mjs`: `groupWords`, with `maxChars` (42 wide, 32 on 9:16 and 4:5) and a minimum on-screen time of 0.7 s.
- `formats.mjs`: SRT, WebVTT with inline per-word timestamps, words.json, `writeSubtitles`.
- `timeline.mjs` now uses them. The existing timeline and karaoke tests pass unchanged.
- `video_render` and `video_film_render` write `<title>.srt` and `<title>.vtt`. Films used to write only `.srt`.
- The tool replies list the subtitle files.
- File names keep letters of any script: a Hindi title gave `video.mp4` before, and now gives `दिवाली-की-शुभकामनाएँ.mp4`.
- `test/captions.test.mjs`: 12 tests. 104 of 104 pass.

Change from the design: the "DTW pass" is simpler and works better.
- Between two words that matched by spelling, the unmatched script words take their times from the heard words between those anchors, shared out by letter count.
- With no matches at all (Hindi heard in Latin letters), the anchors are simply the start and end, so the whole script is laid over the heard words in order.
- On the Hindi fixture, the true script aligned to what Whisper heard (35% spelling slips) lands within 150 ms (median) of the true word times. That is a test.

Checked on a real render (Hindi Diwali example, 9:16): the `.srt` and `.vtt` parse in ffmpeg with 13 cues each, and the `.srt` embeds as an MP4 subtitle track (`mov_text`).

Original scope:
- `src/captions/align.mjs` (text pass and DTW pass), `group.mjs`, `formats.mjs`.
- `timeline.mjs` uses them. The existing timeline and karaoke tests pass without changes to their expectations.
- `video_render` and `video_film_render` write `.srt` and `.vtt` next to the MP4.
- Tests:
  - DTW aligns a Devanagari script to Latin-letter heard words within one word;
  - SRT and VTT validate (timestamps increase, no overlaps, UTF-8);
  - the Devanagari title case (file named `video.mp4`) gets a proper name.

### Phase 4: Burn-in onto any MP4 ✅ (2026-11-10, branch `version13`)
Built:
- `src/captions/page.mjs`: a transparent caption page.
  - It uses the renderer's own `TEMPLATE_CSS`, theme fonts and platform safe zones.
  - `--u` is 1% of the shorter side, and the frame class comes from the shape, so any video size works.
  - `captionStates()` lists the distinct things to draw: a blank between captions, each lit word, and the pop growth steps.
- `src/captions/build.mjs`: `captionsFromWords` (heard words) and `captionsFromScript` (the user's spelling with heard timing), plus `maxCharsFor`.
- `src/captions/burn.mjs`:
  - `probeVideo` decodes one frame, so the size is read after rotation (a phone video shot upright stays upright).
  - `burnCaptions` draws each distinct state once in headless Chrome as a transparent PNG, then runs one ffmpeg pass. That pass is a concat list with durations and an `overlay`, and the audio is stream-copied.
- `test/burn.test.mjs`: 7 tests. 111 of 111 pass.
- `eval/captions/burn-bench.mjs` compares this with ASS through libass.

Change from the design: the caption CSS was not moved into a separate `captions.css`. The page reuses `TEMPLATE_CSS` directly, which keeps one source with no copy.

Results:
- **Hindi:** our burn draws Devanagari correctly. ASS breaks the ि sign: "परिवार दिवाली" comes out as "परविार दविाली". So ASS is not used, not even as a fast path for Latin text, because both kinds of text would then look different.
- **Speed:** ours is 1.26–1.38× slower than ASS (table in `09`), almost all of it in video encoding.
- **Audio** is bit-identical: the MD5 matches the input.

Still open:
- The 5-minute benchmark loops one 10 s clip, so only 102 distinct stills were drawn for 2,123 states. Real speech has few repeats: about 2,000 stills per 5 minutes. Phase 8 measures a real 10-minute talk.
- Listening plus burning took about 1.05× the video's length (5 min → 5.3 min). The Phase 8 target "10 minutes in under 8" is not met yet. Ways to get there:
  - encode with `-preset veryfast`;
  - draw only the caption band instead of the full frame;
  - listen while drawing.

Original scope:
- `burn.mjs` and `page.mjs`. Reuse the caption CSS from `runtime.js` (move it to a shared `captions.css`), the theme fonts and the platform safe zones.
- Benchmark against ASS on 60 s and 10 min clips.
- Tests:
  - output duration and frame count match the input;
  - audio is bit-identical (stream copy);
  - a sampled frame inside a word window shows highlighted pixels at the caption position;
  - a Hindi caption is visually checked once (screenshot in the log).

### Phase 5: `video_captions` tool, docs and agent guide ✅ (2026-11-10, branch `version13`)
Built:
- `src/captions/tool.mjs` (`videoCaptions`):
  - the style comes from the given value, an alias, the platform, or else the shape (tall → pop, wide → karaoke);
  - `script` gives the user's spelling with heard timing, and reports how many of its words were heard as written;
  - `words` re-burns from an edited `.words.json` without listening;
  - `burn: false` writes the files only;
  - a preview frame is returned to the chat.
- `video_captions` is in `TOOL_DEFS`.
- The CLI has a `captions` command.
- Manifest: allowed tool, store text and sample prompt. The prompt says when to use the tool and to ask before the 340 MB download.
- README section "Captions on any video".
- `test/captions-tool.test.mjs`: 6 tests. 117 of 117 pass.

Changes from the design:
- **No `captionsDoc` in `docs.mjs`.** `video_templates` is only read before writing a storyboard, which never happens for captions. The guidance went into the tool description and the system prompt, which the agent always has.
- **No `translate` option yet.** Whisper can translate into English, but the captions would then not match the speech timing word for word. Left for later.

Bug found and fixed on a real reel: Whisper heard "30%" as "30" plus "%". The guard dropped the "%" as an invented word, so the caption read "30 off".
- `glueSymbols` now joins %, punctuation and closing marks to the word before, and ₹ $ € £ # @ and opening marks to the word after.
- `CLEAN_VERSION` was bumped to 2, so cached transcripts are heard again.

Checked by hand:
- **27 s Instagram reel:** 50 words, pop, done in 28.5 s.
- **Hindi 9:16 with the script:** 87% of the script heard as written; karaoke in Devanagari.
- **Fix a word** in `.words.json` and re-burn as `line`: 15 s, with no listening.
- **Failures** give the agent a next step:
  - no sound;
  - music only ("No speech was heard", 4 invented words removed);
  - no model ("ask the user first, 340 MB").

Original scope:
- Tool, CLI command (`opscode-video captions in.mp4 --style pop`), README section.
- A short `captionsDoc` in `docs.mjs` (under 1 KB) that tells the agent when to use it: "add subtitles", "word by word captions", "caption my reel".
- Re-burn from an edited `words.json` without listening again.

### Phase 6: Generated videos use Whisper ✅ (2026-11-10, branch `version13`)
Built:
- `captions.timing` (`auto` | `tts` | `whisper`; aliases accurate, listen, heard → whisper; voice, fast → tts) and `captions.lines` in `spec.mjs` and `validate.mjs`.
- `synthesize()`:
  - with `auto`, it listens only where a part's voice timings are missing, or match fewer than 80% of its words;
  - with `whisper`, it always listens;
  - it listens to the **whole scene's voice track once** (48 kHz averaged down to 16 kHz), not each clip, then splits the heard words back into parts;
  - without the model it falls back to the voice timings with a note, and the render never fails.
- Renders and films report `captionTiming`.
- `timeline.mjs` builds dialogue captions when `lines: true`.
- `transcribe()` loads a model once even when film batches call it in parallel, and runs one listening job at a time.
- `test/timing.test.mjs`: 8 tests. Its listening tests use a private home with a seeded voice cache, so no internet is needed. 125 of 125 pass.

**Change from the design: lip-sync is fixed by the audio, not by Whisper.** Measured on the fixtures, Whisper timing did not change the mouth-open share:

| Clip | Old | Whisper | Real sound |
|---|---|---|---|
| Hindi | 1.00 | 1.00 | 0.74 |
| English | 0.85 | 0.81 | 0.54 |

Fluent speech has almost no pause over 120 ms between words, and that was the only time the mouth closed. So `quietSpans()` finds stretches of at least 60 ms where each character's voice clip is quiet, and `applyQuiet()` rests the mouth there.
- This brings the Hindi fixture to 0.75 and English to 0.56, matching the real sound.
- On `examples/kids-story.json` (Hindi, 6 lines), the share drops from 0.86 to **0.67** (target under 0.70), for every render, with or without Whisper, at no cost.

Also changed: `auto` does **not** listen just because the language isn't English. Edge's Hindi word times match the Devanagari script, and listening costs about 30 s to load the model plus 0.5× real time.

Checked on a real render: `kids-story-3d.json` (Hindi, 3D) with `timing: whisper, lines: true`.
- 11 parts were timed by listening.
- The 52 s video rendered fine, with `.srt` and `.vtt`.
- Dialogue captions appear under the scene, repeating the bubble text, which is why `lines` is off by default.

Original scope:
- `captions.timing` and `captions.lines` in `spec.mjs` and `validate.mjs`, with aliases (`whisper`, `accurate` → timing whisper).
- `synthesize()` runs the heard-timing check per clip (cached), and `pipeline.mjs` passes better word lists to `buildTimeline`.
- Dialogue captions, and visemes from the aligned words.
- Tests:
  - an old storyboard renders the same timeline as before (`timing: tts`);
  - `auto` falls back without failing when no model is installed (with a warning);
  - Hindi lip-sync: the mouth is open less than 70% of the time.

### Phase 7: App ⏳ (2026-11-10): code done, release not published
Package (`opscode-video-studio`, branch `version13`): version 0.13.0 in `package.json` and `agent/manifest.json`.

App (`Hecto`, branch `version13`, not committed):
- `agentStoreCatalog.ts`:
  - version `0.13.0`, with the tarball at tag `v0.13.0`;
  - the description, a "Word-by-word captions on any video" section and two caption sample prompts;
  - setup fields `captions` (Pop / Karaoke / Subtitles / Off) and `captionTiming` (Fast / Accurate), the latter hidden when captions are off.
- `packageAgents.ts`: `VIDEO_STUDIO_EXTRA_TOOLS` and the `video_`/`doc_` name fallback are removed. The package now declares all 17 tools itself.
- `installedAgentsStore.ts`: **bug fixed.** The start-up refresh copied the catalog's `version` onto the installed record. With a new catalog version, the store would then think the update was already installed: it would never show "Update", and the old package would keep running. The refresh now updates only the store text.
- The type check (`tsc --noEmit`) passes.

Install check: the app's install steps (unpack the tag archive, `npm install`, `agent-manifest`) were run on a `git archive` of the working tree in a throwaway home. The archive is 0.94 MB and 45 MB once installed, and the manifest reports v0.13.0 with 17 tools.

Not done (needs the owner):
1. Commit the app changes.
2. Commit and push `version13` of the package, then create and push the tag `v0.13.0`. Until the tag exists, the store's download returns 404, the same failure seen with v0.3.0.
3. Rebuild the app (`npx tauri build --no-bundle`), then use "Update" in the store.

The first-use progress bar for the model download is not built: the app shows no live tool progress yet (the same gap as render progress, noted in plan 12).

Found, not changed (not part of this plan): the app's "Faceless Explainer" look sends `"look": "faceless"`, which the package rejects ("look: "faceless" is not allowed"), so the agent must fix it and validate again.

Original scope:
- Catalog: description and sample prompts ("🔤 Add word-by-word captions to video/demo.mp4", "Make Hindi subtitles for my reel").
- Setup panel: a "Captions" choice (Line / Karaoke / Pop / Off) and a "Caption timing: Fast (voice) / Accurate (Whisper)" choice.
- The first use asks before downloading the model (size shown), with a progress bar from `onProgress`.
- Release: tag `v0.13.0` on GitHub, point the catalog's `version` and `tarball` at it (the update failure we saw came from missing tags), and rebuild the app.

### Phase 8: Eval and tuning (~1.5 days)
`eval/captions/` with 12 clips: English narration, Hindi narration, Hinglish, our TTS with music, a phone recording, a noisy outdoor clip, a 2-speaker talk, a song (should give few or no words), 20 s of silence, a 10-minute talk, a 1-hour film render, and a clip edited with `video_trim` plus `video_concat`.

| Metric | Target |
|---|---|
| Word start error vs ground truth (TTS clips) | median ≤ 80 ms, p90 ≤ 200 ms |
| WER, English (balanced) | ≤ 8% |
| WER, Hindi (balanced) | ≤ 20% (with `script` given: 0% spelling, timing only) |
| Words invented over silence or music | 0 on the silence clip; ≤ 2 per minute on music |
| Speed, `balanced`, 8-core CPU | listening ≤ 0.5× real time; a 10-minute video captioned in under 8 minutes in total |
| 1-hour video | finishes, memory under 3 GB, can resume from cache |
| Determinism | same input → identical words.json and identical MP4 frames |
| Generated videos, `timing: auto` | no regression on the plan 12 eval set; Hindi lip-sync fixed |

Then tune: the hallucination floor, grouping limits per platform, pop timing, and the default model per language.

**Total: about 12 working days.**

## 6. Risks and how we handle them

| Risk | Plan |
|---|---|
| Model download (250 MB) is too big for some users | `fast` model (80 MB) offered; ask before downloading; captions from TTS still work with no model |
| onnxruntime-node install fails on some OS | whisper.cpp engine as fallback; TTS-only captions still work; doctor explains the fix |
| Whisper writes Hindi in the wrong script | `language: 'hi'` forced; DTW alignment ignores the letters; `script` parameter keeps the user's spelling |
| Hallucinated words over music or silence | energy floor, repeat filter, low-probability report, no words past the audio end |
| Slow on long videos | cache by audio hash; 10-minute windows; whisper.cpp fast path; progress bar; film shots cached |
| Burn-in slower than ASS | dedupe states; ASS fast path for Latin-only text if Phase 4 shows it's worth it |
| Editing suite lost on update (it isn't in git) | Phase 0 first |

## 7. Licenses
Whisper weights (MIT), transformers.js (Apache-2.0), onnxruntime (MIT), whisper.cpp (MIT). All are fine to ship and download. Add them to the README credits.
