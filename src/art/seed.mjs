// Seeded random numbers, shared by the variety and look modules.
/** A small seeded random generator (mulberry32 on a string hash). */
export function seeded(text) {
  let h = 2166136261 >>> 0;
  for (const c of String(text || 'video')) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (h + 0x6d2b79f5) >>> 0;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
