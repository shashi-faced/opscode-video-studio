// Short guides for the art styles and the format recipes (plan 18), returned by video_templates.
import { STYLES, styleBase } from './art/styles.mjs';

/** What each style is for, one line each (the agent picks from this). */
export const STYLE_NOTES = {
  'line-art': 'hand-drawn ink on paper; explainers', 'classic-bw': 'black on white; concepts', 'modern-pop': 'clean studio; tech, AI tools',
  'retro-tv': 'glowing heads, scan lines; science, mysteries', 'cozy-color': 'warm illustrated places; feelings, habits', 'cozy-story': 'friendly storytelling; everyday life',
  prehistoric: 'cave paintings look; satire, fables', historical: 'old-world cartoon; history', 'amber-noir': 'moody amber; what-if stories', 'noir-thriller': 'dark suspense; survival, warnings',
  whiteboard: 'a hand draws every line and word as the voice speaks; teaching, step-by-step, B2B',
  chalkboard: 'chalk on a green board, drawn by hand; school topics, maths, science',
  kinetic: 'no pictures: the spoken words fly in big, timed to the voice; quotes, motivation, facts',
  'flat-vector': 'clean flat shapes and colours, flat characters; tech, finance, science explainers',
  documentary: 'dark film look, serif titles, grain and slow push-ins; history, true crime, business stories. Pairs with map, timeline and chart scenes',
  neon: 'glowing synthwave: neon stickmen, a striped sun and a rolling grid; tech, gaming, futurism, "what if"',
  horror: 'dark, desaturated, flickering light, fog and a slow creeping zoom; whispered captions; creepy facts, unsolved mysteries',
  'retro-pixel': 'pixel-art pictures, chunky mono text, 8-bit motion in steps; gaming, nostalgia, fun facts',
  'paper-cutout': 'paper shapes with torn edges and soft shadows, stop-motion jitter, sticker-edged characters; stories, history, finance explainers',
  watercolor: 'soft painted washes on textured paper, pastel colours, serif titles; kids stories, bedtime, festivals',
  comic: 'comic panels: halftone dots, action lines, outlined characters, narration boxes, oval speech bubbles; add "sfx": "POW!" to a scene for a burst; stories, satire, kids',
  clay: '3D in soft plasticine: matte clay characters and places with fingerprint texture, no outlines; kids stories, cosy explainers',
  'low-poly': '3D with flat-shaded facets: low-poly characters, hills and trees; games, tech, nature, travel',
  isometric: '3/4-angle blocks (buildings, servers) on a platform with data flowing between them; how-it-works, systems, tech and logistics',
};

export function stylesSection() {
  const out = ['\n## Art styles (optional: set "art": { "style": "<id>" })'];
  for (const id of Object.keys(STYLES)) {
    const base = styleBase(id);
    out.push(`- ${id}: ${STYLES[id].label}. ${STYLE_NOTES[id] || ''}${base === 'stickman' ? ' (people are stickmen; sets look "stickman")' : base === 'motion' ? ' (text only; characters are not drawn)' : base === '3d' ? ' (3D characters and places; sets look "3d")' : ' (works with the 2D look)'}`);
  }
  out.push('- Every video in a style varies a little by itself (colours, motion, transitions), so videos never look copied. Do not set "transition" unless the user asks.');
  out.push('- Pick by mood: horror for scary or mystery topics, neon for tech/gaming/future, comic or watercolor for kids, documentary for history and true crime, isometric for how-it-works.');
  out.push('- whiteboard / chalkboard: keep on-screen text short; the hand writes it while the voice speaks. kinetic: the narration IS the picture, so write strong short sentences and put *stars* on 1-2 key words.');
  return out.join('\n');
}

/** Recipes: which templates in which order, and one complete example. */
export const FORMAT_RECIPES = {
  countdown: {
    label: 'Countdown / Top N',
    recipe: 'title (the promise: "5 habits that …") → rank 5 → rank 4 → … → rank 1 (the strongest last) → cta or a short question for comments. Narration of each rank: "Number three: …" plus one reason.',
    example: { title: '5 habits that waste your morning', type: 'reel', platform: 'insta-reel', art: { style: 'whiteboard' }, scenes: [
      { template: 'title', headline: '5 habits that *waste* your morning', narration: 'Five habits that quietly waste your morning.' },
      { template: 'rank', number: 2, title: 'Checking your *phone*', text: 'Your brain wakes up stressed.', icon: 'phone', narration: 'Number two: checking your phone first. Your brain wakes up stressed.' },
      { template: 'rank', number: 1, title: '*Snoozing*', text: 'Every snooze makes you more tired.', icon: 'alarm', narration: 'And number one: snoozing. Every snooze makes you more tired.' },
      { template: 'cta', headline: 'Which one is *you*?', narration: 'Which one is you? Tell me in the comments.' }] },
  },
  facts: {
    label: 'Rapid-fire facts',
    recipe: 'title (hook: "7 facts that sound fake") → fact 1 → fact 2 → … (one fact per scene, 4-6 s each, no filler) → cta. Number the facts.',
    example: { title: 'Facts that sound fake', type: 'reel', platform: 'youtube-short', art: { style: 'kinetic' }, scenes: [
      { template: 'title', headline: 'Facts that sound *fake*', narration: 'Three facts that sound fake but are true.' },
      { template: 'fact', number: 1, fact: 'Bananas are *berries*. Strawberries are not.', icon: 'banana', narration: 'Bananas are berries. Strawberries are not.' },
      { template: 'fact', number: 2, fact: 'Octopuses have *three hearts*.', icon: 'heart', narration: 'An octopus has three hearts.' }] },
  },
  myth: {
    label: 'Myth vs truth',
    recipe: 'title (contrarian hook: "Everything you know about X is wrong") → myth → myth → … → bullets or cta with the takeaway. In each myth scene the narration says the myth, then the truth in a second sentence.',
    example: { title: 'Sleep myths', type: 'explainer', platform: 'youtube', art: { style: 'flat-vector' }, scenes: [
      { template: 'title', headline: 'Sleep *myths* you still believe', narration: 'Sleep myths you probably still believe.' },
      { template: 'myth', kicker: 'Myth #1', myth: 'Adults need only 5 hours.', truth: 'Most adults need *7 to 9 hours*.', narration: 'Adults only need five hours. In fact, most adults need seven to nine.' }] },
  },
  quiz: {
    label: 'Quiz / trivia',
    recipe: 'title ("Only 1 in 10 gets all 5 right") → quiz → quiz → … → cta ("How many did you get?"). The narration asks the question and reads the options; a countdown runs after it, then the answer lights up.',
    example: { title: 'Space quiz', type: 'reel', platform: 'insta-reel', art: { style: 'flat-vector' }, scenes: [
      { template: 'title', headline: 'Only *1 in 10* gets this', narration: 'Only one in ten people get this right.' },
      { template: 'quiz', question: 'Which planet is the *hottest*?', options: ['Mercury', 'Venus', 'Mars'], answer: 2, countdown: 3, explain: 'Venus: its clouds trap heat.', narration: 'Which planet is the hottest? Mercury, Venus or Mars?' },
      { template: 'cta', headline: 'Did you get it?', narration: 'Did you get it? Comment your score.' }] },
  },
  poll: {
    label: 'Would you rather',
    recipe: 'title → poll → poll → … → cta asking viewers to comment their pick. Give resultA (a percent) only if you know it; otherwise leave it out.',
    example: { title: 'Would you rather', type: 'reel', platform: 'insta-reel', scenes: [
      { template: 'poll', optionA: 'Read minds', optionB: 'Be invisible', iconA: 'brain', iconB: 'eye', narration: 'Would you rather read minds, or be invisible?' }] },
  },
  chat: {
    label: 'Chat story',
    recipe: 'chat scenes tell a story in messages (8-14 short messages in total, split over 2-3 chat scenes), then a story or cta scene with the twist or lesson. The narration says what the reader feels, not every message.',
    example: { title: 'The excuse that failed', type: 'reel', platform: 'insta-reel', scenes: [
      { template: 'chat', contact: 'Mom', messages: [{ from: 'Mom', text: 'Where are you?' }, { from: 'me', text: 'Library, studying 📚' }, { from: 'Mom', text: 'Funny. I am at the library.' }], narration: 'I told Mom I was at the library. She was at the library.' }] },
  },
  post: {
    label: 'Post story (POV)',
    recipe: 'post (the hook post: title + 2-4 sentences, read out) → story or dialogue scenes that act out what happened (3-5) → post with tag "Update" for the twist → cta asking what they would do. Generic design; never name a real site or community; our own moving background, never game footage.',
    example: { title: 'The credit thief', type: 'reel', platform: 'insta-reel', scenes: [
      { template: 'post', user: 'quiet_intern', community: 'Office Stories', time: '5h', title: 'My manager took credit for my idea. *So I let him present it.*', body: 'He did not know the numbers were mine too.', votes: 24800, comments: 1320, narration: 'My manager took credit for my idea. So I let him present it.' },
      { template: 'dialogue', characters: [{ who: 'man' }, { who: 'woman' }], lines: [{ who: 'woman', text: 'Where did this number come from?' }, { who: 'man', text: 'Uh… the team?' }] },
      { template: 'post', tag: 'Update', user: 'quiet_intern', title: 'I got *his job*.', votes: 51200, comments: 4100, narration: 'Update: I got his job.' }] },
  },
  beforeafter: {
    label: 'Before / after',
    recipe: 'title (the result as a promise) → beforeafter (after first, then the wipe to before) → steps (how to get there) → cta. Say "before" in the narration where the wipe should start.',
    example: { title: '30-day morning reset', type: 'reel', platform: 'youtube-short', scenes: [
      { template: 'beforeafter', headline: 'One habit, *30 days*', after: { text: 'Up at 6, calm mornings', icon: 'sun' }, before: { text: 'Snoozing till 9', icon: 'alarm' }, narration: 'This is me after thirty days. And before? Snoozing till nine.' },
      { template: 'steps', headline: 'How', steps: ['Phone out of the bedroom', 'Same wake time daily', 'Sunlight first'], narration: 'Here is how.' }] },
  },
  // Plan 18 M4: data and documentary.
  data: {
    label: 'Data story (charts)',
    recipe: 'title (the surprising number) → chart scenes (bar to compare, line for change over time, pie for shares, race for a ranking over years) → stat or bullets with the takeaway → cta. Use real, sourced numbers only (put the source in "source"); never invent data. Name each bar or slice in the narration: it appears when it is said.',
    example: { title: 'Who wins UPI', type: 'explainer', platform: 'youtube', art: { style: 'documentary' }, scenes: [
      { template: 'title', headline: '*Half* of India pays with one app', narration: 'Half of all UPI payments in India go through one app.' },
      { template: 'chart', kind: 'bar', headline: 'UPI share by app', data: [{ label: 'PhonePe', value: 48 }, { label: 'Google Pay', value: 37 }, { label: 'Paytm', value: 7 }], suffix: '%', highlight: 'PhonePe', source: 'NPCI', narration: 'PhonePe has almost half. Google Pay is second. Paytm is far behind.' },
      { template: 'cta', headline: 'Which app do *you* use?', narration: 'Which one do you use?' }] },
  },
  documentary: {
    label: 'Documentary (map and timeline)',
    recipe: 'title (cold open: a place, a year, a question) → map (where it happened) → timeline (how it unfolded) → chart or stat (the scale) → quote or bullets (what it means) → cta. Style "documentary". Say each year and place in the narration: it lights up as it is said.',
    example: { title: 'The spice route', type: 'explainer', platform: 'youtube', art: { style: 'documentary' }, scenes: [
      { template: 'map', kicker: 'The spice route', headline: 'From *Kochi* to *Venice*', route: ['Kochi', 'Muscat', 'Cairo', 'Venice'], narration: 'Pepper left Kochi, crossed to Muscat, travelled through Cairo and reached Venice.' },
      { template: 'timeline', headline: 'How it changed', events: [{ year: '1498', title: 'Vasco da Gama lands' }, { year: '1600', title: 'East India Company' }, { year: '1947', title: 'Independence' }], narration: 'In 1498 Vasco da Gama landed. In 1600 the East India Company was founded. In 1947 India was free.' }] },
  },
  news: {
    label: 'News update',
    recipe: 'news (the headline, a detail line, 2-4 ticker lines) → map or chart (where, how much) → bullets (what happens next) → cta. Generic news look; never name a real channel. State only facts the user gave or that you can source.',
    example: { title: 'Launch update', type: 'announcement', platform: 'youtube-short', scenes: [
      { template: 'news', headline: 'New metro line opens *today*', subline: '12 stations, 25 minutes end to end.', place: 'Pune', ticker: ['Trains every 7 minutes', 'Fares from ₹10'], narration: 'Breaking: the new metro line opens today, with twelve stations.' },
      { template: 'map', headline: 'Where it runs', pins: [{ place: 'Pune', label: 'Pune' }], narration: 'It runs across Pune.' }] },
  },
};
export const FORMAT_IDS = Object.keys(FORMAT_RECIPES);
const FORMAT_ALIASES = { 'top-n': 'countdown', top: 'countdown', ranking: 'countdown', list: 'countdown', fact: 'facts', 'rapid-fire': 'facts', trivia: 'quiz', myths: 'myth', 'myth-vs-truth': 'myth', 'would-you-rather': 'poll', wyr: 'poll', 'this-or-that': 'poll', 'chat-story': 'chat', text: 'chat', messages: 'chat', 'post-story': 'post', pov: 'post', forum: 'post', 'reddit-story': 'post', 'before-after': 'beforeafter', 'before-and-after': 'beforeafter', transformation: 'beforeafter', 'then-and-now': 'beforeafter', chart: 'data', charts: 'data', 'data-story': 'data', infographic: 'data', docu: 'documentary', history: 'documentary', map: 'documentary', timeline: 'documentary', 'true-crime': 'documentary', newsroom: 'news', 'breaking-news': 'news' };
export const resolveFormat = (f) => { const k = String(f || '').trim().toLowerCase().replace(/[\s_]+/g, '-'); return FORMAT_RECIPES[k] ? k : FORMAT_ALIASES[k] || null; };

export function formatsSection(format) {
  const f = resolveFormat(format);
  const out = ['\n## Formats (how the video is told; any style works with any format)'];
  for (const [k, r] of Object.entries(FORMAT_RECIPES)) out.push(`- ${k}: ${r.label}. ${k === f ? '' : r.recipe.split('→')[0].trim() + ' → …'}`);
  if (f) {
    const r = FORMAT_RECIPES[f];
    out.push(`\n### Recipe for "${f}"\n${r.recipe}\nExample: ${JSON.stringify(r.example)}`);
  } else out.push('Tip: call video_templates with format=<one of these> for its recipe and example.');
  out.push('- Hook rule: the first second shows a picture, big text and the voice together. No greetings ("Hey guys").');
  return out.join('\n');
}
