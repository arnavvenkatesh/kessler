# /add-body-type Workflow

Checklist and instructions for introducing a new body type to Kessler.

## Architectural Constraints
- **Core Purity**: `src/core` must remain 100% pure (integer math only, no DOM, no Date, no floats, no Math.random).
- **Determinism**: Shipped behavior of existing `RULESET_VERSION` must never change. New mechanics must either be gated by an incremented `RULESET_VERSION` or unlocked on specified days of the week.
- **Palette & Shapes**: Palette tokens only. Shapes must be hand-authored 24x24 integer vertex arrays in `src/app/render/shapes.ts`.

## Step-by-Step Implementation Checklist
1. **Spec & Types (`src/core/types.ts`)**:
   - Add new `Kind` string literal to `Kind` union type (e.g., `'LNH'`, `'LNV'`, `'PLT'`, `'FUS'`).
   - If paired or directional, document orientation representation.

2. **Core Simulation Logic (`src/core/sim.ts` & `src/core/score.ts`)**:
   - Define base point values in `src/core/score.ts`.
   - Implement ray hit resolution, penetration, deflection, or absorption in `src/core/sim.ts`.
   - Update `isDestroyable(kind)` logic.
   - Record appropriate `SimEvent` entries (`detonate`, `hit`, `crack`, `deflect`, etc.).

3. **Core Hand-Checked Fixtures (`tests/fixtures.test.ts`)**:
   - Author a hand-checked deterministic test board exercising the new body.
   - Verify calculation by hand on paper before committing.

4. **Procedural Geometry (`src/app/render/shapes.ts`)**:
   - Author hand-crafted 24x24 coordinate vertex arrays in `shapes.ts`.
   - Distinct monochrome silhouette (must be distinguishable without color).
   - Add test coverage in `tests/shapes.test.ts`.

5. **Audio Synthesis (`src/app/audio/synth.ts`)**:
   - Synthesize mechanical sound effect in WebAudio (no sound files).
   - Hook event trigger in playback engine.

6. **Generator & Calendar Unlock (`src/core/config.ts` & `src/core/generate.ts`)**:
   - Add body type to weekday unlock profile (`WEEKLY_CALENDAR`).
   - Tune density weights and shelter logic.
   - Run `npm run audit:daily -- 60` to verify degraded rate stays < 2%.

7. **Tutorial Stage (`src/app/tutorial/tutorialBoards.ts`)**:
   - Add an interactive tutorial stage introducing the new mechanic.
