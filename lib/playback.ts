/**
 * Play the film: the page scrolls itself at a constant pace from wherever the
 * viewer is to the end. About three minutes for the whole arc: no shot holds
 * longer than two or three seconds. Any wheel, touch or key hands control back.
 */
export const SEQUENCE_SECONDS = 190;
export const clamp01 = (x: number) => (Number.isFinite(x) ? Math.min(1, Math.max(0, x)) : 0);

/** Constant document-space velocity; resume uses only the remaining duration. */
export function sequencePosition(from: number, elapsedSeconds: number) {
  const start = clamp01(from);
  return Math.min(1, start + Math.max(0, elapsedSeconds) / SEQUENCE_SECONDS);
}
