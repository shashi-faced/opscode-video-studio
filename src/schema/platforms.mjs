// Platforms: where the video will be posted. A platform sets the frame size, the safe zone
// (the area the app's own buttons and text cover), the length limit, the caption style and
// which extra files the render writes (thumbnail, cover, chapters, split parts).
//
// safe: fractions of the frame kept free of text { top, bottom, left, right }.
// rightFrom: the right safe zone only matters below this fraction of the height
//            (Reels/Shorts buttons sit in the lower right column).

export const PLATFORMS = {
  youtube: {
    label: 'YouTube video (16:9)', format: '16:9',
    safe: { top: 0.05, bottom: 0.05, left: 0.04, right: 0.04 },
    warnSec: 600, captions: { style: 'line' }, progress: true,
    extras: ['thumbnail', 'chapters'],
  },
  'youtube-short': {
    label: 'YouTube Short (9:16)', format: '9:16',
    safe: { top: 0.12, bottom: 0.22, left: 0.06, right: 0.12 }, rightFrom: 0.45,
    maxSec: 180, warnSec: 60, captions: { style: 'pop' }, progress: false,
    extras: ['cover'],
  },
  'insta-reel': {
    label: 'Instagram Reel (9:16)', format: '9:16',
    safe: { top: 0.14, bottom: 0.25, left: 0.06, right: 0.14 }, rightFrom: 0.45,
    maxSec: 180, warnSec: 90, captions: { style: 'pop' }, progress: false,
    extras: ['cover', 'cover-grid'],
  },
  'insta-post': {
    label: 'Instagram feed post (4:5)', format: '4:5',
    safe: { top: 0.04, bottom: 0.04, left: 0.04, right: 0.04 },
    maxSec: 60, captions: { style: 'line' }, progress: true,
    extras: ['cover'],
  },
  'insta-story': {
    label: 'Instagram / Facebook story (9:16)', format: '9:16',
    safe: { top: 0.12, bottom: 0.18, left: 0.06, right: 0.06 },
    maxSec: 60, captions: { style: 'pop' }, progress: false,
    extras: ['cover'],
  },
  'whatsapp-status': {
    label: 'WhatsApp status (9:16)', format: '9:16',
    safe: { top: 0.1, bottom: 0.16, left: 0.06, right: 0.06 },
    splitSec: 60, captions: { style: 'pop' }, progress: false,
    extras: ['split'],
  },
  tiktok: {
    label: 'TikTok (9:16)', format: '9:16',
    safe: { top: 0.1, bottom: 0.22, left: 0.06, right: 0.15 }, rightFrom: 0.4,
    maxSec: 600, warnSec: 60, captions: { style: 'pop' }, progress: false,
    extras: ['cover'],
  },
  square: {
    label: 'Square post (1:1)', format: '1:1',
    safe: { top: 0.04, bottom: 0.04, left: 0.04, right: 0.04 },
    captions: { style: 'line' }, progress: true,
    extras: ['cover'],
  },
  linkedin: {
    label: 'LinkedIn / website (16:9)', format: '16:9',
    safe: { top: 0.05, bottom: 0.05, left: 0.04, right: 0.04 },
    warnSec: 600, captions: { style: 'line' }, progress: true,
    extras: ['thumbnail'],
  },
};

export const PLATFORM_IDS = Object.keys(PLATFORMS);

export const PLATFORM_ALIASES = {
  yt: 'youtube', 'youtube-video': 'youtube', 'youtube-long': 'youtube', 'long-video': 'youtube',
  shorts: 'youtube-short', 'youtube-shorts': 'youtube-short', 'yt-short': 'youtube-short', 'yt-shorts': 'youtube-short',
  reel: 'insta-reel', reels: 'insta-reel', instagram: 'insta-reel', insta: 'insta-reel', 'instagram-reel': 'insta-reel', 'instagram-reels': 'insta-reel', 'insta-reels': 'insta-reel', ig: 'insta-reel', 'ig-reel': 'insta-reel', 'facebook-reel': 'insta-reel', 'fb-reel': 'insta-reel',
  'instagram-post': 'insta-post', 'ig-post': 'insta-post', 'feed-post': 'insta-post', 'feed': 'insta-post', 'portrait-post': 'insta-post',
  story: 'insta-story', stories: 'insta-story', 'instagram-story': 'insta-story', 'ig-story': 'insta-story', 'facebook-story': 'insta-story',
  whatsapp: 'whatsapp-status', status: 'whatsapp-status', 'wa-status': 'whatsapp-status',
  'tik-tok': 'tiktok',
  '1:1': 'square', post: 'square', 'facebook-post': 'square',
  'linked-in': 'linkedin', website: 'linkedin', web: 'linkedin', presentation: 'linkedin',
};

/** Platform id from an id or alias ("Insta Reel", "yt shorts"), or null. */
export function resolvePlatform(v) {
  if (typeof v !== 'string') return null;
  const k = v.trim().toLowerCase().replace(/[\s_]+/g, '-');
  return PLATFORMS[k] ? k : PLATFORM_ALIASES[k] || null;
}

/** Safe zone in pixels for a stage of width × height. */
export function safePixels(platformId, width, height) {
  const p = PLATFORMS[platformId];
  const s = p?.safe || { top: 0, bottom: 0, left: 0, right: 0 };
  return {
    top: Math.round(s.top * height), bottom: Math.round(s.bottom * height),
    left: Math.round(s.left * width), right: Math.round(s.right * width),
    rightFrom: Math.round((p?.rightFrom ?? 0) * height),
  };
}
