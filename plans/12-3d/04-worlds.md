# Phase 4: Worlds from kits (v0.8.x)

**Done when:**
- Every location has a richer kit-based version once assets are installed: meadow, forest, mountains, beach, village, city, sky, space, underwater, home, bedroom, classroom, office, festival, plus new ones (river, temple courtyard, market, park, school yard, farm, castle, kitchen).
- Each location still falls back to its Phase 1 procedural set.

## 1. Location recipe format

```json
{ "id": "village", "ground": { "type": "terrain", "noise": 0.4, "color": "grass" },
  "sky": "gradient", "fog": [20, 80],
  "setPieces": [ { "model": "kenney-nature/hut", "at": "back-left" }, { "model": "procedural/well", "at": "back-right" } ],
  "scatter": [ { "models": ["kenney-nature/tree_*"], "count": 40, "area": "background", "minGap": 3 },
               { "models": ["kenney-nature/flower_*"], "count": 120, "area": "foreground-sides" } ],
  "marks": { "A": [-3, 0, 0], "B": [0, 0, 0.5], "C": [3, 0, 0], "door": [-6, 0, -4], "well": [5, 0, -3] },
  "cameras": { "establish": { "pos": [0, 6, 18], "look": [0, 1, 0] } },
  "ambient": ["birds", "leaves"] }
```

- **Seeded scatter:** `InstancedMesh` per model, Poisson-disc placement from a seed, kept out of the stage area (z −2..3) so characters stay visible.
- **Marks:** named positions (FilmAgent-style) the director can use: "Miko at the well".
- **Interiors:** a 3-wall box room (the camera side is open), floor and wall materials per room type, furniture slots (sofa, bed, desk, blackboard, window, door, lamp, rug).

## 2. Relations instead of coordinates (Holodeck-style)

The storyboard may say `"near": "well"`, `"left_of": "dadi"`, `"behind": "tree"` or `"at": "door"`. A small solver:
1. places anchors (marks, set pieces);
2. then places characters by soft constraints (relations, spacing ≥ 1.2 m, facing a partner) and hard constraints (on the ground, inside the camera frustum of the wide shot, no overlap).

It uses greedy placement with a few random restarts from the scene seed.

## 3. Weather and effects (seekable, GPU)

Rain, snow, falling leaves, fireflies, sparkles, magic dust, fireworks, smoke and splash.
- Each is a `Points` or `InstancedMesh` whose positions are computed in the vertex shader from `(seed, index, t)`. There is no stored state.
- New scene field: `"weather": "rain" | "snow" | "leaves" | "none"`. Festivals default to fireworks at night.

## 4. Indian settings (no CC0 kit has them)

Built procedurally: temple courtyard (steps, pillars, bell, shikhara silhouette), diyas, rangoli (decal), marigold garlands, kite sky, chai stall, auto-rickshaw (boxes plus a canopy), village well, banyan tree (trunk plus hanging roots).

## 5. Sky

- Gradient dome (default).
- Optional three.js `Sky` shader for realistic sunsets.
- Optional 1k Poly Haven HDRI (CC0, ~1.4 MB) as a far background only; lighting stays toon.
