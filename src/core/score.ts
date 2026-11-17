import type { Kind } from './types';

/**
 * Values for destroyable bodies.
 * Permanent bodies have value 0 and are not destroyable.
 */
export const BODY_VALUES: Record<Kind, number> = {
  CIN: 10,
  SHD: 10,
  BCN: 40,
  LNH: 15,
  LNV: 15,
  PLT: 20,
  FUS: 15,
  SNG: 0,
  MRF: 0,
  MRB: 0,
  WRM: 0,
};

/**
 * Checks whether a body kind is destroyable.
 */
export function isDestroyable(kind: Kind): boolean {
  return (
    kind === 'CIN' ||
    kind === 'SHD' ||
    kind === 'BCN' ||
    kind === 'LNH' ||
    kind === 'LNV' ||
    kind === 'PLT' ||
    kind === 'FUS'
  );
}

/**
 * Multiplier for detonation tick t.
 * mult(t) = min(30, 8 + 2t)
 */
export function tickMultiplier(t: number): number {
  const m = 8 + 2 * t;
  return m > 30 ? 30 : m;
}

/**
 * Computes the detonation score for a destroyed body at tick t.
 */
export function bodyScore(kind: Kind, t: number): number {
  const value = BODY_VALUES[kind];
  if (value === 0) return 0;
  return value * tickMultiplier(t);
}

export const CLEAN_SWEEP_BONUS = 100;
export const CONVERGENCE_BONUS_PER_EXTRA_HIT = 5;
