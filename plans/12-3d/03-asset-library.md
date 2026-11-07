# Phase 3: Asset library (v0.8.0)

**Done when:**
- `video_doctor --install 3d` downloads a starter set of about 15 MB, checksum-verified, into `~/.opscode/cache/video-assets/3d/`.
- With the set present, `kind: "dog"` renders the CC0 rigged dog with its own walk/idle clips.
- Without it, the procedural dog from Phase 1 is used.

## 1. Sources and licences

| Source | Licence | What we use | How fetched |
|---|---|---|---|
| Kenney (kenney.nl): Mini Characters, Blocky Characters, Animated Characters, Cube Pets | CC0 | People, pets | Zip from kenney.nl, unpacked, converted once |
| KayKit (kaylousberg.itch.io): Adventurers (free), Character Animations (161 clips) | CC0 (no resale of unmodified copies) | Humanoids, clip library | itch.io download (user-side) |
| Poly Pizza (static.poly.pizza/<uuid>.glb) | Per model: CC0 or CC-BY | Quaternius animals (Bunny, Cat, Dog, Fox, Panda, Rat, Pigeon), Animated Robot, Steve, Woman | Stable direct GLB URLs; licence recorded per model |
| Quaternius site | QAL v1.0 since 28 Aug 2026: no redistribution | Optional extras (Universal Animation Library) | **User-side download only**, never mirrored |

- The repo ships **only a manifest** (`assets/3d-manifest.json`): URL, sha256, size, licence as seen on a date, credit line. No model files.
- CC-BY models write a credit line into the video description and credits.

## 2. Pipeline (Node, at install time)

1. Download, verify sha256, unzip.
2. `@gltf-transform/core` + `functions` (MIT):
   - dedup, prune, resample, meshopt-compress;
   - normalise scale (1 unit = 1 m, character height 1.6 / kids 1.1);
   - recentre the feet at the origin.
3. Bone maps per rig family (Mixamo-style, Blender `.L/.R`, Quaternius `CharacterArmature`, the 16-joint pet rig) to a canonical humanoid and a canonical quadruped.
4. Clip names are mapped to our poses: `idle, walk, run, wave, jump, cheer, dance, sit, talk, point`, plus extras (`eat`, `sleep`, `fly`). A missing clip falls back to the procedural pose layered on the rig.
5. A per-asset sidecar `*.opscode.json` records height, head bone, mouth/jaw bone, eye meshes, colour slots and available clips.

## 3. Runtime

- `GLTFLoader` with `MeshoptDecoder` (both MIT, shipped in `assets/three/addons`).
- Materials converted to `MeshToonMaterial` (keeping the base colour/texture) with outlines, so kit characters match the procedural style.
- `AnimationMixer.setTime(t)` per character; clips crossfade by weight computed from t (no stateful fades).
- `SkeletonUtils.retargetClip` shares clips within a rig family (KayKit's 161 clips onto Kenney and KayKit humanoids).
- Recolouring creates characters with no kit model:
  - bear = panda recoloured;
  - lion = fox with a mane mesh;
  - owl = pigeon recoloured, with ear tufts and big eyes;
  - grandpa and grandma = adult models with white hair, a slower walk and a stick.

## 4. Tool and doctor

- `video_assets` tool: `{ action: "list" | "install" | "remove", set: "3d-starter" | "3d-extra" }`.
- `doctor` lists what is installed and its licences.
- First 3D render without assets: renders procedurally and says "install the 3D character pack for richer characters (15 MB)".

## 5. Risks

| Risk | Answer |
|---|---|
| itch.io and Kenney zip URLs change | Manifest has a mirror list plus a manual "drop the zip here" fallback. Procedural characters always work. |
| Retargeted clips look odd on chibi rigs | Per-family clip sets; test sheet renders of every kind × pose |
| Licence changes | Licence and date recorded per file; the block list from the Hub disables an asset |
