/**
 * Daily quality gate audit tool.
 *
 * BLUEPRINT Section 4, 8, 12:
 * - Runs generator & solver quality gates across the next N days.
 * - Asserts < 2% degraded boards.
 * - Used in weekly CI audit workflow and by the /audit-daily command.
 */

import { civilFromDays, daysFromCivil, formatDateString } from '../src/core/calendar';
import { generateDaily } from '../src/core/generate';

export interface AuditResult {
  totalDays: number;
  degradedCount: number;
  degradedRate: number; // percentage
  degradedDays: { dateStr: string; dayNumber: number }[];
  pass: boolean;
}

export function auditDaily(daysCount = 60, startOffsetDays = 0): AuditResult {
  const today = new Date();
  const startDays = daysFromCivil(today.getFullYear(), today.getMonth() + 1, today.getDate()) + startOffsetDays;

  let degradedCount = 0;
  const degradedDays: { dateStr: string; dayNumber: number }[] = [];

  for (let i = 0; i < daysCount; i++) {
    const [y, m, d] = civilFromDays(startDays + i);
    const dateStr = formatDateString(y, m, d);
    const res = generateDaily(dateStr);

    if (res.degraded) {
      degradedCount++;
      degradedDays.push({ dateStr, dayNumber: res.dayNumber });
    }
  }

  const degradedRate = (degradedCount * 100) / daysCount;
  const pass = degradedRate < 2.0;

  return {
    totalDays: daysCount,
    degradedCount,
    degradedRate,
    degradedDays,
    pass,
  };
}

export function runAuditCli(): void {
  const daysArg = parseInt(process.argv[2] ?? '60', 10);
  const count = Number.isNaN(daysArg) ? 60 : daysArg;

  console.log(`[audit-daily] Initiating quality gate audit for next ${count} days...`);
  const result = auditDaily(count);

  console.log('--- AUDIT TELEMETRY SUMMARY ---');
  console.log(`Audited: ${result.totalDays} days`);
  console.log(`Degraded Count: ${result.degradedCount}`);
  console.log(`Degraded Rate: ${result.degradedRate.toFixed(2)}% (Target: < 2.0%)`);

  if (result.degradedDays.length > 0) {
    console.log('Degraded sectors:');
    for (const d of result.degradedDays) {
      console.log(`  - #${d.dayNumber} [${d.dateStr}]`);
    }
  }

  if (result.pass) {
    console.log('[audit-daily] SUCCESS: All quality gates within acceptable thresholds.');
    process.exit(0);
  } else {
    console.error(`[audit-daily] FAILURE: Degraded rate ${result.degradedRate.toFixed(2)}% exceeds 2% budget!`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAuditCli();
}
