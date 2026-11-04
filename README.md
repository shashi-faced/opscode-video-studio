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

## Commands

| Command | What it does |
|---|---|
| `doctor [--install]` | Check / install Chrome, ffmpeg, voice access |
| `templates [type]` | Storyboard reference (what the agent reads), optionally for one video type |
| `init <dir> [--format 9:16]` | Starter storyboard |
| `validate <file>` | Errors with exact fixes; auto-corrects common slips |
| `check <file>` | Layout checks + `contact-sheet.jpg` |
| `render <file> [--out x.mp4] [--fps 30] [--no-voice]` | Full video |
| `capture <url> <out.png> [--crop x,y,w,h]` | Screenshot a page or local app |
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
examples/             reel.json (9:16), ad.json (16:9), free-model-diwali.json
plans/                design and phase plans
```

## Requirements

- Node.js 18+
- Chrome or Chromium (found automatically; `doctor --install` downloads chrome-headless-shell if missing)
- ffmpeg (system ffmpeg is used; `doctor --install` downloads a static build only if none is found)

## Releasing

Bump `version` in `package.json` and `agent/manifest.json`, commit, then `git tag v<version> && git push --tags`. Update the version and tarball URL in the Opscode app catalog (`src/models/agentStoreCatalog.ts`).
