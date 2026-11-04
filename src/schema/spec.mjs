// Single source of truth for the storyboard format.
// Used by the validator, the normaliser, `templates` docs and the JSON Schema export.

import { PLATFORM_IDS } from './platforms.mjs';

export const FORMATS = ['16:9', '9:16', '1:1', '4:5'];
export const CAPTION_STYLES = ['line', 'karaoke', 'pop'];
export const CAPTION_POSITIONS = ['bottom', 'middle', 'top'];
export const THEMES = ['night-saffron', 'clean-light', 'midnight-neon', 'corporate-blue', 'warm-paper', 'storybook', 'festive'];
export const MASCOTS = ['robot', 'dev', 'founder'];
export const MOODS = ['happy', 'worried'];
export const MUSIC_STYLES = ['indian-electronic', 'corporate-upbeat', 'ambient', 'playful', 'festive', 'none'];

// What kind of video this is. Each type has its own scene recipe, theme and music (see types.mjs).
export const VIDEO_TYPES = ['ad', 'demo', 'explainer', 'story', 'reel', 'howto', 'greeting', 'announcement'];

// Animated cartoon characters (characters.mjs). Humans, animals and objects with faces.
export const CHARACTER_KINDS = [
  'boy', 'girl', 'man', 'woman', 'grandpa', 'grandma',
  'rabbit', 'cat', 'dog', 'bear', 'panda', 'fox', 'elephant', 'lion', 'mouse', 'owl',
  'robot', 'star', 'sun', 'moon', 'cloud',
];
export const POSES = ['idle', 'wave', 'walk', 'jump', 'cheer', 'point', 'think', 'dance'];
export const CHARACTER_MOODS = ['happy', 'sad', 'surprised', 'angry', 'worried', 'sleepy'];
export const POSITIONS = ['far-left', 'left', 'center', 'right', 'far-right'];
export const ENTRANCES = ['none', 'walk-in', 'pop', 'fly-in', 'fade'];
export const SIZES = ['small', 'medium', 'large'];
export const SKINS = ['light', 'medium', 'tan', 'dark'];
// Illustrated scene backgrounds (backgrounds.mjs). Outdoor ones change with "time".
export const BACKGROUNDS = ['meadow', 'forest', 'mountains', 'beach', 'village', 'city', 'sky', 'space', 'underwater', 'home', 'bedroom', 'classroom', 'office', 'festival'];
export const TIMES = ['day', 'sunset', 'night'];
export const VOICE_PROVIDERS = ['edge', 'none'];
export const TRANSITIONS = ['fade', 'slide', 'zoom'];
export const TAG_TONES = ['accent', 'ok', 'alert'];

export const VOICES = [
  { id: 'en-IN-NeerjaExpressiveNeural', note: 'Indian English, female, expressive (default)' },
  { id: 'en-IN-NeerjaNeural', note: 'Indian English, female' },
  { id: 'en-IN-PrabhatNeural', note: 'Indian English, male' },
  { id: 'hi-IN-SwaraNeural', note: 'Hindi, female' },
  { id: 'hi-IN-MadhurNeural', note: 'Hindi, male' },
  { id: 'en-US-AvaMultilingualNeural', note: 'US English, female, very natural' },
  { id: 'en-US-AndrewMultilingualNeural', note: 'US English, male, very natural' },
  { id: 'en-GB-SoniaNeural', note: 'British English, female' },
];

// Field types: str, num, bool, enum, path, color, list(of), obj(fields)
const str = (max, extra = {}) => ({ type: 'str', max, ...extra });
const num = (min, max, extra = {}) => ({ type: 'num', min, max, ...extra });
const list = (of, max, extra = {}) => ({ type: 'list', of, max, ...extra });
const obj = (fields, extra = {}) => ({ type: 'obj', fields, ...extra });
const enm = (values, extra = {}) => ({ type: 'enum', values, ...extra });

// A character placed in a scene: a cast id (or a kind such as "rabbit") plus how it acts.
const character = obj({
  who: str(24, { required: true, doc: 'cast id, or a character kind like "rabbit"' }),
  pose: enm(POSES, { doc: 'what it does: idle, wave, walk, jump, cheer, point, think, dance' }),
  mood: enm(CHARACTER_MOODS, { doc: 'face: happy, sad, surprised, angry, worried, sleepy' }),
  position: enm(POSITIONS, { doc: 'where it stands; leave empty to spread characters evenly' }),
  facing: enm(['left', 'right'], { doc: 'which way it looks' }),
  enter: enm(ENTRANCES, { doc: 'how it appears: walk-in, pop, fly-in, fade' }),
  size: enm(SIZES),
});
// One spoken line: the character says it in its own voice, with a speech bubble.
const line = obj({
  who: str(24, { required: true, doc: 'cast id of the speaker' }),
  text: str(140, { required: true, soft: 90, doc: 'what the character says: one short sentence' }),
  mood: enm(CHARACTER_MOODS, { doc: 'face while saying it' }),
});

const box = obj({
  x: num(0, 1, { required: true, doc: 'left edge, fraction of image width (0-1)' }),
  y: num(0, 1, { required: true, doc: 'top edge, fraction of image height (0-1)' }),
  w: num(0.01, 1, { required: true, doc: 'width, fraction (0-1)' }),
  h: num(0.01, 1, { required: true, doc: 'height, fraction (0-1)' }),
  label: str(48, { doc: 'optional call-out text shown under the scene' }),
  at: num(0, 30, { doc: 'seconds after scene start when it appears' }),
});

// Fields every scene may have.
export const COMMON_FIELDS = {
  template: { type: 'enum', values: null, required: true, doc: 'which layout to use' },
  narration: str(260, { soft: 200, doc: 'what the voice says in this scene: 1-2 short sentences' }),
  duration: num(1, 30, { doc: 'seconds; normally leave empty, it is computed from the narration' }),
  mascot: enm([...MASCOTS, 'none'], { doc: 'illustrated character: robot, dev, founder' }),
  mascotMood: enm(MOODS, { doc: 'happy or worried (dev only)' }),
  transition: enm(TRANSITIONS, { doc: 'how the scene enters' }),
};

export const TEMPLATES = {
  title: {
    use: 'Opening scene: big headline, optional image or mascot.',
    fields: {
      kicker: str(40, { doc: 'small label above the headline' }),
      headline: str(70, { required: true, soft: 40, doc: 'big text, ≤ 6 words. *stars* highlight words' }),
      subline: str(120, { doc: 'one supporting sentence' }),
      image: { type: 'path', doc: 'optional screenshot or picture' },
    },
    example: { template: 'title', kicker: 'AI agents for builders', headline: 'Your AI team. *On your desktop.*', subline: 'Code, browse and automate in one app.', mascot: 'robot', narration: 'Meet Opscode Agent. Your AI team, right on your desktop.' },
  },
  feature: {
    use: 'Show one screenshot with call-outs: highlight boxes, a clicking cursor, chips and tags.',
    fields: {
      kicker: str(40),
      headline: str(70, { required: true, soft: 40 }),
      image: { type: 'path', required: true, doc: 'screenshot to show' },
      imageTitle: str(48, { doc: 'text in the window title bar' }),
      imageFrame: enm(['window', 'plain'], { doc: 'window adds a title bar' }),
      chips: list(str(24), 5, { doc: 'short feature words shown as pills' }),
      highlights: list(box, 6, { doc: 'boxes drawn on the image, in fractions of the image' }),
      cursor: obj({ x: num(0, 1, { required: true }), y: num(0, 1, { required: true }), at: num(0, 30) }, { doc: 'animated cursor that clicks at x,y (fractions)' }),
      tags: list(obj({ text: str(48, { required: true }), tone: enm(TAG_TONES), at: num(0, 30) }), 3, { doc: 'result labels that pop in' }),
    },
    example: { template: 'feature', kicker: 'Browser automation', headline: 'It browses. *It gets it done.*', image: 'shots/browser.png', imageTitle: 'Agent browser', chips: ['navigate', 'click', 'type'], cursor: { x: 0.79, y: 0.65 }, narration: 'It opens a real browser, clicks, types, and completes the task for you.' },
  },
  bullets: {
    use: 'A short list of benefits.',
    fields: {
      kicker: str(40),
      headline: str(70, { required: true, soft: 40 }),
      items: list(str(60), 5, { required: true, min: 1, doc: '1-5 short lines' }),
    },
    example: { template: 'bullets', kicker: 'Why teams switch', headline: 'Ship *faster*', items: ['Many agents in parallel', 'Real browser automation', 'Local or cloud models'], narration: 'Teams ship faster with agents that work in parallel.' },
  },
  split: {
    use: 'Text on one side, image on the other (stacks vertically in 9:16).',
    fields: {
      kicker: str(40),
      headline: str(70, { required: true, soft: 40 }),
      body: str(160, { doc: 'one or two sentences' }),
      image: { type: 'path', required: true },
      side: enm(['left', 'right'], { doc: 'which side the image is on' }),
    },
    example: { template: 'split', kicker: 'Personal agent', headline: 'Works on *your system*', body: 'Cleans up files, runs commands and sets reminders.', image: 'shots/chat.png', narration: 'Your personal agent works right on your system.' },
  },
  stat: {
    use: 'One to three big numbers.',
    fields: {
      kicker: str(40),
      headline: str(70, { soft: 40 }),
      items: list(obj({ value: str(8, { required: true }), label: str(30, { required: true }) }), 3, { required: true, min: 1 }),
    },
    example: { template: 'stat', kicker: 'Results', items: [{ value: '12 min', label: 'average bug fix' }, { value: '3x', label: 'faster reviews' }], narration: 'Average bug fix: twelve minutes.' },
  },
  quote: {
    use: 'A testimonial.',
    fields: {
      quote: str(160, { required: true }),
      author: str(40),
      role: str(50),
      image: { type: 'path', doc: 'optional avatar' },
    },
    example: { template: 'quote', quote: 'It found the bug while I was making chai.', author: 'Priya S.', role: 'Frontend developer', narration: 'Developers love it.' },
  },
  story: {
    use: 'Cartoon scene: an illustrated background with animated characters. Narration tells the story; optional lines make characters speak. A story scene with a headline is a title card ("Miko and the Fallen Star", "The End").',
    fields: {
      background: enm(BACKGROUNDS, { doc: 'illustrated place' }),
      time: enm(TIMES, { doc: 'day, sunset or night (outdoor backgrounds)' }),
      characters: list(character, 4, { doc: '0-4 characters in the scene' }),
      headline: str(70, { soft: 40, doc: 'title card text; leave empty in normal story scenes' }),
      kicker: str(40, { doc: 'small label above the headline' }),
      text: str(140, { soft: 100, doc: 'one storybook line shown on screen (optional)' }),
      lines: list(line, 6, { doc: 'characters speaking, each in their own voice (optional)' }),
    },
    example: { template: 'story', background: 'meadow', time: 'night', characters: [{ who: 'miko', pose: 'wave', mood: 'surprised', position: 'left' }, { who: 'tara', enter: 'fly-in', mood: 'sad', position: 'right' }], narration: 'One night, Miko saw a little star fall into the grass.' },
  },
  dialogue: {
    use: 'Characters talk to each other with speech bubbles, each in their own voice. Use for conversations in stories, explainers and ads.',
    fields: {
      background: enm(BACKGROUNDS),
      time: enm(TIMES),
      characters: list(character, 4, { doc: 'who is on screen; defaults to the speakers' }),
      lines: list(line, 6, { required: true, min: 1, doc: '1-6 lines in order' }),
    },
    example: { template: 'dialogue', background: 'meadow', time: 'night', lines: [{ who: 'tara', text: 'I fell from the sky and cannot find my way home.', mood: 'sad' }, { who: 'miko', text: 'Do not worry! I will help you.', mood: 'happy' }] },
  },
  steps: {
    use: 'Numbered steps that appear one by one (how-to, recipe, process), with an optional picture.',
    fields: {
      kicker: str(40),
      headline: str(70, { required: true, soft: 40 }),
      steps: list(str(70), 6, { required: true, min: 2, doc: '2-6 short steps, in order' }),
      image: { type: 'path', doc: 'optional picture shown beside the steps' },
    },
    example: { template: 'steps', kicker: 'Get started', headline: 'Set up in *3 steps*', steps: ['Download the app', 'Sign in with Google', 'Ask your first question'], narration: 'Getting started takes three quick steps.' },
  },
  cta: {
    use: 'Closing scene: name, line, button, badges.',
    fields: {
      headline: str(40, { required: true, doc: 'usually the product name' }),
      subline: str(100),
      button: str(30, { doc: 'button text, e.g. Download for Linux' }),
      badges: list(str(28), 5),
      logo: { type: 'path', doc: 'defaults to brand.logo' },
    },
    example: { template: 'cta', headline: 'Opscode Agent', subline: 'Made in India. For builders everywhere.', button: 'Download for Linux', badges: ['Multi-agent', 'Browser debug'], narration: 'Opscode Agent. Download it today.' },
  },
};
COMMON_FIELDS.template.values = Object.keys(TEMPLATES);

export const TOP_FIELDS = {
  version: num(1, 1),
  type: enm(VIDEO_TYPES, { doc: 'kind of video: ad, demo, explainer, story, reel, howto, greeting, announcement. Sets the scene recipe, theme and music' }),
  title: str(80, { doc: 'name of the video; also used for the output file name' }),
  platform: enm(PLATFORM_IDS, { doc: 'where it will be posted: sets frame size, safe zones, caption style and extra files (thumbnail, cover, chapters)' }),
  format: enm(FORMATS, { doc: '16:9 YouTube/website, 9:16 Reels/Shorts, 1:1 square, 4:5 feed post. Usually set by "platform"' }),
  theme: enm(THEMES),
  accent: { type: 'color', doc: 'highlight colour, e.g. #ff9a3c' },
  brand: obj({ name: str(40), logo: { type: 'path' } }),
  voice: obj({ provider: enm(VOICE_PROVIDERS), voice: str(60), rate: str(8, { doc: 'e.g. +4% or -6%' }) }),
  music: obj({ style: enm(MUSIC_STYLES), volume: num(0, 1), file: { type: 'path', doc: 'your own music file instead of generated music' } }),
  captions: obj({
    style: enm(CAPTION_STYLES, { doc: 'line: sentence at the bottom; karaoke: the spoken word lights up; pop: 1-3 big words at a time (reels)' }),
    position: enm(CAPTION_POSITIONS),
  }, { doc: 'true, false, or { style, position }. Default depends on the platform' }),
  fps: num(12, 60),
  cast: list(obj({
    id: str(24, { required: true, doc: 'short id used in scenes, e.g. "miko"' }),
    kind: enm(CHARACTER_KINDS, { required: true, doc: 'what the character is' }),
    name: str(30, { doc: 'display name, e.g. Miko' }),
    color: { type: 'color', doc: 'main colour: fur, or clothes for people' },
    hair: { type: 'color', doc: 'hair colour (people)' },
    skin: enm(SKINS, { doc: 'skin tone (people)' }),
    voice: str(60, { doc: 'voice for this character; default picks one from the narrator language' }),
    pitch: str(8, { doc: 'voice pitch, e.g. +20% for a child, -15% for a big animal' }),
    rate: str(8, { doc: 'speaking speed, e.g. +5%' }),
  }), 6, { doc: 'the characters of a story; scenes refer to them by id' }),
  scenes: { type: 'list', of: null, required: true, min: 2, max: 16, doc: '2-16 scenes; the recipe depends on the video type' },
};

export const DEFAULTS = {
  version: 1,
  title: 'video',
  format: '16:9',
  theme: 'night-saffron',
  voice: { provider: 'edge', voice: 'en-IN-NeerjaExpressiveNeural', rate: '+0%' },
  music: { style: 'indian-electronic', volume: 0.5 },
  captions: true,
  fps: 30,
};

export const STAGE = {
  '16:9': { width: 1920, height: 1080, cls: 'f-16x9' },
  '9:16': { width: 1080, height: 1920, cls: 'f-9x16' },
  '1:1': { width: 1080, height: 1080, cls: 'f-1x1' },
  // 4:5 uses the square layout rules with more height.
  '4:5': { width: 1080, height: 1350, cls: 'f-1x1 f-4x5' },
};
