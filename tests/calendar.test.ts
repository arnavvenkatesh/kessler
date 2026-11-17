import { describe, it, expect } from 'vitest';
import {
  daysFromCivil,
  civilFromDays,
  parseDateString,
  formatDateString,
  getWeekday,
  getDayNumber,
  getDayProfile,
} from '../src/core/calendar';

describe('Pure Integer Calendar', () => {
  it('correctly converts civil dates to day counts and back', () => {
    const d1 = daysFromCivil(2026, 11, 17);
    const [y, m, d] = civilFromDays(d1);
    expect(y).toBe(2026);
    expect(m).toBe(11);
    expect(d).toBe(17);

    const [py, pm, pd] = parseDateString('2026-11-17');
    expect(py).toBe(2026);
    expect(pm).toBe(11);
    expect(pd).toBe(17);
    expect(formatDateString(py, pm, pd)).toBe('2026-11-17');
  });

  it('determines weekdays accurately (2026-11-17 is Tuesday = 2)', () => {
    expect(getWeekday(2026, 11, 17)).toBe(2); // Tuesday
    expect(getWeekday(2026, 1, 1)).toBe(4); // Thursday
    expect(getWeekday(2026, 1, 4)).toBe(0); // Sunday
    expect(getWeekday(2026, 1, 5)).toBe(1); // Monday
  });

  it('computes day numbers since launch accurately', () => {
    // 2026-01-01 is Day 1
    expect(getDayNumber(2026, 1, 1)).toBe(1);
    // 2026-01-02 is Day 2
    expect(getDayNumber(2026, 1, 2)).toBe(2);
  });

  it('returns appropriate DayProfile', () => {
    const mondayProfile = getDayProfile('2026-01-05');
    expect(mondayProfile.dayName).toBe('Mon');
    expect(mondayProfile.size).toBe(7);
    expect(mondayProfile.spark).toBe('CROSS');
    expect(mondayProfile.d).toBe(4);
    expect(mondayProfile.k).toBe(6);
  });
});
