"use client";
/**
 * The score. Original, synthesised live in the browser (no recordings, no
 * film music), and silent until the visitor presses Play or Sound.
 *
 * A constant, evolving bed that is always there, scrolling or still: a deep
 * pad that changes chord with every chapter and breathes through a slowly
 * moving filter, a high shimmer, the 40 Hz floor and the air of space.
 * Over it, the drama, timed like the reference sequences (Gravity's
 * detachment, the Interstellar wormhole, a singularity sound reel): sub-bass
 * swells slowly, risers lead into impacts, impacts dip everything for a beat.
 * A melody floats over it: a slow, sparse line of soft bell-piano notes drawn
 * from each chapter's chord, phrase by phrase, never the same twice, slowing
 * when time dilates. In the chaos (a crisis, the synthesis, the horizon) the
 * melody passes to a gliding, theremin-like voice and a wordless choir swells
 * underneath: original writing, in the spirit of time-bending scores. Everything is driven by the scroll and the story:
 * - Underneath: a 40 Hz sub, and a master filter that opens as you move
 *   through the film (dark at the start, open at the end).
 * - Between chapters: a high riser scrubbed by the scroll, cut to silence
 *   just before arrival; each title card lands with a deep braam.
 * - The fall: the sub sinks in pitch as gravity deepens. The cut to black is
 *   silence; inside the wormhole a sub slam, then a crescendo while the years
 *   pass; the exit cuts to silence.
 * - Turbulence: a slow swell for as long as the crisis lasts, debris hits
 *   panned around you; when the crisis lets go, near-silence.
 * - Outside time: high bells, hanging. Contact: the only warm chord.
 */
import { chapters } from "@/content/story";
import { CUTS, film } from "@/lib/film";
import { prng } from "@/lib/math";
import { sections } from "@/lib/plan";

const ROOTS = [55, 55, 43.65, 65.41, 49, 41.2, 43.65, 55, 55]; // braam root per chapter (Hz)
/** Pad chords per chapter, semitones from A2 (110 Hz): original voicings. */
const hz = (semi: number) => 110 * Math.pow(2, semi / 12);
const CHORDS = [
  [-12, 0, 3, 7], // 00 A minor: the line you are handed
  [-12, -5, 0, 7], // 01 open fifths: school, certainty
  [-16, -9, 0, 8], // 02 F: graduation, the pull
  [-9, 3, 7, 10], // 03 C: the internship, the startup
  [-14, -2, 2, 5], // 04 G: transformation
  [-17, -5, -2, 2], // 05 E minor, low and heavy: enterprise
  [-16, -4, 0, 10], // 06 F, open ninth: consulting
  [-12, -5, 2, 7], // 07 suspended: outside time
  [-12, 0, 4, 7], // 08 A major: resolution
].map((c) => c.map(hz));
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const smooth = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

let ctx: AudioContext | null = null;
let on = false;
let master: GainNode, duck: GainNode, mix: GainNode, tone: BiquadFilterNode, verb: ConvolverNode;
let sub: { a: OscillatorNode; b: OscillatorNode; gain: GainNode };
let air: { gain: GainNode; band: BiquadFilterNode };
let riser: { gain: GainNode; band: BiquadFilterNode; osc: OscillatorNode; oscGain: GainNode };
let tunnel: { gain: GainNode; band: BiquadFilterNode };
let swell: { gain: GainNode; band: BiquadFilterNode };
let bells: GainNode;
let pad: { gain: GainNode; filter: BiquadFilterNode; banks: { gain: GainNode; osc: OscillatorNode[] }[]; shimmer: GainNode; shimOsc: OscillatorNode[] };
let bank = 0;
let chord = -1;
let white: AudioBuffer;
const rnd = prng(40);
let lastUpdate = 0;
let lastHit = 99;
let lastCut = 99;
let lastBreak = 0;
let lastSlate = "";
let lastBraam = -9;
let crisisHeld = 0;
let resolved = false;
let inTunnel = false;
let stopTimer = 0;
let nextNote = 0;
let phraseLeft = 0;
let melodyIdx = 4;
let lastFreq = 0;
let choir: { gain: GainNode; osc: OscillatorNode[] };

/** The gliding voice: one sine that slides into each note and sings with vibrato. */
function glide(f: number, at: number, level: number) {
  if (!ctx) return;
  const c = ctx;
  const o = c.createOscillator();
  o.frequency.setValueAtTime(lastFreq || f, at);
  o.frequency.exponentialRampToValueAtTime(f, at + 0.22);
  const vib = c.createOscillator();
  vib.frequency.value = 5.4;
  const depth = gain(c, f * 0.008);
  vib.connect(depth).connect(o.frequency);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.28);
  g.gain.setTargetAtTime(0.0001, at + 1.1, 0.7);
  o.connect(g);
  g.connect(mix);
  g.connect(verb);
  o.start(at);
  vib.start(at);
  o.stop(at + 4);
  vib.stop(at + 4);
}

/** One note of the melody: a soft bell-piano (sine body, faint octave, long ring). */
function note(f: number, at: number, level: number) {
  if (!ctx) return;
  const c = ctx;
  const g = gain(c, 0);
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(level, at + 0.012);
  g.gain.exponentialRampToValueAtTime(level * 0.35, at + 0.5);
  g.gain.exponentialRampToValueAtTime(0.0001, at + 3.4);
  const lp = band(c, "lowpass", 2400, 0.4);
  g.connect(lp);
  lp.connect(mix);
  lp.connect(verb);
  [
    [1, "sine", 1],
    [2, "triangle", 0.18],
    [3.01, "sine", 0.05],
  ].forEach(([m, type, lv]) => {
    const o = c.createOscillator();
    o.type = type as OscillatorType;
    o.frequency.value = f * (m as number);
    const og = gain(c, lv as number);
    o.connect(og).connect(g);
    o.start(at);
    o.stop(at + 3.5);
  });
}

/** The melody: phrases that wander stepwise through the chapter's chord, then rest. */
function melody(now: number, chordHz: number[], dilation: number) {
  if (dilation < 0.03) {
    nextNote = now + 0.5; // outside time, the bells carry it
    return;
  }
  if (now < nextNote - 0.1) return;
  // The note pool: the chord two and three octaves up, sorted, so steps sound like a tune.
  const pool = [...chordHz.map((f) => f * 4), ...chordHz.map((f) => f * 8)].filter((f) => f < 1400).sort((a, b) => a - b);
  if (phraseLeft <= 0) phraseLeft = 4 + Math.floor(rnd() * 3);
  melodyIdx = Math.min(pool.length - 1, Math.max(0, melodyIdx + [-1, 1, 1, -1, 2, -2, 0][Math.floor(rnd() * 7)]));
  const at = Math.max(now + 0.02, nextNote);
  const chaos = film.crisis > 0.3 || film.section === 7 || film.horizon > 0.2;
  if (chaos) glide(pool[melodyIdx] / 2, at, 0.045 + rnd() * 0.015);
  else note(pool[melodyIdx], at, 0.05 + rnd() * 0.02);
  lastFreq = pool[melodyIdx] / 2;
  phraseLeft -= 1;
  const slow = 1 / Math.max(0.35, dilation);
  nextNote = at + (phraseLeft > 0 ? 0.85 + rnd() * 0.5 : 3 + rnd() * 2.5) * slow;
}

function noise(c: AudioContext, seconds: number, brown: boolean) {
  const r = prng(brown ? 41 : 17);
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const w = r() * 2 - 1;
    last = brown ? (last + 0.02 * w) / 1.02 : w;
    d[i] = brown ? last * 3.5 : w;
  }
  return buf;
}
function loop(c: AudioContext, buf: AudioBuffer) {
  const s = c.createBufferSource();
  s.buffer = buf;
  s.loop = true;
  s.start();
  return s;
}
function band(c: AudioContext, type: BiquadFilterType, f: number, q = 0.7) {
  const b = c.createBiquadFilter();
  b.type = type;
  b.frequency.value = f;
  b.Q.value = q;
  return b;
}
function gain(c: AudioContext, v = 0) {
  const g = c.createGain();
  g.gain.value = v;
  return g;
}

function build() {
  const c = new AudioContext();
  ctx = c;
  master = gain(c, 0);
  duck = gain(c, 1);
  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 8;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.35;
  tone = band(c, "lowpass", 1200, 0.5);
  mix = gain(c, 1);
  mix.connect(tone).connect(duck).connect(master).connect(limiter).connect(c.destination);

  // A vast, dark space for everything to ring out in.
  const r = prng(99);
  const len = Math.floor(c.sampleRate * 6);
  const ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (r() * 2 - 1) * Math.pow(1 - i / len, 2.4);
  }
  verb = c.createConvolver();
  verb.buffer = ir;
  verb.connect(gain(c, 0.68)).connect(mix);
  white = noise(c, 2, false);
  const brown = noise(c, 4, true);

  // The 40 Hz floor.
  const sa = c.createOscillator();
  sa.frequency.value = 40;
  const sb = c.createOscillator();
  sb.frequency.value = 80;
  const sbg = gain(c, 0.25);
  const sg = gain(c, 0);
  sa.connect(sg);
  sb.connect(sbg).connect(sg);
  sg.connect(mix);
  sa.start();
  sb.start();
  sub = { a: sa, b: sb, gain: sg };

  // Air: brown noise whose colour follows the scroll, louder with speed.
  const ab = band(c, "bandpass", 200, 0.6);
  const ag = gain(c, 0);
  loop(c, brown).connect(ab).connect(ag).connect(mix);
  air = { gain: ag, band: ab };

  // The riser: a hiss and a whine that climb with the travel.
  const rb = band(c, "bandpass", 2000, 2.5);
  const rg = gain(c, 0);
  loop(c, white).connect(rb).connect(rg);
  rg.connect(mix);
  rg.connect(verb);
  const ro = c.createOscillator();
  ro.type = "sawtooth";
  ro.frequency.value = 880;
  const rog = gain(c, 0);
  ro.connect(band(c, "bandpass", 3000, 4)).connect(rog);
  rog.connect(mix);
  rog.connect(verb);
  ro.start();
  riser = { gain: rg, band: rb, osc: ro, oscGain: rog };

  // The wormhole: a roaring bed that builds while the years pass.
  const tb = band(c, "lowpass", 300, 0.9);
  const tg = gain(c, 0);
  loop(c, brown).connect(tb).connect(tg);
  tg.connect(mix);
  tg.connect(verb);
  tunnel = { gain: tg, band: tb };

  // Turbulence: a slow, rising swell of high grit.
  const wb = band(c, "bandpass", 1200, 1.2);
  const wg = gain(c, 0);
  loop(c, white).connect(wb).connect(wg);
  wg.connect(mix);
  wg.connect(verb);
  swell = { gain: wg, band: wb };

  // The bed: two banks of four voices so one chord dissolves into the next,
  // through a filter that breathes on its own.
  const pf = band(c, "lowpass", 900, 0.8);
  const breath = c.createOscillator();
  breath.frequency.value = 0.045;
  const breathDepth = gain(c, 350);
  breath.connect(breathDepth).connect(pf.frequency);
  breath.start();
  const pg = gain(c, 0.0);
  pf.connect(pg);
  pg.connect(mix);
  pg.connect(verb);
  // Organ pipes: warm harmonics, two per note a breath apart.
  const organ = c.createPeriodicWave(new Float32Array(9), new Float32Array([0, 1, 0.5, 0.28, 0.16, 0.07, 0.09, 0.02, 0.04]));
  const banks = [0, 1].map(() => {
    const g = gain(c, 0);
    g.connect(pf);
    const osc: OscillatorNode[] = [];
    for (let k = 0; k < 8; k++) {
      const o = c.createOscillator();
      o.setPeriodicWave(organ);
      o.detune.value = k % 2 ? 5 : -5;
      const og = gain(c, k < 2 ? 0.5 : 0.3);
      o.connect(og).connect(g);
      o.start();
      osc.push(o);
    }
    return { gain: g, osc };
  });
  const sh = gain(c, 0);
  sh.connect(verb);
  const shimOsc = [0, 1, 2].map((k) => {
    const o = c.createOscillator();
    o.frequency.value = hz(24 + k * 7);
    const t = gain(c, 0.3);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.07 + k * 0.03;
    const d = gain(c, 0.25);
    lfo.connect(d).connect(t.gain);
    lfo.start();
    o.connect(t).connect(sh);
    o.start();
    return o;
  });
  pad = { gain: pg, filter: pf, banks, shimmer: sh, shimOsc };

  // A wordless choir: sawtooth voices through two vowel formants ("aah").
  const cg = gain(c, 0);
  const f1 = band(c, "bandpass", 720, 5);
  const f2 = band(c, "bandpass", 1180, 6);
  const f2g = gain(c, 0.6);
  f1.connect(cg);
  f2.connect(f2g).connect(cg);
  cg.connect(mix);
  cg.connect(verb);
  const cosc = [0, 1, 2, 3].map((k) => {
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.detune.value = (k - 1.5) * 7;
    o.connect(f1);
    o.connect(f2);
    o.start();
    return o;
  });
  choir = { gain: cg, osc: cosc };

  // Outside time: bells that hang.
  bells = gain(c, 0);
  bells.connect(verb);
  [1760, 2217.5, 2637].forEach((f) => {
    const o = c.createOscillator();
    o.frequency.value = f;
    const t = gain(c, 0.33);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.13 + f / 40000;
    const depth = gain(c, 0.3);
    lfo.connect(depth).connect(t.gain);
    o.connect(t).connect(bells);
    o.start();
    lfo.start();
  });
  return c;
}

const set = (p: AudioParam, v: number, tc = 0.25) => ctx && p.setTargetAtTime(v, ctx.currentTime, tc);

/** The title-card hit: a deep brass-like braam that opens and closes. */
function braam(root: number, level = 0.5) {
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime + 0.02;
  const f = c.createBiquadFilter();
  f.type = "lowpass";
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(120, t);
  f.frequency.exponentialRampToValueAtTime(820, t + 0.16);
  f.frequency.exponentialRampToValueAtTime(160, t + 4.2);
  const g = gain(c, 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(level, t + 0.06);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 5.5);
  f.connect(g);
  g.connect(mix);
  g.connect(verb);
  [1, 1.0045, 2, 1.5, 0.5].forEach((m, k) => {
    const o = c.createOscillator();
    o.type = k === 4 ? "sine" : "sawtooth";
    o.frequency.value = root * m;
    const og = gain(c, k === 4 ? 1.1 : 0.2);
    o.connect(og).connect(f);
    o.start(t);
    o.stop(t + 5.6);
  });
}

/** A short hit: debris, or a sub slam. */
function hit({ low = 60, lowLevel = 0.6, crunch = 0.4, pan = 0, decay = 0.9, delay = 0 }) {
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime + 0.01 + delay;
  const p = c.createStereoPanner();
  p.pan.value = pan;
  p.connect(mix);
  p.connect(verb);
  const o = c.createOscillator();
  o.frequency.setValueAtTime(low * 2.2, t);
  o.frequency.exponentialRampToValueAtTime(low * 0.6, t + decay);
  const og = gain(c, 0);
  og.gain.setValueAtTime(0.0001, t);
  og.gain.exponentialRampToValueAtTime(lowLevel, t + 0.01);
  og.gain.exponentialRampToValueAtTime(0.0001, t + decay * 2);
  o.connect(og).connect(p);
  o.start(t);
  o.stop(t + decay * 2 + 0.1);
  if (crunch > 0) {
    const n = c.createBufferSource();
    n.buffer = white;
    const b = band(c, "bandpass", 900 + rnd() * 1800, 1.6);
    const ng = gain(c, 0);
    ng.gain.setValueAtTime(0.0001, t);
    ng.gain.exponentialRampToValueAtTime(crunch, t + 0.004);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    n.connect(b).connect(ng).connect(p);
    n.start(t, rnd(), 0.4);
  }
}

/** A crack of glass and a shimmer: the frame breaking into another dimension. */
function crack() {
  if (!ctx) return;
  hit({ low: 50, lowLevel: 0.45, crunch: 0.28, decay: 1.2 });
  const c = ctx;
  const t = c.currentTime + 0.01;
  [2093, 2794, 3520, 4186].forEach((f) => {
    const o = c.createOscillator();
    o.frequency.value = f;
    const g = gain(c, 0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6);
    o.connect(g).connect(verb);
    o.start(t);
    o.stop(t + 2.7);
  });
}

/** Cut to silence: drop everything now, let it creep back. */
function silence(hold = 0.6, back = 2.5, floor = 0.3) {
  if (!ctx) return;
  const t = ctx.currentTime;
  duck.gain.cancelScheduledValues(t);
  duck.gain.setValueAtTime(floor, t + 0.01);
  duck.gain.setValueAtTime(floor, t + hold);
  duck.gain.linearRampToValueAtTime(1, t + hold + back);
}

/** The only warm chord in the film: arrival at contact. */
function resolve() {
  if (!ctx) return;
  const c = ctx;
  const t = c.currentTime + 0.05;
  const g = gain(c, 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.16, t + 3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 14);
  g.connect(mix);
  g.connect(verb);
  [110, 138.59, 164.81, 220, 277.18].forEach((f) => {
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = f;
    o.connect(g);
    o.start(t);
    o.stop(t + 14.2);
  });
}

/** A click opens a small wormhole: a soft whoomp (deeper on a globe). */
export function scoreClick(big: boolean) {
  if (!on || !ctx || ctx.state !== "running") return;
  hit({ low: big ? 42 : 95, lowLevel: big ? 0.5 : 0.16, crunch: 0, decay: big ? 1.3 : 0.45 });
}

/** A soft glass tick as a moment passes in the tesseract. */
export function scoreTick() {
  if (!on || !ctx || ctx.state !== "running") return;
  const c = ctx;
  const t = c.currentTime + 0.01;
  const o = c.createOscillator();
  o.frequency.value = 1568 + rnd() * 400;
  const g = gain(c, 0);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.05, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(g).connect(verb);
  g.connect(mix);
  o.start(t);
  o.stop(t + 1);
}

/** Call from the click that turns sound on (browsers need a gesture). */
export function startScore() {
  on = true;
  window.clearTimeout(stopTimer);
  const c = ctx ?? build();
  void c.resume();
  master.gain.cancelScheduledValues(c.currentTime);
  master.gain.setTargetAtTime(0.9, c.currentTime, 1.0);
  lastHit = film.hit;
  lastCut = film.sinceCut;
  lastBreak = film.breakaway;
  nextNote = c.currentTime + 1.4;
  phraseLeft = 0;
}

export function stopScore() {
  on = false;
  if (!ctx) return;
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  stopTimer = window.setTimeout(() => {
    if (!on) void ctx?.suspend();
  }, 1800);
}

/** The shot on screen right now, as "section:index" if it is a title card. */
function slateOnScreen() {
  const plan = sections[film.section];
  const c = chapters[film.section];
  if (!plan || !c || film.frac > plan.holdEnd) return "";
  for (let k = 0; k < plan.shots.length; k++) {
    const w = plan.shots[k];
    if (film.frac >= w.a + (w.b - w.a) * 0.12 && film.frac < w.b) return c.shots[k].kind === "slate" ? `${film.section}:${k}` : "";
  }
  return "";
}

/** Call every frame; it listens to the film and conducts itself (about 20 times a second). */
export function updateScore() {
  if (!on || !ctx || ctx.state !== "running") return;
  const now = ctx.currentTime;
  const dtA = now - lastUpdate;
  if (dtA < 0.05) return;
  lastUpdate = now;
  const { u, crisis, gravity, speed, fracture, dilation } = film;
  const story = clamp01(film.s / (chapters.length - 0.4));
  const s = Math.min(1, speed * 2);

  // Underneath: the 40 Hz floor, sinking with gravity, swelling with a held crisis.
  crisisHeld = crisis > 0.5 ? crisisHeld + dtA : Math.max(0, crisisHeld - dtA * 3);
  const held = smooth(0, 9, crisisHeld);
  set(sub.gain.gain, 0.14 + 0.3 * gravity + 0.28 * held + 0.06 * s + 0.35 * film.horizon, 0.6);
  set(sub.a.frequency, 40 - 13 * gravity, 0.8);
  set(sub.b.frequency, 80 - 26 * gravity, 0.8);
  // The master filter opens as the story moves forward, and with speed.
  set(tone.frequency, 1600 + 3600 * story + 1800 * s, 0.4);
  set(air.gain.gain, 0.022 + 0.08 * s, 0.25);

  // The bed: a chord per chapter, always sounding; darker under pressure,
  // brighter with speed, lifted by the shimmer.
  const want = Math.min(CHORDS.length - 1, Math.max(0, Math.round(u)));
  if (want !== chord) {
    chord = want;
    const next = pad.banks[1 - bank];
    CHORDS[want].forEach((f, k) => {
      next.osc[k * 2].frequency.setValueAtTime(f, now);
      next.osc[k * 2 + 1].frequency.setValueAtTime(f, now);
    });
    set(next.gain.gain, 1, 1.4);
    set(pad.banks[bank].gain.gain, 0, 1.4);
    bank = 1 - bank;
    pad.shimOsc.forEach((o, k) => o.frequency.setTargetAtTime(CHORDS[want][(k + 1) % 4] * 8, now, 1.5));
    choir.osc.forEach((o, k) => o.frequency.setTargetAtTime(CHORDS[want][k] * 2, now, 1.2));
  }
  set(pad.gain.gain, 0.1 * (1 - 0.35 * crisis) * (1 + 0.3 * film.horizon), 0.8);
  set(pad.filter.frequency, 900 + 1100 * story + 900 * s - 350 * crisis - 300 * gravity, 0.6);
  for (const b of pad.banks) b.osc.forEach((o, k) => set(o.detune, (k % 2 ? 6 : -6) - 50 * gravity + (k % 2 ? 1 : -1) * 18 * crisis, 0.6));
  set(pad.shimmer.gain, 0.008 + 0.006 * story, 1);
  melody(now, CHORDS[want], film.dilation);
  // The one crescendo of the film: the tree of timelines blooming in The Synthesis.
  const bloom = film.section === 7 ? Math.sin(Math.PI * clamp01(film.progressIn(7) / 0.6)) : 0;
  set(choir.gain.gain, 0.05 * Math.max(crisis, film.presence(7) * 0.8, film.horizon) + 0.05 * bloom, 1.2);
  set(sub.gain.gain, 0.14 + 0.3 * gravity + 0.28 * held + 0.06 * s + 0.35 * film.horizon + 0.3 * bloom, 0.8);
  set(pad.gain.gain, 0.1 * (1 - 0.35 * crisis) * (1 + 0.3 * film.horizon + 0.7 * bloom), 0.9);
  set(air.band.frequency, 120 + 700 * story + 600 * s, 0.4);

  // Between chapters: a riser scrubbed by the scroll, then silence before arrival.
  const i = Math.floor(u);
  const f = u - i;
  const travelling = film.frac > (sections[film.section]?.holdEnd ?? 1) || (f > 0.02 && f < 0.98 && s > 0.05);
  let rise = 0;
  if (travelling && i !== 2) rise = smooth(0.02, 0.8, f) * (1 - smooth(0.8, 0.88, f));
  if (i === 2 && u < CUTS[0].from) rise = smooth(2.0, CUTS[0].from, u) * 0.8; // the fall whines
  // The final horizon: a riser into a beat of silence, then the crack into the tesseract.
  if (film.section === chapters.length - 1) rise = smooth(0.74, 0.845, film.frac) * (1 - smooth(0.845, 0.855, film.frac));
  set(riser.gain.gain, 0.035 * rise, 0.12);
  set(riser.band.frequency, 900 + 3200 * rise, 0.15);
  set(riser.oscGain.gain, 0.0, 0.12);
  set(riser.osc.frequency, 440 + 1400 * rise, 0.15);

  // Turbulence: a high swell that grows for as long as the crisis lasts.
  set(swell.gain.gain, 0.05 * held * crisis, 0.5);
  set(swell.band.frequency, 900 + 4500 * held, 0.8);

  // The wormhole: silence on the cut, a slam, a crescendo while the years pass, silence on exit.
  const tunnelNow = u >= CUTS[0].to - 0.001 && u < 2.84;
  if (tunnelNow && !inTunnel) {
    // One beat of silence (the cut), then the slam.
    hit({ low: 38, lowLevel: 0.9, crunch: 0.2, decay: 1.6, delay: 0.31 });
  }
  if (!tunnelNow && inTunnel && u >= 2.84) silence(0.7, 2.2, 0.45);
  inTunnel = tunnelNow;
  const tp = tunnelNow ? smooth(CUTS[0].to, 2.84, u) : 0;
  set(tunnel.gain.gain, tunnelNow ? 0.12 + 0.5 * tp : 0, tunnelNow ? 0.3 : 0.03);
  set(tunnel.band.frequency, 220 + 2600 * tp, 0.3);

  // Outside time.
  set(bells.gain, dilation < 0.03 ? 0.05 : 0.012 * fracture, 0.9);

  // Events.
  if (film.sinceCut < lastCut && film.sinceCut < 0.3) {
    if (film.cutKind < 0) silence(0.3, 0.05, 0.12);
    else if (film.cutKind === 1) crack();
  }
  lastCut = film.sinceCut;
  if (film.hit < lastHit && film.hit < 0.3) hit({ low: 55 + rnd() * 25, lowLevel: 0.4, crunch: 0.16, pan: rnd() * 1.6 - 0.8, decay: 0.7 });
  lastHit = film.hit;
  if (film.breakaway > 0.95 && lastBreak < 0.95) {
    // The pull breaks: everything but a breath drops away.
    silence(1.2, 3.5, 0.4);
    crisisHeld = 0;
  }
  lastBreak = film.breakaway;
  const slate = slateOnScreen();
  if (slate && slate !== lastSlate && now - lastBraam > 3) {
    braam(ROOTS[film.section] ?? 55, film.section === 0 ? 0.3 : 0.4);
    lastBraam = now;
  }
  lastSlate = slate;
  const last = chapters.length - 1;
  if (film.section === last && film.frac > 0.64 && film.frac < 0.8 && !resolved) {
    resolved = true;
    resolve();
  }
  if (film.section < last) resolved = false;
}
