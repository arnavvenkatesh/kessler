import { describe, it, expect } from 'vitest';
import { solve } from '../src/core/solver';
import { generateDaily } from '../src/core/generate';
import type { Board } from '../src/core/types';

describe('Performance Budgets', () => {
  it('solves an 11x11 board well within budget (< 100ms)', () => {
    // Generate a full 11x11 Sunday board
    const dailySunday = generateDaily('2026-01-04'); // Sunday 11x11
    const board: Board = dailySunday.board;

    expect(board.w).toBe(11);
    expect(board.h).toBe(11);

    const start = performance.now();
    const result = solve(board);
    const elapsed = performance.now() - start;

    expect(result.bestScore).toBeGreaterThan(0);
    // Mid-tier mobile budget is < 100ms; on Node engine this should complete < 25ms
    expect(elapsed).toBeLessThan(100);
  });

  it('generates a daily sector within budget (< 1.5s)', () => {
    const start = performance.now();
    const result = generateDaily('2026-01-07');
    const elapsed = performance.now() - start;

    expect(result.board).toBeDefined();
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    // Worker budget is 1.5s (1500ms); in Node this should be well below 500ms
    expect(elapsed).toBeLessThan(1500);
  });
});
