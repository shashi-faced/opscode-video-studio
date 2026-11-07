# Phase 8: Agent, app and evaluation (v1.0)

**Done when:**
- A user picks **Look → 3D** in the Opscode app, types one sentence, and gets a 3D cartoon.
- On a 10-prompt eval, 3 free models produce valid 3D storyboards on the first or second validation round in at least 80 % of runs.

## 1. Agent

- `video_templates({ type: "story", look: "3d" })` returns a short 3D guide (≤ 3 KB):
  - the camera values;
  - pose and action lists;
  - relations ("near", "left_of");
  - one complete 3D example.
- The system prompt gains one rule: *"If [Video settings] says Look: 3D, set "look": "3d". Use camera only when the user asks for a specific shot; otherwise leave it to auto."*
- **Validator aliases:** "3D", "three d", "pixar style" and "cgi" → `3d`; "close up" and "closeup" → `close`; "zoom in" → `dolly-in`; "360" → `orbit`.

## 2. App (Opscode Agent)

- **Look chip** in the Video Studio setup panel: 2D cartoon · 3D cartoon · Motion graphics · Text.
- **Character gallery** popover:
  - the `video_characters` tool renders a 2D/3D contact sheet;
  - tapping a character adds it to the cast;
  - built "any characters" (Phase 6) appear under "My characters".
- **World picker:** location thumbnails rendered from each recipe's establishing camera.
- **Render progress** shows fps and GPU or CPU, with a hint when the GPU is not used.

## 3. Evaluation

- 10 prompts: story, festival, explainer with a teacher character, dialogue-heavy comedy, an action scene, night scene, underwater, a classroom, a Series episode 2, and a 5-minute film.
- **Logged per run:** validation rounds, preview issues, render fps, frame-hash determinism, lip-sync score (Phase 5), and critic score.
- Results go in plan 09.
