/**
 * One clock. The camera's frame loop (Director, priority -2) advances the
 * smooth scroll, so the camera always reads this frame's scroll position.
 * Film.tsx keeps a fallback loop that only runs if the 3D frame loop is not
 * ticking (no WebGL, tab just restored), so the page can always scroll.
 */
import type Lenis from "lenis";

export const scroll: { lenis: Lenis | null; drivenAt: number } = { lenis: null, drivenAt: -1 };
