import { describe, it, expect } from 'vitest';
import { simulate } from '../src/core/sim';
import { solve } from '../src/core/solver';
import { getHint } from '../src/core/hints';
import type { Board } from '../src/core/types';

describe('P7 Phase 2 & 3 Bodies and Mutators', () => {
  describe('LNH & LNV (Piercing Lances)', () => {
    it('pierces multiple bodies along its horizontal axis', () => {
      // 5x1: Spark(0,0) -> LNH(1,0) -> CIN(2,0) -> CIN(3,0) -> CIN(4,0)
      const b: Board = {
        w: 5,
        h: 1,
        cells: [
          null,
          { kind: 'LNH' },
          { kind: 'CIN' },
          { kind: 'CIN' },
          { kind: 'CIN' },
        ],
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      const res = simulate(b, { x: 0, y: 0 });
      // Tick 1: Spark at (0,0) detonates -> hits LNH at (1,0)
      // Tick 2: LNH detonates -> piercing ray goes East through (2,0), (3,0), (4,0)
      // Tick 3: All 3 Cinders detonate simultaneously
      expect(res.destroyed).toBe(4);
      expect(res.lastTick).toBe(3);
      expect(res.score).toBeGreaterThan(0);
    });

    it('is blocked by Singularity even with piercing ray', () => {
      // 5x1: Spark(0,0) -> LNH(1,0) -> SNG(2,0) -> CIN(3,0) -> CIN(4,0)
      const b: Board = {
        w: 5,
        h: 1,
        cells: [
          null,
          { kind: 'LNH' },
          { kind: 'SNG' },
          { kind: 'CIN' },
          { kind: 'CIN' },
        ],
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      const res = simulate(b, { x: 0, y: 0 });
      // SNG absorbs piercing ray, so CINs at 3,0 and 4,0 are never hit
      expect(res.destroyed).toBe(1); // Only LNH is destroyed
      const absorbEvents = res.events.filter((e) => e.type === 'absorb');
      expect(absorbEvents.length).toBe(1);
    });
  });

  describe('PLT (Plated Armor)', () => {
    it('cracks armor on 1st hit and detonates on 2nd hit across ticks', () => {
      // 3x2 board:
      // (0,0)=MRF, (1,0)=CIN, (2,0)=null
      // (0,1)=null, (1,1)=PLT, (2,1)=null
      // Spark placed at (0,1):
      // - East hits PLT(1,1) at tick 1 (toughness 2 -> 1, emits crack)
      // - North hits MRF(0,0), deflects East into CIN(1,0) at tick 1
      // At tick 2: CIN(1,0) detonates, fires South into PLT(1,1) (toughness 1 -> 0, scheduled for t=3)
      // At tick 3: PLT(1,1) detonates as CIN
      const b: Board = {
        w: 3,
        h: 2,
        cells: [
          { kind: 'MRF' }, { kind: 'CIN' }, null,
          null,            { kind: 'PLT' }, null,
        ],
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      const res = simulate(b, { x: 0, y: 1 });
      const crackEvents = res.events.filter((e) => e.type === 'crack');
      expect(crackEvents.length).toBe(1);
      const firstCrack = crackEvents[0];
      if (firstCrack && firstCrack.type === 'crack') {
        expect(firstCrack.x).toBe(1);
        expect(firstCrack.y).toBe(1);
      }

      expect(res.destroyed).toBe(2); // CIN and PLT
      expect(res.lastTick).toBe(3);
    });

    it('detonates next tick when hit twice across tick sequence using piercing lance', () => {
      // 5x1: Spark(4,0) with LANCE fires West piercing through CIN(3,0), PLT(2,0), CIN(1,0)
      const b: Board = {
        w: 5,
        h: 1,
        cells: [
          null,
          { kind: 'CIN' },
          { kind: 'PLT' },
          { kind: 'CIN' },
          null,
        ],
        spark: 'LANCE',
        rulesetVersion: 1,
      };

      const res = simulate(b, { x: 4, y: 0, rot: 0 });
      // Tick 1: Spark fires West piercing through 3, 2, 1
      // PLT receives 1 hit from piercing spark (toughness 2 -> 1, crack)
      // CIN(3,0) and CIN(1,0) both ignited
      // Tick 2: CIN(3,0) and CIN(1,0) both detonate, both hit PLT(2,0)
      // PLT receives 2 hits at tick 2, toughness <= 0, scheduled for tick 3
      // Tick 3: PLT detonates
      expect(res.destroyed).toBe(3);
      expect(res.lastTick).toBe(3);
      const crackEvents = res.events.filter(
        (e): e is Extract<(typeof res.events)[number], { type: 'crack' }> => e.type === 'crack',
      );
      expect(crackEvents.length).toBe(1);
    });
  });

  describe('FUS (Fuse 3-tick delay)', () => {
    it('detonates exactly 3 ticks after ignition (t+3)', () => {
      // 3x1: Spark(0,0) -> FUS(1,0) -> CIN(2,0)
      const b: Board = {
        w: 3,
        h: 1,
        cells: [
          null,
          { kind: 'FUS' },
          { kind: 'CIN' },
        ],
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      const res = simulate(b, { x: 0, y: 0 });
      // Tick 1: Spark fires, hits FUS(1,0). FUS scheduled for tick 1+3 = 4.
      // Tick 2 & 3: FUS is scheduled, solid, no detonations.
      // Tick 4: FUS detonates, fires East into CIN(2,0). CIN scheduled for tick 5.
      // Tick 5: CIN detonates.
      expect(res.destroyed).toBe(2);
      expect(res.lastTick).toBe(5);

      const fusDet = res.events.find((e) => e.type === 'detonate' && e.kind === 'FUS');
      expect(fusDet?.t).toBe(4);

      const cinDet = res.events.find((e) => e.type === 'detonate' && e.x === 2 && e.y === 0);
      expect(cinDet?.t).toBe(5);
    });
  });

  describe('WRM (Wormhole Teleportation)', () => {
    it('teleports ray from entering portal to partner portal in same direction', () => {
      // 5x5:
      // Spark at (2,0) fires South.
      // WRM at (2,1) pair 1.
      // WRM at (0,3) pair 1.
      // CIN at (0,4)
      const cells = new Array(25).fill(null);
      cells[1 * 5 + 2] = { kind: 'WRM', pair: 1 };
      cells[3 * 5 + 0] = { kind: 'WRM', pair: 1 };
      cells[4 * 5 + 0] = { kind: 'CIN' };

      const b: Board = {
        w: 5,
        h: 5,
        cells,
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      const res = simulate(b, { x: 2, y: 0 });
      // Tick 1: Spark at (2,0) fires South -> hits WRM at (2,1)
      // Teleports to (0,3), continues South -> hits CIN at (0,4)
      // Tick 2: CIN at (0,4) detonates
      expect(res.destroyed).toBe(1);
      expect(res.lastTick).toBe(2);

      const t1TeleEvents = res.events.filter((e) => e.type === 'teleport' && e.t === 1);
      expect(t1TeleEvents.length).toBe(1);
      const firstTele = t1TeleEvents[0];
      if (firstTele && firstTele.type === 'teleport') {
        expect(firstTele.x).toBe(2);
        expect(firstTele.y).toBe(1);
      }
    });
  });

  describe('Mutators', () => {
    it('SOLAR_WIND limits ray travel distance to 6 cells', () => {
      // 9x1: Spark(0,0) -> 6 empty cells -> CIN at (7,0)
      const cells = new Array(9).fill(null);
      cells[7] = { kind: 'CIN' };

      const bNormal: Board = {
        w: 9,
        h: 1,
        cells: [...cells],
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      const bSolar: Board = {
        ...bNormal,
        mutator: 'SOLAR_WIND',
      };

      const resNormal = simulate(bNormal, { x: 0, y: 0 });
      expect(resNormal.destroyed).toBe(1);

      const resSolar = simulate(bSolar, { x: 0, y: 0 });
      // Distance from 0 to 7 is 7 steps > 6, so ray expires before reaching (7,0)
      expect(resSolar.destroyed).toBe(0);
    });

    it('DEAD_ZONE absorbs rays in 3x3 patch', () => {
      // 5x5: Spark at (0,2) fires East. CIN at (4,2).
      // DEAD_ZONE centered at (1,1) covering x in [1..3], y in [1..3].
      const cells = new Array(25).fill(null);
      cells[2 * 5 + 4] = { kind: 'CIN' };

      const b: Board = {
        w: 5,
        h: 5,
        cells,
        spark: 'CROSS',
        mutator: 'DEAD_ZONE:1,1',
        rulesetVersion: 1,
      };

      const res = simulate(b, { x: 0, y: 2 });
      // Ray passes through (1,2) which is inside dead zone [1,1] to [3,3]
      expect(res.destroyed).toBe(0);
      const absorbs = res.events.filter((e) => e.type === 'absorb');
      expect(absorbs.length).toBe(1);
    });

    it('TWIN_SPARK fires two sparks on tick 1 and solver tests pairs', () => {
      // 3x3 board with CIN at (1,0) and CIN at (1,2)
      const cells = new Array(9).fill(null);
      cells[1] = { kind: 'CIN' };
      cells[7] = { kind: 'CIN' };

      const b: Board = {
        w: 3,
        h: 3,
        cells,
        spark: 'CROSS',
        mutator: 'TWIN_SPARK',
        rulesetVersion: 1,
      };

      const solution = solve(b);
      expect(solution.best.twin).toBeDefined();
      expect(solution.bestScore).toBeGreaterThan(0);
      expect(solution.bestResult.destroyed).toBe(2);
    });
  });

  describe('Solver Hints', () => {
    it('returns accurate Tier 1, 2, and 3 hints', () => {
      const b: Board = {
        w: 5,
        h: 1,
        cells: [null, null, { kind: 'CIN' }, null, { kind: 'CIN' }],
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      const h1 = getHint(b, 1);
      expect(h1.tier).toBe(1);
      expect(h1.chainDepth).toBe(3);

      const h2 = getHint(b, 2);
      expect(h2.tier).toBe(2);
      expect(h2.bounds.minX).toBeLessThanOrEqual(h2.bounds.maxX);
      expect(h2.bounds.minX).toBeLessThanOrEqual(0);
      expect(h2.bounds.maxX).toBeGreaterThanOrEqual(0);

      const h3 = getHint(b, 3);
      expect(h3.tier).toBe(3);
      if (h3.tier === 3) {
        expect(h3.placement.x).toBe(0);
        expect(h3.placement.y).toBe(0);
      }
    });
  });
});
