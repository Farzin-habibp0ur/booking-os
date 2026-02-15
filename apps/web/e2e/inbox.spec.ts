import { test, expect } from '@playwright/test';

test.describe('Inbox', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('sarah@glowclinic.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    await page.getByRole('button', { name: /sign.in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('loads inbox page', async ({ page }) => {
    await page.goto('/inbox');
    await expect(page).toHaveURL(/\/inbox/);
    // Should show conversation list
    await expect(page.locator('[data-testid="conversation-list"], .conversation-list, [class*="inbox"]').first()).toBeVisible({ timeout: 10000 });
  });

  test('can click on a conversation', async ({ page }) => {
    await page.goto('/inbox');
    // Wait for conversations to load
    const conversationItem = page.locator('[data-testid="conversation-item"], [class*="conversation"]').first();
    if (await conversationItem.isVisible({ timeout: 5000 }).catch(() => false)) {
      await conversationItem.click();
      // Should show message thread
      await expect(page.locator('[data-testid="message-thread"], [class*="message"]').first()).toBeVisible({ timeout: 5000 });
    }
  });
});
