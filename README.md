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
| 01 | Initial Conditions | Science: an atom inside a perfect crystal lattice. |
| 02 | Event Horizon | A ray-marched black hole tears open and bends the starlight (BBA (Operations), University of Mysore, 2014 – 2017). |
| → | Transit | A slow fall toward the horizon, a cut to black, then the wormhole: 2014, 2015, 2016 pass inside; 2017 on the way out. |
| 03 | Turbulence | GoMechanic, 2017 – 2023. The worldline splinters into side timelines at the 2022 restructuring. |
| 04 | Gravity | General Manager, 2023 – 2024: a 500+ workshop network, and a second storm of timelines. |
| → | Dimensional shift | The frame shatters while the camera zooms down an endless lattice of cube frames. |
| 05 | Mass | RightChoice: a swarm (B2C) collapses into 15 heavy orbiting bodies (B2B). |
| 06 | Signal | Consulting and ConsultBae: Gurugram ⇄ Dubai, and out to the USA. |
| 07 | Attractor | A 4D tesseract with every chapter's thread through it. Time stops here. |
| 08 | Order | Let's talk, then the index: enter any moment. |

### The physics of the story

- **Crisis.** Shots tagged `crisis` in `content/story.ts` cut the camera in on the head of the worldline, splinter it into possible futures (most fold back in, some are pruned), bend the starlight around an unseen mass and slow time.
- **Time dilation.** Near the black hole and in a crisis, story time slows: particles, the disk and the HUD's `τ` clock fall behind the viewer's clock `t`.
- **Dimensions.** Shots tagged `shift` (and every chapter's first title card) change the worldline's colour, and the grade leans toward it.
- **Cuts.** `CUTS` in `lib/film.ts` are stretches of the route the camera jumps instead of flying (the horizon, the fracture).

Sound is off until the visitor presses Play or Sound. The score is synthesised live (Web Audio, no recordings): a 40 Hz floor, scroll-driven risers, a braam on every title card, debris hits in turbulence, silence on every cut. With `prefers-reduced-motion` there are no cuts, shakes, flashes, fracture or flicker; the colours, branches, clocks and words carry the same story.

QA shortcut: `?chapter=5&f=0.4` opens chapter 5, 40% of the way through its scroll.

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
- `components/film/worlds/Dust.tsx`: volumetric dust and light bleed
- `scripts/gen-earth.mjs`: rebuilds `content/earth-dots.json` from Natural Earth data
