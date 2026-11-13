// Whiteboard and chalkboard (plan 18 M3): a hand that draws each block as the voice speaks. The page
// runtime moves it; these are the two hands. The pen tip is at the top-left corner of the drawing.
export const HAND_SVG = {
  marker: `<svg viewBox="0 0 120 150" aria-hidden="true">
<g transform="rotate(-18 10 10)">
<rect x="4" y="2" width="14" height="70" rx="5" fill="#2b2b33"/><rect x="4" y="20" width="14" height="36" rx="3" fill="#d7263d"/>
<path d="M6 0 L16 0 L13 -9 L9 -9 Z" fill="#1b1b1f"/>
</g>
<path d="M30 40 C46 26 70 30 82 44 L112 84 C120 96 116 116 100 128 L74 146 C60 154 40 148 30 134 L14 104 C8 92 12 80 22 76 Z" fill="#f2c9a6" stroke="#c99a76" stroke-width="2.5"/>
<path d="M24 62 C34 56 44 58 50 66 M20 80 C30 74 40 76 46 84" stroke="#c99a76" stroke-width="2.5" fill="none" stroke-linecap="round"/>
<path d="M82 44 C94 40 104 46 104 58" stroke="#c99a76" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`,
  chalk: `<svg viewBox="0 0 120 150" aria-hidden="true">
<g transform="rotate(-18 10 10)"><rect x="5" y="-4" width="11" height="40" rx="3" fill="#f6f3ea"/><rect x="5" y="-4" width="11" height="6" rx="2" fill="#ffffff"/></g>
<path d="M28 34 C44 22 68 26 80 40 L110 80 C118 92 114 112 98 124 L72 142 C58 150 38 144 28 130 L12 100 C6 88 10 76 20 72 Z" fill="#e8c09c" stroke="#b98a64" stroke-width="2.5"/>
<path d="M22 58 C32 52 42 54 48 62 M18 76 C28 70 38 72 44 80" stroke="#b98a64" stroke-width="2.5" fill="none" stroke-linecap="round"/>
</svg>`,
};
