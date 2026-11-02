# Phase 8 — Testing and small-model evaluation

## Unit tests (`node --test`)
- Validator: each `test/fixtures/bad-*.json` → expected error path and fix.
- Normaliser: aliases (`portrait`, `type`, pixel coords) → fixed + warning.
- Timeline: durations from voice lengths, min durations, caption chunk timing.
- Synth: deterministic output hash for a fixed seed; no NaN; peak ≤ 1.
- Mixer: ducking reduces music under voice by ≥ 8 dB.

## Golden render tests
- Render `examples/*.json` at 6 fps with `voice: none` (fast, offline).
- Compare frames at fixed times with stored goldens using a perceptual diff (allow small font anti-alias noise).
- `check` on examples must return zero issues.

## Small-model evaluation
Task set (10 prompts): product reel, YouTube intro, feature launch, tutorial explainer, sale offer, app walkthrough with captured screens, Hindi narration, no-voice captions only, 1:1 social post, long-text stress test.

Metrics per model:
| Metric | Target |
|---|---|
| Valid storyboard within 3 validate rounds | ≥ 90 % |
| Render succeeds | ≥ 90 % |
| `check` issues remaining at render time | 0 |
| Tool calls to finish | ≤ 10 |

Models to run: the app default free model, a "flash" model, a mid model, and a large model as the ceiling. Record failures and feed them back into normalisation rules and prompt wording — the goal is to fix weak-model mistakes in the tools, not to ask for a stronger model.
