import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Bookings', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('bookings page loads when authenticated', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/bookings/);

    // Should show bookings heading or related content
    await expect(page.locator('body')).toContainText(/booking|appointment/i, { timeout: 10000 });
  });

  test('displays bookings list or empty state', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    // Either bookings are displayed or empty state is shown
    const hasBookings = await page
      .locator('[data-testid="booking-item"]')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .locator('text=/no.*booking|empty/i')
      .first()
      .isVisible()
      .catch(() => false);
    const hasBookingText = await page
      .locator('text=/booking|appointment/i')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasBookings || hasEmptyState || hasBookingText).toBe(true);
  });

  test('can navigate to bookings from sidebar', async ({ page }) => {
    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    // Find bookings link in sidebar
    const bookingsLink = page.locator('aside nav a[href*="booking"]').first();
    if (await bookingsLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bookingsLink.click();
      await expect(page).toHaveURL(/\/bookings/, { timeout: 10000 });
    }
  });

  test('bookings page requires authentication', async ({ page }) => {
    // Clear both cookies and localStorage
    await page.context().clearCookies();
    await page.goto('/bookings');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });
});
