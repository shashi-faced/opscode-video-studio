// Single source of truth for the storyboard format.
// Used by the validator, the normaliser, `templates` docs and the JSON Schema export.

export const FORMATS = ['16:9', '9:16', '1:1'];
export const THEMES = ['night-saffron', 'clean-light', 'midnight-neon', 'corporate-blue', 'warm-paper'];
export const MASCOTS = ['robot', 'dev', 'founder'];
export const MOODS = ['happy', 'worried'];
export const MUSIC_STYLES = ['indian-electronic', 'corporate-upbeat', 'ambient', 'none'];
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
  title: str(80, { doc: 'name of the video; also used for the output file name' }),
  format: enm(FORMATS, { doc: '16:9 YouTube/website, 9:16 Reels/Shorts, 1:1 feed post' }),
  theme: enm(THEMES),
  accent: { type: 'color', doc: 'highlight colour, e.g. #ff9a3c' },
  brand: obj({ name: str(40), logo: { type: 'path' } }),
  voice: obj({ provider: enm(VOICE_PROVIDERS), voice: str(60), rate: str(8, { doc: 'e.g. +4% or -6%' }) }),
  music: obj({ style: enm(MUSIC_STYLES), volume: num(0, 1), file: { type: 'path', doc: 'your own music file instead of generated music' } }),
  captions: { type: 'bool' },
  fps: num(12, 60),
  scenes: { type: 'list', of: null, required: true, min: 2, max: 12, doc: '2-12 scenes; first "title", last "cta"' },
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
};
