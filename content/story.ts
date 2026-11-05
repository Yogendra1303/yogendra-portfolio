/**
 * The film's script. Every fact comes from the owner's resume (latest version,
 * November 2026). Nothing here may be invented: change the resume, then this.
 * Written as a screenplay: each chapter is a sequence of shots, shown one at a
 * time while the camera holds on that chapter's world. Narration is first person.
 * No arrows, no "A to B": change is shown by motion (numbers that count, titles
 * that resolve), not by notation.
 */

/**
 * One shot in a chapter. Shots play in order as the visitor scrolls.
 * `crisis` (0..1) marks turbulence: while that shot is on screen, an unseen
 * mass bends the starlight, time dilates, the camera cuts in and the
 * worldline splinters into side timelines. It settles when the story resolves.
 * `shift` changes the worldline's colour from that shot on: a new dimension.
 * (Every chapter's first title card also shifts it to the chapter's colour.)
 */
export type Shot =
  /** Title card: a screenplay slug line and a monumental title. */
  | { kind: "slate"; slug: string; title: string; sub?: string; crisis?: number; shift?: string }
  /** A subtitle: one line of narration, bottom of frame. */
  | { kind: "say"; text: string; em?: boolean; crisis?: number; shift?: string }
  /** Opening-credits role card: "Yogendra Singh Kapkoti as …". */
  | { kind: "credit"; role: string; org?: string; when: string }
  /** A close-up on one number. It counts while you scroll. */
  | { kind: "figure"; value: number; from?: number; prefix?: string; suffix?: string; decimals?: number; caption: string; note?: string; crisis?: number; shift?: string }
  /** A close-up on a word instead of a number. */
  | { kind: "word"; text: string; caption: string; note?: string }
  /** Names that appear like a credit roll. */
  | { kind: "roll"; heading: string; names: string[] }
  /** The chapter index: jump anywhere in the film. */
  | { kind: "index" };

export type Chapter = {
  id: string;
  index: string;
  title: string;
  /** Short label for the HUD and scrubber. */
  when: string;
  coords?: string;
  /** Start year, shown by the time counter while the camera travels. */
  year?: number;
  /** Year the time counter starts from when leaving this chapter (default: year). */
  rollFrom?: number;
  /** The subject sits dead centre: title cards go above it (below it on phones). */
  titleTop?: boolean;
  /** Which side of the frame the words sit on, opposite the subject. */
  side: "left" | "right" | "center";
  color: string;
  shots: Shot[];
};

export const owner = {
  name: "Yogendra Singh Kapkoti",
  tagline: "Nine years. No straight lines.",
  roles: "Strategy · Operations · Program management",
  markets: "India · UAE",
  email: "yogendrakapkoti1309@gmail.com",
  linkedin: "https://www.linkedin.com/in/yogendra-kapkoti-31a8b7100",
  github: "https://github.com/Yogendra1303",
  base: "Gurugram, India",
};

export const chapters: Chapter[] = [
  {
    id: "open",
    index: "00",
    title: "Worldlines",
    when: "",
    side: "center",
    color: "#2bff88",
    shots: [
      { kind: "say", text: "Everyone gets a plan before they get a say." },
      { kind: "say", text: "Study this. Become that. Stay on the line." },
      { kind: "say", text: "I didn't." },
      { kind: "slate", slug: "Nine years · Two countries · One line", title: "Yogendra Singh Kapkoti" },
    ],
  },
  {
    id: "science",
    index: "01",
    title: "The Baseline",
    when: "Before 2014",
    side: "left",
    color: "#9fd4ff",
    shots: [
      { kind: "slate", slug: "School · Science stream · Before 2014", title: "The Baseline" },
      { kind: "say", text: "Science stream. Formulas. Right answers." },
      { kind: "say", text: "Every question had an answer at the back of the book." },
      { kind: "say", text: "Life didn't come with one." },
    ],
  },
  {
    id: "deflection",
    index: "02",
    title: "First Vector",
    when: "2014 – 2017",
    year: 2014,
    side: "right",
    color: "#ffb35c",
    shots: [
      { kind: "slate", slug: "Graduation · University of Mysore · 2014", title: "First Vector" },
      { kind: "say", text: "The plan said science. The pull said business.", crisis: 0.35 },
      { kind: "say", text: "I followed the pull." },
      { kind: "credit", role: "Business student", org: "University of Mysore · Bachelor of Business Administration (Operations)", when: "2014 – 2017" },
      { kind: "say", text: "The degree hadn't arrived yet. I already had.", em: true },
    ],
  },
  {
    id: "gomechanic",
    index: "03",
    title: "Operational Friction",
    when: "2017 – 2023",
    year: 2017,
    coords: "12.97° N  77.59° E",
    titleTop: true,
    side: "left",
    color: "#2bff88",
    shots: [
      { kind: "slate", slug: "Internship · GoMechanic · March 2017", title: "Operational Friction" },
      { kind: "say", text: "Most graduates pick a big name." },
      { kind: "say", text: "I picked a startup. As its first intern." },
      { kind: "say", text: "No playbook. Just whatever broke that day." },
      { kind: "credit", role: "Senior Manager, Operations", org: "Founder's Office · GoMechanic", when: "Mar 2017 – Mar 2023" },
      { kind: "say", text: "Then the real test. A new city. Zero customers." },
      { kind: "slate", slug: "Bengaluru · Karnataka", title: "Day zero", crisis: 0.35, shift: "#4dd8ff" },
      { kind: "say", text: "Bengaluru first. Then the playbook went city to city, across the south." },
      { kind: "figure", value: 5, suffix: "+", caption: "Southern cities, launched on one playbook.", note: "Tier-1 and Tier-2 markets" },
      { kind: "figure", value: 25, suffix: "%+", caption: "Of the company's retail revenue, from a region that started at zero.", note: "Bengaluru and the south" },
      { kind: "figure", value: 5, prefix: "$", suffix: "M+", caption: "GMV portfolio. The P&L was mine, end to end.", note: "50k+ retail · 10k+ fleet" },
      { kind: "figure", value: 50, suffix: "+", caption: "People on the ops team I grew.", note: "With Product: conversion up 30%+" },
      { kind: "roll", heading: "Partnerships I closed", names: ["Ola", "Zoomcar", "BluSmart", "Tata AIG"] },
      { kind: "say", text: "2023. The ground gave way. The company had to restructure.", crisis: 1, shift: "#ff8a2b" },
      { kind: "say", text: "That's when you find out what you really built.", crisis: 0.85 },
      { kind: "figure", value: 70, suffix: "%", caption: "Of my team stayed. Through all of it.", note: "Team retention · GoMechanic · 2023 restructuring", crisis: 0.2, shift: "#2bff88" },
    ],
  },
  {
    id: "gm",
    index: "04",
    title: "Critical Mass",
    when: "2023 – 2024",
    year: 2023,
    coords: "28.46° N  77.03° E",
    side: "right",
    color: "#7cffc4",
    shots: [
      { kind: "slate", slug: "General Manager · GoMechanic · April 2023", title: "Critical Mass" },
      { kind: "say", text: "Walked in as the intern. Six years later, I ran the operation." },
      { kind: "credit", role: "General Manager", org: "Business Operations · GoMechanic", when: "Apr 2023 – May 2024" },
      { kind: "say", text: "Annual plans with the founders. A network that couldn't afford a bad day." },
      { kind: "figure", value: 500, suffix: "+", caption: "Partner workshops, in a network I built and scaled.", note: "Onboarding · training · capacity governance" },
      { kind: "figure", value: 15, suffix: "+", caption: "Cities. One network holding them together." },
      { kind: "say", text: "When I took over, fewer than one in three customers came back.", crisis: 0.9, shift: "#ff5a36" },
      { kind: "say", text: "Complaints from everywhere. The app. The web. The phones.", crisis: 0.7 },
      { kind: "figure", value: 38, from: 31, suffix: "%", caption: "Customers coming back, once every complaint ran through one system. Up from 31%.", note: "As General Manager · one system for app, web and calls", crisis: 0.25, shift: "#7cffc4" },
      { kind: "figure", value: 10, prefix: "+", caption: "Points added to NPS." },
      { kind: "figure", value: 3, prefix: "+", suffix: "%", caption: "Margin, found in fees, pricing and discount discipline." },
    ],
  },
  {
    id: "rightchoice",
    index: "05",
    title: "The Absolute Order",
    when: "2024 – 2025",
    year: 2024,
    coords: "28.46° N  77.03° E",
    side: "left",
    color: "#8fb8ff",
    shots: [
      { kind: "slate", slug: "Enterprise · RightChoice · June 2024", title: "The Absolute Order", sub: "The orbit changed everything. What we carried grew heavier." },
      { kind: "say", text: "Then the gravity flipped." },
      { kind: "say", text: "Thousands of car owners became a handful of enterprise accounts." },
      { kind: "say", text: "Fewer bodies. Far more mass. Lose one, and you feel it.", em: true },
      { kind: "credit", role: "Head of Operations & Delivery", org: "RightChoice", when: "Jun 2024 – Apr 2025" },
      { kind: "roll", heading: "Accounts I owned", names: ["Apollo", "Fortis", "Pizza Hut", "Castrol"] },
      { kind: "figure", value: 100, suffix: "%", caption: "Retention across 15+ enterprise accounts. Not one walked." },
      { kind: "figure", value: 10000, suffix: "+", caption: "Store locations, tracked on SLA in CXO reviews." },
      { kind: "figure", value: 20, prefix: "+", suffix: "%", caption: "User engagement, once we cleared the blockers clients kept hitting.", note: "Activation workflows redesigned from usage data" },
      { kind: "word", text: "15–20%", caption: "Billing growth, from hyper-local rollouts.", note: "Bulk verification · microsites · partner visibility up 50–80%" },
    ],
  },
  {
    id: "consulting",
    index: "06",
    title: "No Fixed Orbit",
    when: "2025 – now",
    year: 2025,
    coords: "25.20° N  55.27° E",
    side: "right",
    color: "#ff8a5c",
    shots: [
      { kind: "slate", slug: "Consulting · Gurugram and Dubai · May 2025", title: "No Fixed Orbit" },
      { kind: "say", text: "For years, I kept clients." },
      { kind: "say", text: "Now I bring them in." },
      { kind: "credit", role: "Program Management Consultant", org: "Business Consulting", when: "May 2025 – now" },
      { kind: "word", text: "Dubai", caption: "A month on the ground, opening a mattress factory's first retail store from zero.", note: "UAE · and operational setup for Al Jouhar Group and Ease Living" },
      { kind: "say", text: "CarEasy's on-demand business, from a blank page: partners, SOPs, launch." },
      { kind: "word", text: "M&A", caption: "Operational due diligence for Spinny.", note: "Workshop capacity · post-acquisition supply chain" },
      { kind: "say", text: "When the right tool didn't exist, I built it. SaaS. WhatsApp flows. AI that finds the leads." },
      { kind: "credit", role: "Project Manager", org: "Operations & Delivery · ConsultBae", when: "Feb 2026 – Jun 2026" },
      { kind: "figure", value: 8, suffix: "%+", caption: "Of ConsultBae's revenue, from four global clients I brought on board.", note: "Centific · Neurix · EQHO · LXT" },
    ],
  },
  {
    id: "all",
    index: "07",
    title: "The Synthesis",
    when: "2014 – 2026",
    side: "left",
    color: "#ffffff",
    shots: [
      { kind: "slate", slug: "Outside time · every moment at once", title: "The Synthesis" },
      { kind: "say", text: "Up close, it looks like chaos." },
      { kind: "say", text: "Science. Business. First intern. Five cities. Five hundred partners. Enterprise. Two countries." },
      { kind: "say", text: "Inside the chaos, there was a pattern all along." },
      { kind: "roll", heading: "The pattern", names: ["Stay close to delivery", "Fix what is broken", "Automate the bottleneck"] },
    ],
  },
  {
    id: "next",
    index: "08",
    title: "Contact",
    when: "",
    side: "center",
    color: "#2bff88",
    shots: [
      { kind: "say", text: "The destination keeps moving." },
      { kind: "say", text: "So do I." },
    ],
  },
];

/** End credits, rolled in the last chapter. */
export const credits: { heading: string; names: string[] }[] = [
  { heading: "Written, lived and operated by", names: ["Yogendra Singh Kapkoti"] },
  {
    heading: "Skills",
    names: [
      "P&L Management",
      "Process Improvement",
      "Escalation Management",
      "Product-Ops Execution",
      "Workflow Automation",
      "AI Development",
      "Hypothesis-Driven Problem Solving",
      "Structured Communication",
      "Business Case Development",
      "Operating Model Design",
      "GTM",
      "Strategic Planning",
      "Stakeholder Management",
      "Cross-Functional Leadership",
      "Advanced MS Excel",
    ],
  },
  { heading: "Languages", names: ["English", "Hindi"] },
  { heading: "Worked alongside", names: ["Ola", "Uber", "Tata AIG", "Zoomcar", "BluSmart", "Apollo", "Fortis", "Pizza Hut", "Castrol", "Spinny", "CarEasy", "Al Jouhar Group", "Ease Living", "ConsultBae", "Centific", "Neurix", "EQHO", "LXT"] },
  { heading: "Locations", names: ["Mysuru", "Gurugram", "Bengaluru", "Dubai"] },
];
