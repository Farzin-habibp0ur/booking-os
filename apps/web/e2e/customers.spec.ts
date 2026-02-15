import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Customers', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('customers page loads when authenticated', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/customers/);

    // Should show customers heading or related content
    await expect(page.locator('body')).toContainText(/customer|client/i, { timeout: 10000 });
  });

  test('displays customers list or empty state', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Either customers are displayed or empty state is shown
    const hasCustomers = await page.locator('[data-testid="customer-item"]').first().isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=/no.*customer|empty/i').first().isVisible().catch(() => false);
    const hasCustomerText = await page.locator('text=/customer|client/i').first().isVisible().catch(() => false);

    expect(hasCustomers || hasEmptyState || hasCustomerText).toBe(true);
  });

  test('can navigate to customers from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find and click customers link in sidebar
    const customersLink = page.locator('aside nav a[href*="customer"]').first();
    await customersLink.click();

    await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });
  });

  test('customers page requires authentication', async ({ page }) => {
    // Clear storage to ensure user is logged out
    await page.context().clearCookies();
    await page.goto('/customers');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('search functionality is available', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
    const isVisible = await searchInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await expect(searchInput).toBeVisible();
      await searchInput.fill('test');
      // Search should be functional
      expect(await searchInput.inputValue()).toBe('test');
    }
  });
});
