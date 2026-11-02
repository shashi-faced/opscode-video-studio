// Hand-built SVG characters. Eyes blink (class "eye"), whole figure floats via CSS.
// Each returns an SVG string; uid keeps gradient ids unique per scene.

export function mascotSvg(name, mood = 'happy', uid = 'm') {
  const happy = mood !== 'worried';
  switch (name) {
    case 'robot':
      return `<svg viewBox="0 0 200 220" role="img" aria-label="robot mascot"><defs><linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4fb6ff"/><stop offset="1" stop-color="#7b5cff"/></linearGradient></defs>
<ellipse cx="100" cy="212" rx="50" ry="6" fill="#00000040"/><path d="M100 6v26" stroke="#4fb6ff" stroke-width="6" stroke-linecap="round"/><circle cx="100" cy="8" r="9" fill="var(--accent)"/>
<path d="M100 30l66 38v76l-66 38-66-38V68z" fill="url(#${uid}g)"/><path d="M100 52l46 26v52l-46 26-46-26V78z" fill="#f6f1e7"/>
<g class="eye"><path d="M78 92l-12 14 12 14M122 92l12 14-12 14" stroke="#4b56e8" stroke-width="7" fill="none" stroke-linecap="round" stroke-linejoin="round"/></g>
<path d="${happy ? 'M88 132q12 8 24 0' : 'M88 136q12-8 24 0'}" stroke="#4b56e8" stroke-width="5" fill="none" stroke-linecap="round"/><circle cx="70" cy="128" r="6" fill="#ff9a3c" opacity=".5"/><circle cx="130" cy="128" r="6" fill="#ff9a3c" opacity=".5"/></svg>`;
    case 'dev':
      return `<svg viewBox="0 0 300 300" role="img" aria-label="developer character"><ellipse cx="150" cy="292" rx="120" ry="8" fill="#00000040"/>
<path d="M70 300c0-70 30-110 80-110s80 40 80 110z" fill="#1aa59a"/><path d="M128 192l22 34 22-34" fill="#ff9a3c"/>
<rect x="138" y="160" width="24" height="36" rx="10" fill="#c98b5e"/><circle cx="150" cy="38" r="26" fill="#1b1420"/>
<ellipse cx="150" cy="112" rx="56" ry="62" fill="#1b1420"/><ellipse cx="150" cy="120" rx="44" ry="52" fill="#c98b5e"/>
<path d="M104 104c10-38 82-46 94 0-20-18-70-20-94 0z" fill="#1b1420"/><circle cx="150" cy="96" r="3.4" fill="#d6233c"/>
<ellipse class="eye" cx="133" cy="118" rx="4.5" ry="6" fill="#1b1420"/><ellipse class="eye" cx="167" cy="118" rx="4.5" ry="6" fill="#1b1420"/>
<circle cx="104" cy="128" r="4" fill="#ffcf4a"/><circle cx="196" cy="128" r="4" fill="#ffcf4a"/>
${happy ? '<path d="M134 142q16 16 32 0" stroke="#7a2b2b" stroke-width="4" fill="#fff" stroke-linecap="round"/>'
        : '<path d="M136 150q14-10 28 0" stroke="#7a2b2b" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M124 106l16 4M176 106l-16 4" stroke="#1b1420" stroke-width="3" stroke-linecap="round"/>'}
<g transform="translate(60 214)"><rect width="180" height="70" rx="8" fill="#c9cbe0"/><rect x="8" y="8" width="164" height="54" rx="4" fill="#2a2f6e"/><rect x="20" y="20" width="70" height="5" rx="2" fill="#6672ff"/><rect x="20" y="31" width="110" height="5" rx="2" fill="#ffffff55"/><rect x="20" y="42" width="90" height="5" rx="2" fill="#ff9a3c"/></g></svg>`;
    case 'founder':
      return `<svg viewBox="0 0 300 330" role="img" aria-label="founder character"><ellipse cx="150" cy="322" rx="110" ry="8" fill="#00000040"/>
<path d="M66 330c0-80 34-120 84-120s84 40 84 120z" fill="#3c58c9"/><path d="M128 212l22 30 22-30z" fill="#e8ecff"/>
<rect x="138" y="176" width="24" height="40" rx="10" fill="#a86b45"/><ellipse cx="150" cy="128" rx="48" ry="56" fill="#a86b45"/>
<path d="M100 118c-4-52 30-70 56-68 34 2 50 24 46 66-6-22-18-34-50-34-26 0-44 10-52 36z" fill="#1b1420"/>
<path d="M110 150c6 34 74 34 80 0 0 30-16 46-40 46s-40-16-40-46z" fill="#1b1420" opacity=".85"/>
<g fill="none" stroke="#e8ecff" stroke-width="3.5"><circle cx="131" cy="128" r="13"/><circle cx="169" cy="128" r="13"/><path d="M144 128h12"/></g>
<ellipse class="eye" cx="131" cy="129" rx="4" ry="5" fill="#1b1420"/><ellipse class="eye" cx="169" cy="129" rx="4" ry="5" fill="#1b1420"/>
<path d="${happy ? 'M136 160q14 10 28 0' : 'M136 166q14-8 28 0'}" stroke="#4a1f1f" stroke-width="4" fill="none" stroke-linecap="round"/>
<g transform="translate(196 236) rotate(-12)"><rect width="34" height="58" rx="7" fill="#1b1420"/><rect x="4" y="6" width="26" height="44" rx="3" fill="#6672ff"/></g>
<path d="M200 268c10-6 18-2 22 6" stroke="#a86b45" stroke-width="14" stroke-linecap="round" fill="none"/></svg>`;
    default:
      return '';
  }
}
