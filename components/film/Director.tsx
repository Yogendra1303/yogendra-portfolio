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
import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { chapters } from "@/content/story";
import { CHAPTERS, CUTS, cutBetween, film } from "@/lib/film";
import { setLens } from "@/lib/lens";
import { BH_RADIUS, BLACK_HOLE, cameraCurve, careerCurve, keyLook, ORBITS, tForU, WORMHOLE_T } from "@/lib/stage";
import { careerReveal, colorAt } from "@/lib/timeline";
import { prng } from "@/lib/math";

/** Camera spring stiffness (rad/s): mass you can feel, lag you can't. */
const W = 4.6;
const UP = new THREE.Vector3(0, 1, 0);
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function readScroll() {
  const els = document.querySelectorAll<HTMLElement>("[data-chapter]");
  const vh = window.innerHeight;
  let section = 0;
  let frac = 0;
  els.forEach((el, i) => {
    const r = el.getBoundingClientRect();
    const span = Math.max(1, r.height - vh);
    if (r.top <= 1) {
      section = i;
      frac = Math.min(1, -r.top / span);
    }
  });
  film.section = Math.min(section, CHAPTERS - 1);
  film.frac = frac;
}

export function Director() {
  const { camera, pointer } = useThree();
  const look = useMemo(() => new THREE.Vector3(), []);
  const ahead = useMemo(() => new THREE.Vector3(), []);
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
  const fwd = useMemo(() => new THREE.Vector3(), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    film.clock += dt;
    film.sinceCut += dt;
    readScroll();

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
    film.gravity = u < CUTS[0].to ? Math.min(1, smooth(1.55, 2.0, u) * 0.4 * Math.min(1, open) + smooth(2.0, CUTS[0].from, u) * 0.6) : 0;
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
    const e = f * f * (3 - 2 * f);
    lookA.copy(keyLook[i]).lerp(keyLook[Math.min(CHAPTERS - 1, i + 1)], e);

    // Inside the wormhole, look down the tunnel instead.
    cameraCurve.getPoint(Math.min(1, t + 0.012), ahead);
    const [w0, w1] = WORMHOLE_T;
    const inTunnel = t > w0 - 0.02 && t < w1 + 0.01 ? Math.sin(Math.PI * Math.min(1, Math.max(0, (t - (w0 - 0.02)) / (w1 + 0.01 - (w0 - 0.02))))) : 0;
    look.copy(lookA).lerp(ahead, Math.min(1, inTunnel * 1.4));

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
    pos.lerp(look, 0.16 * creep * (1 - smooth(0, 1, travelled)) * drift);

    // Crisis cut-in: snap to a close-up of the moment, then a long release.
    const want = !film.reduced && film.crisisTarget >= 0.5;
    if (want && !closeOn.current) {
      closeOn.current = true;
      film.close = 1;
      closeT.current = 0;
      if (film.sinceCut > 0.45) {
        film.sinceCut = 0;
        film.cutKind = 2; // an exposure pop: the cut itself is the violence
      }
    }
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
    const jolt = film.reduced ? 0 : Math.exp(-film.impact * 3.2) * Math.min(1, film.crisis * 2);
    const trem = film.reduced ? 0 : film.crisis * 0.09 + jolt * 0.55;
    const c = film.clock;
    const sx = Math.sin(c * 23.1) * 0.6 + Math.sin(c * 51.7) * 0.4;
    const sy = Math.sin(c * 19.3 + 1.7) * 0.6 + Math.sin(c * 43.9) * 0.4;
    const tremScale = film.close > 0.2 ? 0.45 : 1; // a close-up shakes less in world units
    pos.x += sx * trem * tremScale;
    pos.y += sy * trem * tremScale;
    look.x += sx * trem * 0.5 * tremScale;
    look.y += sy * trem * 0.5 * tremScale;
    // A debris hit: a sharp knock that dies fast.
    const knock = film.reduced ? 0 : Math.exp(-film.hit * 9) * 0.55 * tremScale;
    pos.addScaledVector(hitDir, knock);
    // The pull breaks: a lunge forward that peaks fast and settles.
    const b = film.breakaway;
    if (b > 0.001) {
      fwd.subVectors(look, pos).normalize();
      pos.addScaledVector(fwd, 9 * b * (1 - b) * 4 * 0.5);
    }

    // Portrait screens: frame the subject in the upper half, words below.
    const cam = camera as THREE.PerspectiveCamera;
    if (cam.aspect < 0.8) look.y -= pos.distanceTo(look) * 0.22;

    camera.position.copy(pos);
    camera.lookAt(look);
    // A slight Dutch tilt under pressure.
    // Roll: about 2 degrees of weightless drift, plus a kick on every hit.
    const roll = (Math.sin(cl * 0.09 + 0.4) * 0.7 + Math.sin(cl * 0.037 + 2.2) * 0.3) * 0.035 * still;
    if (!film.reduced) camera.rotateZ(roll + film.crisis * 0.04 + Math.sin(c * 17.0) * jolt * 0.03 + film.close * 0.035 + knock * 0.05 * hitDir.x);

    // Lens: speed widens it, crisis compresses it (crushing weight), the jolt
    // slams it, a close-up goes long.
    const base = cam.aspect < 0.8 ? 72 : cam.aspect < 1.2 ? 58 : 48;
    // ...the hold slowly zooms the lens in with the scroll; the break stretches it wide.
    const fov = base + (Math.min(18, film.speed * 30) - film.crisis * 6 + jolt * 9 - film.close * 5 - 3.5 * hp + 22 * Math.pow(b, 1.4)) * (film.reduced ? 0 : 1);
    if (Math.abs(cam.fov - fov) > 0.01) {
      cam.fov += (fov - cam.fov) * Math.min(1, dt * (jolt > 0.2 || b > 0.3 ? 14 : 4));
      cam.updateProjectionMatrix();
    }

    // Masses that bend starlight: the black hole, the crisis, the B2B star.
    const D = camera.position.distanceTo(BLACK_HOLE);
    const bh = u < CUTS[0].to ? Math.min(1, open) : 0;
    setLens(0, camera.position, BLACK_HOLE, bh > 0 ? Math.min(0.95, Math.sqrt((2.5 * BH_RADIUS * bh) / Math.max(D, 0.5))) : 0, 0);
    // Slot 1: the crisis mass, or the event horizon of the enterprise pivot (dead ahead).
    const horizon = film.reduced || u > 5.5 ? 0 : film.fracture;
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
