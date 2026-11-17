import fs from 'node:fs';
import path from 'node:path';
import { hash32, mulberry32 } from '../src/core/rng';
import { solve } from '../src/core/solver';
import type { Board, Cell, Kind } from '../src/core/types';

export interface CampaignLevel {
  id: number;
  orbit: number;
  orbitName: string;
  name: string;
  briefing: string;
  goalType: 'par' | 'beacons' | 'clear';
  targetValue: number;
  medalThresholds: {
    bronze: number;
    silver: number;
    gold: number;
  };
  board: Board;
  optimumScore: number;
}

const ORBIT_CONFIGS = [
  {
    orbit: 1,
    name: 'Low Earth Orbit',
    size: 7,
    spark: 'CROSS' as const,
    bodies: ['CIN', 'SNG'] as Kind[],
    bodyCount: 10,
    obstacleCount: 3,
    mutator: undefined,
  },
  {
    orbit: 2,
    name: 'Molniya Ellipse',
    size: 8,
    spark: 'SKEW' as const,
    bodies: ['CIN', 'SHD', 'MRF', 'MRB'] as Kind[],
    bodyCount: 14,
    obstacleCount: 4,
    mutator: undefined,
  },
  {
    orbit: 3,
    name: 'Geostationary Ring',
    size: 8,
    spark: 'CROSS' as const,
    bodies: ['CIN', 'SHD', 'BCN', 'MRF', 'MRB'] as Kind[],
    bodyCount: 16,
    obstacleCount: 5,
    mutator: undefined,
  },
  {
    orbit: 4,
    name: 'Polar Patrol',
    size: 9,
    spark: 'LANCE' as const,
    bodies: ['CIN', 'SHD', 'LNH', 'LNV', 'SNG'] as Kind[],
    bodyCount: 18,
    obstacleCount: 6,
    mutator: undefined,
  },
  {
    orbit: 5,
    name: 'Graveyard Shell',
    size: 9,
    spark: 'CROSS' as const,
    bodies: ['CIN', 'PLT', 'FUS', 'MRF', 'MRB', 'SNG'] as Kind[],
    bodyCount: 20,
    obstacleCount: 6,
    mutator: undefined,
  },
  {
    orbit: 6,
    name: 'Lagrange Junction',
    size: 10,
    spark: 'CROSS' as const,
    bodies: ['CIN', 'SHD', 'BCN', 'LNH', 'LNV', 'PLT', 'FUS', 'WRM', 'SNG'] as Kind[],
    bodyCount: 22,
    obstacleCount: 8,
    mutator: undefined,
  },
];

const LEVEL_NAMES = [
  // Orbit 1
  ['Perigee Point', 'Apogee Skim', 'Thermal Shield', 'Debris Corridor', 'Echo Vector', 'Solar Flare', 'Booster Graveyard', 'Cold Horizon', 'Zenith Burn', 'Orbital Insertion'],
  // Orbit 2
  ['Inclination Shift', 'High Arctic', 'Reflection Arch', 'Prism Line', 'Crystal Drift', 'Biconic Node', 'Skew Intercept', 'Mirror Matrix', 'Refraction Trench', 'Polar Descent'],
  // Orbit 3
  ['Station Keep', 'Beacon Net', 'Equatorial Arc', 'Relay Station', 'Signal Converge', 'Geo-Sync Hub', 'Resonance Pulse', 'Array Cluster', 'Lighthouse Sector', 'Null Signal'],
  // Orbit 4
  ['Piercing Vector', 'Ice Needle', 'Long Axis', 'Meridian Strike', 'Borealis Line', 'Trans-Polar', 'Linear Cascade', 'Frost Piercer', 'High Penetration', 'Sub-Orbital Dip'],
  // Orbit 5
  ['Double Hull', 'Hardened Shell', 'Delayed Pulse', 'Armor Plate', 'Slow Fuse', 'Slag Field', 'Timed Detonation', 'Heavy Bastion', 'Chamber 44', 'Terminal Countdown'],
  // Orbit 6
  ['Singularity Well', 'Wormhole Alpha', 'Solar Drift', 'Dead Sector', 'Twin Ignition', 'Fold Space', 'Lagrange L1', 'Quantum Bridge', 'Event Horizon', 'Kessler Cascade'],
];

export function generateCampaign(): CampaignLevel[] {
  const levels: CampaignLevel[] = [];

  for (let orbitIdx = 0; orbitIdx < 6; orbitIdx++) {
    const orb = ORBIT_CONFIGS[orbitIdx]!;
    const orbitNum = orbitIdx + 1;
    const names = LEVEL_NAMES[orbitIdx]!;

    for (let lvl = 0; lvl < 10; lvl++) {
      const globalId = orbitIdx * 10 + lvl + 1;
      const seedStr = `KESSLER|CAMPAIGN|v1|orb${orbitNum}_lvl${lvl + 1}`;
      const rng = mulberry32(hash32(seedStr));

      let bestCandidate: { board: Board; score: number } | null = null;

      // Try candidate boards until finding a strong, solvable puzzle
      for (let attempt = 0; attempt < 150; attempt++) {
        const w = orb.size;
        const h = orb.size;
        const total = w * h;
        const cells: (Cell | null)[] = new Array(total).fill(null);

        // Mutator for Orbit 6 levels
        let mutator: string | undefined = undefined;
        let spark = orb.spark;

        if (orbitNum === 6) {
          if (lvl === 2 || lvl === 6) {
            mutator = 'SOLAR_WIND';
          } else if (lvl === 3 || lvl === 7) {
            mutator = 'DEAD_ZONE:3,3';
          } else if (lvl === 4 || lvl === 9) {
            mutator = 'TWIN_SPARK';
          }
          if (lvl % 3 === 1) spark = 'SKEW';
          if (lvl % 3 === 2) spark = 'LANCE';
        }

        // Available destroyables and obstacles
        const destroyables = orb.bodies.filter((k) => k !== 'SNG' && k !== 'MRF' && k !== 'MRB' && k !== 'WRM');
        const obstacles = orb.bodies.filter((k) => k === 'SNG' || k === 'MRF' || k === 'MRB');

        // Scatter destroyable bodies
        let placed = 0;
        let guard = 0;
        while (placed < orb.bodyCount && guard < 300) {
          guard++;
          const idx = rng.nextInt(0, total - 1);
          if (cells[idx] === null) {
            const kind = destroyables[rng.nextInt(0, destroyables.length - 1)]!;
            cells[idx] = { kind };
            placed++;
          }
        }

        // Scatter obstacles
        let obsPlaced = 0;
        guard = 0;
        while (obsPlaced < orb.obstacleCount && guard < 300) {
          guard++;
          const idx = rng.nextInt(0, total - 1);
          if (cells[idx] === null) {
            const kind = obstacles[rng.nextInt(0, obstacles.length - 1)] ?? 'SNG';
            cells[idx] = { kind };
            obsPlaced++;
          }
        }

        // Orbit 6 Wormholes
        if (orbitNum === 6 && (lvl === 1 || lvl === 5 || lvl === 7 || lvl === 8)) {
          let w1 = -1;
          let w2 = -1;
          while (w1 === -1 || cells[w1] !== null) {
            w1 = rng.nextInt(0, total - 1);
          }
          cells[w1] = { kind: 'WRM', pair: 1 };
          while (w2 === -1 || cells[w2] !== null) {
            w2 = rng.nextInt(0, total - 1);
          }
          cells[w2] = { kind: 'WRM', pair: 1 };
        }

        const candidateBoard: Board = {
          w,
          h,
          cells,
          spark,
          mutator,
          rulesetVersion: 1,
        };

        const sol = solve(candidateBoard);
        if (sol.bestScore >= 180 && sol.stats.chainDepth >= 3) {
          bestCandidate = { board: candidateBoard, score: sol.bestScore };
          break;
        }

        if (!bestCandidate || sol.bestScore > bestCandidate.score) {
          bestCandidate = { board: candidateBoard, score: sol.bestScore };
        }
      }

      const finalBoard = bestCandidate!.board;
      const optScore = bestCandidate!.score;

      // Determine goal type
      let goalType: 'par' | 'beacons' | 'clear' = 'par';
      let targetValue = Math.floor(optScore * 0.65);

      const beaconCount = finalBoard.cells.filter((c) => c?.kind === 'BCN').length;
      if (orbitNum === 3 && beaconCount >= 2) {
        goalType = 'beacons';
        targetValue = beaconCount;
      }

      const gold = optScore;
      const silver = Math.floor(optScore * 0.85);
      const bronze = Math.floor(optScore * 0.60);

      const levelName = names[lvl] ?? `Sector ${globalId}`;
      const briefing = `Sector ${globalId}: Clear space junk in ${orb.name}. Single spark ignition. Target optimum cascade.`;

      levels.push({
        id: globalId,
        orbit: orbitNum,
        orbitName: orb.name,
        name: levelName,
        briefing,
        goalType,
        targetValue,
        medalThresholds: {
          bronze,
          silver,
          gold,
        },
        board: finalBoard,
        optimumScore: optScore,
      });
    }
  }

  return levels;
}

export function run(): void {
  console.log('[gen-campaign] Generating 60 frozen campaign levels...');
  const levels = generateCampaign();
  console.log(`[gen-campaign] Generated ${levels.length} levels across 6 orbits.`);

  const outDir = path.resolve(process.cwd(), 'data/campaign');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const outPath = path.join(outDir, 'levels.json');
  fs.writeFileSync(outPath, JSON.stringify(levels, null, 2), 'utf-8');
  console.log(`[gen-campaign] Wrote frozen levels to ${outPath}`);
}

if (process.argv[1]?.endsWith('gen-campaign.ts') || process.argv[1]?.endsWith('gen-campaign')) {
  run();
}
