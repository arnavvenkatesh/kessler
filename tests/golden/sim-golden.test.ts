import { describe, it, expect } from 'vitest';
import { simulate } from '../../src/core/sim';
import { mulberry32, xmur3 } from '../../src/core/rng';
import type { Board } from '../../src/core/types';

describe('P1 Determinism & Golden Hash Tests', () => {
  it('locks xmur3 and mulberry32 PRNG outputs', () => {
    // Test seed string hashing
    const seedGen = xmur3('KESSLER|v1|2026-11-17');
    const s1 = seedGen();
    const s2 = seedGen();
    const s3 = seedGen();

    expect(s1).toBe(1047283253);
    expect(s2).toBe(1267185500);
    expect(s3).toBe(2337949288);

    // Test mulberry32 PRNG output sequence
    const rng = mulberry32(s1);
    const u1 = rng.nextUint32();
    const u2 = rng.nextUint32();
    const r1 = rng.nextInt(1, 10);
    const r2 = rng.nextInt(1, 10);

    expect(u1).toBe(3062264313);
    expect(u2).toBe(2798006769);
    expect(r1).toBe(3);
    expect(r2).toBe(7);
  });

  it('locks golden simulation outputs for RULESET v1 fixtures', () => {
    // Fixture 1: 5x1 linear chain
    const f1Board: Board = {
      w: 5,
      h: 1,
      cells: [null, null, { kind: 'CIN' }, null, { kind: 'CIN' }],
      spark: 'CROSS',
      rulesetVersion: 1,
    };
    const r1 = simulate(f1Board, { x: 0, y: 0 });
    expect(r1.score).toBe(360);
    expect(r1.destroyed).toBe(2);
    expect(r1.lastTick).toBe(3);
    expect(r1.hash).toBe('dbc5d8bc');

    // Fixture 2: Mirrors and Beacon
    const f2Board: Board = {
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
    const r2 = simulate(f2Board, { x: 1, y: 2 });
    expect(r2.score).toBe(780);
    expect(r2.destroyed).toBe(2);
    expect(r2.lastTick).toBe(3);
    expect(r2.hash).toBe('9a2ba645');

    // Fixture 3: Shard diagonal rays
    const f3Board: Board = {
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
    const r3 = simulate(f3Board, { x: 1, y: 2 });
    expect(r3.score).toBe(750);
    expect(r3.destroyed).toBe(5);
    expect(r3.lastTick).toBe(3);
    expect(r3.hash).toBe('7e34f169');

    // Fixture 4: Convergence & Singularity
    const f4Board: Board = {
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
    const r4 = simulate(f4Board, { x: 1, y: 0 });
    expect(r4.score).toBe(485);
    expect(r4.destroyed).toBe(3);
    expect(r4.lastTick).toBe(3);
    expect(r4.hash).toBe('6444038c');

    // Fixture 5: Singularity block
    const f5Board: Board = {
      w: 5,
      h: 1,
      cells: [null, { kind: 'SNG' }, { kind: 'CIN' }, { kind: 'CIN' }, { kind: 'CIN' }],
      spark: 'CROSS',
      rulesetVersion: 1,
    };
    const r5 = simulate(f5Board, { x: 0, y: 0 });
    expect(r5.score).toBe(0);
    expect(r5.destroyed).toBe(0);
    expect(r5.lastTick).toBe(1);
    expect(r5.hash).toBe('d90f0bb1');
  });

  it('guarantees identical hash across repeated runs (pure determinism)', () => {
    const board: Board = {
      w: 5,
      h: 5,
      cells: new Array(25).fill(null),
      spark: 'CROSS',
      rulesetVersion: 1,
    };
    board.cells[0] = { kind: 'CIN' };
    board.cells[4] = { kind: 'CIN' };
    board.cells[12] = { kind: 'SHD' };
    board.cells[20] = { kind: 'BCN' };
    board.cells[24] = { kind: 'MRF' };

    const run1 = simulate(board, { x: 2, y: 0 });
    const run2 = simulate(board, { x: 2, y: 0 });

    expect(run1.hash).toBe(run2.hash);
    expect(run1.score).toBe(run2.score);
    expect(run1.events.length).toBe(run2.events.length);
  });
});
