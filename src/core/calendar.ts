import { LAUNCH_DATE, WEEKLY_CALENDAR, type DayProfile } from './config';

/**
 * Pure integer conversion from Gregorian date to civil day count (relative to 1970-01-01).
 * Zero floats, zero Date objects.
 */
export function daysFromCivil(y: number, m: number, d: number): number {
  let year = y;
  if (m <= 2) {
    year -= 1;
  }
  const era = ((year >= 0 ? year : year - 399) / 400) | 0;
  const yoe = year - era * 400;
  const mOffset = m > 2 ? m - 3 : m + 9;
  const doy = (((153 * mOffset + 2) / 5) | 0) + d - 1;
  const doe = yoe * 365 + ((yoe / 4) | 0) - ((yoe / 100) | 0) + doy;
  return era * 146097 + doe - 719468;
}

/**
 * Parses YYYY-MM-DD into integer [year, month, day].
 */
export function parseDateString(dateStr: string): [number, number, number] {
  const parts = dateStr.split('-');
  const y = Number.parseInt(parts[0] ?? '2026', 10);
  const m = Number.parseInt(parts[1] ?? '1', 10);
  const d = Number.parseInt(parts[2] ?? '1', 10);
  return [y, m, d];
}

/**
 * Formats [year, month, day] into YYYY-MM-DD.
 */
export function formatDateString(y: number, m: number, d: number): string {
  const mm = m < 10 ? `0${m}` : `${m}`;
  const dd = d < 10 ? `0${d}` : `${d}`;
  return `${y}-${mm}-${dd}`;
}

/**
 * Converts days since 1970-01-01 back to Gregorian [year, month, day].
 * Pure integer math.
 */
export function civilFromDays(days: number): [number, number, number] {
  const z = days + 719468;
  const era = ((z >= 0 ? z : z - 146096) / 146097) | 0;
  const doe = z - era * 146097;
  const yoe =
    ((doe - ((doe / 1460) | 0) + ((doe / 36524) | 0) - ((doe / 146096) | 0)) / 365) | 0;
  let y = yoe + era * 400;
  const doy = doe - (365 * yoe + ((yoe / 4) | 0) - ((yoe / 100) | 0));
  const mp = ((5 * doy + 2) / 153) | 0;
  const d = doy - (((153 * mp + 2) / 5) | 0) + 1;
  const m = mp < 10 ? mp + 3 : mp - 9;
  y += m <= 2 ? 1 : 0;
  return [y, m, d];
}

/**
 * Returns the weekday index for a date (0=Sun, 1=Mon, ..., 6=Sat).
 */
export function getWeekday(y: number, m: number, d: number): number {
  const days = daysFromCivil(y, m, d);
  return ((days + 4) % 7 + 7) % 7;
}

/**
 * Returns the day number since LAUNCH_DATE (starts at 1 on LAUNCH_DATE).
 */
export function getDayNumber(y: number, m: number, d: number): number {
  const [ly, lm, ld] = parseDateString(LAUNCH_DATE);
  const targetDays = daysFromCivil(y, m, d);
  const launchDays = daysFromCivil(ly, lm, ld);
  return targetDays - launchDays + 1;
}

/**
 * Retrieves the DayProfile for a given date.
 */
export function getDayProfile(dateStr: string): DayProfile {
  const [y, m, d] = parseDateString(dateStr);
  const wd = getWeekday(y, m, d);
  return WEEKLY_CALENDAR[wd]!;
}
