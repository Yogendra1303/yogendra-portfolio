/** Small, deterministic helpers shared by the scene. No Math.random in visuals. */

/** Mulberry32 seeded PRNG: same seed, same "chaos" on every visit. */
export function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * Sideways shake of the timeline at position u (0 at A, 1 at B).
 * Pinned at both ends, like a plucked string. Must match the GLSL in WebLine.
 */
export function tremorOffset(u: number, time: number, amp: number, out: [number, number]) {
  const env = Math.sin(Math.PI * u);
  const y =
    Math.sin(u * 23.0 + time * 31.0) * 0.55 +
    Math.sin(u * 7.0 - time * 13.0) * 0.35 +
    Math.sin(u * 61.0 + time * 57.0) * 0.1;
  const z = Math.cos(u * 19.0 - time * 27.0) * 0.5 + Math.sin(u * 5.0 + time * 9.0) * 0.5;
  out[0] = y * env * amp;
  out[1] = z * env * amp;
  return out;
}
