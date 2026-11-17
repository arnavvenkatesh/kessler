# /audit-daily Workflow

Instructions for auditing future generated daily sectors and diagnosing degraded boards.

## Purpose
Verifies that all procedurally generated boards for the next N days satisfy the 6 core quality gates:
1. Minimum chain depth requirement.
2. Optimum destroys between 40% and 90% of destroyable bodies.
3. Count of placements within 90% of optimum falls within weekday threshold.
4. Median placement score is under 45% of optimum.
5. At least 2 decoys scoring 60%–85% of optimum located >= 3 cells away.
6. Optimum is not a clean sweep on weekdays.

## Execution
Run the audit CLI tool:
```bash
npm run audit:daily -- 60
```

## Remediation Protocol
If degraded rate exceeds 2.0%:
1. Identify the failing sectors and their weekday types from the CLI output.
2. Inspect density distribution and barrier counts in `src/core/config.ts`.
3. If tuning weights, NEVER modify shipped generator behavior for existing `GENERATOR_VERSION`.
4. Bump `GENERATOR_VERSION` in `src/core/config.ts` (e.g. from 1 to 2) and gate old versions in `generate.ts`.
5. Re-run `npm run audit:daily -- 60` and verify `tests/golden` remains green.
