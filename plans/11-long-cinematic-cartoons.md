# Plan 11: Long, cinematic cartoons made by a team of agents (v0.6 → v1.0)

**Goal.** The user asks for a cartoon ("a 10-minute Panchatantra episode about a clever monkey and a crocodile, Hindi, cinematic") and Video Studio makes it end to end:
- characters of **any kind**, designed for this story and kept identical in every shot;
- a story broken into **many small shots** that **many agents work on in parallel**;
- a final film with camera moves, lip-synced voices, music, sound effects and captions.

Token use is not limited. Quality and length come first, and the user picks how much time and care to spend: **Quick, Long, Cinematic or Deep**.

This plan builds on what exists (v0.3.0):
- the storyboard → HTML → frame-stepped Chrome → ffmpeg pipeline;
- the SVG character rig (21 kinds, 8 poses, 6 moods);
- 14 animated backgrounds, Edge TTS with word timings, music synth, QA checks.

Plan 10 (looks, 3D, parallel render) stays valid; this plan uses its Phase F parallel workers and can use its 3D look.

---

## 1. Ground truth (checked 2026-11-07)

| Fact | What it means |
|---|---|
| No GPU (8 CPU cores, 31 GB RAM) | No local AI image or AI video generation. Everything is drawn by code: vector art, 2.5D camera and keyframe animation, the way TV cartoons like Peppa Pig or cut-out shows are made. |
| The gateway has 126 models, **all text or text + vision**, no image or video generation | LLMs **design and direct**; code **draws**. Vision models (GLM-5V Turbo, Nemotron 3.5 Super VL, Gemini Flash) can **look at rendered frames and judge them**. |
| Render speed today: 2D ≈ 1.9 s of CPU time per second of video (one Chrome) | With 6 parallel Chrome workers ≈ 0.35–0.5 s per second, so a 10-minute film renders in about 4–6 minutes (2D) or 12–15 minutes (cinematic with effects). |
| Free models have rate limits (some 3 requests per minute) | The agent pool must queue, back off and spread work across several models. |

**Honest limit:** the look is high-quality **vector / 2.5D cartoon**, not Pixar-style 3D renders or AI-painted anime. Plan 10's 3D look (three.js, CC0 models) is an option, and an optional paid AI-art provider with the user's own key is in Phase 8.

---

## 2. The modes the user picks

The **Video settings** chip bar gains **Mode**, **Length** and **Quality**.

| Mode | Length | What it does | Agents in parallel | Time for 5 min of video (estimate) |
|---|---|---|---|---|
| ⚡ **Quick** (today) | 15 s – 2 min | One agent writes one storyboard | 1 | 2–4 min |
| 📖 **Long story** | 2 – 30 min | Script → sequences → scenes; scene agents work in parallel; standard checks | 4–6 | 15–25 min |
| 🎬 **Cinematic** | 1 – 30 min | Shot-by-shot directing: camera moves, depth layers, lighting, colour grade, 24 fps, letterbox, sound effects, music score per sequence | 6–8 | 30–60 min |
| 🎯 **Deep (high accuracy)** | 30 s – 15 min | Cinematic plus keyframe animation, lip-sync mouths, a vision critic on every shot, up to 3 repair rounds per shot | 8 | 1–3 h |
| 📺 **Series** (add-on to any mode) | per episode | Reuses the same characters, world and voices across episodes | — | — |

Other settings:
- **Look:** 2D cartoon (default), 3D (plan 10 D), mixed.
- **Frame:** 16:9, 9:16, 1:1, cinema 2.39:1 (letterboxed).
- **Language and voices.**
- **Review style:** "Show me each step" (approve the script, characters and an animatic) or "Just make it".
- **Max parallel agents** (default by mode).

The agent asks once for anything missing, then works on its own. Approval stops (script, characters, animatic) are on by default for Long and longer, and can be turned off.

---

## 3. The core trick: the **shot** is the unit of everything

A long film is never one huge storyboard. It is a tree:

```
Film / Episode
 └─ Acts (3)                       beginning · middle · end
     └─ Sequences (4–12)           one place + one goal, e.g. "The river crossing"
         └─ Scenes (2–6 each)      one continuous moment
             └─ Shots (3–8 s each) one camera set-up: who, where, action, line, camera
```

Each **shot** is a small, self-contained JSON file. It can be:
- **written** by one agent with a small prompt (fits free models);
- **checked** on its own (schema, layout and continuity checks);
- **rendered** on its own to a video segment, in any order, on any worker;
- **cached** by content hash: unchanged shots are never re-rendered;
- **redone** alone when it fails review, without touching the rest of the film.

A 10-minute film is about 100–150 shots. Since shots are independent, the work runs in parallel across many agents and many Chrome workers, and a stopped job resumes where it left off.

### 3.1 Shared memory: the **bible**

Agents stay consistent because every one of them reads the same small, fixed documents, never each other's free text:

| File | Contents | Written by |
|---|---|---|
| `bible/story.json` | Logline, theme, moral, act and sequence outline, tone, audience age, language | Showrunner |
| `bible/characters/<id>.json` | Character spec (§4), voice, personality, catchphrases, "never does" rules | Character designer |
| `bible/world.json` | Locations (background recipe, palette, time of day), props, style tokens (line weight, shading, colour palette) | Art director |
| `bible/style.json` | Look, fps, grade, letterbox, caption style, music palette, pacing rules per mode | Director |
| `state/continuity/<shotId>.json` | Who is on screen and where, facing, holding what, mood, time of day, weather; written after each shot | Continuity agent |

Every agent prompt is: **role rules + the bible parts it needs + the continuity state from the previous shot + its one task.** It stays small, which free models handle well, and consistent, because all agents read the same bible.

### 3.2 Project folder (resumable, inspectable)

```
~/Videos/Opscode/<project>/
  project.json            mode, settings, status of every step, costs, timings
  bible/                  story, characters, world, style
  script/script.md        readable screenplay (scene headings, action, dialogue)
  seq/<seqId>/seq.json    sequence plan: scenes and shot list
  shots/<shotId>/
     shot.json            the shot (validated)
     keys.json            Deep mode: keyframes per character
     audio/*.wav          voiced lines + word timings
     preview/*.jpg        3 sample frames (start, middle, end)
     review.json          QA + critic results, repair history
     segment.mp4          rendered shot (cached by hash)
  audio/score/<seqId>.wav music cue per sequence
  out/film.mp4  out/film.srt  out/thumbnail.jpg  out/chapters.txt  out/character-sheets.png
```

`project.json` holds a status per item (`todo → writing → checking → rendering → reviewing → done | failed`). Any step can be retried. The app shows this as a **production board** (§7).

---

## 4. Characters of any kind

Today there are 21 fixed kinds. Four layers make "any character" possible while keeping every frame consistent:

### 4.1 Body plans + parts library (code, deterministic)

**Body plans (skeletons with named bones and pivots):**
- biped (human, animal-on-two-legs, robot);
- quadruped (dog, horse, tiger, elephant);
- bird;
- fish / sea creature;
- snake / worm;
- blob / object-with-face (sun, cloud, kettle, car);
- insect (6 legs);
- dragon / winged quadruped.

**Parts library (SVG, each with anchor points and a colour mask):**

| Part | Count | Examples |
|---|---|---|
| Heads | 30+ | round, oval, square, pear, snout, beak, trunk |
| Eyes | 20 | dot, anime, sleepy, angry, cute big |
| Brows, noses, mouths | — | 12 mouth shapes per viseme set (§6.3) |
| Ears | 25 | round, pointy, floppy, elephant, none |
| Hair and manes | 40 | — |
| Horns and antlers, tails, wings, fins, shells | — | — |
| Outfits | 40 | kurta, saree, school uniform, armour, king's robe, superhero, chef, doctor, farmer |
| Accessories | 40 | crown, turban, glasses, bag, sword, flute, walking stick |

A **Character spec** is pure data:

```json
{ "id": "bandar", "name": "Chintu", "plan": "biped", "species": "monkey",
  "proportions": { "head": 1.25, "body": 0.9, "legs": 0.8, "arms": 1.2, "style": "cute" },
  "parts": { "head": "round", "ears": "round-side", "eyes": "big-cute", "mouth": "wide", "tail": "curl-long" },
  "colors": { "fur": "#9b6a3c", "face": "#f3d3a6", "outfit": "#2f9e74" },
  "outfit": "vest", "accessories": ["scarf"],
  "voice": { "lang": "hi-IN", "name": "hi-IN-MadhurNeural", "pitch": "+8%", "rate": "+5%" },
  "personality": "clever, cheeky, kind", "walk": "bouncy" }
```

The renderer builds the rig from this spec: same pivots, poses and expressions as today, but with any combination of parts. That gives thousands of distinct, rig-ready characters.

### 4.2 Custom parts drawn by the model (for anything the library lacks)

When the designer needs something new (a peacock's tail, a crocodile snout, a hat shaped like a mango), it writes an **SVG part** to a contract:
- a given box size and anchor points ("attach at neck: x, y");
- a colour mask, so the bible colours apply;
- paths only. The sanitizer removes scripts, external links, filters over budget and anything outside the box.

**Checks:**
- **Deterministic:** valid SVG, inside the box, path count within budget, closed shapes, contrast against the palette.
- **Vision review:** the designer renders a **turnaround sheet** (front, ¾, side, back) and an **expression sheet** (6 moods × talking mouths). A vision model rates it against the description, gives reasons, and the designer revises up to 3 times.

Saved custom parts join the user's own parts library and are reused next time.

### 4.3 From the user's own drawing or photo (optional)

The user drops a drawing or a logo mascot:
- `vtracer` (MIT, Rust, CPU) turns it into SVG paths;
- the designer splits it into head, body and limbs along suggested cut lines;
- the user confirms on the turnaround sheet.

### 4.4 Character library and approval

- Each character is saved in `~/.opscode/video/characters/<id>/` with its spec, custom parts, turnaround, expression sheet and voice. It is reusable in any later film (Series mode).
- A **Cast** card in chat shows every character's sheet with **Approve / Change** ("make Chintu's tail longer", "give the crocodile a golden crown").
- **Consistency guarantee:** shots refer to characters by `id` only. Agents can never redraw a character, so a character cannot drift between shots.

---

## 5. The agent team (multi-agent, parallel)

| Role | Count | Job | Model tier | Works on |
|---|---|---|---|---|
| 🎩 **Showrunner** | 1 | Turns the request into `story.json`: logline, acts, sequence outline, length budget per sequence | Strongest available | Whole film |
| ✍️ **Screenwriter** | 1 per sequence, **parallel** | Writes the scenes and dialogue of one sequence, to its time budget and characters' voices | Strong | Sequence |
| 🎨 **Character designer** | 1 per character, **parallel** | Character spec, custom parts, turnaround/expression sheets, revisions | Strong + vision | Character |
| 🏞 **Art director** | 1 | Locations, palettes, props and style tokens in `world.json`; new background recipes | Strong | World |
| 🎬 **Director / shot planner** | 1 per sequence, **parallel** | Splits scenes into shots: framing, camera move, staging, timing, transitions | Strong | Sequence |
| 🧩 **Shot builder** | **N parallel** (pool) | Writes each `shot.json` (Deep mode: also `keys.json`) from the shot plan, bible and continuity | Fast or free | Shot |
| 🔗 **Continuity checker** | Runs after each shot | Compares the shot's end state with the next shot's start; fixes positions, props and moods | Fast | Shot pair |
| 👁 **Critic** | **N parallel** | Looks at 3–6 rendered frames per shot with a rubric (§8); returns pass or fixes | Vision model | Shot |
| 🎵 **Sound designer** | 1 | Music cue per sequence, sound effects per shot, ambience per location | Fast | Sequence |
| 🎞 **Editor** | 1 | Order, transitions, pacing (trims dead air), titles, credits, chapters, final mix | Strong | Film |

**How it runs:**
- **Orchestrator** (code, not an LLM): a job graph with dependencies:
  1. story;
  2. characters ∥ world ∥ scripts;
  3. shot plans;
  4. shot builds ∥ voice ∥ renders ∥ critic;
  5. edit;
  6. master.
- A step starts as soon as its inputs are done. The pipeline never waits for the whole layer, the same way an assembly line works.
- **Agent pool:** max N agents at once (mode default).
- **Models:**
  - a round-robin over the models the user allows per role, with retry and back-off on rate limits;
  - a stuck or failing agent is retried on another model;
  - every call has a timeout, and its result is validated before it is accepted.
- **Small prompts by design:** each agent gets only its slice (a shot builder sees one shot plan, the relevant bible entries and the previous shot's continuity: 3–8 KB), so free models do well.
- **No token cap:** Long, Cinematic and Deep modes do not limit tokens. They log usage per role and per shot in `project.json`, and the board shows it. An optional budget guard is available for paid models only.

### 5.1 Where it lives

- **Engine** (this repo, Node), all deterministic: project folder, shot schema, character builder, renderer, cache, stitcher, mixer, QA, sheets. New CLI commands are listed in §9.
- **Orchestrator + agents** (Opscode app): a "Production" runner built on the existing sub-agent runner (`subAgentRunner.ts`) with a concurrency pool. The engine never calls LLMs, so it stays testable and deterministic.
- **Fallback:** a plain `opscode-video produce --plan plan.json` run can be driven by any outside LLM loop.

---

## 6. Animation tricks: how code makes it look cinematic

All of these are deterministic and seekable: frame t is always the same image, so shots render on parallel workers.

### 6.1 Camera and depth (2.5D "multiplane")

- Each background is split into **depth layers**: sky, far hills, mid trees, ground, foreground leaves.
- A **virtual camera** (x, y, zoom, rotation) moves the layers at different speeds, which gives real parallax and depth. This is the classic Disney multiplane trick, done in CSS transforms.
- **Camera moves:** static, pan, tilt, push-in (dolly), pull-out, track (follow a walking character), crane (rise), whip-pan (motion blur), shake (impact), rack-focus (CSS blur between depth layers), orbit-fake (layer slide).
- **Shot sizes:** extreme wide, wide, medium, close-up, extreme close-up, over-the-shoulder, two-shot. The director picks them and the engine frames the characters automatically, using their known head and eye positions.
- **Cinematic grammar rules in code:**
  - the 180° rule (characters keep their screen side in a dialogue);
  - eye-line matching;
  - shot/reverse-shot for conversations;
  - an establishing shot when entering a new location.

### 6.2 Character motion

- **Pose keyframes with easing:** `{t: 0.0, pose: "stand"}, {t: 0.8, pose: "point", ease: "back-out"}`. The engine tweens every bone angle, with squash-and-stretch on jumps and landings, and anticipation before big moves.
- **Procedural cycles:**
  - walk, run, sneak, swim, fly and hop, per body plan, with a walk style (bouncy, tired, proud);
  - characters walk along **paths** (x/y points), and their feet stay planted.
- **Secondary motion:** a seeded spring simulation makes tails, ears, hair, scarves and leaves follow the main motion. It is computed from t, so it is still seekable.
- **Acting library:** 40+ named actions (laugh, cry, think, shrug, gasp, bow, namaste, point, hide, tiptoe, celebrate, scared-shiver, angry-stomp). Shot builders pick names instead of inventing motion.
- **Blinks, breathing and idle fidgets** run automatically, so no one ever looks frozen.

### 6.3 Lip-sync

- Edge TTS word timings are split into phonemes with a small rule-based grapheme-to-phoneme step (English and Hindi/Devanagari), then mapped to **visemes**: 8–12 mouth shapes (A, E, O, M/B/P, F/V, L, rest…).
- The mouth switches at phoneme times, which is far better than today's open/close "talk" loop.
- Fallback: an energy-based mouth from the audio (louder means more open).

### 6.4 Look and feel

- **Lighting:**
  - time-of-day palettes (dawn, day, golden hour, dusk, night) applied to every layer;
  - rim light on characters;
  - soft shadow ellipses;
  - god-rays and lamp-glow overlays.
- **Effects library (seekable particles):** rain, snow, dust, leaves, fireflies, sparkles, smoke, splash, fire, magic, speed lines, impact stars, tears and sweat drops.
- **Grade and film finish:**
  - ffmpeg LUT colour grade per mood (warm, cool, teal-orange, storybook, night);
  - gentle film grain and vignette;
  - optional 2.39:1 letterbox;
  - 24 fps (cinema) or 30 fps (social).
- **Transitions:** cut, cross-dissolve, dip to black, iris wipe (classic cartoon), whip, match-cut. The editor picks them by scene change.

### 6.5 "Frame-wise" accuracy without writing every frame

Writing 24 images per second with an LLM would be slow and inconsistent. Deep mode does what animators do:
- the model sets **key poses** (2–6 per second of action) per character in `keys.json`;
- the engine fills every in-between frame (tweening with easing and physics).

The critic then checks **sampled frames** (start, each key, end). This gives frame-level control and precision at a fraction of the cost, and it stays consistent.

---

## 7. App experience (Opscode)

- **Start:**
  - the user types an idea, or taps **Mode → Long / Cinematic / Deep**;
  - sets Length, Frame, Language and Look;
  - picks or creates characters from the **character gallery** (Series reuse included).
- **Approval cards in chat** (skippable with "Just make it"):
  1. **Story card**: logline, acts and sequence list with time budgets. Approve, or edit by typing.
  2. **Cast card**: turnaround and expression sheets, voice sample buttons.
  3. **Animatic card**: a fast low-res cut (540p, 8 fps, stills + voice) of the whole film in minutes, to approve pacing before the full render.
- **Production board** (new right-side panel, live):
  - columns Script · Shots · Voice · Render · Review · Done;
  - one card per shot with its thumbnail;
  - live agent count, tokens per role, ETA;
  - click a shot to see its frames, critic notes and **Redo with note** ("make the crocodile look sneakier here").
- **Background running:** the job keeps going if the user switches agents. It survives an app restart, because it resumes from `project.json`. A notification arrives when the animatic or the film is ready.
- **Result card:** inline player; downloads for MP4, captions (.srt) and thumbnail; chapters; "Make a 60 s trailer" and "Make Insta reel cut-downs" (automatic re-edit from the same shots).

---

## 8. Quality: how accuracy is enforced

**1. Deterministic checks per shot (engine, instant):**
- schema;
- characters on stage;
- no overlaps or covered faces;
- text in safe zones;
- line fits the shot length;
- continuity (positions, props, time of day match the previous shot's end state);
- 180° rule;
- no frozen frames.

**2. Vision critic per shot (Cinematic: 3 frames; Deep: 6 frames + keys).** Rubric scored 1–5, each with a reason:
- *story:* does the shot show what the script says?
- *character:* right characters, right mood and action?
- *staging:* clear focus, readable silhouettes?
- *camera:* the planned framing and move?
- *continuity:* matches the previous shot?
- *appeal:* would a child enjoy it?

A score below the threshold sends the shot back to its builder with the critic's notes, up to 2 repairs in Cinematic and 3 in Deep, then it is flagged for the user.

**3. Sequence and film checks:**
- the editor watches the animatic contact sheet per sequence for pacing and repetition (the same shot size three times in a row, a long static stretch);
- the sound designer checks music and dialogue levels;
- the master gets loudness at −16 LUFS (YouTube) or −14 (social).

**4. Eval set:**
- 12 fixed prompts (fable, festival story, science-for-kids, comedy sketch, superhero short, bedtime story, Series episode 2…);
- run per mode on 3 model mixes;
- scores logged in `plans/09`;
- golden-frame hashes prove renders are deterministic.

---

## 9. Engine changes (this repo)

| Area | New or changed | Files |
|---|---|---|
| Project | Project folder, `project.json` status machine, content-hash cache, resume | `src/project/*.mjs` |
| Schema | `shot`, `keys`, `bible` schemas + validators with repair hints; existing storyboards still work (a storyboard is a one-sequence film) | `src/schema/shot.mjs`, `bible.mjs` |
| Characters | Body plans, parts library, spec → rig builder, custom-part sanitizer, turnaround and expression sheets, character library | `src/characters/{plans,parts,build,sanitize,sheets,library}.mjs` |
| Animation | Pose keyframes + easing, procedural cycles, path walking, springs, acting library, visemes + G2P (en, hi) | `src/anim/*.mjs` |
| Camera | Multiplane layers, virtual camera, shot sizes, auto-framing, moves, rack focus | `src/camera/*.mjs`, layered background recipes |
| Effects | Seekable particles, lighting overlays, transitions | `src/fx/*.mjs` |
| Render | Shot → segment, N workers, segment cache, concat, 24/30 fps, grade LUTs, grain, letterbox | `src/render/*` |
| Audio | Score per sequence (longer synth forms, crossfades), CC0 sound-effects pack (downloaded once), ambience, film mix + mastering | `src/audio/*` |
| CLI / tools | `project-init`, `bible-check`, `character-build`, `character-sheet`, `shot-check`, `shot-render`, `animatic`, `film-assemble`, `film-status` (JSON in, JSON out, as today) | `bin/`, `src/tools.mjs` |

Package growth: about 3 MB of parts and effects, plus a sound-effects pack of about 20 MB downloaded on first use.

## 10. App changes (Opscode Agent repo)

- **`src/services/video/production/`:**
  - orchestrator (job graph, pool, retries, resume);
  - role prompts;
  - model routing per role;
  - token and time accounting.
- **Sub-agent runner:** a concurrency pool, per-call timeouts, structured JSON results, and model fallback.
- **UI:**
  - Mode/Length chips;
  - Story, Cast and Animatic approval cards;
  - Production board panel;
  - result card with cut-downs.
- **Notifications** for animatic ready, film ready, and a shot that needs you.

---

## 11. Phases

| Phase | Version | Delivers | Effort | Done when |
|---|---|---|---|---|
| **1. Shots + project + parallel render** ✅ done (see plan 09) | 0.6 | Project folder, shot schema, segment render + cache + concat, N Chrome workers, resume; the existing storyboard becomes a one-sequence film | 1.5–2 wk | A 5-min film from 60 hand-written shots renders in < 4 min with 6 workers; changing one shot re-renders only that shot |
| **2. Any character** | 0.7 | Body plans, parts library (first 300 parts), spec builder, custom SVG parts + sanitizer, turnaround/expression sheets, character library, vision review | 2–3 wk | 20 varied requested characters (peacock king, crocodile, robot chai-wallah, dragon…) build, pass the sheet review and animate in all poses |
| **3. Cinematic toolkit** | 0.8 | Multiplane backgrounds (14 → layered), camera + shot sizes + auto-framing, moves, lighting, particles, transitions, grade/grain/letterbox, 24 fps | 2 wk | A 1-min cinematic test scene passes a side-by-side review against the v0.3 version |
| **4. Agent team + production board** | app + 0.8 | Orchestrator, roles, pool, approvals, board UI, animatic, background running, notifications | 2–3 wk | "10-minute Panchatantra episode, Hindi, cinematic" runs to a finished film without user help in Just-make-it mode; resumes after an app restart |
| **5. Deep mode** | 0.9 | Pose keyframes + tweening, procedural cycles, path walking, springs, acting library, viseme lip-sync, 6-frame critic with repairs | 2–3 wk | Mouth shapes match phonemes (checked on 20 lines); critic pass rate ≥ 85 % before repairs on the eval set |
| **6. Long-form sound** | 0.9 | Score per sequence, sound-effects pack, ambience, film mix, mastering, chapters, SRT | 1 wk | No level jumps between sequences; loudness within ±1 LU |
| **7. Series + cut-downs** | 1.0 | Reuse characters/world across episodes, "previously on", trailer and reel cut-downs from shots | 1 wk | Episode 2 uses episode 1's cast unchanged; a 60 s trailer is made automatically |
| **8. Optional extras** | later | 3D look per plan 10 D for whole films; optional AI-art provider with the user's own key for backgrounds and posters; drawing-to-character via vtracer | — | — |

**Suggested order:** 1 → 2 → 4 → 3 → 5 → 6 → 7.

Phase 1 makes long films possible at all. Phase 2 is the user's top wish (any character). Phase 4 brings the agent team in early, so every later phase improves a working pipeline.

### Rough cost of one 10-minute cinematic episode

| Item | Estimate |
|---|---|
| Shots | ~120 (avg 5 s) |
| LLM calls | ~700: build + checks + critic + repairs, ≈ 3–5 M tokens in total (no cap, logged) |
| Wall time with 8 parallel agents on free models | 45–90 min, mostly rate-limit waiting |
| Render with 6 workers | 12–15 min |
| Disk | ≈ 2 GB working files, ≈ 250 MB final 1080p |

---

## 12. Risks and answers

| Risk | Answer |
|---|---|
| Characters drift or look different between shots | Shots reference characters by id; only the designer can change a spec; sheets are approved once |
| Free-model rate limits stall the team | Pool with back-off, several models per role, assembly-line scheduling, resume from disk |
| A weak model writes broken shots | Small prompts, strict validator with repair hints, deterministic auto-fixes, retry on another model |
| Story loses the thread over 30 minutes | Showrunner's act/sequence outline with time budgets; sequence summaries passed forward; editor pacing review |
| Model-drawn SVG parts look bad or unsafe | Contract box + sanitizer + vision review + revision loop; library parts first |
| Long renders crash midway | Shot-level cache and resume; segments are independent |
| Vision critic is too lenient or too harsh | Fixed rubric with examples; threshold tuned on the eval set; user override per shot |
| Disk use | Working files pruned after a successful master (keeps shots.json, bible and final) |
| Copyright (famous characters) | Designer refuses copies of known characters by name and makes original ones instead; user art is fine |

## 13. Decisions for the owner

1. **Default mode** for a story request: Long (recommended) or Cinematic?
2. **Approval stops** on by default (story → cast → animatic)? Recommended: yes for 3+ minutes.
3. **Models per role:** strongest available for showrunner and screenwriter (paid allowed?), free models for shot builders, GLM-5V or Nemotron VL as critic. OK?
4. **Max length** for v1: 15 min (recommended) or 30 min?
5. **Frame rate:** 24 fps for Cinematic and Deep, 30 fps otherwise?
6. **Paid AI-art provider** (Phase 8) with the user's own key: yes or no?
