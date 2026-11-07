# Phase 2: Fast capture (v0.7.x)

**Done when:**
- A 3D story renders at **≥ 60 fps aggregate at 1080p** on this laptop: 4 workers, in-page JPEG capture.
- The frames are pixel-identical in layout to the screenshot path (text, bubbles, captions present).

## Why

On the GPU, rendering takes 4–5 ms but a CDP `Page.captureScreenshot` takes 45–65 ms. The research benchmark measured:

| Path | Per worker | 4 workers |
|---|---|---|
| CDP screenshot | 71 ms | 54 fps |
| `canvas.toDataURL('image/jpeg', 0.9)` | 26 ms | 94 fps |

## How

1. **Overlay into the canvas.** The HTML layer (titles, story text, bubbles, captions, brand, progress) changes only at a few moments per scene (pop-ins, caption changes, karaoke words).
   - Rasterise it to an image only when its content changes. Use `html-to-image`-style SVG foreignObject serialization (inline fonts already embedded as data URLs), or draw text with Canvas2D using the same measured layout.
   - Cache the overlay bitmap by a key of visible elements + caption + active word + bubble positions (rounded to 2 px).
   - Composite per frame: WebGL canvas → 2D canvas (`drawImage`) + overlay bitmap → `toDataURL('image/jpeg', 0.92)`.
   - Fallback: any frame where the overlay is animating (pop-in scale, bubble moving) uses the CDP screenshot. Typically under 15 % of frames.
2. **Worker chunks.**
   - The film renderer (plan 11) already runs shots in parallel.
   - For a single long storyboard, split the frame range into N chunks, one per worker, each writing its own segment, then concat (same code path as film segments).
   - Restart the browser every 3,000 frames to contain Chrome's GPU memory growth (as documented by Remotion).
3. **Use chrome-headless-shell** when installed (`doctor --install` fetches it). It is lighter than full Chrome for many workers.
4. **Fallback profile with no GPU (SwiftShader):**
   - render at 1280×720 and scale up in ffmpeg (`-vf scale=1920:1080:flags=lanczos`);
   - 1024 shadows, no outlines on props (characters only);
   - 2 workers (more do not help; it is CPU-bound);
   - warn the user that 3D will be slow on this machine.
5. **Startup GPU check.** Read `UNMASKED_RENDERER_WEBGL`. If it is SwiftShader when the GPU was expected, report it in the render result.

## Tests

- Overlay compositing: render 20 sample frames both ways. They must match within a small diff (PSNR > 38 dB).
- Speed log in plan 09: fps per path, per worker count.
