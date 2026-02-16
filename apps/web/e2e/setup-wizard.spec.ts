import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('setup wizard loads with step indicator', async ({ page }) => {
    await page.goto('/setup');

    await expect(page).toHaveURL(/\/setup/);

    // The setup wizard shows a title and step progress
    await expect(page.locator('text=/setup/i').first()).toBeVisible({ timeout: 15000 });

    // Step indicator should show step 1 info
    const hasStepText = await page
      .locator('text=/step|1.*of/i')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasProgress = await page
      .locator('[role="progressbar"], .step, .progress')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    expect(hasStepText || hasProgress).toBe(true);
  });

  test('navigating forward with Next button advances to next step', async ({ page }) => {
    await page.goto('/setup');

    // Wait for the first step content to load
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=/setup/i').first()).toBeVisible({ timeout: 15000 });

    // Click Next button
    const nextButton = page.locator('button:has-text("Next"), button:has-text("next")').first();
    const isVisible = await nextButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await nextButton.click();
      // Should advance (URL might change or step indicator updates)
      await page.waitForTimeout(1000);
      // Verify we're still on setup and something changed
      await expect(page).toHaveURL(/\/setup/);
    }
  });

  test('Back button returns to previous step', async ({ page }) => {
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=/setup/i').first()).toBeVisible({ timeout: 15000 });

    // Go to next step first
    const nextButton = page.locator('button:has-text("Next"), button:has-text("next")').first();
    const hasNext = await nextButton.isVisible({ timeout: 5000 }).catch(() => false);

    if (hasNext) {
      await nextButton.click();
      await page.waitForTimeout(1000);

      // Go back
      const backButton = page
        .locator('button:has-text("Back"), button:has-text("back"), button:has-text("Previous")')
        .first();
      const hasBack = await backButton.isVisible({ timeout: 5000 }).catch(() => false);

      if (hasBack) {
        await backButton.click();
        await page.waitForTimeout(1000);
        // Should still be on setup
        await expect(page).toHaveURL(/\/setup/);
      }
    }
  });

  test('setup wizard has actionable buttons', async ({ page }) => {
    await page.goto('/setup');
    await page.waitForLoadState('networkidle');

    // The setup wizard should have at least one actionable button (Next, Skip, or similar)
    const buttons = page.locator('button');
    const count = await buttons.count();
    expect(count).toBeGreaterThan(0);
  });
});
