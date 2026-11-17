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
