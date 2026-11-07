// 3D look (plan 12, Phase 1): toon characters and worlds built entirely in code with three.js.
// Everything on screen is a pure function of the scene time t (seeded random numbers, no
// requestAnimationFrame, no state carried between frames), so any frame can be rendered alone.
import * as THREE from 'three';
import { OutlineEffect } from 'three/addons/effects/OutlineEffect.js';
// Loaded only when the build uses downloaded character models (the files exist only then).
const MODEL_SPECS = JSON.parse(document.getElementById('world3d').textContent).models || {};
const PROP_SPECS = JSON.parse(document.getElementById('world3d').textContent).props || {};
const HAS_MODELS = Object.keys(MODEL_SPECS).length > 0 || Object.keys(PROP_SPECS).length > 0;
const { GLTFLoader } = HAS_MODELS ? await import('three/addons/loaders/GLTFLoader.js') : {};
const SkeletonUtils = HAS_MODELS ? await import('three/addons/utils/SkeletonUtils.js') : null;

const SPEC = JSON.parse(document.getElementById('world3d').textContent);
const TL = JSON.parse(document.getElementById('timeline').textContent);
const W = SPEC.width, H = SPEC.height, ASPECT = W / H;
const FOV = 32;
const TAN = Math.tan((FOV / 2) * Math.PI / 180);
const BASE_D = 9;                                   // wide-shot camera distance
const VIS_W = 2 * BASE_D * TAN * ASPECT;            // visible width at the stage line
const STAGE_W = Math.max(2.6, VIS_W * 0.84);        // where characters stand (x 0-100 % maps onto this)

// ---------- helpers ----------
const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a, b, k) => a + (b - a) * k;
const easeIO = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);
const easeOut = (k) => 1 - Math.pow(1 - k, 3);
const easeBack = (k) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(k - 1, 3) + c * Math.pow(k - 1, 2); };
const col = (c) => new THREE.Color(c);

// ---------- materials ----------
const ramp = (() => {
  const d = new Uint8Array([90, 170, 255]);
  const t = new THREE.DataTexture(d, 3, 1, THREE.RedFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true;
  return t;
})();
const matCache = new Map();
/** Cel-shaded material with a black outline (outline: false to skip, or a thickness). */
function toon(color, { outline = 0.0045, emissive = null, opacity = 1 } = {}) {
  const k = `${color}|${outline}|${emissive}|${opacity}`;
  if (matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshToonMaterial({ color: col(color), gradientMap: ramp, transparent: opacity < 1, opacity });
  if (emissive) { m.emissive = col(emissive); m.emissiveIntensity = 1; }
  m.userData.outlineParameters = outline ? { thickness: outline, color: [0.07, 0.05, 0.06], alpha: 1 } : { visible: false };
  matCache.set(k, m);
  return m;
}
function flat(color, { opacity = 1 } = {}) {
  const m = new THREE.MeshBasicMaterial({ color: col(color), transparent: opacity < 1, opacity, fog: false });
  m.userData.outlineParameters = { visible: false };
  return m;
}
const G = {
  sphere: new THREE.SphereGeometry(1, 28, 18),
  lowSphere: new THREE.IcosahedronGeometry(1, 1),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cone: new THREE.ConeGeometry(1, 1, 18),
  capsule: new THREE.CapsuleGeometry(0.5, 1, 8, 16),
  hemi: new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.56),
  rock: new THREE.DodecahedronGeometry(1, 0),
};
function mesh(geo, mat, { p = [0, 0, 0], s = [1, 1, 1], r = [0, 0, 0], shadow = false, parent = null } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(...p);
  if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(...s);
  m.rotation.set(...r);
  m.castShadow = shadow;
  if (parent) parent.add(m);
  return m;
}
const group = (parent, p = [0, 0, 0]) => { const g = new THREE.Group(); g.position.set(...p); if (parent) parent.add(g); return g; };
/** A capsule from its top centre hanging down by `len` (limbs). */
const limb = (parent, r, len, mat, x = 0, y = 0, z = 0) => mesh(G.capsule, mat, { p: [x, y - len / 2, z], s: [r * 2, Math.max(0.01, len - r * 2), r * 2], shadow: true, parent });

// ---------- colours ----------
const SKIN = { light: '#f6d2b8', medium: '#e3ab72', tan: '#c68642', dark: '#8d5524' };
const PAL = {
  day: { sky: ['#4fb4ff', '#cdeeff'], hills: ['#9fdc78', '#7cc95c', '#5bb04a'], ground: '#76c656', far: '#bfe3f7', light: '#fff6e0', hemi: 1.45, key: 2.1 },
  sunset: { sky: ['#ff7e5f', '#ffd29b'], hills: ['#b9a35f', '#8f8a4a', '#6c7a3d'], ground: '#7f9a46', far: '#f0b28f', light: '#ffc98a', hemi: 1.2, key: 1.9 },
  night: { sky: ['#0b1a40', '#2e4a88'], hills: ['#35546e', '#2a445c', '#21384c'], ground: '#355c50', far: '#2f4470', light: '#d6defc', hemi: 1.5, key: 1.25 },
};

// ---------- characters ----------
function addFace(head, r, { eyeColor = '#2a1d1a', mood = 'happy', cheeks = true, beak = false, robot = false, eyeScale = 1, eyeY = 0.1 } = {}) {
  const face = { eyes: [], brows: [], mouths: {} };
  const ez = 0.86 * r;
  for (const sx of [-1, 1]) {
    const eg = group(head, [sx * 0.36 * r, eyeY * r, ez]);
    if (robot) {
      mesh(G.sphere, toon('#7ff6ff', { outline: false, emissive: '#3ad7ff' }), { s: [0.17 * r, 0.17 * r, 0.07 * r], parent: eg });
    } else {
      mesh(G.sphere, toon('#ffffff', { outline: 0.0025 }), { s: [0.21 * r * eyeScale, 0.27 * r * eyeScale, 0.1 * r], parent: eg });
      mesh(G.sphere, toon(eyeColor, { outline: false }), { p: [0, -0.02 * r, 0.07 * r], s: [0.12 * r * eyeScale, 0.16 * r * eyeScale, 0.06 * r], parent: eg });
      mesh(G.sphere, flat('#ffffff'), { p: [0.04 * r, 0.04 * r, 0.12 * r], s: 0.035 * r, parent: eg });
    }
    face.eyes.push(eg);
    const bg = group(head, [sx * 0.36 * r, (eyeY + 0.33 * eyeScale) * r, 0.84 * r]);
    mesh(G.box, toon('#3b2a22', { outline: false }), { s: [0.24 * r, 0.05 * r, 0.05 * r], parent: bg });
    bg.userData.side = sx;
    face.brows.push(bg);
    if (cheeks && !robot) mesh(G.sphere, flat('#ff8fa0', { opacity: 0.55 }), { p: [sx * 0.55 * r, -0.16 * r, 0.76 * r], s: [0.12 * r, 0.07 * r, 0.03 * r], parent: head });
  }
  const my = beak ? -0.34 * r : -0.3 * r;
  const mz = 0.9 * r;
  const arc = new THREE.TorusGeometry(0.15 * r, 0.03 * r, 6, 18, Math.PI);
  face.mouths.smile = mesh(arc, toon('#5a1d1d', { outline: false }), { p: [0, my + 0.06 * r, mz], r: [0, 0, Math.PI], parent: head });
  face.mouths.sad = mesh(arc, toon('#5a1d1d', { outline: false }), { p: [0, my - 0.08 * r, mz - 0.02 * r], parent: head });
  face.mouths.open = mesh(G.sphere, toon('#6b1f25', { outline: false }), { p: [0, my, mz], s: [0.13 * r, 0.12 * r, 0.05 * r], parent: head });
  face.mouths.flat = mesh(G.box, toon('#5a1d1d', { outline: false }), { p: [0, my, mz], s: [0.2 * r, 0.035 * r, 0.03 * r], parent: head });
  // Lip-sync mouth: an opening with teeth, tongue and rounded lips, shaped per mouth shape (see SHAPES).
  const talk = group(head, [0, my, mz]);
  face.talk = {
    group: talk, r,
    cavity: mesh(G.sphere, toon('#5e1820', { outline: false }), { parent: talk }),
    teeth: mesh(G.box, toon('#ffffff', { outline: false, emissive: '#6b6b6b' }), { parent: talk }),
    tongue: mesh(G.sphere, toon('#ff7a8a', { outline: false }), { parent: talk }),
    ring: mesh(new THREE.TorusGeometry(1, 0.22, 8, 24), toon('#8a2c34', { outline: false }), { parent: talk }),
  };
  talk.visible = false;
  return face;
}

// ---------- any character from a design (plan 12, Phase 6) ----------
// A design is only choices from fixed lists (plan, parts, outfit, colours); this builds a toon rig the
// pose, face, gaze and camera code already understand (root, rig, hips, torso, head, arms, legs, face…).
const lighter = (c, k = 0.45) => '#' + col(c).lerp(col('#ffffff'), k).getHexString();
const darker = (c, k = 0.35) => '#' + col(c).lerp(col('#000000'), k).getHexString();
const SIZE_SCALE = { small: 0.72, kid: 1, adult: 1.28, big: 1.5 };

function addEars(R, head, r, type, main, inner) {
  R.ears = R.ears || [];
  if (!type || type === 'none') return;
  for (const sx of [-1, 1]) {
    const e = group(head, [sx * r * 0.5, r * 0.8, -0.02]);
    e.userData.side = sx; R.ears.push(e);
    const m = toon(main), mi = toon(inner, { outline: false });
    if (type === 'long') { e.position.x = sx * r * 0.32; mesh(G.capsule, m, { p: [0, 0.24, 0], s: [0.13, 0.36, 0.08], r: [0, 0, -sx * 0.12], parent: e }); mesh(G.capsule, mi, { p: [0, 0.24, 0.04], s: [0.06, 0.28, 0.02], r: [0, 0, -sx * 0.12], parent: e }); }
    else if (type === 'pointy') mesh(G.cone, m, { p: [0, 0.1, 0], s: [0.12, 0.22, 0.08], r: [0, 0, -sx * 0.25], parent: e });
    else if (type === 'floppy') { e.position.set(sx * r * 0.92, r * 0.3, 0); mesh(G.sphere, toon(darker(main, 0.2)), { p: [sx * 0.04, -0.14, 0], s: [0.08, 0.2, 0.06], r: [0, 0, sx * 0.25], parent: e }); }
    else if (type === 'big-round') { e.position.set(sx * r * 0.75, r * 0.7, -0.04); mesh(G.sphere, m, { s: [0.2, 0.2, 0.05], parent: e }); mesh(G.sphere, mi, { p: [0, 0, 0.03], s: [0.14, 0.14, 0.02], parent: e }); }
    else if (type === 'elephant') { e.position.set(sx * r * 0.95, 0.02, -0.05); mesh(G.sphere, m, { s: [0.3, 0.36, 0.05], r: [0, sx * 0.6, 0], parent: e }); }
    else if (type === 'small') { e.position.set(sx * r * 0.98, 0, 0); mesh(G.sphere, m, { s: [0.05, 0.08, 0.05], parent: e }); }
    else mesh(G.sphere, m, { s: [0.1, 0.1, 0.06], parent: e });   // round
  }
}

function addSnout(R, head, r, type, main, accent) {
  const muzzle = lighter(main);
  if (type === 'beak') mesh(G.cone, toon(accent), { p: [0, -0.08 * r, 0.98 * r], r: [Math.PI / 2 + 0.25, 0, 0], s: [0.07 * r * 3, 0.16 * r * 3, 0.07 * r * 3], parent: head });
  else if (type === 'long') {   // crocodile / dragon
    mesh(G.box, toon(main), { p: [0, -0.18 * r, 0.95 * r], s: [0.75 * r, 0.32 * r, 1.1 * r], parent: head });
    for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) mesh(G.cone, toon('#ffffff', { outline: false }), { p: [sx * 0.34 * r, -0.36 * r, (0.55 + k * 0.18) * r], r: [Math.PI, 0, 0], s: [0.035, 0.06, 0.035], parent: head });
    for (const sx of [-1, 1]) mesh(G.sphere, toon('#2b1d1d', { outline: false }), { p: [sx * 0.12 * r, -0.02 * r, 1.48 * r], s: 0.025, parent: head });
  } else if (type === 'trunk') {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.05, r * 0.92), new THREE.Vector3(0, -0.25, r * 1.05), new THREE.Vector3(0, -0.42, r * 1.0), new THREE.Vector3(0, -0.5, r * 1.12)]);
    R.trunk = mesh(new THREE.TubeGeometry(curve, 16, 0.06, 10, false), toon(main), { parent: head });
  } else if (type === 'pig') { mesh(G.cyl, toon('#ffb3c7'), { p: [0, -0.12 * r, 0.95 * r], r: [Math.PI / 2, 0, 0], s: [0.13, 0.08, 0.1], parent: head }); for (const sx of [-1, 1]) mesh(G.sphere, toon('#8a3a4a', { outline: false }), { p: [sx * 0.05, -0.12 * r, 0.95 * r + 0.045], s: 0.02, parent: head }); }
  else if (type === 'muzzle') { mesh(G.sphere, toon(muzzle, { outline: false }), { p: [0, -0.18 * r, 0.82 * r], s: [0.16, 0.11, 0.11], parent: head }); mesh(G.sphere, toon('#2b1d1d', { outline: false }), { p: [0, -0.1 * r, 1.0 * r], s: [0.045, 0.035, 0.03], parent: head }); }
  else if (type === 'button') mesh(G.sphere, toon('#ff8fab', { outline: false }), { p: [0, -0.06 * r, 0.99 * r], s: [0.04, 0.03, 0.03], parent: head });
}

function addHorns(head, r, type, accent) {
  if (!type || type === 'none') return;
  const m = toon(type === 'antenna' ? '#555555' : '#f1e3c8');
  for (const sx of (type === 'unicorn' ? [0] : [-1, 1])) {
    if (type === 'unicorn') mesh(G.cone, toon('#ffd23f'), { p: [0, r * 1.08, r * 0.35], r: [0.35, 0, 0], s: [0.07, 0.36, 0.07], parent: head });
    else if (type === 'ram') { const t = new THREE.TorusGeometry(0.12, 0.045, 8, 16, Math.PI * 1.5); mesh(t, m, { p: [sx * r * 0.78, r * 0.45, -0.02], r: [0, sx * 1.3, 0], parent: head }); }
    else if (type === 'antlers') { const g = group(head, [sx * r * 0.45, r * 0.9, 0]); mesh(G.cyl, toon('#8b5a2b'), { p: [sx * 0.08, 0.15, 0], r: [0, 0, -sx * 0.5], s: [0.025, 0.32, 0.025], parent: g }); for (const k of [0.12, 0.22]) mesh(G.cyl, toon('#8b5a2b'), { p: [sx * (0.1 + k * 0.4), 0.1 + k, 0.05], r: [0.5, 0, -sx * 1.1], s: [0.02, 0.14, 0.02], parent: g }); }
    else if (type === 'antenna') { mesh(G.cyl, m, { p: [sx * r * 0.35, r * 1.1, 0], r: [0, 0, -sx * 0.3], s: [0.015, 0.3, 0.015], parent: head }); mesh(G.sphere, toon(accent, { emissive: accent }), { p: [sx * r * 0.43, r * 1.26, 0], s: 0.05, parent: head }); }
    else mesh(G.cone, m, { p: [sx * r * 0.42, r * 0.95, 0], r: [0, 0, -sx * 0.3], s: [0.06, 0.18, 0.06], parent: head });
  }
}

function addHair(head, r, type, color) {
  if (!type || type === 'none') return;
  const m = toon(color);
  if (type === 'beard') { mesh(G.sphere, m, { p: [0, -0.62 * r, 0.62 * r], s: [0.55 * r, 0.5 * r, 0.35 * r], parent: head }); return; }
  mesh(G.hemi, m, { p: [0, 0.05, -0.04], r: [-0.62, 0, 0], s: r * 1.08, parent: head });
  if (type === 'long') mesh(G.capsule, m, { p: [0, -r * 0.4, -r * 0.45], s: [r * 1.5, r * 1.2, r * 0.6], parent: head });
  if (type === 'bun') mesh(G.sphere, m, { p: [0, r * 0.95, -r * 0.3], s: 0.11, parent: head });
  if (type === 'spiky') for (let k = -2; k <= 2; k++) mesh(G.cone, m, { p: [k * r * 0.22, r * 0.95, -0.02], r: [-0.2, 0, -k * 0.25], s: [0.07, 0.18, 0.07], parent: head });
}

function addAccessories(R, head, r, list, C) {
  const hand = R.arms && R.arms.find(a => a.userData.side < 0);
  const handY = hand ? -(hand.userData.len || 0.4) : 0;
  for (const a of list || []) {
    if (a === 'crown') { const g = group(head, [0, r * 0.95, 0]); mesh(G.cyl, toon('#ffd23f', { emissive: '#5a4300' }), { s: [r * 0.55, 0.1, r * 0.55], parent: g }); for (let k = 0; k < 5; k++) { const ang = (k / 5) * Math.PI * 2; mesh(G.cone, toon('#ffd23f', { emissive: '#5a4300' }), { p: [Math.sin(ang) * r * 0.5, 0.11, Math.cos(ang) * r * 0.5], s: [0.04, 0.1, 0.04], parent: g }); } mesh(G.sphere, toon('#e63946', { outline: false }), { p: [0, 0.03, r * 0.55], s: 0.035, parent: g }); }
    else if (a === 'cap') { const cg = group(head, [0, r * 0.55, -r * 0.05]); cg.rotation.x = -0.25; mesh(G.hemi, toon(C.accent), { s: [r * 0.88, r * 0.62, r * 0.88], parent: cg }); mesh(G.cyl, toon(C.accent), { p: [0, r * 0.02, r * 0.78], s: [r * 0.5, 0.02, r * 0.4], parent: cg }); }
    else if (a === 'hat') { mesh(G.cyl, toon('#2b2d42'), { p: [0, r * 0.95, 0], s: [r * 1.2, 0.03, r * 1.2], parent: head }); mesh(G.cyl, toon('#2b2d42'), { p: [0, r * 1.25, 0], s: [r * 0.62, r * 0.6, r * 0.62], parent: head }); }
    else if (a === 'wizard-hat') { mesh(G.cyl, toon('#3f37c9'), { p: [0, r * 0.88, 0], s: [r * 1.3, 0.03, r * 1.3], parent: head }); mesh(G.cone, toon('#3f37c9'), { p: [0, r * 1.55, -0.04], r: [-0.15, 0, 0], s: [r * 0.75, r * 1.5, r * 0.75], parent: head }); mesh(G.sphere, toon('#ffd23f', { emissive: '#665500' }), { p: [0.08, r * 1.3, r * 0.42], s: 0.04, parent: head }); }
    else if (a === 'helmet') { const m = new THREE.MeshToonMaterial({ color: col('#cfefff'), gradientMap: ramp, transparent: true, opacity: 0.35 }); m.userData.outlineParameters = { thickness: 0.002, color: [0.3, 0.4, 0.5], alpha: 1 }; mesh(G.sphere, m, { s: r * 1.35, parent: head }); }
    else if (a === 'glasses') for (const sx of [-1, 1]) mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 18), toon('#3a3030', { outline: false }), { p: [sx * 0.36 * r, 0.1 * r, r * 0.98], parent: head });
    else if (a === 'bow') for (const sx of [-1, 1]) mesh(G.cone, toon('#ff4d8d'), { p: [sx * 0.09 + r * 0.45, r * 0.85, 0], r: [0, 0, sx * Math.PI / 2], s: [0.06, 0.12, 0.05], parent: head });
    else if (a === 'halo') mesh(new THREE.TorusGeometry(r * 0.6, 0.025, 8, 32), toon('#ffe066', { outline: false, emissive: '#ffd000' }), { p: [0, r * 1.35, 0], r: [Math.PI / 2, 0, 0], parent: head });
    else if (a === 'scarf' && R.torso) mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 20), toon('#e63946'), { p: [0, (R.neckY || 0.55), 0], r: [Math.PI / 2, 0, 0], parent: R.torso });
    else if (a === 'bag' && R.torso) mesh(G.box, toon('#8b5a2b'), { p: [0.28, 0.25, 0.05], s: [0.16, 0.2, 0.08], parent: R.torso });
    else if (hand) {
      const g = group(hand, [0, handY, 0.05]);
      if (a === 'wand') { mesh(G.cyl, toon('#5a3b22'), { p: [0, 0, 0.14], r: [Math.PI / 2, 0, 0], s: [0.015, 0.32, 0.015], parent: g }); mesh(G.sphere, toon('#ffd23f', { emissive: '#ffb000' }), { p: [0, 0, 0.32], s: 0.05, parent: g }); }
      else if (a === 'flute') mesh(G.cyl, toon('#c68642'), { p: [0, 0.05, 0.1], r: [0, 0, Math.PI / 2], s: [0.02, 0.4, 0.02], parent: g });
      else if (a === 'stick') mesh(G.cyl, toon('#8b5a2b'), { p: [0, -0.35, 0.02], s: [0.025, 0.85, 0.025], parent: g });
      else if (a === 'kettle') { mesh(G.sphere, toon('#b0b7c3'), { p: [0, -0.1, 0.05], s: [0.12, 0.1, 0.12], parent: g }); mesh(G.cone, toon('#b0b7c3'), { p: [0, -0.06, 0.2], r: [-1.1, 0, 0], s: [0.03, 0.12, 0.03], parent: g }); }
      else if (a === 'umbrella') { mesh(G.cyl, toon('#333333'), { p: [0, 0.45, 0], s: [0.015, 0.9, 0.015], parent: g }); mesh(G.cone, toon(C.accent), { p: [0, 0.95, 0], s: [0.55, 0.25, 0.55], parent: g }); }
      else if (a === 'book') mesh(G.box, toon('#2a9d8f'), { p: [0, -0.02, 0.08], s: [0.18, 0.24, 0.05], parent: g });
    }
  }
}

function addExtras(R, d, C, body) {
  const ex = new Set(d.extras || []);
  const T = R.torso;
  const tail = (R.tail = R.tail || group(T, body.tail));
  if (ex.has('tail-short')) mesh(G.sphere, toon(C.main), { s: 0.08, parent: tail });
  if (ex.has('tail-long') || ex.has('tail-curl')) {
    const pts = ex.has('tail-curl') ? [[0, 0, 0], [0, 0.05, -0.2], [0, 0.25, -0.3], [0, 0.42, -0.24]] : [[0, 0, 0], [0, -0.05, -0.3], [0, -0.1, -0.6], [0, -0.05, -0.9]];
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(...p)));
    mesh(new THREE.TubeGeometry(curve, 14, ex.has('tail-long') ? 0.07 : 0.04, 8, false), toon(C.main), { parent: tail });
  }
  if (ex.has('tail-fluffy')) mesh(G.sphere, toon(C.main), { p: [0, 0.12, -0.2], s: [0.13, 0.13, 0.3], r: [-0.6, 0, 0], parent: tail });
  if (ex.has('tail-fan')) {   // peacock
    const fan = group(T, [0, body.fanY || 0.45, -0.25]);
    for (let k = 0; k < 13; k++) {
      const a = -1.35 + (k / 12) * 2.7;
      const f = group(fan, [0, 0, 0]); f.rotation.z = a;
      mesh(G.sphere, toon(k % 2 ? '#1f9e6e' : '#2a7de1'), { p: [0, 0.55, -0.05], s: [0.1, 0.55, 0.03], parent: f });
      mesh(G.sphere, toon('#ffd23f', { outline: false }), { p: [0, 0.95, -0.02], s: [0.07, 0.07, 0.02], parent: f });
      mesh(G.sphere, toon('#1d3557', { outline: false }), { p: [0, 0.95, -0.005], s: [0.035, 0.035, 0.015], parent: f });
    }
    R.fan = fan;
  }
  if (ex.has('wings') || ex.has('bat-wings')) {
    R.wings = [];
    for (const sx of [-1, 1]) {
      const w = group(T, [sx * 0.2, body.wingY || 0.5, -0.15]);
      if (ex.has('bat-wings')) { const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(0.7, 0.35); sh.lineTo(0.62, 0.05); sh.lineTo(0.48, 0.12); sh.lineTo(0.38, -0.05); sh.lineTo(0.22, 0.04); sh.lineTo(0, -0.1); const g = new THREE.ShapeGeometry(sh); mesh(g, Object.assign(toon(C.accent), { side: THREE.DoubleSide }), { s: [sx, 1, 1], parent: w }); }
      else mesh(G.sphere, toon('#ffffff'), { p: [sx * 0.28, 0.08, 0], s: [0.3, 0.14, 0.05], r: [0, 0, sx * 0.4], parent: w });
      w.userData.side = sx; R.wings.push(w);
    }
  }
  if (ex.has('mane') && R.head) for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; mesh(G.sphere, toon(C.accent), { p: [Math.cos(a) * R.headR * 0.98, Math.sin(a) * R.headR * 0.98, -0.06], s: 0.12, parent: R.head }); }
  if (ex.has('shell')) { mesh(G.hemi, toon(darker(C.accent, 0.1)), { p: body.shell, s: [0.55, 0.42, 0.62], parent: T }); for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; mesh(G.sphere, toon(C.accent, { outline: false }), { p: [body.shell[0] + Math.cos(a) * 0.28, body.shell[1] + 0.3, body.shell[2] + Math.sin(a) * 0.32], s: [0.1, 0.03, 0.1], parent: T }); } }
  if (ex.has('fins')) for (const sx of [-1, 1]) mesh(G.cone, toon(C.accent), { p: [sx * 0.3, body.finY || 0.3, 0], r: [0, 0, -sx * 1.2], s: [0.12, 0.25, 0.04], parent: T });
  if (ex.has('spikes')) for (let k = 0; k < 6; k++) mesh(G.cone, toon(C.accent), { p: body.spike(k), s: [0.07, 0.16, 0.07], parent: T });
  if (ex.has('crest') && R.head) for (let k = -1; k <= 1; k++) mesh(G.sphere, toon(C.accent), { p: [k * 0.05, R.headR * 1.15, -0.02], s: [0.03, 0.1, 0.03], r: [0, 0, k * 0.3], parent: R.head });
  if (ex.has('whiskers') && R.head) for (const sx of [-1, 1]) for (const dy of [-0.02, 0.03]) mesh(G.cyl, toon('#222222', { outline: false }), { p: [sx * R.headR * 0.55, -R.headR * 0.12 + dy, R.headR * 0.85], r: [0, 0, Math.PI / 2 + sx * dy * 3], s: [0.006, R.headR * 0.8, 0.006], parent: R.head });
  if (ex.has('stripes')) for (let k = 0; k < 5; k++) mesh(G.box, toon(darker(C.main, 0.6), { outline: false }), { p: body.stripe(k), s: body.stripeSize, parent: T });
  if (ex.has('spots')) for (let k = 0; k < 7; k++) mesh(G.sphere, toon(d.colors?.accent ? C.accent : darker(C.main, 0.55), { outline: false }), { p: body.spot(k), s: [0.08, 0.08, 0.03], parent: T });
  if (ex.has('cape')) mesh(G.box, Object.assign(toon('#c1121f'), { side: THREE.DoubleSide }), { p: [0, (R.neckY || 0.5) - 0.3, -0.22], r: [0.12, 0, 0], s: [0.5, 0.7, 0.02], parent: T });
  if (ex.has('sting')) mesh(G.cone, toon('#222222'), { p: [0, 0.2, -0.38], r: [-Math.PI / 2, 0, 0], s: [0.05, 0.14, 0.05], parent: T });
}

function buildDesigned(c) {
  const d = { ...(c.design || {}) };
  const plan = d.plan || 'animal';
  // Sensible defaults: birds get a beak, animals a muzzle.
  if (!d.snout) d.snout = plan === 'bird' ? 'beak' : plan === 'quadruped' || plan === 'animal' ? 'muzzle' : 'none';
  const C = { main: d.colors?.main || { biped: '#e3ab72', animal: '#c58b4f', quadruped: '#c58b4f', bird: '#2a7de1', fish: '#ff8c42', snake: '#5aa832', blob: '#ffffff', robot: '#5aa9ff' }[plan] || '#c58b4f' };
  C.belly = d.colors?.belly || lighter(C.main);
  C.accent = d.colors?.accent || '#ffca3a';
  C.outfit = d.colors?.outfit || '#3d7bf2';
  C.hair = d.colors?.hair || '#2b1a12';
  const R = { root: new THREE.Group(), plan: plan === 'blob' && d.build === 'ghost' || plan === 'fish' ? 'float' : plan === 'quadruped' ? 'quad' : 'designed', kind: c.kind };
  const rig = (R.rig = group(R.root));
  const kid = d.size === 'kid' || d.size === 'small';
  const wide = d.build === 'chunky' ? 1.25 : d.build === 'round' ? 1.15 : d.build === 'slim' ? 0.85 : 1;
  const headScale = { round: [1, 1, 1], oval: [0.92, 1.12, 0.95], wide: [1.18, 0.92, 1], long: [0.9, 1, 1.25] }[d.head || 'round'];
  let body = {};
  const makeHead = (parent, y, r, z = 0) => {
    R.head = group(parent, [0, y, z]); R.headR = r;
    mesh(G.sphere, toon(C.main), { s: [r * headScale[0], r * headScale[1], r * headScale[2]], shadow: true, parent: R.head });
    return R.head;
  };
  const finishHead = (r, opts = {}) => {
    addEars(R, R.head, r, d.ears, C.main, '#ffb3c7');
    addSnout(R, R.head, r, d.snout, C.main, C.accent);
    addHorns(R.head, r, d.horns, C.accent);
    addHair(R.head, r, d.hair, C.hair);
    R.face = addFace(R.head, r, { beak: d.snout === 'beak', eyeScale: d.eyes === 'big' ? 1.3 : d.eyes === 'small' ? 0.75 : 1, eyeY: opts.eyeY ?? 0.15, robot: plan === 'robot' });
    if (d.eyes === 'cyclops' && R.face) { R.face.eyes[0].visible = false; R.face.brows[0].visible = false; R.face.eyes[1].position.x = 0; R.face.eyes[1].scale.setScalar(1.5); R.face.brows[1].position.x = 0; }
  };

  if (plan === 'quadruped') {
    const legLen = d.build === 'chunky' ? 0.26 : d.species && /croc|lizard|turtle|tortoise/i.test(d.species) ? 0.16 : 0.34;
    R.hips = group(rig, [0, legLen, 0]);
    R.torso = group(R.hips);
    mesh(G.capsule, toon(C.main), { p: [0, 0.22, 0], r: [Math.PI / 2, 0, 0], s: [0.46 * wide, 0.62, 0.42 * wide], shadow: true, parent: R.torso });
    mesh(G.sphere, toon(C.belly, { outline: false }), { p: [0, 0.08, 0.05], s: [0.2 * wide, 0.12, 0.42], parent: R.torso });
    R.legs = [[-1, 1, 0], [1, 1, Math.PI], [-1, -1, Math.PI], [1, -1, 0]].map(([sx, sz, ph]) => { const g = group(R.hips, [sx * 0.17 * wide, 0.05, sz * 0.32]); limb(g, 0.075, legLen + 0.05, toon(C.main), 0, 0, 0); mesh(G.sphere, toon(darker(C.main, 0.3)), { p: [0, -legLen + 0.01, 0.03], s: [0.08, 0.05, 0.1], parent: g }); g.userData.phase = ph; return g; });
    R.arms = [];
    const r = 0.27 * (d.build === 'chunky' ? 1.1 : 1);
    makeHead(R.torso, 0.42, r, 0.62);
    finishHead(r);
    R.neckY = 0.4;
    body = { tail: [0, 0.25, -0.55], shell: [0, 0.18, 0], wingY: 0.4, spike: (k) => [0, 0.45 - Math.abs(k - 2.5) * 0.02, 0.35 - k * 0.14], stripe: (k) => [0, 0.23, 0.32 - k * 0.15], stripeSize: [0.47 * wide, 0.44, 0.04], spot: (k) => [((k * 37) % 7 - 3) * 0.06, 0.38, ((k * 53) % 9 - 4) * 0.08], finY: 0.3 };
  } else if (plan === 'fish') {
    R.hips = group(rig, [0, 1.35, 0]); R.torso = group(R.hips);
    mesh(G.sphere, toon(C.main), { s: [0.26, 0.32, 0.5], shadow: true, parent: R.torso });
    mesh(G.sphere, toon(C.belly, { outline: false }), { p: [0, -0.1, 0.08], s: [0.18, 0.18, 0.38], parent: R.torso });
    R.tail = group(R.torso, [0, 0, -0.45]); mesh(G.cone, toon(C.accent), { p: [0, 0, -0.12], r: [-Math.PI / 2, 0, 0], s: [0.05, 0.3, 0.32], parent: R.tail });
    R.tail.children[0].scale.set(0.05, 0.3, 0.32);
    R.head = group(R.torso, [0, 0.04, 0.22]); R.headR = 0.26;
    R.face = addFace(R.head, 0.26, { eyeY: 0.2 });
    R.arms = []; R.legs = [];
    body = { tail: [0, 0, -0.45], finY: 0, spike: (k) => [0, 0.3, 0.3 - k * 0.12], stripe: (k) => [0, 0, 0.3 - k * 0.15], stripeSize: [0.53, 0.66, 0.03], spot: (k) => [((k * 37) % 7 - 3) * 0.05, ((k * 53) % 9 - 4) * 0.05, 0.3], shell: [0, 0, 0] };
    if (!(d.extras || []).includes('fins')) d.extras = [...(d.extras || []), 'fins'];
  } else if (plan === 'snake') {
    R.hips = group(rig, [0, 0, 0]); R.torso = group(R.hips);
    R.segs = [];
    for (let k = 0; k < 9; k++) { const g = group(R.torso, [0, 0.13, 0.3 - k * 0.17]); mesh(G.sphere, toon(k % 2 ? C.main : darker(C.main, 0.12)), { s: [0.15 - k * 0.008, 0.13 - k * 0.006, 0.14], shadow: true, parent: g }); R.segs.push(g); }
    const neck = group(R.torso, [0, 0.35, 0.42]); mesh(G.capsule, toon(C.main), { s: [0.22, 0.3, 0.2], parent: neck });
    R.head = group(R.torso, [0, 0.62, 0.48]); R.headR = 0.2;
    mesh(G.sphere, toon(C.main), { s: [0.2, 0.17, 0.24], shadow: true, parent: R.head });
    R.face = addFace(R.head, 0.2, { eyeY: 0.25, cheeks: false });
    mesh(G.box, toon('#e63946', { outline: false }), { p: [0, -0.06, 0.26], s: [0.02, 0.005, 0.1], parent: R.head });
    R.arms = []; R.legs = [];
    body = { tail: [0, 0.1, -1.2], spike: (k) => [0, 0.27, 0.3 - k * 0.3], stripe: (k) => [0, 0.13, 0.3 - k * 0.34], stripeSize: [0.3, 0.27, 0.03], spot: (k) => [0, 0.25, 0.3 - k * 0.2], shell: [0, 0, 0] };
  } else if (plan === 'blob') {
    R.arms = []; R.legs = [];
    if (d.build === 'snowman') {
      R.hips = group(rig, [0, 0, 0]); R.torso = group(R.hips);
      mesh(G.sphere, toon('#ffffff'), { p: [0, 0.38, 0], s: 0.4, shadow: true, parent: R.torso });
      mesh(G.sphere, toon('#ffffff'), { p: [0, 0.95, 0], s: 0.3, shadow: true, parent: R.torso });
      for (let k = 0; k < 3; k++) mesh(G.sphere, toon('#222222', { outline: false }), { p: [0, 0.85 + k * 0.1, 0.29], s: 0.03, parent: R.torso });
      R.arms = [-1, 1].map(sx => { const g = group(R.torso, [sx * 0.27, 1.0, 0]); mesh(G.cyl, toon('#7a5230'), { p: [sx * 0.2, 0.1, 0], r: [0, 0, sx * 1.0], s: [0.02, 0.45, 0.02], parent: g }); g.userData.side = sx; return g; });
      const r = 0.22; makeHead(R.torso, 1.4, r);
      R.head.children[0].material = toon('#ffffff');
      mesh(G.cone, toon('#ff8c42'), { p: [0, -0.02, r * 1.05], r: [Math.PI / 2, 0, 0], s: [0.04, 0.18, 0.04], parent: R.head });
      finishHead(r, { eyeY: 0.2 });
      R.neckY = 1.2;
    } else if (d.build === 'ghost') {
      R.hips = group(rig, [0, 1.2, 0]); R.torso = group(R.hips);
      mesh(G.sphere, toon(C.main === '#ffffff' ? '#f7f7ff' : C.main), { p: [0, 0.15, 0], s: [0.4, 0.45, 0.38], shadow: true, parent: R.torso });
      const skirt = mesh(new THREE.CylinderGeometry(0.4, 0.46, 0.5, 18, 1, true), Object.assign(toon('#f7f7ff'), { side: THREE.DoubleSide }), { p: [0, -0.2, 0], parent: R.torso });
      R.skirt = skirt;
      R.head = group(R.torso, [0, 0.25, 0.05]); R.headR = 0.35;
      R.face = addFace(R.head, 0.35, { eyeY: 0.05 });
      R.arms = [-1, 1].map(sx => { const g = group(R.torso, [sx * 0.38, 0.05, 0]); mesh(G.sphere, toon('#f7f7ff'), { p: [sx * 0.06, -0.1, 0], s: [0.08, 0.18, 0.08], parent: g }); g.userData.side = sx; return g; });
    } else {
      R.hips = group(rig, [0, 0, 0]); R.torso = group(R.hips);
      mesh(G.sphere, toon(C.main), { p: [0, 0.5, 0], s: [0.5 * wide, 0.5, 0.45 * wide], shadow: true, parent: R.torso });
      R.head = group(R.torso, [0, 0.55, 0.05]); R.headR = 0.42;
      finishHead(0.42, { eyeY: 0.1 });
      R.legs = [-1, 1].map(sx => { const g = group(R.hips, [sx * 0.2, 0.08, 0]); mesh(G.sphere, toon(darker(C.main, 0.2)), { p: [0, -0.04, 0.05], s: [0.12, 0.07, 0.15], parent: g }); return g; });
    }
    body = { tail: [0, 0.3, -0.45], shell: [0, 0.4, -0.05], wingY: 0.6, spike: (k) => [0, 0.9, 0.3 - k * 0.12], stripe: (k) => [0, 0.2 + k * 0.15, 0.36], stripeSize: [0.5, 0.04, 0.2], spot: (k) => [((k * 37) % 7 - 3) * 0.08, 0.3 + ((k * 53) % 5) * 0.1, 0.4], finY: 0.4 };
  } else {
    // biped, animal, bird, robot: upright two-legged bodies.
    const robot = plan === 'robot', bird = plan === 'bird', human = plan === 'biped';
    const legLen = bird ? 0.2 : human ? (kid ? 0.36 : 0.72) : 0.3;
    const torsoH = human ? (kid ? 0.42 : 0.6) : 0.62;
    R.hips = group(rig, [0, legLen, 0]);
    const legMat = toon(bird ? '#f2a03a' : human ? darker(d.outfit === 'none' ? C.main : C.outfit, 0.45) : C.main);
    R.legs = [-1, 1].map(sx => { const g = group(R.hips, [sx * 0.12 * wide, 0, 0]); limb(g, bird ? 0.035 : 0.085, legLen, legMat, 0, 0, 0); mesh(G.sphere, toon(bird ? '#f2a03a' : human ? '#3a2a24' : darker(C.main, 0.25)), { p: [0, -legLen + 0.03, 0.06], s: [0.1, 0.06, 0.15], parent: g }); return g; });
    R.torso = group(R.hips);
    const bodyColor = human && d.outfit !== 'none' ? C.outfit : C.main;
    if (robot) mesh(G.box, toon(C.main), { p: [0, 0.3, 0], s: [0.56 * wide, 0.56, 0.4], shadow: true, parent: R.torso });
    else if (human) mesh(G.capsule, toon(bodyColor), { p: [0, torsoH / 2, 0], s: [0.42 * wide, Math.max(0.05, torsoH - 0.3), 0.32 * wide], shadow: true, parent: R.torso });
    else { mesh(G.sphere, toon(C.main), { p: [0, 0.32, 0], s: [0.34 * wide, 0.4, 0.3 * wide], shadow: true, parent: R.torso }); mesh(G.sphere, toon(C.belly), { p: [0, 0.28, 0.17], s: [0.24 * wide, 0.3, 0.15], parent: R.torso }); }
    // Outfits (person-like bodies and standing animals)
    const o = d.outfit;
    if (o && o !== 'none' && !robot) {
      const oc = toon(C.outfit);
      if (o === 'dress' || o === 'saree') mesh(new THREE.CylinderGeometry(0.62, 1, 1, 18), oc, { p: [0, 0.04, 0], s: [0.3 * wide, 0.36, 0.26 * wide], parent: R.torso });
      if (o === 'saree') mesh(G.box, toon(C.accent), { p: [0.05, torsoH * 0.6, 0.17], r: [0, 0, -0.7], s: [0.08, 0.6, 0.02], parent: R.torso });
      if (o === 'robe' || o === 'kurta') mesh(new THREE.CylinderGeometry(0.75, 1, 1, 18), oc, { p: [0, o === 'robe' ? -legLen * 0.45 : 0.0, 0], s: [0.26 * wide, o === 'robe' ? legLen * 0.95 + 0.2 : 0.3, 0.24 * wide], parent: R.torso });
      if (o === 'vest' || o === 'apron') mesh(G.box, toon(o === 'apron' ? '#ffffff' : C.outfit), { p: [0, torsoH * 0.45, 0.16], s: [0.32 * wide, torsoH * 0.6, 0.04], parent: R.torso });
      if (o === 'suit') { mesh(G.box, toon('#ffffff', { outline: false }), { p: [0, torsoH * 0.6, 0.17], s: [0.08, torsoH * 0.4, 0.02], parent: R.torso }); mesh(G.box, toon('#c1121f', { outline: false }), { p: [0, torsoH * 0.55, 0.185], s: [0.03, torsoH * 0.3, 0.01], parent: R.torso }); }
      if (o === 'armour') { mesh(G.box, toon('#9aa5b1'), { p: [0, torsoH * 0.5, 0.15], s: [0.36 * wide, torsoH * 0.6, 0.06], parent: R.torso }); for (const sx of [-1, 1]) mesh(G.sphere, toon('#9aa5b1'), { p: [sx * 0.24, torsoH - 0.05, 0], s: [0.1, 0.07, 0.1], parent: R.torso }); }
      if (o === 'spacesuit') { mesh(G.capsule, toon('#f1f1f1'), { p: [0, torsoH / 2, 0], s: [0.48 * wide, Math.max(0.05, torsoH - 0.28), 0.38 * wide], parent: R.torso }); mesh(G.box, toon('#3d7bf2', { emissive: '#103070' }), { p: [0, torsoH * 0.55, 0.19], s: [0.14, 0.1, 0.02], parent: R.torso }); mesh(G.box, toon('#d0d0d0'), { p: [0, torsoH * 0.5, -0.2], s: [0.3, 0.36, 0.14], parent: R.torso }); }
    }
    const armColor = human ? (o && o !== 'none' && o !== 'vest' ? (o === 'spacesuit' ? '#f1f1f1' : C.outfit) : C.main) : C.main;
    R.arms = [-1, 1].map(sx => {
      const g = group(R.torso, [sx * (human ? 0.23 * wide + 0.03 : 0.33 * wide), human ? torsoH - 0.08 : 0.48, 0]);
      const len = human ? (kid ? 0.34 : 0.5) : 0.32;
      if (bird) mesh(G.sphere, toon(C.main), { p: [sx * 0.04, -0.2, -0.02], s: [0.09, 0.26, 0.17], parent: g });
      else if (robot) { mesh(G.cyl, toon('#8aa0b8'), { p: [0, -0.2, 0], s: [0.05, 0.4, 0.05], parent: g }); mesh(G.sphere, toon('#4b5d73'), { p: [0, -0.42, 0], s: 0.08, parent: g }); }
      else { limb(g, human ? 0.065 : 0.075, len, toon(armColor), 0, 0, 0); if (human) mesh(G.sphere, toon(C.main), { p: [0, -len - 0.03, 0], s: 0.075, parent: g }); }
      g.userData.side = sx; g.userData.len = len; return g;
    });
    const r = human ? (kid ? 0.27 : 0.23) : robot ? 0.28 : bird ? 0.3 : 0.33;
    const hy = human ? torsoH + r * 0.95 : robot ? 0.58 + 0.26 : bird ? 0.7 : 0.78 + r * 0.6;
    if (robot) { R.head = group(R.torso, [0, hy, 0]); R.headR = r; mesh(G.box, toon(C.main), { s: [0.6, 0.48, 0.46], shadow: true, parent: R.head }); R.face = addFace(R.head, 0.28, { robot: true, cheeks: false, eyeY: 0.15 }); addHorns(R.head, r, d.horns === 'none' || !d.horns ? 'antenna' : d.horns, C.accent); }
    else { makeHead(R.torso, hy, r); finishHead(r, { eyeY: bird ? 0.12 : human ? 0.1 : 0.18 }); }
    if (human) for (const sx of [-1, 1]) mesh(G.sphere, toon(C.main), { p: [sx * r * 0.98, 0, 0], s: [0.06, 0.09, 0.05], parent: R.head });
    R.neckY = human ? torsoH : 0.62;
    body = { tail: [0, 0.2, -0.28], fanY: 0.5, shell: [0, 0.2, -0.12], wingY: human ? torsoH * 0.8 : 0.5, spike: (k) => [0, 0.75 - k * 0.11, -0.3], stripe: (k) => [0, 0.12 + k * 0.11, 0.2], stripeSize: [0.5 * wide, 0.035, 0.32], spot: (k) => [((k * 37) % 7 - 3) * 0.07, 0.15 + ((k * 53) % 5) * 0.09, 0.27], finY: 0.4 };
  }
  addExtras(R, d, C, body);
  addAccessories(R, R.head, R.headR, d.accessories, C);
  rig.scale.setScalar(SIZE_SCALE[d.size || (plan === 'biped' ? 'adult' : 'kid')] || 1);
  R.headTop = new THREE.Object3D();
  R.headTop.position.set(0, R.headR * 1.15 + ((d.accessories || []).some(a => /hat|crown/.test(a)) ? R.headR * 0.5 : 0), 0);
  R.head.add(R.headTop);
  return R;
}

/** Build one character. Returns its rig: groups that the pose functions rotate. */
function buildCharacter(c, kinds) {
  const info = kinds[c.kind] || { plan: 'animal', color: '#f4f1ec', inner: '#ffb3c7', age: 'kid' };
  const kind = c.kind;
  const main = c.color || info.color;
  const R = { root: new THREE.Group(), plan: info.plan, kind };
  const rig = group(R.root);           // bobs and squashes
  R.rig = rig;
  let headR, headY;

  if (info.plan === 'human') {
    const age = info.age;
    const kid = age === 'kid', old = age === 'old';
    const legLen = kid ? 0.36 : 0.74, torsoH = kid ? 0.42 : 0.62, w = kid ? 0.92 : 1;
    headR = kid ? 0.27 : 0.23;
    const skin = SKIN[c.skin] || SKIN.medium;
    const outfit = main, hair = c.hair || info.hair || '#2b1a12';
    const female = info.gender === 'f';
    R.hips = group(rig, [0, legLen, 0]);
    R.legs = [-1, 1].map(sx => { const g = group(R.hips, [sx * 0.1 * w, 0, 0]); limb(g, 0.085, legLen, toon(old ? '#5c5f6e' : '#3d4a7a'), 0, 0, 0); mesh(G.sphere, toon('#3a2a24'), { p: [0, -legLen + 0.02, 0.06], s: [0.1, 0.07, 0.15], shadow: true, parent: g }); return g; });
    R.torso = group(R.hips, [0, 0, 0]);
    mesh(G.capsule, toon(outfit), { p: [0, torsoH / 2, 0], s: [0.42 * w, Math.max(0.05, torsoH - 0.3), 0.32], shadow: true, parent: R.torso });
    if (female) mesh(G.cyl, toon(outfit), { p: [0, 0.06, 0], s: [0.3 * w, 0.34, 0.26], shadow: true, parent: R.torso }).geometry = new THREE.CylinderGeometry(0.62, 1, 1, 18);
    R.arms = [-1, 1].map(sx => { const g = group(R.torso, [sx * (0.23 * w + 0.03), torsoH - 0.08, 0]); limb(g, 0.065, kid ? 0.34 : 0.52, toon(outfit), 0, 0, 0); mesh(G.sphere, toon(skin), { p: [0, kid ? -0.36 : -0.55, 0], s: 0.075, shadow: true, parent: g }); g.userData.side = sx; return g; });
    headY = torsoH + headR * 0.95;
    R.head = group(R.torso, [0, headY, 0]);
    mesh(G.sphere, toon(skin), { s: headR, shadow: true, parent: R.head });
    for (const sx of [-1, 1]) mesh(G.sphere, toon(skin), { p: [sx * headR * 0.98, 0, 0], s: [0.06, 0.09, 0.05], parent: R.head });
    if (kind === 'grandpa') {
      for (const sx of [-1, 1]) mesh(G.sphere, toon(hair), { p: [sx * headR * 0.85, 0.05, -0.05], s: [0.09, 0.11, 0.13], parent: R.head });
      mesh(G.capsule, toon(hair), { p: [0, -0.1, headR * 0.92], r: [0, 0, Math.PI / 2], s: [0.07, 0.12, 0.06], parent: R.head });
    } else {
      // Hair cap tilted back so it frames the face instead of covering the eyes.
      mesh(G.hemi, toon(hair), { p: [0, 0.05, -0.04], r: [-0.62, 0, 0], s: headR * 1.08, parent: R.head });
      if (female) {
        if (kind === 'grandma') mesh(G.sphere, toon(hair), { p: [0, headR * 0.95, -headR * 0.3], s: 0.11, parent: R.head });
        else mesh(G.capsule, toon(hair), { p: [0, -headR * 0.4, -headR * 0.45], s: [headR * 1.5, headR * 1.2, headR * 0.6], parent: R.head });
        if (kid) for (const sx of [-1, 1]) mesh(G.sphere, toon(hair), { p: [sx * headR * 1.05, -0.02, -0.05], s: 0.08, parent: R.head });
      }
    }
    if (old) {
      for (const sx of [-1, 1]) mesh(new THREE.TorusGeometry(0.075, 0.012, 6, 18), toon('#3a3030', { outline: false }), { p: [sx * 0.36 * headR, 0.1 * headR, headR * 0.98], parent: R.head });
      R.stick = mesh(G.cyl, toon('#8b5a2b'), { p: [0, -0.4, 0.05], s: [0.025, 0.85, 0.025], shadow: true, parent: R.arms[1] });
    }
    R.face = addFace(R.head, headR, { mood: c.mood });
  } else if (info.plan === 'robot') {
    const legLen = 0.42;
    headR = 0.26;
    R.hips = group(rig, [0, legLen, 0]);
    R.legs = [-1, 1].map(sx => { const g = group(R.hips, [sx * 0.13, 0, 0]); mesh(G.cyl, toon('#8aa0b8'), { p: [0, -legLen / 2, 0], s: [0.07, legLen, 0.07], shadow: true, parent: g }); mesh(G.box, toon('#4b5d73'), { p: [0, -legLen + 0.04, 0.05], s: [0.16, 0.08, 0.24], shadow: true, parent: g }); return g; });
    R.torso = group(R.hips, [0, 0, 0]);
    mesh(G.box, toon(main), { p: [0, 0.3, 0], s: [0.56, 0.56, 0.4], shadow: true, parent: R.torso });
    mesh(G.box, toon('#ffd23f', { outline: false, emissive: '#7a5c00' }), { p: [0, 0.34, 0.205], s: [0.22, 0.14, 0.02], parent: R.torso });
    R.arms = [-1, 1].map(sx => { const g = group(R.torso, [sx * 0.33, 0.5, 0]); mesh(G.cyl, toon('#8aa0b8'), { p: [0, -0.2, 0], s: [0.05, 0.4, 0.05], shadow: true, parent: g }); mesh(G.sphere, toon('#4b5d73'), { p: [0, -0.42, 0], s: 0.08, shadow: true, parent: g }); g.userData.side = sx; return g; });
    headY = 0.58 + headR;
    R.head = group(R.torso, [0, headY, 0]);
    mesh(G.box, toon(main), { s: [0.6, 0.48, 0.46], shadow: true, parent: R.head });
    mesh(G.cyl, toon('#8aa0b8'), { p: [0, 0.32, 0], s: [0.02, 0.16, 0.02], parent: R.head });
    R.antenna = mesh(G.sphere, toon('#ff5a5a', { outline: false, emissive: '#ff2020' }), { p: [0, 0.42, 0], s: 0.05, parent: R.head });
    R.face = addFace(R.head, 0.28, { robot: true, cheeks: false, eyeY: 0.15 });
  } else if (info.plan === 'float') {
    headR = 0.42;
    R.hips = group(rig, [0, 1.35, 0]);
    R.torso = group(R.hips);
    R.head = group(R.torso);
    headY = 0;
    if (kind === 'star') {
      const shape = new THREE.Shape();
      for (let k = 0; k < 10; k++) { const a = Math.PI / 2 + (k * Math.PI) / 5, rr = k % 2 ? 0.22 : 0.52; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (k) shape.lineTo(x, y); else shape.moveTo(x, y); }
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.16, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 3 });
      geo.center();
      mesh(geo, toon(main, { emissive: '#7a5a00' }), { shadow: true, parent: R.head });
      R.face = addFace(R.head, 0.3, { eyeY: 0.05 });
      R.face.eyes.forEach(e => { e.position.z = 0.15; }); R.face.brows.forEach(e => { e.position.z = 0.15; });
      Object.values(R.face.mouths).forEach(m => { m.position.z = 0.15; });
    } else if (kind === 'sun') {
      mesh(G.sphere, toon(main, { emissive: '#8a4a00' }), { s: 0.42, shadow: true, parent: R.head });
      R.rays = group(R.head);
      for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; mesh(G.cone, toon('#ffcf4d', { emissive: '#8a5a00' }), { p: [Math.cos(a) * 0.6, Math.sin(a) * 0.6, -0.05], r: [0, 0, a - Math.PI / 2], s: [0.08, 0.2, 0.08], parent: R.rays }); }
      R.face = addFace(R.head, 0.42);
    } else if (kind === 'moon') {
      const shape = new THREE.Shape(); shape.absarc(0, 0, 0.5, 0, Math.PI * 2, false);
      const hole = new THREE.Path(); hole.absarc(0.24, 0.12, 0.42, 0, Math.PI * 2, true); shape.holes.push(hole);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.04, bevelSegments: 3 }); geo.center();
      mesh(geo, toon(main, { emissive: '#5a5230' }), { shadow: true, parent: R.head });
      R.face = addFace(R.head, 0.24, { eyeY: 0.1 });
      const off = new THREE.Vector3(-0.27, -0.06, 0.12);
      R.face.eyes.forEach(e => { e.position.add(off); }); R.face.brows.forEach(e => { e.position.add(off); }); Object.values(R.face.mouths).forEach(m => { m.position.add(off); });
      R.face.eyes[1].visible = false; R.face.brows[1].visible = false;
    } else {
      for (const [x, y, s] of [[0, 0, 0.36], [-0.34, -0.08, 0.26], [0.34, -0.06, 0.28], [-0.16, 0.18, 0.24], [0.18, 0.2, 0.26]]) mesh(G.sphere, toon(main), { p: [x, y, 0], s, shadow: true, parent: R.head });
      R.face = addFace(R.head, 0.36);
    }
  } else {
    // Animals (and the owl) standing up like the 2D cast.
    const owl = info.plan === 'owl';
    const big = info.age === 'big' ? 1.18 : 1;
    const inner = info.inner || '#ffffff';
    const dark = kind === 'panda' ? '#2b2b30' : null;
    const legLen = owl ? 0.16 : 0.3;
    headR = owl ? 0.34 : 0.33;
    R.hips = group(rig, [0, legLen, 0]);
    R.legs = [-1, 1].map(sx => { const g = group(R.hips, [sx * 0.14, 0, 0]); limb(g, owl ? 0.04 : 0.1, legLen, toon(owl ? '#f2a03a' : dark || main), 0, 0, 0); mesh(G.sphere, toon(owl ? '#f2a03a' : dark || inner), { p: [0, -legLen + 0.03, 0.07], s: [0.11, 0.06, 0.15], shadow: true, parent: g }); return g; });
    R.torso = group(R.hips, [0, 0, 0]);
    mesh(G.sphere, toon(main), { p: [0, 0.32, 0], s: [0.34, 0.4, 0.3], shadow: true, parent: R.torso });
    mesh(G.sphere, toon(inner), { p: [0, 0.28, 0.17], s: [0.24, 0.3, 0.15], parent: R.torso });
    R.arms = [-1, 1].map(sx => {
      const g = group(R.torso, [sx * 0.33, 0.48, 0]);
      if (owl) mesh(G.sphere, toon(main), { p: [sx * 0.04, -0.2, -0.02], s: [0.09, 0.26, 0.17], shadow: true, parent: g });
      else limb(g, 0.075, 0.32, toon(dark || main), 0, 0, 0);
      g.userData.side = sx; return g;
    });
    headY = owl ? 0.72 : 0.78 + headR * 0.6;
    R.head = group(R.torso, [0, headY, 0]);
    mesh(G.sphere, toon(main), { s: [headR * 1.04, headR, headR * 0.96], shadow: true, parent: R.head });
    const earMat = toon(dark || main), innerMat = toon(inner, { outline: false });
    R.ears = [];
    for (const sx of [-1, 1]) {
      const e = group(R.head, [sx * headR * 0.45, headR * 0.82, -0.02]);
      R.ears.push(e); e.userData.side = sx;
      if (kind === 'rabbit') { e.position.x = sx * headR * 0.32; mesh(G.capsule, earMat, { p: [0, 0.24, 0], s: [0.13, 0.36, 0.08], r: [0, 0, -sx * 0.12], shadow: true, parent: e }); mesh(G.capsule, innerMat, { p: [0, 0.24, 0.04], s: [0.06, 0.28, 0.02], r: [0, 0, -sx * 0.12], parent: e }); }
      else if (kind === 'cat' || kind === 'fox') { mesh(G.cone, earMat, { p: [0, 0.1, 0], s: [0.12, 0.22, 0.08], r: [0, 0, -sx * 0.25], shadow: true, parent: e }); }
      else if (kind === 'dog') { e.position.set(sx * headR * 0.92, headR * 0.3, 0); mesh(G.sphere, toon('#8a5a32'), { p: [sx * 0.04, -0.14, 0], s: [0.08, 0.2, 0.06], r: [0, 0, sx * 0.25], parent: e }); }
      else if (kind === 'mouse') { e.position.set(sx * headR * 0.75, headR * 0.7, -0.04); mesh(G.sphere, earMat, { s: [0.2, 0.2, 0.05], parent: e }); mesh(G.sphere, innerMat, { p: [0, 0, 0.03], s: [0.14, 0.14, 0.02], parent: e }); }
      else if (kind === 'elephant') { e.position.set(sx * headR * 0.95, 0.02, -0.05); mesh(G.sphere, earMat, { s: [0.3, 0.36, 0.05], r: [0, sx * 0.6, 0], shadow: true, parent: e }); }
      else if (owl) { mesh(G.cone, earMat, { p: [0, 0.06, 0], s: [0.07, 0.16, 0.06], r: [0, 0, -sx * 0.35], parent: e }); }
      else { mesh(G.sphere, earMat, { s: [0.1, 0.1, 0.06], shadow: true, parent: e }); }
    }
    if (kind === 'lion') for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; mesh(G.sphere, toon('#c9772b'), { p: [Math.cos(a) * headR * 0.98, Math.sin(a) * headR * 0.98, -0.06], s: 0.12, parent: R.head }); }
    if (kind === 'panda') for (const sx of [-1, 1]) mesh(G.sphere, toon('#2b2b30', { outline: false }), { p: [sx * 0.36 * headR, 0.08 * headR, 0.8 * headR], s: [0.13, 0.15, 0.06], r: [0, 0, sx * 0.4], parent: R.head });
    if (owl) {
      for (const sx of [-1, 1]) mesh(G.sphere, toon(inner, { outline: false }), { p: [sx * 0.36 * headR, 0.1 * headR, 0.82 * headR], s: [0.15, 0.15, 0.04], parent: R.head });
      mesh(G.cone, toon('#f2a03a'), { p: [0, -0.06 * headR, 0.98 * headR], r: [Math.PI / 2 + 0.3, 0, 0], s: [0.05, 0.12, 0.05], parent: R.head });
    } else if (kind === 'elephant') {
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, -0.05, headR * 0.92), new THREE.Vector3(0, -0.25, headR * 1.05), new THREE.Vector3(0, -0.42, headR * 1.0), new THREE.Vector3(0, -0.5, headR * 1.12)]);
      R.trunk = mesh(new THREE.TubeGeometry(curve, 16, 0.06, 10, false), toon(main), { shadow: true, parent: R.head });
    } else {
      // Muzzle in a lighter shade of the fur, small nose: pink for rabbit, mouse and cat, dark for the rest.
      const muzzle = '#' + col(main).lerp(col('#ffffff'), 0.45).getHexString();
      const pinkNose = kind === 'rabbit' || kind === 'mouse' || kind === 'cat';
      mesh(G.sphere, toon(muzzle, { outline: false }), { p: [0, -0.16 * headR, 0.8 * headR], s: [0.12, 0.08, 0.08], parent: R.head });
      mesh(G.sphere, toon(pinkNose ? '#ff8fab' : '#2b1d1d', { outline: false }), { p: [0, -0.08 * headR, 0.98 * headR], s: [0.042, 0.032, 0.03], parent: R.head });
    }
    // Tails
    R.tail = group(R.torso, [0, 0.2, -0.28]);
    if (kind === 'rabbit' || kind === 'bear' || kind === 'panda') mesh(G.sphere, toon(kind === 'rabbit' ? '#ffffff' : dark || main), { s: 0.09, parent: R.tail });
    else if (kind === 'fox') { mesh(G.sphere, toon(main), { p: [0, 0.1, -0.2], s: [0.13, 0.13, 0.3], r: [-0.6, 0, 0], shadow: true, parent: R.tail }); mesh(G.sphere, toon('#ffffff'), { p: [0, 0.28, -0.42], s: 0.09, parent: R.tail }); }
    else if (kind === 'cat' || kind === 'lion' || kind === 'mouse' || kind === 'dog' || kind === 'elephant') {
      const thin = kind === 'mouse' ? 0.025 : kind === 'dog' ? 0.05 : 0.04;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.05, -0.2), new THREE.Vector3(0, 0.25, -0.3), new THREE.Vector3(0, 0.42, -0.24)]);
      mesh(new THREE.TubeGeometry(curve, 12, thin, 8, false), toon(kind === 'mouse' ? '#ffb3c7' : main), { parent: R.tail });
      if (kind === 'lion' || kind === 'elephant') mesh(G.sphere, toon('#8a4a1c'), { p: [0, 0.44, -0.24], s: 0.06, parent: R.tail });
    }
    R.face = addFace(R.head, headR, { beak: owl, eyeScale: owl ? 1.15 : 1, eyeY: owl ? 0.12 : 0.18 });
    rig.scale.setScalar(big);
  }
  R.headR = headR;
  R.headTop = new THREE.Object3D();
  R.headTop.position.set(0, (headR || 0.3) * (R.plan === 'robot' ? 1.4 : 1.15), 0);
  R.head.add(R.headTop);
  R.root.traverse(o => { if (o.isMesh && o.castShadow) o.receiveShadow = false; });
  return R;
}

// ---------- downloaded character models (Phase 3) ----------
// Poses map to the clips these packs ship; the first name found wins. Prefixes like "Robot_" are ignored.
const CLIP_FOR = {
  idle: ['idle', 'standing', 'idle_2'], talk: ['idle', 'standing'], think: ['idle', 'idle_2', 'standing'],
  walk: ['walk', 'walking'], wave: ['wave', 'yes', 'thumbsup', 'idle'], point: ['wave', 'thumbsup', 'idle'],
  jump: ['jump', 'jump_loop', 'walkjump', 'gallop_jump', 'jump_idle'], cheer: ['yes', 'thumbsup', 'clapping', 'dance', 'jump', 'wave'],
  dance: ['dance', 'yes', 'jump'], sit: ['sitting_idle', 'sitting', 'idle_eating', 'eating', 'idle'],
};
const MODELS = {};
async function loadModels() {
  const loader = new GLTFLoader();
  for (const [kind, spec] of Object.entries(MODEL_SPECS)) {
    const gltf = await loader.loadAsync(spec.file);
    const clips = {};
    for (const c of gltf.animations) {
      const name = c.name.split('|').pop().toLowerCase().replace(/^(robot|female|rat)_/, '');
      if (!clips[name]) clips[name] = c;
    }
    // Same cel-shaded look as the built-in characters.
    gltf.scene.traverse(o => {
      if (!o.isMesh) return;
      const conv = (m) => {
        const t = new THREE.MeshToonMaterial({ color: m.color ? m.color.clone() : new THREE.Color('#ffffff'), map: m.map || null, gradientMap: ramp, transparent: !!m.transparent, opacity: m.opacity ?? 1 });
        t.name = m.name;
        t.userData.outlineParameters = { thickness: 0.0035, color: [0.07, 0.05, 0.06], alpha: 1 };
        return t;
      };
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
      o.castShadow = true; o.receiveShadow = false; o.frustumCulled = false;
    });
    // Measure in the idle pose, then scale to the kind's height with the feet on the ground.
    const probe = SkeletonUtils.clone(gltf.scene);
    const mixer = new THREE.AnimationMixer(probe);
    const idle = clips.idle || clips.standing || Object.values(clips)[0];
    if (idle) { mixer.clipAction(idle).play(); mixer.setTime(0); }
    probe.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(probe, true);
    const size = box.getSize(new THREE.Vector3());
    const scale = (spec.height || 1.2) / Math.max(0.001, size.y);
    MODELS[kind] = { template: gltf.scene, clips, scale, offY: -box.min.y * scale, height: spec.height || 1.2, colorSlot: spec.colorSlot, turn: (spec.turn || 0) * Math.PI / 180 };
  }
}
if (HAS_MODELS) await loadModels();

// World pack props (Phase 4): static scenery, fitted to a real-world size from the manifest.
const PROPS = {};
async function loadProps() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(PROP_SPECS).map(async ([name, spec]) => {
    const gltf = await loader.loadAsync(spec.file);
    const obj = gltf.scene;
    obj.traverse(o => {
      if (!o.isMesh) return;
      const conv = (m) => { const t = new THREE.MeshToonMaterial({ color: m.color ? m.color.clone() : new THREE.Color('#ffffff'), map: m.map || null, gradientMap: ramp }); t.userData.outlineParameters = { thickness: 0.0025, color: [0.07, 0.05, 0.06], alpha: 1 }; return t; };
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
      o.castShadow = true; o.receiveShadow = true;
    });
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
    const fit = spec.fit || {};
    const scale = fit.h ? fit.h / Math.max(1e-4, size.y) : fit.w ? fit.w / Math.max(1e-4, size.x, size.z) : 1;
    PROPS[name] = { obj, scale, off: new THREE.Vector3(-c.x * scale, -box.min.y * scale, -c.z * scale), h: size.y * scale };
  }));
}
if (Object.keys(PROP_SPECS).length) await loadProps();
const hasProp = (n) => !!PROPS[n];
/** Place a world-pack prop (or return null when the pack is not installed). */
function kit(name, parent, x, z, { rot = 0, y = 0, s = 1 } = {}) {
  const P = PROPS[name];
  if (!P) return null;
  const g = group(parent, [x, y, z]);
  const o = P.obj.clone();
  o.scale.setScalar(P.scale * s);
  o.position.copy(P.off).multiplyScalar(s);
  g.add(o);
  g.rotation.y = rot;
  g.userData.h = P.h * s;
  return g;
}

function buildModelCharacter(c, M) {
  const obj = SkeletonUtils.clone(M.template);
  if (c.color && M.colorSlot) obj.traverse(o => {
    if (!o.isMesh) return;
    const swap = (m) => (m.name === M.colorSlot ? Object.assign(m.clone(), { color: col(c.color) }) : m);
    o.material = Array.isArray(o.material) ? o.material.map(swap) : swap(o.material);
  });
  obj.scale.setScalar(M.scale);
  obj.position.y = M.offY;
  obj.rotation.y = M.turn;   // models that face away from +z
  const R = { root: new THREE.Group(), plan: 'model', kind: c.kind };
  R.rig = group(R.root);
  R.rig.add(obj);
  R.model = { obj, M, mixer: new THREE.AnimationMixer(obj), clip: null, head: null };
  obj.traverse(o => { if (!R.model.head && o.isBone && /^head$/i.test(o.name)) R.model.head = o; });
  if (!R.model.head) obj.traverse(o => { if (!R.model.head && o.isBone && /head|neck/i.test(o.name)) R.model.head = o; });
  // Rest pose of every bone: a clip moves only some bones, and the others (and the head turn added on top)
  // must not keep what an earlier frame or clip left there, or frames would depend on drawing order.
  R.model.rest = [];
  obj.traverse(o => { if (o.isBone) R.model.rest.push([o, o.position.clone(), o.quaternion.clone(), o.scale.clone()]); });
  R.headR = M.height * 0.16;
  R.headTop = new THREE.Object3D();
  R.rig.add(R.headTop);
  return R;
}

const _q = new THREE.Quaternion(), _qp = new THREE.Quaternion(), _ax = new THREE.Vector3(), _v = new THREE.Vector3();
/** Rotate a bone about a world axis (bone axes differ between packs). */
function turnBone(bone, axis, angle) {
  if (!angle) return;
  bone.parent.getWorldQuaternion(_qp);
  _ax.copy(axis).applyQuaternion(_qp.clone().invert());
  _q.setFromAxisAngle(_ax, angle);
  bone.quaternion.premultiply(_q);
}
function poseModel(R, c, t, seed, talking, look) {
  const { mixer, M, head, obj } = R.model;
  const pose = c.walking ? 'walk' : c.pose || 'idle';
  const name = (CLIP_FOR[pose] || CLIP_FOR.idle).find(n => M.clips[n]) || Object.keys(M.clips)[0];
  const clip = M.clips[name];
  if (clip && R.model.clip !== clip) { mixer.stopAllAction(); mixer.clipAction(clip).play(); R.model.clip = clip; }
  for (const [b, p, q, sc] of R.model.rest) { b.position.copy(p); b.quaternion.copy(q); b.scale.copy(sc); }
  // three.js skips writing a bone whose value equals the one it wrote last time (PropertyMixer.apply compares
  // its two accumulator slots). Clearing them makes it write every bone on every seek, so a frame never
  // depends on what an earlier seek left in the scene graph. (three r187 internals; checked in tests.)
  for (const b of mixer._bindings || []) b.buffer.fill(NaN, b.valueSize, b.valueSize * 3);
  // setTime replays from 0 to t: a pure function of t (each character starts at its own phase).
  if (clip) mixer.setTime(t + (seed % 1) * clip.duration);
  obj.updateMatrixWorld(true);
  if (head) {
    const up = new THREE.Vector3(0, 1, 0), right = new THREE.Vector3(1, 0, 0);
    if (look) { turnBone(head, up, look.yaw * 0.9); turnBone(head, right, look.nod); }
    if (talking) turnBone(head, right, 0.05 * Math.sin(t * 6.3 + seed));
    obj.updateMatrixWorld(true);
    head.getWorldPosition(_v);
    R.rig.worldToLocal(_v);
    R.headTop.position.set(_v.x, _v.y + R.headR * 1.1, _v.z);
  } else R.headTop.position.set(0, M.height * 1.02, 0);
}

// ---------- lip-sync mouth shapes (relative to head radius) ----------
// X rest · A closed (M B P) · B teeth · C wide (E I) · D open (A) · E round (O) · F small round (U W) · G F/V · H tongue up (L)
const SHAPES = {
  A: { w: 0.19, h: 0.02, teeth: 0, tongue: 0, ring: 0 },
  B: { w: 0.17, h: 0.07, teeth: 1, tongue: 0, ring: 0 },
  C: { w: 0.22, h: 0.09, teeth: 1, tongue: 0, ring: 0 },
  D: { w: 0.18, h: 0.19, teeth: 0, tongue: 1, ring: 0 },
  E: { w: 0.13, h: 0.15, teeth: 0, tongue: 0, ring: 1 },
  F: { w: 0.08, h: 0.08, teeth: 0, tongue: 0, ring: 1 },
  G: { w: 0.16, h: 0.05, teeth: 1, tongue: 0, ring: 0 },
  H: { w: 0.15, h: 0.12, teeth: 0, tongue: 1.5, ring: 0 },
  X: { w: 0.12, h: 0.0, teeth: 0, tongue: 0, ring: 0 },
};
/** Mouth shape at t from a [[t, shape]] track, blended from the previous shape over 60 ms. */
function mouthAt(track, t) {
  let k = -1;
  for (let i = 0; i < track.length && track[i][0] <= t; i++) k = i;
  if (k < 0) return null;
  const cur = SHAPES[track[k][1]] || SHAPES.X, prev = k > 0 ? SHAPES[track[k - 1][1]] || SHAPES.X : SHAPES.X;
  const a = easeOut(clamp((t - track[k][0]) / 0.06));
  const o = {};
  for (const key of Object.keys(cur)) o[key] = lerp(prev[key], cur[key], a);
  o.closed = track[k][1] === 'A' || track[k][1] === 'X';
  return o;
}
function shapeMouth(F, m) {
  const T = F.talk, r = T.r;
  const h = Math.max(0.012, m.h);
  T.cavity.scale.set(m.w * r, h * r, 0.05 * r);
  T.teeth.visible = m.teeth > 0.5 && h > 0.03;
  T.teeth.scale.set(m.w * r * 0.95, Math.min(h * 0.38, 0.03) * r, 0.02 * r);
  T.teeth.position.set(0, h * r * 0.62, 0.035 * r);
  T.tongue.visible = m.tongue > 0.5 && h > 0.06;
  T.tongue.scale.set(m.w * r * 0.55, h * r * 0.35, 0.03 * r);
  T.tongue.position.set(0, m.tongue > 1.2 ? h * r * 0.1 : -h * r * 0.45, 0.02 * r);
  T.ring.visible = m.ring > 0.5;
  T.ring.scale.set(m.w * r * 1.1, h * r * 1.1, 0.04 * r);
}

// ---------- poses (pure functions of t) ----------
// brow: how far the inner ends of the brows go up (+, sad/worried) or down (-, angry); lift: brows raised.
const MOOD_FACE = {
  happy: { brow: 0.04, lift: 0.02, mouth: 'smile', eye: 1 },
  sad: { brow: 0.38, lift: 0, mouth: 'sad', eye: 0.9 },
  surprised: { brow: 0.08, lift: 0.07, mouth: 'open', eye: 1.2, open: 0.6 },
  angry: { brow: -0.45, lift: -0.02, mouth: 'flat', eye: 0.9 },
  worried: { brow: 0.26, lift: 0.02, mouth: 'flat', eye: 1 },
  sleepy: { brow: 0, lift: -0.02, mouth: 'flat', eye: 0.35 },
};

function poseCharacter(R, c, t, seed, talking, mood, mouth = null, look = null) {
  const w = (s) => Math.sin(t * s + seed);
  const arms = R.arms || [], legs = R.legs || [];
  // Rest pose
  R.rig.position.set(0, 0, 0); R.rig.rotation.set(0, 0, 0);
  if (R.torso) { R.torso.rotation.set(0, 0, 0); R.torso.scale.set(1, 1 + 0.018 * w(2.2), 1); }
  if (R.head) R.head.rotation.set(0, 0, 0);
  for (const a of arms) { a.rotation.set(0, 0, a.userData.side * 0.14); }
  for (const l of legs) l.rotation.set(0, 0, 0);
  if (R.hips && R.plan !== 'float') R.hips.position.y = R.hips.userData.y0 ?? (R.hips.userData.y0 = R.hips.position.y);
  const A = arms.find(a => a.userData.side > 0), B = arms.find(a => a.userData.side < 0);
  const pose = c.walking ? 'walk' : c.pose;

  switch (pose) {
    case 'walk': {
      const p = t * 7.5;
      legs.forEach((l, k) => { l.rotation.x = Math.sin(p + (l.userData.phase ?? k * Math.PI)) * (R.plan === 'quad' ? 0.5 : 0.65); });
      arms.forEach((a, k) => { a.rotation.x = -Math.sin(p + k * Math.PI) * 0.55; });
      R.rig.position.y = Math.abs(Math.sin(p)) * 0.05;
      if (R.torso) R.torso.rotation.z = Math.sin(p) * 0.04;
      break;
    }
    case 'wave':
      if (A) { A.rotation.z = 2.5 + 0.35 * Math.sin(t * 9 + seed); A.rotation.x = -0.15; }
      if (R.head) R.head.rotation.z = -0.08;
      break;
    case 'jump': {
      const ph = ((t * 0.9 + seed) % 1 + 1) % 1;
      const air = ph < 0.6 ? Math.sin((ph / 0.6) * Math.PI) : 0;
      R.rig.position.y = air * 0.55;
      const squash = ph >= 0.6 ? Math.sin(((ph - 0.6) / 0.4) * Math.PI) * 0.12 : 0;
      const s0 = R.rig.scale.x;
      R.rig.scale.set(s0 * (1 + squash), s0 * (1 - squash), s0 * (1 + squash));
      arms.forEach(a => { a.rotation.z = a.userData.side * (0.4 + air * 1.6); });
      legs.forEach(l => { l.rotation.x = -air * 0.5; });
      break;
    }
    case 'cheer':
      arms.forEach(a => { a.rotation.z = a.userData.side * (2.6 + 0.2 * Math.sin(t * 8 + seed)); });
      R.rig.position.y = Math.abs(Math.sin(t * 5 + seed)) * 0.12;
      break;
    case 'dance':
      if (R.torso) { R.torso.rotation.z = Math.sin(t * 5 + seed) * 0.16; R.torso.rotation.y = Math.sin(t * 2.5) * 0.3; }
      arms.forEach((a, k) => { a.rotation.z = a.userData.side * (1.2 + Math.sin(t * 5 + k * Math.PI) * 1.0); });
      legs.forEach((l, k) => { l.rotation.x = Math.max(0, Math.sin(t * 5 + k * Math.PI)) * 0.4; });
      R.rig.position.y = Math.abs(Math.sin(t * 5)) * 0.06;
      break;
    case 'point':
      if (A) { A.rotation.x = -1.45; A.rotation.z = 0.25; }
      break;
    case 'think':
      if (A) { A.rotation.x = -2.2; A.rotation.z = -0.35; }
      if (R.head) { R.head.rotation.z = 0.12; R.head.rotation.x = -0.06; }
      break;
    case 'sit':
      legs.forEach(l => { l.rotation.x = -1.45; });
      if (R.hips) R.hips.position.y = (R.hips.userData.y0 || 0) * 0.55;
      break;
    default:
      if (R.torso) R.torso.rotation.z = Math.sin(t * 1.1 + seed) * 0.025;
  }
  // Talking: small gestures and nods.
  if (talking && (pose === 'idle' || pose === 'talk' || pose === 'sit')) {
    if (B) { B.rotation.x = -0.5 - 0.3 * Math.max(0, Math.sin(t * 2.6 + seed)); B.rotation.z = B.userData.side * 0.3; }
    if (R.head) R.head.rotation.x = 0.05 * Math.sin(t * 6.3 + seed);
  } else if (pose === 'talk' && B) { B.rotation.x = -0.4; }
  if (mood === 'sad' && R.head) R.head.rotation.x += 0.16;
  // Gaze: turn the head toward whoever matters now (speaker, listener or camera); nod at line starts.
  if (look && R.head && R.plan !== 'float') {
    R.head.rotation.y += look.yaw;
    R.head.rotation.x += look.nod;
    R.head.rotation.z += look.tilt;
  }
  // Ears and tail sway (springy, from t).
  (R.ears || []).forEach(e => { e.rotation.z = e.userData.side * 0.06 * Math.sin(t * 3 + seed); });
  if (R.tail) R.tail.rotation.y = Math.sin(t * 4 + seed) * 0.3;
  if (R.rays) R.rays.rotation.z = t * 0.4;
  // Designed characters: four-legged waves lift a front paw; snakes slither; wings flap; peacock fans shimmer; ghosts sway.
  if (R.plan === 'quad' && (pose === 'wave' || pose === 'point') && legs[0]) legs[0].rotation.x = -1.1 - 0.25 * Math.sin(t * 8 + seed);
  if (R.segs) R.segs.forEach((g, k) => { g.position.x = Math.sin(t * 3.5 + seed - k * 0.7) * 0.1 * (0.3 + k / R.segs.length); });
  if (R.wings) R.wings.forEach(w => { w.rotation.z = w.userData.side * (0.2 + (pose === 'cheer' || pose === 'jump' || pose === 'dance' ? 0.6 : 0.15) * Math.sin(t * (pose === 'idle' ? 2 : 9) + seed)); });
  if (R.fan) R.fan.rotation.x = 0.05 * Math.sin(t * 1.5 + seed);
  if (R.skirt) R.skirt.rotation.y = Math.sin(t * 2 + seed) * 0.2;
  if (R.antenna) R.antenna.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 6);
  if (R.plan === 'float') { R.hips.position.y = 1.35 + Math.sin(t * 2 + seed) * 0.1; R.hips.rotation.z = Math.sin(t * 1.3 + seed) * 0.08; }

  // Face: mood, blink, talking mouth.
  const f = MOOD_FACE[mood] || MOOD_FACE.happy;
  const F = R.face;
  if (!F) return;
  F.brows.forEach(b => { b.rotation.z = -b.userData.side * f.brow; b.position.y = (b.userData.y0 ?? (b.userData.y0 = b.position.y)) + (f.lift || 0) * (R.headR || 0.3) * 3; });
  const period = 2.8 + (seed % 1.9);
  const blink = ((t + seed * 1.37) % period + period) % period < 0.13 && mood !== 'surprised';
  F.eyes.forEach(e => { e.scale.set(1, blink ? 0.1 : f.eye, 1); });
  if (talking && mouth && F.talk) {
    // Lip-sync from the line's mouth-shape track.
    const closed = mouth.closed && mouth.h < 0.03;
    for (const [k, m] of Object.entries(F.mouths)) m.visible = closed && k === 'flat';
    F.talk.group.visible = !closed;
    if (!closed) shapeMouth(F, mouth);
    return;
  }
  if (F.talk) F.talk.group.visible = false;
  let open = 0;
  if (talking) open = 0.25 + 0.75 * Math.abs(Math.sin(t * 12.5 + seed)) * (0.6 + 0.4 * Math.sin(t * 4.7 + seed * 2));
  else if (f.open) open = f.open;
  for (const [k, m] of Object.entries(F.mouths)) m.visible = open > 0.05 ? k === 'open' : k === f.mouth;
  if (open > 0.05) F.mouths.open.scale.y = (R.headR || 0.3) * 0.12 * (0.35 + open);
}

// ---------- worlds ----------
function skyDome(top, bottom) {
  const m = new THREE.ShaderMaterial({
    uniforms: { top: { value: col(top) }, bottom: { value: col(bottom) } },
    vertexShader: 'varying float h; void main(){ h = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying float h; void main(){ gl_FragColor = vec4(mix(bottom, top, smoothstep(-0.05, 0.55, h)), 1.0); }',
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  m.userData.outlineParameters = { visible: false };
  const s = new THREE.Mesh(new THREE.SphereGeometry(150, 32, 16), m);
  s.renderOrder = -1;
  return s;
}
function tree(parent, x, z, s, r, { pine = false, color = '#4caf50' } = {}) {
  if (!pine && hasProp('tree')) {
    const big = hasProp('tree-large') && r() > 0.5;
    return kit(big ? 'tree-large' : 'tree', parent, x, z, { rot: r() * 6, s: (1.9 * s) / (big ? 5.0 : 3.6) * 1.15 });
  }
  const g = group(parent, [x, 0, z]);
  g.scale.setScalar(s);
  mesh(G.cyl, toon('#7a5230'), { p: [0, 0.5, 0], s: [0.12, 1, 0.12], parent: g });
  if (pine) for (let k = 0; k < 3; k++) mesh(G.cone, toon(color), { p: [0, 1.1 + k * 0.45, 0], s: [0.75 - k * 0.18, 0.8, 0.75 - k * 0.18], parent: g });
  else for (const [dx, dy, ds] of [[0, 1.45, 0.62], [-0.32, 1.2, 0.45], [0.34, 1.25, 0.48]]) mesh(G.lowSphere, toon(color), { p: [dx, dy, (r() - 0.5) * 0.2], s: ds, parent: g });
  g.rotation.y = r() * 6;
  return g;
}
function cloudPuff(parent, x, y, z, s) {
  const g = group(parent, [x, y, z]); g.scale.setScalar(s);
  for (const [dx, dy, ds] of [[0, 0, 1], [-1, -0.2, 0.75], [1, -0.15, 0.8], [0.4, 0.45, 0.7]]) mesh(G.sphere, toon('#ffffff', { outline: false }), { p: [dx, dy, 0], s: ds, parent: g });
  return g;
}
function flowers(parent, r, n, area, colors) {
  const inst = new THREE.InstancedMesh(G.sphere, toon('#ffffff', { outline: false }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  for (let k = 0; k < n; k++) {
    let x, z;
    do { x = (r() - 0.5) * area[0]; z = Math.min(0.8, area[1] + r() * area[2]); } while (Math.abs(x) < STAGE_W / 2 + 0.3 && z > -1.5);
    v.set(x, 0.04, z); sc.setScalar(0.035 + r() * 0.025);
    m.compose(v, q, sc); inst.setMatrixAt(k, m); inst.setColorAt(k, col(colors[Math.floor(r() * colors.length)]));
  }
  parent.add(inst);
  return inst;
}

/** Build the place for a scene. Returns { group, update(t), lights, fog }. */
function buildWorld(spec, r) {
  const bg = spec.background || 'meadow';
  const time = spec.time || 'day';
  const P = PAL[time] || PAL.day;
  const root = new THREE.Group();
  const updates = [];
  const indoor = ['home', 'bedroom', 'classroom', 'office'].includes(bg);
  let fog = new THREE.Fog(P.far, 26, 95);
  let hemi = [P.sky[1], P.ground, P.hemi], key = [P.light, P.key];
  const side = (n, spread, zMin, zMax, place) => { for (let k = 0; k < n; k++) { const sx = k % 2 ? 1 : -1; const x = sx * (STAGE_W / 2 + 1 + r() * spread); const z = zMin + r() * (zMax - zMin); place(x, z, k); } };

  const ground = (color, size = 70) => { const g = mesh(new THREE.CircleGeometry(size, 48), toon(color, { outline: false }), { r: [-Math.PI / 2, 0, 0], parent: root }); g.receiveShadow = true; return g; };
  const hills = () => P.hills.forEach((c, k) => mesh(G.sphere, toon(c, { outline: false }), { p: [(k - 1) * 22 + (r() - 0.5) * 6, -6 + k, -34 - k * 6], s: [18 + r() * 6, 10 + k * 2, 8], parent: root }));
  const skyStuff = (clouds = 5) => {
    root.add(skyDome(P.sky[0], P.sky[1]));
    if (time === 'night') {
      const pos = new Float32Array(600 * 3);
      for (let k = 0; k < 600; k++) { const a = r() * Math.PI * 2, e = 0.08 + r() * 1.2; pos.set([Math.cos(a) * Math.cos(e) * 140, Math.sin(e) * 140, Math.sin(a) * Math.cos(e) * 140], k * 3); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pm = new THREE.PointsMaterial({ color: '#ffffff', size: 1.4, sizeAttenuation: false, fog: false }); pm.userData.outlineParameters = { visible: false };
      root.add(new THREE.Points(pg, pm));
      mesh(G.sphere, flat('#f6f0c8'), { p: [14, 22, -90], s: 4, parent: root });
    } else {
      mesh(G.sphere, flat(time === 'sunset' ? '#ff9a3c' : '#fff3a8'), { p: [-18, time === 'sunset' ? 6 : 26, -95], s: time === 'sunset' ? 9 : 6, parent: root });
    }
    const cl = [];
    for (let k = 0; k < clouds; k++) cl.push([cloudPuff(root, (r() - 0.5) * 70, 10 + r() * 8, -40 - r() * 20, 1.8 + r() * 1.6), r()]);
    updates.push((t) => cl.forEach(([c, ph]) => { c.position.x = ((ph * 90 + t * 0.6) % 90) - 45; }));
  };

  switch (bg) {
    case 'forest':
      skyStuff(3); ground('#4f8f3c'); hills();
      side(26, 14, -18, 2, (x, z) => tree(root, x, z, 1.3 + r() * 1.2, r, { pine: r() > 0.4, color: ['#2f7d3b', '#3f8f45', '#2b6b35'][Math.floor(r() * 3)] }));
      for (let k = 0; k < 14; k++) tree(root, (r() - 0.5) * 34, -8 - r() * 16, 1.4 + r(), r, { pine: true, color: '#2b6b35' });
      for (let k = 0; k < 6; k++) { const m = group(root, [(r() - 0.5) * 14, 0, 1 + r() * 2]); if (Math.abs(m.position.x) < STAGE_W / 2) m.position.x += Math.sign(m.position.x || 1) * STAGE_W / 2; mesh(G.cyl, toon('#f3ead8'), { p: [0, 0.08, 0], s: [0.04, 0.16, 0.04], parent: m }); mesh(G.hemi, toon('#e3483c'), { p: [0, 0.14, 0], s: 0.12, parent: m }); }
      mesh(new THREE.PlaneGeometry(2.2, 40), toon('#a07a4c', { outline: false }), { p: [0, 0.01, -14], r: [-Math.PI / 2, 0, 0], parent: root }).receiveShadow = true;
      fog = new THREE.Fog(time === 'night' ? '#1c2f3a' : '#9fc7a0', 18, 70);
      break;
    case 'mountains':
      skyStuff(4); ground(P.ground);
      for (let k = 0; k < 7; k++) {
        const x = (k - 3) * 22 + (r() - 0.5) * 8, h = 11 + r() * 7, z = -78 - r() * 14, w = 15 + r() * 6;
        const rock = time === 'night' ? '#4a5a78' : time === 'sunset' ? '#8a6a7a' : '#7d8fa6';
        mesh(new THREE.ConeGeometry(1, 1, 7), toon(rock, { outline: false }), { p: [x, h / 2 - 3, z], s: [w, h, w * 0.8], r: [0, r() * 3, 0], parent: root });
        mesh(new THREE.ConeGeometry(1, 1, 7), toon('#ffffff', { outline: false }), { p: [x, h - 3 - h * 0.13, z + 0.4], s: [w * 0.27, h * 0.27, w * 0.22], r: [0, r() * 3, 0], parent: root });
      }
      hills();
      if (time !== 'night') ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'].forEach((c, k) => mesh(new THREE.TorusGeometry(30 - k * 1.3, 0.65, 8, 48, Math.PI), flat(c, { opacity: 0.8 }), { p: [6, -4, -70], parent: root }));
      side(6, 8, -6, 1, (x, z) => tree(root, x, z, 1.2 + r(), r));
      break;
    case 'beach': {
      skyStuff(4); ground('#f0d39a');
      const sea = mesh(new THREE.PlaneGeometry(200, 80), toon(time === 'night' ? '#1d3f6e' : '#2fa6d9', { outline: false }), { p: [0, 0.02, -46], r: [-Math.PI / 2, 0, 0], parent: root });
      sea.receiveShadow = true;
      const foam = [];
      for (let k = 0; k < 4; k++) foam.push(mesh(G.box, flat('#ffffff', { opacity: 0.7 }), { p: [0, 0.04, -7 - k * 4], s: [80, 0.02, 0.18], parent: root }));
      updates.push((t) => foam.forEach((f, k) => { f.position.z = -6.5 - k * 4 + Math.sin(t * 1.2 + k) * 0.6; }));
      side(4, 6, -4, 1, (x, z) => { const g = group(root, [x, 0, z]); for (let s = 0; s < 6; s++) mesh(G.cyl, toon('#9c6b3c'), { p: [s * 0.08, 0.35 + s * 0.6, 0], r: [0, 0, -0.08 * s], s: [0.12, 0.64, 0.12], parent: g }); for (let l = 0; l < 6; l++) mesh(G.sphere, toon('#3aa655'), { p: [0.5 + Math.cos(l) * 0.7, 3.8, Math.sin(l) * 0.7], r: [0, l, 0.5], s: [0.9, 0.12, 0.3], parent: g }); });
      const um = group(root, [STAGE_W / 2 + 0.8, 0, -2]); mesh(G.cyl, toon('#eeeeee'), { p: [0, 1, 0], s: [0.04, 2, 0.04], parent: um }); mesh(G.cone, toon('#ff595e'), { p: [0, 2.1, 0], s: [1.4, 0.5, 1.4], parent: um });
      break;
    }
    case 'village':
      skyStuff(5); ground(P.ground); hills();
      if (hasProp('house')) side(4, 9, -11, -4, (x, z, k) => kit(k % 2 && hasProp('house-2') ? 'house-2' : 'house', root, x, z, { rot: (x < 0 ? 0.5 : -0.5) + (r() - 0.5) * 0.3 }));
      else side(4, 8, -10, -3, (x, z) => { const g = group(root, [x, 0, z]); g.rotation.y = r() - 0.5; mesh(G.cyl, toon('#d9a066'), { p: [0, 0.9, 0], s: [1.3, 1.8, 1.3], shadow: true, parent: g }); mesh(G.cone, toon('#a0522d'), { p: [0, 2.4, 0], s: [1.9, 1.3, 1.9], shadow: true, parent: g }); mesh(G.box, toon('#5a3b22'), { p: [0, 0.55, 1.28], s: [0.5, 1.1, 0.1], parent: g }); });
      { const wl = group(root, [STAGE_W / 2 + 1.2, 0, -1]); mesh(G.cyl, toon('#9e9e9e'), { p: [0, 0.4, 0], s: [0.7, 0.8, 0.7], parent: wl }); mesh(G.box, toon('#7a5230'), { p: [0, 1.6, 0], s: [1.6, 0.12, 0.3], parent: wl }); for (const sx of [-1, 1]) mesh(G.cyl, toon('#7a5230'), { p: [sx * 0.7, 1, 0], s: [0.06, 1.2, 0.06], parent: wl }); }
      side(10, 16, -14, 0, (x, z) => tree(root, x, z, 1.1 + r(), r));
      flowers(root, r, 90, [40, -6, 9], ['#ffd23f', '#ff6f91', '#ffffff']);
      break;
    case 'city': {
      skyStuff(3); ground('#9aa5ad');
      mesh(G.box, toon('#4a4f57', { outline: false }), { p: [0, 0.01, -6], s: [120, 0.02, 6], parent: root }).receiveShadow = true;
      for (let k = -8; k <= 8; k++) mesh(G.box, flat('#f4f4f4'), { p: [k * 4, 0.03, -6], s: [1.6, 0.01, 0.15], parent: root });
      const lit = time === 'night';
      const BLD = ['small-building', 'low-building', 'small-building-2', 'large-building', 'skyscraper'].filter(hasProp);
      for (let k = 0; k < 16 && BLD.length; k++) kit(BLD[(k * 7 + Math.floor(r() * 3)) % BLD.length], root, (k - 7.5) * 4.6 + (r() - 0.5), -15 - r() * 6, { rot: (r() - 0.5) * 0.2 });
      for (let k = 0; k < 16 && !BLD.length; k++) {
        const x = (k - 7.5) * 4.2 + (r() - 0.5), h = 5 + r() * 10, d = -14 - r() * 6;
        const c = ['#f4a259', '#5b8e7d', '#bc4b51', '#8cb369', '#f4e285', '#6c8ead'][k % 6];
        const b = group(root, [x, 0, d]);
        mesh(G.box, toon(c, { outline: 0.002 }), { p: [0, h / 2, 0], s: [3.4, h, 3], parent: b });
        for (let y = 1.2; y < h - 0.6; y += 1.3) for (const wx of [-0.9, 0, 0.9]) mesh(G.box, lit && r() > 0.35 ? flat('#ffe08a') : toon('#cfe8ff', { outline: false }), { p: [wx, y, 1.51], s: [0.5, 0.6, 0.02], parent: b });
      }
      side(4, 4, -3.5, -3, (x, z) => { const g = group(root, [x, 0, z]); mesh(G.cyl, toon('#3b3b3b'), { p: [0, 1.6, 0], s: [0.05, 3.2, 0.05], parent: g }); mesh(G.sphere, lit ? flat('#fff1a8') : toon('#dddddd'), { p: [0, 3.25, 0], s: 0.18, parent: g }); });
      break;
    }
    case 'sky':
      root.add(skyDome(P.sky[0], P.sky[1]));
      for (let k = 0; k < 18; k++) cloudPuff(root, (r() - 0.5) * 60, -1.2 - r() * 3, -r() * 40 + 4, 1.6 + r() * 2);
      cloudPuff(root, 0, -0.9, 0, 2.4).scale.set(STAGE_W * 0.32, 1.1, 1.6);
      fog = new THREE.Fog(P.far, 30, 110);
      break;
    case 'space': {
      const s = skyDome('#05040f', '#1b1440'); root.add(s);
      const pos = new Float32Array(1500 * 3);
      for (let k = 0; k < 1500; k++) { const u = r() * 2 - 1, a = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u); pos.set([rr * Math.cos(a) * 140, u * 140, rr * Math.sin(a) * 140], k * 3); }
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pm = new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, fog: false }); pm.userData.outlineParameters = { visible: false };
      root.add(new THREE.Points(pg, pm));
      ground('#9a97a8', 40);
      for (let k = 0; k < 14; k++) { const c = mesh(G.cyl, toon('#7d7a8c', { outline: false }), { p: [(r() - 0.5) * 30, 0.02, -2 - r() * 18], s: [0.6 + r() * 1.2, 0.05, 0.6 + r() * 1.2], parent: root }); if (Math.abs(c.position.x) < STAGE_W / 2 && c.position.z > -3) c.position.z -= 4; }
      const planet = group(root, [-16, 12, -50]); mesh(G.sphere, toon('#e07a5f', { outline: false }), { s: 6, parent: planet }); mesh(new THREE.TorusGeometry(9, 0.5, 6, 48), toon('#f2cc8f', { outline: false }), { r: [1.2, 0.3, 0], parent: planet });
      mesh(G.sphere, toon('#81b29a', { outline: false }), { p: [18, 16, -60], s: 3.5, parent: root });
      const rocks = []; for (let k = 0; k < 8; k++) rocks.push([mesh(G.rock, toon('#8d8a99'), { p: [(r() - 0.5) * 30, 4 + r() * 6, -10 - r() * 15], s: 0.3 + r() * 0.5, parent: root }), r()]);
      updates.push((t) => rocks.forEach(([m, ph]) => { m.rotation.set(t * 0.3 + ph * 6, t * 0.2, 0); m.position.y += Math.sin(t + ph * 6) * 0.002; }));
      fog = null; hemi = ['#8f8cff', '#2a2440', 1.3]; key = ['#ffffff', 1.6];
      break;
    }
    case 'underwater': {
      root.add(skyDome('#0a4f7a', '#1f8fb8'));
      ground('#e3c98f');
      const weeds = [];
      side(18, 12, -14, 1, (x, z) => { const g = group(root, [x, 0, z]); for (let s = 0; s < 5; s++) mesh(G.capsule, toon(['#2e8b57', '#3cb371'][s % 2]), { p: [0, 0.3 + s * 0.5, 0], s: [0.14, 0.4, 0.08], parent: g }); weeds.push([g, r()]); });
      for (let k = 0; k < 10; k++) mesh(G.cone, toon(['#ff6f91', '#ffc75f', '#c34a36', '#f9f871'][k % 4]), { p: [(r() - 0.5) * 30, 0.4, -4 - r() * 12], s: [0.4, 0.9, 0.4], parent: root });
      const fish = []; for (let k = 0; k < 6; k++) { const f = group(root, [0, 2 + r() * 3, -5 - r() * 8]); mesh(G.sphere, toon(['#ffb703', '#fb5607', '#8ecae6'][k % 3]), { s: [0.35, 0.22, 0.14], parent: f }); mesh(G.cone, toon('#fb8500'), { p: [-0.38, 0, 0], r: [0, 0, Math.PI / 2], s: [0.18, 0.22, 0.06], parent: f }); fish.push([f, r()]); }
      const bub = []; for (let k = 0; k < 40; k++) bub.push([mesh(G.sphere, flat('#dff6ff', { opacity: 0.6 }), { s: 0.05 + r() * 0.06, parent: root }), r(), (r() - 0.5) * 24, -1 - r() * 10]);
      updates.push((t) => {
        weeds.forEach(([g, ph]) => { g.rotation.z = Math.sin(t * 1.4 + ph * 6) * 0.12; });
        fish.forEach(([f, ph], k) => { const a = t * 0.25 + ph * 6; f.position.x = Math.sin(a) * 12; f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI; f.position.y = 2 + ph * 3 + Math.sin(t * 2 + k) * 0.2; });
        bub.forEach(([b, ph, x, z]) => { const y = ((ph + t * 0.12) % 1) * 9; b.position.set(x + Math.sin(t * 2 + ph * 9) * 0.2, y, z); });
      });
      fog = new THREE.Fog('#1b7aa6', 8, 40); hemi = ['#8fe3ff', '#e3c98f', 1.4]; key = ['#d8f6ff', 1.3];
      break;
    }
    case 'home': case 'bedroom': case 'classroom': case 'office': {
      const wall = { home: '#f6d7b0', bedroom: '#c9d8f2', classroom: '#f3e6b3', office: '#e4e8ec' }[bg];
      const floor = { home: '#b07a4a', bedroom: '#9c7b5e', classroom: '#c49a6c', office: '#8f9aa6' }[bg];
      const RW = Math.max(14, STAGE_W + 6);
      mesh(G.box, toon(floor, { outline: false }), { p: [0, -0.05, -2], s: [RW, 0.1, 14], parent: root }).receiveShadow = true;
      mesh(G.box, toon(wall, { outline: false }), { p: [0, 3.5, -6], s: [RW, 7, 0.2], parent: root }).receiveShadow = true;
      for (const sx of [-1, 1]) mesh(G.box, toon(wall, { outline: false }), { p: [sx * RW / 2, 3.5, -2], s: [0.2, 7, 8], parent: root });
      // Window shows the time of day.
      const win = group(root, [-RW * 0.22, 3.6, -5.85]);
      mesh(G.box, toon('#ffffff'), { s: [2.6, 2, 0.1], parent: win });
      mesh(new THREE.PlaneGeometry(2.3, 1.7), flat(time === 'night' ? '#1b2a55' : time === 'sunset' ? '#ffb27a' : '#9fdcff'), { p: [0, 0, 0.06], parent: win });
      if (time === 'night') mesh(G.sphere, flat('#f6f0c8'), { p: [0.6, 0.4, 0.08], s: 0.22, parent: win });
      mesh(G.box, toon('#ffffff', { outline: false }), { p: [0, 0, 0.08], s: [0.06, 1.7, 0.02], parent: win });
      const furnished = hasProp('sofa') || hasProp('bed') || hasProp('desk');
      if (furnished) {
        const L = RW * 0.5;
        if (bg === 'home') {
          kit('rug-round', root, 0, -1.2);
          kit('sofa', root, L * 0.42, -4.6, { rot: 0 }); kit('coffee-table', root, L * 0.42, -3.2);
          kit('side-table', root, -L * 0.15, -5.3); kit('tv', root, -L * 0.15, -5.3, { y: 0.6 });
          kit('bookcase', root, -L * 0.72, -5.4); kit('plant-pot', root, L * 0.8, -5.2); kit('lamp-floor', root, L * 0.1, -5.4);
          kit('books', root, -L * 0.72, -5.4, { y: 0.9 });
        } else if (bg === 'bedroom') {
          kit('rug-round', root, -0.5, -1.4);
          kit('bed', root, L * 0.45, -4.4, { rot: Math.PI / 2 }); kit('side-table', root, L * 0.1, -5.2); kit('books', root, L * 0.1, -5.2, { y: 0.6 });
          kit('lamp-floor', root, -L * 0.1, -5.3); kit('box', root, -L * 0.7, -4.2, { rot: 0.4 }); kit('box', root, -L * 0.62, -3.6, { rot: -0.3, s: 0.8 }); kit('plant-pot', root, -L * 0.82, -5.2);
        } else if (bg === 'classroom') {
          const bb = group(root, [RW * 0.12, 3.3, -5.85]); mesh(G.box, toon('#8b5a2b'), { s: [5.2, 2.6, 0.1], parent: bb }); mesh(new THREE.PlaneGeometry(4.9, 2.3), toon('#2f5d50', { outline: false }), { p: [0, 0, 0.06], parent: bb }); mesh(G.box, flat('#f4f4f4'), { p: [-1, 0.5, 0.08], s: [1.6, 0.05, 0.01], parent: bb });
          for (let k = 0; k < 4; k++) { const x = (k - 1.5) * 3.0; kit('desk', root, x, -3.9, { rot: Math.PI }); kit('chair', root, x, -3.1, { rot: Math.PI }); kit('books', root, x - 0.2, -3.9, { y: 0.76 }); }
          kit('bookcase', root, -L * 0.8, -5.4); kit('plant-pot', root, L * 0.85, -5.2);
        } else {
          for (let k = 0; k < 3; k++) { const x = (k - 1) * 4.0; kit('desk', root, x, -4.3, { rot: Math.PI }); kit('desk-chair', root, x, -3.4, { rot: Math.PI }); kit(k === 1 ? 'laptop' : 'monitor', root, x, -4.4, { y: 0.76, rot: Math.PI }); }
          kit('bookcase', root, -L * 0.82, -5.4); kit('plant-pot', root, L * 0.85, -5.2);
        }
      } else if (bg === 'home') {
        const so = group(root, [RW * 0.22, 0, -4.6]); mesh(G.box, toon('#e76f51'), { p: [0, 0.45, 0], s: [3, 0.5, 1.1], shadow: true, parent: so }); mesh(G.box, toon('#e76f51'), { p: [0, 0.95, -0.45], s: [3, 1, 0.25], parent: so }); for (const sx of [-1, 1]) mesh(G.box, toon('#d65a3e'), { p: [sx * 1.5, 0.7, 0], s: [0.25, 0.8, 1.1], parent: so });
        mesh(G.cyl, toon('#f4a261', { outline: false }), { p: [0, 0.01, -1], s: [2.6, 0.02, 1.6], parent: root });
        const pic = group(root, [RW * 0.2, 3.9, -5.88]); mesh(G.box, toon('#8b5a2b'), { s: [1.4, 1, 0.08], parent: pic }); mesh(new THREE.PlaneGeometry(1.2, 0.8), toon('#7cc95c', { outline: false }), { p: [0, 0, 0.05], parent: pic });
      } else if (bg === 'bedroom') {
        const bd = group(root, [RW * 0.24, 0, -4.4]); mesh(G.box, toon('#8b5a2b'), { p: [0, 0.35, 0], s: [2.4, 0.4, 2.6], parent: bd }); mesh(G.box, toon('#6c8ead'), { p: [0, 0.62, 0.25], s: [2.3, 0.18, 2], parent: bd }); mesh(G.capsule, toon('#ffffff'), { p: [0, 0.8, -0.95], r: [0, 0, Math.PI / 2], s: [0.4, 1.2, 0.3], parent: bd }); mesh(G.box, toon('#8b5a2b'), { p: [0, 0.9, -1.3], s: [2.4, 1.4, 0.15], parent: bd });
        for (let k = 0; k < 6; k++) mesh(G.box, toon(['#ff595e', '#ffca3a', '#8ac926', '#1982c4'][k % 4]), { p: [-RW * 0.3 + (k % 3) * 0.32, 0.15 + Math.floor(k / 3) * 0.3, -2.5], s: 0.28, r: [0, r(), 0], parent: root });
      } else if (bg === 'classroom') {
        const bb = group(root, [RW * 0.12, 3.3, -5.85]); mesh(G.box, toon('#8b5a2b'), { s: [5.2, 2.6, 0.1], parent: bb }); mesh(new THREE.PlaneGeometry(4.9, 2.3), toon('#2f5d50', { outline: false }), { p: [0, 0, 0.06], parent: bb }); mesh(G.box, flat('#f4f4f4'), { p: [-1, 0.5, 0.08], s: [1.6, 0.05, 0.01], parent: bb }); mesh(G.box, flat('#f4f4f4'), { p: [-0.7, 0.2, 0.08], s: [2.2, 0.05, 0.01], parent: bb });
        for (let k = 0; k < 4; k++) { const d = group(root, [(k - 1.5) * 3.2, 0, -3.8 + (k % 2) * 0.3]); mesh(G.box, toon('#c68b59'), { p: [0, 0.75, 0], s: [1.6, 0.1, 0.8], parent: d }); for (const sx of [-1, 1]) mesh(G.box, toon('#7a5230'), { p: [sx * 0.7, 0.37, 0], s: [0.08, 0.74, 0.7], parent: d }); }
        mesh(G.sphere, toon('#4fa3e0'), { p: [-RW * 0.35, 1.2, -4.5], s: 0.45, parent: root });
      } else {
        for (let k = 0; k < 3; k++) { const d = group(root, [(k - 1) * 4.2, 0, -4.2]); mesh(G.box, toon('#e9edf2'), { p: [0, 0.78, 0], s: [2.2, 0.08, 1], parent: d }); mesh(G.box, toon('#2b2d42'), { p: [0, 1.25, -0.25], s: [0.9, 0.6, 0.05], parent: d }); mesh(new THREE.PlaneGeometry(0.82, 0.5), flat('#7fd1ff'), { p: [0, 1.25, -0.22], parent: d }); for (const sx of [-1, 1]) mesh(G.box, toon('#8d99ae'), { p: [sx * 1, 0.39, 0], s: [0.06, 0.78, 0.9], parent: d }); }
        const pl = group(root, [RW * 0.4, 0, -4.8]); mesh(G.cyl, toon('#b5651d'), { p: [0, 0.3, 0], s: [0.35, 0.6, 0.35], parent: pl }); mesh(G.lowSphere, toon('#3f8f45'), { p: [0, 1.1, 0], s: 0.6, parent: pl });
      }
      if (time === 'night') { const lamp = new THREE.PointLight('#ffd59a', 18, 14, 1.6); lamp.position.set(0, 5, -1); root.add(lamp); }
      fog = null;
      hemi = [time === 'night' ? '#8a8fb8' : '#fff4e0', floor, time === 'night' ? 1.1 : 1.5];
      key = [time === 'night' ? '#ffd59a' : '#fff6e6', time === 'night' ? 1.1 : 1.9];
      break;
    }
    case 'festival': {
      skyStuff(time === 'night' ? 0 : 3); ground(time === 'night' ? '#3a1d3f' : '#e9a55a');
      const bulbs = [];
      for (let row = 0; row < 3; row++) for (let k = 0; k < 26; k++) {
        const x = (k / 25 - 0.5) * (STAGE_W + 10), sag = Math.sin((k / 25) * Math.PI) * 0.9;
        bulbs.push([mesh(G.sphere, flat(['#ff5e78', '#ffd166', '#7bdff2', '#c77dff'][k % 4]), { p: [x, 5.4 - sag + row * 0.7, -6 - row * 3], s: 0.09, parent: root }), k]);
      }
      updates.push((t) => bulbs.forEach(([b, k]) => { b.visible = Math.sin(t * 3 + k * 1.7) > -0.6; }));
      const flames = [];
      for (let k = 0; k < 10; k++) { const sx = k % 2 ? 1 : -1; const d = group(root, [sx * (STAGE_W / 2 + 0.3 + (k >> 1) * 0.7), 0, 1.4 - (k >> 1) * 0.9]); mesh(G.hemi, toon('#c1440e'), { p: [0, 0.12, 0], r: [Math.PI, 0, 0], s: [0.2, 0.18, 0.2], parent: d }); flames.push(mesh(G.cone, flat('#ffcf4d'), { p: [0, 0.24, 0], s: [0.06, 0.16, 0.06], parent: d })); }
      updates.push((t) => flames.forEach((f, k) => { f.scale.y = 0.16 * (0.85 + 0.25 * Math.sin(t * 13 + k * 2.1)); }));
      for (let k = 0; k < 4; k++) mesh(new THREE.TorusGeometry(0.6 + k * 0.32, 0.12, 6, 32), toon(['#ff595e', '#ffca3a', '#8ac926', '#c77dff'][k], { outline: false }), { p: [0, 0.03, 2.4], r: [-Math.PI / 2, 0, 0], parent: root });
      if (time === 'night') {
        const N = 6 * 70, pos = new Float32Array(N * 3), colr = new Float32Array(N * 3);
        const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); pg.setAttribute('color', new THREE.BufferAttribute(colr, 3));
        const pm = new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true }); pm.userData.outlineParameters = { visible: false };
        root.add(new THREE.Points(pg, pm));
        const bursts = Array.from({ length: 6 }, (_, b) => ({ x: (r() - 0.5) * 40, y: 12 + r() * 8, z: -40 - r() * 10, ph: r(), c: col(['#ff5e78', '#ffd166', '#7bdff2', '#c77dff', '#90ee90', '#ffffff'][b]) }));
        const dirs = Array.from({ length: 70 }, () => { const u = r() * 2 - 1, a = r() * Math.PI * 2, rr = Math.sqrt(1 - u * u); return [rr * Math.cos(a), u, rr * Math.sin(a)]; });
        updates.push((t) => {
          bursts.forEach((b, bi) => {
            const k = ((t / 2.2 + b.ph) % 1);
            const rad = easeOut(k) * 7, fade = 1 - k;
            dirs.forEach((d, j) => { const i = (bi * 70 + j) * 3; pos[i] = b.x + d[0] * rad; pos[i + 1] = b.y + d[1] * rad - k * k * 3; pos[i + 2] = b.z + d[2] * rad; colr[i] = b.c.r * fade; colr[i + 1] = b.c.g * fade; colr[i + 2] = b.c.b * fade; });
          });
          pg.attributes.position.needsUpdate = true; pg.attributes.color.needsUpdate = true;
        });
      }
      hemi = time === 'night' ? ['#c9a0ff', '#3a1d3f', 1.25] : hemi;
      break;
    }
    default: // meadow
      skyStuff(5); ground(P.ground); hills();
      side(12, 16, -12, 1, (x, z) => tree(root, x, z, 1 + r() * 1.1, r, { color: ['#4caf50', '#5dbb63', '#3f9a4a'][Math.floor(r() * 3)] }));
      for (let k = 0; k < 8; k++) tree(root, (r() - 0.5) * 30, -12 - r() * 10, 1.2 + r(), r);
      flowers(root, r, 160, [36, -8, 12], ['#ff6f91', '#ffd23f', '#ffffff', '#c77dff']);
      for (let k = 0; k < 6; k++) { const x = (r() - 0.5) * 24; mesh(G.rock, toon('#9e9e9e'), { p: [Math.abs(x) < STAGE_W / 2 ? x + Math.sign(x || 1) * STAGE_W / 2 : x, 0.15, -2 - r() * 6], s: 0.2 + r() * 0.3, parent: root }); }
      if (time === 'night') {
        const ff = []; for (let k = 0; k < 30; k++) ff.push([mesh(G.sphere, flat('#fff59d'), { s: 0.05, parent: root }), r(), (r() - 0.5) * 20, -r() * 8]);
        updates.push((t) => ff.forEach(([m, ph, x, z]) => { m.position.set(x + Math.sin(t * 0.7 + ph * 9) * 0.6, 0.6 + ((Math.sin(t * 0.9 + ph * 7) + 1) * 0.8), z); m.visible = Math.sin(t * 3 + ph * 11) > -0.2; }));
      }
  }

  // World pack set pieces that the built-in places do not have.
  const away = (x) => (Math.abs(x) < STAGE_W / 2 + 1 ? Math.sign(x || 1) * (STAGE_W / 2 + 1.2) : x);
  if (bg === 'forest') { kit('tent', root, -(STAGE_W / 2 + 2.2), -3.2, { rot: 0.6 }); kit('campfire', root, -(STAGE_W / 2 + 0.9), -1.2); for (let k = 0; k < 5; k++) kit('rock', root, away((r() - 0.5) * 20), -1 - r() * 6, { rot: r() * 6, s: 0.4 + r() * 0.4 }); }
  if (bg === 'meadow') { kit('signpost', root, STAGE_W / 2 + 1.4, -1.6, { rot: -0.4 }); for (let k = 0; k < 4; k++) kit('rock-grass', root, away((r() - 0.5) * 26), -3 - r() * 8, { rot: r() * 6, s: 0.6 + r() * 0.5 }); for (let k = 0; k < 14; k++) kit('grass', root, away((r() - 0.5) * 22), 0.5 - r() * 9, { rot: r() * 6 }); }
  if (bg === 'mountains') kit('rock-formation', root, -(STAGE_W / 2 + 3), -6, { rot: 0.3 });
  if (bg === 'beach') { kit('ship', root, 9, -38, { rot: 1.2 }); kit('rock-formation', root, -(STAGE_W / 2 + 3), -5, { rot: 0.8 }); kit('barrel', root, STAGE_W / 2 + 1.6, -1.4, { rot: 0.3 }); kit('chest', root, STAGE_W / 2 + 2.3, -0.8, { rot: -0.4 }); }
  if (bg === 'village') { for (let k = 0; k < 6; k++) kit('fence', root, -(STAGE_W / 2) - 1 - k * 1.3, -2.6, { rot: 0 }); kit('barrel', root, -(STAGE_W / 2 + 1.2), -0.6); kit('signpost', root, STAGE_W / 2 + 2.2, -2.4, { rot: -0.5 }); }
  if (bg === 'space') { kit('spacecraft', root, -(STAGE_W / 2 + 3), -6, { rot: 0.7 }); kit('satellite', root, STAGE_W / 2 + 2.5, -4, { rot: -0.6 }); kit('speeder', root, STAGE_W / 2 + 1.5, -1, { rot: -1.2 }); }
  if (bg === 'underwater') { kit('shipwreck', root, 6, -12, { rot: -0.7 }); kit('chest', root, -(STAGE_W / 2 + 1.2), -1.4, { rot: 0.5 }); kit('rock-formation', root, -(STAGE_W / 2 + 4), -8, { rot: 0.2 }); }
  if (bg === 'festival' && hasProp('table')) {
    const tx = STAGE_W / 2 + 1.6;
    for (const sx of [-1, 1]) {
      const tb = kit('table', root, sx * tx, -2.2, { rot: 0 });
      if (!tb) continue;
      const items = sx < 0 ? ['cake', 'cupcake', 'watermelon'] : ['pizza', 'pumpkin', 'cupcake'];
      items.forEach((n, k) => kit(n, root, sx * tx + (k - 1) * 0.3, -2.2 + (k % 2) * 0.1, { y: 0.76, rot: k }));
    }
    kit('barrel', root, -(tx + 1.3), -3.2);
  }

  // Weather: particles whose positions are computed from (seed, index, t) every frame.
  const wx = spec.weather && spec.weather !== 'none' ? spec.weather : null;
  if (wx) {
    const cfg = { rain: { n: 1400, fall: 14, color: '#bcd7ff', size: 2 }, snow: { n: 900, fall: 1.1, color: '#ffffff', size: 4 }, leaves: { n: 160, fall: 0.9, color: '#e9893a', size: 7 }, fireflies: { n: 70, fall: 0, color: '#fff59d', size: 6 }, sparkles: { n: 220, fall: -0.4, color: '#fff3b0', size: 4 } }[wx];
    const N = cfg.n, pos = new Float32Array(N * 3), seeds = Array.from({ length: N }, () => [r(), r(), r(), r()]);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    let pts;
    if (wx === 'rain') {
      const lp = new Float32Array(N * 6); geo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
      const lm = new THREE.LineBasicMaterial({ color: cfg.color, transparent: true, opacity: 0.55, fog: false }); lm.userData.outlineParameters = { visible: false };
      pts = new THREE.LineSegments(geo, lm);
      updates.push((t) => {
        seeds.forEach(([a, b, c, d], i) => {
          const x = (a - 0.5) * 30, z = 6 - b * 26, y = 12 - (((t * cfg.fall) / 12 + c) % 1) * 12;
          lp.set([x, y, z, x - 0.05, y + 0.45, z], i * 6);
        });
        geo.attributes.position.needsUpdate = true;
      });
      fog = fog || new THREE.Fog('#8a99ad', 20, 80);
      hemi = [hemi[0], hemi[1], hemi[2] * 0.8]; key = [key[0], key[1] * 0.6];
    } else {
      const pm = new THREE.PointsMaterial({ color: cfg.color, size: cfg.size, sizeAttenuation: false, transparent: true, fog: false }); pm.userData.outlineParameters = { visible: false };
      pts = new THREE.Points(geo, pm);
      updates.push((t) => {
        seeds.forEach(([a, b, c, d], i) => {
          let x = (a - 0.5) * 26, z = 5 - b * 22, y;
          if (wx === 'fireflies') { y = 0.4 + (Math.sin(t * 0.9 + d * 9) + 1) * 1.2; x += Math.sin(t * 0.6 + c * 7) * 0.8; z = 1 - b * 10; }
          else if (wx === 'sparkles') { y = ((t * 0.35 + c) % 1) * 5; x += Math.sin(t * 2 + d * 9) * 0.2; }
          else { y = 9 - (((t * cfg.fall) / 9 + c) % 1) * 9; x += Math.sin(t * (wx === 'leaves' ? 1.6 : 0.8) + d * 9) * (wx === 'leaves' ? 0.9 : 0.4); }
          pos.set([x, y, z], i * 3);
        });
        geo.attributes.position.needsUpdate = true;
        if (wx === 'fireflies' || wx === 'sparkles') pm.opacity = 0.75 + 0.25 * Math.sin(t * 5);
      });
    }
    pts.frustumCulled = false;
    root.add(pts);
  }

  // Lights
  const lights = group(root);
  lights.add(new THREE.HemisphereLight(col(hemi[0]), col(hemi[1]), hemi[2]));
  const k = new THREE.DirectionalLight(col(key[0]), key[1]);
  k.position.set(-6, 10, 8); k.castShadow = true;
  k.shadow.mapSize.set(1024, 1024);
  Object.assign(k.shadow.camera, { left: -10, right: 10, top: 10, bottom: -4, near: 1, far: 40 });
  k.shadow.bias = -0.0006;
  lights.add(k); lights.add(k.target);
  const rim = new THREE.DirectionalLight(col(time === 'night' ? '#7f9cff' : '#fff0d6'), 0.7);
  rim.position.set(5, 4, -8); lights.add(rim);
  return { root, update: (t) => updates.forEach(u => u(t)), fog, indoor };
}

// ---------- scenes ----------
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('w3d'), antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
// lowres=1 (no GPU): draw at 2/3 size and let the page scale it up; text and bubbles stay sharp HTML.
const LOWRES = new URLSearchParams(location.search).has('lowres');
renderer.setPixelRatio(LOWRES ? 2 / 3 : 1);
renderer.setSize(W, H, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.shadowMap.enabled = !LOWRES;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const effect = new OutlineEffect(renderer, { defaultThickness: 0.0045, defaultColor: [0.07, 0.05, 0.06] });
const gl = renderer.getContext();
const px = new Uint8Array(4);

const scenes = {};
for (const [idx, spec] of Object.entries(SPEC.scenes)) {
  const i = +idx;
  const seed = hash(`${SPEC.seed}|${i}|${spec.background}|${spec.time}`);
  const r = rng(seed);
  const scene = new THREE.Scene();
  const world = buildWorld(spec, r);
  scene.add(world.root);
  scene.fog = world.fog;
  const chars = spec.characters.map((c, k) => {
    const R = c.design ? buildDesigned(c) : MODELS[c.kind] && c.useModel ? buildModelCharacter(c, MODELS[c.kind]) : buildCharacter(c, SPEC.kinds);
    R.root.scale.setScalar(c.s * (SPEC.format === '16:9' ? 1 : 0.92));
    scene.add(R.root);
    return { c, R, seed: (hash(c.id) % 1000) / 97 + k, x: (c.x / 100 - 0.5) * STAGE_W, z: k % 2 ? -0.25 : 0.15 };
  });
  // "near": put the named prop right beside the character, on the outer side (World pack, or a built-in stand-in).
  for (const ch of chars) {
    const n = ch.c.near;
    if (!n) continue;
    const dir = ch.x < 0 ? -1 : 1;
    const big = ['house', 'tree', 'tree-large', 'ship', 'tent', 'bookcase', 'fridge', 'bed'].includes(n);
    // Big props (house, tree, ship…) stand behind and to the side, so they never hide the character.
    const huge = ['house', 'ship'].includes(n);
    const px = ch.x + dir * (huge ? 2.6 : big ? 1.6 : 0.95), pz = huge ? -6 : big ? -2.6 : -0.45;
    if (!kit(n, world.root, px, pz, { rot: -dir * 0.5 })) {
      if (n.startsWith('tree')) tree(world.root, px, pz, 1.4, r);
      else if (n === 'campfire' || n === 'cake') mesh(G.cone, toon(n === 'cake' ? '#f4a3c0' : '#ff8a3c'), { p: [px, 0.25, pz], s: [0.3, 0.5, 0.3], parent: world.root });
    }
  }
  const tl = TL.scenes[i] || { start: 0, duration: 4, parts: [] };
  const lines = (tl.parts || []).filter(p => p.kind === 'line').map(p => ({ who: p.who, line: p.line, start: p.start - tl.start, end: p.end - tl.start, visemes: (p.visemes || []).map(([vt, x]) => [vt - tl.start, x]) }));
  scenes[i] = { scene, world, chars, spec, duration: tl.duration || 4, lines, camera: new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 400) };
}

/** Where each character is at time t (entrances), and its facing angle. */
function stageCharacter(ch, t) {
  const { c, R } = ch;
  const facingY = c.turn != null ? (c.turn * Math.PI) / 180 : c.facing === 'left' ? -0.55 : c.facing === 'right' ? 0.55 : 0;
  let x = ch.x, y = 0, scale = 1, rotY = facingY, visible = true, walking = false;
  const d = c.delay || 0;
  if (c.enter === 'walk-in') {
    const from = x < 0 ? -STAGE_W / 2 - 2.5 : STAGE_W / 2 + 2.5;
    const k = clamp((t - d) / 1.7);
    x = lerp(from, ch.x, easeIO(k));
    if (k < 1) { walking = true; rotY = from < ch.x ? 1.35 : -1.35; }
    if (k > 0.85) rotY = lerp(rotY, facingY, (k - 0.85) / 0.15);
  } else if (c.enter === 'fly-in') {
    const k = clamp((t - d) / 1.1);
    y = (1 - easeBack(k)) * 5; rotY += (1 - k) * 4;
  } else if (c.enter === 'pop' || c.enter === 'fade') {
    const k = clamp((t - d) / 0.45);
    scale = Math.max(0.001, easeBack(k)); visible = k > 0;
  }
  R.root.position.set(x, y, ch.z);
  R.root.rotation.set(0, rotY, 0);
  R.rig.scale.setScalar(scale * (R.rig.userData.s0 ?? (R.rig.userData.s0 = R.rig.scale.x)));
  R.root.visible = visible;
  return walking;
}

const v3 = new THREE.Vector3(), v4 = new THREE.Vector3();
function headOf(ch) { ch.R.headTop.getWorldPosition(v3); return v3.clone(); }

// ---------- director (plan 12, Phase 7) ----------
// Each scene gets a shot list once, at build time; the camera for frame t is then a pure function of
// the shot that covers t. Rules follow film grammar: establish a new place, open a conversation on a
// two-shot, then over-the-shoulder / close-ups on the speaker, a reaction shot of the listener on strong
// feelings, never the same size three times running, cuts just before a line starts (min 1.2 s).
const STRONG = new Set(['surprised', 'angry', 'sad', 'worried']);
const SIZE_OF = { 'extreme-wide': 0, establish: 0, wide: 1, full: 2, 'two-shot': 3, medium: 3, 'over-shoulder': 4, 'medium-close': 4, close: 5, 'extreme-close': 6, follow: 3 };

function planShots(S) {
  const D = S.duration;
  const ids = S.chars.map(ch => ch.c.id);
  const sc = S.spec.camera || 'auto';
  if (sc !== 'auto') return [{ type: sc, start: 0, end: D, subject: ids }];
  const shots = [];
  const push = (sh) => {
    const prev = shots.at(-1);
    if (prev && sh.start - prev.start < 1.2) {                      // too short: keep the previous shot
      if (sh.type !== prev.type || sh.subject.join() !== prev.subject.join()) { prev.end = sh.end; return; }
    }
    if (prev) prev.end = sh.start;
    shots.push(sh);
  };
  let t = 0;
  if (S.spec.newPlace && D > 3.2 && S.chars.length) { push({ type: 'establish', start: 0, end: Math.min(2.0, D * 0.35), subject: ids }); t = shots[0].end; }
  if (!S.lines.length) {
    const walker = S.chars.find(ch => ch.c.enter === 'walk-in');
    if (walker && D - t > 3) {
      const e = (walker.c.delay || 0) + 1.7;
      if (e > t + 0.8) { push({ type: 'follow', start: t, end: e, subject: [walker.c.id] }); t = e; }
    }
    push({ type: S.chars.length > 1 ? 'wide' : 'full', move: 'push', start: t, end: D, subject: ids });
    shots.at(-1).end = D;
    return shots;
  }
  // Dialogue: the two most talkative characters carry the two-shot.
  const talk = new Map();
  for (const l of S.lines) talk.set(l.who, (talk.get(l.who) || 0) + (l.end - l.start));
  const pair = [...talk.keys()].sort((a, b) => talk.get(b) - talk.get(a));
  for (const id of ids) if (pair.length < 2 && !pair.includes(id)) pair.push(id);
  const solo = S.chars.length < 2;
  const listenerOf = (who, k) => {
    const next = S.lines.slice(k + 1).find(l => l.who !== who)?.who;
    if (next) return next;
    const sp = S.chars.find(ch => ch.c.id === who);
    const others = S.chars.filter(ch => ch.c.id !== who).sort((a, b) => Math.abs(a.x - (sp?.x || 0)) - Math.abs(b.x - (sp?.x || 0)));
    return others[0]?.c.id || null;
  };
  push({ type: solo ? 'medium' : 'two-shot', start: t, end: S.lines[0].end, subject: solo ? ids : pair.slice(0, 2) });
  let alt = 0;
  S.lines.forEach((L, k) => {
    if (k === 0) return;
    const spec = S.spec.lines[L.line] || {};
    const listener = listenerOf(L.who, k);
    const cutAt = Math.max(0, L.start - 0.08);
    let type = spec.shot && spec.shot !== 'auto' ? spec.shot : null;
    if (type === 'reaction') { push({ type: 'close', start: cutAt, end: L.end, subject: [listener || L.who], reaction: true }); return; }
    if (!type) {
      type = solo ? (alt % 2 ? 'close' : 'medium-close') : (alt % 2 ? 'close' : 'over-shoulder');
      const last2 = shots.slice(-2).map(x => SIZE_OF[x.type]);
      if (last2.length === 2 && last2[0] === SIZE_OF[type] && last2[1] === SIZE_OF[type]) type = 'medium-close';
      alt++;
    }
    const subject = type === 'two-shot' || type === 'medium' || type === 'wide' ? pair.slice(0, 2) : [L.who];
    const mood = spec.mood || '';
    // Strong feeling in a long line: end on the listener's reaction.
    if (!solo && listener && STRONG.has(mood) && L.end - L.start > 2.4 && !spec.shot) {
      push({ type, start: cutAt, end: L.end - 0.9, subject, over: listener });
      push({ type: 'close', start: L.end - 0.9, end: L.end, subject: [listener], reaction: true });
    } else push({ type, start: cutAt, end: L.end, subject, over: listener });
  });
  const lastEnd = S.lines.at(-1).end;
  if (D - lastEnd > 1.0) push({ type: solo ? 'medium' : 'two-shot', start: lastEnd + 0.1, end: D, subject: solo ? ids : pair.slice(0, 2) });
  shots.at(-1).end = D;
  return shots;
}

/** Facts about a character needed for framing (world space, after posing). */
function frameInfo(ch) {
  const head = headOf(ch);
  const s = ch.R.root.scale.x * (ch.R.rig.userData.s0 || 1);
  const hr = (ch.R.headR || 0.3) * s;
  const facing = ch.c.facing === 'left' ? -1 : ch.c.facing === 'right' ? 1 : (ch.x > 0 ? -1 : 1);
  return { head, hr, top: head.y + hr * 0.2, feet: ch.R.root.position.y, x: ch.R.root.position.x, z: ch.R.root.position.z, facing };
}

/** Distance that fits a frame of height hf and width wf. */
const fitDist = (hf, wf) => Math.max(hf / (2 * TAN), wf / (2 * TAN * ASPECT));

function solveShot(S, shot, t, k) {
  const cam = S.camera;
  const subs = shot.subject.map(id => S.chars.find(ch => ch.c.id === id)).filter(Boolean);
  const all = S.chars;
  const info = (subs.length ? subs : all).map(frameInfo);
  const xs = info.map(i => i.x);
  const cx = xs.length ? (Math.min(...xs) + Math.max(...xs)) / 2 : 0;
  const span = xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
  const top = info.length ? Math.max(...info.map(i => i.top)) : 1.6;
  const hr = info.length ? Math.max(...info.map(i => i.hr)) : 0.3;
  const tall = info.length ? Math.max(...info.map(i => i.top - i.feet)) : 1.6;
  let pos = new THREE.Vector3(), look = new THREE.Vector3();
  // Frame of height hf with the top of the head just under the frame top (headroom), eyes near the upper third.
  const frame = (hf, wf, { lead = 0, high = 0.15, onHead = false } = {}) => {
    const d = fitDist(hf, wf);
    const cy = top + hf * 0.1 - hf / 2;
    // Tight shots aim at the head itself (on four-legged characters it is well forward of the body).
    const fx = onHead && info.length === 1 ? info[0].head.x : cx;
    const fz = onHead && info.length === 1 ? info[0].head.z : 0;
    look.set(fx + lead, cy, fz);
    pos.set(fx + lead, cy + high, fz + d);
  };
  const single = info.length === 1 ? info[0] : null;
  const lead = single ? single.facing * 0.14 : 0;
  switch (shot.type) {
    case 'establish': case 'extreme-wide': {
      const e = shot.type === 'establish' ? easeIO(k) : 0;
      const d = lerp(BASE_D * 1.55, BASE_D * 1.18, e);
      look.set(cx * 0.3, lerp(1.6, 1.0, e), 0); pos.set(cx * 0.2, lerp(5.6, 2.6, e), d);
      break;
    }
    case 'full': frame(tall * 1.35, span + tall * 0.9, { lead: lead * tall }); break;
    case 'medium': case 'two-shot': frame(Math.max(hr * 9, tall * 0.62), span + hr * 7, { lead: lead * 1.2 }); break;
    case 'medium-close': frame(hr * 6.6, hr * 6.6 * ASPECT * 0.6, { lead: lead * 1.0, high: 0.05, onHead: true }); break;
    case 'close': frame(hr * 4.6, hr * 4.6 * ASPECT * 0.5, { lead: lead * 0.7, high: 0.02, onHead: true }); break;
    case 'extreme-close': frame(hr * 2.8, hr * 2.8, { lead: 0, high: 0, onHead: true }); break;
    case 'over-shoulder': {
      // Behind and just outside the listener's shoulder, looking across at the speaker; the camera stays
      // on the audience side of the line between them (180-degree rule). The listener's head and
      // shoulder frame one edge of the picture.
      const sp = single || info[0];
      const lis = S.chars.find(ch => ch.c.id === shot.over && ch.c.id !== shot.subject[0]);
      if (!lis) { frame(hr * 6.6, hr * 6.6 * ASPECT * 0.6, { lead, high: 0.05 }); break; }
      const L = frameInfo(lis);
      const side = Math.sign(L.x - sp.x) || 1;
      pos.set(L.head.x + side * 0.75, L.head.y + 0.04, L.z + 0.75 + L.hr);
      look.set(sp.head.x + side * 0.45, sp.head.y - sp.hr * 0.9, sp.z);
      break;
    }
    case 'follow': {
      const sp = info[0];
      frame(tall * 1.1, tall * 1.6, { lead: sp.facing * 0.5 });
      break;
    }
    case 'dolly-in': case 'dolly-out': {
      const e = easeIO(k);
      const d = shot.type === 'dolly-in' ? lerp(BASE_D * 1.06, BASE_D * 0.82, e) : lerp(BASE_D * 0.8, BASE_D * 1.08, e);
      look.set(cx * 0.4, 1.0, 0); pos.set(cx * 0.3, 1.55, d);
      break;
    }
    case 'orbit': {
      const a = lerp(-0.42, 0.42, easeIO(k)), d = fitDist(2.6, span + 3);
      look.set(cx, 1.0, 0); pos.set(cx + Math.sin(a) * d, 1.6, Math.cos(a) * d);
      break;
    }
    case 'pan-left': case 'pan-right': {
      const sg = shot.type === 'pan-left' ? -1 : 1, x = lerp(-sg * 1.4, sg * 1.4, easeIO(k));
      look.set(x, 1.0, 0); pos.set(x, 1.5, BASE_D * 0.9);
      break;
    }
    case 'crane-up': case 'crane-down': {
      const e = shot.type === 'crane-up' ? easeIO(k) : 1 - easeIO(k);
      look.set(cx * 0.4, lerp(1.2, 0.6, e), 0); pos.set(cx * 0.3, lerp(0.7, 4.2, e), lerp(BASE_D * 0.85, BASE_D * 1.05, e));
      break;
    }
    default: { // wide
      const d = Math.max(BASE_D, fitDist(3.2, span + 3.5)) * (shot.move === 'push' ? lerp(1.04, 0.9, easeIO(k)) : 1);
      look.set(cx * 0.4, 1.0, 0); pos.set(cx * 0.3, 1.55, d);
    }
  }
  // Cinematic mode: a gentle hand-held float (seeded sines, so it is still a pure function of t).
  if (S.spec.cinematic) {
    const a = 0.012 * (shot.type === 'close' || shot.type === 'extreme-close' ? 0.5 : 1);
    pos.x += a * (Math.sin(t * 1.3) + 0.5 * Math.sin(t * 2.9 + 1));
    pos.y += a * (Math.sin(t * 1.7 + 2) + 0.4 * Math.sin(t * 3.7));
  }
  cam.position.copy(pos); cam.lookAt(look); cam.updateMatrixWorld();
}

function placeCamera(S, t) {
  if (!S.shots) S.shots = planShots(S);
  const shot = S.shots.find(sh => t < sh.end) || S.shots.at(-1);
  const k = clamp((t - shot.start) / Math.max(0.1, shot.end - shot.start));
  solveShot(S, shot, t, k);
  return shot;
}

/** Who each character looks at, as a head turn (pure function of t; blends over 0.35 s at each line change). */
function gazeFor(S, ch, t) {
  const yawAt = (tt) => {
    const line = S.lines.find(l => tt >= l.start - 0.1 && tt < l.end + 0.3);
    const rootY = ch.c.facing === 'left' ? -0.55 : ch.c.facing === 'right' ? 0.55 : 0;
    let target;
    if (!line) target = 0;                                            // narration: towards the camera
    else if (line.who === ch.c.id) {
      const others = S.chars.filter(o => o !== ch);
      const near = others.sort((a, b) => Math.abs(a.x - ch.x) - Math.abs(b.x - ch.x))[0];
      target = near ? Math.sign(near.x - ch.x) * 0.75 : 0;
    } else {
      const sp = S.chars.find(o => o.c.id === line.who);
      target = sp ? Math.sign(sp.x - ch.x) * 0.75 : 0;
    }
    return clamp(target - rootY, -0.55, 0.55) * 0.8;
  };
  const changes = [0, ...S.lines.flatMap(l => [l.start - 0.1, l.end + 0.3])].filter(x => x <= t).sort((a, b) => a - b);
  const since = changes.at(-1) ?? 0;
  const yaw = lerp(yawAt(since - 0.01), yawAt(t), easeIO(clamp((t - since) / 0.35)));
  // Nod when this character starts a line; tilt the head at the end of a question.
  const mine = S.lines.find(l => l.who === ch.c.id && t >= l.start && t < l.end + 0.5);
  let nod = 0, tilt = 0;
  if (mine) {
    const k = (t - mine.start) / 0.45;
    if (k < 1) nod = Math.sin(k * Math.PI) * 0.12;
    if (S.spec.lines[mine.line]?.q) tilt = -0.12 * easeIO(clamp((t - (mine.end - 0.7)) / 0.4)) * (ch.x < 0 ? 1 : -1);
  }
  return { yaw, nod, tilt };
}

function seek(i, ms) {
  const S = scenes[i];
  if (!S) return null;
  const t = ms / 1000;
  S.world.update(t);
  for (const ch of S.chars) {
    const walking = stageCharacter(ch, t);
    const speaking = S.lines.find(l => l.who === ch.c.id && t >= l.start && t < l.end);
    const line = S.lines.find(l => l.who === ch.c.id && t >= l.start && t < l.end + 0.4);
    const mood = (line && S.spec.lines[line.line]?.mood) || ch.c.mood;
    const mouth = speaking && speaking.visemes.length ? mouthAt(speaking.visemes, t) : null;
    if (ch.R.model) poseModel(ch.R, { ...ch.c, walking }, t, ch.seed, !!speaking, gazeFor(S, ch, t));
    else poseCharacter(ch.R, { ...ch.c, walking }, t, ch.seed, !!speaking, mood, mouth, gazeFor(S, ch, t));
  }
  S.scene.updateMatrixWorld(true);
  placeCamera(S, t);
  // Clear colour and depth first: one renderer draws every scene, and leftovers from another scene must not show.
  renderer.setRenderTarget(null);
  renderer.clear(true, true, true);
  effect.render(S.scene, S.camera);
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);   // wait for the GPU
  const heads = {};
  for (const ch of S.chars) {
    v4.copy(headOf(ch)).project(S.camera);
    heads[ch.c.id] = { x: (v4.x + 1) * 50, y: (1 - v4.y) / 2 * H, onScreen: v4.z < 1 && Math.abs(v4.x) <= 1.05 && Math.abs(v4.y) <= 1.05 };
  }
  return heads;
}

// ---------- fast capture: the HTML text layer drawn as a flat overlay on top of the 3D frame ----------
const ovScene = new THREE.Scene();
const ovCam = new THREE.OrthographicCamera(0, W, H, 0, -1, 1);
const ovTex = new THREE.Texture();
ovTex.flipY = false; ovTex.colorSpace = THREE.SRGBColorSpace; ovTex.generateMipmaps = false;
ovTex.minFilter = ovTex.magFilter = THREE.LinearFilter;
const ovMat = new THREE.MeshBasicMaterial({ map: ovTex, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
const ovQuad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), ovMat);
ovQuad.scale.set(W, -H, 1); ovQuad.position.set(W / 2, H / 2, 0); ovQuad.visible = false;
ovScene.add(ovQuad);
const barMeshes = [];
let ovImage = null;
/**
 * Draw the cached text layer (an ImageBitmap with straight alpha) and the progress-bar fills over the
 * 3D frame that seek() just rendered, then encode the canvas as JPEG (base64).
 */
function composite(bitmap, bars, q) {
  if (bitmap !== ovImage) { ovTex.image = bitmap; ovTex.needsUpdate = true; ovImage = bitmap; }
  ovQuad.visible = !!bitmap;
  bars.forEach((b, k) => {
    let m = barMeshes[k];
    if (!m) { m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ depthTest: false, depthWrite: false, toneMapped: false })); ovScene.add(m); barMeshes[k] = m; }
    m.visible = b.w > 0;
    m.material.color.set(b.color);
    m.scale.set(Math.max(1, b.w), b.h, 1);
    m.position.set(b.x + b.w / 2, H - b.y - b.h / 2, 0);
  });
  for (let k = bars.length; k < barMeshes.length; k++) barMeshes[k].visible = false;
  renderer.autoClear = false;
  renderer.render(ovScene, ovCam);
  renderer.autoClear = true;
  return renderer.domElement.toDataURL('image/jpeg', q).slice(23);
}

const info = (() => { const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'unknown'; })();
try {
  window.__world3d = { scenes, THREE };
  const plan = (i) => { const S = scenes[i]; if (!S) return null; if (!S.shots) { seek(i, 0); } return S.shots.map(sh => ({ type: sh.type, start: +sh.start.toFixed(2), end: +sh.end.toFixed(2), subject: sh.subject, reaction: !!sh.reaction })); };
  window.__worldResolve({ seek, plan, composite: LOWRES ? null : composite, renderer: info, scenes: Object.keys(scenes).length });
} catch (e) { window.__worldReject(e); }
