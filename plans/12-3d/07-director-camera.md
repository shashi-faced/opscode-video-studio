# Phase 7: Director and camera (v0.9.x)

**Done when:**
- A dialogue between 2–3 characters is covered automatically: establishing shot, then over-the-shoulder and close-ups on the speaker, reactions, and the 180° rule kept.
- A critic pass finds no "tracking a still actor", no 3 identical shot sizes in a row, and no speaker off-screen.

## 1. Shot solver (pure function of the shot and t)

- **Inputs:** shot type, subject(s), scene bounds, character positions and head/eye heights, the line of action between the two main characters.
- **Shot sizes:** extreme wide, wide, full, medium, medium close, close, extreme close, over-the-shoulder (OTS), two-shot, insert (prop).
- **Framing:**
  - eyes on the upper third;
  - headroom by size;
  - lead room in the facing direction;
  - lens 35 mm for wides and 50–85 mm equivalent for close-ups.
- **Moves:** static, dolly in/out, truck (side), pedestal/crane, orbit (±30°), follow (walking subject), whip pan (motion-blur frames), handheld (seeded noise, small amplitude), push-in on a reveal. Easing is `easeInOutCubic`; there is no smoothing state.
- **Letterbox:** cinema 2.39:1 as CSS bars (from plan 11 Cinematic mode).

## 2. Auto-director (rules, no LLM needed)

- New location: an establishing extreme wide (2 s), then a wide.
- Dialogue:
  - a two-shot first;
  - then alternate OTS or close-ups on the speaker;
  - cut on line boundaries, with a minimum shot length of 1.2 s;
  - a reaction shot of the listener on strong moods (surprised, angry, sad).
- Action (walk-in, jump, fly): a wide or follow shot.
- Avoid repeats: never 3 of the same size in a row; alternate sides only across the line of action.
- The storyboard can override per scene (`camera`) or per line (`lines[].shot`).

## 3. Critic checks (deterministic first, vision second)

- **Deterministic:**
  - the subject's head is inside the frame;
  - the speaker is visible while speaking;
  - no camera inside props;
  - the 180° rule is kept;
  - shot-size variety;
  - movement is justified (follow only when the subject moves).
- **Vision** (Cinematic and Deep modes): 3 frames per shot, scored on a rubric (plan 11 §8); failing shots go back with notes.
