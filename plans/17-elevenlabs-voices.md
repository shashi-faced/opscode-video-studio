# Plan 17: ElevenLabs voices (a different, expressive voice for every character)

Status (2026-11-12): **built and tested against a fake ElevenLabs API; not released, and not yet run with a real key.**

## 1. Goal

With the user's ElevenLabs key saved, every video's narrator and every character speaks with its own natural, expressive voice, in Hindi and English, with lip-sync and word-by-word captions as before. Without a key nothing changes: the free built-in voices are used.

## 2. How it works

- **Key.** Typed in the app at Settings → Voices. The app hands it to `opscode-video voice-key --stdin` on standard input. Video Studio checks it with ElevenLabs, then keeps it in `~/.opscode/agents/video-studio/secrets.json` (mode 0600). It is never on a command line, in the chat, in a tool result or in browser storage.
- **Which service.** ElevenLabs when a key is saved and the user did not switch back to built-in. No storyboard change is needed.
- **Casting** (`elevenCast` in `src/audio/tts.mjs`, matching in `src/audio/elevenlabs.mjs`). The account's voice library is read (`GET /v2/voices`, cached 12 hours). Each part gets a score per voice from its labels: gender, age (kid, adult, old, big, robot), Indian or Hindi accent for Hindi videos, and narration or character use. The strongest part-and-voice pairs are assigned first, and no two parts share a voice. The result does not depend on the cast order.
- **Named voices.** `"voice": "<ElevenLabs voice name>"` on a cast member, or `voice.narrator` for the narrator. The top-level `voice.voice` stays a built-in id; it sets the language and is the fallback.
- **Speech** (`POST /v1/text-to-speech/{voice_id}/with-timestamps`). Character times in the answer become word times, which drive lip-sync and captions. Kids speak slightly faster and grandparents slightly slower.
- **Model.** The newest the account has, from `eleven_v4`, `eleven_v3`, `eleven_multilingual_v2`, `eleven_flash_v2_5`, or the user's choice in Settings.
- **Delivery tags.** A dialogue line may start with `[laughs]`, `[whispers]`, `[excited]` and similar. The v3 and v4 models act on them. They are removed from captions, speech bubbles, word timings, the built-in voices, and older ElevenLabs models (which would read them aloud).
- **Cost control.** Every clip is cached on disk by voice, model and text, so rendering again costs nothing. The render result says who spoke and how many characters were billed.
- **Fallback.** If ElevenLabs cannot be reached, refuses the key, or runs out of credits, that video continues with the built-in voices and the result says so.
- **HyperFrames videos** use the same code, so their narrator is an ElevenLabs voice too.

## 3. Tool and command

- `video_voices { action: "status" | "list" | "test" }`: which service is in use and credits left; the voices to choose from (by gender, age, language, search word); a short test clip.
- `opscode-video voice-key --stdin`: save, switch, set the model, remove. Used by the app only.
- The agent prompt has a "CHARACTER VOICES" section: voices are automatic; how to pick by name; one delivery tag per line when ElevenLabs is in use; never ask for a key in the chat.

## 4. App (`Hecto`)

- Settings → **🎙 Voices** (`VoicesTab.tsx`, `services/voiceSettings.ts`): choose Built-in or ElevenLabs, save or remove the key, see plan, voices and characters left, choose the model, and read how to get a key.
- `video_voices` needs no approval and has status words.

## 5. Checked

- `test/elevenlabs.test.mjs`, 14 tests against a local fake API that returns real MP3 audio:
  - a wrong key is refused and not saved; a good key is saved with mode 0600 and never appears in any result;
  - a Hindi story with a narrator, a boy and a grandmother makes four requests with three different voices, the language set to Hindi, and word times without tags;
  - the same story again makes no requests (cache);
  - named voices, a speaker outside the cast, the older model never receiving tags, switching back to built-in, removing the key, and a revoked key falling back with a note.
- Full suite **171/171**.
- App: `tests/voices_settings_qa_test.js` 6/6; type check clean; the tab was looked at in the browser pane on a temporary page.
- API shapes (endpoint, fields, model ids, voice labels) were read from ElevenLabs' docs on 2026-11-11.

## 6. Not done

- **No run with a real key.** The first real video may show differences the fake cannot: label names on real voices, whether `eleven_v4` returns timings, how good the Hindi is per voice.
- **Fallback during a video** (ElevenLabs failing halfway) is written but only its start-of-video form is tested, because the built-in voices need the real internet.
- Voice matching depends on the voices in the user's library. A library with no child or old voices gives adults for those parts.
- Not built: creating voices from a description (ElevenLabs voice design), voice cloning, an estimate of the cost before rendering.
- Needs a release (v0.16.0) and an app rebuild before the user can use it.
