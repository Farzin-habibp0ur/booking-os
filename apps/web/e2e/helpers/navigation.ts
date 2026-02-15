import { Page } from '@playwright/test';

/**
 * Navigation helpers for common page navigation patterns
 */

export async function navigateToPage(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState('networkidle');
}

export async function clickSidebarLink(page: Page, href: string) {
  const link = page.locator(`aside nav a[href*="${href}"]`).first();
  await link.click();
  await page.waitForLoadState('networkidle');
}

export async function waitForDashboard(page: Page) {
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

export async function logout(page: Page) {
  const logoutButton = page.getByRole('button', { name: /log.?out/i });
  await logoutButton.click();
  await page.waitForURL(/\/login/, { timeout: 10000 });
}

/**
 * Check if a page requires authentication by attempting to access it
 * without being logged in
 */
export async function verifyRequiresAuth(page: Page, path: string) {
  await page.context().clearCookies();
  await page.goto(path);
  await page.waitForURL(/\/login/, { timeout: 10000 });
}
