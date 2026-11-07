# Phase 1: 3D look foundation (v0.7.0)

**Done when:**
- `examples/kids-story.json` with `"look": "3d"` renders as a 3D cartoon: same cast, same scenes, voice, bubbles and captions.
- Re-rendering frame N gives the same image.
- A 50 s story renders in under 2 minutes on this laptop's GPU.
- No downloads are needed.

## 1. Storyboard fields

| Field | Where | Values | Default |
|---|---|---|---|
| `look` | top, or per scene | `2d`, `3d` (aliases: `cartoon` → 2d; `three-d`, `3D` → 3d) | `2d` |
| `camera` | story/dialogue scene | `wide`, `medium`, `close`, `two-shot`, `dolly-in`, `dolly-out`, `orbit`, `pan-left`, `pan-right`, `crane-up`, `auto` | `auto` |
| `characters[].pose` | (exists) | idle, walk, wave, jump, cheer, dance, sit, think, point, talk | idle |
| `characters[].enter` | (exists) | walk-in, fly-in, pop, none | none |
| `characters[].facing` | (exists) | left, right, camera | toward the scene centre |

Every 2D storyboard is a valid 3D storyboard. The other templates (title, bullets, cta…) stay 2D cards in a 3D video.

## 2. Files

| File | What |
|---|---|
| `src/compiler/three/` | Copied into each build as `assets/three/`: `three.module.js`, `three.core.js`, `addons/effects/OutlineEffect.js` (from the `three` npm package, MIT) |
| `src/compiler/world3d.js` | Browser module: builds and seeks the 3D scenes (characters, sets, lights, camera, effects) |
| `src/compiler/templates.mjs` | `story` and `dialogue` in 3D: a `<div class="w3d">` marker instead of the SVG background and characters; bubbles and text as now |
| `src/compiler/compile.mjs` | When any scene is 3D: adds the canvas, import map and world module; passes a scene spec (JSON) per 3D scene |
| `src/compiler/runtime.js` | `seek()` calls `window.__world.seek(i, localMs)`; bubbles follow projected head positions; `ready` waits for the world |
| `src/render/*` | 3D builds launch Chrome with the GPU when it works (probe from plan 11) |

## 3. Procedural toon characters (always available, no files)

**One rig shared by all characters:**
- groups for `root`, `hips`, `body`, `head`, `armL/armR` (shoulder pivot), `legL/legR` (hip pivot), `tail`, `earL/earR`, `wingL/wingR`;
- every pose is a function `pose(name, t, seed)` returning joint angles and an offset;
- moods set the face.

**Body plans (from the 2D `KIND_INFO.plan`):**
- **human:** capsule body with an outfit colour, sphere head, hair cap, capsule limbs, shoes. Kid, adult, old and big proportions. Grandpa and grandma get white hair, glasses and a stick.
- **animal:** round body and head, standing on two legs like the 2D cast, with ears per kind:
  - rabbit: long ears;
  - cat and fox: triangle ears;
  - dog: floppy ears;
  - bear and panda: round ears;
  - mouse: big round ears;
  - elephant: big flat ears and a trunk;
  - lion: a mane ring.
  - Panda has eye patches, fox a white chest and bushy tail, rabbit a pom tail.
- **owl:** egg body, wings, big eyes, beak, ear tufts.
- **robot:** boxes, antenna, glowing eyes.
- **float:** star (extruded 5-point shape with a face), sun (sphere with ray cones), moon (crescent made from two spheres via CSG-free trick: crescent extrude), cloud (sphere cluster).

**Look:**
- `MeshToonMaterial` with a 3-step gradient map;
- black inverted-hull outlines through `OutlineEffect`, thickness scaled per mesh;
- rim-lit by the light preset;
- face: white eyes with dark pupils and a highlight dot, blink by scaling the eyes;
- mouth: a dark rounded shape that opens and closes while speaking (visemes come in Phase 5);
- cheeks.

**Poses** (pure functions of t):

| Pose | Motion |
|---|---|
| idle | breathe and slight sway |
| walk | leg swing, arm swing, bob |
| wave | right arm up, waving |
| jump | squash, stretch and arc, repeating |
| cheer | both arms up, bounce |
| dance | hips sway and arms alternate |
| sit | legs forward, body lowered |
| think | hand to chin, head tilt |
| point | arm toward the scene centre |
| talk | gestures plus head nods |

Moods (happy, sad, surprised, angry, sleepy, scared) change the brows, eyes and mouth. Entrances: walk-in from off-screen along x, fly-in from above, pop (scale from 0).

## 4. Procedural sets: 14 locations × day / sunset / night

Each location is a recipe of a ground, a sky dome (vertical gradient shader) with sun/moon, and seeded props:

| Location | Built from |
|---|---|
| meadow | rolling ground, trees (cone/sphere crowns), flowers, rocks, clouds |
| forest | dense trees, mushrooms, path |
| mountains | big low-poly peaks with snow caps, rainbow arc |
| beach | sand, sea plane with moving waves, palm trees, umbrella |
| village | huts with roofs, well, fence, trees |
| city | road, blocky buildings with windows, street lamps |
| sky | clouds below, open sky |
| space | stars, planets with rings, floating rocks |
| underwater | blue fog, seaweed swaying, bubbles, fish |
| home / bedroom | 3-wall room, sofa or bed, window, lamp, rug, picture |
| classroom | room, blackboard, desks |
| office | room, desks, monitors, plant |
| festival | ground, string lights, diyas, lanterns, fireworks at night |

- Moving parts are functions of t: waves, clouds, fireflies, bubbles, fish, fireworks, swaying seaweed.
- Light presets per time: hemisphere (sky/ground colours), key directional with soft shadows (1024 map), warm/cool rim, and fog colour.
- Time palettes reuse the 2D colours, so 2D and 3D videos of the same story feel like one series.

## 5. Staging and camera

- **Marks:** the same `placeCharacters()` x positions (0–100 %) map to world x along a stage line (z = 0). Characters face the scene centre unless `facing` is set.
- **Camera** is a pure function `cameraAt(shot, t, scene)`:
  - **wide:** frames all characters plus margin, looking slightly down.
  - **medium:** waist up of the group.
  - **close:** head and shoulders of the focus character (speaker or first).
  - **two-shot:** two characters.
  - **dolly-in / out, orbit (±25°), pan, crane:** eased over the scene.
  - **auto:** story scenes slow dolly-in on the wide shot. Dialogue scenes start medium on the group and cut to a close-up of each speaker during their line, keeping the 180° rule (the camera stays on one side of the line between the characters).
- Bubbles and story text stay HTML. Each frame, the world reports each character's projected head (x %, y px), and the runtime moves that character's bubble above the head. Bubbles stay inside the safe area.

## 6. Determinism and speed

- Seeded RNG per scene (`mulberry32(hash(sceneIndex + background))`); no `Math.random`; all motion from `t`.
- Scenes are built once at load. Hidden scenes skip rendering.
- `seek` renders and then reads one pixel, so the GPU has finished before the screenshot.
- `renderer.setPixelRatio(1)`, MSAA on, shadows 1024, no post-processing except outlines.
- QA: `video_preview` contact sheets work unchanged. The check adds `3d-no-gpu` (a warning when SwiftShader is used) and `3d-off-screen` (a character's head projects outside the frame).

## 7. Tests

- Unit: validator accepts `look`, `camera`, the new poses and aliases. The scene spec builder maps cast kinds to body plans for all 21 kinds.
- Golden frame: render frame 45 of a 3D example twice; the image hashes match.
- Example: `examples/kids-story-3d.json` (copy of kids-story with `look: "3d"` and a few camera choices).
