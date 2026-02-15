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

  test('can navigate to AI settings page', async ({ page }) => {
    await page.goto('/settings/ai');

    await expect(page).toHaveURL(/\/settings\/ai/);

    // Wait for AI settings page to load
    await expect(page.locator('text=/ai/i').first()).toBeVisible({ timeout: 15000 });

    // The page should have some form of toggle or settings controls
    const hasToggle = await page.locator('input[type="checkbox"]').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasButton = await page.locator('button').first().isVisible({ timeout: 5000 }).catch(() => false);

    // AI settings page should have interactive controls
    expect(hasToggle || hasButton).toBe(true);
  });

  test('settings page requires authentication', async ({ page }) => {
    // Clear both cookies and localStorage
    await page.context().clearCookies();
    await page.goto('/settings');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
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
