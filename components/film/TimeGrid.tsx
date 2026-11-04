"use client";
/**
 * The end of the film: the tesseract. Having survived the journey, the
 * visitor stands outside time, in a corridor where every chapter hangs as a
 * room. Concept: past, present and future all present at once, and time as
 * something you can move through by hand. Reference: a navigable tesseract,
 * and a time-keeper's slider that pulls a whole timeline toward you.
 * - Scroll over it, drag across the corridor, pick a name on the time rail
 *   (right), or use the arrow keys to travel; the chosen moment comes
 *   forward; select it to enter that chapter.
 * - The WebGL lattice around the camera slides with you (film.scrub).
 * - Every moment is a real button, in order, so it works without the 3D.
 */
import { motion, useMotionValueEvent, useSpring, useTransform, type MotionValue } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { chapters } from "@/content/story";
import { film } from "@/lib/film";
import { scoreTick } from "@/lib/score";

const MOMENTS = chapters.slice(1, chapters.length - 1);
const N = MOMENTS.length;

function Moment({ k, pos, radius, onEnter, active }: { k: number; pos: MotionValue<number>; radius: number; onEnter: () => void; active: boolean }) {
  const m = MOMENTS[k];
  const angle = k * 1.15 + 0.5;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius * 0.55;
  const transform = useTransform(pos, (v) => `translate3d(${x}px, ${y}px, ${(v - k) * 330}px)`);
  const frame = useTransform(pos, (v) => `translate3d(0px, 0px, ${(v - k) * 330}px)`);
  // The moment you are on is bright; the future fades into the depth; the
  // past slips away quickly behind you instead of looming at the lens.
  const opacity = useTransform(pos, (v) => {
    const d = k - v;
    return d < -0.15 ? Math.max(0, 1 + (d + 0.15) * 4) : Math.max(0.07, 1 - d * 0.4);
  });
  // Moments that have passed behind you are gone: no ghost clicks.
  const visibility = useTransform(opacity, (o): string => (o < 0.04 ? "hidden" : "visible"));
  return (
    <>
      {/* The room: a cube frame at this moment's depth. */}
      <motion.div aria-hidden style={{ transform: frame, opacity }} className="pointer-events-none absolute left-1/2 top-1/2 -ml-[min(38vw,300px)] -mt-[min(14vh,120px)] h-[min(28vh,240px)] w-[min(76vw,600px)] border border-white/10" />
      <motion.div style={{ transform, opacity, visibility, zIndex: active ? 10 : 1 }} className="absolute left-1/2 top-1/2 -ml-[min(30vw,150px)] -mt-9 w-[min(60vw,300px)]">
        <button
          type="button"
          onClick={onEnter}
          className={`group pointer-events-auto relative w-full px-4 py-3 text-start transition focus-visible:outline-none ${active ? "bg-white/[0.04]" : ""}`}
          style={{ boxShadow: active ? `0 0 0 1px ${m.color}66, 0 0 40px ${m.color}22` : "0 0 0 1px rgba(255,255,255,0.08)" }}
        >
          <span className="block font-mono text-[10px] tracking-[0.35em]" style={{ color: m.color }}>
            {m.index} · {m.when}
          </span>
          <span className="mt-1 block font-display text-[clamp(0.85rem,1.6vw,1.1rem)] uppercase tracking-[0.3em] text-white/85 group-hover:text-white group-focus-visible:text-white">{m.title}</span>
          <span className={`mt-1 block font-mono text-[9px] uppercase tracking-[0.35em] text-white/45 transition ${active ? "opacity-100" : "opacity-0"}`}>Enter this moment</span>
        </button>
      </motion.div>
    </>
  );
}

export function TimeGrid({ onJump, live }: { onJump: (id: string) => void; live: boolean }) {
  const [sel, setSel] = useState(0);
  const pos = useSpring(0, { stiffness: 70, damping: 18 });
  const rx = useSpring(0, { stiffness: 60, damping: 16 });
  const ry = useSpring(0, { stiffness: 60, damping: 16 });
  const [radius, setRadius] = useState(220);
  const [near, setNear] = useState(0);
  const drag = useRef<{ x: number; s: number; id: number; on: boolean } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const selRef = useRef(0);
  selRef.current = sel;
  // Scrolling over the tesseract travels through time instead of the page
  // (until you scroll back past the first moment).
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let idle = 0;
    const wheel = (e: WheelEvent) => {
      const next = selRef.current + e.deltaY / 260;
      if (next < -0.05 && e.deltaY < 0) return; // let the page scroll back up
      e.preventDefault();
      e.stopPropagation();
      setSel(Math.min(N - 1, Math.max(0, next)));
      window.clearTimeout(idle);
      idle = window.setTimeout(() => setSel((v) => Math.round(v)), 180);
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", wheel);
      window.clearTimeout(idle);
    };
  }, []);

  useEffect(() => {
    const r = () => setRadius(Math.min(230, window.innerWidth * 0.26));
    r();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, []);
  useEffect(() => {
    pos.set(sel);
  }, [sel, pos]);
  // The WebGL lattice travels with the scrub; a soft tick marks each moment passed.
  useMotionValueEvent(pos, "change", (v) => {
    film.scrub = v / (N - 1);
    const n = Math.round(v);
    if (n !== near) {
      setNear(n);
      scoreTick();
    }
  });
  useEffect(() => () => void (film.scrub = 0), []);

  const clampSel = (v: number) => Math.min(N - 1, Math.max(0, v));
  const m = MOMENTS[near];

  const step = (d: number) => setSel((v) => clampSel(Math.round(v) + d));
  return (
    <div ref={root} data-lenis-prevent className={`w-full max-w-6xl ${live ? "pointer-events-auto" : "pointer-events-none"}`}>
      <p className="text-center font-mono text-[10px] uppercase tracking-[0.55em] text-white/55">
        Enter any moment<span className="hidden sm:inline"> · scroll or drag through time</span>
      </p>
      <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div
          className="relative hidden h-[36vh] flex-1 cursor-grab touch-pan-y select-none active:cursor-grabbing sm:block [perspective:900px]"
          onPointerDown={(e) => {
            // A press only becomes a drag once it moves, so moments stay clickable.
            drag.current = { x: e.clientX, s: pos.get(), id: e.pointerId, on: false };
          }}
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            if (!film.reduced) {
              ry.set(((e.clientX - r.left) / r.width - 0.5) * 16);
              rx.set(-((e.clientY - r.top) / r.height - 0.5) * 10);
            }
            const d = drag.current;
            if (d) {
              if (!d.on && Math.abs(e.clientX - d.x) > 6) {
                d.on = true;
                (e.currentTarget as HTMLElement).setPointerCapture(d.id);
              }
              if (d.on) setSel(clampSel(d.s - (e.clientX - d.x) / 140));
            }
          }}
          onPointerUp={() => {
            if (drag.current?.on) setSel((v) => Math.round(v));
            drag.current = null;
          }}
          onPointerLeave={() => {
            rx.set(0);
            ry.set(0);
          }}
        >
          <motion.div style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }} className="absolute inset-0">
            {/* The time axis itself, running away from you. */}
            <div aria-hidden className="absolute left-1/2 top-1/2 h-px w-[2400px] -translate-x-1/2 [transform:rotateY(90deg)] bg-[linear-gradient(90deg,transparent,rgba(124,255,196,0.5),transparent)]" />
            {MOMENTS.map((mm, k) => (
              <Moment key={mm.id} k={k} pos={pos} radius={radius} active={k === near} onEnter={() => onJump(mm.id)} />
            ))}
          </motion.div>
        </div>
        {/* The time rail: every moment by name; the marker tracks where you are. */}
        <nav
          aria-label="Time: choose a moment"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
            else if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
            else return;
            e.preventDefault();
          }}
          className="relative mx-auto flex w-full max-w-sm flex-col px-1 sm:w-[21rem] sm:max-w-none sm:flex-none sm:border-s sm:border-white/10 sm:ps-5"
        >
          {MOMENTS.map((mm, k) => (
            <button
              key={mm.id}
              type="button"
              onClick={() => onJump(mm.id)}
              onPointerEnter={() => setSel(k)}
              onFocus={() => setSel(k)}
              aria-current={k === near ? "true" : undefined}
              aria-label={`Go to ${mm.index}: ${mm.title}, ${mm.when}`}
              className="pointer-events-auto flex items-baseline gap-3 border-t border-white/10 py-2.5 text-start transition focus-visible:outline-none sm:border-0 sm:py-1.5"
            >
              <span className="font-mono text-[10px] tracking-[0.3em]" style={{ color: k === near ? mm.color : "rgba(255,255,255,0.35)" }}>{mm.index}</span>
              <span className={`whitespace-nowrap font-display text-[11px] uppercase tracking-[0.2em] transition ${k === near ? "text-white" : "text-white/40 hover:text-white/80"}`}>{mm.title}</span>
              <span className="ms-auto whitespace-nowrap font-mono text-[9px] tracking-[0.2em] text-white/30">{mm.when}</span>
            </button>
          ))}
          <motion.span aria-hidden className="absolute -start-px hidden w-px bg-[var(--signal)] shadow-[0_0_8px_var(--signal)] sm:block" style={{ top: useTransform(pos, (v) => `${(v / N) * 100}%`), height: `${100 / N}%` }} />
        </nav>
      </div>
    </div>
  );
}
