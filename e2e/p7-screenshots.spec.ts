import { test } from '@playwright/test';
import path from 'node:path';

const ARTIFACT_DIR = '/Users/arnavvenkatesh/.gemini/antigravity/brain/5a94f484-8176-4eab-8dae-6dcda20edf9f';

test.describe('P7 Orbits Campaign and Bodies Screenshots', () => {
  test('captures mobile 390x844 screenshot of Orbit Map modal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.waitForSelector('#stage-canvas');

    // Open Orbits Map
    await page.click('#btn-orbits');
    await page.waitForSelector('#modal-container .modal-box');
    await page.waitForTimeout(300);

    const outPath = path.join(ARTIFACT_DIR, 'screenshot-p7-390x844.png');
    await page.screenshot({ path: outPath });
  });

  test('captures desktop 1280x720 screenshot of Campaign Level Gameplay with Phase 2/3 bodies', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    // Seed campaign progress to level 60 so all orbits and levels can be viewed
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'kessler:campaign',
        JSON.stringify({
          unlockedLevel: 60,
          levels: {
            1: { completed: true, score: 2040, medal: 'gold', unlockedHintTier: 1 },
            2: { completed: true, score: 1850, medal: 'silver', unlockedHintTier: 0 },
            3: { completed: true, score: 1400, medal: 'bronze', unlockedHintTier: 0 },
          },
        }),
      );
    });

    await page.goto('/');
    await page.waitForSelector('#stage-canvas');

    // Open Orbits Map and launch Orbit 6 level (Wormholes, Lances, Fuses, Plated)
    await page.click('#btn-orbits');
    await page.waitForSelector('.orbit-tab');

    // Click Orbit 6 tab
    await page.click('.orbit-tab[data-orbit="6"]');
    await page.waitForTimeout(200);

    // Click Level 52 (Wormhole level)
    await page.click('.level-node-btn[data-level="52"]');
    await page.waitForTimeout(200);

    // Launch level
    await page.click('#btn-launch-level');
    await page.waitForTimeout(400);

    // Hover or interact with board to show ray preview through wormhole/lance
    await page.mouse.move(500, 360);
    await page.waitForTimeout(200);

    const outPath = path.join(ARTIFACT_DIR, 'screenshot-p7-1280x720.png');
    await page.screenshot({ path: outPath });
  });
});
