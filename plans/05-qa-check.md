# Phase 5 — QA: automatic layout checks and contact sheet

Replaces the big model's "look at the frames and notice problems" step with measurements, so models without vision (or weak vision) still catch mistakes.

## `opscode-video check storyboard.json`
1. Builds the HTML (no audio needed; uses estimated durations if voice is not cached).
2. For each scene, seeks to the moment all entry animations have finished (scene start + max delay + duration, capped at 80% of scene).
3. Runs DOM checks in the page:
   | Check | Rule | Fix hint |
   |---|---|---|
   | Text overflow | `.fit` font shrunk below 60% of design size | "shorten scenes[i].headline to ≤ N chars" |
   | Off-stage | element box outside the stage | "reduce items or use a shorter label" |
   | Overlap | text box intersects another text box or the caption area by > 8% | "move to template split" / "fewer chips" |
   | Missing image | image failed to load | "file not found: path" |
   | Tiny image | screenshot shown narrower than 35% of stage width | "crop the screenshot to the relevant panel" |
   | Low contrast | text vs background contrast < 3:1 | "use theme clean-light or remove accent" |
   | Caption too long | caption chunk wraps to > 2 lines | "split narration sentence" |
4. Writes `build/contact-sheet.jpg` (one tile per scene, labelled) and returns:
```json
{ "ok": false,
  "issues": [ { "scene": 2, "check": "overlap", "message": "chips overlap headline", "fix": "use at most 3 chips" } ],
  "contactSheet": "build/contact-sheet.jpg" }
```

## Agent usage
- The agent must run `video_preview` (check) before `video_render` and fix every `error`-level issue.
- The tool also returns the contact sheet as an image, so vision models can do an extra pass; non-vision models rely on the JSON alone.

## Done when
- The overflow and overlap fixtures each produce exactly the expected issue.
- The example storyboards produce zero issues.
