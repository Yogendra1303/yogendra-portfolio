"use client";
/**
 * The camera operator. Reads the scroll position from the chapter sections,
 * moves the film coordinate toward it, and flies the camera along the route.
 *
 * Pacing, Nolan-style: weight, then violence.
 * - The camera has mass: a critically damped spring, so it leans into every
 *   move and settles without bounce. During a hold it keeps creeping forward,
 *   so no stretch of scroll is dead.
 * - Hard cuts: across the black hole's horizon (smash to black) and at the
 *   dimensional fracture (white shatter) the camera jumps instead of flying.
 * - A crisis shot is a cut-in: the frame snaps to a close-up of the moment
 *   (the head of the worldline, or the black hole), jolts, tilts, and time
 *   dilates around it. Debris hits keep landing while it lasts.
 * - When the crisis lets go, the pull breaks: the camera lunges forward, the
 *   lens stretches wide, then everything settles into perfect stillness.
 * - Never a locked rail: the camera floats, weightless, drifting on X and Y
 *   and rolling about 2 degrees, like a body detached in orbit.
 */
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { chapters } from "@/content/story";
import { CHAPTERS, CUTS, cutBetween, film, HORIZON_U } from "@/lib/film";
import { setLens } from "@/lib/lens";
import { BH_RADIUS, BLACK_HOLE, cameraCurve, careerCurve, keyLook, ORBITS, tForU, WORMHOLE_T } from "@/lib/stage";
import { careerReveal, colorAt } from "@/lib/timeline";
import { PX, PX_BASE } from "@/lib/px";
import { scroll } from "@/lib/scroll";
import { easing } from "maath";
import { prng } from "@/lib/math";

/** Camera spring stiffness (rad/s): mass you can feel, lag you can't. */
const W = 5.6;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Section geometry, measured once (and again on resize or when layout
// changes), so reading the scroll each frame never forces a layout.
const tops: number[] = [];
const heights: number[] = [];
let measured = false;
function measure() {
  tops.length = 0;
  heights.length = 0;
  document.querySelectorAll<HTMLElement>("[data-chapter]").forEach((el) => {
    const r = el.getBoundingClientRect();
    tops.push(r.top + window.scrollY);
    heights.push(r.height);
  });
  measured = tops.length > 0;
}
function readScroll() {
  if (!measured) measure();
  const vh = window.innerHeight;
  const y = window.scrollY;
  let section = 0;
  let frac = 0;
  for (let i = 0; i < tops.length; i++) {
    const top = tops[i] - y;
    if (top <= 1) {
      section = i;
      frac = Math.min(1, -top / Math.max(1, heights[i] - vh));
    }
  }
  film.section = Math.min(section, CHAPTERS - 1);
  film.frac = frac;
}

export function Director() {
  const { camera, pointer, gl, size } = useThree();
  // Re-measure the sections whenever the layout changes.
  useEffect(() => {
    const again = () => (measured = false);
    const ro = new ResizeObserver(again);
    ro.observe(document.body);
    window.addEventListener("resize", again);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", again);
    };
  }, []);
  // One clock: advance the smooth scroll first, then the camera reads it.
  useFrame(() => {
    const t = performance.now();
    scroll.lenis?.raf(t);
    scroll.drivenAt = t;
  }, -2);
  const look = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
  const bhS = useMemo(() => new THREE.Vector3(), []);
  const rgt = useMemo(() => new THREE.Vector3(), []);
  const pos = useMemo(() => new THREE.Vector3(), []);
  const lookA = useMemo(() => new THREE.Vector3(), []);
  const dir = useMemo(() => new THREE.Vector3(), []);
  const closePos = useMemo(() => new THREE.Vector3(), []);
  const tint = useMemo(() => new THREE.Color(), []);
  const p2 = useMemo(() => new THREE.Vector2(), []);
  const closeOn = useRef(false);
  const closeT = useRef(0);
  const nextHit = useRef(0);
  const hitDir = useMemo(() => new THREE.Vector3(), []);
  const rnd = useMemo(() => prng(2022), []);
  const sinceBreak = useRef(99);
  const lastRaw8 = useRef(0);
  const fwd = useMemo(() => new THREE.Vector3(), []);
  // The operator's hands: the lens glides toward where the shot wants it.
  const camS = useMemo(() => new THREE.Vector3(), []);
  const lookS = useMemo(() => new THREE.Vector3(), []);
  const started = useRef(false);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    film.clock += dt;
    film.sinceCut += dt;
    readScroll();
    PX.value = (gl.getPixelRatio() * size.height) / PX_BASE;
    const jump = film.snap || !started.current;

    // Story coordinate: the worldline keeps growing through holds.
    const sTarget = film.section + film.frac;
    film.s = film.snap ? sTarget : film.s + (sTarget - film.s) * (1 - Math.exp(-dt * 5));

    // Crisis: rises like an impact, settles slowly.
    const target = film.crisisTarget * (film.reduced ? 0.4 : 1);
    if (target > film.crisis + 0.2 && film.crisis < 0.35) film.impact = 0;
    film.impact += dt;
    film.crisis += (target - film.crisis) * (target > film.crisis ? 1 - Math.exp(-dt * 7) : 1 - Math.exp(-dt * 1.1));

    // Camera coordinate: a spring with mass, except across a hard cut.
    const tu = film.targetU;
    const prev = film.u;
    const cut = cutBetween(film.u, tu);
    if (film.snap || cut) {
      if (cut && !film.snap && !film.reduced && film.sinceCut > 0.45) {
        film.sinceCut = 0;
        film.cutKind = cut.kind;
      }
      film.u = tu;
      film.vu = 0;
      film.snap = false;
    } else {
      const x = film.u - tu;
      film.vu += (-W * W * x - 2 * W * film.vu) * dt;
      film.u += film.vu * dt;
      if (Math.abs(x) < 1e-4 && Math.abs(film.vu) < 1e-3) {
        film.u = tu;
        film.vu = 0;
      }
    }
    const v = cut ? film.speed : Math.abs(film.u - prev) / Math.max(dt, 1e-4);
    film.speed += (v - film.speed) * Math.min(1, dt * 6);
    const u = film.u;

    // Gravity: the well deepens as the camera falls toward the horizon.
    const open = film.bhOpen;
    film.gravity = u < HORIZON_U ? Math.min(1, smooth(1.55, 2.0, u) * 0.4 * Math.min(1, open) + smooth(2.0, CUTS[0].from, u) * 0.6) : 0;
    // Time dilation: local time slows near a mass, and under crisis. Inside
    // the tesseract (chapter 07, outside time) it stops: past, present and
    // future are all there at once, and nothing moves but you.
    const outside = smooth(6.55, 7.0, u) * (1 - smooth(7.35, 7.8, u));
    film.dilation = Math.max(0.12, 1 - Math.max(0.8 * film.crisis, 0.85 * film.gravity)) * (1 - outside);
    film.dt = dt * film.dilation;
    film.time += film.dt;

    // Dimensional shift: B2C fractures into B2B (4 to 5); a softer fold into 4D (6 to 7).
    const fu = u - Math.floor(u);
    const fold = (from: number, amt: number) => (u > from && u < from + 1 ? Math.pow(Math.sin(Math.PI * fu), 1.4) * amt : 0);
    film.fracture = film.reduced ? 0 : Math.max(fold(4, 1), fold(6, 0.5));

    // The present: head of the worldline, and the colour of its dimension.
    const reveal = careerReveal(film.s);
    if (film.section <= 2) {
      film.focus.copy(BLACK_HOLE);
      tint.set(chapters[Math.min(2, Math.round(u))].color);
    } else {
      careerCurve.getPointAt(Math.max(0.001, reveal), film.focus);
      colorAt(reveal, tint);
    }
    film.tint.lerp(tint, Math.min(1, dt * 2.5));

    const t = tForU(u);
    cameraCurve.getPoint(t, pos);

    // Look target: blend between chapter look points with an ease.
    const i = Math.min(CHAPTERS - 2, Math.floor(u));
    const f = u - i;
    // Leaving the crystal, the camera keeps it in frame as it tracks past,
    // then pans forward with the light toward the hole.
    const g = i === 1 ? Math.min(1, Math.max(0, (f - 0.3) / 0.55)) : f;
    const e = g * g * (3 - 2 * g);
    lookA.copy(keyLook[i]).lerp(keyLook[Math.min(CHAPTERS - 1, i + 1)], e);

    // Inside the wormhole, look down the tunnel instead.
    cameraCurve.getPoint(Math.min(1, t + 0.012), ahead);
    const [w0, w1] = WORMHOLE_T;
    const inTunnel = t > w0 - 0.02 && t < w1 + 0.01 ? Math.sin(Math.PI * Math.min(1, Math.max(0, (t - (w0 - 0.02)) / (w1 + 0.01 - (w0 - 0.02))))) : 0;
    look.copy(lookA).lerp(ahead, Math.min(1, inTunnel * 1.4));

    // Graduation: once the black hole opens it pulls the camera into a slow,
    // tightening orbit while the chapter plays. In the fall the orbit winds in
    // with the distance, so the last approach spirals in, as the light did.
    if (film.section === 2 && u < HORIZON_U) {
      const h = film.holdProgress;
      const k = h * h * (3 - 2 * h) * film.bhOpen * smooth(0.8, 9, pos.distanceTo(BLACK_HOLE));
      dir.subVectors(pos, BLACK_HOLE).applyAxisAngle(UP, 0.38 * k);
      pos.copy(BLACK_HOLE).addScaledVector(dir, 1 - 0.28 * k);
      pos.y -= 1.2 * k; // sinking a little below the disk, looking up into it
    }
    // The fall: the hole swings to dead centre and stays there until the horizon.
    if (film.section === 2 && u > 2 && u < HORIZON_U) look.lerp(BLACK_HOLE, smooth(2.0, 2.04, u));
    // Inside the hole: black from edge to edge (no cut), then the tunnel opens out of it.
    film.dark = u < 2.1 || u > 2.6 ? 0 : u < HORIZON_U ? 1 - smooth(1.8, 7.5, pos.distanceTo(BLACK_HOLE)) : 1 - smooth(HORIZON_U + 0.004, HORIZON_U + 0.15, u);

    // The Absolute Order: as the swarm becomes a system, the camera revolves
    // around it and cranes up to look down on the orbits. Leaving, it unwinds
    // into the route, which carries on round the same way.
    if (u > 4.9 && u < 5.6 && film.section >= 5) {
      const h5 = film.section === 5 ? smooth(0, 1, film.holdProgress) : 1;
      const k5 = h5 * (1 - smooth(5.0, 5.55, u));
      if (k5 > 0) {
        dir.subVectors(pos, ORBITS).applyAxisAngle(UP, 1.15 * k5);
        pos.copy(ORBITS).add(dir);
        pos.y += 7 * k5;
      }
    }

    // Weightless: a slow drift on X and Y that never repeats, wider in
    // turbulence, and gone for a few seconds after the pull breaks (stillness).
    const hold = 1 - Math.min(1, film.speed * 3);
    p2.lerp(pointer, Math.min(1, dt * 1.5));
    const drift = film.reduced ? 0 : 1;
    sinceBreak.current += dt;
    const still = 1 - 0.9 * Math.max(0, 1 - Math.max(0, sinceBreak.current - 1.4) / 4) * (sinceBreak.current < 6 ? 1 : 0);
    const cl = film.clock;
    const float = (0.55 + film.crisis * 1.1) * still * drift;
    pos.x += ((Math.sin(cl * 0.21 + 1.3) * 0.6 + Math.sin(cl * 0.077 + 4.1) * 0.4) * float + p2.x * 0.8 * hold * drift);
    pos.y += ((Math.sin(cl * 0.17 + 2.9) * 0.6 + Math.sin(cl * 0.061 + 0.7) * 0.4) * float * 0.7 + p2.y * 0.45 * hold * drift);

    // Slow, heavy creep toward the subject through the hold. It fades out over
    // the travel so it hands over to the next chapter without a seam.
    const hp = film.holdProgress;
    const creep = 0.8 * hp + 0.2 * hp * hp * (3 - 2 * hp);
    const travelled = Math.min(1, Math.max(0, u - film.section));
    const creepK = 0.16 * creep * (1 - smooth(0, 1, travelled)) * drift * (film.section === 2 ? 1 - smooth(2, 2.15, u) : 1);
    pos.lerp(look, creepK);
    // ...and a slow boom down as it creeps in, where the shot has no move of its own.
    const sec = film.section;
    if (sec === 3 || sec === 4 || sec === 6 || sec === 7) pos.y -= creepK * 0.35 * pos.distanceTo(look);

    // Crisis: a fast, fluid push in on the moment (no cut), then a long release.
    const want = !film.reduced && film.crisisTarget >= 0.5 && film.section >= 3;
    if (want && !closeOn.current) {
      closeOn.current = true;
      closeT.current = 0;
    }
    if (closeOn.current) film.close += (1 - film.close) * Math.min(1, dt * 2.4);
    if (!want && closeOn.current && !film.reduced) {
      // The crisis lets go: the pull breaks.
      film.breakaway = 1;
      sinceBreak.current = 0;
    }
    if (!want) closeOn.current = false;
    if (!closeOn.current) film.close *= Math.exp(-dt * (film.breakaway > 0.05 ? 2.4 : 0.85));
    film.breakaway *= Math.exp(-dt * 1.5);
    // Debris: while the crisis holds, impacts keep landing at uneven intervals.
    if (!film.reduced && film.crisisTarget >= 0.5 && film.clock > nextHit.current) {
      film.hit = 0;
      nextHit.current = film.clock + 0.6 + rnd() * 1.5;
      hitDir.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize();
    }
    film.hit += dt;
    closeT.current += dt;
    if (film.close > 0.001) {
      const F = film.focus;
      const isBH = film.section <= 2;
      dir.subVectors(pos, F);
      const dist = Math.max(0.001, dir.length());
      dir.divideScalar(dist).applyAxisAngle(UP, isBH ? -0.32 : 0.4);
      // Once cut in, keep pushing closer: the walls closing in.
      const near = (isBH ? Math.min(dist * 0.55, 19) : Math.min(dist * 0.5, 7.5)) * (1 - 0.2 * Math.min(1, closeT.current / 7));
      closePos.copy(F).addScaledVector(dir, near);
      closePos.y += near * 0.14;
      const k = film.close * film.close * (3 - 2 * film.close);
      pos.lerp(closePos, k);
      look.lerp(F, k);
    }

    // Sudden violence: the jolt at a crisis onset, then a heavy tremor.
    const violent = film.reduced || film.section <= 2 ? 0 : 1; // the black hole pulls; it does not shake
    const jolt = violent * Math.exp(-film.impact * 3.2) * Math.min(1, film.crisis * 2);
    const trem = violent * (film.crisis * 0.05 + jolt * 0.3);
    const c = film.clock;
    // Low-frequency sway, never a buzz: a heavy body being pushed, not a vibrating one.
    const sx = Math.sin(c * 2.3) * 0.6 + Math.sin(c * 3.7 + 1.1) * 0.4;
    const sy = Math.sin(c * 1.9 + 1.7) * 0.6 + Math.sin(c * 3.1) * 0.4;
    const tremScale = film.close > 0.2 ? 0.45 : 1; // a close-up shakes less in world units
    pos.x += sx * trem * tremScale;
    pos.y += sy * trem * tremScale;
    look.x += sx * trem * 0.5 * tremScale;
    look.y += sy * trem * 0.5 * tremScale;
    // A debris hit: a sharp knock that dies fast.
    const knock = film.reduced ? 0 : Math.exp(-film.hit * 9) * 0.3 * tremScale;
    pos.addScaledVector(hitDir, knock);
    // The pull breaks: a lunge forward that peaks fast and settles.
    const b = film.breakaway;
    if (b > 0.001) {
      fwd.subVectors(look, pos).normalize();
      pos.addScaledVector(fwd, 9 * b * (1 - b) * 4 * 0.5);
    }

    // Portrait screens: frame the subject in the upper half, words below.
    // Wide screens, where the title card shares the frame with a centred
    // subject: tilt up while the card holds, so it sits above the subject.
    const cam = camera as THREE.PerspectiveCamera;
    const wantSlate = !!chapters[film.section]?.titleTop && film.slateOn ? 1 : 0;
    film.slate += (wantSlate - film.slate) * Math.min(1, dt * 1.8);
    if (cam.aspect < 0.8) look.y -= pos.distanceTo(look) * 0.22;
    else {
      look.y += pos.distanceTo(look) * 0.17 * film.slate * film.slate * (3 - 2 * film.slate);
      // The Absolute Order: the words hold the left, the system turns on the right third.
      const p5 = film.presence(5);
      if (p5 > 0) {
        rgt.subVectors(look, pos).cross(UP).normalize();
        look.addScaledVector(rgt, -0.2 * pos.distanceTo(look) * p5 * p5 * (3 - 2 * p5));
      }
    }

    // Every move eases in and out: position and aim glide (no snaps), faster
    // for position than for aim, as a real operator pans after the dolly.
    if (jump || film.reduced) {
      camS.copy(pos);
      lookS.copy(look);
      started.current = true;
    } else {
      // Critically damped (no overshoot, no instant start), frame-rate independent.
      easing.damp3(camS, pos, 0.11, dt, 400);
      easing.damp3(lookS, look, 0.18, dt, 600);
    }
    camera.position.copy(camS);
    camera.lookAt(lookS);
    // A slight Dutch tilt under pressure.
    // Roll: about 2 degrees of weightless drift, plus a kick on every hit.
    const roll = (Math.sin(cl * 0.09 + 0.4) * 0.7 + Math.sin(cl * 0.037 + 2.2) * 0.3) * 0.035 * still;
    // Roll stays within about 2 degrees.
    if (!film.reduced) camera.rotateZ(Math.max(-0.035, Math.min(0.035, roll + film.crisis * 0.015 + Math.sin(c * 2.0) * jolt * 0.01 + film.close * 0.01 + knock * 0.02 * hitDir.x)));

    // Lens: speed widens it, crisis compresses it (crushing weight), the jolt
    // slams it, a close-up goes long.
    const base = cam.aspect < 0.8 ? 72 : cam.aspect < 1.2 ? 58 : 48;
    // ...the hold slowly zooms the lens in with the scroll; the break stretches it wide.
    const fov = base + (Math.min(18, film.speed * 30) - film.crisis * 6 + jolt * 9 - film.close * 5 - 3.5 * hp + 22 * Math.pow(b, 1.4)) * (film.reduced ? 0 : 1);
    if (Math.abs(cam.fov - fov) > 0.01) {
      easing.damp(cam, "fov", fov, jolt > 0.2 || b > 0.3 ? 0.07 : 0.25, dt);
      cam.updateProjectionMatrix();
    }

    // Where the black hole sits on screen, so the words can fall into it.
    if (u < HORIZON_U && film.section <= 2) {
      camera.updateMatrixWorld();
      bhS.copy(BLACK_HOLE).project(camera);
      film.bhX = bhS.x * 0.5 + 0.5;
      film.bhY = 0.5 - bhS.y * 0.5;
      const dBH = camera.position.distanceTo(BLACK_HOLE);
      film.bhR = bhS.z < 1 ? 3.0 / Math.max(0.5, dBH) / Math.tan((cam.fov * Math.PI) / 360) : 0;
    }

    // Masses that bend starlight: the black hole, the crisis, the B2B star.
    const D = camera.position.distanceTo(BLACK_HOLE);
    const bh = u < HORIZON_U ? Math.min(1, open) : 0;
    setLens(0, camera.position, BLACK_HOLE, bh > 0 ? Math.min(0.95, Math.sqrt((2.5 * BH_RADIUS * bh) / Math.max(D, 0.5))) : 0, 0);
    // The final climax: after contact, an event horizon builds dead ahead; at
    // its peak the frame cracks and you cross into the tesseract.
    const raw8 = film.rawIn(8);
    const horizon = film.reduced ? 0 : smooth(0.72, 0.83, raw8) * (1 - smooth(0.86, 0.93, raw8));
    if (!film.reduced && film.horizon > 0.5 && raw8 >= 0.86 && lastRaw8.current < 0.86 && film.sinceCut > 0.45) {
      film.sinceCut = 0;
      film.cutKind = 1;
    }
    lastRaw8.current = raw8;
    film.horizon = horizon;
    // Slot 1: the crisis mass, or the final event horizon.
    if (film.section >= 3 && film.crisis > 0.02) setLens(1, camera.position, film.focus, 0.13 * film.crisis, 0.32);
    else if (horizon > 0.01) {
      camera.getWorldDirection(fwd);
      ahead.copy(camera.position).addScaledVector(fwd, 40);
      setLens(1, camera.position, ahead, 0.24 * horizon, 0.05);
    } else setLens(1, camera.position, film.focus, 0, 0);
    setLens(2, camera.position, ORBITS, 0.07 * film.presence(5), 0.18);
  }, -1);

  return null;
}
