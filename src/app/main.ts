import './index.css';
import { formatDateString } from '../core/calendar';
import { generateDaily } from '../core/generate';
import type { Board } from '../core/types';
import { drawFullFrame, type CursorState } from './render/boardRenderer';
import { PALETTE } from './render/palette';
import { LayoutEngine } from './ui/layout';
import { InputManager } from './input/inputManager';

function initApp(): void {
  const root = document.getElementById('app');
  if (!root) return;

  // Get current date for the daily sector (or fallback to anchor date)
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth() + 1;
  const d = today.getDate();
  const dateStr = formatDateString(y, m, d);

  // Generate today's board
  const daily = generateDaily(dateStr);
  const board: Board = daily.board;

  root.innerHTML = `
    <header>
      <div class="brand-title">
        <span>KESSLER</span>
        <span class="brand-subtitle">// SECTOR ${daily.dateStr}</span>
      </div>
      <div class="status-badge">
        <span class="status-pip"></span>
        <span>SECTOR #${daily.dayNumber} ONLINE</span>
      </div>
    </header>

    <main>
      <div class="viewport-container" id="board-viewport">
        <canvas id="stage-canvas"></canvas>
      </div>

      <aside class="hud-panel">
        <div class="hud-stat-box">
          <div class="hud-stat-label">SECTOR CODE</div>
          <div class="hud-stat-value" id="hud-sector">#${daily.dayNumber}</div>
        </div>
        <div class="hud-stat-box">
          <div class="hud-stat-label">GRID SPECIFICATION</div>
          <div class="hud-stat-value">${board.w}x${board.h} MATRIX</div>
        </div>
        <div class="hud-stat-box">
          <div class="hud-stat-label">ACTIVE SPARK</div>
          <div class="hud-stat-value" id="hud-spark" style="color: ${PALETTE.ember};">${board.spark}</div>
        </div>
        <div class="hud-stat-box">
          <div class="hud-stat-label">TARGET RETICLE</div>
          <div class="hud-stat-value" id="hud-coord" style="color: ${PALETTE.coolant};">[-- , --]</div>
        </div>

        <div class="hud-instructions">
          <div style="color: ${PALETTE.chalk}; font-weight: 600; margin-bottom: 6px;">FLIGHT CONTROLS</div>
          <div><kbd>&larr;&uarr;&rarr;&darr;</kbd> or Mouse: Target</div>
          <div><kbd>SPACE</kbd> or Click: Detonate Spark</div>
          <div><kbd>R</kbd>: Rotate Spark orientation</div>
          <div style="margin-top: 8px; color: ${PALETTE.coolant};">
            &bull; Cyan rays indicate first-hit trajectory preview.
          </div>
        </div>
      </aside>
    </main>
  `;

  const canvas = document.getElementById('stage-canvas') as HTMLCanvasElement | null;
  const viewport = document.getElementById('board-viewport') as HTMLElement | null;
  if (!canvas || !viewport) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cursor: CursorState = {
    x: Math.floor(board.w / 2),
    y: Math.floor(board.h / 2),
    active: true,
    rot: 0,
  };

  const layout = new LayoutEngine(canvas, viewport);

  function redraw(): void {
    if (!ctx) return;
    const currentLayout = layout.getLayout();
    const metrics = drawFullFrame(
      ctx,
      currentLayout.containerWidth,
      currentLayout.containerHeight,
      board,
      cursor,
    );
    inputManager.updateMetrics(metrics, board.w, board.h);
  }

  const inputManager = new InputManager(canvas, {
    onCursorMove: (newCursor) => {
      cursor.x = newCursor.x;
      cursor.y = newCursor.y;
      cursor.active = true;

      const coordEl = document.getElementById('hud-coord');
      if (coordEl) {
        coordEl.textContent = `[${cursor.x.toString().padStart(2, '0')}, ${cursor.y.toString().padStart(2, '0')}]`;
      }
      redraw();
    },
    onPlace: (x, y, rot) => {
      cursor.x = x;
      cursor.y = y;
      cursor.rot = rot;
      cursor.active = true;
      redraw();
    },
    onRotate: (rot) => {
      cursor.rot = rot;
      const sparkEl = document.getElementById('hud-spark');
      if (sparkEl) {
        if (board.spark === 'LANCE') {
          sparkEl.textContent = rot === 1 ? 'LANCE (VERT)' : 'LANCE (HORIZ)';
        } else {
          sparkEl.textContent = board.spark;
        }
      }
      redraw();
    },
    onUndo: () => {
      // Non-daily undo placeholder for P5
    },
  });

  layout.onResize(() => {
    redraw();
  });

  // Initial render
  layout.updateCanvasSize();
  redraw();

  const coordEl = document.getElementById('hud-coord');
  if (coordEl) {
    coordEl.textContent = `[${cursor.x.toString().padStart(2, '0')}, ${cursor.y.toString().padStart(2, '0')}]`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
