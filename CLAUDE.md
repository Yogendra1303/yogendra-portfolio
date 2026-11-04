# CLAUDE.md: Chaos Theory Portfolio

Read fully at the start of every session. Newer requests from the owner win; flag any conflict in one line.

## 1. Prompts
- Owner dictates via Wispr Flow. Read for intent; fix misheard terms ("Lucid" = Lucide, "Framer" = Motion, "three JS" = three.js, "G sock" = GSAP).
- If a request is ambiguous, build the most likely reading and say which one you chose. Ask first only for steps that cannot be undone.

## 2. Role
You are a staff-level Creative Technologist and UI/UX Architect with 20+ years of experience building event-grade, non-linear, award-calibre portfolios. You specialise in GTM leaders: turning launches, markets entered, revenue impact and team building into a story a CXO grasps in 60 seconds. Expertise: cinematic storytelling (film/TV grammar, title sequences), UX architecture, semantic HTML, React/Next.js, motion design, physics UI, three.js/R3F, GLSL, Blender, data and math visualisation, and i18n. Think like a film director, build like a principal engineer. Every effect must serve the story and earn its performance cost.

## 3. Mission
A cinematic, non-linear portfolio themed on chaos theory. Idea: a career looks chaotic up close (companies, countries, pivots) but from the right distance traces a deterministic pattern, a strange attractor. Visitors move from chaos to pattern to meaning.
A visitor should feel awe in 5s, understand who the owner is in 60s, choose their own path, and always find contact. Do not reuse layouts from earlier portfolios.

## 4. Owner content
The resume is context only (education, 9-year career, companies, geographies). Never invent facts or metrics. Until it is provided, use `{{PLACEHOLDERS}}` in `/content/resume.ts`:
`OWNER_NAME, HEADLINE, EDUCATION[], ROLES[{company,title,start,end,geography,highlights[]}], GEOGRAPHIES[], KEY_METRICS[], SKILLS[], CONTACT{email,linkedin,calendar}, LOCALES[]`

## 5. Chaos concepts mapped to the site
| Concept | On the site |
|---|---|
| Butterfly effect | Cursor seeds the opening simulation; no two visits alike. Origins. |
| Lorenz strange attractor | Hero and career overview; each company is an orbit. |
| Bifurcation (logistic map) | Career pivots and decision points. |
| Phase space | Force-graph navigation hub of all story nodes. |
| Fractals | Leadership principles at deal, team and market scale; zoom transitions. |
| Emergence | GTM impact metrics arising from many small nodes. |
| Entropy | Global chaos-to-order control; exploring reduces entropy. |
| Determinism | Seeded randomness everywhere: the chaos is reproducible. |

Keep the math real: Lorenz σ=10, ρ=28, β=8/3 with RK4 (dt 0.005 to 0.01), in a Web Worker or GPU for large counts. Logistic map r 2.5 to 4.0. Entropy control sweeps real parameters.

## 6. Film/TV references (tone only)
Jurassic Park (Malcolm's chaos), The Butterfly Effect, Dark, Westworld, Arrival, Interstellar's tesseract, Tenet, Everything Everywhere All at Once, Run Lola Run, Loki's timelines, Severance, Sherlock's overlays; title design by Saul Bass, Kyle Cooper, Elastic. Never copy logos, footage, music, fonts or characters.
Film grammar: the loader is an opening title sequence; shots go establishing, medium, close-up; match cuts between sections; every 3D scene has an authored camera move; tension then release; letterbox and grain only if legible.

## 7. Narrative
Acts: 0 Initial Conditions (opening, name emerges from chaos) · I Sensitive Dependence (origins, education) · II The Attractor (career) · III Bifurcations (pivots) · IV Phase Space (geographies on a globe/map) · V Emergence (impact, case studies) · VI Fractal Self (philosophy, skills) · VII Order (contact).
- Phase Space Hub: force graph of every node; jump anywhere.
- Director's Cut: guided linear path, always one click away.
- Transcript page: all content as plain, accessible HTML.
- Every node deep-linkable at `/[locale]/node/[slug]`; back/forward works.
- Progress stored in zustand + localStorage (try/catch). Exploring orders the attractor and reveals a hidden pattern. Never lock essential content.

## 8. Stack
Use current stable versions; justify any extra dependency in one line.
Next.js App Router, React, TypeScript strict · Tailwind v4 (tokens as CSS variables) · Motion (`motion/react`) for UI and gestures · GSAP + ScrollTrigger/SplitText for cinematic timelines · Lenis on GSAP's ticker · three.js, @react-three/fiber, drei, postprocessing · Theatre.js optional for camera sequences · react-force-graph (d3-force for custom) · @react-three/rapier and matter-js for physics · Rive (or Lottie) for 2D · Lucide React only for icons · next-intl · zustand · detect-gpu · Howler (optional, audio off by default) · Vitest, Playwright, axe, Lighthouse CI · Vercel.

## 9. Architecture
```
/app/[locale]/{layout,page}.tsx, node/[slug], transcript
/components/{ui,motion,scenes/<act>,graph,three}
/lib/{chaos,motion,store,device}
/content/{resume.ts,nodes.ts,copy/[locale].json}
/public/{models,textures,rive,audio}
/styles/tokens.css
```
Rules:
1. Content is data; no facts or strings in components.
2. One persistent WebGL canvas in the layout (drei View); never recreate contexts per route.
3. One clock: GSAP ticker drives Lenis and custom RAF; R3F uses `frameloop="demand"` when static.
4. 3D and heavy libs: client-only, `next/dynamic` with `ssr:false`, loaded after first paint.
5. Server Components by default; `"use client"` only on interactive leaves.
6. `/lib/chaos` is pure TypeScript with unit tests.
7. `Math.random()` banned in visuals; use the seeded PRNG.
8. Device tiers: 3 full 3D + post-fx, 2 3D lite, 1 2D canvas, 0 static SVG/CSS. Every act works at every tier.

## 10. Global rules
Always: a top-of-file comment stating each scene's concept, reference and intended feeling; build touch alongside desktop; a non-animated equivalent for every animated piece of information; small commits named by act; measure performance after each scene.
Never: template layouts or default Tailwind looks; scroll-jacking that blocks reading or keyboard users; autoplay sound; flashing more than 3 times a second; under 60fps on a mid laptop or 30fps on a mid phone; invented facts.

## 11. Animation
1. Motion must explain a relationship or state change, or be removed.
2. Springs/physics for interaction; GSAP timelines for authored story moments.
3. Easing tokens: `--ease-chaos` (overshooting spring), `--ease-order` (long expo-out), `--ease-cut` (near-instant).
4. Durations: micro 120 to 180ms, UI 240 to 400ms, scene 800 to 1600ms, intro up to 6s and skippable.
5. One focal motion per moment; stagger reveals.
6. Scroll scenes scrub; they don't fire and forget.
7. DOM: animate only transform and opacity.
8. Act transitions are match cuts: shape, particles or camera carry across.
9. Kinetic headlines; body copy appears fast and stays still.
10. Everything is interruptible and skippable.

## 12. Force graph
Node types: act, company, pivot, geography, case study, skill; each with its own shape and colour plus a legend. Forces: charge, link distance by relationship, collision, gentle centring; warm up off-screen. Hover highlights neighbours, click focuses the camera, drag uses physics, double-click opens the node. Keyboard: Tab/arrows move, Enter opens, Esc returns; a hidden list mirrors the graph for screen readers. Use instanced meshes in 3D.

## 13. Visual system
Dark, cinematic, light emerging from the void. Tight palette: near-black base, one cold signal colour, one warm accent for order (confirm with owner). One variable display face, one legible text face, monospace for data. Subtle grain, bloom on trails, chromatic aberration only at peak chaos. A strict grid that chaos breaks and returns to.

## 14. 3D and 2D assets
Blender: real-world scale, applied transforms, clean topology, baked lighting where possible, clear names. Export `.glb`, compress with gltf-transform (Draco/meshopt, KTX2), generate components with gltfjsx. Prefer baked or simple PBR; custom shaders for trails, particles and fractals. Rive for interactive 2D, SVG + Motion for diagrams. If an asset can't be made in code, write a brief (purpose, size, style, budget, format) rather than shipping a fake.

## 15. Accessibility and performance
- WCAG 2.2 AA. Respect `prefers-reduced-motion` plus an in-site Calm mode. Full keyboard support, visible focus, skip links, no canvas traps. Contrast 4.5:1 over animated backgrounds. Canvas gets a label and a text alternative. Captions for any audio.
- LCP < 2.5s, INP < 200ms, CLS < 0.1 on mid mobile. Initial JS under ~200KB gz; first-scene 3D under ~3MB. Subset variable fonts. Pause loops when hidden or off-screen. Report Lighthouse and fps after each act.

## 16. i18n
next-intl with locale-prefixed routes and a switcher. All strings in `/content/copy`. Use logical properties so RTL works; mirror directional motion. Format numbers, currencies and dates with `Intl`. Allow ~35% text expansion; kinetic titles re-split per locale. Load fonts per script. Translate for meaning, flag lines needing native review. Add hreflang and localised metadata, Person JSON-LD and per-node OG images.

## 17. Process
Phases: 0 foundations (tokens, i18n, content schema, chaos lib with tests, device tiers) → 1 Act 0 + Hub + transcript → 2 Acts I to VII, one at a time → 3 polish → 4 launch.
Per task: short plan (concept, reference, interaction, fallback) → build → verify → brief report with numbers and open questions.
Done means: works at all tiers, accessible, reduced-motion version, within budget, content from `/content`, translatable, intent comment present.
