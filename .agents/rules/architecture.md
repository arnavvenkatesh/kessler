# Architecture Rules

1. **Pure Core**: `src/core/` is completely pure. It contains zero imports from outside core, no DOM types/APIs, no `Date`, no `Math.random`, and no floating-point arithmetic.
2. **Event-Driven Execution**: The simulator returns a deterministic `SimEvent[]` log. It never draws or plays sound. Renderers, audio synthesizers, replays, and share-card generators consume this log.
3. **Zero Runtime Dependencies**: The client runtime must have 0 external runtime dependencies. Production bundle must remain under 300 KB gzipped.
4. **Platform Independence**: Gameplay logic is decoupled from platform APIs via `src/app/platform/Platform.ts`.
5. **Self-Running & Failure Ladder**: Core gameplay is a pure function of date/seed and works standalone without external services or data files.
