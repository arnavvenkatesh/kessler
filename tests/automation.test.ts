import { describe, it, expect } from 'vitest';
import {
  DailyBriefingSchema,
  containsBannedWords,
  generateProceduralBriefing,
  generateProceduralQuips,
  validateBriefing,
} from '../tools/gen-flavor';
import { fetchApod, fetchNextLaunch, fetchSpaceflightHistory } from '../tools/fetch-feeds';
import { auditDaily } from '../tools/audit-daily';

describe('P6 Automation, Feeds & Flavor Tests', () => {
  describe('Zod Schema & Banned Word Validation', () => {
    it('validates a correct mission briefing', () => {
      const valid = {
        sectorName: 'Sector #42 // Polar Belt',
        line1: 'Decaying rocket stage detected in low polar orbit.',
        line2: 'Single spark detonation required for controlled corridor neutralization.',
      };

      const result = validateBriefing(valid);
      expect(result).not.toBeNull();
      expect(result?.sectorName).toBe(valid.sectorName);
    });

    it('rejects briefings containing banned words or exclamation marks', () => {
      expect(containsBannedWords('An epic cosmic journey awaiting!')).toBe(true);
      expect(containsBannedWords('Sector cleared successfully!')).toBe(true); // Exclamation mark
      expect(containsBannedWords('A cosmic debris field')).toBe(true);
      expect(containsBannedWords('Controlled kinetic fragmentation.')).toBe(false);

      const invalid = {
        sectorName: 'Epic Sector',
        line1: 'An epic journey into the stars!',
        line2: 'Neutralize the cosmic debris.',
      };
      expect(validateBriefing(invalid)).toBeNull();
    });

    it('rejects lines exceeding 140 characters per spec', () => {
      const tooLong = {
        sectorName: 'Sector #1',
        line1: 'A'.repeat(141),
        line2: 'Normal line.',
      };
      const parsed = DailyBriefingSchema.safeParse(tooLong);
      expect(parsed.success).toBe(false);
    });
  });

  describe('Procedural Flavor Generator (Fallback Ladder)', () => {
    it('generates dry, restrained briefings without banned words', () => {
      for (let i = 1; i <= 20; i++) {
        const briefing = generateProceduralBriefing('2026-11-17', i);
        expect(containsBannedWords(briefing.sectorName)).toBe(false);
        expect(containsBannedWords(briefing.line1)).toBe(false);
        expect(containsBannedWords(briefing.line2)).toBe(false);
        expect(briefing.line1.length).toBeLessThanOrEqual(140);
        expect(briefing.line2.length).toBeLessThanOrEqual(140);
      }
    });

    it('generates a full pool of 40 quips per grade tier', () => {
      const quips = generateProceduralQuips();
      const tiers = ['PERFECT', 'NOVA', 'FLARE', 'SPARK', 'DUD'] as const;

      for (const tier of tiers) {
        expect(quips[tier].length).toBe(40);
        for (const q of quips[tier]) {
          expect(containsBannedWords(q)).toBe(false);
          expect(q.length).toBeLessThanOrEqual(140);
        }
      }
    });
  });

  describe('External Feed Ingestion Fallbacks', () => {
    it('safely falls back on APOD when network is unavailable or invalid key', async () => {
      const apod = await fetchApod('INVALID_KEY_TEST');
      expect(typeof apod.title).toBe('string');
      expect(typeof apod.url).toBe('string');
    });

    it('safely returns fallback next launch data', async () => {
      const launch = await fetchNextLaunch();
      expect(typeof launch.name).toBe('string');
      expect(typeof launch.net).toBe('string');
    });

    it('safely returns spaceflight historical facts', async () => {
      const history = await fetchSpaceflightHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history.length).toBeGreaterThan(0);
      expect(history[0]?.year).toBeTypeOf('number');
    });
  });

  describe('Quality Gate Audit Tool', () => {
    it('audits next 7 days and asserts degraded rate < 2%', () => {
      const audit = auditDaily(7);
      expect(audit.totalDays).toBe(7);
      expect(audit.degradedRate).toBeLessThan(2.0);
      expect(audit.pass).toBe(true);
    });
  });
});
