import { getHint, type BoundingBox } from '../../core/hints';
import type { Board } from '../../core/types';
import type { SolveResult } from '../../core/solver';
import { unlockHintTier } from '../storage/campaignStore';
import { PALETTE } from '../render/palette';

export interface HintsModalCallbacks {
  onHighlightZone?: (bounds: BoundingBox | null) => void;
  onClose: () => void;
}

export class HintsModal {
  private container: HTMLElement;
  private board: Board;
  private solverResult: SolveResult;
  private levelId?: number;
  private unlockedTier: number;
  private callbacks: HintsModalCallbacks;

  constructor(
    container: HTMLElement,
    board: Board,
    solverResult: SolveResult,
    callbacks: HintsModalCallbacks,
    levelId?: number,
    initialTier = 0,
  ) {
    this.container = container;
    this.board = board;
    this.solverResult = solverResult;
    this.callbacks = callbacks;
    this.levelId = levelId;
    this.unlockedTier = initialTier;
  }

  public render(): void {
    const h1 = getHint(this.board, 1, this.solverResult);
    const h2 = getHint(this.board, 2, this.solverResult);
    const h3 = getHint(this.board, 3, this.solverResult);

    this.container.style.display = 'flex';
    this.container.innerHTML = `
      <div class="modal-backdrop">
        <div class="modal-box" style="max-width: 520px; width: 90%;">
          <div class="modal-header">
            <div class="modal-title">FLIGHT DYNAMICS // TACTICAL HINTS</div>
            <button id="btn-close-hints" class="btn" style="padding: 4px 10px;">&times;</button>
          </div>

          <div class="modal-body" style="padding: 14px 16px;">
            <div style="font-size: 12px; color: var(--dust); margin-bottom: 14px; line-height: 1.4;">
              Pure algorithmic telemetry computed from the deterministic solver. Unlock tier-by-tier to narrow down the optimal ignition point.
            </div>

            <!-- Tier 1 -->
            <div style="background: var(--void); border: 1px solid var(--grid); padding: 10px 12px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 700; color: ${PALETTE.chalk}; letter-spacing: 0.08em;">
                  TIER 1 · CHAIN DEPTH
                </span>
                <span style="font-size: 10px; color: ${this.unlockedTier >= 1 ? PALETTE.coolant : varDust()};">
                  ${this.unlockedTier >= 1 ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
              ${
                this.unlockedTier >= 1
                  ? `<div style="font-family: var(--font-mono); font-size: 13px; color: ${PALETTE.solar}; font-weight: 700;">
                      OPTIMAL CASCADE SEQUENCE LASTS ${h1.chainDepth} TICKS
                    </div>`
                  : `<button id="btn-unlock-tier-1" class="btn btn-primary" style="font-size: 11px; padding: 4px 10px; margin-top: 4px;">
                      REVEAL CHAIN DEPTH
                    </button>`
              }
            </div>

            <!-- Tier 2 -->
            <div style="background: var(--void); border: 1px solid var(--grid); padding: 10px 12px; margin-bottom: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 700; color: ${PALETTE.chalk}; letter-spacing: 0.08em;">
                  TIER 2 · 3x3 SEARCH SECTOR
                </span>
                <span style="font-size: 10px; color: ${this.unlockedTier >= 2 ? PALETTE.coolant : varDust()};">
                  ${this.unlockedTier >= 2 ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
              ${
                this.unlockedTier >= 2
                  ? `<div style="font-family: var(--font-mono); font-size: 13px; color: ${PALETTE.solar}; font-weight: 700;">
                      OPTIMUM LOCATED IN 3x3 BOUNDS: [X: ${h2.bounds.minX}..${h2.bounds.maxX}, Y: ${h2.bounds.minY}..${h2.bounds.maxY}]
                    </div>`
                  : `<button id="btn-unlock-tier-2" class="btn btn-primary" style="font-size: 11px; padding: 4px 10px; margin-top: 4px;" ${
                      this.unlockedTier < 1 ? 'disabled' : ''
                    }>
                      REVEAL 3x3 SECTOR
                    </button>`
              }
            </div>

            <!-- Tier 3 -->
            <div style="background: var(--void); border: 1px solid var(--grid); padding: 10px 12px; margin-bottom: 14px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <span style="font-size: 11px; font-weight: 700; color: ${PALETTE.chalk}; letter-spacing: 0.08em;">
                  TIER 3 · OPTIMAL COORDINATE
                </span>
                <span style="font-size: 10px; color: ${this.unlockedTier >= 3 ? PALETTE.solar : varDust()};">
                  ${this.unlockedTier >= 3 ? 'UNLOCKED' : 'LOCKED'}
                </span>
              </div>
              ${
                this.unlockedTier >= 3 && h3.tier === 3
                  ? `<div style="font-family: var(--font-mono); font-size: 13px; color: ${PALETTE.solar}; font-weight: 700;">
                      EXACT CELL: [${h3.placement.x.toString().padStart(2, '0')}, ${h3.placement.y.toString().padStart(2, '0')}]${
                        h3.placement.rot !== undefined ? ` · ROT: ${h3.placement.rot === 1 ? 'VERT' : 'HORIZ'}` : ''
                      }${
                        h3.placement.twin ? ` · TWIN: [${h3.placement.twin.x.toString().padStart(2, '0')}, ${h3.placement.twin.y.toString().padStart(2, '0')}]` : ''
                      }
                    </div>`
                  : `<button id="btn-unlock-tier-3" class="btn btn-primary" style="font-size: 11px; padding: 4px 10px; margin-top: 4px;" ${
                      this.unlockedTier < 2 ? 'disabled' : ''
                    }>
                      REVEAL EXACT CELL
                    </button>`
              }
            </div>
          </div>

          <div class="modal-footer" style="padding: 10px 16px;">
            <button id="btn-close-hints-bottom" class="btn btn-primary">RESUME OPERATION</button>
          </div>
        </div>
      </div>
    `;

    this.attachEvents();
  }

  private attachEvents(): void {
    document.getElementById('btn-close-hints')?.addEventListener('click', () => {
      this.callbacks.onClose();
    });
    document.getElementById('btn-close-hints-bottom')?.addEventListener('click', () => {
      this.callbacks.onClose();
    });

    document.getElementById('btn-unlock-tier-1')?.addEventListener('click', () => {
      this.unlockedTier = 1;
      if (this.levelId) unlockHintTier(this.levelId, 1);
      this.render();
    });

    document.getElementById('btn-unlock-tier-2')?.addEventListener('click', () => {
      this.unlockedTier = 2;
      if (this.levelId) unlockHintTier(this.levelId, 2);
      const h2 = getHint(this.board, 2, this.solverResult);
      if (this.callbacks.onHighlightZone) {
        this.callbacks.onHighlightZone(h2.bounds);
      }
      this.render();
    });

    document.getElementById('btn-unlock-tier-3')?.addEventListener('click', () => {
      this.unlockedTier = 3;
      if (this.levelId) unlockHintTier(this.levelId, 3);
      this.render();
    });
  }
}

function varDust(): string {
  return '#8C93A8';
}
