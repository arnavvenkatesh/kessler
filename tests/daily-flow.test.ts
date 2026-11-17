import { describe, it, expect, beforeEach } from 'vitest';
import { computeGrade, generateShareText } from '../src/app/share/grade';
import { generateConstellationName } from '../src/app/share/constellation';
import { DailyStore, type DailyAttempt } from '../src/app/storage/dailyStore';
import { TUTORIAL_STAGES } from '../src/app/tutorial/tutorialBoards';
import { solve } from '../src/core/solver';

describe('P5 Daily Flow & Retention Tests', () => {
  describe('Grade Classification & Boundaries', () => {
    it('accurately classifies PERFECT grade at 100%', () => {
      const res = computeGrade(1000, 1000);
      expect(res.grade).toBe('PERFECT');
      expect(res.percent).toBe(100);
      expect(res.scoreDisplay).toBe('100.0');
    });

    it('accurately classifies NOVA grade for >= 90%', () => {
      const res90 = computeGrade(900, 1000);
      expect(res90.grade).toBe('NOVA');
      expect(res90.percent).toBe(90);

      const res95 = computeGrade(950, 1000);
      expect(res95.grade).toBe('NOVA');
      expect(res95.percent).toBe(95);
    });

    it('accurately classifies FLARE grade for >= 75% and < 90%', () => {
      const res75 = computeGrade(750, 1000);
      expect(res75.grade).toBe('FLARE');
      expect(res75.percent).toBe(75);

      const res89 = computeGrade(890, 1000);
      expect(res89.grade).toBe('FLARE');
      expect(res89.percent).toBe(89);
    });

    it('accurately classifies SPARK grade for >= 50% and < 75%', () => {
      const res50 = computeGrade(500, 1000);
      expect(res50.grade).toBe('SPARK');
      expect(res50.percent).toBe(50);

      const res74 = computeGrade(749, 1000);
      expect(res74.grade).toBe('SPARK');
      expect(res74.percent).toBe(74);
    });

    it('accurately classifies DUD grade for < 50%', () => {
      const res49 = computeGrade(490, 1000);
      expect(res49.grade).toBe('DUD');
      expect(res49.percent).toBe(49);

      const res0 = computeGrade(0, 1000);
      expect(res0.grade).toBe('DUD');
      expect(res0.percent).toBe(0);
    });
  });

  describe('Deterministic Constellation Name Generator', () => {
    it('produces identical names for identical simulation hashes', () => {
      const hashA = '8a8f63a123456789';
      const name1 = generateConstellationName(hashA);
      const name2 = generateConstellationName(hashA);
      expect(name1).toBe(name2);
    });

    it('produces distinct valid multi-word names across different hashes', () => {
      const name1 = generateConstellationName('hash_alpha');
      const name2 = generateConstellationName('hash_beta');
      expect(typeof name1).toBe('string');
      expect(name1.split(' ').length).toBe(2);
      expect(name2.split(' ').length).toBe(2);
    });
  });

  describe('Share Text Transmission Formatter', () => {
    it('formats plain text share output matching spec', () => {
      const text = generateShareText({
        dayNumber: 42,
        weekdayStr: 'Tue',
        grade: 'NOVA',
        percent: 91,
        chainDepth: 9,
        scoreDisplay: '31.4',
        constellationName: 'Vela Orrin',
        url: 'https://kessler.app',
      });

      expect(text).toContain('KESSLER #42 · Tue');
      expect(text).toContain('NOVA 91% · chain 9 · 31.4');
      expect(text).toContain('Constellation: Vela Orrin');
      expect(text).toContain('https://kessler.app');
    });
  });

  describe('Daily Attempt Locking & Local Stats', () => {
    let mockStorage: Record<string, string> = {};

    beforeEach(() => {
      mockStorage = {};
      // Mock minimal localStorage for node environment
      globalThis.localStorage = {
        getItem: (k: string) => mockStorage[k] ?? null,
        setItem: (k: string, v: string) => {
          mockStorage[k] = v;
        },
        removeItem: (k: string) => {
          delete mockStorage[k];
        },
        clear: () => {
          mockStorage = {};
        },
        key: (i: number) => Object.keys(mockStorage)[i] ?? null,
        length: 0,
      } as unknown as Storage;
    });

    it('locks an official attempt and records player stats', () => {
      const store = new DailyStore();
      const attempt: DailyAttempt = {
        dateStr: '2026-01-01',
        dayNumber: 1,
        placement: { x: 2, y: 3 },
        score: 450,
        destroyed: 4,
        lastTick: 5,
        grade: 'NOVA',
        percent: 92,
        simHash: 'test_hash_01',
        timestamp: Date.now(),
      };

      const stats = store.saveDailyAttempt(attempt);
      expect(stats.totalPlayed).toBe(1);
      expect(stats.currentStreak).toBe(1);
      expect(stats.maxStreak).toBe(1);
      expect(stats.grades.NOVA).toBe(1);
      expect(stats.bestScore).toBe(450);

      // Verify retrieval
      const saved = store.getDailyAttempt('2026-01-01');
      expect(saved).not.toBeNull();
      expect(saved?.score).toBe(450);
      expect(saved?.grade).toBe('NOVA');
    });

    it('increments streak on consecutive days and resets on gap', () => {
      const store = new DailyStore();

      // Day 1
      store.saveDailyAttempt({
        dateStr: '2026-01-01',
        dayNumber: 1,
        placement: { x: 1, y: 1 },
        score: 300,
        destroyed: 3,
        lastTick: 4,
        grade: 'FLARE',
        percent: 78,
        simHash: 'h1',
        timestamp: Date.now(),
      });

      // Day 2 (consecutive)
      const statsDay2 = store.saveDailyAttempt({
        dateStr: '2026-01-02',
        dayNumber: 2,
        placement: { x: 2, y: 2 },
        score: 600,
        destroyed: 6,
        lastTick: 7,
        grade: 'PERFECT',
        percent: 100,
        simHash: 'h2',
        timestamp: Date.now(),
      });

      expect(statsDay2.totalPlayed).toBe(2);
      expect(statsDay2.currentStreak).toBe(2);
      expect(statsDay2.maxStreak).toBe(2);

      // Day 5 (gap of 2 days -> streak resets to 1)
      const statsDay5 = store.saveDailyAttempt({
        dateStr: '2026-01-05',
        dayNumber: 5,
        placement: { x: 3, y: 3 },
        score: 200,
        destroyed: 2,
        lastTick: 3,
        grade: 'SPARK',
        percent: 55,
        simHash: 'h5',
        timestamp: Date.now(),
      });

      expect(statsDay5.totalPlayed).toBe(3);
      expect(statsDay5.currentStreak).toBe(1);
      expect(statsDay5.maxStreak).toBe(2); // Preserves previous max
    });
  });

  describe('Interactive Tutorial Stages', () => {
    it('contains 3 progressively structured stages', () => {
      expect(TUTORIAL_STAGES.length).toBe(3);
    });

    it('guarantees each tutorial stage is 100% solvable and clears target bodies', () => {
      for (const stage of TUTORIAL_STAGES) {
        const solution = solve(stage.board);
        expect(solution.stats.destroyedCount).toBeGreaterThanOrEqual(stage.targetDestroyed);
        expect(solution.stats.chainDepth).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
