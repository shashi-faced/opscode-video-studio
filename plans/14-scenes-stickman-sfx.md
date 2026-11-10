# Plan 14: Any scene, stickman styles, story sound effects, and voice/image providers

Status: planned (2026-11-10). Target version: v0.14.0. Repo branch: `version13`, then a new branch for this work.

## 1. Goal

Make the videos that [kaomei/stickman-video-director](https://github.com/kaomei/stickman-video-director) (MIT) shows in its README, with our engine:

1. **Any scene the story needs.** A samurai street, a TV switching on at 3 AM, "anxiety as a cage", a 1% battery. An image model draws them; our engine animates them.
2. **Stickman art styles.** Hand-drawn line art, cozy colour, retro TV, noir thriller, prehistoric, historical, classic black-and-white. The art direction is locked, so a whole video looks like one artist drew it.
3. **Sound effects synced to the story.** Ambience under each scene, sounds for on-screen actions (paper, phone, door, footsteps), and emotional hits (whoosh, riser, impact, silence). Each sits on the exact spoken word.
4. **Agent settings → Media.** Choose the voice (TTS) provider and the image provider, enter API keys, and test them. If nothing is chosen, use what works today: free Edge voices and code-drawn art.

Everything we already have stays: free Hindi and English voices, Whisper word-by-word captions, `.srt`/`.vtt`, lip-sync, 3D, films up to 1 hour, cached shots, editing tools.

## 2. What the reference repo does (read 2026-11-10, commit `08c4e3c`)

It's an AI "Skill" (instructions plus about 1,600 lines of scripts), not a rendering engine.

- **Director mode (A1–A6):** writes a treatment, then one prompt per 10-second clip for paid text-to-video tools (Gemini Omni Flash, Google Flow, Runway, Kling). The user generates the clips and edits them in CapCut. **We won't copy this mode:** it's a prompt template, and the user still does the editing.
- **Autopilot mode (B1–B5):** this is where the finished videos come from.
  1. Gemini or GPT **image models draw story-specific art**: full scenes, plus separate character, pose and prop pictures.
  2. A small canvas renderer (`autopilot-render.mjs`, 236 lines) places these as **layers with keyframes**: x, y, w, angle, alpha, scale and draw progress. It adds hand-drawn underlines and arrows, big scene text and single-line captions.
  3. **Gemini TTS** provides the narration, with fixed named voices per style (Bodi, Brian, Puck).
  4. **Sound** has three planned layers per sentence: an *ambience* bed, *physical action* effects, and *emotional* punctuation (riser, impact, chime, deliberate silence). Effects come from licensed library files (each item's licence checked) plus four procedural accents (tap, paper, pop, chime).
  5. A per-style **reference lock** keeps the look: approved sample stills, character proportion sheets and a written checklist.
- **What makes the style:** written art direction per style. For example: near-white paper with a faint grid; slender stick figures about 4–4.5 heads tall with exaggerated faces; a few warm accent colours; large hand-lettered scene text; no text inside generated images. Plus *character reference images* reused for every new picture.
- **Quality, judged from frames of its demo videos** (B1 line art, B2 colourful, B3 retro TV, B4 thriller): good and distinctive. Art is consistent across scenes, text is readable, and the B4 painted scenes are rich. All of the richness comes from the image model. The animation itself is simple: layers slide, fade, rotate and zoom. There's no real limb animation and no lip-sync, except B5 with a presenter avatar.
- **Costs and keys:** a Gemini API key (or GPT images through Codex) and a key for each voice provider. It never asks for keys in chat; it uses environment variables. It asks before any paid call.

What this means for us: we already exceed it on animation, voices, captions and long films. We lack three things:
- an **image provider** with **style-locked prompts** and **character references**;
- **code-drawn stickmen** with expressive faces;
- a **sound-effects library with cues tied to spoken words**.

That's this plan.

## 3. Design

### 3.1 Providers and keys (package side)

```
src/providers/
  config.mjs     read settings: ~/.opscode/agents/video-studio/settings.json (choices) +
                 secrets.json (keys, file mode 0600) + env vars (GEMINI_API_KEY, OPENAI_API_KEY,
                 ELEVENLABS_API_KEY) as fallback; never logs or returns key values
  tts/edge.mjs   (today's code moved here) free, word times included
  tts/gemini.mjs Gemini TTS (named voices; Hindi supported) → no word times → Whisper aligns (plan 13)
  tts/elevenlabs.mjs  multilingual v2/v3; "with timestamps" endpoint gives character times → words
  tts/openai.mjs OpenAI TTS → no word times → Whisper aligns
  image/gemini.mjs    Gemini image model (reference images supported)
  image/openai.mjs    OpenAI image model (edits endpoint for reference images; transparent background)
  image/none.mjs      no provider: scenes fall back to code-drawn art (3.3)
```

- **One interface for each kind of provider:**
  - TTS: `speak({ text, voice, lang }) → { audioFile, words? }`. The cache key is provider + model + voice + text. Our `captions.timing: auto` already listens with Whisper whenever word times are missing, so every provider gets accurate captions and lip-sync.
  - Image: `draw({ prompt, refs[], size, transparent }) → png`.
- **Exact model IDs, voice lists and prices are checked against each provider's current docs in Phase 0.** Nothing is assumed from memory.
- **Default ("use existing"):** with nothing selected, the voice is Edge (free, today's voices) and the image provider is `none`, so the art is code-drawn stickman scenes. No key, no cost, and the render never fails because a key is missing.
- **Cost gate:** `video_preview` counts the images to generate and estimates the cost. The agent must ask the user (`ask_question`) before the first paid render of a video, the same way we ask before the model download. A per-video budget comes from settings. Images and voice clips are cached by hash, so re-renders and fixes cost nothing for unchanged scenes.
- **Secrets never reach the model:**
  - tool replies say only `image provider: gemini (key set)`;
  - keys never go into commands, logs, reports or the storyboard;
  - errors are cleaned before they're shown.

### 3.2 Any scene: `illustration` scenes (needs an image provider)

New scene template, written by the agent:

```json
{ "template": "illustration",
  "art": { "scene": "a samurai standing in a rainy Edo street at dusk, paper lanterns",
           "cast": ["kenji"], "props": [{ "id": "scroll", "draw": "an unrolled tax scroll", "enter": "drop", "at": "word:taxes" }],
           "camera": "push-in" },
  "text": "Even samurai paid *taxes*", "narration": "…", "sfx": [ … ] }
```

- **The prompt is assembled by the engine, not written by the model.** It's: style lock (3.4) + scene description + cast anchors + the rules "no text, letters or numbers in the picture" and "keep the left third clear for text" (16:9) or "keep the top and bottom clear" (9:16) + the aspect ratio. Small models only describe *what* is in the scene, which they do well.
- **Character consistency:**
  1. The first time a cast member is used, the engine draws a **reference sheet** (front, three-quarter and side, plus three expressions) and saves it in the existing character library (`video_character`).
  2. Every later picture passes that sheet as a reference image.
  3. The agent sees the sheet in the preview contact sheet and can ask for it to be redrawn.
- **Props as cut-outs:** props are drawn on a plain background, cut out (transparent output where the provider supports it, otherwise a flood-fill background removal), then animated as layers. They can enter with `drop`, `slide`, `pop`, `draw-on`, `wobble` or `shake`, timed to a word (`"at": "word:taxes"`, using our word timings).
- **Motion on top of the picture:**
  - camera moves: `push-in`, `pull-out`, `pan-left/right`, `tilt`, `hold`, eased, never constant drift;
  - parallax when the scene comes with a separate foreground layer (optional second image);
  - our code-drawn stickmen (3.3) can stand *in* an illustrated scene, with poses, walking and lip-sync, so dialogue still works;
  - hand-drawn underlines, arrows and circles that draw themselves on a word;
  - large scene text in the style's font (Devanagari supported).
- **`video_art` tool:** `list` shows every scene's picture with its prompt and cost status. `redraw` redraws one scene with an extra note ("make the cage bigger"). `approve` locks a picture so it's never redrawn.
- **Fallback with no provider:** the scene is built from code: the style's paper or background, stickmen, icon props and text. The render warns once: "illustration scenes drawn without an image model; add a key in Agent settings → Media for painted scenes".

### 3.3 Stickman characters and backgrounds drawn in code (free, works without keys)

- **New 2D character family `stick`** in `src/compiler/characters.mjs`, on the existing skeleton. It reuses our 8 poses, walk cycle, moods and lip-sync mouth shapes, so everything that animates today animates as a stickman.
  - **Head types:** hollow circle (classic), white filled head with a short neck (historical), round white glowing (retro TV), plain head with a beanie and coloured shirt (modern pop).
  - **Limbs:** single lines, about 4–4.5 heads tall, small oval hands and feet, white gloves for the thriller style.
  - **Line:** a seeded wobble filter for the hand-drawn look. It's the same on every frame (deterministic), so lines don't flicker.
- **Faces with more expressions:** the current 6 moods plus shocked, frustrated, sweating, crying, big grin, deflated and suspicious. Each sets brows, eyes and mouth together, and the body language follows (lean, shoulders, hands).
- **Code backgrounds per style:**
  - near-white paper with a faint grid;
  - ivory paper;
  - dark screen with scanlines, bloom and vignette (retro TV);
  - cave rock texture;
  - plain studio.
- **Prop and icon library for metaphors** (cage, battery, clock, phone, bed, money, chart, heart, brain, lightbulb, door, chain, trophy, rocket, …): an open-licence icon set (Lucide or Tabler, ISC/MIT) drawn with the hand-drawn stroke and the style's accent colours. Coloured hand-drawn versions come from the image provider when one is set.
- **Hand-lettered fonts (OFL):** Caveat (Latin) and **Kalam** (Latin and Devanagari), so Hindi scene text looks handwritten too. Download and licence are checked in Phase 2.

### 3.4 Art styles (one file, used by both 3.2 and 3.3)

`src/art/styles.mjs`. Each style sets:
- the image-prompt **look block** and a list of things to avoid;
- the palette;
- the background (code version);
- the stickman head and limb type;
- the font and caption treatment;
- the default camera pacing;
- the default **sound palette** (3.5) and a suggested voice for each provider.

| Style id | Look | Good for |
|---|---|---|
| `line-art` | near-white paper, faint grid, black ink stickmen with expressive faces, a few warm accents, big hand-lettered text | explainers, YouTube "faceless" channels, product intros |
| `cozy-color` | ivory paper, fine ink, soft colourful everyday rooms and streets | psychology, habits, feelings |
| `retro-tv` | dark screen, white and grey rounded figures, white caps text, scanlines | science facts, animal behaviour, mysteries |
| `noir-thriller` | painted night scenes, deep shadows, white-head stickman with white gloves | survival rules, suspense, urban legends |
| `prehistoric` | rough lines, caves, campfire, animal skins | workplace satire, fables |
| `historical` | white heads with necks, bold ink, colourful period settings ("era packs": Edo Japan, ancient Egypt, Mughal India, …) | history, curious civilisations |
| `classic-bw` | pure white or pure black, monochrome figure, up to 3 accent colours | concepts, visual metaphors |

The look blocks are our own text, written from the reference's MIT-licensed descriptions, with credit in the README. They don't name or copy any YouTube channel, and we don't bundle the reference's sample pictures or audio.

In the storyboard, the agent writes `"look": "stickman"` and `"art": { "style": "line-art" }`. The setup panel gets picture tiles for the styles: sample stills we render ourselves.

### 3.5 Story sound effects

- **Storyboard:**
  - `ambience` per scene (a bed id, with level);
  - `sfx` cues: `{ "sound": "phone-vibrate", "at": "word:message" | 2.4 | "start" | "end", "gain", "distance": "near|room|far" }`;
  - `"silence": { "at": "word:suddenly", "for": 0.6 }` for deliberate audio cuts.

  **Cues anchored to spoken words** are our advantage: every voice has word times (TTS or Whisper).
- **Sound library as a downloadable CC0 pack**, like the 3D packs (`video_assets install sfx-core`): a manifest with links, sizes, SHA-256 and the licence of every file. Sources are CC0 only, so nothing needs attribution or carries usage limits, e.g. the Kenney audio packs. The exact list is checked in Phase 5, and anything unclear is left out. Categories:
  - **Ambience beds:** room tone, night crickets, rain, wind, city, office, café, cave fire, TV static hum.
  - **Foley:** paper, page turn, pen, footsteps (floor, gravel), door, knock, phone ring and vibrate, keyboard, mouse click, glass, coins, cloth.
  - **Punctuation:** pop, soft whoosh, riser, impact (soft and heavy), chime, heartbeat, record scratch, comedy boing, tension sting.
- **Procedural sounds** (`src/audio/synth.mjs`, which already makes whooshes) for pops, whooshes, risers, drones and heartbeats. They work with no pack installed.
- **Sound palette per style:** for example, line-art uses paper, pen, pop and a soft chime; noir-thriller uses a drone bed, footsteps, door and heavy impacts. The agent picks cues from the palette. With `"sfx": "auto"`, a restrained rule set adds a scene bed plus cues for objects the narration names that are visible in the scene (a phone, a door). It never adds an effect on every cut.
- **Mix:** narration on top. Effects are ducked under speech with short release, ambience sits at a low bed level, music ducks too. We skip one-size-fits-all heavy ducking: important hits get a short "protect" window. Loudness is −14 LUFS for the master, as today.
- **Checks:** `video_preview` lists the cues with times, flags a cue landing on a spoken word, and flags more than N cues per 10 s. The contact sheet marks cue positions.

### 3.6 App: Agent settings → **Media** tab (Video Studio)

```
Voice (TTS)      [ Edge — free (default) ▾ ]   Gemini · ElevenLabs · OpenAI
  API key        [ •••••••••••• ] [Test]  status: ✓ works / ✗ invalid key / not set
  Voice          [ ▾ list from the provider, filtered by language ]  [▶ Play sample]
Pictures         [ None — drawn in code (default) ▾ ]   Gemini image · OpenAI image
  API key        [ •••••••••••• ] [Test]
  Quality/size   [ Standard ▾ ]        Cost per image: ~$…  (from provider docs, Phase 0)
  Budget         [ Ask me before every video ▾ ]  / up to $… per video
Sound effects    [ Download sound pack (… MB, CC0) ]  ✓ installed
```

- **Where keys go:**
  - **Not `localStorage`.** That's where app settings live today, and it's plain text readable by any page code.
  - A small Rust command, `save_agent_secret(agent, provider, key)`, writes `~/.opscode/agents/video-studio/secrets.json` with file mode 0600, readable only by the user. Windows uses the user profile's ACLs.
  - The package reads that file directly. Keys never pass through `execute_bash` command strings (which have no env option and would show in process lists) or the chat.
  - The UI only ever reads back "set / not set" and the last 4 characters.
  - The OS keychain (`keyring` crate) is a later option. Node can't read it without a native add-on, which the agent package should avoid.
- **The Test button** runs a tiny, cheap real call through the package (`video_providers test`) and shows the result: works, invalid key, no quota, or network blocked. Image tests use the smallest size and say so: "about $0.0x".
- **The Play sample button** plays 1 sentence in the chosen voice, cached after the first time.
- **"Use existing":** if no provider is selected, nothing changes. If the app's main **Model settings** already hold an OpenAI or Gemini key, the Media tab offers "Use the key from Model settings" and copies it into the secrets file. It doesn't share it implicitly.
- **The setup panel** (the popup before a chat) gets a **Voice** chip row that shows only providers with a working key, plus "Art style" tiles. The agent receives the choices as text (`voice provider elevenlabs, voice "…"`), never the key.

## 4. Phases

Each phase ends with tests (`npm test`), an entry in `plans/09-status-and-eval-log.md`, a demo video, and a version bump.

**Phase 0: Provider spike and decisions (1.5 days).** Needs one test key from you and your OK to spend a few cents to a few dollars.
- Read the current official docs for:
  - Gemini image and TTS;
  - OpenAI image and TTS;
  - ElevenLabs: model IDs, voices, Hindi support, word or character timestamps, transparent PNG, reference images, prices, rate limits.
- Draw 6 test scenes in 3 styles, at 16:9 and 9:16, through each image provider with a key. Measure:
  - quality (judged on a contact sheet);
  - **character consistency with a reference sheet**;
  - any text in the picture (must be none);
  - time per image;
  - cost per image.
- Speak 1 Hindi and 1 English paragraph through each TTS provider with a key. Check that Whisper alignment gives correct captions.
- **Gate:** pick the default image provider and model, and the voice list. Confirm the secrets-file approach.

**Phase 1: Settings, keys and voice providers (3 days).**
- Package:
  - `src/providers/config.mjs`;
  - the TTS adapters (Edge moved, plus Gemini, ElevenLabs, OpenAI);
  - a `video_providers` tool (status / test / voices);
  - cache keys that include the provider;
  - `captions.timing: auto` covering providers with no word times.
- App:
  - the Media tab;
  - the `save_agent_secret` Rust command;
  - the Test and Play buttons;
  - the setup-panel voice row.
- Tests:
  - keys never appear in tool output, reports or logs;
  - a missing or invalid key falls back to Edge with a note;
  - Hindi works through each adapter (skipped without a key).

**Phase 2: Stickman in code ✅ (2026-11-10, branch `version13`).**
Built:
- `src/compiler/stick.mjs`:
  - stickmen on the existing rig, so all poses, walks and entrances work;
  - 5 head types (hollow, white, glow, beanie, hood);
  - a seeded hand-drawn wobble that's the same on every frame;
  - 13 faces;
  - family details per kind;
  - 8 viseme mouths, which the runtime switches from each line's viseme track. This is the first real mouth-shape lip-sync in 2D.
- `src/art/styles.mjs`: 10 styles. Each sets theme, fonts, stage background, a paper or illustrated-scene backdrop, caption treatment, stickman options and the underline.
- `src/art/props.mjs` and `icons.json`: 144 Lucide icons (ISC) with 110 aliases and 5 entrances.
- Fonts: Kalam (Latin and Devanagari) and Caveat (OFL).
- Schema: `look: "stickman"`, `art.style`/`art.theme`, scene `props`, 13 moods. Cartoon and 3D characters map the 7 new moods to their nearest face.
- Validator: look and style aliases (including the reference's A1–B4 codes), a default style, icon correction, new mood guesses.
- Agent: the `video_templates` look "stickman" guide and example, plus a manifest prompt line.
- `test/stickman.test.mjs`: 9 tests, including a browser test that the mouth shape follows the line. 134 of 134 pass.
- `npm test` now uses `test/*.test.mjs`. Node 22 no longer accepts a folder there.

Checked on renders:
- English line-art explainer (16:9, 25 s) and Hindi line-art reel (9:16, 19 s), with voice, captions and mouth shapes;
- previews of all 10 styles.

Fixed during checks:
- a blurry title glow on paper styles;
- invisible faces on dark scene styles;
- the mouth disappearing in pauses during a line.

Not in this phase: the `presenter` style (plan 15 G4), and painted scenes (Phase 3).

Original scope:

- The `stick` character family:
  - 4 head types;
  - hand-drawn wobble;
  - 13 expressions;
  - lip-sync;
  - all poses and walking.
- Code backgrounds for each style.
- The icon-prop library with hand-drawn stroke.
- Kalam and Caveat fonts.
- Self-drawing underlines, arrows and circles.
- `look: "stickman"` plus `art.style`.
- This alone gives free stickman videos in all 7 styles (with simpler backgrounds).

**Phase 3: Illustrated scenes (3 days).**
- The `illustration` template;
- engine-built prompts from the style locks;
- image cache;
- camera moves;
- stickmen inside illustrated scenes;
- the cost count and ask-first gate in `video_preview`;
- the `video_art` tool (list, redraw, approve);
- the fallback with no provider;
- 16:9 and 9:16 compositions that keep text areas clear.

**Phase 4: Character sheets and prop cut-outs (2 days).**
- A reference sheet per cast member, saved in the character library and passed with every picture.
- Cut-out props with transparent output or background removal, animated as layers with word-timed entrances.

**Phase 5: Story sound effects (3 days).**
- The `sfx-core` CC0 pack manifest (every file's licence recorded).
- New procedural sounds.
- `ambience`, `sfx` and `silence` fields, with word anchors.
- A sound palette per style, and the restrained `"sfx": "auto"`.
- Mixing with ducking and protected hits.
- Preview checks.

**Phase 6: Agent guide, app tiles and docs (1.5 days).**
- The `video_templates` guide for `look: "stickman"`, under 3 KB, like the 3D guide.
- The setup panel's "Art style" tiles with our own rendered samples.
- README, store text and sample prompts (Hindi and English).

**Phase 7: Eval and release (2 days).** Ten prompts:
- explainer (line-art);
- habit story (cozy-color, Hindi);
- science fact (retro-tv);
- survival rule (noir-thriller);
- workplace fable (prehistoric);
- Edo or Mughal history (historical);
- concept metaphor (classic-bw);
- product promo;
- a 5-minute film;
- a reel at 9:16.

Each runs with and without an image provider, and through 2 voice providers.

Score:
- the first 3 seconds hook (picture, sound, text);
- picture progress at least every 2.5 s;
- character consistency;
- no text inside images;
- captions in sync;
- sound effects in sync and clear under the voice;
- cost per minute;
- render time.

Then release v0.14.0: tag, catalog, update.

**Total: about 19 working days.**

## 5. Risks

| Risk | Plan |
|---|---|
| Image cost on long videos (a 10-minute film may need 100+ pictures) | ask first with a cost estimate; per-video budget; cache everything; reuse backgrounds across shots in the same place; the code-drawn fallback is free |
| The same character drifts between pictures | reference sheet passed with every image; stickmen drawn in code over painted backgrounds where consistency matters most |
| Models draw garbled text in pictures | prompts forbid text; all text is our overlay (Devanagari correct); Phase 0 measures it, and pictures with text can be redrawn |
| Provider APIs, models or prices change | adapters behind one interface; IDs and prices kept in a dated config, rechecked each release; Test button shows real status |
| Key leakage | 0600 secrets file written by Rust; never in chat, commands, logs or reports; tests that scan outputs for key patterns |
| Sound licensing | CC0-only pack with per-file licence records; no scraping of sites whose terms forbid it; procedural sounds when unsure |
| "Inspired by" styles and copyright | write our own look text; never name channels in prompts; credit the MIT reference in the README; don't bundle their media |
| Small models write vague scenes | the engine builds the prompts; scene descriptions are short and concrete; the validator checks for missing `art.scene` with a fix hint |
| Slow renders (image calls take seconds each) | draw pictures in parallel (limit per provider), cached; films reuse cached shots as today |

## 6. Decisions needed from you

1. **Image provider for the spike:** Gemini image, OpenAI image or both. We need one test key, and your OK for a small spend (about $1–3 for Phase 0).
2. **Voice providers to support first:** the plan has Gemini, ElevenLabs and OpenAI. Each needs a key to test, and any one can be dropped.
3. **Where keys live:** the plan uses a 0600 secrets file written by the app. The OS keychain can come later.
