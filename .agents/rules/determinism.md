# Determinism Rules

1. **Integer Math Only**: `src/core` uses strictly integer math. No floating-point division or floats in simulation or scoring. Scores are stored as integer tenths and displayed divided by 10.
2. **No Nondeterministic APIs**:
   - `Math.random` is strictly forbidden.
   - `Date` and `performance.now()` are forbidden in `src/core`.
   - No reliance on JS object key iteration order or non-stable sorting.
3. **RNG Contract**:
   - Seed generation via `xmur3` 32-bit hash of standard versioned seed strings (`KESSLER|v1|YYYY-MM-DD`).
   - PRNG via integer `mulberry32`.
4. **Golden Hash Locking**:
   - Board hash golden tests lock the first 400 days and must never change for a given `RULESET_VERSION` / `GENERATOR_VERSION`.
   - Never modify shipped behavior for existing versions.
