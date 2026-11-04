/**
 * The worldline's story, derived from the screenplay so pivots land on the
 * shots that name them:
 * - careerReveal: how far along the career curve the line has grown.
 * - STOPS: the colour the line turns at each pivot (a new dimension).
 * - BRANCHES: side timelines. At every crisis the head splinters into
 *   possible futures that fan out ahead of it; as the story moves on, most
 *   fold back into the one line and the rest are pruned.
 * Deterministic: the same chaos on every visit.
 */
import * as THREE from "three";
import { chapters, type Shot } from "@/content/story";
import { prng } from "@/lib/math";
import { sections } from "@/lib/plan";

/** Story coordinate (section + scroll fraction) at which shot k of chapter i begins. */
export function shotS(i: number, k: number) {
  return i + sections[i].shots[k].a;
}

/** Story coordinate of the first shot in chapter i with crisis ≥ level. */
function crisisS(i: number, level: number) {
  const k = chapters[i].shots.findIndex((s) => "crisis" in s && (s.crisis ?? 0) >= level);
  return shotS(i, Math.max(0, k));
}

// Story coordinate → arc position on the career curve. GoMechanic (chapters
// 3 and 4) gets the turbulent stretch over the first Earth and through the
// network; each chapter's worst crisis lands where its camera can see it.
const h2 = sections[2].holdEnd;
const MARKS: [number, number][] = [
  [2 + h2 + (1 - h2) * 0.62, 0],
  [3, 0.045],
  [crisisS(3, 0.9), 0.11], // open sky above the Earth, top centre of frame
  [4, 0.135],
  [crisisS(4, 0.9), 0.16], // the centre of the network
  [5, 0.205],
  [6, 0.28],
  [7, 0.37],
  [8, 0.47],
  [8.7, 1],
];

/** How far along the career worldline is revealed at story coordinate S. */
export function careerReveal(S: number) {
  if (S <= MARKS[0][0]) return 0;
  for (let k = 1; k < MARKS.length; k++) {
    const [s1, r1] = MARKS[k];
    if (S <= s1) {
      const [s0, r0] = MARKS[k - 1];
      return r0 + ((S - s0) / (s1 - s0)) * (r1 - r0);
    }
  }
  return 1;
}

/** Story coordinate at which the head reaches arc position r. */
export function revealStory(r: number) {
  for (let k = 1; k < MARKS.length; k++) {
    const [s1, r1] = MARKS[k];
    if (r <= r1) {
      const [s0, r0] = MARKS[k - 1];
      return s0 + ((r - r0) / Math.max(1e-6, r1 - r0)) * (s1 - s0);
    }
  }
  return MARKS[MARKS.length - 1][0];
}

const shiftOf = (s: Shot) => ("shift" in s ? s.shift : undefined);
const crisisOf = (s: Shot) => ("crisis" in s && s.crisis ? s.crisis : 0);

/** Colour stops along the line: [arc position, colour], sorted. */
export const STOPS: { s: number; color: THREE.Color }[] = (() => {
  const out: { s: number; color: THREE.Color }[] = [{ s: 0, color: new THREE.Color(chapters[3].color) }];
  for (let i = 3; i < chapters.length - 1; i++) {
    let first = true;
    chapters[i].shots.forEach((sh, k) => {
      const at = careerReveal(shotS(i, k));
      if (sh.kind === "slate" && first) {
        first = false;
        if (i > 3) out.push({ s: at, color: new THREE.Color(chapters[i].color) });
      }
      const sh2 = shiftOf(sh);
      if (sh2) out.push({ s: at, color: new THREE.Color(sh2) });
    });
  }
  return out.sort((a, b) => a.s - b.s);
})();
export const MAX_STOPS = 12;

/** The line's colour at arc position r (same rule as the shader, without the blur). */
export function colorAt(r: number, out: THREE.Color) {
  out.copy(STOPS[0].color);
  for (const st of STOPS) if (r >= st.s) out.copy(st.color);
  return out;
}

export type Branch = {
  /** Arc positions on the main line where it leaves and (would) rejoin. */
  a: number;
  b: number;
  /** Story coordinates over which it grows out. */
  s0: number;
  s1: number;
  amp: number;
  phase: number;
  twist: number;
  color: THREE.Color;
  /** 0..1: how violently it reacts to a crisis. */
  crisis: number;
  pruned: boolean;
  seed: number;
};

// Side timelines glow green with a thread of gold; the pruned ones wither grey.
const EMBER = ["#5dffa8", "#2bff88", "#ffd27a", "#9dffd8"];
const COOL = ["#4dd8ff", "#7dffc4", "#2bff88"];
const MIXED = ["#4dd8ff", "#9b7bff", "#ffc46b", "#2bff88", "#ff8a2b"];

export const BRANCHES: Branch[] = (() => {
  const r = prng(2017);
  const out: Branch[] = [];
  // Crisis storms: the head splinters on the shot that names the crisis.
  for (let i = 3; i < chapters.length - 1; i++) {
    chapters[i].shots.forEach((sh, k) => {
      const c = crisisOf(sh);
      if (c < 0.3) return;
      const S = shotS(i, k);
      const w = sections[i].shots[k].b - sections[i].shots[k].a;
      const at = careerReveal(S);
      const n = 2 + Math.round(c * 3);
      const pal = c >= 0.6 ? EMBER : COOL;
      for (let j = 0; j < n; j++) {
        const a = at + (r() - 0.6) * 0.004;
        const len = 0.014 + r() * 0.026 * (0.6 + c);
        out.push({
          a,
          b: a + len,
          s0: S + w * (0.05 + j * 0.08),
          s1: S + w * (0.75 + j * 0.12),
          amp: (1.3 + r() * 3.2) * (0.55 + c * 0.75),
          phase: r() * Math.PI * 2,
          twist: (r() - 0.5) * 6,
          color: new THREE.Color(pal[j % pal.length]),
          crisis: c,
          pruned: r() < 0.42,
          seed: r(),
        });
      }
    });
  }
  // Ambient turbulence: small side timelines all through the GoMechanic years.
  for (let j = 0; j < 9; j++) {
    const a = 0.045 + (j / 9) * 0.15 + r() * 0.012;
    const len = 0.01 + r() * 0.022;
    const s0 = revealStory(a);
    out.push({
      a,
      b: a + len,
      s0,
      s1: revealStory(a + len * 0.6) + 0.04,
      amp: 0.8 + r() * 1.6,
      phase: r() * Math.PI * 2,
      twist: (r() - 0.5) * 4,
      color: new THREE.Color(MIXED[j % MIXED.length]),
      crisis: 0,
      pruned: r() < 0.3,
      seed: r(),
    });
  }
  return out;
})();
