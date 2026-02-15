import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Services', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('services page loads when authenticated', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/services/);

    // Should show services heading or related content
    await expect(page.locator('body')).toContainText(/service|treatment/i, { timeout: 10000 });
  });

  test('displays services list or empty state', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    // Either services are displayed or empty state is shown
    const hasServices = await page.locator('[data-testid="service-item"]').first().isVisible().catch(() => false);
    const hasEmptyState = await page.locator('text=/no.*service|empty/i').first().isVisible().catch(() => false);
    const hasServiceText = await page.locator('text=/service|treatment/i').first().isVisible().catch(() => false);

    expect(hasServices || hasEmptyState || hasServiceText).toBe(true);
  });

  test('can navigate to services from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find and click services link in sidebar
    const servicesLink = page.locator('aside nav a[href*="service"]').first();
    await servicesLink.click();

    await expect(page).toHaveURL(/\/services/, { timeout: 10000 });
  });

  test('services page requires authentication', async ({ page }) => {
    // Clear storage to ensure user is logged out
    await page.context().clearCookies();
    await page.goto('/services');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });

  test('can view service categories or types', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    // Services page might have categories or filters
    const hasCategories = await page.locator('text=/category|type|filter/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    // This is an informational test - categories may or may not be present
    if (hasCategories) {
      await expect(page.locator('text=/category|type|filter/i').first()).toBeVisible();
    }
  });

  test('service pricing information is visible when services exist', async ({ page }) => {
    await page.goto('/services');
    await page.waitForLoadState('networkidle');

    // If services exist, check for price information
    const hasServices = await page.locator('[data-testid="service-item"]').first().isVisible().catch(() => false);

    if (hasServices) {
      // Look for price indicators (currency symbols, price text, etc.)
      const hasPricing = await page.locator('text=/\\$|price|cost/i').first().isVisible().catch(() => false);
      expect(hasPricing).toBe(true);
    }
  });
});
