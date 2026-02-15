import { Page, expect } from '@playwright/test';

/**
 * Common assertion helpers for E2E tests
 */

/**
 * Assert that a page displays either data items or an empty state
 */
export async function assertDataOrEmptyState(
  page: Page,
  itemSelector: string,
  emptyStatePattern: RegExp,
  fallbackTextPattern?: RegExp,
) {
  const hasItems = await page.locator(itemSelector)
    .first()
    .isVisible()
    .catch(() => false);

  const hasEmptyState = await page.locator(`text=${emptyStatePattern}`)
    .first()
    .isVisible()
    .catch(() => false);

  const hasFallbackText = fallbackTextPattern
    ? await page.locator(`text=${fallbackTextPattern}`)
        .first()
        .isVisible()
        .catch(() => false)
    : false;

  expect(hasItems || hasEmptyState || hasFallbackText).toBe(true);
}

/**
 * Assert that sidebar navigation is visible and functional
 */
export async function assertSidebarVisible(page: Page) {
  const sidebar = page.locator('aside nav');
  await expect(sidebar).toBeVisible({ timeout: 10000 });
}

/**
 * Assert that a page has loaded successfully with expected content
 */
export async function assertPageLoaded(
  page: Page,
  urlPattern: RegExp,
  contentPattern: RegExp,
) {
  await expect(page).toHaveURL(urlPattern);
  await expect(page.locator('body')).toContainText(contentPattern, { timeout: 10000 });
}

/**
 * Check if an element exists without throwing an error
 */
export async function elementExists(page: Page, selector: string): Promise<boolean> {
  return page.locator(selector).first().isVisible().catch(() => false);
}

/**
 * Wait for any navigation to complete
 */
export async function waitForNavigation(page: Page) {
  await page.waitForLoadState('networkidle');
}
