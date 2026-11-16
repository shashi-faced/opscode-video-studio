# Plan 19: Mythology stories (Ramayana, Mahabharata, Puranas) in Madhubani and devotional-cartoon styles

Status: P1–P5 built and released in v0.20.0 (2026-11-17): mythology kit, places and divine light, style `madhubani`, format `katha`, `devotional` music. Open: P0 (match the reel's voice once the file is shared), P6 (devotional look, image-model pictures), P7 (gallery tile, eval), and more than 16 scenes per video.

## 1. Goal

The user writes "Make a 1-minute reel: how Hanuman ji broke Shanidev's pride" (or pastes a story document, like *Samrat Bharat, Part 1*) and gets a finished Hindi reel in the look and feel of today's popular devotional story reels: era-correct characters (deities, rishis, kings, vanaras), Indian places of that time, a dramatic Hindi storyteller voice, devotional music, a shot every 2–3 seconds, and a closing call to comment "जय श्री राम".

Two looks:
- **Madhubani** (what the user asked for): Mithila folk painting. Flat colours, thick black double outlines, every shape filled with patterns (fish scales, leaves, dots, lines), large almond eyes in profile, decorative borders, no shading.
- **Devotional cartoon** (the reference reel): soft cel-shaded characters with outlines, glowing skies, divine light and haloes, close-ups and slow camera moves.

## 2. The reference reel (watched 2026-11-14)

`instagram.com/reel/Dfro1rnz_Eh` by anuragsir__ (81K likes): *how Bajrangbali broke Shanidev's pride*. Labelled "AI content". 68 s, 1080×1920.

- **It is not Madhubani.** It is the devotional cartoon look above: Hanuman (orange, crown, red tilak, bead necklaces), Shanidev (blue skin, crown, purple sash), Saturn and stars in a purple cosmos, a giant hand holding Shanidev, a Shivling with oil, a family praying at a home shrine, Hanuman in a sunset forest. Small Devanagari name labels ("शनि देव").
- **Pacing:** about 25 shots in 68 s, a new picture every 2.5–3 s; almost every frame moves (slow push-ins, light rays, glow).
- **Story shape** (from the caption and the shots): hook question → the proud god arrives → the clash → the divine reveal → the lesson (oil on Shanidev, prayer at home) → call to comment "जय श्री राम / जय बजरंगबली".
- **Voice and music: not heard yet** (the browser here plays it muted). To match the voice (male or female, pace, pauses, music, sound effects), the user should download the reel and share the file; Whisper (plan 13) will then give the script and its timing.
- The art is AI-made (consistent characters across many shots). Drawing in code can match the Madhubani look well, but matching this reel's polish needs pictures from an image model (§5).

## 3. What Video Studio has today

- **Missing everything of the era.** The last *Samrat Bharat* attempt drew a modern boy in a green sweater and jeans in a pine forest (`~/video/samrat-bharat-part-1/_check/f02.png`). There are no deities, rishis, kings, crowns, dhotis, jewellery, weapons, palaces, ashrams, rivers, battlefields or temples, and no devotional music.
- Useful already: 2D and 3D characters with lip-sync, story and dialogue scenes, the style system with per-video variety (plan 18), Hindi voices (Edge Swara and Madhur, free; ElevenLabs when a key is saved), word-by-word Hindi captions, Whisper.
- No image-model support yet: plan 14 Phase 3 designed it (Gemini or OpenAI images, key in Settings) but it was not built.

## 4. What we build

### 4.1 Mythology character kit (drawn in code, free)
- **People of the era:** king, queen, prince, princess, rishi and rishika (beard, matted hair, rudraksha), soldier, charioteer, villager, child. Clothing: dhoti, angavastram, uttariya, saree, crowns (mukut), jewellery, tilak, sacred thread.
- **Deities and divine figures, in their traditional iconography only:** Ram (blue, bow), Sita, Lakshman, Hanuman (vanara, gada, crown), Krishna (blue, peacock feather, flute), Radha, Shiva (blue-grey, trishul, damru, crescent, Ganga), Parvati, Ganesha, Durga, Vishnu, Lakshmi, Brahma, Shanidev, Surya, Indra, Narada. Ravana (ten heads), Kumbhakarna, demons; Garuda, Nandi, Jatayu.
- **Weapons and props:** bow and arrows, gada, trishul, chakra, conch, lotus, kalash, diya, sacred fire (yajna), rudraksha, palm-leaf books, chariot.
- Each one in a **character sheet** (fixed colours and features), so the same figure looks the same in every shot and every episode.

### 4.2 Places and light
- Ashram in a forest, palace court, river ghat (Ganga, Sarayu), Kailash, cosmos with planets, temple and Shivling, village, Lanka, Kurukshetra, battlefield with chariots, sky and clouds.
- Divine effects: halo and aura, light rays, glowing particles, lotus petals falling, smoke from a yajna, diya flicker.

### 4.3 The two looks
- **Style `madhubani`** (base 2d): pattern fills on every shape (fish scale, leaf, dot, line hatching) generated in SVG; black double outlines; flat Mithila palette (vermilion, turmeric, indigo, leaf green, black on handmade-paper cream); decorative border bands with per-video variety; figures in profile with large almond eyes. Same characters as the kit, through a "Madhubani skin".
- **Style `devotional`** (base 2d): cel shading with soft gradients, warm and cosmic skies, haloes, light rays; close-up framing.

### 4.4 Telling the story
- **Format `katha`** (pauranik story): hook question in the first 2 seconds → setup → conflict → divine reveal → lesson → call to comment (optional, e.g. "कमेंट में जय श्री राम लिखें"). 45–90 s; a new shot every 2–3 s; camera moves on every shot (push-in, pan, tilt-up on a reveal, close-up on a face).
- **Series mode** for long epics: a story document (like the *Samrat Bharat* pack) becomes episodes ("भाग 1, 2…") with the same character sheets and an end card for the next part.
- Name labels in Devanagari when a character first appears.

### 4.5 Voice, music and sound
- **Storyteller voice:** a calm, dramatic Hindi narrator: slower pace, pauses before reveals, emphasis on key words. Free: Edge `hi-IN-MadhurNeural` (male) or `SwaraNeural` (female) with tuned rate and pauses. ElevenLabs: an Indian-accent Hindi narrator voice (the user's library has none today; they can add one in ElevenLabs).
- **Music style `devotional`**, made in code (free): tanpura drone, bansuri flute, soft tabla, temple bells; rises at the reveal.
- **Sound effects:** conch (shankh), temple bell, damru, thunder, whoosh on a divine appearance.

## 5. Pictures drawn in code, or by an image model?

| | Drawn in code (free) | Image model (Gemini / OpenAI, paid) |
|---|---|---|
| Madhubani | **Good**: flat folk art suits code well | Very good |
| Devotional cartoon like the reel | Fair: simpler than the reel | **Matches the reel** |
| Cost per 60 s reel | 0 | about ₹70–80 (≈25 pictures × $0.034, Gemini 1K, price read 2026-11-10) |
| Keys | none | a Gemini or OpenAI key in Settings (never in chat) |

Recommended: build the code-drawn kit and the Madhubani look first (free, works for everyone), then add image-model pictures as an option for the devotional look (plan 14 Phase 3, with character reference sheets so the same Hanuman appears in every shot).

## 6. Respect and accuracy

- Deities only in their traditional forms and colours; never comic distortions, never in disrespectful poses or situations. Characters may move and speak; faces of deities stay calm.
- The story follows a named source (Valmiki Ramayana, Mahabharata, a Purana, or the user's document); the agent says which, and does not invent scripture.
- No copying of a specific creator's characters or channel branding; the look is generic.

## 7. Phases

| Phase | What | Size |
|---|---|---|
| **P0** | Decisions (§9). Listen to the reel (user shares the file): script, voice, pace, music, effects | ½ day |
| **P1** | Character kit: era people, 18 deities and divine figures, weapons and props, character sheets | 3 days |
| **P2** | Places and divine light effects | 2 days |
| **P3** | Style `madhubani` (pattern fills, outlines, borders, profile figures) | 2 days |
| **P4** | Format `katha`, shot pacing and camera moves, Devanagari labels, series mode from a story document | 2 days |
| **P5** | Voice tuning, `devotional` music and sound effects | 1½ days |
| **P6** | Style `devotional`; image-model pictures as an option (plan 14 Phase 3) | 3 days |
| **P7** | Gallery tile, "Try this example" stories, eval (Hanuman–Shanidev, Samrat Bharat part 1, a Mahabharata episode), release | 1 day |

P1–P5 give a free Madhubani mythology reel in about 2 weeks; P6 adds the reel-like devotional look.

## 8. Done when

- "Make a 1-minute Madhubani reel of how Hanuman ji broke Shanidev's pride" gives, without questions, a 9:16 Hindi reel with the right characters, places, storyteller voice, devotional music, a new shot every 2–3 s, and a closing line.
- *Samrat Bharat Part 1* from its document becomes an episode with era-correct people (no modern clothes) and the same characters in every shot.
- A side-by-side with the reference reel: same story shape and pacing; voice and music judged close by the user.

## 9. Decisions needed

1. **Which look first:** Madhubani (as asked), the devotional cartoon of the reel, or both?
2. **Pictures:** free code-drawn only, or also image-model pictures (needs a Gemini or OpenAI key in Settings, about ₹70–80 per 60 s reel) to get close to the reel?
3. **The reel's audio:** please download the reel and share the file, so the voice, pace and music can be matched.
