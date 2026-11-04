"use client";
/**
 * Worldlines: the whole career as one continuous shot.
 * Scrolling moves a camera through space; each chapter is a world.
 */
import { Canvas } from "@react-three/fiber";
import Lenis from "lenis";
import { Suspense, useCallback, useEffect, useRef } from "react";
import * as THREE from "three";
import { chapters } from "@/content/story";
import { film, remap } from "@/lib/film";
import { sections } from "@/lib/plan";
import { CITIES, EARTH_1, EARTH_2, EARTH_RADIUS } from "@/lib/stage";
import { Backdrop } from "./Backdrop";
import { Chapters } from "./Chapters";
import { Director } from "./Director";
import { Effects } from "./Effects";
import { Hud } from "./Hud";
import { Fragments, Warp } from "./Warp";
import { Lattice } from "./worlds/Lattice";
import { Dust } from "./worlds/Dust";
import { useAutoplay } from "./useAutoplay";
import { BlackHole } from "./worlds/BlackHole";
import { CareerLine } from "./worlds/CareerLine";
import { Destination } from "./worlds/Destination";
import { Earth } from "./worlds/Earth";
import { ExpectedPath } from "./worlds/ExpectedPath";
import { Network } from "./worlds/Network";
import { Orbits } from "./worlds/Orbits";
import { Science } from "./worlds/Science";
import { Tesseract } from "./worlds/Tesseract";
import { Wormhole } from "./worlds/Wormhole";

const { gurugram, bengaluru, dubai, usa } = CITIES;

/** World time (see film.remap) at which shot k of chapter i starts. */
function cue(i: number, match: (s: (typeof chapters)[number]["shots"][number]) => boolean, offset = 0) {
  const k = Math.max(0, chapters[i].shots.findIndex(match));
  return remap(i, sections[i].shots[k].a) + offset;
}
// Arcs draw when the story reaches them: Bengaluru on "Day zero", Dubai and the USA on their close-ups.
const BLR = cue(3, (s) => s.kind === "slate" && s.title === "Day zero");
const DXB = cue(6, (s) => s.kind === "word" && s.text === "Dubai");
const US = cue(6, (s) => s.kind === "word" && s.text === "USA");

export default function Film() {
  const lenis = useRef<Lenis | null>(null);
  const player = useAutoplay(lenis);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    film.reduced = mq.matches;
    if (!film.reduced) {
      // Light, quick smoothing: the camera supplies the weight (a spring in the
      // Director), so the page itself should answer the wheel at once.
      lenis.current = new Lenis({ lerp: 0.11, smoothWheel: true, wheelMultiplier: 1.2, touchMultiplier: 1.5, autoRaf: true });
    }
    // QA helper: ?chapter=5 starts on chapter 5.
    const q = new URLSearchParams(window.location.search);
    const start = q.get("chapter");
    if (start) {
      const el = document.querySelectorAll<HTMLElement>("[data-chapter]")[Number(start)];
      const f = Number(q.get("f") ?? 0.3);
      if (el) {
        window.scrollTo(0, el.offsetTop + (el.offsetHeight - window.innerHeight) * f);
        film.snap = true;
      }
    }
    return () => lenis.current?.destroy();
  }, []);

  const jump = useCallback((id: string) => {
    const el = document.getElementById(`chapter-${id}`);
    if (!el) return;
    const i = chapters.findIndex((c) => c.id === id);
    // Land on the chapter's title card (or straight on contact for the finale).
    const span = el.offsetHeight - window.innerHeight;
    const w = sections[i].shots[0];
    const at = i === 0 ? 0 : i === chapters.length - 1 ? 0.86 : w.a + (w.b - w.a) * 0.5;
    const y = el.offsetTop + span * at;
    if (lenis.current) lenis.current.scrollTo(y, { duration: 2.6 });
    else window.scrollTo({ top: y });
  }, []);

  return (
    <>
      <div className="fixed inset-0 z-0 bg-black" aria-hidden>
        <Canvas
          dpr={[1, 1.75]}
          camera={{ position: [6.5, 2.2, 34], fov: 48, near: 0.05, far: 4000 }}
          gl={{ antialias: false, powerPreference: "high-performance", toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <color attach="background" args={["#000000"]} />
          <Suspense fallback={null}>
            <Director />
            <Backdrop />
            <Warp />
            <Dust />
            <Fragments />
            <Destination />
            <ExpectedPath />
            <Science />
            <BlackHole />
            <Wormhole />
            <CareerLine />
            <Earth
              position={EARTH_1}
              radius={EARTH_RADIUS}
              chapter={3}
              focus={{ lat: 21, lon: 77 }}
              cities={[gurugram, bengaluru]}
              arcs={[{ from: gurugram, to: bengaluru, start: BLR, end: BLR + 0.06, color: "#2bff88" }]}
            />
            <Network />
            <Lattice />
            <Orbits />
            <Earth
              position={EARTH_2}
              radius={EARTH_RADIUS}
              chapter={6}
              focus={{ lat: 27, lon: 66 }}
              cities={[gurugram, dubai]}
              color="#ff8a5c"
              arcs={[
                { from: gurugram, to: dubai, start: DXB, end: DXB + 0.04, color: "#ffb35c" },
                { from: dubai, to: gurugram, start: DXB + 0.04, end: DXB + 0.08, color: "#ffb35c" },
                { from: gurugram, to: usa, start: US, end: US + 0.05, color: "#ff8a5c" },
              ]}
            />
            <Tesseract />
            <Effects />
          </Suspense>
        </Canvas>
      </div>
      <Chapters onJump={jump} />
      <Hud player={player} />
      <div className="film-grain" aria-hidden />
    </>
  );
}
