/**
 * Ingests external spaceflight feeds with offline fallbacks.
 *
 * BLUEPRINT Section 8:
 * - Wikimedia "On this day" REST feed, filtered by spaceflight keywords.
 * - NASA open APOD data (title, url, date; skip copyrighted images).
 * - Space Devs Launch Library 2 for a "next launch" card.
 * - Hard rule: zero paid services. Every external API is optional with a fallback.
 *   The game must run with data/ missing.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ApodFeedItem {
  date: string;
  title: string;
  url: string;
  explanation?: string;
}

export interface LaunchFeedItem {
  id: string;
  name: string;
  status: string;
  net: string; // launch window
  provider: string;
  pad: string;
}

export interface SpaceflightEventItem {
  year: number;
  text: string;
}

const FALLBACK_APOD: ApodFeedItem = {
  date: '2026-11-17',
  title: 'Orbital Debris Tracking Field // LEO Sector',
  url: 'https://images.nasa.gov',
  explanation: 'Ground-based radar tracking radar cross-sections in low Earth orbit.',
};

const FALLBACK_LAUNCH: LaunchFeedItem = {
  id: 'fl-launch-01',
  name: 'Falcon 9 Block 5 · Starlink Group',
  status: 'Go for Launch',
  net: '2026-11-18T00:00:00Z',
  provider: 'SpaceX',
  pad: 'SLC-40, Cape Canaveral',
};

const FALLBACK_HISTORY: SpaceflightEventItem[] = [
  {
    year: 1970,
    text: 'Lunokhod 1, the first roving remote-controlled robot lander, touched down on the Moon.',
  },
  {
    year: 1969,
    text: 'Apollo 12 astronauts Charles Conrad and Alan Bean perform lunar orbital insertion.',
  },
  {
    year: 1998,
    text: 'Zarya, the first functional control module of the International Space Station, prepared for launch.',
  },
];

export async function fetchApod(apiKey?: string): Promise<ApodFeedItem> {
  const key = apiKey || 'DEMO_KEY';
  const url = `https://api.nasa.gov/planetary/apod?api_key=${key}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`NASA APOD returned ${res.status}`);
    const data = (await res.json()) as Partial<ApodFeedItem> & { copyright?: string };

    // Skip copyrighted items per spec
    if (data.copyright) {
      return FALLBACK_APOD;
    }

    return {
      date: data.date ?? FALLBACK_APOD.date,
      title: data.title ?? FALLBACK_APOD.title,
      url: data.url ?? FALLBACK_APOD.url,
      explanation: data.explanation?.slice(0, 200),
    };
  } catch (err) {
    console.warn('[fetch-feeds] NASA APOD unreachable; using offline fallback.', (err as Error).message);
    return FALLBACK_APOD;
  }
}

export async function fetchNextLaunch(): Promise<LaunchFeedItem> {
  const url = 'https://lldev.thespacedevs.com/2.2.0/launch/upcoming/?limit=1';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Launch Library returned ${res.status}`);
    const data = (await res.json()) as { results?: Array<{ id: string; name: string; status?: { name: string }; net: string; launch_service_provider?: { name: string }; pad?: { name: string } }> };
    const first = data.results?.[0];

    if (!first) return FALLBACK_LAUNCH;

    return {
      id: first.id,
      name: first.name,
      status: first.status?.name ?? 'Scheduled',
      net: first.net,
      provider: first.launch_service_provider?.name ?? 'Unknown',
      pad: first.pad?.name ?? 'Orbital Launch Complex',
    };
  } catch (err) {
    console.warn('[fetch-feeds] Launch Library unreachable; using offline fallback.', (err as Error).message);
    return FALLBACK_LAUNCH;
  }
}

export async function fetchSpaceflightHistory(): Promise<SpaceflightEventItem[]> {
  const today = new Date();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const url = `https://en.wikipedia.org/api/rest_v1/feed/onthisday/selected/${mm}/${dd}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Wikipedia API returned ${res.status}`);
    const data = (await res.json()) as { selected?: Array<{ year: number; text: string }> };

    // Filter by spaceflight keywords
    const spaceKeywords = ['space', 'satellite', 'orbit', 'nasa', 'apollo', 'cosmonaut', 'astronaut', 'moon', 'rocket', 'launch', 'shuttle', 'station'];
    const filtered = (data.selected ?? []).filter((item) => {
      const lower = item.text.toLowerCase();
      return spaceKeywords.some((kw) => lower.includes(kw));
    });

    if (filtered.length === 0) return FALLBACK_HISTORY;

    return filtered.slice(0, 5).map((f) => ({
      year: f.year,
      text: f.text,
    }));
  } catch (err) {
    console.warn('[fetch-feeds] Wikimedia unreachable; using offline fallback.', (err as Error).message);
    return FALLBACK_HISTORY;
  }
}

export async function runFeedIngestion(targetDir?: string): Promise<void> {
  const outDir = targetDir ?? path.resolve(process.cwd(), 'data/feeds');
  fs.mkdirSync(outDir, { recursive: true });

  const apod = await fetchApod(process.env.NASA_API_KEY);
  fs.writeFileSync(path.join(outDir, 'apod.json'), JSON.stringify(apod, null, 2), 'utf8');

  const launch = await fetchNextLaunch();
  fs.writeFileSync(path.join(outDir, 'launches.json'), JSON.stringify(launch, null, 2), 'utf8');

  const history = await fetchSpaceflightHistory();
  fs.writeFileSync(path.join(outDir, 'history.json'), JSON.stringify(history, null, 2), 'utf8');

  console.log(`[fetch-feeds] Successfully refreshed feeds in ${outDir}`);
}

// Direct execution entrypoint
if (import.meta.url === `file://${process.argv[1]}`) {
  void runFeedIngestion();
}
