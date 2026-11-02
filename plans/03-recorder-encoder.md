# Phase 3 — Recorder and encoder

## Browser
- `playwright-core` (no bundled browser download).
- Chrome discovery order: `OPSCODE_VIDEO_CHROME` env → Playwright's cached chromium → system Chrome/Chromium/Edge paths per OS → `doctor --install` downloads `chrome-headless-shell` with `@puppeteer/browsers` into `~/.opscode/agents/video-studio/browsers`.
- Launch headless, `deviceScaleFactor: 1`, viewport = stage size, `--force-color-profile=srgb`, `--hide-scrollbars`.

## Frame stepping
```
await page.goto(file://build/index.html)
await page.evaluate(() => document.fonts.ready && __video.ready)
for f in 0 .. frames-1:
    await page.evaluate(ms => __video.seek(ms), f * 1000 / fps)
    buf = await page.screenshot({ type: 'jpeg', quality: 92 })   // or CDP captureScreenshot
    ffmpeg.stdin.write(buf)
```
- Uses CDP `Page.captureScreenshot` directly for speed (about 25–40 ms per 1080p frame).
- Default 30 fps. 45 s video ≈ 1350 frames ≈ 1 minute.
- Progress is printed as JSON lines (`{"stage":"frames","done":300,"total":1350}`) so the agent and UI can show progress.

## Encoding
- ffmpeg from `@ffmpeg-installer/ffmpeg` (or system ffmpeg if newer).
- Video only pass: `-f image2pipe -framerate 30 -i - -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart`.
- Mux pass with the mixed audio: `-c:v copy -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k`.
- Outputs: `<name>.mp4`, plus optional `<name>.webm` and a `poster.jpg` (frame at 1 s).

## Failure handling
| Failure | Message to the model |
|---|---|
| No Chrome | "Chrome not found. Run video_doctor with install=true." |
| ffmpeg error | Last 20 lines of stderr + "check image paths" if it mentions decoding |
| Timeout | Per-frame timeout 10 s; aborts with the scene that hung |

## Done when
- `opscode-video render examples/reel.json` writes a 9:16 MP4 whose frame at t=10 s matches the preview at t=10 s.
