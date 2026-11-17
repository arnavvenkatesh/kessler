import { getDayProfile, getDayNumber } from './calendar';
import {
  GENERATOR_VERSION,
  RULESET_VERSION,
  WEEKLY_CALENDAR,
  type DayProfile,
} from './config';
import { hash32, mulberry32 } from './rng';
import { solve } from './solver';
import type { Board, Cell, Difficulty, Kind, SolveStats } from './types';

export interface GenerateResult {
  board: Board;
  stats: SolveStats;
  attempts: number;
  degraded: boolean;
}

export interface DailyResult extends GenerateResult {
  dayNumber: number;
  dateStr: string;
}

/**
 * Computes a deterministic 32-bit hex hash of a board configuration.
 */
export function hashBoard(b: Board): string {
  let str = `${b.rulesetVersion}|${b.w}x${b.h}|${b.spark}|${b.mutator ?? ''}`;
  for (let i = 0; i < b.cells.length; i++) {
    const c = b.cells[i];
    str += c ? `|${c.kind}${c.pair !== undefined ? `:${c.pair}` : ''}` : '|.';
  }
  return hash32(str).toString(16).padStart(8, '0');
}

/**
 * Maps a difficulty string to a corresponding DayProfile.
 */
export function difficultyToProfile(d: Difficulty): DayProfile {
  switch (d) {
    case 'easy':
      return WEEKLY_CALENDAR[1]!; // Monday (7x7)
    case 'medium':
      return WEEKLY_CALENDAR[3]!; // Wednesday (8x8)
    case 'hard':
      return WEEKLY_CALENDAR[4]!; // Thursday (9x9)
    case 'extreme':
      return WEEKLY_CALENDAR[0]!; // Sunday (11x11)
  }
}

const ALL_DIRS: readonly (readonly [number, number])[] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [1, -1],
  [1, 1],
  [-1, 1],
  [-1, -1],
];

/**
 * Generates a candidate board for an attempt.
 */
function generateCandidate(
  rng: ReturnType<typeof mulberry32>,
  profile: DayProfile,
  attemptIndex: number,
): Board {
  const { size, spark, bodies, isWeekday, dayName } = profile;
  const w = size;
  const h = size;
  const totalCells = w * h;
  const cells: (Cell | null)[] = new Array(totalCells).fill(null);

  const destroyableKinds = bodies.filter((k) => k !== 'SNG' && k !== 'MRF' && k !== 'MRB');
  const obstacleKinds = bodies.filter((k) => k === 'SNG' || k === 'MRF' || k === 'MRB');

  function pickKind(kinds: readonly Kind[]): Kind {
    return kinds[rng.nextInt(0, kinds.length - 1)]!;
  }

  let baseDestroyable = 12;
  let baseObstacles = 5;
  if (dayName === 'Mon') {
    baseDestroyable = 10;
    baseObstacles = 5;
  } else if (dayName === 'Tue') {
    baseDestroyable = 12;
    baseObstacles = 6;
  } else if (dayName === 'Wed') {
    baseDestroyable = 18;
    baseObstacles = 5;
  } else if (dayName === 'Thu') {
    baseDestroyable = 23;
    baseObstacles = 6;
  } else if (dayName === 'Fri') {
    baseDestroyable = 24;
    baseObstacles = 6;
  } else if (dayName === 'Sat') {
    baseDestroyable = 30;
    baseObstacles = 7;
  } else if (dayName === 'Sun') {
    baseDestroyable = 32;
    baseObstacles = 8;
  }

  // Multi-stage adaptive sweep across attempts
  const stage = (attemptIndex / 50) | 0;
  const targetDestroyable = Math.max(
    8,
    baseDestroyable +
      (stage === 1 ? -1 : stage === 2 ? 1 : stage === 3 ? -2 : stage === 4 ? 2 : stage === 5 ? -3 : 0),
  );
  const targetObstacles = Math.min(
    ((totalCells * 14) / 100) | 0,
    Math.max(1, baseObstacles + (stage === 2 ? 1 : stage === 4 ? -1 : 0)),
  );

  const placedCoords: [number, number][] = [];

  // Shelter 2 bodies in opposite corners on weekdays to ensure destroyedPercent < 90% and prevent clean sweep
  if (isWeekday && obstacleKinds.includes('SNG')) {
    cells[0] = { kind: pickKind(destroyableKinds) };
    placedCoords.push([0, 0]);
    cells[1] = { kind: 'SNG' };
    cells[w] = { kind: 'SNG' };

    const brIdx = (h - 1) * w + (w - 1);
    cells[brIdx] = { kind: pickKind(destroyableKinds) };
    placedCoords.push([w - 1, h - 1]);
    cells[brIdx - 1] = { kind: 'SNG' };
    cells[brIdx - w] = { kind: 'SNG' };
  }

  // Main cluster seed body
  let sx = rng.nextInt(2, w - 3);
  let sy = rng.nextInt(2, h - 3);
  while (cells[sy * w + sx] !== null) {
    sx = rng.nextInt(1, w - 2);
    sy = rng.nextInt(1, h - 2);
  }
  cells[sy * w + sx] = { kind: pickKind(destroyableKinds) };
  placedCoords.push([sx, sy]);

  // Grow interconnected chain network with minimum-spacing rules (no isolated dead bodies)
  let att = 0;
  while (placedCoords.length < targetDestroyable && att < 500) {
    att++;
    const pIdx = rng.nextInt(0, placedCoords.length - 1);
    const [px, py] = placedCoords[pIdx]!;
    const dir = ALL_DIRS[rng.nextInt(0, ALL_DIRS.length - 1)]!;
    const step = stage >= 4 ? rng.nextInt(1, 3) : rng.nextInt(1, 2);
    const nx = px + dir[0] * step;
    const ny = py + dir[1] * step;

    if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
      const idx = ny * w + nx;
      if (cells[idx] === null) {
        cells[idx] = { kind: pickKind(destroyableKinds) };
        placedCoords.push([nx, ny]);
      }
    }
  }

  // Scatter obstacles (SNG, MRF, MRB)
  let obstPlaced = 0;
  att = 0;
  while (obstPlaced < targetObstacles && att < 200) {
    att++;
    const ox = rng.nextInt(0, w - 1);
    const oy = rng.nextInt(0, h - 1);
    const idx = oy * w + ox;
    if (cells[idx] === null) {
      cells[idx] = { kind: pickKind(obstacleKinds) };
      obstPlaced++;
    }
  }

  return {
    w,
    h,
    cells,
    spark,
    rulesetVersion: RULESET_VERSION,
  };
}

/**
 * Checks quality gates for a solved attempt according to BLUEPRINT Section 4.
 */
function evaluateQualityGates(
  stats: SolveStats,
  bestScore: number,
  profile: DayProfile,
): { passed: boolean; score: number } {
  let passed = true;
  let score = 1000;

  // 1. Optimum chain depth at least D
  if (stats.chainDepth < profile.d) {
    passed = false;
    score -= (profile.d - stats.chainDepth) * 150;
  }

  // 2. Optimum destroys 40% to 90% of destroyable bodies
  if (stats.destroyedPercent < 40) {
    passed = false;
    score -= (40 - stats.destroyedPercent) * 15;
  } else if (stats.destroyedPercent > 90) {
    passed = false;
    score -= (stats.destroyedPercent - 90) * 15;
  }

  // 3. Placements within 90% of optimum: between 1 and K
  if (stats.topScorePlacementsCount < 1) {
    passed = false;
    score -= 200;
  } else if (stats.topScorePlacementsCount > profile.k) {
    passed = false;
    score -= (stats.topScorePlacementsCount - profile.k) * 50;
  }

  // 4. Median placement scores under 45% of optimum
  if (bestScore > 0 && stats.medianScore * 100 >= bestScore * 45) {
    passed = false;
    score -= 150;
  }

  // 5. Decoys: at least 2 placements scoring 60% to 85% of optimum that sit >= 3 cells away
  if (stats.decoyCount < 2) {
    passed = false;
    score -= (2 - stats.decoyCount) * 100;
  }

  // 6. Optimum is not a clean sweep on weekdays
  if (profile.isWeekday && stats.isCleanSweep) {
    passed = false;
    score -= 300;
  }

  return { passed, score };
}

/**
 * Core board generator.
 * Tries up to 300 attempts to pass all quality gates.
 * If none pass, returns the best attempt with degraded: true.
 */
export function generate(
  seed: number,
  dOrProfile: Difficulty | DayProfile = 'medium',
): GenerateResult {
  const profile: DayProfile =
    typeof dOrProfile === 'string' ? difficultyToProfile(dOrProfile) : dOrProfile;

  const rng = mulberry32(seed);

  let bestCandidateBoard: Board | null = null;
  let bestCandidateStats: SolveStats | null = null;
  let highestScore = -999999;

  for (let a = 0; a < 300; a++) {
    const candidate = generateCandidate(rng, profile, a);
    const solved = solve(candidate);
    const gateCheck = evaluateQualityGates(solved.stats, solved.bestScore, profile);

    if (gateCheck.passed) {
      return {
        board: candidate,
        stats: solved.stats,
        attempts: a + 1,
        degraded: false,
      };
    }

    if (gateCheck.score > highestScore) {
      highestScore = gateCheck.score;
      bestCandidateBoard = candidate;
      bestCandidateStats = solved.stats;
    }
  }

  // Fallback if no attempt passed all gates
  return {
    board: bestCandidateBoard!,
    stats: bestCandidateStats!,
    attempts: 300,
    degraded: true,
  };
}

/**
 * Generates the daily puzzle board for a given ISO date string ("YYYY-MM-DD").
 */
export function generateDaily(dateStr: string): DailyResult {
  const profile = getDayProfile(dateStr);
  const seedString = `KESSLER|v${GENERATOR_VERSION}|${dateStr}`;
  const seed = hash32(seedString);
  const genResult = generate(seed, profile);

  const parts = dateStr.split('-');
  const y = Number.parseInt(parts[0] ?? '2026', 10);
  const m = Number.parseInt(parts[1] ?? '1', 10);
  const d = Number.parseInt(parts[2] ?? '1', 10);
  const dayNumber = getDayNumber(y, m, d);

  return {
    ...genResult,
    dayNumber,
    dateStr,
  };
}
