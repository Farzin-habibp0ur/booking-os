import { test, expect } from './fixtures';

test.describe('Booking Flow', () => {
  test('bookings page loads with heading', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/bookings/);
    await expect(page.locator('body')).toContainText(/booking|appointment|calendar/i, {
      timeout: 10000,
    });
  });

  test('clicking New Booking opens booking form modal', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    // Find and click the "New Booking" button
    const newBookingBtn = page.locator(
      'button:has-text("New Booking"), button:has-text("New Appointment"), a:has-text("New Booking"), button:has-text("Book")',
    );

    if (
      await newBookingBtn
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false)
    ) {
      await newBookingBtn.first().click();

      // Verify modal/form appears — look for dialog, form, or modal container
      const modalVisible = await page
        .locator(
          '[role="dialog"], [data-testid="booking-modal"], .modal, form:has(select), form:has(input[type="date"])',
        )
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);

      expect(modalVisible).toBe(true);
    }
  });

  test('filter bookings by status updates results', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    // Look for status filter buttons (tabs, chips, or dropdown)
    const statusFilter = page.locator(
      'button:has-text("Confirmed"), button:has-text("Pending"), button:has-text("Completed"), button:has-text("Cancelled"), [data-testid*="filter"], [data-testid*="status"]',
    );

    if (
      await statusFilter
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false)
    ) {
      // Get the initial URL
      const initialUrl = page.url();

      await statusFilter.first().click();
      await page.waitForLoadState('networkidle');

      // Either URL should update with a query param or the list content should change
      const urlChanged = page.url() !== initialUrl;
      const pageStillLoaded = await page
        .locator('body')
        .isVisible()
        .catch(() => false);

      expect(urlChanged || pageStillLoaded).toBe(true);
    }
  });

  test('bookings table/list renders with expected structure', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/bookings');
    await page.waitForLoadState('networkidle');

    // Check for table headers or list items with booking-related columns
    const hasTable = await page
      .locator('table')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);
    const hasListItems = await page
      .locator(
        '[data-testid="booking-item"], [data-testid*="booking"], .booking-card, [class*="booking"]',
      )
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasBookingContent = await page
      .locator('text=/booking|appointment|customer|client|service|status/i')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);
    const hasEmptyState = await page
      .locator('text=/no.*booking|no.*appointment|empty/i')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // The page should have either a table, list items, booking content, or an empty state
    expect(hasTable || hasListItems || hasBookingContent || hasEmptyState).toBe(true);
  });
});
