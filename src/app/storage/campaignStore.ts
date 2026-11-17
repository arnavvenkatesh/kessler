export type Medal = 'gold' | 'silver' | 'bronze' | 'none';

export interface LevelProgress {
  completed: boolean;
  score: number;
  medal: Medal;
  unlockedHintTier: number; // 0 = none, 1, 2, 3
}

export interface CampaignData {
  unlockedLevel: number; // 1 to 60
  levels: Record<number, LevelProgress>;
}

const STORAGE_KEY = 'kessler:campaign';

function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

/**
 * Loads campaign progress from localStorage with offline fallback.
 */
export function loadCampaignData(): CampaignData {
  if (!isStorageAvailable()) {
    return { unlockedLevel: 1, levels: {} };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { unlockedLevel: 1, levels: {} };
    }
    const parsed = JSON.parse(raw) as CampaignData;
    return {
      unlockedLevel: Math.max(1, parsed.unlockedLevel || 1),
      levels: parsed.levels || {},
    };
  } catch {
    return { unlockedLevel: 1, levels: {} };
  }
}

/**
 * Saves campaign progress to localStorage.
 */
export function saveCampaignData(data: CampaignData): void {
  if (!isStorageAvailable()) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Silently ignore storage quota or private-browsing errors
  }
}

/**
 * Records completion of a campaign level.
 * Unlocks the next level if completed and updates high score/medal.
 */
export function recordLevelCompletion(
  levelId: number,
  score: number,
  medal: Medal,
): { newMedal: boolean; nextUnlocked: boolean } {
  const data = loadCampaignData();
  const existing = data.levels[levelId] || {
    completed: false,
    score: 0,
    medal: 'none',
    unlockedHintTier: 0,
  };

  const medalOrder: Record<Medal, number> = {
    none: 0,
    bronze: 1,
    silver: 2,
    gold: 3,
  };

  const newMedal = medalOrder[medal] > medalOrder[existing.medal];
  const bestScore = Math.max(existing.score, score);
  const bestMedal = newMedal ? medal : existing.medal;

  data.levels[levelId] = {
    ...existing,
    completed: true,
    score: bestScore,
    medal: bestMedal,
  };

  let nextUnlocked = false;
  if (levelId === data.unlockedLevel && data.unlockedLevel < 60) {
    data.unlockedLevel++;
    nextUnlocked = true;
  }

  saveCampaignData(data);
  return { newMedal, nextUnlocked };
}

/**
 * Unlocks a hint tier for a level.
 */
export function unlockHintTier(levelId: number, tier: 1 | 2 | 3): void {
  const data = loadCampaignData();
  const existing = data.levels[levelId] || {
    completed: false,
    score: 0,
    medal: 'none',
    unlockedHintTier: 0,
  };

  if (tier > existing.unlockedHintTier) {
    data.levels[levelId] = {
      ...existing,
      unlockedHintTier: tier,
    };
    saveCampaignData(data);
  }
}
