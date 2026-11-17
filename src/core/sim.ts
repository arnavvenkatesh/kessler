import { hash32 } from './rng';
import {
  BODY_VALUES,
  isDestroyable,
  bodyScore,
  CLEAN_SWEEP_BONUS,
  CONVERGENCE_BONUS_PER_EXTRA_HIT,
} from './score';
import type { Board, Cell, Kind, Placement, SimEvent, SimResult } from './types';

interface Emitter {
  x: number;
  y: number;
  kind: Kind;
}

interface CellState {
  cell: Cell | null;
  toughness: number;
  scheduledTick: number;
}

/**
 * Direction vectors: [dx, dy]
 */
const ORTHOGONAL_DIRS: readonly (readonly [number, number])[] = [
  [0, -1], // North
  [1, 0], // East
  [0, 1], // South
  [-1, 0], // West
];

const DIAGONAL_DIRS: readonly (readonly [number, number])[] = [
  [1, -1], // North-East
  [1, 1], // South-East
  [-1, 1], // South-West
  [-1, -1], // North-West
];

/**
 * Returns ray directions for a detonating body kind.
 */
function getRayDirections(
  kind: Kind,
  lanceRot: 0 | 1 = 0,
): { dirs: readonly (readonly [number, number])[]; piercing: boolean } {
  switch (kind) {
    case 'CIN':
    case 'PLT':
    case 'FUS':
      return { dirs: ORTHOGONAL_DIRS, piercing: false };
    case 'SHD':
      return { dirs: DIAGONAL_DIRS, piercing: false };
    case 'LNH':
      return {
        dirs: [
          [1, 0],
          [-1, 0],
        ],
        piercing: true,
      };
    case 'LNV':
      return {
        dirs: [
          [0, -1],
          [0, 1],
        ],
        piercing: true,
      };
    case 'BCN':
      return { dirs: [], piercing: false };
    default:
      if (lanceRot === 1) {
        return {
          dirs: [
            [0, -1],
            [0, 1],
          ],
          piercing: true,
        };
      }
      return { dirs: [], piercing: false };
  }
}

/**
 * Resolves mirror reflection for orthogonal rays.
 * Diagonal rays pass through unchanged.
 */
function deflectOrthogonal(
  kind: 'MRF' | 'MRB',
  dx: number,
  dy: number,
): [number, number] | null {
  // If diagonal ray, passes through (no deflection)
  if (dx !== 0 && dy !== 0) {
    return null;
  }

  if (kind === 'MRF') {
    // Mirror '/': E to N, N to E, W to S, S to W
    if (dx === 1 && dy === 0) return [0, -1]; // E -> N
    if (dx === 0 && dy === -1) return [1, 0]; // N -> E
    if (dx === -1 && dy === 0) return [0, 1]; // W -> S
    if (dx === 0 && dy === 1) return [-1, 0]; // S -> W
  } else if (kind === 'MRB') {
    // Mirror '\': E to S, S to E, W to N, N to W
    if (dx === 1 && dy === 0) return [0, 1]; // E -> S
    if (dx === 0 && dy === 1) return [1, 0]; // S -> E
    if (dx === -1 && dy === 0) return [0, -1]; // W -> N
    if (dx === 0 && dy === -1) return [-1, 0]; // N -> W
  }

  return null;
}

/**
 * Simulates a single Spark placement on a Board according to RULESET v1.
 * Pure function: deterministic integer math, no floating point, no DOM.
 */
export function simulate(b: Board, p: Placement): SimResult {
  const { w, h, cells } = b;

  if (p.x < 0 || p.x >= w || p.y < 0 || p.y >= h) {
    throw new Error(`Placement (${p.x}, ${p.y}) is out of bounds [${w}x${h}]`);
  }

  const startIdx = p.y * w + p.x;
  if (cells[startIdx] !== null) {
    throw new Error(`Placement cell (${p.x}, ${p.y}) is not empty`);
  }

  // Count total destroyable bodies initially on board
  let totalDestroyable = 0;
  const grid: CellState[] = new Array(w * h);

  for (let i = 0; i < cells.length; i++) {
    const c = cells[i] ?? null;
    const isDest = c !== null && isDestroyable(c.kind);
    if (isDest) {
      totalDestroyable++;
    }
    const initialToughness = c?.kind === 'PLT' ? 2 : isDest ? 1 : 999999;
    grid[i] = {
      cell: c,
      toughness: initialToughness,
      scheduledTick: 0,
    };
  }

  const events: SimEvent[] = [];
  let score = 0;
  let destroyedCount = 0;
  let t = 1;
  const maxRaySteps = w * h * 4;

  // Resolve Spark kind
  let sparkKind: Kind = 'CIN';
  if (b.spark === 'CROSS') {
    sparkKind = 'CIN';
  } else if (b.spark === 'SKEW') {
    sparkKind = 'SHD';
  } else if (b.spark === 'LANCE') {
    sparkKind = p.rot === 1 ? 'LNV' : 'LNH';
  }

  // Active emitters list for tick t
  let activeEmitters: Emitter[] = [{ x: p.x, y: p.y, kind: sparkKind }];

  if (p.twin) {
    if (p.twin.x < 0 || p.twin.x >= w || p.twin.y < 0 || p.twin.y >= h) {
      throw new Error(`Twin placement (${p.twin.x}, ${p.twin.y}) is out of bounds [${w}x${h}]`);
    }
    const twinIdx = p.twin.y * w + p.twin.x;
    if (cells[twinIdx] !== null) {
      throw new Error(`Twin placement cell (${p.twin.x}, ${p.twin.y}) is not empty`);
    }
    if (p.twin.x === p.x && p.twin.y === p.y) {
      throw new Error(`Twin placement cannot share cell with primary placement`);
    }
    let twinSparkKind: Kind = sparkKind;
    if (b.spark === 'LANCE') {
      twinSparkKind = p.twin.rot === 1 ? 'LNV' : 'LNH';
    }
    activeEmitters.push({ x: p.twin.x, y: p.twin.y, kind: twinSparkKind });
    activeEmitters.sort((a, b) => (a.y * w + a.x) - (b.y * w + b.x));
  }

  // Check mutators
  const isSolarWind = b.mutator === 'SOLAR_WIND';
  let deadZoneMinX = -999;
  let deadZoneMinY = -999;
  if (b.mutator && b.mutator.startsWith('DEAD_ZONE')) {
    if (b.mutator.includes(':')) {
      const coords = b.mutator.split(':')[1]?.split(',') ?? [];
      deadZoneMinX = Number.parseInt(coords[0] ?? '0', 10);
      deadZoneMinY = Number.parseInt(coords[1] ?? '0', 10);
    } else {
      deadZoneMinX = ((w - 3) / 2) | 0;
      deadZoneMinY = ((h - 3) / 2) | 0;
    }
  }

  while (activeEmitters.length > 0) {
    // 1 & 2. Remove all emitters from the grid and record detonations
    for (let eIdx = 0; eIdx < activeEmitters.length; eIdx++) {
      const em = activeEmitters[eIdx]!;
      events.push({
        t,
        type: 'detonate',
        x: em.x,
        y: em.y,
        kind: em.kind,
      });

      // Spark detonates at t=1 but scores nothing and was never a grid body
      if (t > 1) {
        const idx = em.y * w + em.x;
        grid[idx]!.cell = null;
        destroyedCount++;
        score += bodyScore(em.kind, t);
      }
    }

    // Hits registered in this tick: cell index -> number of hits
    const hitsThisTick = new Int32Array(w * h);

    // 3. For each emitter in row-major order and each of its ray directions, trace
    for (let eIdx = 0; eIdx < activeEmitters.length; eIdx++) {
      const em = activeEmitters[eIdx]!;
      const lanceRot = em.kind === 'LNV' ? 1 : 0;
      const { dirs, piercing } = getRayDirections(em.kind, lanceRot);

      for (let d = 0; d < dirs.length; d++) {
        let dx = dirs[d]![0];
        let dy = dirs[d]![1];
        let curX = em.x;
        let curY = em.y;
        let steps = 0;
        let path: [number, number][] = [[curX, curY]];
        const effectiveMaxSteps = isSolarWind ? 6 : maxRaySteps;

        while (steps < effectiveMaxSteps) {
          curX += dx;
          curY += dy;
          steps++;

          // Off-board ends the ray
          if (curX < 0 || curX >= w || curY < 0 || curY >= h) {
            break;
          }

          path.push([curX, curY]);

          // DEAD_ZONE mutator: absorbs any ray entering the 3x3 patch
          if (
            curX >= deadZoneMinX &&
            curX < deadZoneMinX + 3 &&
            curY >= deadZoneMinY &&
            curY < deadZoneMinY + 3
          ) {
            events.push({ t, type: 'absorb', x: curX, y: curY });
            break;
          }

          const cellIdx = curY * w + curX;
          const target = grid[cellIdx]!;

          // Empty cell: continue ray
          if (target.cell === null) {
            continue;
          }

          const targetKind = target.cell.kind;

          // SNG: Singularity absorbs any ray that reaches it
          if (targetKind === 'SNG') {
            events.push({ t, type: 'absorb', x: curX, y: curY });
            break;
          }

          // MRF / MRB: Mirror
          if (targetKind === 'MRF' || targetKind === 'MRB') {
            const deflected = deflectOrthogonal(targetKind, dx, dy);
            if (deflected !== null) {
              events.push({ t, type: 'deflect', x: curX, y: curY });
              dx = deflected[0];
              dy = deflected[1];
              continue;
            }
            // Diagonal rays pass through without deflecting
            continue;
          }

          // WRM: Wormhole (paired by id)
          if (targetKind === 'WRM') {
            events.push({ t, type: 'teleport', x: curX, y: curY });
            const targetPair = target.cell.pair;
            let partnerIdx = -1;
            for (let pi = 0; pi < grid.length; pi++) {
              if (pi !== cellIdx) {
                const pc = grid[pi]!.cell;
                if (pc && pc.kind === 'WRM' && (targetPair === undefined || pc.pair === targetPair)) {
                  partnerIdx = pi;
                  break;
                }
              }
            }

            if (partnerIdx !== -1) {
              const partnerX = partnerIdx % w;
              const partnerY = (partnerIdx / w) | 0;
              if (path.length >= 2) {
                events.push({ t, type: 'ray', path: [...path] });
              }
              curX = partnerX;
              curY = partnerY;
              path = [[curX, curY]];
              continue;
            } else {
              break;
            }
          }

          // Ignitable body: registers a hit
          if (BODY_VALUES[targetKind] > 0) {
            hitsThisTick[cellIdx] = (hitsThisTick[cellIdx] ?? 0) + 1;
            events.push({ t, type: 'hit', x: curX, y: curY });

            if (!piercing) {
              break;
            }
          }
        }

        if (path.length >= 2) {
          events.push({ t, type: 'ray', path });
        }
      }
    }

    // 4. Apply hits only after all rays are traced
    for (let idx = 0; idx < grid.length; idx++) {
      const hitCount = hitsThisTick[idx] ?? 0;
      if (hitCount === 0) continue;

      const target = grid[idx]!;
      if (target.cell === null || !isDestroyable(target.cell.kind)) {
        continue;
      }

      // Bodies scheduled but not yet detonated stay solid; extra hits on them do nothing
      if (target.scheduledTick > 0) {
        continue;
      }

      target.toughness -= hitCount;

      if (target.toughness <= 0) {
        // Scheduled detonation
        const scheduleDelay = target.cell.kind === 'FUS' ? 3 : 1;
        target.scheduledTick = t + scheduleDelay;

        // Convergence bonus: +5 for every extra simultaneous hit on a body in the tick it ignited
        if (hitCount > 1) {
          score += (hitCount - 1) * CONVERGENCE_BONUS_PER_EXTRA_HIT;
        }
      } else if (target.cell.kind === 'PLT') {
        const x = idx % w;
        const y = (idx / w) | 0;
        events.push({ t, type: 'crack', x, y });
      }
    }

    // Check for next tick's emitters
    t++;
    activeEmitters = [];

    // Find all bodies scheduled to detonate at tick t (in row-major order)
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const st = grid[idx]!;
        if (st.scheduledTick === t && st.cell !== null) {
          activeEmitters.push({ x, y, kind: st.cell.kind });
        }
      }
    }

    // If no emitters at tick t, but bodies are scheduled for later ticks (e.g. FUS), advance
    if (activeEmitters.length === 0) {
      let nextEarliestTick = 0;
      for (let idx = 0; idx < grid.length; idx++) {
        const st = grid[idx]!;
        if (st.scheduledTick >= t && st.cell !== null) {
          if (nextEarliestTick === 0 || st.scheduledTick < nextEarliestTick) {
            nextEarliestTick = st.scheduledTick;
          }
        }
      }
      if (nextEarliestTick > 0) {
        t = nextEarliestTick;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const idx = y * w + x;
            const st = grid[idx]!;
            if (st.scheduledTick === t && st.cell !== null) {
              activeEmitters.push({ x, y, kind: st.cell.kind });
            }
          }
        }
      }
    }
  }

  // 5. Scoring bonuses
  const cleanSweep = totalDestroyable > 0 && destroyedCount === totalDestroyable;
  if (cleanSweep) {
    score += CLEAN_SWEEP_BONUS;
  }

  const lastTick = t - 1;

  // Compute deterministic hash from canonical summary of results and events
  let eventSummary = `${b.rulesetVersion}|${p.x},${p.y},${p.rot ?? 0}${p.twin ? `+${p.twin.x},${p.twin.y},${p.twin.rot ?? 0}` : ''}|${score}|${destroyedCount}|${lastTick}`;
  for (let i = 0; i < events.length; i++) {
    const e = events[i]!;
    if (e.type === 'detonate') {
      eventSummary += `;d:${e.t},${e.x},${e.y},${e.kind}`;
    } else if (e.type === 'ray') {
      eventSummary += `;r:${e.t},${e.path.length}`;
    } else {
      eventSummary += `;${e.type[0]}:${e.t},${e.x},${e.y}`;
    }
  }

  const hashVal = hash32(eventSummary);
  const hash = hashVal.toString(16).padStart(8, '0');

  return {
    score,
    destroyed: destroyedCount,
    lastTick,
    events,
    hash,
  };
}
