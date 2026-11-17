import type { Kind } from '../../core/types';
import { PALETTE } from './palette';

export type Polygon24 = readonly number[];

/**
 * 3 authored variants for Cinder rocks (24x24 integer grid).
 * Variant 0 is the anchor example from BLUEPRINT Section 6.
 */
export const CINDER_VARIANTS: readonly Polygon24[] = [
  [4, 9, 8, 4, 15, 3, 20, 8, 21, 15, 16, 21, 9, 20, 3, 15],
  [5, 7, 11, 4, 18, 5, 21, 11, 19, 18, 13, 21, 6, 19, 3, 13],
  [7, 5, 15, 4, 20, 9, 21, 16, 15, 21, 8, 20, 4, 16, 3, 9],
];

/**
 * 3 authored variants for Shard crystals.
 */
export const SHARD_VARIANTS: readonly Polygon24[] = [
  [12, 2, 20, 7, 22, 15, 12, 22, 2, 15, 4, 7],
  [12, 3, 21, 8, 19, 18, 12, 21, 5, 18, 3, 8],
  [11, 2, 21, 6, 21, 16, 13, 22, 3, 16, 3, 7],
];

/**
 * 8-point star for Beacon.
 */
export const BEACON_STAR: Polygon24 = [
  12, 2, 15, 9, 22, 12, 15, 15, 12, 22, 9, 15, 2, 12, 9, 9,
];

/**
 * Deterministic rock variant index (0, 1, or 2) from cell coordinates.
 */
export function getRockVariantIndex(x: number, y: number): number {
  return ((x * 7 + y * 13) % 3 + 3) % 3;
}

/**
 * Draws a 24x24 polygon scaled to cell bounds with hard 2px offset shadow and 2px stroke.
 */
function drawPolygon(
  ctx: CanvasRenderingContext2D,
  poly: Polygon24,
  cellX: number,
  cellY: number,
  size: number,
  fillColor: string,
  strokeColor: string,
  shadowOffset = 2,
): void {
  const scale = size / 24;

  // 1. Draw hard 2px offset misregistration shadow
  if (shadowOffset > 0) {
    ctx.beginPath();
    for (let i = 0; i < poly.length; i += 2) {
      const px = Math.round(cellX + poly[i]! * scale + shadowOffset);
      const py = Math.round(cellY + poly[i + 1]! * scale + shadowOffset);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = PALETTE.void;
    ctx.fill();
  }

  // 2. Main body fill & 2px outline
  ctx.beginPath();
  for (let i = 0; i < poly.length; i += 2) {
    const px = Math.round(cellX + poly[i]! * scale);
    const py = Math.round(cellY + poly[i + 1]! * scale);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = fillColor;
  ctx.fill();

  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.stroke();
}

/**
 * Renders a Cinder body: rock polygon with four short tick marks N/E/S/W.
 */
export function drawCinder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  variantIdx = 0,
): void {
  const poly = CINDER_VARIANTS[variantIdx % CINDER_VARIANTS.length]!;
  drawPolygon(ctx, poly, x, y, cellSize, PALETTE.hull, PALETTE.chalk);

  const scale = cellSize / 24;
  ctx.strokeStyle = PALETTE.ember;
  ctx.lineWidth = 2;

  // 4 short orthogonal tick marks (N, E, S, W)
  ctx.beginPath();
  // North
  ctx.moveTo(Math.round(x + 12 * scale), Math.round(y + 1 * scale));
  ctx.lineTo(Math.round(x + 12 * scale), Math.round(y + 4 * scale));
  // East
  ctx.moveTo(Math.round(x + 20 * scale), Math.round(y + 12 * scale));
  ctx.lineTo(Math.round(x + 23 * scale), Math.round(y + 12 * scale));
  // South
  ctx.moveTo(Math.round(x + 12 * scale), Math.round(y + 20 * scale));
  ctx.lineTo(Math.round(x + 12 * scale), Math.round(y + 23 * scale));
  // West
  ctx.moveTo(Math.round(x + 1 * scale), Math.round(y + 12 * scale));
  ctx.lineTo(Math.round(x + 4 * scale), Math.round(y + 12 * scale));
  ctx.stroke();
}

/**
 * Renders a Shard body: rotated angular crystal with an X scratched in.
 */
export function drawShard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  variantIdx = 0,
): void {
  const poly = SHARD_VARIANTS[variantIdx % SHARD_VARIANTS.length]!;
  drawPolygon(ctx, poly, x, y, cellSize, PALETTE.hull, PALETTE.chalk);

  const scale = cellSize / 24;
  ctx.strokeStyle = PALETTE.ember;
  ctx.lineWidth = 2;

  // Scratched diagonal X inside crystal
  ctx.beginPath();
  ctx.moveTo(Math.round(x + 8 * scale), Math.round(y + 8 * scale));
  ctx.lineTo(Math.round(x + 16 * scale), Math.round(y + 16 * scale));
  ctx.moveTo(Math.round(x + 16 * scale), Math.round(y + 8 * scale));
  ctx.lineTo(Math.round(x + 8 * scale), Math.round(y + 16 * scale));
  ctx.stroke();
}

/**
 * Renders a Beacon body: 8-point solar yellow star.
 */
export function drawBeacon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
): void {
  drawPolygon(ctx, BEACON_STAR, x, y, cellSize, PALETTE.solar, PALETTE.chalk);

  // Center inner pip
  const scale = cellSize / 24;
  ctx.fillStyle = PALETTE.void;
  const cx = Math.round(x + 12 * scale);
  const cy = Math.round(y + 12 * scale);
  ctx.fillRect(cx - 2, cy - 2, 4, 4);
}

/**
 * Renders a Singularity body: solid void disc with a broken accretion ring (3 arcs).
 */
export function drawSingularity(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
): void {
  const scale = cellSize / 24;
  const cx = Math.round(x + 12 * scale);
  const cy = Math.round(y + 12 * scale);
  const coreRadius = Math.round(6 * scale);
  const ringRadius = Math.round(9 * scale);

  // Hard offset shadow
  ctx.beginPath();
  ctx.arc(cx + 2, cy + 2, coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.void;
  ctx.fill();

  // Solid dark center disc
  ctx.beginPath();
  ctx.arc(cx, cy, coreRadius, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.void;
  ctx.fill();
  ctx.strokeStyle = PALETTE.dust;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Broken accretion ring: 3 arcs
  ctx.strokeStyle = PALETTE.chalk;
  ctx.lineWidth = 2;

  // Arc 1
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius, 0.4, 1.8);
  ctx.stroke();

  // Arc 2
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius, 2.5, 3.9);
  ctx.stroke();

  // Arc 3
  ctx.beginPath();
  ctx.arc(cx, cy, ringRadius, 4.6, 6.0);
  ctx.stroke();
}

/**
 * Renders a Mirror body: thin slab at 45 degrees with two bracket mounts.
 */
export function drawMirror(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  kind: 'MRF' | 'MRB',
): void {
  const scale = cellSize / 24;

  const x1 = Math.round(x + (kind === 'MRF' ? 4 : 4) * scale);
  const y1 = Math.round(y + (kind === 'MRF' ? 20 : 4) * scale);
  const x2 = Math.round(x + (kind === 'MRF' ? 20 : 20) * scale);
  const y2 = Math.round(y + (kind === 'MRF' ? 4 : 20) * scale);

  // Offset shadow
  ctx.beginPath();
  ctx.moveTo(x1 + 2, y1 + 2);
  ctx.lineTo(x2 + 2, y2 + 2);
  ctx.strokeStyle = PALETTE.void;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Main reflecting slab
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = PALETTE.chalk;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Two mounting brackets
  ctx.fillStyle = PALETTE.dust;
  const mx1 = Math.round(x + (kind === 'MRF' ? 7 : 7) * scale);
  const my1 = Math.round(y + (kind === 'MRF' ? 17 : 7) * scale);
  const mx2 = Math.round(x + (kind === 'MRF' ? 17 : 17) * scale);
  const my2 = Math.round(y + (kind === 'MRF' ? 7 : 17) * scale);

  ctx.fillRect(mx1 - 2, my1 - 2, 4, 4);
  ctx.fillRect(mx2 - 2, my2 - 2, 4, 4);
}

/**
 * Renders a Lance body: elongated capsule with arrowheads on its axis.
 */
export function drawLance(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  rot: 0 | 1 = 0,
): void {
  const scale = cellSize / 24;
  const cx = Math.round(x + 12 * scale);
  const cy = Math.round(y + 12 * scale);

  ctx.strokeStyle = PALETTE.chalk;
  ctx.fillStyle = PALETTE.ember;
  ctx.lineWidth = 2;

  if (rot === 0) {
    // Horizontal (East-West)
    // Shaft
    ctx.beginPath();
    ctx.moveTo(Math.round(x + 6 * scale), cy);
    ctx.lineTo(Math.round(x + 18 * scale), cy);
    ctx.stroke();

    // West Arrowhead
    ctx.beginPath();
    ctx.moveTo(Math.round(x + 3 * scale), cy);
    ctx.lineTo(Math.round(x + 7 * scale), cy - 4 * scale);
    ctx.lineTo(Math.round(x + 7 * scale), cy + 4 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // East Arrowhead
    ctx.beginPath();
    ctx.moveTo(Math.round(x + 21 * scale), cy);
    ctx.lineTo(Math.round(x + 17 * scale), cy - 4 * scale);
    ctx.lineTo(Math.round(x + 17 * scale), cy + 4 * scale);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else {
    // Vertical (North-South)
    // Shaft
    ctx.beginPath();
    ctx.moveTo(cx, Math.round(y + 6 * scale));
    ctx.lineTo(cx, Math.round(y + 18 * scale));
    ctx.stroke();

    // North Arrowhead
    ctx.beginPath();
    ctx.moveTo(cx, Math.round(y + 3 * scale));
    ctx.lineTo(cx - 4 * scale, Math.round(y + 7 * scale));
    ctx.lineTo(cx + 4 * scale, Math.round(y + 7 * scale));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // South Arrowhead
    ctx.beginPath();
    ctx.moveTo(cx, Math.round(y + 21 * scale));
    ctx.lineTo(cx - 4 * scale, Math.round(y + 17 * scale));
    ctx.lineTo(cx + 4 * scale, Math.round(y + 17 * scale));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

/**
 * Renders a Plated body: rock with a second inset armor outline.
 */
export function drawPlated(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  cellSize: number,
  variantIdx = 0,
  cracked = false,
): void {
  const poly = CINDER_VARIANTS[variantIdx % CINDER_VARIANTS.length]!;
  drawPolygon(ctx, poly, x, y, cellSize, PALETTE.hull, cracked ? PALETTE.rust : PALETTE.chalk);

  // Inset armor outline
  const scale = (cellSize / 24) * 0.65;
  const offsetX = cellSize * 0.175;
  const offsetY = cellSize * 0.175;

  ctx.beginPath();
  for (let i = 0; i < poly.length; i += 2) {
    const px = Math.round(x + offsetX + poly[i]! * scale);
    const py = Math.round(y + offsetY + poly[i + 1]! * scale);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.strokeStyle = cracked ? PALETTE.rust : PALETTE.dust;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/**
 * Master dispatcher for drawing any body kind.
 */
export function drawBody(
  ctx: CanvasRenderingContext2D,
  kind: Kind,
  cellX: number,
  cellY: number,
  cellSize: number,
  gridX = 0,
  gridY = 0,
): void {
  const variant = getRockVariantIndex(gridX, gridY);

  switch (kind) {
    case 'CIN':
      drawCinder(ctx, cellX, cellY, cellSize, variant);
      break;
    case 'SHD':
      drawShard(ctx, cellX, cellY, cellSize, variant);
      break;
    case 'BCN':
      drawBeacon(ctx, cellX, cellY, cellSize);
      break;
    case 'SNG':
      drawSingularity(ctx, cellX, cellY, cellSize);
      break;
    case 'MRF':
      drawMirror(ctx, cellX, cellY, cellSize, 'MRF');
      break;
    case 'MRB':
      drawMirror(ctx, cellX, cellY, cellSize, 'MRB');
      break;
    case 'LNH':
      drawLance(ctx, cellX, cellY, cellSize, 0);
      break;
    case 'LNV':
      drawLance(ctx, cellX, cellY, cellSize, 1);
      break;
    case 'PLT':
      drawPlated(ctx, cellX, cellY, cellSize, variant, false);
      break;
    default:
      drawCinder(ctx, cellX, cellY, cellSize, variant);
      break;
  }
}
