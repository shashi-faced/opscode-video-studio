// Loaded before every test file: tests never use the user's saved ElevenLabs key (it would spend their credits).
process.env.OPSCODE_IGNORE_SAVED_VOICE_KEY = '1';
