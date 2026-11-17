/**
 * Pre-generates board snapshots into data/boards/ for content workflow.
 *
 * BLUEPRINT Section 8:
 * - Commits data/boards/ snapshots for the next 30 days.
 * - Ensures precomputed offline availability.
 */

import * as fs from 'fs';
import * as path from 'path';
import { civilFromDays, daysFromCivil, formatDateString } from '../src/core/calendar';
import { generateDaily } from '../src/core/generate';

export function generateBoardSnapshots(daysCount = 30, targetDir?: string): void {
  const outDir = targetDir ?? path.resolve(process.cwd(), 'data/boards');
  fs.mkdirSync(outDir, { recursive: true });

  const today = new Date();
  const startDays = daysFromCivil(today.getFullYear(), today.getMonth() + 1, today.getDate());

  for (let i = 0; i < daysCount; i++) {
    const [y, m, d] = civilFromDays(startDays + i);
    const dateStr = formatDateString(y, m, d);
    const result = generateDaily(dateStr);

    const filePath = path.join(outDir, `${dateStr}.json`);
    fs.writeFileSync(filePath, JSON.stringify(result, null, 2), 'utf8');
  }

  console.log(`[gen-boards] Generated ${daysCount} board snapshots into ${outDir}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const count = parseInt(process.argv[2] ?? '30', 10);
  generateBoardSnapshots(count);
}
