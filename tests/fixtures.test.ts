import { describe, it, expect } from 'vitest';
import { simulate } from '../src/core/sim';
import type { Board } from '../src/core/types';

describe('RULESET v1 Hand-Check Fixtures', () => {
  it('Fixture 1: Section 2 hand-check fixture (5x1 linear chain)', () => {
    // Board 5x1: . . CIN . CIN
    const board: Board = {
      w: 5,
      h: 1,
      cells: [
        null,
        null,
        { kind: 'CIN' },
        null,
        { kind: 'CIN' },
      ],
      spark: 'CROSS',
      rulesetVersion: 1,
    };

    const result = simulate(board, { x: 0, y: 0 });

    expect(result.destroyed).toBe(2);
    expect(result.lastTick).toBe(3);
    // Score breakdown:
    // t=2: CIN detonates: 10 * 12 = 120
    // t=3: CIN detonates: 10 * 14 = 140
    // Clean sweep bonus: +100
    // Total = 360 (displays 36.0)
    expect(result.score).toBe(360);
  });

  it('Fixture 2: Mirrors (MRF, MRB) and Beacon (BCN)', () => {
    // Board 3x3:
    // Row 0: .   BCN MRB
    // Row 1: .   MRF CIN
    // Row 2: .   .   .
    // Spark placed at (1, 2)
    const board: Board = {
      w: 3,
      h: 3,
      cells: [
        null, { kind: 'BCN' }, { kind: 'MRB' },
        null, { kind: 'MRF' }, { kind: 'CIN' },
        null, null,            null,
      ],
      spark: 'CROSS',
      rulesetVersion: 1,
    };

    const result = simulate(board, { x: 1, y: 2 });

    expect(result.destroyed).toBe(2);
    expect(result.lastTick).toBe(3);
    // Score breakdown:
    // t=2: CIN detonates: 10 * 12 = 120
    // t=3: BCN detonates: 40 * 14 = 560
    // Clean sweep bonus: +100
    // Total = 780 (displays 78.0)
    expect(result.score).toBe(780);

    // Verify deflection events occurred
    const deflections = result.events.filter((e) => e.type === 'deflect');
    expect(deflections.length).toBeGreaterThanOrEqual(2);
  });

  it('Fixture 3: Shard (SHD) diagonal rays and multi-emitter clearance', () => {
    // Board 3x3:
    // Row 0: CIN  .   CIN
    // Row 1: .   SHD  .
    // Row 2: CIN  .   CIN
    // Spark placed at (1, 2)
    const board: Board = {
      w: 3,
      h: 3,
      cells: [
        { kind: 'CIN' }, null,            { kind: 'CIN' },
        null,            { kind: 'SHD' }, null,
        { kind: 'CIN' }, null,            { kind: 'CIN' },
      ],
      spark: 'CROSS',
      rulesetVersion: 1,
    };

    const result = simulate(board, { x: 1, y: 2 });

    expect(result.destroyed).toBe(5);
    expect(result.lastTick).toBe(3);
    // Score breakdown:
    // t=1: Spark at (1, 2) hits SHD(1, 1) directly North, CIN(0, 2) West, CIN(2, 2) East
    // t=2: 3 bodies detonate (SHD, CIN(0,2), CIN(2,2)): 3 * (10 * 12) = 360
    // At t=2: CIN(0,0) receives 2 simultaneous hits (SHD NW + CIN(0,2) N) -> convergence +5
    // At t=2: CIN(2,0) receives 2 simultaneous hits (SHD NE + CIN(2,2) N) -> convergence +5
    // t=3: 2 bodies detonate (CIN(0,0), CIN(2,0)): 2 * (10 * 14) = 280
    // Clean sweep bonus: +100
    // Total = 360 + 10 + 280 + 100 = 750 (displays 75.0)
    expect(result.score).toBe(750);
  });

  it('Fixture 4: Convergence bonus and Singularity absorption', () => {
    // Board 3x3:
    // Row 0: CIN  .   CIN
    // Row 1: .   SNG  .
    // Row 2: MRB CIN  MRF
    // Spark placed at (1, 0)
    const board: Board = {
      w: 3,
      h: 3,
      cells: [
        { kind: 'CIN' }, null,            { kind: 'CIN' },
        null,            { kind: 'SNG' }, null,
        { kind: 'MRB' }, { kind: 'CIN' }, { kind: 'MRF' },
      ],
      spark: 'CROSS',
      rulesetVersion: 1,
    };

    const result = simulate(board, { x: 1, y: 0 });

    expect(result.destroyed).toBe(3);
    expect(result.lastTick).toBe(3);
    // Score breakdown:
    // t=2: CIN(0,0) and CIN(2,0) detonate: 120 + 120 = 240
    // t=2: Simultaneous hits on CIN(1,2) = 2 hits (1 extra hit): convergence +5
    // t=3: CIN(1,2) detonates: 10 * 14 = 140
    // Clean sweep bonus: +100
    // Total = 240 + 5 + 140 + 100 = 485 (displays 48.5)
    expect(result.score).toBe(485);

    // Verify SNG absorbed the direct south ray at t=1
    const absorbs = result.events.filter((e) => e.type === 'absorb');
    expect(absorbs.length).toBeGreaterThanOrEqual(1);
    expect(absorbs[0]).toEqual({ t: 1, type: 'absorb', x: 1, y: 1 });
  });

  it('Fixture 5: Singularity blocks chain reaction completely', () => {
    // Board 5x1: . SNG CIN CIN CIN
    // Spark at (0, 0)
    const board: Board = {
      w: 5,
      h: 1,
      cells: [
        null,
        { kind: 'SNG' },
        { kind: 'CIN' },
        { kind: 'CIN' },
        { kind: 'CIN' },
      ],
      spark: 'CROSS',
      rulesetVersion: 1,
    };

    const result = simulate(board, { x: 0, y: 0 });

    expect(result.destroyed).toBe(0);
    expect(result.lastTick).toBe(1);
    expect(result.score).toBe(0);
    expect(result.events.some((e) => e.type === 'absorb')).toBe(true);
  });
});
