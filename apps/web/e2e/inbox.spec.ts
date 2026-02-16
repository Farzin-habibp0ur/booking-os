import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Inbox', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('inbox page loads when authenticated', async ({ page }) => {
    await page.goto('/inbox');

    await expect(page).toHaveURL(/\/inbox/);

    // The inbox page has a filter sidebar with "Inbox" heading and a conversation list panel
    // Wait for the page to finish loading and rendering
    await expect(page.locator('text=Inbox').first()).toBeVisible({ timeout: 15000 });
  });

  test('conversation list displays', async ({ page }) => {
    await page.goto('/inbox');

    // Wait for the conversation list area to be rendered.
    // The conversation list is a w-80 border-r panel. Conversations or the "no conversations"
    // empty state should appear.
    await page.waitForTimeout(3000);

    // Either conversations are listed (border-b cursor-pointer items) or the empty state shows
    const hasConversations = await page
      .locator('.cursor-pointer.border-b')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .locator('text=/no.*conversation/i')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasConversations || hasEmptyState).toBe(true);
  });

  test('clicking a conversation shows messages', async ({ page }) => {
    await page.goto('/inbox');

    // Wait for conversation items to load
    const conversationItem = page.locator('.cursor-pointer.border-b').first();
    const isVisible = await conversationItem.isVisible({ timeout: 10000 }).catch(() => false);

    if (isVisible) {
      await conversationItem.click();

      // After clicking, the message thread area should appear with the customer name
      // and a message composer (textarea with placeholder)
      await expect(page.locator('textarea').first()).toBeVisible({ timeout: 10000 });
    } else {
      // No conversations in the system -- skip gracefully
      test.skip();
    }
  });
});
