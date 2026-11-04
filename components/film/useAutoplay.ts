"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type Lenis from "lenis";
import { sequencePosition } from "@/lib/playback";

export type PlaybackState = "idle" | "playing" | "paused" | "complete";

export function useAutoplay(lenis: RefObject<Lenis | null>) {
  const [state, setState] = useState<PlaybackState>("idle");
  const [opening, setOpening] = useState(true);
  const [reduced, setReduced] = useState(false);
  const raf = useRef(0);
  const playing = useRef(false);

  const cancel = useCallback(() => {
    cancelAnimationFrame(raf.current);
    raf.current = 0;
    if (!playing.current) return;
    playing.current = false;
    // Discard Lenis' pending target without preventing the user's wheel event.
    lenis.current?.scrollTo(window.scrollY, { immediate: true });
    setState("paused");
  }, [lenis]);

  const play = useCallback(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    cancelAnimationFrame(raf.current);
    const limit = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    if (limit <= 0) { setState("complete"); return; }
    const from = Math.min(1, window.scrollY / limit);
    if (from >= 0.9999) { setState("complete"); return; }
    const started = performance.now();
    playing.current = true;
    setState("playing");
    const tick = (now: number) => {
      if (!playing.current) return;
      const fraction = sequencePosition(from, (now - started) / 1000);
      // Re-read the limit for resize, font load, and the post-contact index.
      const bottom = Math.max(0, document.documentElement.scrollHeight - innerHeight);
      const y = fraction * bottom;
      if (lenis.current) lenis.current.scrollTo(y, { immediate: true });
      else window.scrollTo({ top: y, behavior: "instant" });
      if (fraction >= 1) {
        playing.current = false;
        raf.current = 0;
        setState("complete");
      } else raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, [lenis]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => { setReduced(mq.matches); if (mq.matches) cancel(); };
    const scroll = () => setOpening(window.scrollY < 80);
    const key = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (["Escape", "ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End", " "].includes(event.key)) cancel();
    };
    const pointer = (event: PointerEvent) => {
      // Native scrollbar dragging should also hand control back immediately.
      if (event.clientX >= document.documentElement.clientWidth) cancel();
    };
    const visibility = () => { if (document.hidden) cancel(); };
    motion(); scroll();
    window.addEventListener("wheel", cancel, { passive: true, capture: true });
    window.addEventListener("touchstart", cancel, { passive: true, capture: true });
    window.addEventListener("keydown", key, true);
    window.addEventListener("pointerdown", pointer, true);
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", cancel);
    document.addEventListener("visibilitychange", visibility);
    mq.addEventListener("change", motion);
    return () => {
      playing.current = false;
      cancelAnimationFrame(raf.current);
      window.removeEventListener("wheel", cancel, true);
      window.removeEventListener("touchstart", cancel, true);
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("pointerdown", pointer, true);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", cancel);
      document.removeEventListener("visibilitychange", visibility);
      mq.removeEventListener("change", motion);
    };
  }, [cancel]);

  return { state, play, cancel, opening, reduced };
}
