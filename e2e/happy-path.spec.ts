import { test, expect } from '@playwright/test';

test.describe('Daily Flow Happy Path on Phone-Sized Viewport', () => {
  test('plays today board start to finish and views debrief', async ({ page }) => {
    // 1. Load today's sector on phone viewport (390x844)
    await page.goto('/');

    // Verify title and sector status
    await expect(page.locator('.brand-title')).toContainText('KESSLER');
    await expect(page.locator('#hud-sector')).toBeVisible();
    await expect(page.locator('#hud-spark')).toBeVisible();

    // Verify canvas is mounted and sized
    const canvas = page.locator('#stage-canvas');
    await expect(canvas).toBeVisible();

    // 2. Click near the center of the canvas to detonate a spark
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Click at center
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    }

    // Fast-forward playback if needed
    const speedSkip = page.locator('#speed-skip');
    if (await speedSkip.isVisible()) {
      await speedSkip.click();
    }

    // 3. Verify Mission Debrief modal appears with grade and score
    const modalTitle = page.locator('.modal-title');
    await expect(modalTitle).toBeVisible({ timeout: 10000 });
    await expect(modalTitle).toContainText('MISSION DEBRIEF');

    const gradeBadge = page.locator('.grade-badge-title');
    await expect(gradeBadge).toBeVisible();

    // Capture debrief modal screenshot
    await page.screenshot({
      path: '/Users/arnavvenkatesh/.gemini/antigravity/brain/5a94f484-8176-4eab-8dae-6dcda20edf9f/screenshot-p5-debrief-modal.png',
    });

    // 4. Verify Perfect Line replay button works
    const perfectBtn = page.locator('#btn-perfect-line');
    await expect(perfectBtn).toBeVisible();
    await perfectBtn.click();

    // Modal should close while replaying
    await expect(modalTitle).not.toBeVisible();
  });
});
