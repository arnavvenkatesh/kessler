import { solve, type SolveResult } from './solver';
import type { Board, Placement } from './types';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface HintTier1 {
  tier: 1;
  chainDepth: number;
}

export interface HintTier2 {
  tier: 2;
  chainDepth: number;
  bounds: BoundingBox;
}

export interface HintTier3 {
  tier: 3;
  chainDepth: number;
  bounds: BoundingBox;
  placement: Placement;
}

export type Hint = HintTier1 | HintTier2 | HintTier3;

/**
 * Computes a 3x3 bounding box centered around the optimal placement,
 * clamped cleanly to the board boundaries.
 */
export function getHintBoundingBox(w: number, h: number, optX: number, optY: number): BoundingBox {
  let minX = optX - 1;
  let minY = optY - 1;

  if (minX < 0) minX = 0;
  if (minY < 0) minY = 0;

  if (minX + 2 >= w) {
    minX = w >= 3 ? w - 3 : 0;
  }
  if (minY + 2 >= h) {
    minY = h >= 3 ? h - 3 : 0;
  }

  const maxX = Math.min(w - 1, minX + 2);
  const maxY = Math.min(h - 1, minY + 2);

  return { minX, minY, maxX, maxY };
}

/**
 * Generates hints for a board by tier (1, 2, or 3) using the deterministic solver.
 * Pure function: zero DOM, zero floats, zero randomness.
 */
export function getHint(b: Board, tier: 1, precomputedSolve?: SolveResult): HintTier1;
export function getHint(b: Board, tier: 2, precomputedSolve?: SolveResult): HintTier2;
export function getHint(b: Board, tier: 3, precomputedSolve?: SolveResult): HintTier3;
export function getHint(b: Board, tier: 1 | 2 | 3, precomputedSolve?: SolveResult): Hint;
export function getHint(b: Board, tier: 1 | 2 | 3, precomputedSolve?: SolveResult): Hint {
  const solution = precomputedSolve ?? solve(b);
  const chainDepth = solution.stats.chainDepth;
  const best = solution.best;

  if (tier === 1) {
    return {
      tier: 1,
      chainDepth,
    };
  }

  const bounds = getHintBoundingBox(b.w, b.h, best.x, best.y);

  if (tier === 2) {
    return {
      tier: 2,
      chainDepth,
      bounds,
    };
  }

  return {
    tier: 3,
    chainDepth,
    bounds,
    placement: best,
  };
}
