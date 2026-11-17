import { describe, it, expect } from 'vitest';
import { solve } from '../src/core/solver';
import type { Board } from '../src/core/types';

describe('P2 Solver Tests', () => {
  it('solves a 5x1 fixture finding the optimal placement and stats', () => {
    // Board 5x1: . . CIN . CIN
    const board: Board = {
      w: 5,
      h: 1,
      cells: [null, null, { kind: 'CIN' }, null, { kind: 'CIN' }],
      spark: 'CROSS',
      rulesetVersion: 1,
    };

    const result = solve(board);

    // Empty cells are x=0, x=1, x=3.
    // Spark at x=0 hits CIN at x=2, scoring 360 (clean sweep).
    expect(result.bestScore).toBe(360);
    expect(result.best.x).toBe(0);
    expect(result.best.y).toBe(0);
    expect(result.stats.chainDepth).toBe(3);
    expect(result.stats.destroyedCount).toBe(2);
    expect(result.stats.destroyedPercent).toBe(100);
    expect(result.stats.isCleanSweep).toBe(true);

    // Occupied cells have -1 in scores array
    expect(result.scores[2]).toBe(-1);
    expect(result.scores[4]).toBe(-1);
  });

  it('tests LANCE spark rotations in solver', () => {
    // Board 3x3 with CIN at (1, 0) and (1, 2)
    // Horizontal lance at (1, 1) fires East/West (misses)
    // Vertical lance at (1, 1) fires North/South (hits both CINs)
    const board: Board = {
      w: 3,
      h: 3,
      cells: [
        null, { kind: 'CIN' }, null,
        null, null,            null,
        null, { kind: 'CIN' }, null,
      ],
      spark: 'LANCE',
      rulesetVersion: 1,
    };

    const result = solve(board);
    expect(result.bestScore).toBeGreaterThan(0);
    // At cell (1, 1), vertical rotation (rot=1) should be chosen as best
    const cellIdx = 1 * 3 + 1;
    expect(result.scores[cellIdx]).toBeGreaterThan(0);
  });
});
