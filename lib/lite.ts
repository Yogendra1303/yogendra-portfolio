/**
 * Phones and small touch screens render a lighter film: fewer particles,
 * fewer ray-march steps, no light-shaft pass. Same story, same shots.
 * Read once on the client (the 3D scene never renders on the server).
 */
export const LITE =
  typeof window !== "undefined" && (window.matchMedia("(pointer: coarse)").matches || window.innerWidth < 768);

/** Scale a particle or segment count for the current device. */
// Parity: phones get the full film; resolution steps down instead if needed.
export const lite = (n: number, k?: number) => (void k, n);
