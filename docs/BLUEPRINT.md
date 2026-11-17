# KESSLER — Build Blueprint v1

*Working title (Kessler syndrome = the real orbital chain-collision hazard). Check that the name is free on GitHub and itch.io before committing. Fallbacks: DEBRIS, CASCADE, STARFALL.*

## 0. How to use this document

1. Make a new pseudonymous GitHub account and a **public** repo (public = free Pages + free Actions). See section 11 for the anonymity checklist.
2. Save this file as `docs/BLUEPRINT.md` in the repo. It is the spec the agent reads. Paste the AGENTS.md block from section 12 at the repo root.
3. Run the phase prompts in section 12 **one per fresh Antigravity conversation**, in order. Commit after each phase.
4. Never prompt "build the whole game". The free plan has a weekly quota, so small scoped tasks with a plan-first step waste the least.
5. **First ship = phases P0 to P5** (playable daily puzzle on GitHub Pages). Everything after that is optional and independent.

## 1. Concept

You are the flight-dynamics officer on a derelict orbital shell packed with debris. You get **one Spark**. Place it on any empty cell. It detonates, fires rays along lines, ignites whatever it hits, which fire more rays. The cascade is the game. Your score is judged against a solver that tried every placement.

Each cascade draws a **constellation** (the ignited bodies as stars, the rays as lines). That picture, with a generated name, is the shareable result.

**Pillars**

1. One decision, long consequence: 10 seconds to read, 3 minutes to think, 20 seconds to watch.
2. Fair and legible: fully deterministic rules, first-hit ray previews on hover, nothing random at play time.
3. Self-running: the daily board is a pure function of the date. AI and live data only add flavor and can fail without breaking anything.
4. Hand-made look: strict palette, authored shapes, no generic UI kit (section 6).
5. Free forever: no paid dependency. Every external service is optional.

## 2. Rules spec (RULESET v1)

Grid W x H (7x7 up to 11x11). x grows east, y grows south. A cell is empty or holds one body.

| Code | Name | Behavior | Value | Phase |
| --- | --- | --- | --- | --- |
| CIN | Cinder | When ignited, detonates next tick: 4 orthogonal rays | 10 | 1 |
| SHD | Shard | Same, 4 diagonal rays | 10 | 1 |
| BCN | Beacon | Inert target. Destroyed next tick after a hit, no rays | 40 | 1 |
| SNG | Singularity | Permanent. Absorbs any ray that reaches it | n/a | 1 |
| MRF, MRB | Mirror / and \\ | Permanent. Turns orthogonal rays 90 degrees, the ray continues. Diagonal rays pass through | n/a | 1 |
| LNH, LNV | Lance | Detonates next tick: piercing rays along its axis, both ways. Piercing rays ignite every body on the line | 15 | 2 |
| PLT | Plated | Needs 2 hits (cumulative across ticks), then acts as CIN | 20 | 2 |
| FUS | Fuse | Acts as CIN but detonates 3 ticks after ignition | 15 | 3 |
| WRM | Wormhole (paired by id) | Permanent. A ray entering one exits the partner, same direction | n/a | 3 |

Mirror turns: `/` E to N, N to E, W to S, S to W. `\` E to S, S to E, W to N, N to W.

**Spark types** (the daily says which one you get): CROSS (acts like CIN), SKEW (like SHD), LANCE (like LNH or LNV, rotate with R).

**Tick loop** (t starts at 1)

1. Emitters at tick t: the Spark when t is 1, afterwards every body scheduled to detonate at t.
2. Remove all emitters from the grid (they are now empty space). Record each as destroyed at tick t.
3. For each emitter in row-major order and each of its ray directions, trace one cell at a time: off-board ends the ray; empty continues; SNG ends it; mirror turns it; wormhole teleports it; any ignitable body registers a hit and ends the ray (a piercing ray registers and continues). Guard: a ray ends after W*H*4 steps.
4. Apply hits only after all rays are traced, so nothing depends on emitter order. For each hit cell: reduce toughness by the number of hits (PLT starts at 2, all others at 1). At 0 or below and not already scheduled, schedule detonation at t+1 (FUS: t+3). Bodies scheduled but not yet detonated stay solid and stop rays; extra hits on them do nothing.
5. t increments. Stop when no emitters remain and nothing is scheduled.

**Scoring (integers only, displayed divided by 10)**

- Each destroyed body adds `value * mult(t)`, where t is its detonation tick and `mult(t) = min(30, 8 + 2t)`. First ring (t = 2) gets 12, so deeper chains pay more.
- Convergence: +5 for every extra simultaneous hit on a body in the tick it ignited.
- Clean sweep: +100 if every destroyable body was destroyed.
- The Spark itself scores nothing.

**Hand-check fixture (write this test first, verify by hand)**: board 5x1 = `. . CIN . CIN`, Spark at x=0. Expect destroyed = 2, last tick = 3, score = 120 + 140 + 100 = 360 (displays 36.0). Have the agent add four more fixtures (mirror, Shard, convergence, Singularity block) and **verify at least two yourself** before trusting any of them.

**Determinism law**: `src/core` uses integer math only. No Math.random, no Date, no floating point, no Intl, no object-key-order reliance, typed arrays, explicit sort orders. This is what lets every player get the same board with no server, and lets a future server re-verify scores.

## 3. Result and sharing

ratio = score / optimum (from the solver).

| Grade | Ratio |
| --- | --- |
| PERFECT | 100% |
| NOVA | 90% or more |
| FLARE | 75% or more |
| SPARK | 50% or more |
| DUD | under 50% |

The grade is a drawn ring-segment glyph (no emoji). After the run, a button "See the perfect line" replays the optimal placement. That is the learning loop and the reason to come back tomorrow.

Share text (plain, works anywhere):

```
KESSLER #42 · Tue
NOVA 91% · chain 9 · 31.4
Constellation: Vela Orrin
https://<pages-url>
```

Share image: 1080x1350 canvas PNG made in-browser (dithered starfield, the cascade as a constellation graph, generated name, day number and grade). Use Web Share API with file when available, otherwise download plus copy text. The constellation name comes from a syllable table seeded by the event-log hash, so identical cascades get identical names.

## 4. Daily challenge and generator

`seed = hash32("KESSLER|v1|YYYY-MM-DD")` using xmur3 then mulberry32 (integer implementations). `dayNumber = days since LAUNCH_DATE + 1`, with LAUNCH\_DATE a constant in config. Date is the player's local date, so the board flips at local midnight like Wordle. Everyone with the same local date sees the same board, computed in the browser.

**Generator (`generate(seed, difficulty)`)**

1. Scatter bodies by profile (size, body count, type weights, permanent-obstacle share capped at 15% of cells) with minimum-spacing rules so there are no isolated dead bodies.
2. Run the solver on every empty cell (and every allowed Spark).
3. Accept only if every quality gate passes. Try up to 300 attempts. If none pass, return the best attempt with `degraded: true` (CI fails if more than 2% of the next 365 days are degraded).
4. Run in a Web Worker with a 1.5 s budget and cache the result in localStorage by date.

**Quality gates** (these are what make boards feel designed, not random)

- Optimum chain depth at least D (by weekday, below).
- Optimum destroys 40% to 90% of destroyable bodies.
- Placements within 90% of optimum: between 1 and K (by weekday). One is allowed, many means trivial.
- Median placement scores under 45% of optimum.
- Decoys: at least 2 placements scoring 60% to 85% of optimum that sit 3 or more cells from the optimal cell. These create the "so close" moments.
- Optimum is not a clean sweep on weekdays (a perfect clear is a weekend treat).

**Weekly calendar**

| Day | Size | Bodies unlocked | Spark | D | K |
| --- | --- | --- | --- | --- | --- |
| Mon | 7x7 | CIN, SNG | CROSS | 4 | 6 |
| Tue | 8x8 | + MRF, MRB | CROSS | 5 | 5 |
| Wed | 8x8 | + SHD, BCN | SKEW | 5 | 4 |
| Thu | 9x9 | + LNH, LNV | CROSS | 6 | 3 |
| Fri | 9x9 | + PLT | LANCE | 6 | 3 |
| Sat | 10x10 | + FUS, WRM | SKEW | 8 | 2 |
| Sun | 11x11 | all + a mutator | CROSS | 8 | 2 |

Until a body type exists in code, the calendar silently uses the subset that exists.

**Sunday mutators**: SOLAR\_WIND (rays travel at most 6 cells), DEAD\_ZONE (a 3x3 patch that absorbs rays), TWIN\_SPARK (place two Sparks, both fire on tick 1; solver checks all pairs).

**Versioning**: `RULESET_VERSION` and `GENERATOR_VERSION` are part of the seed string. Never change shipped behavior. Add v2 and keep v1 for the archive. A golden test locks the board hash of the first 400 days; it must fail loudly if anything drifts.

## 5. Modes and progression

| Mode | What | Why |
| --- | --- | --- |
| Daily Sector | One official attempt per day (locks after placement). Afterwards "Replay" is unranked | The habit and share loop |
| Orbits (campaign) | 60 generated-then-frozen levels in 6 orbits (rings on a map), each introducing one mechanic. Goals: reach par, or ignite all Beacons. Medals are drawn shapes | Portal retention, teaches the game |
| Free Drift | Endless random sectors, difficulty chosen | Portal replayability |
| Hints | Tier 1: shows the best chain length. Tier 2: highlights a 3x3 area containing the optimum. Tier 3: reveals the cell. All from the solver, no AI. On portals, rewarded ad unlocks a tier | Fair monetization |
| Sector codes (phase 9) | Any board serializes to a URL hash. Share a board, challenge a friend, optional editor | Community content with no backend |
| Streaks and stats | Local only: streak, grade distribution, best chain | Retention |

Tutorial is interactive: three tiny pre-built boards using the real simulator, no text walls.

## 6. Art bible (this is what keeps it from looking AI-generated)

**Direction**: mission-control technical drawing printed on a cheap press. Flat shapes, hard outlines, offset misregistration. Warm paper-white ink on night blue, one hot accent.

**Palette. Exactly these, hard-coded as CSS variables and a TS const. No other colors, ever.**

| Token | Hex | Use |
| --- | --- | --- |
| `--void` | #0B0F1C | Page and space background |
| `--hull` | #141B2F | Panels and board plate |
| `--grid` | #26304D | Grid lines, dividers |
| `--chalk` | #EDE6D1 | Primary text, outlines |
| `--dust` | #8C93A8 | Secondary text, disabled |
| `--ember` | #FF5A2B | Ignition, rays, primary button |
| `--solar` | #FFC53D | Beacons, score, highlights |
| `--coolant` | #3FD0C0 | Previews, safe or info states |
| `--rust` | #A8452D | Spent, cracked, damaged |

**Banned**: gradients, blur, glow, soft shadows, glassmorphism, purple or neon-cyan sci-fi look, rounded-pill buttons, emoji as icons, icon libraries, stock illustrations, centered hero-card layouts.

**Allowed texture**: hard 2px offset shadows (misregistration, no blur), a 4x4 Bayer ordered dither for starfield and depth, 2px chalk outlines, chamfered 45-degree panel corners instead of rounded rectangles.

**Shapes**: every body is a hand-authored integer vertex array on a 24x24 grid in `src/app/render/shapes.ts`, drawn with Canvas2D paths. Rocks are slightly irregular polygons, never circles. Make 3 variants per rock type and pick by cell-hash so neighbors differ but the board is stable between runs. Anchor example for the Cinder rock: `[4,9, 8,4, 15,3, 20,8, 21,15, 16,21, 9,20, 3,15]`.

| Body | Silhouette |
| --- | --- |
| Cinder | Rock polygon with four short tick marks N/E/S/W |
| Shard | Rotated angular crystal with an X scratched in |
| Lance | Elongated capsule with arrowheads on its axis |
| Plated | Rock with a second inset outline (armor) that cracks to rust when hit |
| Fuse | Rock with a burning stub and 3 countdown pips |
| Beacon | 8-point star, solar yellow, pulsing in 2 steps (no easing) |
| Singularity | Solid void disc with a broken accretion ring drawn as 3 arcs |
| Mirror | Thin slab at 45 degrees with two bracket mounts |
| Wormhole | Concentric rings, paired ones share a notch glyph |

Color is never the only signal: every body is distinguishable in monochrome (shape plus pattern).

**Type**: Big Shoulders Display (headings, industrial condensed) and IBM Plex Mono (numbers and UI). Both are open-licensed Google Fonts. **Self-host the woff2 files** (portals block outside requests). Swap if you find something with more character, but keep it to two families.

**Motion**: no easing curves, stepped animation only. Ray draws in 3 steps: 2px chalk core over a 4px ember underlay offset (1,1). Impact: 8 square 2x2 px sparks with integer velocities. 40 ms hitstop per tick. Screen nudge max 2 px. Tick time 260 ms with 1x, 2x and skip. Honor `prefers-reduced-motion`.

**Sound**: pure WebAudio synthesis, zero audio files. Each detonation plays a note from an A-minor pentatonic scale, index = min(depth, 14), square plus triangle blend with a short noise burst. Chains climb in pitch, so a long cascade sounds like a rising run. Audio starts on first gesture, mute persists. Optional `navigator.vibrate` on mobile.

**Layout**: one layout engine that supports 16:9 landscape (board left of center, HUD right) and portrait (board top, HUD bottom). Integer pixel scaling so lines stay crisp. Keyboard play: arrows move the cursor, Space places, R rotates, U undoes (non-daily).

**Screens**: Home (today's sector, countdown, streak), Play, Result, Archive, Orbits map, Settings, How to play, Credits and Privacy.

**Accessibility**: shapes plus color, reduced motion, large-text option, keyboard complete, ARIA live region announces the result.

## 7. Architecture and tech

**Stack**: TypeScript (strict), Vite, vanilla Canvas2D plus a thin DOM layer for menus, **zero runtime dependencies** (target under 300 KB gzipped total), Vitest, Playwright, ESLint with a rule forbidding DOM, Date and Math.random inside `src/core`, size-limit. Use the current Node LTS.

```
kessler/
  AGENTS.md
  .agents/rules/        architecture.md  art-bible.md  determinism.md
  .agents/workflows/    add-body-type.md  audit-daily.md  release-portal.md
  docs/BLUEPRINT.md
  src/core/             types rng sim solver generate score codec constellation  (pure, no DOM)
  src/app/              render/ ui/ audio/ input/ platform/ storage/ main.ts
  src/worker/           leaderboard (phase 9)
  tools/                audit-daily  gen-campaign  fetch-feeds  gen-flavor  size-check
  data/                 campaign/  flavor/  feeds/  boards/
  tests/                golden/  e2e/
  .github/workflows/    ci  deploy  content  audit  release
```

**Core interfaces (paste into types.ts as the contract)**

```ts
export type Kind = 'CIN'|'SHD'|'LNH'|'LNV'|'PLT'|'FUS'|'BCN'|'SNG'|'MRF'|'MRB'|'WRM';
export interface Cell { kind: Kind; pair?: number }
export interface Board {
  w: number; h: number; cells: (Cell | null)[];
  spark: 'CROSS' | 'SKEW' | 'LANCE'; mutator?: string;
  rulesetVersion: number;
}
export interface Placement { x: number; y: number; rot?: 0 | 1 }
export type SimEvent =
  | { t: number; type: 'detonate'; x: number; y: number; kind: Kind }
  | { t: number; type: 'ray'; path: [number, number][] }
  | { t: number; type: 'hit' | 'crack' | 'absorb' | 'deflect' | 'teleport'; x: number; y: number };
export interface SimResult { score: number; destroyed: number; lastTick: number; events: SimEvent[]; hash: string }
export function simulate(b: Board, p: Placement): SimResult;
export function solve(b: Board): { best: Placement; bestScore: number; scores: Int32Array; stats: SolveStats };
export function generate(seed: number, d: Difficulty): { board: Board; stats: SolveStats; attempts: number; degraded: boolean };
```

The simulator returns an **event log** and never draws. The renderer, the audio, the share image and the replay all consume the log. That separation is what keeps this maintainable.

**Performance budgets**: solve 11x11 in under 100 ms on a mid phone; generate under 1.5 s in a worker; first paint under 1 s.

**Persistence**: localStorage wrapped in try/catch (it can be empty or blocked), versioned schema, no personal data. Portals use their SDK storage via the platform adapter.

## 8. Automation: how it runs itself

**Failure ladder** (each level is optional, the one below always works)

1. Core engine: daily board is a pure function of the date. No dependencies at all.
2. Static flavor JSON (briefings, quips). If missing, template generator with word lists.
3. Live-data JSON (feeds). If missing, hide the card.
4. Leaderboard. If down, hide it.

**GitHub Actions** (free for public repos on standard runners; verify)

| Workflow | Trigger | Does |
| --- | --- | --- |
| ci | push, PR | lint, typecheck, unit tests, build, size budget, Playwright in Chromium, Firefox and WebKit asserting identical board hashes for 365 days |
| deploy | push to main, daily 00:30 UTC, manual | refresh feeds (keep last good file on failure), build, publish to GitHub Pages |
| content | weekly | feeds then flavor generation then validation, commits `data/` and `data/boards/` for the next 30 days, then triggers deploy |
| audit | weekly | run quality gates on the next 60 boards, check the last content run was under 14 days ago, open a GitHub Issue on any failure (you get an email) |
| release | tag v\* | build portal zips and attach them to the release |
| dependabot | weekly | dependency PRs, auto-merge patch and minor when ci is green |

**Gotchas (real ones)**: a push made with the default GITHUB\_TOKEN does **not** trigger other workflows, so run deploy inside the content workflow or fire `workflow_dispatch` through the API. GitHub can auto-disable scheduled workflows after a long period with no repo activity, so the audit job checks for staleness. Pages from a private repo is not free, keep it public.

**Live data (real facts, nothing invented)**

- Wikimedia "On this day" REST feed, filtered by spaceflight keywords, for a result-screen line "On this day in spaceflight".
- NASA open APIs (free key from api.nasa.gov): Astronomy Picture of the Day (store title and link only, skip anything with a copyright field, do not host the image) and Near Earth Object data to name the day's sector after a real asteroid.
- The Space Devs Launch Library 2 for a "next launch" card (rate-limited, so fetch in the Action and ship static JSON, never from the client).

**AI flavor pipeline (`tools/gen-flavor.ts`)**

AI writes only: sector name plus a 2-sentence briefing per day, and ground-control quips per grade (pool of 40 per tier). It never touches gameplay.

- Key from Google AI Studio stored as repo secret `GEMINI_API_KEY`. Use the cheapest free Flash or Flash-Lite model your dashboard lists, with the model name in a config variable (names churn). Free limits have changed repeatedly, so the design needs at most about 5 calls per week, with backoff and caching.
- Also worth checking: GitHub Models (free rate-limited inference authenticated by the Actions token). Verify availability before relying on it.
- Prompt contains only the feed JSON as INPUT and the instruction "state no fact that is not in INPUT". Output is validated with a schema (zod), max 140 characters per line, banned-word list, no real people or brands. Anything that fails validation falls back to the template generator. Never blocks the pipeline.
- Tone guide in the prompt: dry, mission-log, a little gallows humor. No exclamation marks, no "journey", no "cosmic".

## 9. Platforms and publishing

**Platform adapter** (`src/app/platform/`): one interface, build-time flag `__PLATFORM__` set by `vite build --mode <name>`.

```ts
interface Platform {
  init(): Promise<void>; loadingStart(): void; loadingStop(): void;
  gameplayStart(): void; gameplayStop(): void;
  midgameAd(): Promise<void>; rewardedAd(): Promise<boolean>;
  save(k: string, v: string): Promise<void>; load(k: string): Promise<string | null>;
}
```

Implementations: `web` (GitHub Pages, cookieless analytics, Web Share), `itch` (plain, no ads), `crazygames`, `poki`, `gamedistribution`. Portal builds: no analytics, no outside requests, fonts self-hosted, no own ads and no outbound links, only the portal's SDK ads. `npm run build:portal -- --platform=crazygames` produces a zip. The size-check tool fails the build over budget.

**Portal facts to design around** (verify at submission time)

- CrazyGames: HTML5 upload through their developer portal, QA review, ads only through their SDK, initial download 50 MB or less (you will be near 2 MB). Prefers games not previously on other portals.
- Poki: curated, human-reviewed. Small initial download (about 8 MB), 16:9 canvas that scales to desktop and mobile, SDK required, asks for web exclusivity.
- itch.io: open. ZIP with index.html plays in-page. Good for first public feedback and jams.
- Order: GitHub Pages is your home. Before posting to several portals, read each exclusivity clause. If you want portal revenue, submit the portal build first, then add itch.io.

## 10. Community and growth without personal promotion

**Loops built into the product**

- Constellation share image plus a day number. "Did you get #42?" is the conversation.
- "See the perfect line" ends every run on a reason to play tomorrow.
- Board codes in the URL hash: challenge any friend on any board.
- Streaks.

**Distribution (do this by hand, a few times, with care)**

- Post as a puzzle, not an ad: one clear sentence, a screenshot of a constellation, "free, no ads, no signup". Read each community's self-promotion rules first.
- Candidates: Show HN, r/WebGames, puzzle and space communities that allow it, itch.io web game jams (a jam submission of the Orbits campaign gives you a built-in audience).
- Discord server (free) plus GitHub Discussions. The daily Action posts the day's link to a Discord webhook.

**SEO warning from the research**: Google's 2026 enforcement hits scaled thin pages. So do not generate a page per day. Keep about 5 indexable pages (home, how to play, rules, about, privacy) and keep the archive as client-side hash routes.

## 11. Anonymity, privacy and money

**Anonymity checklist**

- New email, new GitHub account, same handle everywhere (GitHub, itch.io, Discord, Reddit).
- GitHub: use the noreply commit email, enable "Block command line pushes that expose my email", set `git config user.email` to the noreply address before the first commit, check `git log` for leaks.
- Credits page lists only the handle. No real name in package.json, LICENSE, fonts credits or metadata.
- Anonymity ends at payout: payment providers need a legal identity and an eligible adult account. Handle that only if and when money arrives.

**Privacy**: no accounts, no cookies, no personal data, localStorage only, cookieless analytics (GoatCounter or Cloudflare Web Analytics) on the web build only. Say so on the privacy page.

**Money path (nothing is needed to start)**

1. Launch free and ad-free on Pages.
2. Portal ad revenue share via their SDKs (CrazyGames pays monthly after a minimum balance, check current terms).
3. itch.io tips or pay-what-you-want.
4. Own domain plus ads only after real traffic. The domain is the first thing that costs money, about 10 USD a year, and ad networks usually need it.

License: MIT for code, OFL for fonts, everything else yours. All audio is synthesized so there is nothing to license.

## 12. Antigravity operating manual

**Setup notes**

- Free plan: usage is limited by a weekly quota and depends on how much work the agent does per prompt. So: plan first, one phase per conversation, small diffs, tests as the spec.
- Antigravity reads `AGENTS.md`, `GEMINI.md` and workspace rules in `.agents/rules/` (some docs and older builds show `.agent/rules/`; if a rule does not appear in the Customizations panel, use the folder name that panel shows). Each rules or workflow file is limited to 12,000 characters, so keep files short. Workflows are slash commands from `.agents/workflows/<name>.md`.
- The agent can run the dev server and drive a browser for screenshots. Use that for every UI phase (you may need to install the browser extension).

**AGENTS.md (paste at repo root)**

```md
# KESSLER agent operating manual
Project: daily one-move chain-reaction puzzle, space theme.
Spec: docs/BLUEPRINT.md is the source of truth. If code and spec disagree, stop and ask.

## Hard rules
1. src/core is pure: no DOM, no Date, no Math.random, no floats, no imports from outside core. Integer math, row-major iteration, typed arrays.
2. Never change shipped behavior of RULESET_VERSION or GENERATOR_VERSION. Changes mean a new version; keep the old one. tests/golden must stay green.
3. Zero paid services. Every external API is optional with a fallback. The game must run with data/ missing.
4. UI follows BLUEPRINT section 6 exactly: palette tokens only, no gradients, no blur or glow, no rounded-pill UI, no emoji icons, no icon libraries. Shapes are hand-authored vertex arrays in src/app/render/shapes.ts.
5. No runtime dependencies without asking (target 0). Bundle under 300 KB gzip. Fonts self-hosted.
6. Write or update tests with every change. Run `npm run check` (lint, typecheck, test, build) before saying done.

## Workflow
- Plan first, in a few lines: files you will touch, risks. Then implement. One phase per conversation; do not start the next phase.
- Small diffs. Never rewrite whole files or reformat unrelated code.
- UI work: run the dev server, open it in the browser tool, screenshot at 390x844 and 1280x720, attach both.
- Finish with: what changed, how it was verified, what is left.

## Commands
npm run dev | check | test | build | build:portal -- --platform=<name> | audit:daily | gen:campaign

## Style
TypeScript strict, no any. Small pure functions. Comments explain why, not what.
```

**Workflow files to have the agent write in P6** (each under 12,000 characters)

| Slash command | Purpose |
| --- | --- |
| `/add-body-type` | Checklist: spec row, core behavior, tests, shape, sound, tutorial hook, generator weights, calendar unlock |
| `/audit-daily` | Run the gate audit for the next N days, summarize degraded days, propose generator tweaks as a new version |
| `/release-portal` | Build the portal zip, run size and requirement checks, print the submission checklist |

**Phase prompts (paste one per fresh conversation)**

> **P0 Bootstrap.** Read AGENTS.md and docs/BLUEPRINT.md. Set up Vite plus strict TypeScript, ESLint (forbid DOM, Date and Math.random inside src/core), Prettier, Vitest, size-limit, and an `npm run check` script. Add ci and deploy workflows (GitHub Pages). Show a blank themed page using the palette tokens. Done when `npm run check` passes and the deployed page loads.

> **P1 Core engine.** Implement src/core types, rng (xmur3 plus mulberry32), simulate and score for CIN, SHD, BCN, SNG, MRF, MRB exactly per section 2. Return the event log. Write the section 2 hand-check fixture first, then four more fixtures. Add a golden hash test. Done when all fixtures pass and I have verified two of them by hand.

> **P2 Solver and generator.** Implement solve, generate, quality gates and the weekday calendar for the unlocked body set. Add the board-hash golden test for 400 days and a CI check that fewer than 2% of the next 365 days are degraded. Add a performance test for the budgets. Done when determinism tests pass in Node.

> **P3 Renderer and layout.** Canvas2D renderer, layout engine for 16:9 and portrait, palette tokens, shapes.ts with the authored vertex arrays and 3 rock variants, grid, cursor, hover ray previews. No animation yet. Screenshot at both sizes. Done when it looks like the art bible and I approve the screenshots.

> **P4 Playback and audio.** Event log to stepped animation, hitstop, sparks, speed controls, reduced-motion path, WebAudio synth with the pentatonic mapping. Done when a 10-deep cascade plays cleanly at 1x and 2x.

> **P5 Daily flow (ship v0.1).** Home, attempt lock, result screen, grade glyph, share text, constellation PNG, perfect-line replay, local stats and streaks, archive by hash route, interactive tutorial. Playwright e2e for the happy path. Done when I can play today's board start to finish on a phone-sized viewport, then deploy.

> **P6 Automation.** Add content, audit, release and dependabot workflows, tools/fetch-feeds, tools/gen-flavor with schema validation and the template fallback, data/boards snapshots, the failure ladder, and the three slash-command workflow files. Done when each workflow runs green once manually, and I have added GEMINI\_API\_KEY as a secret.

> **P7 Orbits campaign and phase 2/3 bodies.** Implement LNH, LNV, PLT, FUS, WRM, mutators, tools/gen-campaign (60 frozen levels, 6 orbits, medals), the orbit map, hints from the solver. Done when the campaign is completable and the golden tests are still green.

> **P8 Platform adapters.** Platform interface, web and itch implementations, CrazyGames, Poki and GameDistribution stubs behind the flag, portal build script and size check. Do not hardcode real SDK calls until I paste the current SDK docs. Done when `build:portal` outputs a valid zip under budget.

> **P9 Leaderboard and sector codes.** Cloudflare Worker plus D1 (free tier): POST placement only, the Worker replays one placement against the day's board snapshot and stores the computed score. Never trust a client score. Add URL-hash sector codes and the board editor. Done when a forged score request is rejected in tests.

> **P10 Polish and launch.** Accessibility pass, settings, privacy page, credits, i18n scaffold (strings in JSON), Lighthouse check, launch checklist.

## 13. Risks and verification list

| Risk | Mitigation |
| --- | --- |
| Free Antigravity quota runs out mid-phase | Small tasks, plan first, commit often, split phases further |
| Boards feel random or dull | Quality gates and decoys in section 4. Show it to 5 people and silently watch their first 60 seconds |
| One-move sessions too short for portals | Orbits, Free Drift and hints extend sessions |
| Determinism bug splits players onto different boards | Integer-only core, cross-browser CI hash test, versioned seeds |
| Free-tier changes (AI API, Cloudflare, Actions) | Everything external is optional with a fallback |
| UI drifts toward generic | Art bible rules in AGENTS.md, screenshot review each UI phase |

**Things I could not fully verify, check before relying on them**

- Antigravity rules folder name (`.agent` vs `.agents`) and current free-plan model list.
- Current Gemini free-tier limits and model names (they changed several times in 2025 and 2026).
- GitHub scheduled-workflow auto-disable behavior and free minutes on public repos.
- Cloudflare Workers free CPU limits (the Worker must only replay one placement, never generate a board) and D1 free limits.
- Each portal's current SDK, exclusivity and size rules.
- Name availability on GitHub, itch.io and any domain.
- Wikimedia, NASA and Launch Library endpoint shapes and rate limits.
