# Yogendra Wispr Portfolio · Worldlines

A nine-year career told as one continuous shot through space. Scroll moves the camera; each chapter is a world.

## Run it locally

```bash
npm install
npm run dev
```

Open **http://localhost:24267** (Chrome also accepts http://chaos.localhost:24267).

## The film

A browser-based cinematic sequence of a nine-year career arc. Scroll to move through it, or press **Play the film** (top right) and it plays itself, about four and a half minutes, with its score. Any scroll, swipe or key hands control back.

| # | Chapter | World |
|---|---|---|
| 00 | Worldlines | A green thread of light runs straight into the distance: the path you are handed. |
| 01 | The Baseline (school) | Science: an atom inside a perfect crystal lattice. |
| 02 | A First Vector (college) | A ray-marched black hole tears open, bends the starlight and pulls the camera into orbit (BBA (Operations), University of Mysore, 2014 – 2017). |
| → | Transit | A slow fall toward the horizon, a cut to black, then the wormhole: 2014, 2015, 2016 pass inside; 2017 on the way out. |
| 03 | Operational Friction (GoMechanic, startup years) | GoMechanic, 2017 – 2023: first intern, then Day zero in Bengaluru. At the 2022 restructuring the worldline splinters and a wormhole throws out light. Click the globe to open a wormhole in it. |
| 04 | Critical Mass (General Manager) | General Manager, 2023 – 2024: a 500+ workshop network, repeat usage 31% to 38%, and a second storm of timelines. |
| → | Dimensional shift | The frame shatters while the camera zooms down an endless lattice of cube frames. |
| 05 | The Absolute Order (enterprise) | RightChoice: a swarm (B2C) collapses into 15 heavy orbiting bodies (B2B). |
| 06 | No Fixed Orbit (consulting) | Program management consulting and ConsultBae: Gurugram ⇄ Dubai. |
| 07 | The Synthesis | The tree of timelines: every strand drawn in from the dark, burnt orange turning green, bound into one glowing trunk. Time stops here. |
| 08 | Order | Initiate contact. Then the climax, an event horizon: the frame bends around a dark centre and cracks open into the tesseract: a corridor of every moment; drag through time and enter any of them. |

### The physics of the story

- **Crisis.** Shots tagged `crisis` in `content/story.ts` cut the camera in on the head of the worldline, splinter it into possible futures (most fold back in, some are pruned), bend the starlight around an unseen mass and slow time.
- **Time dilation.** Near the black hole and in a crisis, story time slows: particles, the disk and the HUD's `τ` clock fall behind the viewer's clock `t`.
- **Dimensions.** Shots tagged `shift` (and every chapter's first title card) change the worldline's colour, and the grade leans toward it.
- **Cuts.** `CUTS` in `lib/film.ts` are stretches of the route the camera jumps instead of flying (the horizon, the fracture).

The score starts with the visitor's first click (browsers need a gesture) and then never stops; Sound turns it off. It is synthesised live (Web Audio, no recordings): a constant bed (a pad that changes chord each chapter, a shimmer, a 40 Hz floor, air), with scroll-driven risers, a braam on every title card, debris hits in turbulence and dips on every cut. With `prefers-reduced-motion` there are no cuts, shakes, flashes, fracture or flicker; the colours, branches, clocks and words carry the same story.

QA shortcut: `?chapter=5&f=0.4` opens chapter 5, 40% of the way through its scroll.

## Cinematic architecture

One continuous shot: a single persistent WebGL canvas (React Three Fiber) behind a scroll-driven text layer. Scrolling is the timeline; nothing fires and forgets.

- **Edit and story state** (`content/story.ts`, `lib/plan.ts`, `lib/film.ts`): the screenplay is data (shots: title cards, subtitles, credits, figures, rolls). The plan turns it into scroll windows; `film` turns scroll into a camera coordinate `u`, a story coordinate `s`, and physics: crisis, gravity, time dilation, fracture, hard cuts, the final event horizon.
- **Camera** (`Director.tsx`): a critically damped spring with mass along an authored route; slow creep and lens push-in through each hold; weightless drift and about 2° of roll; crisis cut-ins with debris knocks; the breakaway lunge and wide stretch into stillness; hard cuts across the horizon and the fracture.
- **Worlds** (`components/film/worlds/`): a ray-marched black hole, the wormhole, holographic Earths from Natural Earth data, the partner network, the B2C-to-B2B orbits, the dimensional lattice, the 4D tesseract, the career worldline with its branching side timelines, volumetric dust.
- **Light** (`lib/lens.ts`, `Backdrop.tsx`, `Effects.tsx`): real point-lens gravitational lensing of the sky; a baked nebula cube map; light shafts at quarter resolution; anamorphic flares; a displacement pass that bends light around crises, clicks and the final horizon; bloom, fringing, grade, 24 fps grain.
- **Words** (`Chapters.tsx`, `cine.tsx`): monumental title cards that decode out of noise with a ghost of themselves; subtitles with an echo; counting figures; the words bend with gravity in a crisis.
- **Sound** (`lib/score.ts`): synthesised live with Web Audio. A constant bed (organ-like pad per chapter, 40 Hz floor, shimmer, air) with scroll-driven risers, title braams, debris hits, the wormhole slam and swell.
- **The end** (`TimeGrid.tsx`): initiate contact, an event horizon, then the tesseract: a corridor of every moment to scroll or drag through and enter.
- **Frame** (`Hud.tsx`, `ResumeCard.tsx`): name (returns home through a dark wormhole), the digital résumé, Play the film, the two clocks (t and τ), letterbox, year counter.

**Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, three.js with @react-three/fiber, drei and postprocessing, Motion, Lenis, Web Audio, Lucide. Reduced motion is respected throughout. Deploys as a static site (Vercel).

## Where things live

- `content/story.ts`: the screenplay, every word on screen as shots (slate, subtitle, credit, figure, word, roll), facts from the resume only
- `lib/plan.ts`: the edit: how long each chapter holds and when each shot plays
- `lib/film.ts`: scroll → camera and story state (crisis, gravity, dilation, fracture, cuts)
- `lib/timeline.ts`: how far the worldline has grown, its colour stops and its branches, derived from the screenplay
- `lib/lens.ts`: gravitational lensing of the sky (shared shader code and the masses)
- `lib/stage.ts`: positions of every world, the camera route and the career curve
- `components/film/Director.tsx`: the camera operator (spring, creep, cuts, crisis cut-ins)
- `components/film/Effects.tsx`: fracture, bloom, light shafts, lens fringing, grade and grain
- `components/film/cine.tsx`: counting numbers, close-up frames, shot timing
- `components/film/worlds/`: one file per world (`Lattice.tsx` is the dimensional shift)
- `components/film/Chapters.tsx`, `Hud.tsx`: the text (decoding, ghosted title cards, subtitles, credits, the closing index) and the frame (letterbox, Play, clocks, the year counter, gravity on the words)
- `components/film/useAutoplay.ts`, `lib/playback.ts`: Play the film
- `lib/score.ts`: the score
- `components/film/ResumeCard.tsx`, `content/resume.ts`: the digital résumé (top left); the name returns to the first frame
- `components/film/worlds/Dust.tsx`: volumetric dust and light bleed
- `scripts/gen-earth.mjs`: rebuilds `content/earth-dots.json` from Natural Earth data
