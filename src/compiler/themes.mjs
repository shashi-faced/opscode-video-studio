// Theme presets: colour tokens + font roles. Templates only use these tokens.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Fonts ship inside the package (fonts/, SIL OFL) so renders work offline.
const FONT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../fonts');

export const THEME_PRESETS = {
  'night-saffron': { dark: true, bg: '#0f1230', bg2: '#1a1f4d', bg3: '#2c3176', ink: '#f6f1e7', muted: '#b3b2d4', accent: '#ff9a3c', accent2: '#6672ff', ok: '#2fbf8a', alert: '#ff5d5d', onAccent: '#241200', display: 'Rozha One', stars: true },
  'clean-light':   { dark: false, bg: '#f6f7fb', bg2: '#e7eaf6', bg3: '#d9def3', ink: '#151833', muted: '#555b7a', accent: '#4f5bff', accent2: '#ff7a45', ok: '#138a5e', alert: '#d33a3a', onAccent: '#ffffff', display: 'Poppins', stars: false },
  'midnight-neon': { dark: true, bg: '#080a15', bg2: '#121833', bg3: '#1d2a5c', ink: '#eaf2ff', muted: '#8fa0c8', accent: '#3ee6c4', accent2: '#8a6cff', ok: '#3ee6c4', alert: '#ff5f8a', onAccent: '#04221c', display: 'Poppins', stars: true },
  'corporate-blue':{ dark: true, bg: '#0b2545', bg2: '#13315c', bg3: '#1d4a85', ink: '#f1f5fb', muted: '#a9bad3', accent: '#ffd166', accent2: '#5fb3ff', ok: '#4cd4a0', alert: '#ff6b6b', onAccent: '#2a1f00', display: 'Poppins', stars: false },
  'warm-paper':    { dark: false, bg: '#f5efe3', bg2: '#ebdfc9', bg3: '#dccba9', ink: '#2b2118', muted: '#6e5f4e', accent: '#c4532c', accent2: '#2f6f62', ok: '#2f7d4f', alert: '#b3261e', onAccent: '#ffffff', display: 'Rozha One', stars: false },
};

export function resolveTheme(name, accent) {
  const t = { ...(THEME_PRESETS[name] || THEME_PRESETS['night-saffron']) };
  if (accent) t.accent = accent;
  return t;
}

const FONT_FILES = [
  ['Rozha One', 400, '@fontsource/rozha-one/files/rozha-one-latin-400-normal.woff2'],
  ['Rozha One', 400, '@fontsource/rozha-one/files/rozha-one-devanagari-400-normal.woff2', 'U+0900-097F'],
  ['Poppins', 600, '@fontsource/poppins/files/poppins-latin-600-normal.woff2'],
  ['Poppins', 700, '@fontsource/poppins/files/poppins-latin-700-normal.woff2'],
  ['Hind', 400, '@fontsource/hind/files/hind-latin-400-normal.woff2'],
  ['Hind', 600, '@fontsource/hind/files/hind-latin-600-normal.woff2'],
  ['Hind', 700, '@fontsource/hind/files/hind-latin-700-normal.woff2'],
  ['Hind', 400, '@fontsource/hind/files/hind-devanagari-400-normal.woff2', 'U+0900-097F'],
  ['Hind', 600, '@fontsource/hind/files/hind-devanagari-600-normal.woff2', 'U+0900-097F'],
  ['JetBrains Mono', 400, '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2'],
  ['JetBrains Mono', 600, '@fontsource/jetbrains-mono/files/jetbrains-mono-latin-600-normal.woff2'],
];

// Returns [{ family, weight, src(abs path), name(file name), range }]
export function fontFiles() {
  return FONT_FILES.map(([family, weight, spec, range]) => {
    const src = path.join(FONT_DIR, path.basename(spec));
    if (!fs.existsSync(src)) return null;
    return { family, weight, src, name: path.basename(src), range };
  }).filter(Boolean);
}

export function themeCss(t) {
  return `:root{--bg:${t.bg};--bg2:${t.bg2};--bg3:${t.bg3};--ink:${t.ink};--muted:${t.muted};--accent:${t.accent};--accent2:${t.accent2};--ok:${t.ok};--alert:${t.alert};--on-accent:${t.onAccent};
--card-edge:${t.dark ? '#ffffff2e' : '#1518331f'};--chip-bg:${t.dark ? '#ffffff14' : '#15183310'};--shadow:${t.dark ? '#000000bb' : '#1518333a'};
--display:"${t.display}","Hind",Georgia,serif;--body:"Hind","Segoe UI",system-ui,sans-serif;--mono:"JetBrains Mono",ui-monospace,monospace;color-scheme:${t.dark ? 'dark' : 'light'}}`;
}
