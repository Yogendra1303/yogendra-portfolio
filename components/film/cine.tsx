"use client";
/**
 * Film-grammar primitives for the words on screen, all scrubbed by scroll so
 * they play forwards and backwards with the camera.
 * - Decode: a title resolves out of noise, letter by letter (chaos into order).
 * - Count: a number counts up to its value; change is shown, not written.
 * - Brackets: camera-reticle corners that frame a close-up.
 * Randomness is a deterministic hash, so every visit resolves the same way.
 */
import { motion, useMotionValueEvent, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef } from "react";

export const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
export const ease = (x: number) => 1 - Math.pow(1 - clamp01(x), 3);

// Only glyphs every face on screen has, so scrambled words keep their width.
const GLYPHS = "ABCDEFGHJKLMNOPRSTUVXYZ0123456789#/+=";
function hash(n: number) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * Text that resolves from scrambled glyphs once the scroll reaches `a`. The
 * resolve is timed (about 0.4 s), not scrubbed, so it never freezes half-done
 * when the scroll stops; scrolling back does not re-scramble it. `center`
 * settles letters from the middle outward; `seed` changes the noise (so a
 * ghost copy scrambles differently). Same on phones and desktop.
 */
const DECODE_MS = 420;
export function Decode({ p, a, text, reduced, center, seed = 0 }: { p: MotionValue<number>; a: number; b?: number; text: string; reduced?: boolean; center?: boolean; seed?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const st = useRef({ started: false, raf: 0 });
  const paint = (r: number, tick: number) => {
    const el = ref.current;
    if (!el) return;
    if (r >= 1) {
      if (el.textContent !== text) el.textContent = text;
      return;
    }
    const mid = (text.length - 1) / 2;
    let out = "";
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      // Letters settle left to right (or centre outward), with a little jitter so it feels organic.
      const settle = center ? (Math.abs(i - mid) / Math.max(1, mid) + hash(i + seed) * 0.35) / 1.35 : (i + hash(i + seed) * 3) / (text.length + 3);
      if (ch === " " || r > settle) out += ch;
      else out += GLYPHS[Math.floor(hash(i * 7.13 + tick + seed * 31.7) * GLYPHS.length)];
    }
    el.textContent = out;
  };
  const draw = (v: number) => {
    const S = st.current;
    const instant = !!reduced;
    if (v < a) {
      // Before the cue: ready to resolve again (it is faded out here anyway).
      if (S.started) {
        S.started = false;
        cancelAnimationFrame(S.raf);
      }
      paint(instant ? 1 : 0, 0);
      return;
    }
    if (S.started) return;
    S.started = true;
    if (instant) return paint(1, 0);
    const t0 = performance.now();
    const step = (now: number) => {
      const r = (now - t0) / DECODE_MS;
      paint(r, Math.floor(now / 45));
      if (r < 1 && S.started) S.raf = requestAnimationFrame(step);
    };
    S.raf = requestAnimationFrame(step);
  };
  useMotionValueEvent(p, "change", draw);
  useEffect(() => {
    draw(p.get());
    const S = st.current;
    return () => {
      cancelAnimationFrame(S.raf);
      S.started = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <span ref={ref} aria-hidden>{text}</span>;
}

const fmt = new Intl.NumberFormat("en-US");

/** A number that counts from `from` to `to` across [a, b] of progress. */
export function Count({ p, a, b, from = 0, to, decimals = 0, reduced }: { p: MotionValue<number>; a: number; b: number; from?: number; to: number; decimals?: number; reduced?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const final = decimals ? to.toFixed(decimals) : fmt.format(to);
  const draw = (v: number) => {
    const el = ref.current;
    if (!el) return;
    const r = reduced ? 1 : ease((v - a) / Math.max(1e-4, b - a));
    const n = from + (to - from) * r;
    el.textContent = decimals ? n.toFixed(decimals) : fmt.format(Math.round(n));
  };
  useMotionValueEvent(p, "change", draw);
  useEffect(() => draw(p.get()));
  return <span ref={ref} aria-hidden>{final}</span>;
}

/** Piecewise-linear map of v through input to output stops, clamped at the ends. */
export function interp(v: number, input: number[], output: number[]) {
  if (v <= input[0]) return output[0];
  for (let k = 1; k < input.length; k++) {
    if (v <= input[k]) {
      const t = (v - input[k - 1]) / Math.max(1e-9, input[k] - input[k - 1]);
      return output[k - 1] + (output[k] - output[k - 1]) * t;
    }
  }
  return output[output.length - 1];
}

/**
 * A scroll-mapped motion value computed in JavaScript. Motion would otherwise
 * hand plain scroll-to-opacity mappings to a native ViewTimeline, which
 * mis-measures these tall sticky sections (things fade out when they should
 * hold).
 */
export function useMap(p: MotionValue<number>, input: number[], output: number[]) {
  return useTransform(p, (v) => interp(v, input, output));
}
/** Same, as a CSS length (e.g. "em") for transforms. */
export function useMapLen(p: MotionValue<number>, input: number[], output: number[], unit: string) {
  return useTransform(p, (v) => `${interp(v, input, output)}${unit}`);
}

/**
 * Opacity for a shot that lives in [a, b], with soft cuts in and out.
 * `fade` is the share of the window spent fading in (and again out).
 */
export function useShot(p: MotionValue<number>, a: number, b: number, hold = false, fade = 0.16) {
  const w = b - a;
  const i1 = a + w * fade;
  const o0 = b - w * fade;
  const opacity = useTransform(p, (v) => {
    if (v <= a || (!hold && v >= b)) return 0;
    if (v < i1) return (v - a) / (i1 - a);
    if (!hold && v > o0) return (b - v) / (b - o0);
    return 1;
  });
  const visibility = useTransform(opacity, (o): string => (o < 0.01 ? "hidden" : "visible"));
  /** Progress inside the shot, 0..1. */
  const local = useTransform(p, (v) => clamp01((v - a) / w));
  return { opacity, visibility, local };
}

/** Camera-reticle corners around a close-up. */
export function Brackets({ color }: { color: string }) {
  const c = "absolute h-5 w-5 border-current";
  return (
    <span aria-hidden className="pointer-events-none absolute -inset-x-3 -inset-y-4 sm:-inset-x-6 sm:-inset-y-5 opacity-60" style={{ color }}>
      <span className={`${c} start-0 top-0 border-s border-t`} />
      <span className={`${c} end-0 top-0 border-e border-t`} />
      <span className={`${c} bottom-0 start-0 border-b border-s`} />
      <span className={`${c} bottom-0 end-0 border-b border-e`} />
    </span>
  );
}

/**
 * A word that decodes out of noise with a ghost of itself: a second copy in
 * the chapter colour, scrambling out of step and sliding into register, like
 * a timeline that has not quite collapsed into one. The ghost is gone once
 * the word has resolved. Plain text under reduced motion.
 */
export function Ghosted({ p, a, b, text, reduced, color, center }: { p: MotionValue<number>; a: number; b: number; text: string; reduced: boolean; color: string; center?: boolean }) {
  const span = b - a;
  const opacity = useMap(p, [a, a + span * 0.5, b + span * 0.5], [0.7, 0.45, 0]);
  const x = useMapLen(p, [a, b + span * 0.3], [-0.09, 0], "em");
  const y = useMapLen(p, [a, b + span * 0.3], [0.05, 0], "em");
  return (
    <span className="relative inline-block whitespace-nowrap">
      <Decode p={p} a={a} b={b} text={text} reduced={reduced} center={center} />
      {!reduced && (
        <motion.span aria-hidden className="pointer-events-none absolute inset-0 sm:mix-blend-screen" style={{ opacity, x, y, color }}>
          <Decode p={p} a={a + span * 0.12} b={b + span * 0.3} text={text} center={center} seed={7} />
        </motion.span>
      )}
    </span>
  );
}

/** A second, offset copy of a line in the chapter colour that fades as the line lands. */
export function Echo({ p, a, b, children, color, reduced }: { p: MotionValue<number>; a: number; b: number; children: React.ReactNode; color: string; reduced: boolean }) {
  const w = b - a;
  const opacity = useMap(p, [a, a + w * 0.12, a + w * 0.4], [0, 0.6, 0]);
  const x = useMapLen(p, [a, a + w * 0.4], [-0.35, 0], "em");
  if (reduced) return null;
  return (
    <motion.span aria-hidden className="pointer-events-none absolute inset-0 sm:mix-blend-screen" style={{ opacity, x, color }}>
      {children}
    </motion.span>
  );
}
