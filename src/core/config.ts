import type { Kind } from './types';

export const RULESET_VERSION = 1;
export const GENERATOR_VERSION = 1;
export const LAUNCH_DATE = '2026-01-01';

export interface DayProfile {
  dayName: string;
  size: number;
  spark: 'CROSS' | 'SKEW' | 'LANCE';
  d: number;
  k: number;
  bodies: readonly Kind[];
  isWeekday: boolean;
}

/**
 * Weekly calendar indexed by JavaScript weekday:
 * 0 = Sun, 1 = Mon, 2 = Tue, 3 = Wed, 4 = Thu, 5 = Fri, 6 = Sat.
 */
export const WEEKLY_CALENDAR: readonly DayProfile[] = [
  // 0: Sunday
  {
    dayName: 'Sun',
    size: 11,
    spark: 'CROSS',
    d: 8,
    k: 2,
    bodies: ['CIN', 'SNG', 'MRF', 'MRB', 'SHD', 'BCN', 'LNH', 'LNV', 'PLT'],
    isWeekday: false,
  },
  // 1: Monday
  {
    dayName: 'Mon',
    size: 7,
    spark: 'CROSS',
    d: 4,
    k: 6,
    bodies: ['CIN', 'SNG'],
    isWeekday: true,
  },
  // 2: Tuesday
  {
    dayName: 'Tue',
    size: 8,
    spark: 'CROSS',
    d: 5,
    k: 5,
    bodies: ['CIN', 'SNG', 'MRF', 'MRB'],
    isWeekday: true,
  },
  // 3: Wednesday
  {
    dayName: 'Wed',
    size: 8,
    spark: 'SKEW',
    d: 5,
    k: 4,
    bodies: ['CIN', 'SNG', 'MRF', 'MRB', 'SHD', 'BCN'],
    isWeekday: true,
  },
  // 4: Thursday
  {
    dayName: 'Thu',
    size: 9,
    spark: 'CROSS',
    d: 6,
    k: 3,
    bodies: ['CIN', 'SNG', 'MRF', 'MRB', 'SHD', 'BCN', 'LNH', 'LNV'],
    isWeekday: true,
  },
  // 5: Friday
  {
    dayName: 'Fri',
    size: 9,
    spark: 'LANCE',
    d: 6,
    k: 3,
    bodies: ['CIN', 'SNG', 'MRF', 'MRB', 'SHD', 'BCN', 'LNH', 'LNV', 'PLT'],
    isWeekday: true,
  },
  // 6: Saturday
  {
    dayName: 'Sat',
    size: 10,
    spark: 'SKEW',
    d: 8,
    k: 2,
    bodies: ['CIN', 'SNG', 'MRF', 'MRB', 'SHD', 'BCN', 'LNH', 'LNV', 'PLT'],
    isWeekday: false,
  },
];
