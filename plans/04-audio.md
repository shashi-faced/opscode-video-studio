# Phase 4 — Audio: voice, timing, music, mix

All audio runs in Node (no Python), as 48 kHz float32 arrays.

## 4.1 Voice (TTS)
- Provider `edge` via `msedge-tts` (Microsoft neural voices, free, needs internet). Default voice `en-IN-NeerjaExpressiveNeural`; others: `en-IN-PrabhatNeural`, `hi-IN-SwaraNeural`, `hi-IN-MadhurNeural`, `en-US-AvaMultilingualNeural`, `en-US-AndrewMultilingualNeural`.
- Provider `none`: no voice; captions only; scene durations fall back to reading speed (15 chars/s, min 3 s).
- Provider `file`: per-scene `voiceFile` the user recorded.
- Pipeline per scene: synthesise → decode with ffmpeg to f32 → trim leading/trailing silence (−45 dB) → normalise peak → cache by hash of (voice, rate, text) in `~/.opscode/agents/video-studio/cache/tts`.

## 4.2 Timeline
```
scene.duration = explicit duration
              ?? max(templateMin, leadIn + voiceLength + tail)
leadIn = 0.4 s, tail = 0.6 s, templateMin: title 3.5, feature 5, cta 5
```
- Voice clip starts at sceneStart + leadIn.
- Timeline JSON (`build/timeline.json`) is what the compiler, captions, music and mixer all read, so they agree.

## 4.3 Music synthesis
Port of the proven numpy generator to JS. Styles share one engine (instruments + pattern):
| style | Instruments | BPM |
|---|---|---|
| `indian-electronic` | tanpura drone, tabla (bayan glide, na, tin), sitar (Karplus–Strong + meend), kick, clap, shaker, bass, pad | 100 |
| `corporate-upbeat` | piano-ish pluck, kick, clap, hats, bass, pad | 110 |
| `ambient` | pads, soft pluck arpeggio, no drums | 80 |
| `none` | silence | – |
- Structure follows the timeline: light intro bar, full groove from the first scene change, a whoosh before each scene change, a final chord on the CTA scene, 2 s fade-out.
- Deterministic: seeded random, so re-renders sound identical.
- `music.file` uses a user track instead (looped/trimmed, faded).

## 4.4 Mixer
- Place voice clips on the timeline.
- Ducking: envelope from voice activity (120 ms attack, 400 ms release); music gain `volume − 0.33 × duck`.
- Soft limiter (`tanh`), peak −1 dBFS, then ffmpeg `loudnorm` to −14 LUFS in the mux pass.
- Write `build/audio.wav` (16-bit stereo).

## Done when
- Rendering the reel example gives voice that never overlaps the next scene, music audible between lines, integrated loudness −14 ± 1 LUFS.
