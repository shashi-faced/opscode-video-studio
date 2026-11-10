// Normalise + validate a storyboard. Messages are written for an LLM:
// every error has a JSON path, what is wrong, and a concrete fix.
import { presetDesign, PRESETS } from '../characters/presets.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { TEMPLATES, COMMON_FIELDS, TOP_FIELDS, DEFAULTS, FORMATS, CHARACTER_KINDS, POSES, CHARACTER_MOODS, POSITIONS, ENTRANCES, SIZES, BACKGROUNDS, TIMES, VIDEO_TYPES } from './spec.mjs';
import { TYPE_RECIPES, TYPE_ALIASES } from './types.mjs';
import { PLATFORMS, PLATFORM_IDS, resolvePlatform } from './platforms.mjs';
import { STYLE_ALIASES, ART_STYLES } from '../art/styles.mjs';
import { resolveIcon } from '../art/props.mjs';
import { CAPTION_STYLES, CAPTION_POSITIONS, CAPTION_TIMINGS, LOOKS, CAMERAS, LINE_SHOTS, DESIGN, NEAR_PROPS, WEATHER } from './spec.mjs';
import { loadLibraryCharacter } from '../characters/library.mjs';
import { KIND_ALIASES } from '../compiler/characters.mjs';
import { BACKGROUND_ALIASES, TIME_ALIASES } from '../compiler/backgrounds.mjs';

const POSE_ALIASES = { standing: 'idle', stand: 'idle', still: 'idle', waving: 'wave', hello: 'wave', walking: 'walk', running: 'walk', run: 'walk', jumping: 'jump', hop: 'jump', hopping: 'jump',
  cheering: 'cheer', celebrate: 'cheer', celebrating: 'cheer', happy: 'cheer', pointing: 'point', thinking: 'think', wondering: 'think', dancing: 'dance', talking: 'talk', speaking: 'talk', sitting: 'sit', seated: 'sit', sleeping: 'idle', flying: 'idle', crying: 'idle' };
const LOOK_ALIASES = { stickman: 'stickman', 'stick-man': 'stickman', 'stick man': 'stickman', stick: 'stickman', 'stick figure': 'stickman', 'stick-figure': 'stickman', 'stick figures': 'stickman', stickfigure: 'stickman', 'line art': 'stickman', 'hand-drawn': 'stickman', doodle: 'stickman', '3d': '3d', 'three-d': '3d', 'three d': '3d', threed: '3d', '3-d': '3d', cgi: '3d', pixar: '3d', 'pixar style': '3d', 'pixar-style': '3d', '2d': '2d', 'two-d': '2d', cartoon: '2d', flat: '2d', illustrated: '2d' };
const CAMERA_ALIASES = { ots: 'over-shoulder', 'over-the-shoulder': 'over-shoulder', 'over the shoulder': 'over-shoulder', mcu: 'medium-close', 'medium-close-up': 'medium-close', ecu: 'extreme-close', 'extreme-close-up': 'extreme-close', 'big-close-up': 'extreme-close', ews: 'extreme-wide', 'aerial': 'extreme-wide', 'full-shot': 'full', 'full body': 'full', tracking: 'follow', track: 'follow', 'crane down': 'crane-down', reaction: 'close', 'close-up': 'close', 'close up': 'close', closeup: 'close', 'zoom-in': 'dolly-in', 'zoom in': 'dolly-in', 'push-in': 'dolly-in', 'zoom-out': 'dolly-out', 'zoom out': 'dolly-out', 'pull-out': 'dolly-out', '360': 'orbit', 'orbit-around': 'orbit', 'two shot': 'two-shot', twoshot: 'two-shot', 'long-shot': 'wide', 'long shot': 'wide', establishing: 'wide', 'mid-shot': 'medium', 'mid shot': 'medium', pan: 'pan-right', crane: 'crane-up', default: 'auto' };
const MOOD_ALIASES = { excited: 'happy', joyful: 'happy', smiling: 'happy', glad: 'happy', cheerful: 'happy', proud: 'happy', curious: 'surprised', shocked: 'surprised', amazed: 'surprised', wow: 'surprised',
  scared: 'worried', afraid: 'worried', nervous: 'worried', confused: 'worried', crying: 'sad', upset: 'sad', unhappy: 'sad', lonely: 'sad', mad: 'angry', furious: 'angry', tired: 'sleepy', sleeping: 'sleepy', asleep: 'sleepy', neutral: 'happy', calm: 'happy' };
const POSITION_ALIASES = { middle: 'center', centre: 'center', mid: 'center', 'left-side': 'left', 'right-side': 'right', 'far left': 'far-left', 'far right': 'far-right', 'center-left': 'left', 'center-right': 'right' };
const ENTER_ALIASES = { walk: 'walk-in', 'walks-in': 'walk-in', walkin: 'walk-in', appear: 'pop', 'pop-in': 'pop', fly: 'fly-in', 'falls-in': 'fly-in', fall: 'fly-in', 'fade-in': 'fade' };
const key = (v) => String(v ?? '').trim().toLowerCase().replace(/[\s_]+/g, '-');
// Words models invent for poses, moods and props (eval/3d, plan 12 Phase 8). Unknown ones fall back with a
// warning instead of failing the storyboard: a calm default is better than another validation round.
const POSE_GUESS = [[/sleep|nap|lie|lying|curl|rest|kneel|crouch|squat/, 'sit'], [/fly|soar|leap|hop|bounce|swim/, 'jump'], [/run|dash|chase|march|stroll|wander|swim/, 'walk'],
  [/look|gaze|watch|wonder|ponder|listen|read|study|shy|hide/, 'think'], [/clap|celebrat|happy|laugh|victory|hug/, 'cheer'], [/greet|bow|salute/, 'wave'], [/speak|explain|argue|tell|chat|say/, 'talk'], [/show|present|teach/, 'point']];
const MOOD_GUESS = [[/shock|horrif|terrif|stun|aghast/, 'shocked'], [/sweat|panic|stress|overwhelm/, 'sweating'], [/frustrat|irritat|fed-?up/, 'frustrated'], [/cry|sob|weep|tear/, 'crying'], [/grin|laugh|giggl|delight|thrill|ecstat|overjoy/, 'grin'], [/disappoint|deflat|defeat|exhaust|hopeless|drained/, 'deflated'], [/suspici|skeptic|sceptic|sly|wary|distrust/, 'suspicious'],
  [/shy|nervous|anxious|scared|fear|confus|unsure|thought|doubt|tense|puzzl/, 'worried'], [/curious|wonder|amaz|astonish|shock/, 'surprised'], [/tired|drows|sleep|yawn|bored/, 'sleepy'],
  [/cry|tear|lonely|gloom|upset|hurt|sorry/, 'sad'], [/mad|grump|annoy|frustrat|fierce|furious|stern/, 'angry']];
const NEAR_GUESS = [[/space-?ship|rocket|boat|ship|wreck/, 'ship'], [/crater|boulder|stone|rock|cliff|moon-?rock/, 'rock'], [/panel|computer|counter|stall|cart|desk|console|workbench/, 'desk'],
  [/couch|sofa/, 'sofa'], [/chair|seat|bench|log/, 'bench'], [/bonfire|fire|camp/, 'campfire'], [/hut|home|house|cottage|door/, 'house'], [/tree|bush|forest|oak|palm/, 'tree'], [/sign|post/, 'signpost'],
  [/box|treasure|chest|crate/, 'chest'], [/lamp|lantern|light/, 'lamp-floor'], [/plant|flower|pot/, 'plant-pot'], [/tent/, 'tent'], [/table/, 'table'], [/bed/, 'bed'], [/fence|gate/, 'fence'], [/cake/, 'cake'], [/tv|television|screen/, 'tv'], [/shelf|book/, 'bookcase'], [/barrel/, 'barrel']];
const CAMERA_GUESS = [[/two[- ]?shot/, 'two-shot'], [/over[- ]the[- ]shoulder|ots/, 'over-shoulder'], [/track|follow|chase|alongside/, 'follow'], [/push[- ]?in|dolly (in|toward)|zoom in|move in|creep/, 'dolly-in'],
  [/pull[- ]?back|pull[- ]?out|dolly out|zoom out|pullback/, 'dolly-out'], [/orbit|circl|360|around/, 'orbit'], [/crane up|rise|rising|lift/, 'crane-up'], [/crane down|descend/, 'crane-down'],
  [/extreme close|macro/, 'extreme-close'], [/close[- ]?up|close/, 'close'], [/pan left/, 'pan-left'], [/pan|sweep/, 'pan-right'], [/aerial|establish|extreme wide/, 'extreme-wide'], [/wide|long shot|vista/, 'wide'], [/medium|mid/, 'medium']];
const guess = (v, table) => { const k = String(v ?? '').toLowerCase(); const hit = table.find(([re]) => re.test(k)); return hit ? hit[1] : null; };
// A kind that is not built in but has a ready-made 3D design.
const KIND_PRESETS = { monkey: 'monkey', ape: 'monkey', peacock: 'peacock-king', turtle: 'tortoise', tortoise: 'tortoise', crocodile: 'crocodile', croc: 'crocodile', alligator: 'crocodile', dragon: 'dragon',
  ghost: 'ghost', astronaut: 'astronaut', cow: 'cow', goat: 'goat', parrot: 'parrot', snake: 'snake', tiger: 'tiger', frog: 'frog', bee: 'bee', snowman: 'snowman', teddy: 'teddy', 'teddy-bear': 'teddy', alien: 'alien', wizard: 'wizard', magician: 'wizard' };

const aliasOf = (v, list, aliases) => { const k = key(v); return list.includes(k) ? k : aliases[k] || aliases[k.replace(/-/g, ' ')] || null; };
const slugId = (v) => key(v).replace(/[^a-z0-9-]/g, '').replace(/^-+|-+$/g, '');

const FORMAT_ALIASES = {
  '16x9': '16:9', '16/9': '16:9', landscape: '16:9', youtube: '16:9', wide: '16:9', horizontal: '16:9',
  '9x16': '9:16', '9/16': '9:16', portrait: '9:16', vertical: '9:16', reel: '9:16', reels: '9:16', shorts: '9:16', story: '9:16', tiktok: '9:16',
  '1x1': '1:1', '1/1': '1:1', square: '1:1', post: '1:1',
  '4x5': '4:5', '4/5': '4:5', 'portrait-post': '4:5', feed: '4:5',
};
const CAPTION_ALIASES = { word: 'karaoke', words: 'karaoke', highlight: 'karaoke', 'word-by-word': 'pop', big: 'pop', bold: 'pop', reel: 'pop', tiktok: 'pop', subtitle: 'line', subtitles: 'line', sentence: 'line', normal: 'line', classic: 'line', default: 'line' };
const TEMPLATE_ALIASES = {
  'story-scene': 'story', cartoon: 'story', narration: 'story', 'title-card': 'story', 'the-end': 'story', scene: 'story', animation: 'story', storybook: 'story',
  conversation: 'dialogue', talk: 'dialogue', chat: 'dialogue', dialog: 'dialogue', speech: 'dialogue', conversations: 'dialogue',
  'how-to': 'steps', howto: 'steps', process: 'steps', procedure: 'steps', tutorial: 'steps', recipe: 'steps', numbered: 'steps', step: 'steps',
  intro: 'title', hero: 'title', opening: 'title', cover: 'title',
  screenshot: 'feature', demo: 'feature', showcase: 'feature', screen: 'feature',
  list: 'bullets', benefits: 'bullets', features: 'bullets',
  'two-column': 'split', side: 'split', 'image-text': 'split',
  stats: 'stat', numbers: 'stat', metric: 'stat', metrics: 'stat',
  testimonial: 'quote', review: 'quote',
  outro: 'cta', end: 'cta', closing: 'cta', 'call-to-action': 'cta', download: 'cta',
};
const FIELD_ALIASES = {
  type: 'template', layout: 'template',
  title: 'headline', heading: 'headline', text: 'headline', header: 'headline',
  subtitle: 'subline', subheadline: 'subline', description: 'subline', caption: 'subline',
  voiceover: 'narration', vo: 'narration', script: 'narration', voice: 'narration', speech: 'narration',
  label: 'kicker', eyebrow: 'kicker',
  img: 'image', screenshot: 'image', src: 'image', picture: 'image',
  bullets: 'items', points: 'items',
  features: 'chips', pills: 'chips',
  cta: 'button', buttonText: 'button',
};
// Scene fields that mean something else in one template.
const TEMPLATE_FIELD_ALIASES = {
  story: { bg: 'background', scene: 'background', location: 'background', place: 'background', setting: 'background', chars: 'characters', cast: 'characters', people: 'characters', actors: 'characters', title: 'headline', heading: 'headline', caption: 'text', description: 'text', line: 'text', dialogue: 'lines', dialog: 'lines', conversation: 'lines', speech: 'lines', timeOfDay: 'time' },
  dialogue: { bg: 'background', scene: 'background', location: 'background', place: 'background', setting: 'background', chars: 'characters', cast: 'characters', people: 'characters', dialogue: 'lines', dialog: 'lines', conversation: 'lines', speech: 'lines', messages: 'lines', timeOfDay: 'time' },
  steps: { items: 'steps', bullets: 'steps', points: 'steps', list: 'steps', title: 'headline', heading: 'headline' },
};

function normCharacter(c, p, warn) {
  if (typeof c === 'string') return { who: slugId(c) };
  if (!isObj(c)) return c;
  const o = { ...c };
  if (o.who === undefined) for (const k of ['id', 'character', 'name', 'kind', 'speaker']) if (o[k] !== undefined) { o.who = o[k]; delete o[k]; warn(p, `"${k}" used as "who"`); break; }
  if (o.who !== undefined) o.who = slugId(o.who);
  if (o.expression !== undefined && o.mood === undefined) { o.mood = o.expression; delete o.expression; }
  if (o.emotion !== undefined && o.mood === undefined) { o.mood = o.emotion; delete o.emotion; }
  if (o.action !== undefined && o.pose === undefined) { o.pose = o.action; delete o.action; }
  if (o.entrance !== undefined && o.enter === undefined) { o.enter = o.entrance; delete o.entrance; }
  if (o.side !== undefined && o.position === undefined) { o.position = o.side; delete o.side; }
  for (const [f, list, al] of [['pose', POSES, POSE_ALIASES], ['mood', CHARACTER_MOODS, MOOD_ALIASES], ['position', POSITIONS, POSITION_ALIASES], ['enter', ENTRANCES, ENTER_ALIASES], ['size', SIZES, { big: 'large', huge: 'large', tiny: 'small', little: 'small', normal: 'medium' }]]) {
    if (typeof o[f] === 'string') { const v = aliasOf(o[f], list, al); if (v && v !== o[f]) { warn(`${p}.${f}`, `"${o[f]}" changed to "${v}"`); o[f] = v; } }
  }
  if (typeof o.pose === 'string' && !POSES.includes(o.pose)) {
    const v = guess(o.pose, POSE_GUESS) || 'idle';
    if (v === 'sit' && /sleep|nap|lie|lying|curl|rest/.test(o.pose) && !o.mood) o.mood = 'sleepy';
    warn(`${p}.pose`, `"${o.pose}" is not a pose; changed to "${v}"`); o.pose = v;
  }
  if (typeof o.mood === 'string' && !CHARACTER_MOODS.includes(o.mood)) { const v = guess(o.mood, MOOD_GUESS) || 'happy'; warn(`${p}.mood`, `"${o.mood}" is not a mood; changed to "${v}"`); o.mood = v; }
  if (typeof o.near === 'string' && !NEAR_PROPS.includes(o.near)) {
    const v = guess(o.near, NEAR_GUESS);
    if (v) { warn(`${p}.near`, `"${o.near}" changed to "${v}"`); o.near = v; } else { warn(`${p}.near`, `"${o.near}" is not a prop; removed (near takes a prop, not a character or place)`); delete o.near; }
  }
  return o;
}

function normLine(l, p, warn) {
  if (typeof l === 'string') {
    const m = l.match(/^\s*([^:]{1,30}):\s*(.+)$/);
    if (m) { warn(p, 'text "Name: words" split into who and text'); return { who: slugId(m[1]), text: m[2].trim() }; }
    return { who: '', text: l };
  }
  if (!isObj(l)) return l;
  const o = { ...l };
  if (o.who === undefined) for (const k of ['speaker', 'character', 'name', 'by', 'from', 'id']) if (o[k] !== undefined) { o.who = o[k]; delete o[k]; break; }
  if (o.text === undefined) for (const k of ['line', 'say', 'says', 'dialogue', 'content', 'message', 'speech']) if (o[k] !== undefined) { o.text = o[k]; delete o[k]; break; }
  if (o.who !== undefined) o.who = slugId(o.who);
  if (typeof o.mood === 'string') { const v = aliasOf(o.mood, CHARACTER_MOODS, MOOD_ALIASES); if (v) o.mood = v; else { const g = guess(o.mood, MOOD_GUESS) || 'happy'; warn(`${p}.mood`, `"${o.mood}" is not a mood; changed to "${g}"`); o.mood = g; } }
  if (typeof o.shot === 'string') { const v = aliasOf(o.shot, LINE_SHOTS, { ...CAMERA_ALIASES, reaction: 'reaction', 'reaction-shot': 'reaction', listener: 'reaction' }); if (v && v !== o.shot) { warn(`${p}.shot`, `"${o.shot}" changed to "${v}"`); o.shot = v; } }
  return o;
}

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);

export function loadStoryboard(file) {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw);
  } catch (e) {
    // Tolerate // comments and trailing commas, which small models often write.
    const cleaned = raw.replace(/^\s*\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(cleaned);
  }
}

export function normalise(input, warnings) {
  const sb = isObj(input) ? structuredClone(input) : {};
  const warn = (p, m) => warnings.push({ path: p, message: m });

  if (Array.isArray(input)) { warn('', 'top level was a list; treated as scenes'); return normalise({ scenes: input }, warnings); }

  if (typeof sb.look === 'string') { const v = aliasOf(sb.look, LOOKS, LOOK_ALIASES); if (v && v !== sb.look) { warn('look', `"${sb.look}" changed to "${v}"`); sb.look = v; } }
  // Stickman art style: "art": { "style" }. A bare string or a style name in "look" also works.
  if (typeof sb.art === 'string') sb.art = { style: sb.art };
  if (typeof sb.look === 'string' && !LOOKS.includes(sb.look) && aliasOf(sb.look, ART_STYLES, STYLE_ALIASES)) { warn('look', `"${sb.look}" is a stickman art style: look "stickman", art.style "${aliasOf(sb.look, ART_STYLES, STYLE_ALIASES)}"`); sb.art = { ...(isObj(sb.art) ? sb.art : {}), style: aliasOf(sb.look, ART_STYLES, STYLE_ALIASES) }; sb.look = 'stickman'; }
  if (isObj(sb.art)) {
    sb.art = { ...sb.art };
    if (typeof sb.art.style === 'string') { const v = aliasOf(sb.art.style, ART_STYLES, STYLE_ALIASES); if (v && v !== sb.art.style) { warn('art.style', `"${sb.art.style}" changed to "${v}"`); sb.art.style = v; } else if (!v) { warn('art.style', `"${sb.art.style}" is not an art style (${ART_STYLES.join(', ')}); line-art used`); sb.art.style = 'line-art'; } }
    if (sb.look === undefined && sb.art.style) { warn('look', 'art.style is set, so look is "stickman"'); sb.look = 'stickman'; }
    if (typeof sb.art.theme === 'string') sb.art.theme = /dark|black|night/i.test(sb.art.theme) ? 'dark' : 'light';
  }
  if (sb.look === 'stickman' && !(isObj(sb.art) && sb.art.style)) sb.art = { ...(isObj(sb.art) ? sb.art : {}), style: 'line-art' };
  if (typeof sb.format === 'string') {
    const f = sb.format.trim().toLowerCase();
    if (!FORMATS.includes(f) && FORMAT_ALIASES[f]) { warn('format', `"${sb.format}" changed to "${FORMAT_ALIASES[f]}"`); sb.format = FORMAT_ALIASES[f]; }
  }
  if (typeof sb.voice === 'string') { sb.voice = sb.voice === 'none' ? { provider: 'none' } : { provider: 'edge', voice: sb.voice }; warn('voice', 'string changed to { provider, voice }'); }
  if (sb.voice === false || sb.voice === null) sb.voice = { provider: 'none' };
  if (typeof sb.music === 'string') { sb.music = { style: sb.music }; warn('music', 'string changed to { style }'); }
  if (sb.music === false || sb.music === null) sb.music = { style: 'none' };

  // Small models often write "field": null or "" for "I have none". Treat as absent.
  const dropEmpty = (o, p) => {
    if (Array.isArray(o)) { o.forEach((v, i) => dropEmpty(v, `${p}[${i}]`)); return; }
    if (!isObj(o)) return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v === null || (typeof v === 'string' && !v.trim() && k !== 'narration')) { delete o[k]; warn(p ? `${p}.${k}` : k, 'empty value removed'); }
      else dropEmpty(v, p ? `${p}.${k}` : k);
    }
  };
  dropEmpty(sb, '');

  if (typeof sb.type === 'string') {
    const t = key(sb.type);
    const v = VIDEO_TYPES.includes(t) ? t : TYPE_ALIASES[t];
    if (v && v !== sb.type) warn('type', `"${sb.type}" changed to "${v}"`);
    if (v) sb.type = v;
  }
  // The platform sets the frame; an explicit "format" still wins.
  if (sb.platform !== undefined) {
    const pl = resolvePlatform(sb.platform);
    if (pl && pl !== sb.platform) { warn('platform', `"${sb.platform}" changed to "${pl}"`); sb.platform = pl; }
  }
  const recipe = TYPE_RECIPES[sb.type];
  if (sb.platform === undefined && recipe?.platform && sb.format === undefined) sb.platform = recipe.platform;
  const plat = PLATFORMS[sb.platform];
  if (plat) {
    if (sb.format === undefined) sb.format = plat.format;
    else if (sb.format !== plat.format) warn('format', `"${sb.format}" kept, but ${plat.label} expects ${plat.format}`);
  }
  // The video type picks the look and sound unless the storyboard sets them.
  if (recipe) {
    if (sb.theme === undefined) sb.theme = recipe.theme;
    if (sb.music === undefined) sb.music = { style: recipe.music };
    else if (isObj(sb.music) && sb.music.style === undefined && sb.music.file === undefined) sb.music.style = recipe.music;
    if (sb.format === undefined && recipe.format) sb.format = recipe.format;
    if (sb.captions === undefined && recipe.captions !== undefined) sb.captions = recipe.captions;
  }
  if (Array.isArray(sb.cast)) {
    sb.cast = sb.cast.map((c, i) => {
      if (typeof c === 'string') c = { kind: c };
      if (!isObj(c)) return c;
      const o = { ...c };
      if (o.kind === undefined) for (const k of ['type', 'animal', 'character', 'species']) if (o[k] !== undefined) { o.kind = o[k]; delete o[k]; break; }
      if (typeof o.kind === 'string') {
        const kk = key(o.kind);
        const v = CHARACTER_KINDS.includes(kk) ? kk : KIND_ALIASES[kk] || CHARACTER_KINDS.find(x => kk.includes(x));
        const pre = !v && KIND_PRESETS[kk] && o.design === undefined ? KIND_PRESETS[kk] : null;
        if (pre) { warn(`cast[${i}].kind`, `"${o.kind}" is not a built-in kind; using "design": "preset:${pre}"`); o.design = `preset:${pre}`; delete o.kind; }
        else if (v && v !== o.kind) warn(`cast[${i}].kind`, `"${o.kind}" changed to "${v}"`);
        if (v && !pre) o.kind = v;
      }
      if (o.design === undefined && typeof o.library === 'string') { o.design = `library:${o.library.replace(/^library:/, '')}`; delete o.library; warn(`cast[${i}].library`, `changed to "design": "${o.design}"`); }
      // A design can be a saved character ("library:<id>"), and implies a kind (used for the voice) when none is given.
      if (typeof o.design === 'string' && o.design.startsWith('library:')) {
        const saved = loadLibraryCharacter(o.design.slice(8));
        if (saved) { o.design = saved.design; if (!o.kind && saved.kind) o.kind = saved.kind; }
      }
      if (typeof o.design === 'string' && o.design.startsWith('preset:')) {
        const pr = presetDesign(o.design.slice(7));
        if (pr) { o.design = pr.design; if (!o.kind) o.kind = pr.kind; if (!o.name) o.name = pr.name; }
      }
      if (isObj(o.design)) {
        const d = o.design;
        for (const [f, vals] of Object.entries({ plan: DESIGN.plan, size: DESIGN.size, build: DESIGN.build, head: DESIGN.head, ears: DESIGN.ears, eyes: DESIGN.eyes, snout: DESIGN.snout, horns: DESIGN.horns, hair: DESIGN.hair, outfit: DESIGN.outfit })) {
          if (typeof d[f] === 'string') { const v = key(d[f]); const hit = vals.includes(v) ? v : vals.find(x => v.includes(x)); if (hit && hit !== d[f]) { warn(`cast[${i}].design.${f}`, `"${d[f]}" changed to "${hit}"`); d[f] = hit; } }
        }
        for (const f of ['extras', 'accessories']) {
          if (typeof d[f] === 'string') d[f] = d[f].split(/[,;]\s*/).filter(Boolean);
          if (Array.isArray(d[f])) d[f] = d[f].filter(x => !/^(none|no|nothing)$/i.test(String(x).trim())).map(x => key(x)).map(x => (DESIGN[f].includes(x) ? x : DESIGN[f].find(y => x.includes(y)) || DESIGN[f].find(y => y.includes('-') && y.split('-').every(w => x.includes(w.slice(0, 4)))) || x));
        }
        if (o.kind === undefined) {
          const by = { biped: d.size === 'kid' || d.size === 'small' ? 'boy' : 'man', animal: 'fox', quadruped: 'dog', bird: 'owl', fish: 'cat', snake: 'fox', blob: 'cloud', robot: 'robot' };
          o.kind = by[d.plan] || 'rabbit';
        }
      }
      if (o.id === undefined) { o.id = slugId(o.name || o.kind || `char${i + 1}`); warn(`cast[${i}].id`, `missing; set to "${o.id}"`); }
      else o.id = slugId(o.id);
      return o;
    });
  }

  for (const [k, v] of Object.entries(DEFAULTS)) {
    if (sb[k] === undefined) sb[k] = structuredClone(v);
    else if (isObj(v) && isObj(sb[k])) sb[k] = { ...v, ...sb[k] };
  }

  // captions: true | false | "pop" | { style, position } -> false or a full object.
  if (sb.captions !== false) {
    let c = sb.captions;
    if (c === true || c === undefined) c = {};
    else if (typeof c === 'string') c = { style: c };
    if (isObj(c)) {
      c = { ...c };
      if (typeof c.style === 'string') { const v = aliasOf(c.style, CAPTION_STYLES, CAPTION_ALIASES); if (v && v !== c.style) { warn('captions.style', `"${c.style}" changed to "${v}"`); c.style = v; } }
      if (typeof c.position === 'string') { const v = aliasOf(c.position, CAPTION_POSITIONS, { center: 'middle', centre: 'middle', mid: 'middle', down: 'bottom', up: 'top' }); if (v) c.position = v; }
      if (c.timing !== undefined) {
        const v = aliasOf(String(c.timing), CAPTION_TIMINGS, { accurate: 'whisper', listen: 'whisper', heard: 'whisper', asr: 'whisper', voice: 'tts', fast: 'tts', edge: 'tts', default: 'auto' });
        if (v) { if (v !== c.timing) warn('captions.timing', `"${c.timing}" changed to "${v}"`); c.timing = v; }
        else { warn('captions.timing', `"${c.timing}" is not a timing (auto, tts, whisper); auto used`); c.timing = 'auto'; }
      }
      if (c.lines !== undefined && typeof c.lines !== 'boolean') { const b = /^(true|yes|on|1)$/i.test(String(c.lines)); warn('captions.lines', `"${c.lines}" read as ${b}`); c.lines = b; }
      if (c.style === undefined) c.style = plat?.captions?.style || 'line';
      if (c.position === undefined) c.position = 'bottom';
      sb.captions = c;
    }
  }

  if (!Array.isArray(sb.scenes)) return sb;
  sb.scenes = sb.scenes.map((sc, i) => {
    if (!isObj(sc)) return sc;
    const s = {};
    // Find the template first: which field names are valid depends on it.
    const rawT = sc.template ?? sc.type ?? sc.layout;
    const tKey = typeof rawT === 'string' ? key(rawT) : undefined;
    const tName = tKey && (TEMPLATES[tKey] ? tKey : TEMPLATE_ALIASES[tKey]);
    const tFields = tName ? TEMPLATES[tName].fields : null;
    for (const [k, v] of Object.entries(sc)) {
      const known = k in COMMON_FIELDS || (tFields ? k in tFields : Object.values(TEMPLATES).some(t => k in t.fields));
      const alias = (tName && TEMPLATE_FIELD_ALIASES[tName]?.[k]) || FIELD_ALIASES[k];
      if (!known && alias && sc[alias] === undefined && s[alias] === undefined) { s[alias] = v; warn(`scenes[${i}].${k}`, `renamed to "${alias}"`); }
      else s[k] = v;
    }
    if (typeof s.template === 'string') {
      const t = s.template.trim().toLowerCase();
      if (!TEMPLATES[t] && TEMPLATE_ALIASES[t]) { warn(`scenes[${i}].template`, `"${s.template}" changed to "${TEMPLATE_ALIASES[t]}"`); s.template = TEMPLATE_ALIASES[t]; }
      else s.template = t;
    }
    if (s.template === undefined) {
      const guess = i === 0 ? 'title' : i === input.scenes.length - 1 ? 'cta' : s.image ? 'feature' : s.items ? 'bullets' : 'title';
      s.template = guess; warn(`scenes[${i}].template`, `missing; guessed "${guess}"`);
    }
    for (const key of ['chips', 'items', 'badges']) {
      if (typeof s[key] === 'string') { s[key] = s[key].split(/[,;|•]/).map(x => x.trim()).filter(Boolean); warn(`scenes[${i}].${key}`, 'comma text changed to a list'); }
    }
    if (s.template === 'stat' && Array.isArray(s.items)) {
      s.items = s.items.map(it => typeof it === 'string' ? (() => { const m = it.match(/^(\S+)\s+(.*)$/); return m ? { value: m[1], label: m[2] } : { value: it, label: '' }; })() : it);
    }
    if (s.template === 'story' || s.template === 'dialogue') {
      if (Array.isArray(s.characters)) s.characters = s.characters.map((c, j) => normCharacter(c, `scenes[${i}].characters[${j}]`, warn));
      if (Array.isArray(s.lines)) s.lines = s.lines.map((l, j) => normLine(l, `scenes[${i}].lines[${j}]`, warn));
      if (Array.isArray(s.props)) s.props = s.props.flatMap((pr, j) => {
        const o = typeof pr === 'string' ? { icon: pr } : isObj(pr) ? { ...pr } : null;
        if (!o) return [];
        if (o.icon === undefined && typeof (o.name || o.object || o.item) === 'string') o.icon = o.name || o.object || o.item;
        const ic = resolveIcon(o.icon);
        if (!ic) { warn(`scenes[${i}].props[${j}]`, `no icon for "${o.icon}"; prop left out (try phone, money, clock, bell, heart, lightbulb, chart, trophy…)`); return []; }
        if (ic !== o.icon) o.icon = ic;
        if (typeof o.position === 'string') { const v = aliasOf(o.position, POSITIONS, POSITION_ALIASES); if (v) o.position = v; }
        if (typeof o.enter === 'string') { const v = aliasOf(o.enter, ['pop', 'drop', 'slide', 'draw', 'wobble', 'none'], { fall: 'drop', falls: 'drop', 'drop-in': 'drop', appear: 'pop', 'pop-in': 'pop', 'slide-in': 'slide', sketch: 'draw', 'draw-on': 'draw', shake: 'wobble' }); o.enter = v || 'pop'; }
        if (typeof o.y === 'string' && !['ground', 'air'].includes(o.y)) o.y = /air|float|sky|up|top/.test(o.y) ? 'air' : 'ground';
        return [o];
      });
      if (typeof s.background === 'string') { const v = aliasOf(s.background, BACKGROUNDS, BACKGROUND_ALIASES) || BACKGROUNDS.find(b => key(s.background).includes(b)); if (v && v !== s.background) { warn(`scenes[${i}].background`, `"${s.background}" changed to "${v}"`); s.background = v; } }
      if (typeof s.look === 'string') { const v = aliasOf(s.look, LOOKS, LOOK_ALIASES); if (v && v !== s.look) { warn(`scenes[${i}].look`, `"${s.look}" changed to "${v}"`); s.look = v; } }
      if (typeof s.weather === 'string' && !WEATHER.includes(s.weather.toLowerCase())) {
        const w = s.weather.toLowerCase(), v = /bubble|glitter|star|magic|twinkl|diya|lights/.test(w) ? 'sparkles' : /storm|drizzle|shower/.test(w) ? 'rain' : /firefl|glow/.test(w) ? 'fireflies' : /autumn|fall/.test(w) ? 'leaves' : /winter|frost/.test(w) ? 'snow' : 'none';
        warn(`scenes[${i}].weather`, `"${s.weather}" changed to "${v}"`); s.weather = v;
      }
      if (typeof s.camera === 'string') {
        const v = aliasOf(s.camera, CAMERAS, CAMERA_ALIASES) || (CAMERAS.includes(s.camera) ? s.camera : guess(s.camera, CAMERA_GUESS) || 'auto');
        if (v !== s.camera) { warn(`scenes[${i}].camera`, `"${s.camera.slice(0, 60)}" changed to "${v}"`); s.camera = v; }
      }
      if (typeof s.time === 'string') { const v = aliasOf(s.time, TIMES, TIME_ALIASES); if (v && v !== s.time) { warn(`scenes[${i}].time`, `"${s.time}" changed to "${v}"`); s.time = v; } }
    }
    if (s.template === 'steps' && typeof s.steps === 'string') { s.steps = s.steps.split(/\n|;|\d+\.\s/).map(x => x.trim()).filter(Boolean); warn(`scenes[${i}].steps`, 'text changed to a list'); }
    if (typeof s.duration === 'string') s.duration = parseFloat(s.duration);
    if (s.mascot === null || s.mascot === false) s.mascot = 'none';
    return s;
  });
  // A story scene without a place keeps the previous scene's background and time of day.
  let lastBg = null, lastTime = null;
  sb.scenes.forEach((s, i) => {
    if (!isObj(s) || (s.template !== 'story' && s.template !== 'dialogue')) return;
    if (s.background === undefined && lastBg) { s.background = lastBg; if (s.time === undefined && lastTime) s.time = lastTime; warn(`scenes[${i}].background`, `not set; kept "${lastBg}" from the previous scene`); }
    lastBg = s.background || lastBg;
    lastTime = s.time || lastTime;
  });
  return sb;
}

function checkField(spec, value, p, errors, warnings, ctx) {
  const err = (message, fix) => errors.push({ path: p, message, fix });
  switch (spec.type) {
    case 'str':
      if (typeof value !== 'string') return err(`must be text`, `write it as a string in quotes`);
      if (spec.required && !value.trim()) return err('is empty', 'write some text');
      if (spec.max && value.length > spec.max) return err(`is ${value.length} characters, limit is ${spec.max}`, `shorten to at most ${spec.soft || spec.max} characters`);
      if (spec.soft && value.length > spec.soft) warnings.push({ path: p, message: `${value.length} characters; under ${spec.soft} reads better` });
      return;
    case 'num':
      if (typeof value !== 'number' || Number.isNaN(value)) return err('must be a number', `use a number like ${spec.min}`);
      if (value < spec.min || value > spec.max) {
        if (spec.max === 1 && value > 1) return err(`is ${value}; coordinates are fractions 0-1, not pixels`, `divide by the image width/height, e.g. ${Math.min(0.99, +(value / 1000).toFixed(2))}`);
        return err(`is ${value}, must be between ${spec.min} and ${spec.max}`, `use a value from ${spec.min} to ${spec.max}`);
      }
      return;
    case 'bool':
      if (typeof value !== 'boolean') return err('must be true or false', 'use true or false without quotes');
      return;
    case 'enum':
      if (!spec.values.includes(value)) return err(`"${value}" is not allowed`, `use one of: ${spec.values.join(', ')}`);
      return;
    case 'color':
      if (typeof value !== 'string' || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) return err('must be a hex colour', 'use a value like #ff9a3c');
      return;
    case 'path': {
      if (typeof value !== 'string' || !value.trim()) return err('must be a file path', spec.required ? 'use a path relative to the storyboard, e.g. shots/app.png' : 'if you have no file, remove this field');
      if (/^https?:\/\//.test(value)) return err('web URLs are not supported', 'capture or download the image first, then use the local file path');
      const abs = path.resolve(ctx.baseDir, value);
      if (!fs.existsSync(abs)) return err(`file not found: ${value}`, `check the path; files are looked up relative to ${ctx.baseDir}`);
      return;
    }
    case 'list': {
      if (!Array.isArray(value)) return err('must be a list', 'use [ ... ]');
      if (spec.min && value.length < spec.min) return err(`has ${value.length} items, needs at least ${spec.min}`, `add items`);
      if (spec.max && value.length > spec.max) return err(`has ${value.length} items, limit is ${spec.max}`, `keep only the ${spec.max} most important`);
      if (spec.of) value.forEach((v, i) => checkField(spec.of, v, `${p}[${i}]`, errors, warnings, ctx));
      return;
    }
    case 'obj': {
      if (!isObj(value)) return err('must be an object', 'use { ... }');
      for (const [k, fs2] of Object.entries(spec.fields)) {
        if (value[k] === undefined) { if (fs2.required) err(`missing "${k}"`, `add "${k}"`); continue; }
        checkField(fs2, value[k], `${p}.${k}`, errors, warnings, ctx);
      }
      for (const k of Object.keys(value)) if (!(k in spec.fields)) warnings.push({ path: `${p}.${k}`, message: `unknown field "${k}" ignored` });
      return;
    }
  }
}

/** limits: { scenes, cast } raise the list limits (films have many shots and characters). */
export function validate(input, { baseDir = process.cwd(), limits = {} } = {}) {
  const errors = [], warnings = [];
  const sb = normalise(input, warnings);
  const ctx = { baseDir };

  for (const [k, spec] of Object.entries(TOP_FIELDS)) {
    if (sb[k] === undefined) { if (spec.required) errors.push({ path: k, message: `missing "${k}"`, fix: `add "${k}": [ ... ] with 2-16 scenes` }); continue; }
    if (k === 'scenes') continue;
    if (k === 'captions' && sb[k] === false) continue;
    if (k === 'platform' && !PLATFORM_IDS.includes(sb[k])) { errors.push({ path: 'platform', message: `unknown platform "${sb[k]}"`, fix: `use one of: ${PLATFORM_IDS.join(', ')}` }); continue; }
    checkField(k === 'cast' && limits.cast ? { ...spec, max: limits.cast } : spec, sb[k], k, errors, warnings, ctx);
  }
  for (const k of Object.keys(sb)) if (!(k in TOP_FIELDS)) warnings.push({ path: k, message: `unknown field "${k}" ignored` });
  // A design given as text that did not resolve: say which names exist (instead of "must be an object").
  (Array.isArray(sb.cast) ? sb.cast : []).forEach((c, i) => {
    if (!isObj(c) || typeof c.design !== 'string') return;
    const at = errors.findIndex(e => e.path === `cast[${i}].design`);
    const e = c.design.startsWith('library:')
      ? { path: `cast[${i}].design`, message: `no saved character "${c.design.slice(8)}"`, fix: `use one from video_character action list, a preset (preset:${Object.keys(PRESETS).join(', preset:')}) or a design object` }
      : { path: `cast[${i}].design`, message: `unknown design "${c.design}"`, fix: `use preset:<id> with one of: ${Object.keys(PRESETS).join(', ')}; or a design object { "plan": ... }` };
    if (at >= 0) errors[at] = e; else errors.push(e);
    const k = errors.findIndex(x => x.path === `cast[${i}]` && /missing "kind"/.test(x.message));
    if (k >= 0) errors.splice(k, 1);
  });

  if (Array.isArray(sb.scenes)) {
    checkField({ type: 'list', min: limits.minScenes ?? 2, max: limits.scenes || TOP_FIELDS.scenes.max }, sb.scenes, 'scenes', errors, warnings, ctx);
    sb.scenes.forEach((s, i) => {
      const p = `scenes[${i}]`;
      if (!isObj(s)) { errors.push({ path: p, message: 'must be an object', fix: 'use { "template": "...", ... }' }); return; }
      const tpl = TEMPLATES[s.template];
      if (!tpl) { errors.push({ path: `${p}.template`, message: `unknown template "${s.template}"`, fix: `use one of: ${Object.keys(TEMPLATES).join(', ')}` }); return; }
      const fields = { ...COMMON_FIELDS, ...tpl.fields };
      for (const [k, spec] of Object.entries(fields)) {
        if (s[k] === undefined) { if (spec.required) errors.push({ path: `${p}.${k}`, message: `template "${s.template}" needs "${k}"`, fix: `add "${k}"${spec.doc ? ` (${spec.doc})` : ''}` }); continue; }
        if (k === 'mascot' && s[k] === 'none') continue;
        checkField(spec, s[k], `${p}.${k}`, errors, warnings, ctx);
      }
      for (const k of Object.keys(s)) if (!(k in fields)) warnings.push({ path: `${p}.${k}`, message: `field "${k}" is not used by template "${s.template}"; ignored` });
      if (Array.isArray(s.highlights)) s.highlights.forEach((h, j) => {
        if (isObj(h) && h.x <= 1 && h.w <= 1 && h.x + h.w > 1.001) errors.push({ path: `${p}.highlights[${j}]`, message: 'box goes past the right edge (x + w > 1)', fix: `make w at most ${(1 - h.x).toFixed(2)}` });
        if (isObj(h) && h.y <= 1 && h.h <= 1 && h.y + h.h > 1.001) errors.push({ path: `${p}.highlights[${j}]`, message: 'box goes past the bottom edge (y + h > 1)', fix: `make h at most ${(1 - h.y).toFixed(2)}` });
      });
    });
    const recipe = TYPE_RECIPES[sb.type] || TYPE_RECIPES.ad;
    const typeName = sb.type || 'ad';
    if (sb.scenes.length >= 2) {
      if (!recipe.first.includes(sb.scenes[0]?.template)) warnings.push({ path: 'scenes[0]', message: `a ${typeName} video usually starts with: ${recipe.first.join(' or ')}` });
      if (!recipe.last.includes(sb.scenes.at(-1)?.template)) warnings.push({ path: `scenes[${sb.scenes.length - 1}]`, message: `a ${typeName} video usually ends with: ${recipe.last.join(' or ')}` });
    }
    sb.scenes.forEach((s, i) => { if (isObj(s) && TEMPLATES[s.template] && !recipe.templates.includes(s.template)) warnings.push({ path: `scenes[${i}].template`, message: `"${s.template}" does not fit a ${typeName} video; good templates: ${recipe.templates.join(', ')}` }); });

    // Every character a scene uses must be in the cast (or be a plain character kind).
    const castIds = new Set((Array.isArray(sb.cast) ? sb.cast : []).filter(isObj).flatMap(c => [c.id, c.name && slugId(c.name)]).filter(Boolean));
    const knownWho = (w) => castIds.has(w) || CHARACTER_KINDS.includes(w) || CHARACTER_KINDS.includes(KIND_ALIASES[w]);
    const whoFix = () => castIds.size ? `use a cast id (${[...castIds].join(', ')}) or add this character to "cast"` : 'add it to "cast" ({ "id", "kind", "name" }) or use a kind such as rabbit, boy, owl, star';
    sb.scenes.forEach((s, i) => {
      if (!isObj(s) || (s.template !== 'story' && s.template !== 'dialogue')) return;
      (Array.isArray(s.characters) ? s.characters : []).forEach((c, j) => { if (isObj(c) && c.who && !knownWho(c.who)) errors.push({ path: `scenes[${i}].characters[${j}].who`, message: `unknown character "${c.who}"`, fix: whoFix() }); });
      (Array.isArray(s.lines) ? s.lines : []).forEach((l, j) => {
        if (isObj(l) && !l.who) errors.push({ path: `scenes[${i}].lines[${j}].who`, message: 'line has no speaker', fix: 'set "who" to the cast id of the speaker' });
        else if (isObj(l) && !knownWho(l.who)) errors.push({ path: `scenes[${i}].lines[${j}].who`, message: `unknown speaker "${l.who}"`, fix: whoFix() });
      });
      const n = new Set([...(s.characters || []).map(c => c?.who), ...(s.lines || []).map(l => l?.who)].filter(Boolean)).size;
      if (n > 4) errors.push({ path: `scenes[${i}]`, message: `${n} characters in one scene, limit is 4`, fix: 'split the scene in two' });
      if (s.text && Array.isArray(s.lines) && s.lines.length) warnings.push({ path: `scenes[${i}]`, message: 'a scene with both "text" and "lines" can get crowded; prefer one of them' });
    });
    const plat = PLATFORMS[sb.platform];
    if (plat && (plat.maxSec || plat.warnSec)) {
      const words = sb.scenes.reduce((n, s) => n + (isObj(s) ? String(s.narration || '').split(/\s+/).filter(Boolean).length + (Array.isArray(s.lines) ? s.lines.reduce((m, l) => m + String(l?.text || '').split(/\s+/).filter(Boolean).length, 0) : 0) : 0), 0);
      const est = Math.round(words / 2.5 + sb.scenes.length * 1.2);
      if (plat.maxSec && est > plat.maxSec) errors.push({ path: 'scenes', message: `about ${est} s of speech; ${plat.label} allows at most ${plat.maxSec} s`, fix: `cut scenes or shorten narration to stay under ${plat.maxSec} s` });
      else if (plat.warnSec && est > plat.warnSec) warnings.push({ path: 'scenes', message: `about ${est} s long; ${plat.label} works best under ${plat.warnSec} s` });
    }
    const voiced = sb.voice?.provider !== 'none';
    if (voiced && !sb.scenes.some(s => isObj(s) && (s.narration || (Array.isArray(s.lines) && s.lines.length)))) warnings.push({ path: 'scenes', message: 'no scene has narration, so there will be no voice' });
  }
  return { ok: errors.length === 0, errors, warnings, storyboard: sb };
}

export function validateFile(file) {
  let data;
  try { data = loadStoryboard(file); }
  catch (e) { return { ok: false, errors: [{ path: '', message: `not valid JSON: ${e.message}`, fix: 'check commas, quotes and brackets; no comments' }], warnings: [] }; }
  return validate(data, { baseDir: path.dirname(path.resolve(file)) });
}
