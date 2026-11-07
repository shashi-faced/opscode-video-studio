// Ready-made 3D character designs (plan 12, Phase 8). A cast member uses one with "design": "preset:<id>";
// the Opscode app's character gallery offers the same list. Each is an ordinary design (see DESIGN in spec.mjs).
export const PRESETS = {
  'peacock-king': { name: 'Peacock king', icon: '🦚', kind: 'owl', design: { plan: 'bird', extras: ['tail-fan', 'crest'], accessories: ['crown'], colors: { main: '#1e6fd9', accent: '#f2a03a' } } },
  crocodile: { name: 'Crocodile', icon: '🐊', kind: 'dog', design: { plan: 'quadruped', snout: 'long', extras: ['tail-long', 'spikes'], colors: { main: '#3f8f45', belly: '#c9e4a0', accent: '#2b6b35' } } },
  dragon: { name: 'Dragon', icon: '🐉', kind: 'dog', design: { plan: 'quadruped', snout: 'long', horns: 'small', extras: ['bat-wings', 'spikes', 'tail-long'], colors: { main: '#7b2cbf', accent: '#c77dff', belly: '#e0c3fc' } } },
  tortoise: { name: 'Tortoise', icon: '🐢', kind: 'grandpa', design: { plan: 'quadruped', snout: 'button', extras: ['shell', 'tail-short'], colors: { main: '#8ab17d', accent: '#6b4f2a' } } },
  monkey: { name: 'Monkey', icon: '🐒', kind: 'boy', design: { plan: 'animal', ears: 'round', snout: 'muzzle', extras: ['tail-curl'], accessories: ['cap'], outfit: 'vest', colors: { main: '#9b6a3c', belly: '#f3d3a6', outfit: '#2f9e74', accent: '#e63946' } } },
  ghost: { name: 'Friendly ghost', icon: '👻', kind: 'cloud', design: { plan: 'blob', build: 'ghost', eyes: 'big' } },
  astronaut: { name: 'Astronaut girl', icon: '👩‍🚀', kind: 'girl', design: { plan: 'biped', size: 'kid', hair: 'bun', outfit: 'spacesuit', accessories: ['helmet'], colors: { main: '#c68642', hair: '#2b1a12' } } },
  cow: { name: 'Cow', icon: '🐄', kind: 'woman', design: { plan: 'quadruped', snout: 'pig', horns: 'small', ears: 'floppy', extras: ['spots', 'tail-long'], colors: { main: '#f4f1ec', accent: '#222222' } } },
  goat: { name: 'Goat', icon: '🐐', kind: 'grandpa', design: { plan: 'quadruped', snout: 'muzzle', horns: 'ram', hair: 'beard', ears: 'floppy', extras: ['tail-short'], colors: { main: '#d9d4c7', hair: '#bfb8a5' } } },
  parrot: { name: 'Parrot', icon: '🦜', kind: 'girl', design: { plan: 'bird', size: 'small', extras: ['crest', 'tail-long'], colors: { main: '#38b000', accent: '#e63946' } } },
  snake: { name: 'Snake', icon: '🐍', kind: 'man', design: { plan: 'snake', extras: ['stripes'], colors: { main: '#5aa832' } } },
  'elephant-queen': { name: 'Elephant queen', icon: '🐘', kind: 'grandma', design: { plan: 'animal', size: 'big', ears: 'elephant', snout: 'trunk', outfit: 'saree', accessories: ['crown'], colors: { main: '#9aa5b1', outfit: '#c1121f', accent: '#ffd23f' } } },
  tiger: { name: 'Tiger', icon: '🐅', kind: 'lion', design: { plan: 'quadruped', ears: 'round', snout: 'muzzle', extras: ['stripes', 'tail-long', 'whiskers'], colors: { main: '#f28c28', belly: '#fff4e6' } } },
  frog: { name: 'Frog', icon: '🐸', kind: 'boy', design: { plan: 'animal', size: 'small', eyes: 'big', snout: 'none', colors: { main: '#52b788', belly: '#d8f3dc' } } },
  bee: { name: 'Bee', icon: '🐝', kind: 'girl', design: { plan: 'blob', size: 'small', extras: ['wings', 'stripes', 'sting'], horns: 'antenna', colors: { main: '#ffd23f', accent: '#222222' } } },
  snowman: { name: 'Snowman', icon: '⛄', kind: 'man', design: { plan: 'blob', build: 'snowman', accessories: ['hat', 'scarf'] } },
  teddy: { name: 'Teddy bear', icon: '🧸', kind: 'bear', design: { plan: 'animal', ears: 'round', snout: 'muzzle', accessories: ['bow'], colors: { main: '#b5835a' } } },
  alien: { name: 'Alien', icon: '👽', kind: 'robot', design: { plan: 'biped', size: 'kid', head: 'oval', eyes: 'cyclops', horns: 'antenna', outfit: 'suit', colors: { main: '#80ed99', outfit: '#5a189a', accent: '#ff006e' } } },
  wizard: { name: 'Wizard', icon: '🧙', kind: 'grandpa', design: { plan: 'biped', hair: 'beard', outfit: 'robe', accessories: ['wizard-hat', 'wand'], colors: { main: '#e3ab72', hair: '#f1f1f1', outfit: '#3f37c9' } } },
  'robot-chaiwala': { name: 'Robot tea-seller', icon: '🫖', kind: 'robot', design: { plan: 'robot', accessories: ['kettle', 'cap'], colors: { main: '#ff9f1c', accent: '#e63946' } } },
};

/** A preset's design as a fresh copy (callers may change it), or null. */
export function presetDesign(id) {
  const p = PRESETS[String(id || '').trim().toLowerCase().replace(/[\s_]+/g, '-')];
  return p ? { ...p, design: structuredClone(p.design) } : null;
}
