import './index.css';
import { formatDateString } from '../core/calendar';
import { generateDaily } from '../core/generate';
import { simulate } from '../core/sim';
import type { Board } from '../core/types';
import { sound } from './audio/synth';
import { InputManager } from './input/inputManager';
import { PlaybackEngine, type PlaybackSpeed, type PlaybackStatus } from './playback/playbackEngine';
import { drawFullFrame, type CursorState } from './render/boardRenderer';
import { fx } from './render/fx';
import { PALETTE } from './render/palette';
import { LayoutEngine } from './ui/layout';

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
  const initialBoard: Board = {
    ...daily.board,
    cells: [...daily.board.cells],
  };

  root.innerHTML = `
    <header>
      <div class="brand-title">
        <span>KESSLER</span>
        <span class="brand-subtitle">// SECTOR ${daily.dateStr}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 12px;">
        <button id="btn-audio" class="btn" aria-label="Toggle Sound">
          ${sound.muted ? 'AUDIO: MUTED' : 'AUDIO: ON'}
        </button>
        <div class="status-badge">
          <span class="status-pip"></span>
          <span>SECTOR #${daily.dayNumber} ONLINE</span>
        </div>
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
          <div class="hud-stat-value">${initialBoard.w}x${initialBoard.h} MATRIX</div>
        </div>

        <div class="hud-stat-box">
          <div class="hud-stat-label" id="hud-card3-label">ACTIVE SPARK</div>
          <div class="hud-stat-value" id="hud-spark" style="color: ${PALETTE.ember};">${initialBoard.spark}</div>
        </div>

        <div class="hud-stat-box">
          <div class="hud-stat-label" id="hud-card4-label">TARGET RETICLE</div>
          <div class="hud-stat-value" id="hud-coord" style="color: ${PALETTE.coolant};">[-- , --]</div>
        </div>

        <div class="hud-stat-box">
          <div class="hud-stat-label" style="margin-bottom: 8px;">PLAYBACK CONTROLS</div>
          <div class="hud-controls">
            <button id="speed-1x" class="btn btn-active">1X</button>
            <button id="speed-2x" class="btn">2X</button>
            <button id="speed-skip" class="btn">SKIP</button>
            <button id="btn-replay" class="btn" style="display: none; border-color: ${PALETTE.solar}; color: ${PALETTE.solar};">REPLAY</button>
          </div>
        </div>

        <div class="hud-instructions" id="hud-instructions-box">
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
  const btnAudio = document.getElementById('btn-audio') as HTMLButtonElement | null;
  const speed1xBtn = document.getElementById('speed-1x') as HTMLButtonElement | null;
  const speed2xBtn = document.getElementById('speed-2x') as HTMLButtonElement | null;
  const speedSkipBtn = document.getElementById('speed-skip') as HTMLButtonElement | null;
  const replayBtn = document.getElementById('btn-replay') as HTMLButtonElement | null;

  const card3Label = document.getElementById('hud-card3-label');
  const card4Label = document.getElementById('hud-card4-label');
  const sparkEl = document.getElementById('hud-spark');
  const coordEl = document.getElementById('hud-coord');

  if (!canvas || !viewport) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const cursor: CursorState = {
    x: Math.floor(initialBoard.w / 2),
    y: Math.floor(initialBoard.h / 2),
    active: true,
    rot: 0,
  };

  const layout = new LayoutEngine(canvas, viewport);

  // Playback engine
  const playback = new PlaybackEngine({
    onTick: (tick, maxTick, score, destroyed) => {
      if (playback.status === 'playing' || playback.status === 'paused') {
        if (card3Label) card3Label.textContent = 'TELEMETRY: CASCADE';
        if (sparkEl) sparkEl.textContent = `TICK ${tick} / ${maxTick}`;
        if (card4Label) card4Label.textContent = 'CASCADE SCORE';
        if (coordEl) coordEl.textContent = `${score.toLocaleString()} PTS (${destroyed} DEBRIS)`;
      } else if (playback.status === 'finished') {
        if (card3Label) card3Label.textContent = 'CHAIN COMPLETED';
        if (sparkEl) sparkEl.textContent = `${destroyed} DEBRIS DESTROYED`;
        if (card4Label) card4Label.textContent = 'TOTAL SCORE';
        if (coordEl) coordEl.textContent = `${score.toLocaleString()} PTS`;
      }
    },
    onStatusChange: (status: PlaybackStatus) => {
      if (status === 'finished') {
        if (replayBtn) replayBtn.style.display = 'block';
      } else if (status === 'playing') {
        if (replayBtn) replayBtn.style.display = 'none';
      } else if (status === 'idle') {
        if (replayBtn) replayBtn.style.display = 'none';
        if (card3Label) card3Label.textContent = 'ACTIVE SPARK';
        if (sparkEl) {
          sparkEl.textContent =
            initialBoard.spark === 'LANCE'
              ? cursor.rot === 1
                ? 'LANCE (VERT)'
                : 'LANCE (HORIZ)'
              : initialBoard.spark;
        }
        if (card4Label) card4Label.textContent = 'TARGET RETICLE';
        if (coordEl) {
          coordEl.textContent = `[${cursor.x.toString().padStart(2, '0')}, ${cursor.y.toString().padStart(2, '0')}]`;
        }
      }
    },
  });

  // Cell pixel resolver for impact particle sparks
  playback.setCellPixelResolver((gx, gy) => {
    const metrics = computeBoardMetrics();
    const px = metrics.offsetX + gx * metrics.cellSize + metrics.cellSize / 2;
    const py = metrics.offsetY + gy * metrics.cellSize + metrics.cellSize / 2;
    return [px, py];
  });

  function computeBoardMetrics() {
    const currentLayout = layout.getLayout();
    const maxAvailableW = currentLayout.containerWidth - 32;
    const maxAvailableH = currentLayout.containerHeight - 32;
    const maxAvailable = Math.min(maxAvailableW, maxAvailableH);
    const cellSize = Math.max(24, Math.floor(maxAvailable / Math.max(initialBoard.w, initialBoard.h)));
    const boardSizePx = cellSize * initialBoard.w;
    const offsetX = Math.floor((currentLayout.containerWidth - boardSizePx) / 2);
    const offsetY = Math.floor((currentLayout.containerHeight - boardSizePx) / 2);
    return { boardSizePx, cellSize, offsetX, offsetY };
  }

  function redraw(): void {
    if (!ctx) return;
    const currentLayout = layout.getLayout();
    const activeBoard = playback.currentBoard ?? initialBoard;
    const isPlaying = playback.status === 'playing' || playback.status === 'paused';

    const metrics = drawFullFrame(
      ctx,
      currentLayout.containerWidth,
      currentLayout.containerHeight,
      activeBoard,
      cursor,
      isPlaying,
    );
    inputManager.updateMetrics(metrics, initialBoard.w, initialBoard.h);
  }

  function detonateAt(x: number, y: number, rot: 0 | 1): void {
    if (playback.status === 'playing') return;

    // Verify cell is empty
    const idx = y * initialBoard.w + x;
    if (initialBoard.cells[idx] !== null && initialBoard.cells[idx] !== undefined) {
      return;
    }

    sound.initOnGesture();
    sound.playSparkSet();

    const result = simulate(initialBoard, { x, y, rot });
    playback.load(initialBoard, result);
    playback.play();
  }

  // Audio mute button
  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      sound.initOnGesture();
      const muted = sound.toggleMute();
      btnAudio.textContent = muted ? 'AUDIO: MUTED' : 'AUDIO: ON';
    });
  }

  // Speed controls
  function updateSpeedButtons(speed: PlaybackSpeed): void {
    playback.setSpeed(speed);
    speed1xBtn?.classList.toggle('btn-active', speed === '1x');
    speed2xBtn?.classList.toggle('btn-active', speed === '2x');
    speedSkipBtn?.classList.toggle('btn-active', speed === 'skip');
  }

  speed1xBtn?.addEventListener('click', () => {
    sound.initOnGesture();
    updateSpeedButtons('1x');
  });

  speed2xBtn?.addEventListener('click', () => {
    sound.initOnGesture();
    updateSpeedButtons('2x');
  });

  speedSkipBtn?.addEventListener('click', () => {
    sound.initOnGesture();
    updateSpeedButtons('skip');
  });

  replayBtn?.addEventListener('click', () => {
    sound.initOnGesture();
    playback.restart();
  });

  const inputManager = new InputManager(canvas, {
    onCursorMove: (newCursor) => {
      if (playback.status === 'playing') return;
      cursor.x = newCursor.x;
      cursor.y = newCursor.y;
      cursor.active = true;

      if (coordEl && playback.status === 'idle') {
        coordEl.textContent = `[${cursor.x.toString().padStart(2, '0')}, ${cursor.y.toString().padStart(2, '0')}]`;
      }
    },
    onPlace: (x, y, rot) => {
      detonateAt(x, y, rot);
    },
    onRotate: (rot) => {
      if (playback.status === 'playing') return;
      cursor.rot = rot;
      if (sparkEl && playback.status === 'idle') {
        if (initialBoard.spark === 'LANCE') {
          sparkEl.textContent = rot === 1 ? 'LANCE (VERT)' : 'LANCE (HORIZ)';
        } else {
          sparkEl.textContent = initialBoard.spark;
        }
      }
    },
    onUndo: () => {
      if (playback.status === 'finished') {
        playback.load(initialBoard, { score: 0, destroyed: 0, lastTick: 0, events: [], hash: '' });
      }
    },
  });

  // Global user interaction listener to resume audio context
  window.addEventListener(
    'pointerdown',
    () => {
      sound.initOnGesture();
    },
    { once: true },
  );

  window.addEventListener(
    'keydown',
    () => {
      sound.initOnGesture();
    },
    { once: true },
  );

  layout.onResize(() => {
    redraw();
  });

  // Initial layout configuration
  layout.updateCanvasSize();
  redraw();

  // Animation frame loop
  let lastTimestamp = performance.now();
  function animationLoop(timestamp: number): void {
    const dt = Math.min(100, timestamp - lastTimestamp);
    lastTimestamp = timestamp;

    playback.update(dt);
    fx.update(dt);
    redraw();

    requestAnimationFrame(animationLoop);
  }

  requestAnimationFrame(animationLoop);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
