import { isDestroyable } from './score';
import { simulate } from './sim';
import type { Board, Placement, SimResult, SolveStats } from './types';

export interface SolveResult {
  best: Placement;
  bestScore: number;
  bestResult: SimResult;
  scores: Int32Array;
  stats: SolveStats;
}

/**
 * Solves a board by testing every valid Spark placement (and allowed rotation).
 * Integer math only: no floats, no DOM, no Math.random.
 */
export function solve(b: Board): SolveResult {
  const { w, h, cells, spark } = b;
  const totalCells = w * h;
  const scores = new Int32Array(totalCells);
  scores.fill(-1);

  // Count total destroyable bodies initially on the board
  let totalDestroyable = 0;
  for (let i = 0; i < totalCells; i++) {
    const c = cells[i];
    if (c !== null && c !== undefined && isDestroyable(c.kind)) {
      totalDestroyable++;
    }
  }

  let bestScore = -1;
  let bestPlacement: Placement = { x: 0, y: 0 };
  let bestResult: SimResult = {
    score: 0,
    destroyed: 0,
    lastTick: 0,
    events: [],
    hash: '00000000',
  };

  const rotations: (0 | 1)[] = spark === 'LANCE' ? [0, 1] : [0];
  const validScores: number[] = [];

  if (b.mutator === 'TWIN_SPARK') {
    const emptyIndices: number[] = [];
    for (let idx = 0; idx < totalCells; idx++) {
      if (cells[idx] === null || cells[idx] === undefined) {
        emptyIndices.push(idx);
      }
    }

    for (let i = 0; i < emptyIndices.length; i++) {
      const idx1 = emptyIndices[i]!;
      const x1 = idx1 % w;
      const y1 = (idx1 / w) | 0;

      for (let j = i + 1; j < emptyIndices.length; j++) {
        const idx2 = emptyIndices[j]!;
        const x2 = idx2 % w;
        const y2 = (idx2 / w) | 0;

        for (let r1 = 0; r1 < rotations.length; r1++) {
          const rot1 = rotations[r1]!;
          for (let r2 = 0; r2 < rotations.length; r2++) {
            const rot2 = rotations[r2]!;
            const res = simulate(b, {
              x: x1,
              y: y1,
              rot: rot1,
              twin: { x: x2, y: y2, rot: rot2 },
            });

            if (res.score > scores[idx1]!) scores[idx1] = res.score;
            if (res.score > scores[idx2]!) scores[idx2] = res.score;

            if (res.score > bestScore) {
              bestScore = res.score;
              bestPlacement = {
                x: x1,
                y: y1,
                rot: rot1,
                twin: { x: x2, y: y2, rot: rot2 },
              };
              bestResult = res;
            }
          }
        }
      }
    }

    for (const idx of emptyIndices) {
      if (scores[idx]! >= 0) {
        validScores.push(scores[idx]!);
      }
    }
  } else {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        if (cells[idx] !== null && cells[idx] !== undefined) {
          continue;
        }

        let cellBestScore = -1;
        let cellBestRot: 0 | 1 = 0;
        let cellBestResult: SimResult | null = null;

        for (let r = 0; r < rotations.length; r++) {
          const rot = rotations[r]!;
          const res = simulate(b, { x, y, rot });
          if (res.score > cellBestScore) {
            cellBestScore = res.score;
            cellBestRot = rot;
            cellBestResult = res;
          }
        }

        scores[idx] = cellBestScore;
        validScores.push(cellBestScore);

        if (cellBestScore > bestScore && cellBestResult !== null) {
          bestScore = cellBestScore;
          bestPlacement = { x, y, rot: cellBestRot };
          bestResult = cellBestResult;
        }
      }
    }
  }

  // If no empty cells or bestScore is 0
  if (validScores.length === 0) {
    return {
      best: { x: 0, y: 0 },
      bestScore: 0,
      bestResult,
      scores,
      stats: {
        chainDepth: 0,
        destroyedCount: 0,
        destroyedPercent: 0,
        topScorePlacementsCount: 0,
        medianScore: 0,
        decoyCount: 0,
        isCleanSweep: false,
      },
    };
  }

  // Sort valid scores ascending to compute median (integer arithmetic)
  validScores.sort((a, b) => a - b);
  const mid = (validScores.length / 2) | 0;
  const medianScore = validScores[mid] ?? 0;

  let topScorePlacementsCount = 0;
  let decoyCount = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const score = scores[idx] ?? -1;
      if (score < 0) continue;

      // Placements within 90% of optimum: score * 10 >= bestScore * 9
      if (bestScore > 0 && score * 10 >= bestScore * 9) {
        topScorePlacementsCount++;
      }

      // Decoys: 60% to 85% of optimum and distance >= 3 cells from best cell
      const chebyshevDist = Math.max(Math.abs(x - bestPlacement.x), Math.abs(y - bestPlacement.y));
      if (
        bestScore > 0 &&
        score * 100 >= bestScore * 60 &&
        score * 100 <= bestScore * 85 &&
        chebyshevDist >= 3
      ) {
        decoyCount++;
      }
    }
  }

  const destroyedPercent =
    totalDestroyable > 0 ? ((bestResult.destroyed * 100) / totalDestroyable) | 0 : 0;
  const isCleanSweep = totalDestroyable > 0 && bestResult.destroyed === totalDestroyable;

  const stats: SolveStats = {
    chainDepth: bestResult.lastTick,
    destroyedCount: bestResult.destroyed,
    destroyedPercent,
    topScorePlacementsCount,
    medianScore,
    decoyCount,
    isCleanSweep,
  };

  return {
    best: bestPlacement,
    bestScore,
    bestResult,
    scores,
    stats,
  };
}
