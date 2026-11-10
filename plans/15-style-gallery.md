# Plan 15: Pick a video style from a picture gallery

Status: planned (2026-11-10). Builds on plan 14 (stickman styles, painted scenes, sound effects, Media settings).

## 1. Goal

In the Video Studio setup popup, the user sees a **gallery of small animated style tiles**, like the README of [stickman-video-director](https://github.com/kaomei/stickman-video-director). They click one, type a topic (or click "Try this example") and get a finished video in that style. They don't write long prompts or choose settings unless they want to.

```
 Video style
 ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
 │ ▶ preview  │ │ ▶ preview  │ │ ▶ preview  │ │ ▶ preview  │
 └────────────┘ └────────────┘ └────────────┘ └────────────┘
  Line Art  Free  Retro TV  Free   Noir  🔑Gemini  Cozy  🔑Gemini
  Explainers       Science, mystery  Suspense         Feelings, habits
 ─────────────────────────────────────────────────────────────
 Selected: Retro TV · "Is your dog guilty, or just scared?"  [Try this example]
```

## 2. The styles (11 tiles, matching the reference README)

Each tile renders a style from plan 14 §3.4. That table grows from 7 to 11 styles.

| Tile | Our style id | Reference style | Drawn by | Made for | Example topic (ours) |
|---|---|---|---|---|---|
| Classic Black & White | `classic-bw` | A1 | code (free) | concepts, visual metaphors | "Why your brain loves to procrastinate" |
| Modern Pop | `modern-pop` | A2 | code (free); painted scenes with key | AI tools, tech, personal growth | "5 AI tools that save you an hour a day" |
| Prehistoric Cave | `prehistoric` | A3 | painted (code fallback) | workplace satire, fables | "How the first boss was born" |
| Cozy Storytelling | `cozy-story` | A4 | painted (code fallback) | everyday feelings | "The message you are scared to answer" |
| Historical Cartoon | `historical` | A5 | painted (code fallback) | history | "A day in the life of a Mughal soldier" |
| Amber Noir | `amber-noir` | A6 | painted (code fallback) | what-if stories | "What if everything cost 1,000× less?" |
| Minimal Line Art | `line-art` | B1 | code (free); painted props with key | YouTube explainers, product intros | "Start a YouTube channel without showing your face" |
| Colourful Hand-Drawn | `cozy-color` | B2 | painted (code fallback) | psychology, habits | "Why trying to sleep keeps you awake" |
| Retro TV | `retro-tv` | B3 | code (free) | science facts, animal behaviour, mysteries | "Is your dog guilty, or just scared?" |
| Survival Thriller | `noir-thriller` | B4 | painted (code fallback) | survival rules, suspense | "Night-shift rules: never open the back door" |
| Character Explainer | `presenter` | B5 | code: our talking character in a corner, stickmen acting the idea | explainers, commentary | "Why asking for help is so hard" |

- **Free tiles work with no key.** They use the code-drawn stickmen from plan 14 Phase 2.
- **🔑 tiles look best with a Gemini key** for painted scenes (plan 14 Phase 3). Without one, they still work: the badge says "Basic without a Gemini key", the video uses the code-drawn version of that style, and the agent says so once.
- **Every style works in Hindi.** Scene text and captions use Devanagari fonts (Kalam, Hind), and the voice follows the language chip.

## 3. User flow

1. Open Video Studio. The setup popup opens with **Video style** first.
2. Hover a tile to play its 4-second muted preview. Without hover (touch, or reduced motion), it shows a still.
3. Click a tile to select it. Underneath appear "Made for …" and its example topic, with a **Try this example** button that fills in the message box.
4. Optional chips stay available: Frame (16:9 / 9:16), Voice language, Length, Captions.
   - Fields that don't apply hide themselves: **Look / style**, the **2D/3D characters** galleries and **Places**.
   - The voice chip shows only providers that work (plan 14 Media tab).
5. Send. The agent gets the choices as text (`[Video settings] Video style: Retro TV — look "stickman", art style "retro-tv"; …`) and makes the video **without asking more questions**. The style's defaults fill everything not chosen: voice, music, sound palette, caption style and pacing.
6. A painted style without a Gemini key renders the code-drawn version and notes: "Add a Gemini key in Agent settings → Media for painted scenes."
7. Painted style with a key: the agent shows the image count and cost, and **asks once** before spending (plan 14 cost gate).

## 4. App changes (`Hecto`)

- **`agentStoreTypes.ts`:**
  - option fields `preview?: string` (looping video), `example?: string` (topic) and `requires?: 'image-provider'`;
  - a new layout `'styles'`.
- **`AgentSetupPanel.tsx`:** the new `styles` layout.
  - 16:9 tiles, about 150×84 px, in an auto-fill grid with 2–4 columns depending on popup width.
  - Label and badge on the tile, hint on hover.
  - Plays the `preview` on hover or focus, and on the selected tile. Lazy loaded, `muted playsInline loop`. Shows the `image` poster when idle or with `prefers-reduced-motion`.
  - Under the grid: "Made for …" plus the **Try this example** button, which puts `example` in the input box without sending it.
  - Keyboard: arrow keys move, Enter selects. Each tile has an `aria-label` with its name and hint.
- **`agentSetup.ts`:**
  - `hideWhen` also hides `look`, `characters`, `characters3d`, `myCharacters` and `places3d` when a style is chosen;
  - `requires: 'image-provider'` shows the 🔑 badge text based on the Media tab status: "Painted" when a key works, "Basic without a Gemini key" when not.
- **`agentStoreCatalog.ts`:** a new first field, `artStyle` (single choice, `layout: 'styles'`), with the 11 options. Each has image, preview, hint, example and a prompt like `look "stickman", art style "retro-tv"; follow its style guide`. Plus sample prompts for the store page.
- **Assets:** `public/agents/video-studio/styles/<id>.webm` (4 s, 480×270, under 300 KB) and `<id>.jpg` (poster, under 40 KB). That's under 4 MB for all 11.
- **Coming soon:** until a style renders well, its tile is shown greyed out as "Coming soon" (`disabled`, already supported), so the gallery can ship as soon as the first styles are ready.

## 5. Package changes (`opscode-video-studio`)

- **`video_templates({ type, platform, look: 'stickman', style })`:** returns that style's short guide, under 3 KB like the 3D guide. It covers what the style is for, how to pace it, which props and expressions to use, its sound palette, and one complete example storyboard. Small models then only fill in the story.
- **Validator:** `art.style` must be one of the 11 ids. Aliases are corrected with a warning ("retro tv", "B3", "survival" → `noir-thriller`). A `look: "stickman"` without a style uses `line-art`.
- **Style defaults:** caption style, music mood, sound palette, pacing, and a default voice per provider. Each comes from `src/art/styles.mjs` unless the user chose otherwise.
- **`scripts/style-previews.mjs`:** renders each style's own short sample storyboard into the 4-second `webm` and `jpg` for the gallery. It's re-run whenever a style changes, so the tiles always show what the engine really makes. **We don't bundle the reference repo's GIFs or videos.** They're that project's media, and some imitate specific YouTube channels.
- **Agent prompt (manifest):** "If [Video settings] has a Video style, set `look: "stickman"` and `art.style` to it, call `video_templates` with that style, and make the video without asking about style again."

## 6. Phases

These run after the plan 14 phases they depend on. Days are extra work on top of plan 14.

| Phase | What | Needs | Days |
|---|---|---|---|
| G1 | `styles` layout, option fields, hide rules, Try-this-example, keyboard; all tiles "Coming soon" with placeholder posters | none | 1 |
| G2 | Style guides in `video_templates`, validator ids and aliases, style defaults, manifest prompt line | plan 14 Phase 2 (code stickman) | 1 |
| G3 | Preview renderer; enable the 4 free tiles first: `line-art`, `classic-bw`, `retro-tv`, `modern-pop` (code version) | plan 14 Phase 2 | 1 |
| G4 | `presenter` tile: our character with lip-sync in a corner, stickmen acting in the stage area | plan 14 Phase 2 | 1 |
| G5 | Painted tiles (`prehistoric`, `cozy-story`, `historical`, `amber-noir`, `cozy-color`, `noir-thriller`): Gemini previews, 🔑 badge from Media status, basic fallback | plan 14 Phases 1, 3, 4 and a Gemini key | 1 |
| G6 | Eval: for each tile, click → example topic → finished video in English and Hindi, 16:9 and 9:16; contact sheet beside the tile preview; no extra questions asked; cost shown before paid renders | all above, plan 14 Phase 5 for sound | 1.5 |

The first useful release (G1–G3) gives 4 working free tiles plus "Coming soon" tiles, about 3 days after plan 14 Phase 2. All 11 tiles come with plan 14 Phases 1–5.

## 7. Done when

- Picking any enabled tile and pressing **Try this example → Send** gives a finished MP4 in that style, with voice, captions and sound effects. The agent asks no questions, except the one cost question for painted styles.
- The video's contact sheet looks like the tile preview: same line style, palette, character type and caption look.
- It works in Hindi and English, at 9:16 and 16:9, and in the code-drawn version when there's no Gemini key.
- Tiles load fast: previews are lazy and under 4 MB in total. The gallery works with keyboard and with reduced motion.
