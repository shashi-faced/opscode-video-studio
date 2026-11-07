# Plan 12: 3D characters and 3D worlds (v0.7 → v1.0)

**Goal.** A user writes "make a 3D cartoon story about Miko the rabbit and a fallen star". Video Studio then renders it as a real 3D cartoon:
- cel-shaded characters that walk, wave, talk and react;
- in 3D worlds (meadow, forest, village, home, classroom, space…) with day, sunset or night lighting;
- with a moving camera (wide, close-up, dolly, orbit);
- lip-synced to the voice, with speech bubbles and captions;
- as one storyboard field: `"look": "3d"`.

The same storyboard can switch between 2D and 3D. Long films (plan 11) work in 3D too.

The research behind this plan is in `reports/3D cartoon video engine stack.md` in the Opscode IDE workspace, with notes in `research_notes/3D cartoon video engine stack/`. The benchmark scripts are in `bench/3d/`.

## 1. What the research decided

| Question | Answer | Why |
|---|---|---|
| Renderer | **three.js r187** (MIT, 186 KB gzip), plain, no React | Seekable animation (`AnimationMixer.setTime`), `MeshToonMaterial` with gradient maps, inverted-hull `OutlineEffect`. Babylon is 10× bigger and steps fixed deltas instead of seeking. |
| Graphics | Intel Iris Xe through ANGLE/Vulkan (`--use-angle=vulkan`) | A full toon 1080p frame renders in **4–5 ms** on the GPU vs 110 ms on SwiftShader (measured here). |
| Capture | In-page `canvas.toDataURL('image/jpeg')` | 26 ms/frame vs 71 ms for CDP screenshots. **4 workers ≈ 94 fps at 1080p**, so 3D renders faster than today's 2D. |
| Anti-aliasing and outlines | MSAA + inverted-hull outline | FXAA and `OutlinePass` cost 380–460 ms per frame on SwiftShader |
| Characters | 3 tiers: (1) procedural toon characters built in code, always available offline; (2) CC0 rigged glTF packs downloaded once (Kenney, KayKit, Quaternius via Poly Pizza); (3) "any character" body-plan specs | No AI 3D generation is available; the LLM only fills enum-only JSON. |
| Worlds | Seeded location recipes: procedural terrain, scattered props, sky dome, light preset, named marks; kit models from Kenney/KayKit later | No CC0 kit has Indian temples or Diwali props, so those are procedural. |
| Faces and lip-sync | 3D eyes plus a 2D mouth atlas on the head, switched by visemes from the text and Edge TTS word timings | Edge TTS gives word timings, not visemes. English rules come from TalkingHead (MIT); Hindi is ported from its Bengali module. |
| Staging | FilmAgent pattern: named marks, a closed action list, a shot solver, a validator plus critic loop. Holodeck-style relations ("left of", "near") instead of coordinates | Small LLMs write good enums and bad coordinates. |
| Licences | three.js MIT; Kenney and KayKit CC0. Quaternius files are **never bundled**, only fetched to the user's machine (its Aug-2026 licence forbids redistribution). Remotion, Theatre Studio (AGPL), Mixamo and VRM avatars are not used in the package | Keeps the repo redistributable. |

## 2. Architecture

```
storyboard.json  "look": "3d"  (scene: background, time, characters[{who, pose, mood, position, enter}], camera, lines)
      │  validate (same schema + 3D fields: camera, action, mark)
      ▼
 compiler ──► index.html
   ├─ <canvas id="world">   three.js scene per story scene (built on load, cached per scene)
   ├─ HTML layer            titles, story text, speech bubbles (positioned by projecting head bones), captions
   └─ runtime.js            seek(ms) → world3d.seek(scene, t) → poses, camera, lights, particles, faces → render → GPU finish
      ▼
 renderer (Chrome workers, GPU) ──► frames ──► ffmpeg  (film mode: shots in parallel, cached)
```

- **Everything is a pure function of time.** Character pose, walk cycle, camera, blink, mouth, particles and clouds are all computed from `t`, with seeded random numbers. There is no `requestAnimationFrame`, no `Math.random()` and no frame-to-frame state. Any frame can be rendered alone, which film mode and parallel workers need.
- **2D layers stay HTML.** Text, bubbles and captions keep today's fitting, safe zones and Devanagari shaping. Phase 2 draws them into the canvas for the fast capture path.

## 3. Phases (one file each)

| Phase | File | Delivers | Size |
|---|---|---|---|
| **1. 3D look foundation** ✅ done (v0.7.0, see plan 09) | [01-foundation.md](01-foundation.md) | `look: "3d"`; three.js layer; procedural toon characters for all 21 kinds; poses; 14 locations × 3 times as procedural 3D sets; camera shots; projected bubbles; GPU detection; works offline with no downloads | Large |
| **2. Fast capture** ✅ done (v0.7.1, see plan 09) | [02-fast-capture.md](02-fast-capture.md) | Canvas capture with the HTML overlay drawn into the canvas; worker chunks; SwiftShader fallback profile (720p) | Medium |
| **3. Asset library** ✅ done (v0.8.0, see plan 09) | [03-asset-library.md](03-asset-library.md) | `video_assets` download manager (manifest, hashes, licences), glTF character loader, toon conversion, retargeted clip library, rig families | Large |
| **4. Worlds from kits** ✅ done (v0.9.0, see plan 09) | [04-worlds.md](04-worlds.md) | Kenney/KayKit set pieces in location recipes, marks, relation solver, weather and particles | Large |
| **5. Faces and lip-sync** ✅ done (v0.7.2, see plan 09) | [05-faces-lipsync.md](05-faces-lipsync.md) | Mouth atlas, visemes from text + word timings (English, Hindi), expressions, gaze | Medium |
| **6. Any character in 3D** ✅ done (v0.10.0, see plan 09) | [06-any-character.md](06-any-character.md) | Body-plan spec → procedural skinned mesh with parts, turnaround sheet, character library | Large |
| **7. Director and camera** ✅ done (v0.7.3, see plan 09) | [07-director-camera.md](07-director-camera.md) | Shot solver (180° rule, OTS, two-shot), auto-director for dialogue, camera moves, critic checks | Medium |
| **8. Agent, app and eval** ✅ done (v0.11.0–v0.12.0, see plan 09); eval on 1 model (LongCat-2.5), 2 more pending | [08-agent-app-eval.md](08-agent-app-eval.md) | 3D docs for the agent, Look chip, character and world gallery, eval set, speed log | Medium |

Order: 1 → 2 → 5 → 7 → 3 → 4 → 6 → 8. Phase 1 gives a complete 3D cartoon with no downloads. Phases 2, 5 and 7 make it fast, talking and cinematic. Phases 3, 4 and 6 add richer assets.

## 4. Decisions for the owner

1. Default look for `type: story`: stay 2D, with 3D chosen in Video settings (recommended until Phase 5)?
2. Asset downloads (Phase 3): about 15 MB starter set from Kenney, KayKit and Poly Pizza on first 3D use. Show a consent card first?
3. Quaternius: ask them by email about redistribution? Until then, only user-side downloads.
4. Machines with no working GPU: allow 3D at 720p (about 5 fps, slow) or show "3D needs a graphics card"?
