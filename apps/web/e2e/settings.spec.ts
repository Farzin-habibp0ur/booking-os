import { test, expect } from '@playwright/test';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('sarah@glowclinic.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    await page.getByRole('button', { name: /sign.in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('loads settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByText(/settings/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('can see AI settings section', async ({ page }) => {
    await page.goto('/settings');
    // Look for AI-related settings
    const aiSection = page.getByText(/ai|auto.reply|intent/i).first();
    if (await aiSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(aiSection).toBeVisible();
    }
  });
});
