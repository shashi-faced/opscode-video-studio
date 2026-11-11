// Single source of truth for the storyboard format.
// Used by the validator, the normaliser, `templates` docs and the JSON Schema export.

import { PLATFORM_IDS } from './platforms.mjs';
import { ART_STYLES } from '../art/styles.mjs';
import { PROP_ENTERS } from '../art/props.mjs';

export const FORMATS = ['16:9', '9:16', '1:1', '4:5'];
export const CAPTION_STYLES = ['line', 'karaoke', 'pop'];
export const CAPTION_POSITIONS = ['bottom', 'middle', 'top'];
export const CAPTION_TIMINGS = ['auto', 'tts', 'whisper'];
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
export const POSES = ['idle', 'wave', 'walk', 'jump', 'cheer', 'point', 'think', 'dance', 'sit', 'talk'];
// 3D look (plan 12): how the scene is drawn and how the camera films it.
export const LOOKS = ['2d', '3d', 'stickman'];
// Any character in 3D (plan 12, Phase 6): a design made only of choices from these lists.
export const DESIGN = {
  plan: ['biped', 'animal', 'quadruped', 'bird', 'fish', 'snake', 'blob', 'robot'],
  size: ['small', 'kid', 'adult', 'big'],
  build: ['slim', 'round', 'chunky', 'ghost', 'snowman'],
  head: ['round', 'oval', 'wide', 'long'],
  ears: ['none', 'round', 'pointy', 'long', 'floppy', 'big-round', 'elephant', 'small'],
  eyes: ['cute', 'big', 'small', 'cyclops'],
  snout: ['none', 'button', 'muzzle', 'long', 'beak', 'trunk', 'pig'],
  horns: ['none', 'small', 'ram', 'unicorn', 'antlers', 'antenna'],
  hair: ['none', 'short', 'long', 'bun', 'spiky', 'beard'],
  extras: ['tail-short', 'tail-long', 'tail-curl', 'tail-fluffy', 'tail-fan', 'wings', 'bat-wings', 'mane', 'shell', 'fins', 'spikes', 'crest', 'whiskers', 'stripes', 'spots', 'cape', 'sting'],
  outfit: ['none', 'shirt', 'dress', 'kurta', 'saree', 'vest', 'suit', 'robe', 'armour', 'spacesuit', 'apron'],
  accessories: ['crown', 'cap', 'hat', 'wizard-hat', 'helmet', 'glasses', 'bow', 'halo', 'scarf', 'bag', 'wand', 'flute', 'stick', 'kettle', 'umbrella', 'book'],
};
export const WEATHER = ['none', 'rain', 'snow', 'leaves', 'fireflies', 'sparkles'];
export const NEAR_PROPS = ["sofa", "tree", "tree-large", "house", "tent", "campfire", "desk", "bed", "table", "bench", "fridge", "stove", "bookcase", "signpost", "barrel", "chest", "plant-pot", "tv", "rock", "ship", "fence", "cake", "lamp-floor"];
export const CAMERAS = ['auto', 'extreme-wide', 'wide', 'full', 'medium', 'medium-close', 'close', 'extreme-close', 'two-shot', 'over-shoulder', 'dolly-in', 'dolly-out', 'orbit', 'pan-left', 'pan-right', 'crane-up', 'crane-down', 'follow'];
// Per spoken line (3D): the director picks automatically; these force a shot for that line.
export const LINE_SHOTS = ['auto', 'close', 'medium-close', 'over-shoulder', 'two-shot', 'medium', 'wide', 'reaction'];
// The last seven are drawn by stickmen; cartoon and 3D characters show the nearest of the first six.
export const CHARACTER_MOODS = ['happy', 'sad', 'surprised', 'angry', 'worried', 'sleepy', 'shocked', 'frustrated', 'sweating', 'crying', 'grin', 'deflated', 'suspicious'];
export const POSITIONS = ['far-left', 'left', 'center', 'right', 'far-right'];
export const ENTRANCES = ['none', 'walk-in', 'pop', 'fly-in', 'fade'];
export const SIZES = ['small', 'medium', 'large'];
export const SKINS = ['light', 'medium', 'tan', 'dark'];
// Illustrated scene backgrounds (backgrounds.mjs). Outdoor ones change with "time".
export const BACKGROUNDS = ['meadow', 'forest', 'mountains', 'beach', 'village', 'city', 'sky', 'space', 'underwater', 'home', 'bedroom', 'classroom', 'office', 'festival'];
export const TIMES = ['day', 'sunset', 'night'];
export const VOICE_PROVIDERS = ['edge', 'elevenlabs', 'none'];
export const TRANSITIONS = ['fade', 'slide', 'zoom', 'cut'];
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
  pose: enm(POSES, { doc: 'what it does: idle, wave, walk, jump, cheer, point, think, dance, sit, talk' }),
  mood: enm(CHARACTER_MOODS, { doc: 'face: happy, sad, surprised, angry, worried, sleepy (stickman also: shocked, frustrated, sweating, crying, grin, deflated, suspicious)' }),
  position: enm(POSITIONS, { doc: 'where it stands; leave empty to spread characters evenly' }),
  facing: enm(['left', 'right'], { doc: 'which way it looks' }),
  enter: enm(ENTRANCES, { doc: 'how it appears: walk-in, pop, fly-in, fade' }),
  size: enm(SIZES),
  near: enm(NEAR_PROPS, { doc: '3D only: a prop placed next to this character, e.g. tent, sofa, tree, desk, bed, campfire' }),
});
// One spoken line: the character says it in its own voice, with a speech bubble.
const prop = obj({
  icon: str(30, { required: true, doc: 'what it is: phone, money, clock, battery-low, bell, lightbulb, heart, cage, chart, trophy, coffee, bed, tv… (stickman look)' }),
  position: enm(POSITIONS, { doc: 'where it stands; default beside the characters' }),
  y: enm(['ground', 'air'], { doc: 'on the ground (default) or floating in the air' }),
  size: enm(SIZES),
  enter: enm(PROP_ENTERS, { doc: 'pop (default), drop, slide, draw (drawn line by line), wobble, none' }),
  at: num(0, 60, { doc: 'seconds into the scene when it appears' }),
});

const line = obj({
  who: str(24, { required: true, doc: 'cast id of the speaker' }),
  text: str(140, { required: true, soft: 90, doc: 'what the character says: one short sentence' }),
  mood: enm(CHARACTER_MOODS, { doc: 'face while saying it' }),
  shot: enm(LINE_SHOTS, { doc: '3D only, optional: close, medium-close, over-shoulder, two-shot, medium, wide, or reaction (show the listener)' }),
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
      look: enm(LOOKS, { doc: '2d, 3d or stickman for this scene; normally set once at the top' }),
      props: list(prop, 6, { doc: 'stickman look: objects beside the characters (phone, money, clock…)' }),
      weather: enm(WEATHER, { doc: '3D only: rain, snow, leaves, fireflies, sparkles' }),
      camera: enm(CAMERAS, { doc: '3D only: wide, medium, close, two-shot, dolly-in, dolly-out, orbit, pan-left, pan-right, crane-up; default auto' }),
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
      look: enm(LOOKS),
      props: list(prop, 6, { doc: 'stickman look: objects beside the characters' }),
      weather: enm(WEATHER),
      camera: enm(CAMERAS, { doc: '3D only; default auto: medium shot, then a close-up on each speaker' }),
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
  look: enm(LOOKS, { doc: '2d (illustrated cartoon, default), 3d (3D characters and worlds), or stickman (hand-drawn stick figures in an art style)' }),
  art: obj({ style: enm(ART_STYLES, { doc: 'stickman art style' }), theme: enm(['light', 'dark'], { doc: 'classic-bw only: black on white (light) or white on black (dark)' }) }, { doc: 'look "stickman": { "style": "line-art" | "classic-bw" | "modern-pop" | "retro-tv" | "cozy-color" | "cozy-story" | "prehistoric" | "historical" | "amber-noir" | "noir-thriller" }' }),
  models: enm(['auto', 'built-in', 'pack'], { doc: '3D only: auto uses the best downloaded models where installed; built-in = characters made in code for everyone; pack = downloaded models for every kind that has one' }),
  scenery: enm(['auto', 'built-in'], { doc: '3D only: auto uses the downloaded world pack (furniture, trees, houses, buildings) where installed; built-in = places made in code' }),
  cinematic: { type: 'bool', doc: '3D, 16:9: film look with 2.39:1 letterbox bars and a gentle hand-held camera' },
  accent: { type: 'color', doc: 'highlight colour, e.g. #ff9a3c' },
  brand: obj({ name: str(40), logo: { type: 'path' } }),
  voice: obj({ provider: enm(VOICE_PROVIDERS), voice: str(60), rate: str(8, { doc: 'e.g. +4% or -6%' }), narrator: str(60, { doc: 'ElevenLabs only: the narrator\'s voice by name (from video_voices); default picks one' }) }),
  music: obj({ style: enm(MUSIC_STYLES), volume: num(0, 1), file: { type: 'path', doc: 'your own music file instead of generated music' } }),
  captions: obj({
    style: enm(CAPTION_STYLES, { doc: 'line: sentence at the bottom; karaoke: the spoken word lights up; pop: 1-3 big words at a time (reels)' }),
    position: enm(CAPTION_POSITIONS),
    timing: enm(CAPTION_TIMINGS, { doc: 'auto (default): the voice\'s word times, checked by listening (Whisper) only where they are missing; whisper: always listen; tts: never listen' }),
    lines: { type: 'bool', doc: 'true: dialogue lines get captions too (useful when speech bubbles are off). Default false' },
  }, { doc: 'true, false, or { style, position, timing, lines }. Default depends on the platform' }),
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
    design: obj({
      plan: enm(DESIGN.plan, { doc: 'body plan: biped (person-like), animal (standing animal), quadruped (4 legs), bird, fish, snake, blob (ghost, snowman, round thing), robot' }),
      species: str(30, { doc: 'what it is, in words (for you; the look comes from the fields)' }),
      size: enm(DESIGN.size), build: enm(DESIGN.build), head: enm(DESIGN.head),
      ears: enm(DESIGN.ears), eyes: enm(DESIGN.eyes), snout: enm(DESIGN.snout), horns: enm(DESIGN.horns), hair: enm(DESIGN.hair),
      extras: list(enm(DESIGN.extras), 8, { doc: 'up to 8 of: ' + DESIGN.extras.join(', ') }),
      outfit: enm(DESIGN.outfit),
      accessories: list(enm(DESIGN.accessories), 4, { doc: 'up to 4 of: ' + DESIGN.accessories.join(', ') }),
      colors: obj({ main: { type: 'color' }, belly: { type: 'color' }, accent: { type: 'color' }, outfit: { type: 'color' }, hair: { type: 'color' } }),
    }, { doc: '3D only: design any character from parts, or "preset:<id>" for a ready-made one (peacock-king, crocodile, dragon, tortoise, monkey, ghost, astronaut, cow, goat, parrot, snake, elephant-queen, tiger, frog, bee, snowman, teddy, alien, wizard, robot-chaiwala), or "library:<id>" for a saved one' }),
    model: enm(['auto', 'built-in', 'pack'], { doc: '3D only: auto picks the best look; built-in = character made in code; pack = the downloaded model for this kind (video_assets)' }),
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
