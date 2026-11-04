"use client";
/**
 * The words of the film, cut like a film. Each chapter is a tall scroll
 * section with a sticky frame. While the camera holds on a world, shots play
 * one at a time, never stacked like a slide:
 *   slate   screenplay slug line + a title that resolves out of noise
 *   say     one subtitle at the bottom of frame
 *   credit  opening-credits role card: "Yogendra Singh Kapkoti, as …"
 *   figure  a close-up on one number that counts as you scroll
 *   word    a close-up on one word
 *   roll    names arriving like a credit roll
 *   index   the chapter menu (the story is non-linear)
 * The finale rolls end credits (skills, tools, partners, places) into contact.
 * Every word is also in a screen-reader transcript below each chapter.
 */
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform, type MotionValue } from "motion/react";
import { useMemo, useRef, useState } from "react";
import { ArrowDown, GitBranch, Link2, Mail } from "lucide-react";
import { chapters, credits, owner, type Chapter, type Shot } from "@/content/story";
import { sections, type Window } from "@/lib/plan";
import { Brackets, Count, Decode, Echo, Ghosted, clamp01, useMap, useShot } from "./cine";
import { TimeGrid } from "./TimeGrid";
import { film } from "@/lib/film";

type Ctx = { c: Chapter; i: number; p: MotionValue<number>; reduced: boolean; onJump: (id: string) => void };

const SIDE = {
  left: "justify-start sm:ps-[7vw] text-start",
  right: "justify-end sm:pe-[7vw] text-start sm:text-end",
  center: "justify-center text-center",
} as const;

function Layer({ children, side, opacity, visibility, y, hidden = true }: { children: React.ReactNode; side: Chapter["side"]; opacity: MotionValue<number>; visibility: MotionValue<string>; y?: MotionValue<number>; hidden?: boolean }) {
  return (
    <motion.div aria-hidden={hidden || undefined} style={{ opacity, visibility, y }} className={`absolute inset-0 flex items-end px-6 pb-[24vh] sm:items-center sm:pb-0 ${SIDE[side]}`}>
      <div className="text-scrim relative max-w-[min(92vw,44rem)]">{children}</div>
    </motion.div>
  );
}

/**
 * Fit a monumental title to the frame. On wide screens each line stays on one
 * line; long titles (the name) break into two balanced lines. On narrow
 * screens it sizes by the longest word and wraps between words.
 */
const EM_PER_CHAR = 1.27; // display face advance + 0.42em tracking
function fitTitle(title: string) {
  const words = title.split(" ");
  let lines = [title];
  if (title.length > 18 && words.length > 1) {
    let bestMax = Infinity;
    for (let k = 1; k < words.length; k++) {
      const a = words.slice(0, k).join(" ");
      const b = words.slice(k).join(" ");
      const m = Math.max(a.length, b.length);
      if (m < bestMax) {
        bestMax = m;
        lines = [a, b];
      }
    }
  }
  const longestLine = Math.max(...lines.map((l) => l.length));
  const longestWord = Math.max(...words.map((w) => w.length));
  const style = {
    "--fit-sm": `min(2.7rem, ${(86 / (longestWord * EM_PER_CHAR)).toFixed(2)}vw)`,
    "--fit-lg": `min(5.8rem, ${(84 / (longestLine * EM_PER_CHAR)).toFixed(2)}vw)`,
  } as React.CSSProperties;
  return { lines, style };
}

/**
 * Title card. Monumental, centred, very wide tracking, slow fades, nothing
 * else on screen. Each word decodes out of noise from the centre outward,
 * shadowed by a ghost of itself in the chapter colour that slides into
 * register: a timeline collapsing into one. The card creeps toward you.
 */
function Slate({ ctx, shot, w, first }: { ctx: Ctx; shot: Extract<Shot, { kind: "slate" }>; w: Window; first: boolean }) {
  const { c, p, reduced } = ctx;
  const { opacity, visibility, local } = useShot(p, w.a, w.b, false, 0.28);
  const push = useMap(local, [0, 1], [1, 1.05]);
  const rule = useMap(local, [0.14, 0.62], [0, 1]);
  const isName = c.id === "open";
  const { lines, style } = useMemo(() => fitTitle(shot.title), [shot.title]);
  const span = w.b - w.a;
  const ghost = isName ? "#7cffc4" : c.color;
  return (
    <motion.div aria-hidden style={{ opacity, visibility }} className="absolute inset-0 flex items-center justify-center px-5 text-center">
      <div className="text-scrim relative flex flex-col items-center">
        <p className="ps-[0.6em] font-mono text-[10px] uppercase tracking-[0.6em] text-white/45">
          {isName ? shot.slug : first ? `Chapter ${c.index}` : c.index}
        </p>
        <motion.h2 style={{ ...style, scale: reduced ? 1 : push }} className="title-card mt-8 font-display uppercase text-white">
          {lines.map((line, li) => (
            <span key={li} className="block sm:whitespace-nowrap">
              {line.split(" ").map((word, wi) => {
                const at = w.a + span * (0.04 + wi * 0.05 + li * 0.08);
                return (
                  <span key={wi}>
                    {wi > 0 && " "}
                    <Ghosted p={p} a={at} b={at + span * 0.36} text={word} reduced={reduced} color={ghost} center />
                  </span>
                );
              })}
            </span>
          ))}
        </motion.h2>
        <motion.span
          aria-hidden
          style={{ scaleX: rule, background: `linear-gradient(90deg, transparent, ${c.color}, transparent)` }}
          className="mt-9 block h-px w-[min(60vw,32rem)] opacity-70"
        />
        {isName ? (
          <>
            <p className="mt-7 font-serif text-2xl italic text-white/80 sm:text-3xl">{owner.tagline}</p>
            <p className="mt-4 ps-[0.45em] font-mono text-[10px] uppercase tracking-[0.45em] text-white/45">
              {owner.roles} · {owner.markets}
            </p>
          </>
        ) : (
          <p className="mt-7 ps-[0.5em] font-mono text-[10px] uppercase tracking-[0.5em] text-white/50">{shot.slug}</p>
        )}
      </div>
    </motion.div>
  );
}

function Say({ ctx, shot, w }: { ctx: Ctx; shot: Extract<Shot, { kind: "say" }>; w: Window }) {
  const { c, p, reduced } = ctx;
  const { opacity, visibility, local } = useShot(p, w.a, w.b);
  const y = useMap(local, [0, 0.2], [reduced ? 0 : 10, 0]);
  return (
    <motion.div aria-hidden style={{ opacity, visibility, y }} className="absolute inset-x-0 bottom-[17vh] flex justify-center px-6 sm:bottom-[15vh]">
      <p
        className="relative max-w-[34ch] text-center font-serif text-[clamp(1.35rem,2.6vw,2.3rem)] italic leading-snug text-white [text-shadow:0_2px_24px_rgba(0,0,0,0.95),0_0_2px_rgba(0,0,0,0.9)]"
        style={shot.em ? { color: c.color } : undefined}
      >
        {shot.text}
        <Echo p={p} a={w.a} b={w.b} color={c.color} reduced={reduced}>
          {shot.text}
        </Echo>
      </p>
    </motion.div>
  );
}

function Credit({ ctx, shot, w }: { ctx: Ctx; shot: Extract<Shot, { kind: "credit" }>; w: Window }) {
  const { c, p, reduced } = ctx;
  const { opacity, visibility, local } = useShot(p, w.a, w.b);
  const push = useMap(local, [0, 1], [reduced ? 1 : 0.97, 1]);
  const late = useMap(local, [0.18, 0.34], [0, 1]);
  return (
    <Layer side={c.side} opacity={opacity} visibility={visibility}>
      <motion.div style={{ scale: push }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-white/55">{owner.name}</p>
        <p className="mt-2 font-serif text-2xl italic text-white/60">as</p>
        <p className="mt-1 font-display text-[clamp(1.6rem,4.4vw,3.6rem)] uppercase leading-[1.02] tracking-[0.06em]" style={{ color: c.color, textShadow: `0 0 28px ${c.color}55` }}>
          {shot.role.split(" ").map((word, wi) => (
            <span key={wi}>
              {wi > 0 && " "}
              <Ghosted p={p} a={w.a + (w.b - w.a) * (0.03 + wi * 0.03)} b={w.a + (w.b - w.a) * (0.3 + wi * 0.03)} text={word} reduced={reduced} color="#ffffff" />
            </span>
          ))}
        </p>
        <motion.div style={{ opacity: late }}>
          {shot.org && <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.26em] text-white/70">{shot.org}</p>}
          <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.3em] text-white/40">{shot.when}</p>
        </motion.div>
      </motion.div>
    </Layer>
  );
}

function CloseUp({ ctx, w, label, big, caption, note, size = "text-[clamp(3.6rem,12vw,10.5rem)]" }: { ctx: Ctx; w: Window; label: string; big: React.ReactNode; caption: string; note?: string; size?: string }) {
  const { c, p, reduced } = ctx;
  const { opacity, visibility, local } = useShot(p, w.a, w.b);
  const push = useMap(local, [0, 1], [reduced ? 1 : 1.08, 1]);
  const cap = useMap(local, [0.22, 0.4], [0, 1]);
  return (
    <Layer side={c.side} opacity={opacity} visibility={visibility}>
      <p className="font-mono text-[10px] uppercase tracking-[0.42em] text-white/45">{label}</p>
      <motion.div style={{ scale: push }} className={`relative mt-6 inline-block ${c.side === "right" ? "sm:origin-right" : c.side === "left" ? "origin-left" : ""}`}>
        <Brackets color={c.color} />
        <p
          className={`whitespace-nowrap font-display ${size} leading-none tracking-[0.02em] tabular-nums`}
          style={{ color: c.color, textShadow: `0 0 40px ${c.color}66, 0 0 2px ${c.color}` }}
        >
          {big}
        </p>
      </motion.div>
      <motion.div style={{ opacity: cap }}>
        <p className="mt-8 max-w-[26ch] font-serif text-[clamp(1.3rem,2.3vw,2rem)] italic leading-snug text-white/90 sm:inline-block">{caption}</p>
        {note && <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.28em] text-white/45">{note}</p>}
      </motion.div>
    </Layer>
  );
}

function Figure({ ctx, shot, w, n }: { ctx: Ctx; shot: Extract<Shot, { kind: "figure" }>; w: Window; n: number }) {
  const span = w.b - w.a;
  const big = (
    <>
      {shot.prefix}
      <Count p={ctx.p} a={w.a + span * 0.08} b={w.a + span * 0.55} from={shot.from ?? 0} to={shot.value} decimals={shot.decimals} reduced={ctx.reduced} />
      {shot.suffix}
    </>
  );
  return <CloseUp ctx={ctx} w={w} label={`Fig. ${ctx.c.index}.${String(n).padStart(2, "0")}`} big={big} caption={shot.caption} note={shot.note} />;
}

function Word({ ctx, shot, w, n }: { ctx: Ctx; shot: Extract<Shot, { kind: "word" }>; w: Window; n: number }) {
  const span = w.b - w.a;
  const big = <Decode p={ctx.p} a={w.a + span * 0.05} b={w.a + span * 0.45} text={shot.text} reduced={ctx.reduced} />;
  return <CloseUp ctx={ctx} w={w} label={`Fig. ${ctx.c.index}.${String(n).padStart(2, "0")}`} big={big} caption={shot.caption} note={shot.note} size="text-[clamp(2.6rem,7.5vw,6.8rem)] uppercase" />;
}

function RollName({ p, a, b, children, className, style }: { p: MotionValue<number>; a: number; b: number; children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const o = useMap(p, [a, b], [0, 1]);
  const y = useMap(p, [a, b], [14, 0]);
  return (
    <motion.li style={{ opacity: o, y, ...style }} className={className}>
      {children}
    </motion.li>
  );
}

function Roll({ ctx, shot, w }: { ctx: Ctx; shot: Extract<Shot, { kind: "roll" }>; w: Window }) {
  const { c, p } = ctx;
  const { opacity, visibility } = useShot(p, w.a, w.b);
  const span = w.b - w.a;
  return (
    <Layer side={c.side} opacity={opacity} visibility={visibility}>
      <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-white/55">{shot.heading}</p>
      <ul className="mt-6 space-y-2.5">
        {shot.names.map((name, k) => {
          const a = w.a + span * (0.08 + (k / shot.names.length) * 0.4);
          return (
            <RollName key={name} p={p} a={a} b={a + span * 0.1} className="font-display text-[clamp(1.3rem,3.2vw,2.6rem)] font-bold uppercase leading-tight tracking-[0.1em] text-white">
              {name}
            </RollName>
          );
        })}
      </ul>
    </Layer>
  );
}

function Shots({ ctx }: { ctx: Ctx }) {
  const plan = sections[ctx.i];
  let fig = 0;
  let slates = 0;
  return (
    <>
      {ctx.c.shots.map((shot, k) => {
        const w = plan.shots[k];
        switch (shot.kind) {
          case "slate":
            return <Slate key={k} ctx={ctx} shot={shot} w={w} first={slates++ === 0} />;
          case "say":
            return <Say key={k} ctx={ctx} shot={shot} w={w} />;
          case "credit":
            return <Credit key={k} ctx={ctx} shot={shot} w={w} />;
          case "figure":
            return <Figure key={k} ctx={ctx} shot={shot} w={w} n={++fig} />;
          case "word":
            return <Word key={k} ctx={ctx} shot={shot} w={w} n={++fig} />;
          case "roll":
            return <Roll key={k} ctx={ctx} shot={shot} w={w} />;
          case "index":
            return null;
        }
      })}
    </>
  );
}

/** Plain transcript of a chapter for screen readers. */
function Transcript({ c }: { c: Chapter }) {
  return (
    <div className="sr-only">
      <h2>{c.id === "open" ? owner.name : `${c.index}. ${c.title}${c.when ? `, ${c.when}` : ""}`}</h2>
      {c.shots.map((s, k) => {
        switch (s.kind) {
          case "slate":
            return <p key={k}>{s.slug}. {s.title}.</p>;
          case "say":
            return <p key={k}>{s.text}</p>;
          case "credit":
            return <p key={k}>{owner.name} as {s.role}{s.org ? `, ${s.org}` : ""}, {s.when}.</p>;
          case "figure":
            return <p key={k}>{s.prefix}{s.value.toLocaleString("en-US")}{s.suffix}: {s.caption} {s.note}</p>;
          case "word":
            return <p key={k}>{s.text}: {s.caption} {s.note}</p>;
          case "roll":
            return <p key={k}>{s.heading}: {s.names.join(", ")}.</p>;
          default:
            return null;
        }
      })}
    </div>
  );
}

function Section({ i, onJump, children }: { i: number; onJump: (id: string) => void; children?: (ctx: Ctx) => React.ReactNode }) {
  const c = chapters[i];
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const reduced = !!useReducedMotion();
  const ctx: Ctx = { c, i, p, reduced, onJump };
  return (
    <section ref={ref} data-chapter={i} id={`chapter-${c.id}`} className="relative" style={{ height: `${sections[i].heightVh}vh` }}>
      <Transcript c={c} />
      <div className="frame sticky top-0 h-screen overflow-hidden">
        <Shots ctx={ctx} />
        {children?.(ctx)}
      </div>
    </section>
  );
}

function ScrollCue({ p }: { p: MotionValue<number> }) {
  const opacity = useMap(p, [0, 0.05], [1, 0]);
  return (
    <motion.p aria-hidden style={{ opacity }} className="absolute inset-x-0 bottom-[13vh] flex items-center justify-center gap-3 font-mono text-[10px] uppercase tracking-[0.4em] text-white/50">
      Click for sound · scroll to begin <ArrowDown className="h-3.5 w-3.5 animate-bounce" aria-hidden />
    </motion.p>
  );
}

/** End credits roll upward, then the frame settles on contact. */
function Finale({ ctx }: { ctx: Ctx }) {
  const { p, onJump } = ctx;
  const roll = useRef<HTMLDivElement>(null);
  const y = useTransform(p, (v) => {
    const t = clamp01((v - 0.17) / 0.47);
    const h = roll.current?.offsetHeight ?? 1600;
    const vh = typeof window === "undefined" ? 800 : window.innerHeight;
    return vh * (1 - t) - (h + vh * 0.1) * t;
  });
  const rollOpacity = useMap(p, [0.15, 0.2, 0.6, 0.64], [0, 1, 1, 0]);
  const contact = useMap(p, [0.64, 0.71], [0, 1]);
  // After contact has held, it lifts to make room for the index.
  const contactY = useTransform(p, (v) => {
    const vh = typeof window === "undefined" ? 800 : window.innerHeight;
    const narrow = typeof window !== "undefined" && window.innerWidth < 640;
    return (1 - clamp01((v - 0.64) / 0.1)) * 24 - clamp01((v - 0.8) / 0.08) * vh * (narrow ? 0.27 : 0.24);
  });
  const index = useMap(p, [0.84, 0.9], [0, 1]);
  const indexY = useMap(p, [0.84, 0.92], [30, 0]);
  const [live, setLive] = useState(false);
  const [indexLive, setIndexLive] = useState(false);
  useMotionValueEvent(contact, "change", (v) => setLive(v > 0.05));
  const contactScale = useMap(p, [0.8, 0.88], [1, 0.82]);
  useMotionValueEvent(index, "change", (v) => {
    setIndexLive(v > 0.05);
    film.tesseract = v;
  });
  return (
    <>
      <motion.div ref={roll} style={{ y, opacity: rollOpacity }} className="absolute inset-x-0 top-0 flex flex-col items-center px-6 text-center">
        {credits.map((block) => (
          <div key={block.heading} className="mb-[14vh]">
            <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-white/45">{block.heading}</p>
            <ul className="mt-5 space-y-2">
              {block.names.map((n) => (
                <li key={n} className={`font-display uppercase tracking-[0.16em] text-white/85 ${block.names.length === 1 ? "text-[clamp(1.4rem,3.6vw,2.6rem)]" : "text-[clamp(0.8rem,1.4vw,1.05rem)]"}`}>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </motion.div>
      <motion.div style={{ opacity: contact, y: contactY, scale: contactScale, visibility: live ? "visible" : "hidden" }} className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[0.5em] text-white/55">Next chapter · unwritten</p>
        <a
          href={`mailto:${owner.email}`}
          className="pointer-events-auto mt-8 font-display text-[clamp(1.5rem,5vw,4.2rem)] uppercase tracking-[0.12em] text-white transition hover:text-[var(--signal)] focus-visible:text-[var(--signal)] focus-visible:outline-none"
        >
          Let&apos;s talk
        </a>
        <span aria-hidden className="mt-6 block h-px w-[min(70vw,40rem)] bg-[linear-gradient(90deg,transparent,var(--signal),#fff,var(--signal),transparent)] shadow-[0_0_18px_var(--signal)]" />
        <div className="mt-8 flex flex-row flex-wrap items-center justify-center gap-x-8 gap-y-4 sm:gap-10">
          <a href={`mailto:${owner.email}`} className="pointer-events-auto inline-flex items-center gap-3 border border-[var(--signal)]/60 px-6 py-3 font-mono text-xs uppercase tracking-[0.3em] text-[var(--signal)] transition hover:bg-[var(--signal)] hover:text-black focus-visible:bg-[var(--signal)] focus-visible:text-black focus-visible:outline-none">
            <Mail className="h-4 w-4" aria-hidden /> Write to me
          </a>
          <a href={owner.linkedin} target="_blank" rel="noreferrer" className="pointer-events-auto inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-white/65 transition hover:text-white focus-visible:text-white focus-visible:outline-none">
            <Link2 className="h-4 w-4" aria-hidden /> LinkedIn
          </a>
          <a href={owner.github} target="_blank" rel="noreferrer" className="pointer-events-auto inline-flex items-center gap-2 font-mono text-xs uppercase tracking-[0.3em] text-white/65 transition hover:text-white focus-visible:text-white focus-visible:outline-none">
            <GitBranch className="h-4 w-4" aria-hidden /> GitHub
          </a>
        </div>
        <p className="mt-7 font-mono text-[10px] uppercase tracking-[0.4em] text-white/40">{owner.base}</p>
        <button type="button" onClick={() => onJump("open")} className="pointer-events-auto mt-10 hidden font-mono sm:inline-block text-[10px] uppercase tracking-[0.4em] text-white/35 transition hover:text-white focus-visible:text-white focus-visible:outline-none">
          Watch again
        </button>
      </motion.div>
      <motion.div style={{ opacity: index, y: indexY, visibility: indexLive ? "visible" : "hidden" }} className="absolute inset-x-0 bottom-[8vh] flex justify-center px-4">
        <TimeGrid onJump={onJump} live={indexLive} />
      </motion.div>
    </>
  );
}

export function Chapters({ onJump }: { onJump: (id: string) => void }) {
  const last = chapters.length - 1;
  return (
    <div className="relative z-10">
      <h1 className="sr-only">{owner.name}: {owner.tagline}</h1>
      {chapters.map((c, i) => (
        <Section key={c.id} i={i} onJump={onJump}>
          {(ctx) => (i === 0 ? <ScrollCue p={ctx.p} /> : i === last ? <Finale ctx={ctx} /> : null)}
        </Section>
      ))}
    </div>
  );
}
