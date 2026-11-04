/**
 * The film's shared state. Scroll sets the targets; the Director moves the
 * camera toward them every frame. Two coordinates:
 * - `u` is the camera's: 3.0 means "holding on chapter 3", 3.5 "halfway to 4".
 * - `s` is the story's: section + scroll fraction. It keeps moving through
 *   holds, so the worldline grows while the shots play.
 *
 * Physics of the story:
 * - crisis   0..1, from the shot on screen. Rises like an impact, settles slowly.
 * - gravity  0..1, how deep the camera is in the black hole's well.
 * - dilation how fast local time runs (1 = normal). Crisis and gravity slow
 *            it; inside the tesseract (chapter 07) it stops.
 * - fracture 0..1, the dimensional shift when B2C becomes B2B (chapter 4 to 5).
 * - cuts     stretches of the route the camera never occupies: it jumps.
 */
import * as THREE from "three";
import { chapters } from "@/content/story";
import { sections } from "@/lib/plan";

export const CHAPTERS = chapters.length;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Hard cuts, in camera coordinates. Scrolling across one cuts instead of flying.
 * kind -1 smashes to black (falling through the horizon), +1 is a white shatter.
 */
export const CUTS = [
  { from: 2.3, to: 2.36, kind: -1 },
  { from: 4.44, to: 4.56, kind: 1 },
] as const;

/** Heavy in-out: a slow, deliberate start, a committed middle, a long settle. */
function heavy(x: number) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
/** Heavy, but never dead: a little linear so the first wheel tick already moves. */
const weighty = (x: number) => 0.72 * heavy(x) + 0.28 * x;
const outCubic = (x: number) => 1 - Math.pow(1 - x, 3);

/** Scroll through a travel (0..1) to camera progress toward the next chapter (0..1). */
function travel(i: number, x: number) {
  if (i === 2) {
    // The fall: slow and heavy toward the horizon, accelerating as gravity
    // takes over. Then the cut to black, and the tunnel spits you out.
    if (x < 0.46) return (CUTS[0].from - 2) * Math.pow(x / 0.46, 1.7);
    return CUTS[0].to - 2 + (1 - (CUTS[0].to - 2)) * outCubic((x - 0.46) / 0.54);
  }
  const e = weighty(x);
  if (i === 4) {
    // The shatter happens at the midpoint of the dimensional shift.
    const a = CUTS[1].from - 4, b = CUTS[1].to - 4;
    return e < 0.5 ? (e / 0.5) * a : b + ((e - 0.5) / 0.5) * (1 - b);
  }
  return e;
}

class Film {
  /** Raw scroll position in chapter units (section i, fraction f). */
  section = 0;
  frac = 0;
  /** Camera coordinate along the chapter keyframes (spring-smoothed). */
  u = 0;
  /** Velocity of u, for the spring. */
  vu = 0;
  /** Story coordinate (section + frac, smoothed). */
  s = 0;
  /** |du/dt| smoothed, used for warp streaks, lens and sound. */
  speed = 0;
  /** Story time. Runs slower under crisis and gravity (time dilation). */
  time = 0;
  /** This frame's dilated step: what particles and simulations advance by. */
  dt = 0;
  /** Wall-clock time, for things that must not dilate (grain, shake). */
  clock = 0;
  reduced = false;
  /** Jump the camera straight to the scroll position on the next frame. */
  snap = false;

  crisis = 0;
  /** Seconds since the last crisis began: drives the jolt. */
  impact = 99;
  gravity = 0;
  dilation = 1;
  fracture = 0;
  /** Seconds since the last hard cut, and its kind (-1 black, 1 white shatter, 2 crisis cut-in). */
  sinceCut = 99;
  cutKind = 0;
  /** 0..1: how far the camera has cut in on the crisis (close-up framing). */
  close = 0;
  /** Seconds since the last debris impact during turbulence. */
  hit = 99;
  /** 1 the moment a crisis lets go (the pull breaks), easing to 0. */
  breakaway = 0;
  /** The last click: screen position (0..1, y up), when, and whether it landed on a globe (-1 unknown). */
  clickX = 0.5;
  clickY = 0.5;
  clickAt = -99;
  clickBig = -1;
  /** The last click opened a dark wormhole (the name, the résumé) rather than a bright one. */
  clickDark = false;
  /** 0..1: the final event horizon, after contact, just before the tesseract. */
  horizon = 0;
  /** 0..1: the closing tesseract (the time index after contact) is on screen. */
  tesseract = 0;
  /** 0..1: where the visitor has dragged time to inside the tesseract. */
  scrub = 0;
  /** Where the world's light is, and how strongly it shines (set by Effects). */
  light = new THREE.Vector3();
  lightOn = 0;
  /** Where the crisis is happening (head of the worldline, or the black hole). */
  focus = new THREE.Vector3();
  /** Colour of the worldline's present: the dimension we are in. */
  tint = new THREE.Color("#2bff88");

  /** Camera coordinate the scroll position asks for: hold, then travel. */
  get targetU() {
    const h = sections[this.section]?.holdEnd ?? 0.58;
    if (h >= 1) return Math.min(CHAPTERS - 1, this.section);
    const x = clamp01((this.frac - h) / (1 - h));
    return Math.min(CHAPTERS - 1, this.section + (x > 0 ? travel(this.section, x) : 0));
  }

  /** Crisis level the current shot asks for. */
  get crisisTarget() {
    const plan = sections[this.section];
    const c = chapters[this.section];
    if (!plan || !c || this.frac > plan.holdEnd) return 0;
    for (let k = 0; k < plan.shots.length; k++) {
      const w = plan.shots[k];
      if (this.frac >= w.a && this.frac < w.b) {
        const s = c.shots[k];
        return "crisis" in s && s.crisis ? s.crisis : 0;
      }
    }
    return 0;
  }

  /** How open the black hole is, 0..1 (it opens smoothly as the chapter plays). */
  get bhOpen() {
    if (this.u > 2.2) return 1;
    const x = clamp01((this.progressIn(2) - 0.1) / 0.32);
    return x * x * (3 - 2 * x);
  }

  /** How present chapter i is right now, 0..1 (1 when the camera holds on it). */
  presence(i: number) {
    return clamp01(1 - Math.abs(this.u - i) * 1.4);
  }

  /**
   * Scroll progress inside chapter i's section, 0..1, frozen at the ends.
   * Remapped so the hold always spans 0..0.58 (the worlds are timed to that),
   * however many shots the chapter has.
   */
  progressIn(i: number) {
    if (this.section < i) return 0;
    if (this.section > i) return 1;
    return remap(i, this.frac);
  }

  /** Raw (unmapped) scroll progress inside chapter i, for the text layer. */
  rawIn(i: number) {
    if (this.section < i) return 0;
    if (this.section > i) return 1;
    return this.frac;
  }

  /** Progress through the hold of the current chapter, 0..1. */
  get holdProgress() {
    const h = sections[this.section]?.holdEnd ?? 0.58;
    return clamp01(this.frac / h);
  }
}

/** Section progress to world time: the hold maps to 0..0.58, travel to the rest. */
export function remap(i: number, f: number) {
  const h = sections[i]?.holdEnd ?? 0.58;
  if (h >= 1) return f;
  return f < h ? (f / h) * 0.58 : 0.58 + ((f - h) / (1 - h)) * 0.42;
}

/** The cut (if any) lying between two camera coordinates. */
export function cutBetween(a: number, b: number) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return CUTS.find((c) => lo <= c.from + 1e-4 && hi >= c.to - 1e-4);
}

export const film = new Film();
