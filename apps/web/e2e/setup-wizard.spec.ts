import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('setup wizard loads with step indicator', async ({ page }) => {
    await page.goto('/setup');

    await expect(page).toHaveURL(/\/setup/);

    // The setup wizard shows a title and step progress.
    // The first step is "Business Info" (step 1 of 9).
    await expect(page.locator('text=/setup/i').first()).toBeVisible({ timeout: 15000 });

    // Step indicator should show "1 of 9" or similar
    await expect(page.locator('text=/step.*1/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('navigating forward with Next button advances to step 2', async ({ page }) => {
    await page.goto('/setup');

    // Wait for the first step content to load
    await expect(page.locator('input').first()).toBeVisible({ timeout: 15000 });

    // Click Next
    const nextButton = page.getByRole('button', { name: /next/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Step 2 is WhatsApp -- look for "WhatsApp" text
    await expect(page.locator('text=/whatsapp/i').first()).toBeVisible({ timeout: 5000 });
  });

  test('Back button returns to previous step', async ({ page }) => {
    await page.goto('/setup');

    // Wait for first step
    await expect(page.locator('input').first()).toBeVisible({ timeout: 15000 });

    // Go to step 2
    await page.getByRole('button', { name: /next/i }).click();
    await expect(page.locator('text=/whatsapp/i').first()).toBeVisible({ timeout: 5000 });

    // Go back
    await page.getByRole('button', { name: /back/i }).click();

    // Should be back on step 1 (business info with input fields)
    await expect(page.locator('input').first()).toBeVisible({ timeout: 5000 });
  });

  test('can navigate through all steps to reach the finish step', async ({ page }) => {
    await page.goto('/setup');

    // Wait for loading to complete
    await expect(page.locator('input').first()).toBeVisible({ timeout: 15000 });

    // There are 9 steps (indices 0-8). We need to click Next 8 times to reach the finish step.
    // Steps: business(0), whatsapp(1), staff(2), services(3), hours(4), templates(5), profile(6), customers(7), finish(8)
    for (let i = 0; i < 8; i++) {
      const nextButton = page.getByRole('button', { name: /next/i });
      // The last step won't have a Next button, it will have a Finish button
      if (await nextButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nextButton.click();
        // Wait a moment for step transition
        await page.waitForTimeout(500);
      }
    }

    // On the finish step, we should see summary stats and a "Go to Dashboard" button
    await expect(page.locator('text=/dashboard/i').first()).toBeVisible({ timeout: 10000 });
  });
});
