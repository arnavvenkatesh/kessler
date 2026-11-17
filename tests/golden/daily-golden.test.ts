import { describe, it, expect } from 'vitest';
import { generateDaily, hashBoard } from '../../src/core/generate';
import { civilFromDays, daysFromCivil, formatDateString } from '../../src/core/calendar';
import { hash32 } from '../../src/core/rng';

describe('P2 400-Day Board Hash Golden Test & Quality Check', () => {
  it('locks golden board hashes for 400 days and asserts < 2% degraded rate', () => {
    const startDays = daysFromCivil(2026, 1, 1);
    const hashes: string[] = [];
    let degradedCount = 0;

    const sampleHashes: Record<number, string> = {};

    for (let i = 0; i < 400; i++) {
      const [y, m, d] = civilFromDays(startDays + i);
      const dateStr = formatDateString(y, m, d);
      const res = generateDaily(dateStr);
      const bHash = hashBoard(res.board);
      hashes.push(bHash);

      if (i < 365 && res.degraded) {
        degradedCount++;
      }

      if (i === 0 || i === 49 || i === 99 || i === 199 || i === 299 || i === 399) {
        sampleHashes[i + 1] = bHash;
      }
    }

    const aggregateHash = hash32(hashes.join(',')).toString(16).padStart(8, '0');

    // Lock sample day hashes
    expect(sampleHashes[1]).toBe('418adab7');
    expect(sampleHashes[50]).toBe('dfc38715');
    expect(sampleHashes[100]).toBe('795b2c3e');
    expect(sampleHashes[200]).toBe('81a028bb');
    expect(sampleHashes[300]).toBe('48879c4f');
    expect(sampleHashes[400]).toBe('18bf1ae7');

    // Lock aggregate 400-day hash
    expect(aggregateHash).toBe('0b8c2147');

    // Assert strictly less than 2% degraded across 365 days
    const degradedPercent = (degradedCount * 100) / 365;
    expect(degradedCount).toBe(1);
    expect(degradedPercent).toBeLessThan(2.0);
  }, 120000);
});
