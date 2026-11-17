/**
 * Local storage manager for daily attempt locks, streaks, and player statistics.
 *
 * BLUEPRINT Section 5:
 * - One official attempt per day (locks after placement).
 * - Afterwards "Replay" is unranked.
 * - Local only: streak, grade distribution, best chain.
 */

import { daysFromCivil } from '../../core/calendar';
import type { Grade } from '../share/grade';

export interface DailyAttempt {
  dateStr: string;
  dayNumber: number;
  placement: { x: number; y: number; rot?: 0 | 1 };
  score: number;
  destroyed: number;
  lastTick: number;
  grade: Grade;
  percent: number;
  simHash: string;
  timestamp: number;
}

export interface PlayerStats {
  totalPlayed: number;
  currentStreak: number;
  maxStreak: number;
  lastPlayedDate: string | null;
  grades: Record<Grade, number>;
  bestScore: number;
  bestChain: number;
}

const STORAGE_PREFIX_DAILY = 'kessler:daily:';
const STORAGE_KEY_STATS = 'kessler:stats';

const DEFAULT_STATS: PlayerStats = {
  totalPlayed: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastPlayedDate: null,
  grades: {
    PERFECT: 0,
    NOVA: 0,
    FLARE: 0,
    SPARK: 0,
    DUD: 0,
  },
  bestScore: 0,
  bestChain: 0,
};

function parseDateDays(dateStr: string): number {
  const [yStr, mStr, dStr] = dateStr.split('-');
  const y = parseInt(yStr ?? '2026', 10);
  const m = parseInt(mStr ?? '1', 10);
  const d = parseInt(dStr ?? '1', 10);
  return daysFromCivil(y, m, d);
}

export class DailyStore {
  public getDailyAttempt(dateStr: string): DailyAttempt | null {
    if (typeof localStorage === 'undefined') return null;
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX_DAILY}${dateStr}`);
      if (!raw) return null;
      return JSON.parse(raw) as DailyAttempt;
    } catch {
      return null;
    }
  }

  public saveDailyAttempt(attempt: DailyAttempt): PlayerStats {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(
          `${STORAGE_PREFIX_DAILY}${attempt.dateStr}`,
          JSON.stringify(attempt),
        );
      } catch {
        // LocalStorage quota fallback
      }
    }

    return this.recordAttemptInStats(attempt);
  }

  public getStats(): PlayerStats {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_STATS };
    try {
      const raw = localStorage.getItem(STORAGE_KEY_STATS);
      if (!raw) return { ...DEFAULT_STATS };
      const parsed = JSON.parse(raw) as Partial<PlayerStats>;
      return {
        totalPlayed: parsed.totalPlayed ?? 0,
        currentStreak: parsed.currentStreak ?? 0,
        maxStreak: parsed.maxStreak ?? 0,
        lastPlayedDate: parsed.lastPlayedDate ?? null,
        grades: {
          PERFECT: parsed.grades?.PERFECT ?? 0,
          NOVA: parsed.grades?.NOVA ?? 0,
          FLARE: parsed.grades?.FLARE ?? 0,
          SPARK: parsed.grades?.SPARK ?? 0,
          DUD: parsed.grades?.DUD ?? 0,
        },
        bestScore: parsed.bestScore ?? 0,
        bestChain: parsed.bestChain ?? 0,
      };
    } catch {
      return { ...DEFAULT_STATS };
    }
  }

  private recordAttemptInStats(attempt: DailyAttempt): PlayerStats {
    const stats = this.getStats();

    // Check if streak continues
    if (stats.lastPlayedDate) {
      const lastDays = parseDateDays(stats.lastPlayedDate);
      const curDays = parseDateDays(attempt.dateStr);

      if (curDays === lastDays) {
        // Already recorded today, don't double-count stats
        return stats;
      } else if (curDays === lastDays + 1) {
        // Consecutive day streak
        stats.currentStreak += 1;
      } else {
        // Streak broken
        stats.currentStreak = 1;
      }
    } else {
      stats.currentStreak = 1;
    }

    stats.totalPlayed += 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
    stats.lastPlayedDate = attempt.dateStr;
    stats.grades[attempt.grade] = (stats.grades[attempt.grade] ?? 0) + 1;
    stats.bestScore = Math.max(stats.bestScore, attempt.score);
    stats.bestChain = Math.max(stats.bestChain, attempt.lastTick);

    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_STATS, JSON.stringify(stats));
      } catch {
        // Storage fallback
      }
    }

    return stats;
  }

  public clearAll(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY_STATS);
      // Remove all kessler:daily:* keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(STORAGE_PREFIX_DAILY)) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        localStorage.removeItem(k);
      }
    } catch {
      // Storage fallback
    }
  }
}

export const dailyStore = new DailyStore();
