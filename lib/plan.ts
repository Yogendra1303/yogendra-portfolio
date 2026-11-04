/**
 * The edit: how long each chapter holds and where each shot sits in its scroll.
 * A chapter section = hold (shots play one after another) + travel (camera
 * flies to the next world). All values in viewport heights.
 *
 * Tuned so every wheel tick changes something on screen: short shot windows,
 * a short travel, and the camera creeps through the hold instead of parking.
 */
import { chapters, type Shot } from "@/content/story";

const WEIGHT: Record<Shot["kind"], number> = {
  slate: 1.15, // title cards fade in and out slowly, so they get a little more room
  say: 0.8,
  credit: 1.05,
  figure: 0.95,
  word: 0.95,
  roll: 1.25,
  index: 1.6,
};
const SHOT_VH = 30;
const TRAVEL_VH = 62;
const FINALE_VH = 380; // end credits, contact, then the index

export type Window = { a: number; b: number };
export type SectionPlan = { heightVh: number; holdEnd: number; shots: Window[] };

function plan(i: number): SectionPlan {
  const c = chapters[i];
  const last = i === chapters.length - 1;
  const total = c.shots.reduce((s, sh) => s + WEIGHT[sh.kind], 0);
  const holdVh = last ? FINALE_VH : total * SHOT_VH + 14;
  const travelVh = last ? 0 : TRAVEL_VH;
  const span = holdVh + travelVh;
  const holdEnd = last ? 1 : holdVh / span;
  // Shot windows in section-progress units (0..1 over the scrollable span).
  const pad = 0.01;
  let at = pad;
  // The finale's lines play first; the end credits and contact take the rest.
  const usable = last ? 0.16 : holdEnd - pad * 2;
  const shots = c.shots.map((sh) => {
    const w = (WEIGHT[sh.kind] / total) * usable;
    const win = { a: at, b: at + w };
    at += w;
    return win;
  });
  return { heightVh: span + 100, holdEnd, shots };
}

export const sections: SectionPlan[] = chapters.map((_, i) => plan(i));
