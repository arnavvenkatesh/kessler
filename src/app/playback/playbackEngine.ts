/**
 * Deterministic stepped playback engine for Kessler.
 * Coordinates tick animation, 3-step ray drawing, 40ms hitstop,
 * screen nudge, sparks, WebAudio sound triggers, and speed controls.
 *
 * BLUEPRINT Section 6:
 * - Stepped animation only (no easing curves)
 * - Tick time 260 ms with 1x, 2x and skip
 * - 40 ms hitstop per tick
 * - Honor prefers-reduced-motion
 */

import type { Board, SimEvent, SimResult } from '../../core/types';
import { sound } from '../audio/synth';
import { fx } from '../render/fx';

export type PlaybackSpeed = '1x' | '2x' | 'skip';
export type PlaybackStatus = 'idle' | 'playing' | 'paused' | 'finished';

export interface PlaybackCallbacks {
  onTick?: (tick: number, maxTick: number, runningScore: number, destroyed: number) => void;
  onStatusChange?: (status: PlaybackStatus) => void;
  onBoardUpdate?: (board: Board) => void;
}

export class PlaybackEngine {
  public status: PlaybackStatus = 'idle';
  public speed: PlaybackSpeed = '1x';
  public currentTick: number = 0;
  public maxTick: number = 0;
  public runningScore: number = 0;
  public runningDestroyed: number = 0;

  private initialBoard: Board | null = null;
  public currentBoard: Board | null = null;
  private result: SimResult | null = null;
  private eventsByTick: Map<number, SimEvent[]> = new Map();

  // Timing inside a single tick (in milliseconds)
  private tickTimerMs: number = 0;
  private hitstopActive: boolean = false;
  private hitstopTimerMs: number = 0;
  private callbacks: PlaybackCallbacks = {};

  // Pixel translation helper for spawning sparks
  private getCellPixelCoords?: (x: number, y: number) => [number, number];

  constructor(callbacks?: PlaybackCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public setCallbacks(callbacks: PlaybackCallbacks): void {
    this.callbacks = callbacks;
  }

  public setCellPixelResolver(resolver: (x: number, y: number) => [number, number]): void {
    this.getCellPixelCoords = resolver;
  }

  public setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
    if (speed === 'skip' && this.status === 'playing') {
      this.skipToEnd();
    }
  }

  /**
   * Loads a simulation result and initial board into the playback engine.
   */
  public load(initialBoard: Board, result: SimResult): void {
    this.initialBoard = {
      ...initialBoard,
      cells: [...initialBoard.cells],
    };
    this.currentBoard = {
      ...initialBoard,
      cells: [...initialBoard.cells],
    };
    this.result = result;
    this.maxTick = result.lastTick;
    this.currentTick = 1;
    this.runningScore = 0;
    this.runningDestroyed = 0;
    this.tickTimerMs = 0;
    this.hitstopActive = false;
    this.hitstopTimerMs = 0;

    // Index events by tick
    this.eventsByTick.clear();
    for (const ev of result.events) {
      const list = this.eventsByTick.get(ev.t) ?? [];
      list.push(ev);
      this.eventsByTick.set(ev.t, list);
    }

    fx.clear();
    this.status = 'idle';
    this.notifyStatus();
    this.notifyTick();
  }

  /**
   * Starts playback from tick 0.
   */
  public play(): void {
    if (!this.result) return;
    if (this.speed === 'skip') {
      this.skipToEnd();
      return;
    }
    this.status = 'playing';
    this.notifyStatus();
    this.startTick(this.currentTick);
  }

  public pause(): void {
    if (this.status === 'playing') {
      this.status = 'paused';
      this.notifyStatus();
    }
  }

  public resume(): void {
    if (this.status === 'paused') {
      this.status = 'playing';
      this.notifyStatus();
    }
  }

  public togglePlayPause(): void {
    if (this.status === 'playing') {
      this.pause();
    } else if (this.status === 'paused') {
      this.resume();
    } else if (this.status === 'finished') {
      this.restart();
    }
  }

  public restart(): void {
    if (!this.initialBoard || !this.result) return;
    this.load(this.initialBoard, this.result);
    this.play();
  }

  /**
   * Fast-forwards immediately to the final simulation state.
   */
  public skipToEnd(): void {
    if (!this.result || !this.initialBoard) return;

    // Apply all ticks up to maxTick
    for (let t = 0; t <= this.maxTick; t++) {
      this.applyTickEvents(t);
    }

    this.currentTick = this.maxTick;
    this.runningScore = this.result.score;
    this.runningDestroyed = this.result.destroyed;
    fx.clear();
    this.status = 'finished';
    this.notifyStatus();
    this.notifyTick();
    if (this.currentBoard && this.callbacks.onBoardUpdate) {
      this.callbacks.onBoardUpdate(this.currentBoard);
    }
  }

  /**
   * Advances exactly one tick step (for manual debugging or step-by-step review).
   */
  public stepForward(): void {
    if (!this.result || this.currentTick > this.maxTick) return;
    this.applyTickEvents(this.currentTick);
    if (this.currentTick >= this.maxTick) {
      this.status = 'finished';
      this.notifyStatus();
    } else {
      this.currentTick++;
      this.startTick(this.currentTick);
    }
    this.notifyTick();
  }

  /**
   * Main per-frame update loop called from the requestAnimationFrame loop.
   */
  public update(dtMs: number): void {
    if (this.status !== 'playing' || !this.result || !this.currentBoard) return;

    const reducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Nominal tick time: 260ms at 1x, 130ms at 2x
    const speedMultiplier = this.speed === '2x' ? 2 : 1;
    const tickDuration = 260 / speedMultiplier;
    const hitstopDuration = 40 / speedMultiplier;

    if (this.hitstopActive) {
      this.hitstopTimerMs += dtMs;
      if (this.hitstopTimerMs >= hitstopDuration) {
        this.hitstopActive = false;
        this.hitstopTimerMs = 0;
      }
      // During hitstop, animation holds still
      return;
    }

    this.tickTimerMs += dtMs;

    // Update ray step based on progress through the tick:
    // 0% - 33%: Step 1
    // 33% - 66%: Step 2
    // 66% - 100%: Step 3
    const progress = Math.min(1.0, this.tickTimerMs / (tickDuration - hitstopDuration));
    let rayStep: 1 | 2 | 3 = 1;
    if (progress >= 0.66) {
      rayStep = 3;
    } else if (progress >= 0.33) {
      rayStep = 2;
    }

    for (const r of fx.activeRays) {
      r.step = rayStep;
    }

    // When progress reaches 100%, trigger hitstop, impact sparks, sound, and event resolution
    if (this.tickTimerMs >= (tickDuration - hitstopDuration) && !this.hitstopActive && this.hitstopTimerMs === 0) {
      this.hitstopActive = true;
      this.triggerHitImpacts(this.currentTick, reducedMotion);
    }

    // Tick completed
    if (this.tickTimerMs >= tickDuration) {
      this.applyTickEvents(this.currentTick);
      this.tickTimerMs = 0;
      this.hitstopTimerMs = 0;
      this.hitstopActive = false;

      if (this.currentTick >= this.maxTick) {
        fx.activeRays = [];
        this.status = 'finished';
        this.notifyStatus();
        this.notifyTick();
      } else {
        this.currentTick++;
        this.notifyTick();
        this.startTick(this.currentTick);
      }
    }
  }

  /**
   * Sets up rays for the beginning of tick t.
   */
  private startTick(t: number): void {
    fx.activeRays = [];
    const events = this.eventsByTick.get(t) ?? [];

    for (const ev of events) {
      if (ev.type === 'ray') {
        fx.activeRays.push({
          path: ev.path,
          step: 1,
        });
      }
    }
  }

  /**
   * Triggers impact sounds, sparks, and screen nudge when rays reach target.
   */
  private triggerHitImpacts(t: number, reducedMotion: boolean): void {
    const events = this.eventsByTick.get(t) ?? [];

    let hasDetonation = false;
    let hasHit = false;
    let hasAbsorb = false;

    for (const ev of events) {
      if (ev.type === 'detonate') {
        hasDetonation = true;
        if (this.getCellPixelCoords) {
          const [px, py] = this.getCellPixelCoords(ev.x, ev.y);
          fx.spawnImpactSparks(px, py);
        }
      } else if (ev.type === 'hit') {
        hasHit = true;
        if (this.getCellPixelCoords) {
          const [px, py] = this.getCellPixelCoords(ev.x, ev.y);
          fx.spawnImpactSparks(px, py);
        }
      } else if (ev.type === 'absorb') {
        hasAbsorb = true;
      }
    }

    if (hasDetonation) {
      sound.playDetonate(t);
      fx.triggerNudge(reducedMotion);
    } else if (hasHit) {
      sound.playHit();
      fx.triggerNudge(reducedMotion);
    } else if (hasAbsorb) {
      sound.playAbsorb();
    }
  }

  /**
   * Applies the board changes for tick t (destroys cells, updates running counts).
   */
  private applyTickEvents(t: number): void {
    if (!this.currentBoard) return;
    const events = this.eventsByTick.get(t) ?? [];

    for (const ev of events) {
      if (ev.type === 'detonate') {
        const idx = ev.y * this.currentBoard.w + ev.x;
        if (this.currentBoard.cells[idx] !== null && this.currentBoard.cells[idx] !== undefined) {
          this.currentBoard.cells[idx] = null;
          this.runningDestroyed++;
        }
      } else if (ev.type === 'crack') {
        // Plated armor cracked
        const idx = ev.y * this.currentBoard.w + ev.x;
        const cell = this.currentBoard.cells[idx];
        if (cell && cell.kind === 'PLT') {
          // In cracked state, we can flag or mutate kind if ruleset specifies
          this.currentBoard.cells[idx] = { kind: 'CIN' };
        }
      }
    }

    // Update running score estimate
    if (this.result) {
      const fraction = this.maxTick > 0 ? Math.min(1.0, (t + 1) / (this.maxTick + 1)) : 1.0;
      this.runningScore = Math.round(this.result.score * fraction);
    }

    if (this.callbacks.onBoardUpdate) {
      this.callbacks.onBoardUpdate(this.currentBoard);
    }
  }

  private notifyTick(): void {
    if (this.callbacks.onTick) {
      this.callbacks.onTick(
        this.currentTick,
        this.maxTick,
        this.runningScore,
        this.runningDestroyed,
      );
    }
  }

  private notifyStatus(): void {
    if (this.callbacks.onStatusChange) {
      this.callbacks.onStatusChange(this.status);
    }
  }
}
