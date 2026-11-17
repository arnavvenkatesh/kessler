import type { Board } from '../../core/types';
import { fx } from './fx';
import { PALETTE } from './palette';
import { drawBody } from './shapes';

export interface CursorState {
  x: number;
  y: number;
  active: boolean;
  rot: 0 | 1;
}

export interface RenderMetrics {
  boardSizePx: number;
  cellSize: number;
  offsetX: number;
  offsetY: number;
}

/**
 * Computes integer pixel layout metrics for centering a board in a viewport.
 */
export function computeBoardMetrics(
  canvasWidth: number,
  canvasHeight: number,
  gridCols: number,
  gridRows: number,
): RenderMetrics {
  const maxAvailableW = canvasWidth - 32;
  const maxAvailableH = canvasHeight - 32;
  const maxAvailable = Math.min(maxAvailableW, maxAvailableH);

  // Integer cell size for crisp lines
  const cellSize = Math.max(24, Math.floor(maxAvailable / Math.max(gridCols, gridRows)));
  const boardSizePx = cellSize * gridCols;

  const offsetX = Math.floor((canvasWidth - boardSizePx) / 2);
  const offsetY = Math.floor((canvasHeight - boardSizePx) / 2);

  return {
    boardSizePx,
    cellSize,
    offsetX,
    offsetY,
  };
}

/**
 * Traces first-hit preview rays from an empty cell according to the Spark type.
 */
export function traceFirstHitPreviews(
  board: Board,
  originX: number,
  originY: number,
  lanceRot: 0 | 1 = 0,
): { paths: [number, number][][]; hitTargets: [number, number][] } {
  const { w, h, cells, spark } = board;
  const paths: [number, number][][] = [];
  const hitTargets: [number, number][] = [];

  let dirs: [number, number][] = [];
  if (spark === 'CROSS') {
    dirs = [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ];
  } else if (spark === 'SKEW') {
    dirs = [
      [1, -1],
      [1, 1],
      [-1, 1],
      [-1, -1],
    ];
  } else if (spark === 'LANCE') {
    dirs =
      lanceRot === 1
        ? [
            [0, -1],
            [0, 1],
          ]
        : [
            [1, 0],
            [-1, 0],
          ];
  }

  const isSolarWind = board.mutator === 'SOLAR_WIND';
  let deadZoneMinX = -999;
  let deadZoneMinY = -999;
  if (board.mutator && board.mutator.startsWith('DEAD_ZONE')) {
    if (board.mutator.includes(':')) {
      const coords = board.mutator.split(':')[1]?.split(',') ?? [];
      deadZoneMinX = Number.parseInt(coords[0] ?? '0', 10);
      deadZoneMinY = Number.parseInt(coords[1] ?? '0', 10);
    } else {
      deadZoneMinX = ((w - 3) / 2) | 0;
      deadZoneMinY = ((h - 3) / 2) | 0;
    }
  }

  for (let d = 0; d < dirs.length; d++) {
    let dx = dirs[d]![0];
    let dy = dirs[d]![1];
    let curX = originX;
    let curY = originY;
    let path: [number, number][] = [[curX, curY]];
    let steps = 0;
    const maxSteps = isSolarWind ? 6 : w * h * 2;

    while (steps < maxSteps) {
      curX += dx;
      curY += dy;
      steps++;

      if (curX < 0 || curX >= w || curY < 0 || curY >= h) {
        break;
      }

      path.push([curX, curY]);

      // Dead zone mutator absorbs preview ray
      if (
        curX >= deadZoneMinX &&
        curX < deadZoneMinX + 3 &&
        curY >= deadZoneMinY &&
        curY < deadZoneMinY + 3
      ) {
        hitTargets.push([curX, curY]);
        break;
      }

      const idx = curY * w + curX;
      const cell = cells[idx];

      if (cell === null || cell === undefined) {
        continue;
      }

      // SNG absorbs ray
      if (cell.kind === 'SNG') {
        hitTargets.push([curX, curY]);
        break;
      }

      // Mirrors deflect orthogonal rays
      if (cell.kind === 'MRF' && dx !== 0 && dy !== 0) {
        // diagonal passes through
        continue;
      }
      if (cell.kind === 'MRB' && dx !== 0 && dy !== 0) {
        continue;
      }

      if (cell.kind === 'MRF') {
        if (dx === 1 && dy === 0) {
          dx = 0;
          dy = -1;
        } else if (dx === 0 && dy === -1) {
          dx = 1;
          dy = 0;
        } else if (dx === -1 && dy === 0) {
          dx = 0;
          dy = 1;
        } else if (dx === 0 && dy === 1) {
          dx = -1;
          dy = 0;
        }
        continue;
      }

      if (cell.kind === 'MRB') {
        if (dx === 1 && dy === 0) {
          dx = 0;
          dy = 1;
        } else if (dx === 0 && dy === 1) {
          dx = 1;
          dy = 0;
        } else if (dx === -1 && dy === 0) {
          dx = 0;
          dy = -1;
        } else if (dx === 0 && dy === -1) {
          dx = -1;
          dy = 0;
        }
        continue;
      }

      // Wormhole teleports preview ray to partner
      if (cell.kind === 'WRM') {
        hitTargets.push([curX, curY]);
        const targetPair = cell.pair;
        let partnerIdx = -1;
        for (let pi = 0; pi < cells.length; pi++) {
          if (pi !== idx) {
            const pc = cells[pi];
            if (pc && pc.kind === 'WRM' && (targetPair === undefined || pc.pair === targetPair)) {
              partnerIdx = pi;
              break;
            }
          }
        }

        if (partnerIdx !== -1) {
          if (path.length >= 2) {
            paths.push([...path]);
          }
          curX = partnerIdx % w;
          curY = (partnerIdx / w) | 0;
          path = [[curX, curY]];
          continue;
        } else {
          break;
        }
      }

      // Any ignitable body is hit
      hitTargets.push([curX, curY]);
      if (spark !== 'LANCE') {
        break;
      }
    }

    if (path.length >= 2) {
      paths.push(path);
    }
  }

  return { paths, hitTargets };
}

/**
 * Draws the technical space background with subtle dither starfield.
 */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, width, height);

  // Subtle Bayer dither starfield dots
  ctx.fillStyle = PALETTE.grid;
  for (let y = 8; y < height; y += 32) {
    for (let x = 8; x < width; x += 32) {
      const hash = (x * 37 + y * 53) % 17;
      if (hash === 0) {
        ctx.fillRect(x, y, 1, 1);
      } else if (hash === 3) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
  }
}

/**
 * Renders the full game board, bodies, cursor, rays, and sparks.
 */
export function renderBoard(
  ctx: CanvasRenderingContext2D,
  board: Board,
  cursor: CursorState,
  metrics: RenderMetrics,
  isPlaybackActive: boolean = false,
  highlightedZone?: { minX: number; minY: number; maxX: number; maxY: number } | null,
): void {
  // Apply screen nudge integer offset
  const offsetX = metrics.offsetX + fx.nudgeX;
  const offsetY = metrics.offsetY + fx.nudgeY;
  const { boardSizePx, cellSize } = metrics;
  const { w, h, cells } = board;

  // 1. Board background plate with hard 2px offset shadow
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(offsetX + 2, offsetY + 2, boardSizePx, boardSizePx);

  ctx.fillStyle = PALETTE.hull;
  ctx.fillRect(offsetX, offsetY, boardSizePx, boardSizePx);

  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 2;
  ctx.strokeRect(offsetX, offsetY, boardSizePx, boardSizePx);

  // 1.5 Draw Dead Zone if present
  if (board.mutator && board.mutator.startsWith('DEAD_ZONE')) {
    let dzX = ((w - 3) / 2) | 0;
    let dzY = ((h - 3) / 2) | 0;
    if (board.mutator.includes(':')) {
      const parts = board.mutator.split(':')[1]?.split(',') ?? [];
      dzX = Number.parseInt(parts[0] ?? '0', 10);
      dzY = Number.parseInt(parts[1] ?? '0', 10);
    }
    const dzPx = offsetX + dzX * cellSize;
    const dzPy = offsetY + dzY * cellSize;
    const dzSize = cellSize * 3;

    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(dzPx, dzPy, dzSize, dzSize);
    ctx.strokeStyle = PALETTE.rust;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 4]);
    ctx.strokeRect(dzPx + 1, dzPy + 1, dzSize - 2, dzSize - 2);
    ctx.setLineDash([]);
  }

  // 2. Grid lines
  ctx.lineWidth = 1;
  ctx.strokeStyle = PALETTE.grid;

  for (let i = 1; i < w; i++) {
    const x = offsetX + i * cellSize;
    ctx.beginPath();
    ctx.moveTo(x, offsetY);
    ctx.lineTo(x, offsetY + boardSizePx);
    ctx.stroke();
  }

  for (let j = 1; j < h; j++) {
    const y = offsetY + j * cellSize;
    ctx.beginPath();
    ctx.moveTo(offsetX, y);
    ctx.lineTo(offsetX + boardSizePx, y);
    ctx.stroke();
  }

  // 2.5 Highlighted hint zone in --coolant
  if (highlightedZone) {
    const zx = offsetX + highlightedZone.minX * cellSize;
    const zy = offsetY + highlightedZone.minY * cellSize;
    const zw = (highlightedZone.maxX - highlightedZone.minX + 1) * cellSize;
    const zh = (highlightedZone.maxY - highlightedZone.minY + 1) * cellSize;

    ctx.strokeStyle = PALETTE.coolant;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(zx, zy, zw, zh);
    ctx.setLineDash([]);
  }

  // 3. Hover ray preview in --coolant (#3FD0C0) when not in playback
  if (!isPlaybackActive && cursor.active && cursor.x >= 0 && cursor.x < w && cursor.y >= 0 && cursor.y < h) {
    const cursorIdx = cursor.y * w + cursor.x;
    const isCellEmpty = cells[cursorIdx] === null || cells[cursorIdx] === undefined;

    if (isCellEmpty) {
      const { paths, hitTargets } = traceFirstHitPreviews(board, cursor.x, cursor.y, cursor.rot);

      // Draw preview ray paths
      ctx.strokeStyle = PALETTE.coolant;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]); // Technical dashed preview line

      for (let p = 0; p < paths.length; p++) {
        const path = paths[p]!;
        ctx.beginPath();
        for (let i = 0; i < path.length; i++) {
          const px = offsetX + path[i]![0] * cellSize + cellSize / 2;
          const py = offsetY + path[i]![1] * cellSize + cellSize / 2;
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.setLineDash([]); // Reset dash

      // Highlight first-hit target cells with coolant brackets
      for (let t = 0; t < hitTargets.length; t++) {
        const [tx, ty] = hitTargets[t]!;
        const hx = offsetX + tx * cellSize;
        const hy = offsetY + ty * cellSize;

        ctx.strokeStyle = PALETTE.coolant;
        ctx.lineWidth = 2;
        // 4 corner tick marks
        const tick = Math.max(4, cellSize * 0.18);
        ctx.beginPath();
        // Top-left
        ctx.moveTo(hx, hy + tick);
        ctx.lineTo(hx, hy);
        ctx.lineTo(hx + tick, hy);
        // Top-right
        ctx.moveTo(hx + cellSize - tick, hy);
        ctx.lineTo(hx + cellSize, hy);
        ctx.lineTo(hx + cellSize, hy + tick);
        // Bottom-left
        ctx.moveTo(hx, hy + cellSize - tick);
        ctx.lineTo(hx, hy + cellSize);
        ctx.lineTo(hx + tick, hy + cellSize);
        // Bottom-right
        ctx.moveTo(hx + cellSize - tick, hy + cellSize);
        ctx.lineTo(hx + cellSize, hy + cellSize);
        ctx.lineTo(hx + cellSize, hy + cellSize - tick);
        ctx.stroke();
      }
    }
  }

  // 4. Render all bodies on the board
  for (let gy = 0; gy < h; gy++) {
    for (let gx = 0; gx < w; gx++) {
      const idx = gy * w + gx;
      const cell = cells[idx];
      if (cell !== null && cell !== undefined) {
        const cx = offsetX + gx * cellSize;
        const cy = offsetY + gy * cellSize;
        drawBody(ctx, cell.kind, cx, cy, cellSize, gx, gy, cell.pair);
      }
    }
  }

  // 5. Render stepped animation rays during playback
  if (isPlaybackActive) {
    fx.renderRays(ctx, offsetX, offsetY, cellSize);
  }

  // 6. Render active 2x2 sparks on top
  fx.renderSparks(ctx);

  // 7. Render cursor reticle if not in playback
  if (!isPlaybackActive && cursor.active && cursor.x >= 0 && cursor.x < w && cursor.y >= 0 && cursor.y < h) {
    const rx = offsetX + cursor.x * cellSize;
    const ry = offsetY + cursor.y * cellSize;

    // Technical chamfered cursor bracket in --ember (#FF5A2B)
    ctx.strokeStyle = PALETTE.ember;
    ctx.lineWidth = 2;

    const cornerCut = 6;
    ctx.beginPath();
    // Top-left chamfer
    ctx.moveTo(rx, ry + cornerCut + 4);
    ctx.lineTo(rx, ry + cornerCut);
    ctx.lineTo(rx + cornerCut, ry);
    ctx.lineTo(rx + cornerCut + 4, ry);
    // Top-right chamfer
    ctx.moveTo(rx + cellSize - cornerCut - 4, ry);
    ctx.lineTo(rx + cellSize - cornerCut, ry);
    ctx.lineTo(rx + cellSize, ry + cornerCut);
    ctx.lineTo(rx + cellSize, ry + cornerCut + 4);
    // Bottom-right chamfer
    ctx.moveTo(rx + cellSize, ry + cellSize - cornerCut - 4);
    ctx.lineTo(rx + cellSize, ry + cellSize - cornerCut);
    ctx.lineTo(rx + cellSize - cornerCut, ry + cellSize);
    ctx.lineTo(rx + cellSize - cornerCut - 4, ry + cellSize);
    // Bottom-left chamfer
    ctx.moveTo(rx + cornerCut + 4, ry + cellSize);
    ctx.lineTo(rx + cornerCut, ry + cellSize);
    ctx.lineTo(rx, ry + cellSize - cornerCut);
    ctx.lineTo(rx, ry + cellSize - cornerCut - 4);
    ctx.stroke();

    // Center targeting crosshair
    const midX = rx + cellSize / 2;
    const midY = ry + cellSize / 2;
    ctx.strokeStyle = PALETTE.chalk;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(midX - 3, midY);
    ctx.lineTo(midX + 3, midY);
    ctx.moveTo(midX, midY - 3);
    ctx.lineTo(midX, midY + 3);
    ctx.stroke();
  }
}

/**
 * Main render function redrawing entire canvas.
 */
export function drawFullFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  board: Board,
  cursor: CursorState,
  isPlaybackActive: boolean = false,
  highlightedZone?: { minX: number; minY: number; maxX: number; maxY: number } | null,
): RenderMetrics {
  drawBackground(ctx, width, height);
  const metrics = computeBoardMetrics(width, height, board.w, board.h);
  renderBoard(ctx, board, cursor, metrics, isPlaybackActive, highlightedZone);
  return metrics;
}
