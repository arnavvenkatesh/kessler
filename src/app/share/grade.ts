/**
 * Grade calculation, glyph rendering, and share text generation.
 *
 * BLUEPRINT Section 3:
 * ratio = score / optimum (from solver)
 * - PERFECT: 100%
 * - NOVA: 90% or more
 * - FLARE: 75% or more
 * - SPARK: 50% or more
 * - DUD: under 50%
 *
 * The grade is a drawn ring-segment glyph (no emoji).
 */

import { PALETTE } from '../render/palette';

export type Grade = 'PERFECT' | 'NOVA' | 'FLARE' | 'SPARK' | 'DUD';

export interface GradeResult {
  grade: Grade;
  ratio: number;       // e.g. 0.914
  percent: number;     // e.g. 91
  scoreDisplay: string; // e.g. "31.4"
}

export function computeGrade(score: number, optimumScore: number): GradeResult {
  const ratio = optimumScore > 0 ? score / optimumScore : 0;
  const percent = Math.min(100, Math.floor(ratio * 100));
  // Display score as e.g. 360 -> 36.0 (divided by 10 per spec)
  const scoreDisplay = (score / 10).toFixed(1);

  let grade: Grade = 'DUD';
  if (ratio >= 0.999) {
    grade = 'PERFECT';
  } else if (ratio >= 0.90) {
    grade = 'NOVA';
  } else if (ratio >= 0.75) {
    grade = 'FLARE';
  } else if (ratio >= 0.50) {
    grade = 'SPARK';
  } else {
    grade = 'DUD';
  }

  return { grade, ratio, percent, scoreDisplay };
}

/**
 * Renders the hand-drawn technical ring-segment grade glyph onto a Canvas2D.
 * 5 ring segments representing performance bands.
 * No emojis, no gradients, strict palette tokens.
 */
export function drawGradeGlyph(
  ctx: CanvasRenderingContext2D,
  grade: Grade,
  centerX: number,
  centerY: number,
  radius: number,
): void {
  ctx.save();

  const numSegments = 5;
  const activeSegmentsMap: Record<Grade, number> = {
    PERFECT: 5,
    NOVA: 4,
    FLARE: 3,
    SPARK: 2,
    DUD: 1,
  };

  const activeCount = activeSegmentsMap[grade];
  const arcSpan = (Math.PI * 2) / numSegments;
  const gap = 0.12; // Segment gap in radians
  const strokeW = Math.max(3, Math.round(radius * 0.22));

  ctx.lineWidth = strokeW;
  ctx.lineCap = 'butt';

  // Base background track (in --grid)
  for (let i = 0; i < numSegments; i++) {
    const startAngle = i * arcSpan - Math.PI / 2 + gap / 2;
    const endAngle = (i + 1) * arcSpan - Math.PI / 2 - gap / 2;

    const isActive = i < activeCount;
    ctx.strokeStyle = isActive
      ? grade === 'PERFECT'
        ? PALETTE.solar
        : grade === 'NOVA'
        ? PALETTE.ember
        : grade === 'FLARE'
        ? PALETTE.coolant
        : grade === 'SPARK'
        ? PALETTE.chalk
        : PALETTE.rust
      : PALETTE.grid;

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - strokeW / 2, startAngle, endAngle);
    ctx.stroke();
  }

  // Inner central rating pip
  ctx.fillStyle = grade === 'PERFECT' ? PALETTE.solar : PALETTE.chalk;
  ctx.beginPath();
  ctx.arc(centerX, centerY, Math.max(2, radius * 0.15), 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Generates the clean plain-text share transmission.
 */
export function generateShareText(options: {
  dayNumber: number;
  weekdayStr: string;
  grade: Grade;
  percent: number;
  chainDepth: number;
  scoreDisplay: string;
  constellationName: string;
  url: string;
}): string {
  return [
    `KESSLER #${options.dayNumber} · ${options.weekdayStr}`,
    `${options.grade} ${options.percent}% · chain ${options.chainDepth} · ${options.scoreDisplay}`,
    `Constellation: ${options.constellationName}`,
    options.url,
  ].join('\n');
}
