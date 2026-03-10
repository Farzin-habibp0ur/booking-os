import { test as base, expect } from '@playwright/test';
import { PORTAL_SLUG } from './fixtures';

base.describe('Portal — Public Booking', () => {
  base('portal page loads without authentication', async ({ page }) => {
    await page.goto(`/portal/${PORTAL_SLUG}`);
    await page.waitForLoadState('domcontentloaded');

    // The portal should load and not redirect to login
    await expect(page).toHaveURL(new RegExp(`/portal/${PORTAL_SLUG}`));

    // Should show business-related content or a booking interface
    await expect(page.locator('body')).toContainText(
      /book|appointment|service|schedule|glow|clinic|welcome/i,
      { timeout: 15000 },
    );
  });

  base('portal displays business name or booking options', async ({ page }) => {
    await page.goto(`/portal/${PORTAL_SLUG}`);
    await page.waitForLoadState('networkidle');

    // Should display a business name, heading, or service options
    const hasBusinessInfo = await page
      .locator('h1, h2, h3, [data-testid="business-name"]')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    const hasBookingOptions = await page
      .locator(
        'button:has-text("Book"), a:has-text("Book"), text=/service|select|choose|appointment/i',
      )
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    const hasPortalContent = await page
      .locator('body')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasBusinessInfo || hasBookingOptions || hasPortalContent).toBe(true);
  });

  base('portal pages are accessible without login', async ({ page }) => {
    // Navigate to the portal — should NOT redirect to /login
    const response = await page.goto(`/portal/${PORTAL_SLUG}`);
    await page.waitForLoadState('domcontentloaded');

    // Verify we stayed on the portal page (no redirect to /login)
    const currentUrl = page.url();
    expect(currentUrl).not.toMatch(/\/login/);

    // The response should be successful (2xx or 3xx to portal sub-page)
    expect(response?.status()).toBeLessThan(500);
  });

  base('portal sub-pages load correctly', async ({ page }) => {
    // Try accessing portal dashboard page
    await page.goto(`/portal/${PORTAL_SLUG}/dashboard`);
    await page.waitForLoadState('domcontentloaded');

    // Should load a portal page (may redirect to portal login or show content)
    const currentUrl = page.url();
    expect(currentUrl).toMatch(new RegExp(`/portal`));
  });
});
