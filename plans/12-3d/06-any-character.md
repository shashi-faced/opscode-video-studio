# Phase 6: Any character in 3D (v0.9.x)

**Done when:** 20 requested characters build, pass a turnaround-sheet review by the vision critic, and animate in every pose. The list: peacock king, crocodile, robot tea-seller, dragon, tortoise, monkey with a cap, ghost, astronaut girl, cow, goat, parrot, snake, elephant queen, tiger, frog, bee, snowman, teddy, alien, wizard.

## 1. Character spec (the LLM fills enums only)

```json
{ "id": "chintu", "name": "Chintu", "plan": "biped-animal", "species": "monkey",
  "body": { "shape": "pear", "height": "kid", "build": "slim" },
  "head": { "shape": "round", "ears": "round-side", "eyes": "big", "nose": "button", "snout": "short", "mouth": "wide" },
  "extras": ["tail-curl"], "outfit": "vest", "accessories": ["cap"],
  "colors": { "main": "#9b6a3c", "belly": "#f3d3a6", "outfit": "#2f9e74" } }
```

- **Body plans:** biped (human, animal), quadruped (dog, cow, tiger, elephant, crocodile, tortoise), bird (owl, parrot, peacock, chicken), fish, snake, insect (bee, ant), blob/object (ghost, snowman, star, sun, kettle), robot, dragon (winged quadruped).
- Each plan is a template made of SDF-like primitives (ellipsoids, capsules, cones), each tied to a bone. It is meshed at build time:
  - analytic primitives for speed;
  - optional marching-cubes smooth union for a "clay" look, cached as GLB.
- **Parts library:** heads, ears, eyes, noses and snouts, beaks, horns, tails, wings, fins, shells, hair, outfits (kurta, saree, vest, suit, armour, robe), accessories (crown, cap, glasses, bag, flute, stick, sword). Each part has an anchor bone and colour slots.
- The design reference for animals is `threejs-procedural-animals` (MIT): SDF ellipsoids per bone with smooth union, 6 body plans and IK gaits. We borrow ideas, not the dependency (it is young and builds take 0.4–6 s).

## 2. Build and review

- `character-build` (CLI and tool) turns a spec into a GLB plus a sidecar, saved in `~/.opscode/video/characters/<id>/`.
- `character-sheet` renders a turnaround (front, ¾, side, back) and expressions × mouths to one PNG.
- The vision critic rates it against the description and the designer agent revises (up to 3 rounds), as in plan 11 §4.
- Once a character is approved, every shot uses it by id, so it never drifts between shots.

## 3. Animation

- **Shared clip sets per plan:** biped uses the KayKit/Quaternius retargeted library. Quadruped, bird, fish and snake use procedural gaits:
  - quadruped: phase-offset legs;
  - bird: hop and flap;
  - fish: tail sine;
  - snake: travelling wave.
- Poses map to each plan's equivalent: "wave" for a quadruped is a paw lift and tail wag.
