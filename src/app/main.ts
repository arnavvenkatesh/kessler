import './index.css';
import { PALETTE } from './render/palette';

function initApp(): void {
  const root = document.getElementById('app');
  if (!root) return;

  root.innerHTML = `
    <header>
      <div class="brand-title">
        <span>KESSLER</span>
        <span class="brand-subtitle">// ORBITAL DEBRIS RECLAMATION</span>
      </div>
      <div class="status-badge">
        <span class="status-pip"></span>
        <span>SYS.ONLINE // P0 READY</span>
      </div>
    </header>

    <main>
      <div class="viewport-container" id="board-viewport">
        <canvas id="stage-canvas" width="600" height="600"></canvas>
      </div>

      <aside class="hud-panel">
        <div class="hud-stat-box">
          <div class="hud-stat-label">SECTOR DESIGNATION</div>
          <div class="hud-stat-value" id="hud-sector">SEC-000</div>
        </div>
        <div class="hud-stat-box">
          <div class="hud-stat-label">CASCADE SCORE</div>
          <div class="hud-stat-value" id="hud-score">00.0</div>
        </div>
        <div class="hud-stat-box">
          <div class="hud-stat-label">SPARK AVAILABLE</div>
          <div class="hud-stat-value" style="color: ${PALETTE.ember};">CROSS</div>
        </div>
        <button class="btn btn-primary" id="btn-deploy" style="margin-top: auto;">
          INITIALIZE SENSOR
        </button>
      </aside>
    </main>
  `;

  // Draw initial grid plate on the canvas
  const canvas = document.getElementById('stage-canvas') as HTMLCanvasElement | null;
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      drawBlankPlate(ctx, canvas.width, canvas.height);
    }
  }
}

function drawBlankPlate(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.fillStyle = PALETTE.hull;
  ctx.fillRect(0, 0, width, height);

  // Outer border
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);

  // Grid lines (7x7 sample preview grid)
  const gridSize = 7;
  const cellSize = Math.floor(width / gridSize);

  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;

  for (let i = 1; i < gridSize; i++) {
    const pos = i * cellSize;
    // Vertical line
    ctx.beginPath();
    ctx.moveTo(pos, 0);
    ctx.lineTo(pos, height);
    ctx.stroke();

    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(0, pos);
    ctx.lineTo(width, pos);
    ctx.stroke();
  }

  // Center crosshair / prompt
  ctx.fillStyle = PALETTE.dust;
  ctx.font = '13px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('STANDBY // P0 SYSTEM VERIFIED', width / 2, height / 2);
}

// Bootstrap on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
