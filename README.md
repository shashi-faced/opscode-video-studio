# Video Studio Agent (`@opscode/video-studio`)

A downloadable Opscode agent that turns a **storyboard JSON** into an animated MP4 with motion graphics, real screenshots, voiceover, music and captions. Designed so that **small and free models** can make good videos: the model only writes JSON; the engine does design, timing, animation, audio and QA.

See [plans/00-overview.md](plans/00-overview.md) for the design and why it works with weaker models.

## Quick start

```bash
git clone https://github.com/shashi-faced/opscode-video-studio.git
cd opscode-video-studio
npm install
node bin/opscode-video.mjs doctor            # checks Chrome, ffmpeg, fonts, voices
node bin/opscode-video.mjs check examples/reel.json    # layout QA + contact sheet
node bin/opscode-video.mjs render examples/reel.json   # → examples/out/opscode-agent-reel/*.mp4
npm test
```

## What it makes (v0.2)

Set `"type"` in the storyboard; it picks the scene recipe, theme and music.

| Type | For | Main templates |
|---|---|---|
| `story` | kids stories, fables, cartoons | `story`, `dialogue` |
| `ad` | products, shops, offers | `title`, `feature`, `bullets`, `stat`, `cta` |
| `demo` | app walkthroughs with real screenshots | `feature`, `split`, `steps` |
| `explainer` | teaching an idea | `story`, `dialogue`, `steps`, `bullets` |
| `howto` | step-by-step guides, recipes | `steps`, `feature` |
| `greeting` | Diwali, birthday, thank-you | `story` with the `festival` background |
| `announcement` | news, launches, events | `title`, `bullets`, `cta` |
| `reel` | 15–30 s vertical shorts | any, 9:16 |

**Characters** (`cast` + `story`/`dialogue` scenes): 21 kinds (boy, girl, man, woman, grandpa, grandma, rabbit, cat, dog, bear, panda, fox, elephant, lion, mouse, owl, robot, star, sun, moon, cloud), 8 poses (idle, wave, walk, jump, cheer, point, think, dance), 6 moods, entrances (walk-in, pop, fly-in, fade). In dialogue scenes each line is spoken in that character's own voice (picked from the narrator's language, with pitch by age) with a speech bubble and a moving mouth.

**Backgrounds**: meadow, forest, mountains, beach, village, city, sky, space, underwater, home, bedroom, classroom, office, festival — outdoor ones by `day`, `sunset` or `night`.

See [examples/kids-story.json](examples/kids-story.json) for a complete Hindi story.

## Platforms and captions

Set `"platform"` to where the video will be posted. It sets the frame size, keeps text out of the areas the app covers with its own buttons, picks the caption style and writes extra files next to the MP4.

| `platform` | Frame | Captions | Extra files |
|---|---|---|---|
| `insta-reel` | 1080×1920 | pop | cover, 3:4 profile-grid cover |
| `youtube` | 1920×1080 | line | 1280×720 thumbnail, title/description with chapters |
| `youtube-short`, `insta-story`, `tiktok` | 1080×1920 | pop | cover |
| `insta-post` | 1080×1350 (4:5) | line | cover |
| `whatsapp-status` | 1080×1920 | pop | split into 60 s parts |
| `square`, `linkedin` | 1:1 / 16:9 | line | cover / thumbnail |

`captions` is `true`, `false`, or `{ "style": "line" | "karaoke" | "pop", "position": "bottom" | "middle" | "top", "timing": "auto" | "tts" | "whisper", "lines": false }`.

- `timing: auto` (the default) uses the voice's own word times. It listens with Whisper only where those are missing or don't match the text.
- `whisper` always listens.
- Either way, it needs `video_assets install whisper-small`; without the model it falls back to the voice's times and adds a note.
- `lines: true` gives dialogue lines captions too. That's useful when bubbles are off, but they repeat the bubble text.
- Characters' mouths rest wherever the voice audio is quiet, so lip-sync looks natural in fluent Hindi as well as English.
 Captions are timed to the spoken words using the voice's word timings: `pop` shows 1–3 big words at a time (reels), `karaoke` lights up the word being spoken. Examples: [insta-reel.json](examples/insta-reel.json), [youtube-ad.json](examples/youtube-ad.json). Every render also writes `<title>.srt` and `<title>.vtt` next to the MP4, with the same caption chunks. Upload them with the video; the `.vtt` carries per-word times. Lines are at most 42 characters, or 32 on 9:16 and 4:5 frames, with at most 2 lines per cue.

## Stickman look

`"look": "stickman"` with `"art": { "style": "…" }` draws the whole video as hand-drawn stick figures, free and offline.

- **Ten styles:** `line-art`, `classic-bw` (light, or `"theme": "dark"`), `modern-pop`, `retro-tv`, `cozy-color`, `cozy-story`, `prehistoric`, `historical`, `amber-noir`, `noir-thriller`.
- **People** (boy, girl, man, woman, grandpa, grandma) become stickmen with:
  - a hand-drawn line;
  - 13 faces: happy, sad, surprised, angry, worried, sleepy, shocked, frustrated, sweating, crying, grin, deflated, suspicious;
  - family details: hair, a bun, glasses, kids drawn smaller;
  - real mouth shapes that follow the voice;
  - every pose, walk and entrance.
- **Animals** keep their shapes, drawn flat in ink.
- **Props:** `"props": [{ "icon": "phone", "enter": "drop" }]` puts objects next to the characters, from 144 icons (Lucide, ISC) with plain-word aliases like money, idea, deadline and notification. They can pop, drop, slide, draw themselves or wobble.
- **Text:** handwriting fonts Caveat and Kalam (Kalam includes Devanagari), so Hindi headlines look handwritten too. Highlighted words get a self-drawing underline.
- **Painted scenes** from an image model come later (plan 14 Phase 3).

Examples: [stickman-explainer.json](examples/stickman-explainer.json) (16:9, English) and [stickman-hindi.json](examples/stickman-hindi.json) (9:16, Hindi).

## Captions on any video

`video_captions` (CLI: `captions`) adds word-by-word captions to a video that was not made here: recorded, uploaded, or cut with the editing tools.

1. Whisper hears every word and when it is said, on this computer (no upload, no API key). The language is detected automatically: English, Hindi and more.
2. Invented words over music or silence ("Thank you for watching!") are removed.
3. The captions are drawn with the same styles as rendered videos (`pop`, `karaoke`, `line`), kept clear of the platform's buttons, and burned into `<name>-captions.mp4`. The sound is copied unchanged.
4. It also writes `.srt` and `.vtt` subtitles and an editable `.words.json`.

- **Exact spelling:** pass `script` (text or a `.txt`). Captions then use your words (names, brands, Hindi in Devanagari) with the heard timing.
- **Fix a word:** edit its `text` in `.words.json` and run again with `words`: it burns again without listening.
- **One-time setup:** `video_assets install whisper-small` (240 MB model, plus a 100 MB speech engine). `whisper-base` (76 MB) is a faster English-only option.

## 3D look

Add `"look": "3d"` to a story to draw its story and dialogue scenes as a 3D cartoon:
- **Characters:** cel-shaded with ink outlines, built in code for all 21 kinds, with every pose and mood.
- **Worlds:** all 14 places in day, sunset and night.
- **Camera:** the camera directs itself with film rules:
  - an establishing shot when the place changes;
  - a two-shot to open a conversation;
  - over-the-shoulder shots and close-ups on whoever speaks;
  - reaction shots of the listener on strong feelings;
  - never the same shot size three times running.

  To override it, set `"camera"` per scene (`wide`, `medium`, `close`, `over-shoulder`, `dolly-in`, `orbit`, `crane-up`, …) or `"shot"` per line. `"cinematic": true` adds letterbox bars, subtitles in the bar, and a gentle hand-held camera. Example: [cinematic-3d.json](examples/cinematic-3d.json).
- **Worlds:** with the optional **3D world pack** (55 CC0 Kenney models, 2.2 MB: `opscode-video assets install 3d-world`), places get real furniture, trees, houses, city buildings, a pirate ship, spacecraft and food tables.
  - Scenes can add `"weather"`: rain, snow, leaves, fireflies or sparkles.
  - A character can stand `"near"` a prop (tent, sofa, desk, bed, campfire, house…).
  - `"scenery": "built-in"` keeps the places made in code.
- **Any character:** a cast member can have a `"design"` instead of a fixed kind: a body plan (biped, animal, quadruped, bird, fish, snake, blob, robot) plus parts (ears, eyes, snout, horns, hair, tails, wings, shell, fins, spikes, mane…), an outfit and accessories (crown, wizard hat, flute, umbrella…). This covers peacock kings, crocodiles, dragons, ghosts, snowmen and aliens.
  - `opscode-video character sheet <storyboard> <id>` draws a turnaround sheet (front, 3/4, side, back, three moods, walk) to check a design.
  - `character save <storyboard> <id>` keeps it in the character library, and any storyboard can then use `"design": "library:<id>"`.
  - 20 ready-made designs ship with it (peacock king, crocodile, dragon, tortoise, monkey, ghost, astronaut, alien, wizard…): `"design": "preset:dragon"`.
- **Speech:** characters **lip-sync** their lines in English and Hindi (mouth shapes worked out from the text and the voice's word timings), look at whoever is talking, and nod. Bubbles follow their heads; voice and captions work as before. Example: [lipsync-en-3d.json](examples/lipsync-en-3d.json).
- **Assets:** three.js (MIT) is bundled, so nothing has to be downloaded. An optional **3D character pack** (11 rigged, animated CC0 models by Quaternius, 5.8 MB) installs with `opscode-video assets install`, or the `video_assets` tool. Only links and checksums ship with Video Studio. With the pack, the panda, robot, fox, woman and dog use these models by default; set a cast member's `"model"` to `pack` or `built-in` to choose.
- **Speed:** on an Intel laptop GPU the 52 s example ([kids-story-3d.json](examples/kids-story-3d.json)) renders in **53 s** with voice. 3D frames are composed inside the page instead of screenshotted, and 4 GPU workers each render a chunk (`--workers N`). With no GPU, 3D draws at 2/3 resolution while the text stays sharp.

- **In the Opscode app:** pick **Look → 3D cartoon** in the Video Studio setup panel, then choose 3D characters, your saved characters and places from picture galleries. The agent reads a short 3D guide (`video_templates` with `look: "3d"`). Render results report the 3D speed and whether the GPU was used; `doctor` checks the GPU.
- **Gallery pictures** for the app: `node scripts/gallery-3d.mjs <dir>` (41 characters, 14 places, about 7 s).
- **Eval:** `eval/3d/` has 10 prompts and a harness that scores a model's replies: validation rounds, preview issues, critic score, render speed, lip-sync and frame determinism (`node eval/3d/run.mjs ask|score|report`).

The plan for richer assets, lip-sync and camera work is in [plans/12-3d](plans/12-3d/00-overview.md).

## Long videos (films)

For anything longer than about 2 minutes, write a **film** instead of a storyboard: the same top fields plus `sequences`, each a list of short **shots** (a shot is a normal scene of 3–8 s, with an optional `id`).

```json
{ "title": "Miko and the Star", "type": "story", "format": "16:9", "voice": { "voice": "hi-IN-SwaraNeural" }, "cast": [ ... ],
  "sequences": [
    { "id": "night", "title": "A star falls", "shots": [ { "id": "open", "template": "story", ... }, ... ] },
    { "id": "journey", "title": "To the owl", "music": { "style": "playful" }, "shots": [ ... ] } ] }
```

`film-render` builds every shot as its own video segment:
- Segments render on several Chrome workers at once (CPU cores − 2, at most 6), drawing on the graphics card when Chrome can use it.
- Each segment is cached by a hash of exactly what it draws, so after an edit only the changed shots render again, and a stopped render resumes where it left off.
- Voice and music are made once for the whole film; each sequence gets its own music cue, crossfaded at the cut.
- The segments are joined without re-encoding.
- Output: the MP4, `.srt` and `.vtt` caption files, a chapters list (one chapter per sequence) and a poster.
- The project folder `out/<title>/` holds `project.json` (status of every shot) and `shots/<id>/`.

A plain storyboard also works with `film-render` (one sequence, one shot per scene).

## Commands

| Command | What it does |
|---|---|
| `doctor [--install]` | Check / install Chrome, ffmpeg, voice access |
| `templates [type] [platform]` | Storyboard reference (what the agent reads), optionally for one video type and platform |
| `init <dir> [--format 9:16]` | Starter storyboard |
| `validate <file>` | Errors with exact fixes; auto-corrects common slips |
| `check <file>` | Layout checks + `contact-sheet.jpg` |
| `render <file> [--out x.mp4] [--fps 30] [--no-voice]` | Full video |
| `film-render <film.json> [--workers 6] [--only id1,id2] [--force] [--no-voice]` | Long video from sequences of shots: parallel, cached, resumable |
| `film-status <film.json>` | Which shots are done, failed or not rendered yet |
| `assets [list\|install\|remove] [3d-starter\|3d-world]` | Optional 3D character and world packs |
| `character [sheet\|save\|list] <storyboard> <id>` | Turnaround sheet of a designed 3D character; character library |
| `capture <url> <out.png> [--crop x,y,w,h]` | Screenshot a page or local app |
| `trim <in.mp4> [out.mp4] [--start 5] [--end 20] [--duration 15] [--mode exact\|fast]` | Cut a clip (frame-accurate, or instant lossless copy) |
| `concat <a.mp4> <b.mp4> ... [--out merged.mp4]` | Join clips in order; sizes and audio matched |
| `mix <in.mp4> <music.mp3> [out.mp4] [--mode mix\|replace] [--audioVolume 0.3]` | Add music under a video, or replace its sound |
| `reframe <in.mp4> [out.mp4] --format 9:16\|16:9\|1:1\|4:5 [--style blur_pad\|crop\|fit]` | Change the shape (16:9 to reel, square, feed) |
| `inspect <in.mp4>` | Length, size, fps, codecs, bitrate |
| `gif <in.mp4> [out.gif] [--start 0] [--duration 5] [--fps 15] [--width 480]` | Short GIF with an optimised palette |
| `captions <in.mp4> [out.mp4] [--style pop\|karaoke\|line] [--language auto\|en\|hi] [--script words.txt] [--words edited.words.json] [--platform insta-reel] [--no-burn]` | Word-by-word captions on any video (Whisper, on this computer) |
| `tool <name> --b64 <json>` | Bridge used by the Opscode app |
| `agent-manifest` | Manifest + tool definitions read by the app on install |

The last stdout line of every command is one JSON object.

## How it works

```
storyboard.json → validate/normalise → Edge TTS (cached) → timeline (scene length = voice length)
  → compile HTML (templates, themes, mascots, auto-fit text, captions, seekable runtime)
  → headless Chrome: seek(frame) + screenshot  ──┐
  → music synth (JS) + voice mix with ducking ──┴→ ffmpeg (H.264 + AAC, −14 LUFS) → MP4
```

- Rendering is frame-stepped (`__video.seek(ms)`), so output does not depend on machine speed.
- Text can never overflow: the runtime shrinks it to fit, and `check` reports anything that had to shrink a lot.
- Fonts are bundled, so renders work offline (voice needs internet; without it, captions still show).

## In the Opscode app

The app lists this agent in the Agent Store as **Download**. Installing downloads the tagged GitHub archive (`v<version>`, about 1 MB) into `~/.opscode/agents/video-studio/<version>`, runs `npm install` (playwright-core + msedge-tts, ~19 MB), then `doctor --install`, and reads `agent-manifest`. The agent's `video_*` tools are routed to `node bin/opscode-video.mjs tool …` by the generic package-agent hook (`src/services/packageAgents.ts` in the app).

## Layout

```
agent/manifest.json   prompt, allowed tools, store text
bin/opscode-video.mjs CLI
src/schema/           spec (single source of truth) + validator/normaliser
src/compiler/         templates, themes, mascots, runtime.js, compile
src/render/           browser, render pipeline, capture
src/audio/            tts, synth, mix, wav
src/qa/               layout checks + contact sheet
src/deps/             locate Chrome/ffmpeg, doctor
src/edit/             editing any video file: trim, concat, mix, reframe, inspect, gif
src/art/              stickman art styles, props (icons)
examples/             reel.json (9:16), ad.json (16:9), free-model-diwali.json
plans/                design and phase plans
```

## Requirements

- Node.js 18+
- Chrome or Chromium (found automatically; `doctor --install` downloads chrome-headless-shell if missing)
- ffmpeg (system ffmpeg is used; `doctor --install` downloads a static build only if none is found)

## Releasing

Bump `version` in `package.json` and `agent/manifest.json`, commit, then `git tag v<version> && git push --tags`. Update the version and tarball URL in the Opscode app catalog (`src/models/agentStoreCatalog.ts`).
