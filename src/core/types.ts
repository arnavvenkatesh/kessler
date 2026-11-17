export type Kind =
  | 'CIN'
  | 'SHD'
  | 'LNH'
  | 'LNV'
  | 'PLT'
  | 'FUS'
  | 'BCN'
  | 'SNG'
  | 'MRF'
  | 'MRB'
  | 'WRM';

export interface Cell {
  kind: Kind;
  pair?: number;
}

export interface Board {
  w: number;
  h: number;
  cells: (Cell | null)[];
  spark: 'CROSS' | 'SKEW' | 'LANCE';
  mutator?: string;
  rulesetVersion: number;
}

export interface Placement {
  x: number;
  y: number;
  rot?: 0 | 1;
}

export type SimEvent =
  | { t: number; type: 'detonate'; x: number; y: number; kind: Kind }
  | { t: number; type: 'ray'; path: [number, number][] }
  | { t: number; type: 'hit' | 'crack' | 'absorb' | 'deflect' | 'teleport'; x: number; y: number };

export interface SimResult {
  score: number;
  destroyed: number;
  lastTick: number;
  events: SimEvent[];
  hash: string;
}

export interface SolveStats {
  chainDepth: number;
  destroyedCount: number;
  destroyedPercent: number;
  topScorePlacementsCount: number;
  medianScore: number;
  decoyCount: number;
  isCleanSweep: boolean;
}

export type Difficulty = 'easy' | 'medium' | 'hard' | 'extreme';
