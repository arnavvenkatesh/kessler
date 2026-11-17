/**
 * Interactive tutorial stages for Kessler.
 *
 * BLUEPRINT Section 5:
 * - "Tutorial is interactive: three tiny pre-built boards using the real simulator, no text walls."
 * - Pure ruleset v1 boards.
 */

import type { Board } from '../../core/types';

export interface TutorialStage {
  id: number;
  title: string;
  subtitle: string;
  brief: string;
  hint: string;
  board: Board;
  targetDestroyed: number;
}

export const TUTORIAL_STAGES: readonly TutorialStage[] = [
  {
    id: 1,
    title: 'STAGE 01 // ORBITAL DETONATION',
    subtitle: 'CHAIN REACTION BASICS',
    brief: 'Detonating a spark sends rays in cardinal directions. Each ignited Cinder emits 4 secondary rays.',
    hint: 'Target cell [01, 02] to ignite the line.',
    targetDestroyed: 3,
    board: {
      w: 5,
      h: 5,
      cells: [
        null, null, null, null, null,
        null, null, null, null, null,
        null, null, { kind: 'CIN' }, { kind: 'CIN' }, { kind: 'CIN' },
        null, null, null, null, null,
        null, null, null, null, null,
      ],
      spark: 'CROSS',
      rulesetVersion: 1,
    },
  },
  {
    id: 2,
    title: 'STAGE 02 // ANGLED DEFLECTION',
    subtitle: 'MIRROR REFLECTION',
    brief: 'Mirrors are indestructible mounts that deflect orthogonal beams at 90-degree angles.',
    hint: 'Target cell [00, 02] to deflect upwards into the target.',
    targetDestroyed: 2,
    board: {
      w: 5,
      h: 5,
      cells: [
        null, null, { kind: 'CIN' }, null, null,
        null, null, null, null, null,
        null, null, { kind: 'MRF' }, null, { kind: 'CIN' },
        null, null, null, null, null,
        null, null, null, null, null,
      ],
      spark: 'CROSS',
      rulesetVersion: 1,
    },
  },
  {
    id: 3,
    title: 'STAGE 03 // GRAVITATIONAL WELL',
    subtitle: 'SINGULARITY HAZARD',
    brief: 'Singularities absorb all incoming energy. Route beams around the black hole to eliminate the debris.',
    hint: 'Avoid firing into [02, 02]. Target a flanking perimeter.',
    targetDestroyed: 2,
    board: {
      w: 5,
      h: 5,
      cells: [
        null, null, null, null, null,
        null, { kind: 'CIN' }, null, { kind: 'CIN' }, null,
        null, null, { kind: 'SNG' }, null, null,
        null, null, null, null, null,
        null, null, null, null, null,
      ],
      spark: 'CROSS',
      rulesetVersion: 1,
    },
  },
];
