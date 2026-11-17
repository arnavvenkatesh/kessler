import { describe, it, expect } from 'vitest';
import { generateDaily, hashBoard } from '../../src/core/generate';
import { civilFromDays, daysFromCivil, formatDateString } from '../../src/core/calendar';
import { hash32 } from '../../src/core/rng';

describe('P2 400-Day Board Hash Golden Test & Quality Check', () => {
  const startDays = daysFromCivil(2026, 1, 1);
  const allHashes: string[] = [];
  let degradedCount = 0;

  it('generates days 1 to 100 and verifies sample checkpoints', () => {
    for (let i = 0; i < 100; i++) {
      const [y, m, d] = civilFromDays(startDays + i);
      const dateStr = formatDateString(y, m, d);
      const res = generateDaily(dateStr);
      const bHash = hashBoard(res.board);
      allHashes.push(bHash);
      if (res.degraded) {
        degradedCount++;
      }
    }
    expect(allHashes[0]).toBe('418adab7'); // Day 1
    expect(allHashes[49]).toBe('dfc38715'); // Day 50
    expect(allHashes[99]).toBe('795b2c3e'); // Day 100
  }, 60000);

  it('generates days 101 to 200 and verifies sample checkpoints', () => {
    for (let i = 100; i < 200; i++) {
      const [y, m, d] = civilFromDays(startDays + i);
      const dateStr = formatDateString(y, m, d);
      const res = generateDaily(dateStr);
      const bHash = hashBoard(res.board);
      allHashes.push(bHash);
      if (res.degraded) {
        degradedCount++;
      }
    }
    expect(allHashes[199]).toBe('81a028bb'); // Day 200
  }, 60000);

  it('generates days 201 to 300 and verifies sample checkpoints', () => {
    for (let i = 200; i < 300; i++) {
      const [y, m, d] = civilFromDays(startDays + i);
      const dateStr = formatDateString(y, m, d);
      const res = generateDaily(dateStr);
      const bHash = hashBoard(res.board);
      allHashes.push(bHash);
      if (res.degraded) {
        degradedCount++;
      }
    }
    expect(allHashes[299]).toBe('48879c4f'); // Day 300
  }, 60000);

  it('generates days 301 to 400, verifies aggregate hash and degraded rate', () => {
    for (let i = 300; i < 400; i++) {
      const [y, m, d] = civilFromDays(startDays + i);
      const dateStr = formatDateString(y, m, d);
      const res = generateDaily(dateStr);
      const bHash = hashBoard(res.board);
      allHashes.push(bHash);
      if (i < 365 && res.degraded) {
        degradedCount++;
      }
    }
    expect(allHashes[399]).toBe('18bf1ae7'); // Day 400

    const aggregateHash = hash32(allHashes.join(',')).toString(16).padStart(8, '0');

    // Lock aggregate 400-day hash
    expect(aggregateHash).toBe('0b8c2147');

    // Assert strictly less than 2% degraded across 365 days
    const degradedPercent = (degradedCount * 100) / 365;
    expect(degradedCount).toBe(1);
    expect(degradedPercent).toBeLessThan(2.0);
  }, 60000);
});
