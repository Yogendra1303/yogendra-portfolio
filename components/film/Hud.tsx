"use client";
/**
 * The frame around the film. Typography is the only interface: name, chapter
 * counter, real coordinates, letterbox bars that close in with speed and
 * pressure, a Play control (the film scrolls itself), the sound switch, and
 * two clocks. `t` is the viewer's time; `τ` is the story's own time. Near the
 * black hole and in a crisis τ falls behind; inside the tesseract it stops.
 *
 * The year card: while the camera travels between dated chapters the year
 * rolls, glitching through each change. Through the wormhole it counts
 * 2014, 2015, 2016 inside the tunnel and lands on 2017 as you come out.
 *
 * Gravity on the words: during a crisis an SVG displacement filter bends the
 * text frame around the same unseen mass that bends the light in WebGL.
 */
import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { chapters, owner } from "@/content/story";
import { CUTS, film } from "@/lib/film";
import { startScore, stopScore, updateScore } from "@/lib/score";
import type { PlaybackState } from "./useAutoplay";

const pad = (n: number) => String(n).padStart(2, "0");
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** HH:MM:SS:FF at 24 frames per second. */
function timecode(sec: number) {
  const f = Math.floor(sec * 24) % 24;
  const s = Math.floor(sec) % 60;
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(f)}`;
}
const DIGITS = "0123456789";
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** A lens-shaped displacement map: light (and words) pulled in toward the centre and twisted. */
function lensMap() {
  const N = 256;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const img = g.createImageData(N, N);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      const dx = (x / (N - 1)) * 2 - 1;
      const dy = (y / (N - 1)) * 2 - 1;
      const r = Math.hypot(dx, dy);
      const fall = Math.exp(-Math.pow(r / 0.62, 2));
      const vx = -dx * fall * 0.9 - dy * fall * 0.35;
      const vy = -dy * fall * 0.9 + dx * fall * 0.35;
      const i = (y * N + x) * 4;
      img.data[i] = 128 + vx * 127;
      img.data[i + 1] = 128 + vy * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  return c.toDataURL();
}

type Player = { state: PlaybackState; play: () => void; cancel: () => void };

export function Hud({ player }: { player: Player }) {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const year = useRef<HTMLDivElement>(null);
  const yearNum = useRef<HTMLParagraphElement>(null);
  const yearNext = useRef<HTMLParagraphElement>(null);
  const wall = useRef<HTMLSpanElement>(null);
  const proper = useRef<HTMLSpanElement>(null);
  const ratio = useRef<HTMLParagraphElement>(null);
  const warpImg = useRef<SVGFEImageElement>(null);
  const warp = useRef<SVGFEDisplacementMapElement>(null);
  const [current, setCurrent] = useState(0);
  const [sound, setSound] = useState(false);

  useEffect(() => {
    warpImg.current?.setAttribute("href", lensMap());
    let raf = 0;
    let last = -1;
    let shownYear = 0;
    let glitchUntil = 0;
    let warping = false;
    const loop = (now: number) => {
      // Letterbox: always a hint of 2.39:1, closing in further with speed and pressure.
      const bar = Math.min(12, 4 + film.speed * 22 + film.presence(0) * 3 + film.crisis * 3);
      if (top.current) top.current.style.height = `${bar}vh`;
      if (bottom.current) bottom.current.style.height = `${bar}vh`;

      // The year card.
      const i = Math.floor(film.u);
      const f = film.u - i;
      const from = chapters[i]?.rollFrom ?? chapters[i]?.year;
      const to = chapters[i + 1]?.year;
      let on = 0;
      let prog = 0;
      if (from && to && f > 0.005) {
        if (i === 2) {
          // The fall reads 2014; the tunnel counts the years; 2017 on the way out.
          const t0 = CUTS[0].to - 2;
          prog = clamp01((f - t0) / (0.84 - t0));
          on = Math.min(1, f / 0.04, (1 - f) / 0.08);
        } else {
          prog = f * f * (3 - 2 * f);
          on = Math.pow(Math.sin(Math.PI * f), 0.6);
        }
      }
      if (year.current) year.current.style.opacity = String(on * 0.9);
      if (on > 0 && yearNum.current && yearNext.current) {
        const yr = Math.round(from! + (to! - from!) * prog);
        if (yr !== shownYear) {
          shownYear = yr;
          glitchUntil = now + 170;
        }
        if (now < glitchUntil && !film.reduced) {
          const k = Math.floor(now / 40);
          yearNum.current.textContent = [0, 1, 2, 3].map((d) => (hash(k * 4 + d) < 0.5 ? String(yr)[d] : DIGITS[Math.floor(hash(k * 7 + d) * 10)])).join("");
        } else yearNum.current.textContent = String(yr);
        yearNext.current.textContent = `${chapters[i + 1].index} · ${chapters[i + 1].title}`;
      }

      const c = Math.round(film.u);
      if (c !== last) {
        last = c;
        setCurrent(c);
      }
      // Two clocks: frames at 24 per second.
      if (wall.current) wall.current.textContent = timecode(film.clock);
      if (proper.current) proper.current.textContent = timecode(film.time);
      if (ratio.current) {
        const slow = film.dilation < 0.97;
        ratio.current.style.opacity = slow ? "1" : "0";
        if (slow) ratio.current.textContent = film.dilation < 0.005 ? "Time stopped" : `Time × ${film.dilation.toFixed(2)}`;
      }
      // Gravity on the words, only while the camera is cut in on a crisis.
      const s = film.reduced ? 0 : film.crisis * film.close;
      if (s > 0.02 !== warping) {
        warping = s > 0.02;
        document.documentElement.classList.toggle("warp", warping);
      }
      if (warping) warp.current?.setAttribute("scale", (s * 0.07).toFixed(4));
      updateScore();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      document.documentElement.classList.remove("warp");
      stopScore();
    };
  }, []);

  // The score starts with the first click or key anywhere (browsers allow
  // sound only after a gesture) and then plays continuously; Sound turns it off.
  useEffect(() => {
    const first = () => {
      setSound((on) => {
        if (!on) startScore();
        return true;
      });
      window.removeEventListener("pointerdown", first, true);
      window.removeEventListener("keydown", first, true);
    };
    window.addEventListener("pointerdown", first, true);
    window.addEventListener("keydown", first, true);
    return () => {
      window.removeEventListener("pointerdown", first, true);
      window.removeEventListener("keydown", first, true);
    };
  }, []);

  const c = chapters[current];
  const toggle = () => {
    if (sound) stopScore();
    else startScore();
    setSound(!sound);
  };
  const playing = player.state === "playing";
  const onPlay = () => {
    if (playing) {
      player.cancel();
      return;
    }
    // Playing the film plays it with its score.
    if (!sound) {
      startScore();
      setSound(true);
    }
    player.play();
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20">
      <svg aria-hidden className="absolute h-0 w-0">
        <filter id="gravity-warp" x="0" y="0" width="1" height="1" primitiveUnits="objectBoundingBox" colorInterpolationFilters="sRGB">
          <feImage ref={warpImg} x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map" />
          <feDisplacementMap ref={warp} in="SourceGraphic" in2="map" scale="0" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div ref={top} className="absolute inset-x-0 top-0 bg-black transition-[height] duration-300 ease-out" style={{ height: "4vh" }} />
      <div ref={bottom} className="absolute inset-x-0 bottom-0 bg-black transition-[height] duration-300 ease-out" style={{ height: "4vh" }} />

      <div ref={year} className="absolute inset-0 flex flex-col items-center justify-center opacity-0" aria-hidden>
        <p ref={yearNum} className="ps-[0.4em] font-display text-[clamp(3.4rem,13vw,10.5rem)] font-normal leading-none tracking-[0.4em] text-white/80 tabular-nums [text-shadow:0_0_40px_rgba(255,255,255,0.3)]" />
        <p ref={yearNext} className="mt-6 ps-[0.55em] font-mono text-[11px] uppercase tracking-[0.55em] text-white/80 [text-shadow:0_0_12px_rgba(0,0,0,0.9)]" />
      </div>

      <div className="absolute left-5 top-5 hidden sm:left-8 sm:top-7 sm:block">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-white/85 sm:text-[11px] sm:tracking-[0.35em]">{owner.name}</p>
      </div>
      <div className="absolute right-5 top-5 flex flex-col items-end text-right sm:right-8 sm:top-7">
        <button
          type="button"
          onClick={onPlay}
          aria-pressed={playing}
          className="pointer-events-auto inline-flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.4em] text-white/80 transition hover:text-white focus-visible:text-white focus-visible:outline-none"
        >
          {playing ? <Pause className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
          {playing ? "Pause" : player.state === "complete" ? "Play again" : "Play the film"}
        </button>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
          <span className="text-white/90">{c.index}</span> / {chapters[chapters.length - 1].index}
          {current > 0 && <span className="hidden sm:inline"> · {c.title}</span>}
        </p>
        <div aria-hidden className="mt-3 hidden font-mono text-[9px] uppercase tabular-nums tracking-[0.28em] text-white/35 sm:block">
          <p>
            <span className="normal-case">t</span> <span ref={wall} className="text-white/55">00:00:00:00</span>
          </p>
          <p className="mt-1">
            <span className="normal-case">τ</span> <span ref={proper} className="text-white/55">00:00:00:00</span>
          </p>
          <p ref={ratio} className="mt-1 text-[var(--ember)] opacity-0 transition-opacity duration-300" />
        </div>
      </div>

      <div className="absolute bottom-5 left-5 sm:bottom-7 sm:left-8">
        <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-white/45">
          {c.when && <span className="text-white/70">{c.when}</span>}
          {c.when && c.coords && <span className="hidden sm:inline"> · </span>}
          {c.coords && <span className="hidden sm:inline">{c.coords}</span>}
        </p>
      </div>

      <button
        type="button"
        onClick={toggle}
        aria-pressed={sound}
        className="pointer-events-auto absolute bottom-5 right-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.3em] text-white/45 transition hover:text-white focus-visible:text-white focus-visible:outline-none sm:bottom-7 sm:right-8"
      >
        {sound ? <Volume2 className="h-3.5 w-3.5" aria-hidden /> : <VolumeX className="h-3.5 w-3.5" aria-hidden />}
        Sound {sound ? "on" : "off"}
      </button>
    </div>
  );
}
