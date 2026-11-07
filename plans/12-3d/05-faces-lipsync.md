# Phase 5: Faces and lip-sync (v0.9.0)

**Done when:**
- Every spoken line moves the speaker's mouth through matching mouth shapes, in English and Hindi.
- On 20 test lines, a reviewer (or the vision critic) rates the sync as good on at least 17.

## 1. Mouth shapes

- **Viseme set:** Oculus/Meta 15 (sil, PP, FF, TH, DD, kk, CH, SS, nn, RR, aa, E, I, O, U), drawn as **8 mouth images** (Rhubarb/Preston-Blair style A–H + X):

  | Image | Visemes |
  |---|---|
  | X (rest) | sil |
  | A | PP |
  | B | kk, DD, nn, SS, TH |
  | C | E, I |
  | D | aa |
  | E | O |
  | F | U |
  | G | FF |
  | H | RR |

- **Mouth atlas:** a small SVG sprite sheet rendered to a texture, one row per mouth style (human, animal snout, beak, robot grille). It is applied as a decal plane on the head that follows the head bone.
- **Snouts and beaks:** a hinged jaw (rotate by the viseme's openness) plus the decal.
- **Glb characters (Phase 3):** use morph targets if present, otherwise the decal.

## 2. From text and word timings to visemes

Edge TTS gives word start and end times, not visemes.
1. Split each word into phonemes:
   - **English:** port TalkingHead's `lipsync-en` letter-to-sound rules (MIT, NRL 1976 rules), with an optional CMUdict lookup (BSD) for common words.
   - **Hindi:** new `lipsync-hi`, ported from TalkingHead's Bengali module (inherent vowel, virama, matras, anusvara, nukta) plus Epitran `hin-Deva` schwa deletion (MIT). Latin-script Hinglish uses the English rules.
2. Spread each word's phonemes across its time window by relative length (vowels longer), then map them to visemes.
3. Smoothing: at least 2 frames per viseme; co-articulation by blending neighbours 30 %.
4. **Optional check:** if `rhubarb` (MIT) is installed, compare on English clips and log the agreement in the eval.

## 3. Expressions and life

- Moods per line (`lines[].mood`) blend brows, eyes and mouth corners.
- Blinks every 2–5 s from a seeded schedule, and never during a held surprised look.
- Gaze: the speaker looks at the listener and the listener looks at the speaker. Turning to the camera happens on narration.
- Head nods on stressed words: the longest word per sentence gets a small nod.
- Secondary motion (ears, tails, hair) as damped springs solved in closed form from the pose curve.
