"use client";
/**
 * The frame around the film. Typography is the only interface: name, chapter
 * counter, real coordinates, letterbox bars that close in with speed and
 * pressure, a Play control (the film scrolls itself), the sound switch, and
 * two clocks. `t` is the viewer's time; `τ` is the story's own time. Near the
 * black hole and in a crisis τ falls behind; inside the tesseract it stops.
 *
 * The year card: while the camera travels between dated chapters the year
 * names the next chapter's year, blinking in. At the black hole it sits centred on
 * the hole and falls in: the digits spiral inward, stretch along the pull,
 * shrink and vanish at the horizon. Inside the tunnel the years come at you
 * out of the depth, 2014, 2015, 2016, and 2017 arrives as you come out.
 *
 * Gravity on the words: during a crisis an SVG displacement filter bends the
 * text frame around the same unseen mass that bends the light in WebGL.
 */
import { useEffect, useRef, useState } from "react";
import { FileText, Pause, Play, Volume2, VolumeX } from "lucide-react";
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

export function Hud({ player, onHome, onResume }: { player: Player; onHome: () => void; onResume: () => void }) {
  const top = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const year = useRef<HTMLDivElement>(null);
  const yearNum = useRef<HTMLParagraphElement>(null);
  const yearNext = useRef<HTMLParagraphElement>(null);
  const digits = useRef<(HTMLSpanElement | null)[]>([]);
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
    let yearMode = 0; // 0 plain, 1 falling into the hole, 2 inside the tunnel
    const loop = (now: number) => {
      // Letterbox: always a hint of 2.39:1, closing in further with speed and pressure.
      const bar = Math.min(7, 4 + film.speed * 12 + film.presence(0) * 2 + film.crisis * 2);
      if (top.current) top.current.style.height = `${bar}vh`;
      if (bottom.current) bottom.current.style.height = `${bar}vh`;

      // The year card.
      const i = Math.floor(film.u);
      const f = film.u - i;
      const from = chapters[i]?.rollFrom ?? chapters[i]?.year;
      const to = chapters[i + 1]?.year;
      let on = 0;
      let yr = 0;
      let mode = 0;
      let pull = 0; // 0..1: how far the year has fallen into the hole
      let q = 0; // 0..1: how close this year has come out of the tunnel's depth
      let lastYear = false;
      if (from && to && f > 0.005) {
        if (i === 2) {
          // The fall reads 2014 and falls into the hole; the tunnel brings the years.
          const fallEnd = CUTS[0].from - 2;
          const t0 = CUTS[0].to - 2;
          on = Math.min(1, f / 0.04, (1 - f) / 0.08);
          if (f < t0) {
            mode = 1;
            yr = from;
            pull = Math.pow(clamp01((f - 0.035) / (fallEnd - 0.06)), 1.6);
          } else {
            mode = 2;
            const n = to - from + 1;
            const yf = Math.min(n - 0.001, clamp01((f - t0) / (0.84 - t0)) * n);
            const k = Math.floor(yf);
            yr = from + k;
            q = yf - k;
            lastYear = k === n - 1;
          }
        } else {
          // Between chapters the card names where you are going: the next chapter's year only.
          on = Math.pow(Math.sin(Math.PI * f), 0.6);
          yr = to;
        }
      }
      if (film.reduced && mode) mode = mode === 1 ? 0 : 3;
      if (year.current) year.current.style.opacity = String(on * 0.9);
      const num = yearNum.current;
      const next = yearNext.current;
      if (on > 0 && num && next && year.current) {
        if (yr !== shownYear) {
          shownYear = yr;
          glitchUntil = now + 170;
          const str = String(yr);
          digits.current.forEach((d, j) => d && (d.textContent = str[j] ?? ""));
        }
        next.textContent = `${chapters[i + 1].index} · ${chapters[i + 1].title}`;
        const W = window.innerWidth, H = window.innerHeight;
        if (mode === 1) {
          // Centred on the hole, and pulled into it.
          const cy = num.offsetTop + num.offsetHeight / 2;
          year.current.style.transform = `translate3d(${((film.bhX - 0.5) * W).toFixed(1)}px, ${(film.bhY * H - cy).toFixed(1)}px, 0)`;
          // No transform on the number itself: it would become the digits' offsetParent and skew the measurements.
          num.style.transform = "";
          num.style.opacity = "1";
          // A dark halo keeps the digits legible against the bright side of the disk.
          if (yearMode !== 1) num.style.textShadow = "0 0 14px rgba(0,0,0,0.75), 0 0 36px rgba(0,0,0,0.4)";
          const R = film.bhR * H * 0.5;
          const avail = Math.min(film.bhX, 1 - film.bhX) * W - 0.06 * W;
          const cx = num.offsetLeft + num.offsetWidth / 2;
          let xmax = 1;
          let gap = 1e9;
          let dw = 0;
          for (const d of digits.current) {
            if (!d) continue;
            const x = d.offsetLeft + d.offsetWidth / 2 - cx;
            xmax = Math.max(xmax, Math.abs(x));
            gap = Math.min(gap, Math.abs(x) - d.offsetWidth / 2);
            dw = Math.max(dw, d.offsetWidth / 2);
          }
          // The two halves part around the hole so no digit sits across it (the
          // lensed disk glows well past the ring). On a narrow screen the year
          // shrinks to fit rather than leave the frame.
          const clear = R * 1.75;
          const fit = Math.max(0.55, Math.min(1, (avail - clear) / Math.max(1, xmax + dw - gap)));
          const push = Math.max(0, Math.min(clear / fit - gap, avail / fit - xmax - dw));
          for (const d of digits.current) {
            if (!d) continue;
            const x = d.offsetLeft + d.offsetWidth / 2 - cx;
            const side = x < 0 ? Math.PI : 0;
            // The inner digits go first: the pull is stronger closer in.
            const k = clamp01(pull * 1.35 - 0.35 * (Math.abs(x) / xmax));
            // Spiralling in: closer, smaller, stretched along the pull, gone at the centre.
            const r = (Math.abs(x) + push * (1 - k)) * Math.pow(1 - k, 1.3);
            const a = side + 1.9 * k;
            const tx = fit * Math.cos(a) * r - x;
            const ty = fit * Math.sin(a) * r;
            const sc = (1 - 0.8 * k) * fit;
            d.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0) rotate(${(a - side).toFixed(3)}rad) scale(${((1 + 1.8 * k) * sc).toFixed(3)}, ${((1 - 0.75 * k) * sc).toFixed(3)})`;
            d.style.opacity = String(1 - clamp01((k - 0.4) / 0.5));
          }
          const pn = clamp01(pull * 1.4);
          const dy = next.offsetTop + next.offsetHeight / 2 - cy;
          // The slug starts clear of the ring, then falls in after the digits.
          const below = Math.max(0, Math.min(R * 1.5 - dy, H * 0.38 - dy));
          next.style.transform = `translate3d(0, ${(below * (1 - pn) - dy * pn).toFixed(1)}px, 0) scale(${(1 + 0.6 * pn) * (1 - 0.85 * pn)}, ${1 - 0.85 * pn})`;
          next.style.opacity = String(1 - pn);
        } else {
          if (yearMode !== mode) {
            num.style.textShadow = "";
            year.current.style.transform = "";
            for (const d of digits.current) if (d) d.style.transform = d.style.opacity = "";
          }
          if (mode === 2) {
            // Coming out, the last year rises clear of the globe (drops below it on phones).
            const lift = lastYear ? clamp01((f - 0.8) / 0.15) : 0;
            const ly = lift * lift * (3 - 2 * lift) * H * (W / H < 0.8 ? 0.2 : -0.26);
            year.current.style.transform = ly ? `translate3d(0, ${ly.toFixed(1)}px, 0)` : "";
            // Out of the depth: each year grows toward you and passes; the last one lands.
            const sc = lastYear ? 0.15 + 0.85 * (1 - Math.pow(1 - q, 3)) : 0.15 + 1.75 * q * q;
            num.style.transform = `scale(${sc.toFixed(3)})`;
            num.style.opacity = String(Math.min(1, q / 0.25) * (lastYear ? 1 : 1 - clamp01((q - 0.7) / 0.3)));
            next.style.transform = "";
            next.style.opacity = lastYear ? String(clamp01((q - 0.3) / 0.4)) : "0";
          } else {
            num.style.transform = "";
            num.style.opacity = now < glitchUntil && !film.reduced ? String(0.35 + 0.65 * (1 - (glitchUntil - now) / 170)) : "1";
            next.style.transform = "";
            next.style.opacity = "1";
          }
        }
        yearMode = mode;
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
        <p ref={yearNum} className="font-display text-[clamp(3.4rem,13vw,10.5rem)] font-normal leading-none text-white/80 tabular-nums [text-shadow:0_0_40px_rgba(255,255,255,0.3)]">
          {[0, 1, 2, 3].map((j) => (
            <span key={j} ref={(el) => { digits.current[j] = el; }} className="mx-[0.2em] inline-block will-change-transform" />
          ))}
        </p>
        <p ref={yearNext} className="mt-6 ps-[0.55em] font-mono text-[11px] uppercase tracking-[0.55em] text-white/80 [text-shadow:0_0_12px_rgba(0,0,0,0.9)]" />
      </div>

      <div className="absolute left-5 top-5 flex flex-col items-start gap-2 sm:left-8 sm:top-7 sm:flex-row sm:items-baseline sm:gap-6">
        <button
          type="button"
          onClick={onHome}
          aria-label={`${owner.name}: back to the beginning`}
          className="pointer-events-auto font-display text-[9px] uppercase tracking-[0.15em] text-white/85 transition hover:text-white focus-visible:text-white focus-visible:outline-none sm:text-[11px] sm:tracking-[0.35em]"
        >
          {owner.name}
        </button>
        <button
          type="button"
          onClick={onResume}
          className="pointer-events-auto inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.35em] text-[var(--signal)]/80 transition hover:text-[var(--signal)] focus-visible:text-[var(--signal)] focus-visible:outline-none sm:text-[10px]"
        >
          <FileText className="h-3 w-3" aria-hidden /> Résumé
        </button>
      </div>
      <div className="absolute right-5 top-5 flex flex-col items-end text-right sm:right-8 sm:top-7">
        <button
          type="button"
          onClick={onPlay}
          aria-pressed={playing}
          className="pointer-events-auto inline-flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.4em] text-white/80 transition hover:text-white focus-visible:text-white focus-visible:outline-none"
        >
          {playing ? <Pause className="h-3 w-3" aria-hidden /> : <Play className="h-3 w-3" aria-hidden />}
          <span className="hidden sm:inline">{playing ? "Pause" : player.state === "complete" ? "Play again" : "Play the film"}</span>
          <span className="sm:hidden">{playing ? "Pause" : "Play"}</span>
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
