import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { solve } from '../src/core/solver';
import type { CampaignLevel } from '../tools/gen-campaign';

describe('P7 Campaign (Orbits) Test Suite', () => {
  const filePath = path.resolve(process.cwd(), 'data/campaign/levels.json');

  it('contains exactly 60 frozen levels across 6 orbits', () => {
    expect(fs.existsSync(filePath)).toBe(true);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CampaignLevel[];
    expect(data.length).toBe(60);

    for (let orbit = 1; orbit <= 6; orbit++) {
      const orbitLevels = data.filter((l) => l.orbit === orbit);
      expect(orbitLevels.length).toBe(10);
    }
  });

  it('validates every campaign level is solvable and satisfies medal thresholds', () => {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CampaignLevel[];

    for (const lvl of data) {
      expect(lvl.id).toBeGreaterThanOrEqual(1);
      expect(lvl.id).toBeLessThanOrEqual(60);
      expect(lvl.board.w).toBeGreaterThanOrEqual(7);
      expect(lvl.board.h).toBeGreaterThanOrEqual(7);
      expect(lvl.board.cells.length).toBe(lvl.board.w * lvl.board.h);

      // Medal thresholds
      expect(lvl.medalThresholds.bronze).toBeLessThanOrEqual(lvl.medalThresholds.silver);
      expect(lvl.medalThresholds.silver).toBeLessThanOrEqual(lvl.medalThresholds.gold);
      expect(lvl.medalThresholds.gold).toBe(lvl.optimumScore);

      // Solve verification for sample levels
      if (lvl.id % 5 === 1) {
        const sol = solve(lvl.board);
        expect(sol.bestScore).toBe(lvl.optimumScore);
        expect(sol.bestScore).toBeGreaterThan(0);
        expect(sol.stats.chainDepth).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('verifies body mechanics across the 6 orbits', () => {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as CampaignLevel[];

    // Orbit 1 has Cinder & SNG
    const o1 = data.filter((l) => l.orbit === 1);
    const o1Kinds = new Set(o1.flatMap((l) => l.board.cells.filter(Boolean).map((c) => c!.kind)));
    expect(o1Kinds.has('CIN')).toBe(true);

    // Orbit 4 has Lances
    const o4 = data.filter((l) => l.orbit === 4);
    const o4Kinds = new Set(o4.flatMap((l) => l.board.cells.filter(Boolean).map((c) => c!.kind)));
    expect(o4Kinds.has('LNH') || o4Kinds.has('LNV')).toBe(true);

    // Orbit 6 has Wormholes or Mutators
    const o6 = data.filter((l) => l.orbit === 6);
    const o6Kinds = new Set(o6.flatMap((l) => l.board.cells.filter(Boolean).map((c) => c!.kind)));
    expect(o6Kinds.has('WRM') || o6.some((l) => l.board.mutator !== undefined)).toBe(true);
  });
});
