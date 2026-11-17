import { describe, it, expect } from 'vitest';
import {
  CINDER_VARIANTS,
  SHARD_VARIANTS,
  BEACON_STAR,
  getRockVariantIndex,
} from '../src/app/render/shapes';
import { computeBoardMetrics, traceFirstHitPreviews } from '../src/app/render/boardRenderer';
import type { Board } from '../src/core/types';

describe('Shapes and Render Metrics Tests', () => {
  it('validates Cinder rock variants are valid 24x24 integer polygons', () => {
    expect(CINDER_VARIANTS.length).toBe(3);

    for (const poly of CINDER_VARIANTS) {
      expect(poly.length % 2).toBe(0);
      expect(poly.length).toBeGreaterThanOrEqual(6); // At least 3 vertices
      for (let i = 0; i < poly.length; i++) {
        const val = poly[i]!;
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(24);
      }
    }
  });

  it('validates Shard crystal variants are valid 24x24 integer polygons', () => {
    expect(SHARD_VARIANTS.length).toBe(3);

    for (const poly of SHARD_VARIANTS) {
      expect(poly.length % 2).toBe(0);
      for (let i = 0; i < poly.length; i++) {
        const val = poly[i]!;
        expect(Number.isInteger(val)).toBe(true);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(24);
      }
    }
  });

  it('validates Beacon star vertices', () => {
    expect(BEACON_STAR.length).toBe(16); // 8 vertices
    for (let i = 0; i < BEACON_STAR.length; i++) {
      const val = BEACON_STAR[i]!;
      expect(Number.isInteger(val)).toBe(true);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(24);
    }
  });

  it('computes deterministic rock variants from cell coordinates', () => {
    const v1 = getRockVariantIndex(0, 0);
    const v2 = getRockVariantIndex(1, 0);
    const v3 = getRockVariantIndex(0, 1);
    expect([0, 1, 2]).toContain(v1);
    expect([0, 1, 2]).toContain(v2);
    expect([0, 1, 2]).toContain(v3);
    // Deterministic repeatability
    expect(getRockVariantIndex(0, 0)).toBe(v1);
  });

  it('computes integer board metrics for crisp pixel rendering', () => {
    const metrics = computeBoardMetrics(800, 600, 7, 7);
    expect(Number.isInteger(metrics.cellSize)).toBe(true);
    expect(Number.isInteger(metrics.boardSizePx)).toBe(true);
    expect(Number.isInteger(metrics.offsetX)).toBe(true);
    expect(Number.isInteger(metrics.offsetY)).toBe(true);
    expect(metrics.boardSizePx).toBe(metrics.cellSize * 7);
  });

  it('traces first-hit preview rays accurately', () => {
    const board: Board = {
      w: 5,
      h: 5,
      cells: new Array(25).fill(null),
      spark: 'CROSS',
      rulesetVersion: 1,
    };
    board.cells[2 * 5 + 4] = { kind: 'CIN' }; // at (4, 2)

    const preview = traceFirstHitPreviews(board, 2, 2);
    expect(preview.paths.length).toBeGreaterThan(0);
    // East ray from (2, 2) hits (4, 2)
    expect(preview.hitTargets).toContainEqual([4, 2]);
  });
});
