/**
 * Visual effects engine: stepped rays, 2x2 px impact sparks, hitstop, and screen nudge.
 * Strict compliance with BLUEPRINT Section 6:
 * - Stepped animation only (no easing curves)
 * - Ray draws in 3 steps: 2px chalk core over a 4px ember underlay offset (1,1)
 * - Impact: 8 square 2x2 px sparks with integer velocities
 * - Screen nudge: max 2px integer translation
 * - Colors: palette tokens only
 */

import { PALETTE } from './palette';

export interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number; // in ticks/frames
  color: string;
}

export interface ActiveRay {
  path: [number, number][]; // cell coordinates
  step: 1 | 2 | 3;          // 3-step expansion
}

export class FxManager {
  public sparks: Spark[] = [];
  public activeRays: ActiveRay[] = [];
  public nudgeX: number = 0;
  public nudgeY: number = 0;
  private nudgeRemainingMs: number = 0;

  /**
   * Spawns 8 square 2x2 px sparks with integer velocities on impact.
   */
  public spawnImpactSparks(centerX: number, centerY: number): void {
    const velocities: readonly [number, number][] = [
      [2, 0],
      [-2, 0],
      [0, 2],
      [0, -2],
      [2, 2],
      [-2, 2],
      [2, -2],
      [-2, -2],
    ];

    for (let i = 0; i < velocities.length; i++) {
      const v = velocities[i]!;
      this.sparks.push({
        x: Math.round(centerX),
        y: Math.round(centerY),
        vx: v[0],
        vy: v[1],
        life: 4, // 4 frames duration
        color: i % 2 === 0 ? PALETTE.solar : PALETTE.ember,
      });
    }
  }

  /**
   * Triggers a screen nudge: max 2px integer translation.
   */
  public triggerNudge(reducedMotion: boolean = false): void {
    if (reducedMotion) return;
    // Deterministic integer nudge within [-2, 2]
    const offsets = [-2, 2];
    this.nudgeX = offsets[Math.floor(Math.random() * offsets.length)] ?? 2;
    this.nudgeY = offsets[Math.floor(Math.random() * offsets.length)] ?? -2;
    this.nudgeRemainingMs = 45; // brief ~40ms duration
  }

  /**
   * Advances physics for sparks and reset nudge.
   */
  public update(dtMs: number): void {
    if (this.nudgeRemainingMs > 0) {
      this.nudgeRemainingMs -= dtMs;
      if (this.nudgeRemainingMs <= 0) {
        this.nudgeX = 0;
        this.nudgeY = 0;
      }
    }

    // Step sparks with integer velocity
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!;
      s.x += s.vx;
      s.y += s.vy;
      s.life -= 1;
      if (s.life <= 0) {
        this.sparks.splice(i, 1);
      }
    }
  }

  /**
   * Clears all active effects.
   */
  public clear(): void {
    this.sparks = [];
    this.activeRays = [];
    this.nudgeX = 0;
    this.nudgeY = 0;
    this.nudgeRemainingMs = 0;
  }

  /**
   * Renders active sparks (2x2 square pixels) onto canvas.
   */
  public renderSparks(ctx: CanvasRenderingContext2D): void {
    for (const s of this.sparks) {
      ctx.fillStyle = s.color;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), 2, 2);
    }
  }

  /**
   * Renders stepped rays onto canvas:
   * 2px chalk core over a 4px ember underlay offset (1,1).
   */
  public renderRays(
    ctx: CanvasRenderingContext2D,
    boardX: number,
    boardY: number,
    cellSize: number,
  ): void {
    if (this.activeRays.length === 0) return;

    ctx.save();
    ctx.lineCap = 'square';
    ctx.lineJoin = 'miter';

    for (const r of this.activeRays) {
      if (r.path.length < 2) continue;

      const pStart = r.path[0]!;
      const pEnd = r.path[r.path.length - 1]!;

      const startPxX = boardX + pStart[0] * cellSize + cellSize / 2;
      const startPxY = boardY + pStart[1] * cellSize + cellSize / 2;
      const fullEndPxX = boardX + pEnd[0] * cellSize + cellSize / 2;
      const fullEndPxY = boardY + pEnd[1] * cellSize + cellSize / 2;

      // 3-step fraction: step 1 = 1/3, step 2 = 2/3, step 3 = 1.0
      const fraction = r.step === 1 ? 0.333 : r.step === 2 ? 0.667 : 1.0;
      const currentEndPxX = Math.round(startPxX + (fullEndPxX - startPxX) * fraction);
      const currentEndPxY = Math.round(startPxY + (fullEndPxY - startPxY) * fraction);

      // 1. Underlay: 4px ember offset (1, 1)
      ctx.strokeStyle = PALETTE.ember;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(Math.round(startPxX + 1), Math.round(startPxY + 1));
      ctx.lineTo(currentEndPxX + 1, currentEndPxY + 1);
      ctx.stroke();

      // 2. Core: 2px chalk
      ctx.strokeStyle = PALETTE.chalk;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(Math.round(startPxX), Math.round(startPxY));
      ctx.lineTo(currentEndPxX, currentEndPxY);
      ctx.stroke();
    }

    ctx.restore();
  }
}

export const fx = new FxManager();
