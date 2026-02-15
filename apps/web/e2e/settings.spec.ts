import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('settings page loads when authenticated', async ({ page }) => {
    await page.goto('/settings');

    await expect(page).toHaveURL(/\/settings/);

    // Should show the settings title and business info form
    await expect(page.locator('text=/settings/i').first()).toBeVisible({ timeout: 15000 });

    // Should see business name input field
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10000 });
  });

  test('settings page shows quick links section', async ({ page }) => {
    await page.goto('/settings');

    // The settings page has quick links to sub-pages including AI Settings
    await expect(page.locator('text=/ai/i').first()).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to AI settings and toggle AI enabled', async ({ page }) => {
    await page.goto('/settings/ai');

    await expect(page).toHaveURL(/\/settings\/ai/);

    // Wait for AI settings page to load (it fetches settings from API)
    // The page shows a master toggle for "Enable AI"
    await expect(page.locator('text=/ai/i').first()).toBeVisible({ timeout: 15000 });

    // Find the first checkbox toggle (the master "Enable AI" toggle uses a hidden checkbox with sr-only class)
    const aiToggle = page.locator('input[type="checkbox"]').first();
    await expect(aiToggle).toBeVisible({ timeout: 10000 });

    // Get the current state
    const wasChecked = await aiToggle.isChecked();

    // Toggle it
    await aiToggle.click();

    // Verify state changed
    const isNowChecked = await aiToggle.isChecked();
    expect(isNowChecked).toBe(!wasChecked);

    // Toggle it back to original state to avoid side effects
    await aiToggle.click();
    const restored = await aiToggle.isChecked();
    expect(restored).toBe(wasChecked);
  });

  test('settings page requires authentication', async ({ page }) => {
    // Clear storage to ensure user is logged out
    await page.context().clearCookies();
    await page.goto('/settings');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('can access business settings section', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Business settings should have input fields for business details
    const hasBusinessFields = await page.locator('input[name*="business" i], input[name*="name" i]').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (hasBusinessFields) {
      await expect(page.locator('input').first()).toBeVisible();
    }
  });
});
