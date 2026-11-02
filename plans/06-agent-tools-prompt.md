# Phase 6 — CLI, agent tools and system prompt

## CLI (`bin/opscode-video.mjs`)
All commands print **one JSON object** on the last line of stdout (progress lines before it are JSON lines with `"progress"`), so the app and models can parse results without guessing.

| Command | Purpose |
|---|---|
| `doctor [--install]` | Check Node, Chrome, ffmpeg, network for TTS; install missing pieces |
| `templates` | List templates, fields, limits, themes, voices, music styles, with a tiny example each |
| `init <dir> [--format 9:16]` | Write a starter storyboard + assets folder |
| `validate <storyboard>` | Schema + semantic validation with fix hints |
| `check <storyboard>` | Build + layout QA + contact sheet |
| `preview <storyboard>` | Build HTML and print its path (opens in the app browser) |
| `render <storyboard> [--out x.mp4] [--fps 30]` | Full pipeline |
| `capture <url> <out.png> [--size 1440x900] [--crop x,y,w,h]` | Screenshot helper for real app screens |
| `tool <name> <json>` | Generic bridge used by the app (see 07) |

## Agent tools (exposed to the model)
Few tools, flat parameters, so small models call them correctly.

| Tool | Params | Returns |
|---|---|---|
| `video_templates` | – | Template docs and one complete example storyboard |
| `video_validate` | `storyboard` (path) | ok / errors with fixes |
| `video_preview` | `storyboard` | issues + contact sheet image |
| `video_render` | `storyboard`, `out?`, `fps?` | mp4 path, duration, size |
| `video_capture` | `url`, `out`, `width?`, `height?`, `crop?` | png path (+ image) |
| `video_doctor` | `install?` | dependency report |

Plus the normal `read_file`, `write_file`, `edit_file`, `list_directory`, and browser tools for capturing screens.

## System prompt (written for small models)
Principles: a fixed recipe, explicit "never" rules, one full example, and the repair loop spelled out.

```
You are Video Studio, an agent that makes animated videos.
You cannot generate video pixels yourself. You write a storyboard JSON and the
video engine renders it. Never write HTML, CSS, ffmpeg or Python for videos.

Recipe (always in this order):
1. Call video_templates once.
2. Ask at most one question if format, audience or key message is unclear. Otherwise choose:
   16:9 for YouTube/website, 9:16 for Reels/Shorts.
3. If the user wants real screens, capture them with video_capture or browser_screenshot
   into <project>/video/<name>/shots/.
4. Write <project>/video/<name>/storyboard.json with write_file.
   - 5 to 8 scenes. First scene "title", last scene "cta".
   - headline ≤ 6 words. Use *stars* around the words to highlight.
   - narration: 1–2 short spoken sentences per scene, ≤ 25 words.
5. Call video_validate. If not ok, fix exactly what each "fix" says and validate again.
6. Call video_preview. Fix every issue. Repeat until no issues (max 3 rounds).
7. Call video_render. Tell the user the file path and duration.
```

### Why this works for small models
- One artifact to produce (JSON), validated by a machine.
- Each failure returns a single concrete instruction.
- Templates carry the design; the model only chooses words, images, order.
- Bounded loops (max 3 repair rounds) stop endless retries.

## Done when
- A model following only this prompt and the tool outputs produces a valid render in ≤ 8 tool calls for the "make a 30 s reel about X" task.
