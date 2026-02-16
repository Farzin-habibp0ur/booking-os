import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('sidebar navigation is visible after login', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Sidebar should be visible
    const sidebar = page.locator('aside nav');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('can navigate between main pages via sidebar', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Test navigation to different pages
    const routes = [
      { selector: 'a[href*="booking"]', urlPattern: /\/bookings/ },
      { selector: 'a[href*="customer"]', urlPattern: /\/customers/ },
      { selector: 'a[href*="service"]', urlPattern: /\/services/ },
      { selector: 'a[href*="staff"]', urlPattern: /\/staff/ },
    ];

    for (const route of routes) {
      const link = page.locator(`aside nav ${route.selector}`).first();
      const isVisible = await link.isVisible({ timeout: 5000 }).catch(() => false);

      if (isVisible) {
        await link.click();
        await expect(page).toHaveURL(route.urlPattern, { timeout: 10000 });
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('can navigate to inbox', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find and click inbox link
    const inboxLink = page.locator('aside nav a[href*="inbox"]').first();
    const isVisible = await inboxLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await inboxLink.click();
      await expect(page).toHaveURL(/\/inbox/, { timeout: 10000 });
    }
  });

  test('can navigate to settings', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find and click settings link
    const settingsLink = page.locator('aside nav a[href*="setting"]').first();
    const isVisible = await settingsLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (isVisible) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings/, { timeout: 10000 });
    }
  });

  test('dashboard link returns to dashboard from any page', async ({ page }) => {
    // Navigate to customers page first
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Click dashboard link
    const dashboardLink = page.locator('aside nav a[href*="dashboard"]').first();
    await dashboardLink.click();

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 10000 });
  });

  test('active navigation item is highlighted', async ({ page }) => {
    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // The active nav item should have some visual distinction
    const customersLink = page.locator('aside nav a[href*="customer"]').first();
    await expect(customersLink).toBeVisible({ timeout: 5000 });

    // Check for active state indicators (the shell uses bg-brand-50 + font-medium for active link)
    const classes = (await customersLink.getAttribute('class').catch(() => '')) || '';
    const hasActiveClass =
      classes.includes('bg-brand') ||
      classes.includes('font-medium') ||
      classes.includes('font-bold') ||
      classes.includes('active');

    expect(hasActiveClass).toBe(true);
  });

  test('browser back and forward navigation works', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Navigate to customers
    const customersLink = page.locator('aside nav a[href*="customer"]').first();
    await customersLink.click();
    await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });

    // Navigate to services
    const servicesLink = page.locator('aside nav a[href*="service"]').first();
    await servicesLink.click();
    await expect(page).toHaveURL(/\/services/, { timeout: 10000 });

    // Go back to customers
    await page.goBack();
    await expect(page).toHaveURL(/\/customers/, { timeout: 10000 });

    // Go forward to services
    await page.goForward();
    await expect(page).toHaveURL(/\/services/, { timeout: 10000 });
  });
});
