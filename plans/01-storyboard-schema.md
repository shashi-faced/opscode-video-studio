# Phase 1 — Storyboard schema and validator

The storyboard is the **only** thing the model writes. It must be small, forgiving and well documented, so a weak model gets it right on the first or second try.

## Goals
- One JSON file describes the whole video.
- Every field has a safe default, so a minimal storyboard still renders.
- Validation errors are written for an LLM: the JSON path, what is wrong, and an example fix.
- The same JSON Schema is used for validation, for the tool definition, and for `video_templates` docs.

## Shape (v1)

```json
{
  "version": 1,
  "title": "Opscode Agent reel",
  "format": "9:16",                  // "16:9" | "9:16" | "1:1"
  "theme": "night-saffron",          // preset name; optional "accent": "#ff9a3c"
  "brand": { "name": "Opscode Agent", "logo": "assets/logo.png" },
  "voice": { "provider": "edge", "voice": "en-IN-NeerjaExpressiveNeural", "rate": "+4%" },
  "music": { "style": "indian-electronic", "volume": 0.5 },  // or "none" or { "file": "song.mp3" }
  "captions": true,
  "scenes": [
    { "template": "title", "kicker": "AI agents for builders",
      "headline": "Your AI team. *On your desktop.*",
      "narration": "Meet Opscode Agent. Your AI team, right on your desktop.",
      "mascot": "robot" },
    { "template": "feature", "kicker": "Browser automation",
      "headline": "It browses. *It gets it done.*",
      "image": "shots/browser.png",
      "chips": ["navigate", "click", "type"],
      "highlights": [{ "x": 0.08, "y": 0.43, "w": 0.91, "h": 0.06, "label": "console › TypeError" }],
      "cursor": { "x": 0.79, "y": 0.65 },
      "narration": "It opens a real browser, clicks, types, and completes the task for you." },
    { "template": "cta", "headline": "Opscode Agent", "subline": "Made in India",
      "button": "Download for Linux", "badges": ["Multi-agent", "Browser debug"],
      "narration": "Download it today." }
  ]
}
```

### Text markup
- `*word*` → accent colour emphasis. Nothing else is parsed, so models cannot break HTML.
- All text is HTML-escaped by the compiler.

### Templates (v1)
| template | Fields | Use |
|---|---|---|
| `title` | kicker, headline, subline, image?, mascot? | Opening |
| `feature` | kicker, headline, image, chips[], highlights[], cursor?, tags[] | Show a screenshot with call-outs |
| `bullets` | kicker, headline, items[] (≤5) | List of benefits |
| `split` | kicker, headline, body, image | Text beside an image (stacks in 9:16) |
| `stat` | kicker, items[{value,label}] (≤3) | Big numbers |
| `quote` | quote, author, role | Testimonial |
| `cta` | headline, subline, button, badges[], logo | Closing |

Shared optional scene fields: `narration`, `duration` (seconds, overrides auto), `mascot` (`robot`, `dev`, `founder`, null), `mascotMood` (`happy`, `worried`), `transition` (`fade`, `slide`, `zoom`).

### Coordinates
Highlights, cursor and tags use **fractions of the image** (0–1), not pixels, so they survive any resize or format change.

## Validation
- JSON Schema (draft 2020-12) in `src/schema/storyboard.schema.json`, validated with a tiny built-in validator (no runtime dependency) that supports the subset we use: type, enum, required, properties, items, min/max, minLength/maxLength, additionalProperties.
- Semantic checks after schema:
  - image files exist (relative to the storyboard file);
  - headline ≤ 60 chars, narration ≤ 220 chars per scene (warn above);
  - 2–12 scenes; total narration ≤ 90 s for reels;
  - highlight boxes inside 0–1.
- **Normalisation** fills defaults and fixes common small-model mistakes instead of failing:
  - `"16x9"`, `"landscape"` → `"16:9"`; `"portrait"`, `"reel"` → `"9:16"`;
  - `"type"` used instead of `"template"`;
  - `"text"` used instead of `"headline"`;
  - pixel coordinates (> 1) with known image size → converted to fractions;
  - `chips` given as a comma string → split.
  Each auto-fix is reported as a warning so the model learns.

### Error format (what the model sees)
```json
{ "ok": false,
  "errors": [ { "path": "scenes[2].template", "message": "unknown template \"hero\"",
                "fix": "use one of: title, feature, bullets, split, stat, quote, cta" } ],
  "warnings": [ { "path": "format", "message": "\"portrait\" changed to \"9:16\"" } ] }
```

## Done when
- `opscode-video validate examples/reel.json` prints ok.
- Broken fixtures in `test/fixtures/bad-*.json` each give one precise error with a fix.
