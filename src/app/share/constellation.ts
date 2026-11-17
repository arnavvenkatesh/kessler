/**
 * Constellation name generator and 1080x1350 in-browser PNG chart renderer.
 *
 * BLUEPRINT Section 3:
 * - Constellation name from syllable table seeded by the event-log hash (identical cascades get identical names).
 * - Share image: 1080x1350 canvas PNG made in-browser (dithered starfield, the cascade as a constellation graph,
 *   generated name, day number and grade).
 * - Web Share API with file when available, otherwise download plus copy text.
 */

import { hash32 } from '../../core/rng';
import type { SimEvent } from '../../core/types';
import { PALETTE } from '../render/palette';
import { drawGradeGlyph, type Grade } from './grade';

const PREFIXES = [
  'Vel',
  'Orr',
  'Cyg',
  'Lyr',
  'Aqu',
  'Dra',
  'Cas',
  'Per',
  'And',
  'Cen',
  'Vul',
  'Ser',
  'Hyd',
  'For',
  'Pyx',
  'Vol',
  'Sol',
  'Aur',
  'Cru',
  'Lep',
] as const;

const SUFFIXES = [
  'a',
  'in',
  'is',
  'on',
  'or',
  'us',
  'ix',
  'um',
  'ar',
  'os',
  'ea',
  'en',
  'ex',
  'id',
  'am',
  'al',
  'io',
  'an',
  'ur',
  'ia',
] as const;

const EPITHETS = [
  'Orrin',
  'Major',
  'Minor',
  'Prime',
  'Borealis',
  'Australis',
  'Nova',
  'Vectis',
  'Corvus',
  'Norma',
  'Corona',
  'Spira',
  'Vertex',
  'Nexus',
  'Vela',
  'Caelum',
  'Draconis',
  'Lupus',
] as const;

/**
 * Deterministically generates a constellation name from the simulation hash.
 */
export function generateConstellationName(simHash: string): string {
  const h = hash32(simHash);
  const pIdx = (h >>> 0) % PREFIXES.length;
  const sIdx = ((h >>> 8) ^ 0x5a) % SUFFIXES.length;
  const eIdx = ((h >>> 16) ^ 0xa5) % EPITHETS.length;

  const word1 = `${PREFIXES[pIdx]}${SUFFIXES[sIdx]}`;
  const word2 = EPITHETS[eIdx];
  return `${word1} ${word2}`;
}

export interface ConstellationChartOptions {
  dayNumber: number;
  dateStr: string;
  grade: Grade;
  percent: number;
  scoreDisplay: string;
  chainDepth: number;
  destroyedCount: number;
  events: SimEvent[];
  boardW: number;
  boardH: number;
  simHash: string;
}

/**
 * Generates a 1080x1350 technical constellation PNG chart using native OffscreenCanvas / Canvas.
 */
export async function generateConstellationPng(
  options: ConstellationChartOptions,
): Promise<Blob | null> {
  const width = 1080;
  const height = 1350;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // 1. Background Void
  ctx.fillStyle = PALETTE.void;
  ctx.fillRect(0, 0, width, height);

  // 2. Technical Starfield Dither
  ctx.fillStyle = PALETTE.grid;
  for (let y = 16; y < height; y += 48) {
    for (let x = 16; x < width; x += 48) {
      const h = (x * 43 + y * 67) % 23;
      if (h === 0) {
        ctx.fillRect(x, y, 2, 2);
      } else if (h === 7) {
        // Micro crosshair
        ctx.fillRect(x - 2, y, 5, 1);
        ctx.fillRect(x, y - 2, 1, 5);
      }
    }
  }

  // 3. Technical Border with Chamfered Corners
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 3;
  ctx.strokeRect(36, 36, width - 72, height - 72);

  // Corner Chamfers
  const chamfer = 16;
  ctx.fillStyle = PALETTE.void;
  // Top-left
  ctx.beginPath();
  ctx.moveTo(34, 34);
  ctx.lineTo(34 + chamfer, 34);
  ctx.lineTo(34, 34 + chamfer);
  ctx.fill();
  ctx.strokeStyle = PALETTE.chalk;
  ctx.beginPath();
  ctx.moveTo(34 + chamfer, 34);
  ctx.lineTo(34, 34 + chamfer);
  ctx.stroke();

  // 4. Header Bar
  ctx.fillStyle = PALETTE.hull;
  ctx.fillRect(40, 40, width - 80, 110);
  ctx.strokeStyle = PALETTE.grid;
  ctx.strokeRect(40, 40, width - 80, 110);

  ctx.fillStyle = PALETTE.chalk;
  ctx.font = '900 48px "Big Shoulders Display", sans-serif';
  ctx.fillText('KESSLER', 70, 104);

  ctx.fillStyle = PALETTE.dust;
  ctx.font = '600 20px "IBM Plex Mono", monospace';
  ctx.fillText(`// SECTOR #${options.dayNumber} · ${options.dateStr}`, 250, 98);

  ctx.fillStyle = PALETTE.coolant;
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.fillText('MISSION LOG ARCHIVE', 820, 98);

  // 5. Constellation Graph Box
  const graphBoxX = 80;
  const graphBoxY = 190;
  const graphBoxSize = 920;

  ctx.fillStyle = PALETTE.hull;
  ctx.fillRect(graphBoxX, graphBoxY, graphBoxSize, graphBoxSize);
  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 2;
  ctx.strokeRect(graphBoxX, graphBoxY, graphBoxSize, graphBoxSize);

  // Grid tick marks
  const { boardW, boardH } = options;
  const cellPx = graphBoxSize / Math.max(boardW, boardH);

  ctx.strokeStyle = PALETTE.grid;
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 4]);
  for (let i = 1; i < boardW; i++) {
    const x = graphBoxX + i * cellPx;
    ctx.beginPath();
    ctx.moveTo(x, graphBoxY);
    ctx.lineTo(x, graphBoxY + graphBoxSize);
    ctx.stroke();
  }
  for (let j = 1; j < boardH; j++) {
    const y = graphBoxY + j * cellPx;
    ctx.beginPath();
    ctx.moveTo(graphBoxX, y);
    ctx.lineTo(graphBoxX + graphBoxSize, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Collect sequential detonation nodes
  const nodes: { x: number; y: number; tick: number }[] = [];
  for (const ev of options.events) {
    if (ev.type === 'detonate') {
      nodes.push({ x: ev.x, y: ev.y, tick: ev.t });
    }
  }

  // Draw Constellation Lines connecting sequential ticks
  if (nodes.length > 1) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = PALETTE.ember;
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      const nx = graphBoxX + nodes[i]!.x * cellPx + cellPx / 2;
      const ny = graphBoxY + nodes[i]!.y * cellPx + cellPx / 2;
      if (i === 0) ctx.moveTo(nx, ny);
      else ctx.lineTo(nx, ny);
    }
    ctx.stroke();

    // 2px chalk core
    ctx.lineWidth = 2;
    ctx.strokeStyle = PALETTE.chalk;
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      const nx = graphBoxX + nodes[i]!.x * cellPx + cellPx / 2;
      const ny = graphBoxY + nodes[i]!.y * cellPx + cellPx / 2;
      if (i === 0) ctx.moveTo(nx, ny);
      else ctx.lineTo(nx, ny);
    }
    ctx.stroke();
  }

  // Draw Constellation Node Stars
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    const nx = graphBoxX + node.x * cellPx + cellPx / 2;
    const ny = graphBoxY + node.y * cellPx + cellPx / 2;

    // Node star disc
    ctx.fillStyle = i === 0 ? PALETTE.coolant : PALETTE.solar;
    ctx.beginPath();
    ctx.arc(nx, ny, 6, 0, Math.PI * 2);
    ctx.fill();

    // Node tick crosshair
    ctx.strokeStyle = PALETTE.chalk;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(nx - 10, ny);
    ctx.lineTo(nx + 10, ny);
    ctx.moveTo(nx, ny - 10);
    ctx.lineTo(nx, ny + 10);
    ctx.stroke();

    // Tick number badge
    ctx.fillStyle = PALETTE.dust;
    ctx.font = '600 13px "IBM Plex Mono", monospace';
    ctx.fillText(String(node.tick), nx + 10, ny - 8);
  }

  // 6. Footer Telemetry & Constellation Title
  const constName = generateConstellationName(options.simHash);

  ctx.fillStyle = PALETTE.solar;
  ctx.font = '900 44px "Big Shoulders Display", sans-serif';
  ctx.fillText(`CONSTELLATION: ${constName.toUpperCase()}`, 80, 1170);

  ctx.fillStyle = PALETTE.dust;
  ctx.font = '600 20px "IBM Plex Mono", monospace';
  ctx.fillText(
    `SCORE: ${options.scoreDisplay}  ·  CHAIN: ${options.chainDepth}  ·  CLEARED: ${options.destroyedCount}`,
    80,
    1215,
  );

  ctx.fillStyle = PALETTE.coolant;
  ctx.font = '600 18px "IBM Plex Mono", monospace';
  ctx.fillText(`GRADE CLASSIFICATION: ${options.grade} (${options.percent}%)`, 80, 1255);

  // Watermark
  ctx.fillStyle = PALETTE.grid;
  ctx.font = '600 15px "IBM Plex Mono", monospace';
  ctx.fillText('kessler.app', 80, 1295);

  // Draw Grade Glyph in footer
  drawGradeGlyph(ctx, options.grade, 950, 1220, 48);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      resolve(blob);
    }, 'image/png');
  });
}
