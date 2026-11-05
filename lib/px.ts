/**
 * One scale for every particle. gl_PointSize is in device pixels, so without
 * this, points change apparent size between phones and laptops, and again
 * whenever the render resolution steps. Points are tuned for a 900 px tall
 * frame at pixel ratio 1.75; `PX.value` rescales them to the real frame
 * (updated each frame in Director). Points never drop below 1 px, where
 * they would twinkle.
 */
export const PX = { value: 1 };
export const PX_BASE = 1.75 * 900;

/** Adds the shared scale to a vertex shader's gl_PointSize. */
export function withPx(vert: string) {
  return "uniform float uPx;\n" + vert.replace(/gl_PointSize = ([^;]+);/, "gl_PointSize = max(1.0, ($1) * uPx);");
}
