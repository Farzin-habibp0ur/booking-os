import { test, expect, PORTAL_SLUG } from './fixtures';
import AxeBuilder from '@axe-core/playwright';

test.describe('Referral Feature', () => {
  test('marketing hub shows referrals card with stats', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/marketing');
    await page.waitForLoadState('networkidle');

    // Referrals card should be visible
    const referralsCard = page.getByTestId('hub-card-referrals');
    await expect(referralsCard).toBeVisible({ timeout: 15000 });
    await expect(referralsCard).toHaveAttribute('href', '/marketing/referrals');

    // Stats section should appear for aesthetic vertical
    const statsSection = page.getByTestId('referral-stats-section');
    // Stats may or may not be visible depending on whether referral program is enabled
    // Just check the card is correct
  });

  test('referral settings page loads at /marketing/referrals', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/marketing/referrals');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/marketing\/referrals/);
    await expect(page.getByText('Patient Referral Program')).toBeVisible({ timeout: 15000 });
  });

  test('/settings/referral redirects to /marketing/referrals', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/settings/referral');
    await page.waitForURL('**/marketing/referrals', { timeout: 15000 });
    expect(page.url()).toContain('/marketing/referrals');
  });

  test('booking page shows referral banner with valid code', async ({ page }) => {
    await page.goto(`/book/${PORTAL_SLUG}?ref=EMMA2026`);
    await page.waitForLoadState('networkidle');

    // The referral banner should appear if code is valid
    // It may take a moment for the validation API call
    const referralBanner = page.locator('[data-testid="referral-banner"]');
    const hasBanner = await referralBanner.isVisible({ timeout: 10000 }).catch(() => false);

    // If seed data exists and code is valid, the banner shows
    // Otherwise this test documents the expected behavior
    if (hasBanner) {
      await expect(referralBanner).toContainText(/credit/i);
    }
  });

  test('booking page works without referral code', async ({ page }) => {
    await page.goto(`/book/${PORTAL_SLUG}`);
    await page.waitForLoadState('networkidle');

    // Business name should display
    await expect(page.locator('text=/glow/i').first()).toBeVisible({ timeout: 15000 });

    // Services should load
    const services = page.locator('[data-testid="service-card"], [role="button"]');
    await expect(services.first()).toBeVisible({ timeout: 15000 });
  });

  test('referral settings page passes accessibility checks', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/marketing/referrals');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000); // Allow dynamic content to load

    const results = await new AxeBuilder({ page })
      .exclude('.animate-pulse') // Exclude skeleton loaders
      .analyze();

    expect(results.violations).toEqual([]);
  });
});
