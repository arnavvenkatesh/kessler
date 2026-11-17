import { describe, it, expect } from 'vitest';
import { A_MINOR_PENTATONIC } from '../src/app/audio/synth';
import { FxManager } from '../src/app/render/fx';
import { PlaybackEngine } from '../src/app/playback/playbackEngine';
import { simulate } from '../src/core/sim';
import { generateDaily } from '../src/core/generate';
import type { Board } from '../src/core/types';

describe('P4 Playback & Audio Synthesis Tests', () => {
  describe('A-Minor Pentatonic Scale Mapping', () => {
    it('has exactly 15 frequencies corresponding to index 0..14', () => {
      expect(A_MINOR_PENTATONIC.length).toBe(15);
    });

    it('has strictly monotonic ascending frequencies', () => {
      for (let i = 1; i < A_MINOR_PENTATONIC.length; i++) {
        expect(A_MINOR_PENTATONIC[i]!).toBeGreaterThan(A_MINOR_PENTATONIC[i - 1]!);
      }
    });

    it('locks fundamental octave checkpoints', () => {
      expect(A_MINOR_PENTATONIC[0]).toBe(220.0);   // A3
      expect(A_MINOR_PENTATONIC[5]).toBe(440.0);   // A4
      expect(A_MINOR_PENTATONIC[10]).toBe(880.0);  // A5
    });

    it('clamps depth to index max 14 per spec', () => {
      const getFreq = (depth: number) => {
        const idx = Math.max(0, Math.min(depth, 14));
        return A_MINOR_PENTATONIC[idx];
      };
      expect(getFreq(0)).toBe(220.0);
      expect(getFreq(14)).toBe(1567.98);
      expect(getFreq(25)).toBe(1567.98); // Clamped at 14
    });
  });

  describe('FxManager Particles & Screen Nudge', () => {
    it('spawns exactly 8 square sparks with integer velocities', () => {
      const fx = new FxManager();
      fx.spawnImpactSparks(100, 100);

      expect(fx.sparks.length).toBe(8);
      for (const spark of fx.sparks) {
        expect(Number.isInteger(spark.x)).toBe(true);
        expect(Number.isInteger(spark.y)).toBe(true);
        expect(Number.isInteger(spark.vx)).toBe(true);
        expect(Number.isInteger(spark.vy)).toBe(true);
        expect(spark.life).toBe(4);
      }
    });

    it('steps spark physics with integer translation until dead', () => {
      const fx = new FxManager();
      fx.spawnImpactSparks(50, 50);

      fx.update(16); // 1 frame
      expect(fx.sparks.length).toBe(8);
      expect(fx.sparks[0]!.life).toBe(3);

      fx.update(16);
      fx.update(16);
      fx.update(16); // 4 frames total -> sparks expire
      expect(fx.sparks.length).toBe(0);
    });

    it('enforces maximum 2px integer screen nudge', () => {
      const fx = new FxManager();
      fx.triggerNudge(false);
      expect(Math.abs(fx.nudgeX)).toBeLessThanOrEqual(2);
      expect(Math.abs(fx.nudgeY)).toBeLessThanOrEqual(2);
      expect(Number.isInteger(fx.nudgeX)).toBe(true);
      expect(Number.isInteger(fx.nudgeY)).toBe(true);

      // Reduced motion suppresses screen nudge
      fx.clear();
      fx.triggerNudge(true);
      expect(fx.nudgeX).toBe(0);
      expect(fx.nudgeY).toBe(0);
    });
  });

  describe('Playback Engine Stepped Execution & Cascade Playback', () => {
    it('loads board and simulation result into idle state', () => {
      const daily = generateDaily('2026-01-01');
      const board = daily.board;
      const emptyIdx = board.cells.findIndex((c) => c === null);
      const ex = emptyIdx % board.w;
      const ey = Math.floor(emptyIdx / board.w);
      const sim = simulate(board, { x: ex, y: ey, rot: 0 });

      const engine = new PlaybackEngine();
      engine.load(board, sim);

      expect(engine.status).toBe('idle');
      expect(engine.currentTick).toBe(1);
      expect(engine.maxTick).toBe(sim.lastTick);
      expect(engine.runningScore).toBe(0);
      expect(engine.runningDestroyed).toBe(0);
    });

    it('skips to end immediately with matching final score and destroyed count', () => {
      const daily = generateDaily('2026-01-01');
      const board = daily.board;
      const emptyIdx = board.cells.findIndex((c) => c === null);
      const ex = emptyIdx % board.w;
      const ey = Math.floor(emptyIdx / board.w);
      const sim = simulate(board, { x: ex, y: ey, rot: 0 });

      const engine = new PlaybackEngine();
      engine.load(board, sim);
      engine.skipToEnd();

      expect(engine.status).toBe('finished');
      expect(engine.currentTick).toBe(sim.lastTick);
      expect(engine.runningScore).toBe(sim.score);
      expect(engine.runningDestroyed).toBe(sim.destroyed);
    });

    it('steps forward tick by tick deterministically', () => {
      // Build a 5-step cascade board: a row of 5 Cinders
      const w = 7;
      const h = 7;
      const cells = new Array(w * h).fill(null);
      // Place cinders from (1, 3) to (5, 3)
      for (let x = 1; x <= 5; x++) {
        cells[3 * w + x] = { kind: 'CIN' };
      }
      const board: Board = {
        w,
        h,
        cells,
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      // Place spark at (0, 3) firing right into (1, 3)
      const sim = simulate(board, { x: 0, y: 3, rot: 0 });
      expect(sim.destroyed).toBe(5);
      expect(sim.lastTick).toBe(6);

      const engine = new PlaybackEngine();
      engine.load(board, sim);

      // Step through all ticks
      for (let step = 1; step <= sim.lastTick; step++) {
        expect(engine.currentTick).toBe(step);
        engine.stepForward();
      }

      expect(engine.status).toBe('finished');
      expect(engine.runningDestroyed).toBe(5);
    });

    it('plays cleanly through a 10-deep cascade at 1x and 2x', () => {
      // Construct a 10-deep chain reaction
      const w = 12;
      const h = 12;
      const cells = new Array(w * h).fill(null);
      for (let x = 1; x <= 10; x++) {
        cells[5 * w + x] = { kind: 'CIN' };
      }
      const board: Board = {
        w,
        h,
        cells,
        spark: 'CROSS',
        rulesetVersion: 1,
      };

      const sim = simulate(board, { x: 0, y: 5, rot: 0 });
      expect(sim.destroyed).toBe(10);
      expect(sim.lastTick).toBe(11);

      // 1. Play at 1x speed with simulated delta time
      const engine1x = new PlaybackEngine();
      engine1x.setSpeed('1x');
      engine1x.load(board, sim);
      engine1x.play();
      expect(engine1x.status).toBe('playing');

      // Step simulation clock at 16ms frames until completion
      let frames = 0;
      while (engine1x.status === 'playing' && frames < 500) {
        engine1x.update(16);
        frames++;
      }

      expect(engine1x.status).toBe('finished');
      expect(engine1x.runningDestroyed).toBe(10);

      // 2. Play at 2x speed with simulated delta time
      const engine2x = new PlaybackEngine();
      engine2x.setSpeed('2x');
      engine2x.load(board, sim);
      engine2x.play();
      expect(engine2x.status).toBe('playing');

      let frames2x = 0;
      while (engine2x.status === 'playing' && frames2x < 500) {
        engine2x.update(16);
        frames2x++;
      }

      expect(engine2x.status).toBe('finished');
      expect(engine2x.runningDestroyed).toBe(10);
      // 2x should finish in roughly half the frames of 1x
      expect(frames2x).toBeLessThan(frames);
    });
  });
});
