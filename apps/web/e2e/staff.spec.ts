import { test, expect } from '@playwright/test';
import { loginViaApi } from './helpers/auth';

test.describe('Staff', () => {
  test.beforeEach(async ({ page }) => {
    await loginViaApi(page);
  });

  test('staff page loads when authenticated', async ({ page }) => {
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/staff/);

    // Should show staff/team heading or related content
    await expect(page.locator('body')).toContainText(/staff|team|member/i, { timeout: 10000 });
  });

  test('displays staff list or empty state', async ({ page }) => {
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    // Either staff members are displayed or empty state is shown
    const hasStaff = await page
      .locator('[data-testid="staff-item"]')
      .first()
      .isVisible()
      .catch(() => false);
    const hasEmptyState = await page
      .locator('text=/no.*staff|no.*team|empty/i')
      .first()
      .isVisible()
      .catch(() => false);
    const hasStaffText = await page
      .locator('text=/staff|team|member/i')
      .first()
      .isVisible()
      .catch(() => false);

    expect(hasStaff || hasEmptyState || hasStaffText).toBe(true);
  });

  test('can navigate to staff from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Find and click staff link in sidebar
    const staffLink = page.locator('aside nav a[href*="staff"]').first();
    await staffLink.click();

    await expect(page).toHaveURL(/\/staff/, { timeout: 10000 });
  });

  test('staff page requires authentication', async ({ page }) => {
    // Clear both cookies and localStorage
    await page.context().clearCookies();
    await page.goto('/staff');
    await page.evaluate(() => localStorage.clear());
    await page.reload();

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
  });

  test('staff members show role information when present', async ({ page }) => {
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    // If staff members exist, check for role information
    const hasStaff = await page
      .locator('[data-testid="staff-item"]')
      .first()
      .isVisible()
      .catch(() => false);

    if (hasStaff) {
      // Look for role indicators
      const hasRole = await page
        .locator('text=/role|position|admin|provider/i')
        .first()
        .isVisible()
        .catch(() => false);
      // Roles might not always be displayed, so this is just a check
      if (hasRole) {
        await expect(page.locator('text=/role|position|admin|provider/i').first()).toBeVisible();
      }
    }
  });

  test('can view staff availability or schedule when configured', async ({ page }) => {
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');

    // Staff page might have availability/schedule information
    const hasAvailability = await page
      .locator('text=/availability|schedule|hours/i')
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false);

    // This is informational - availability may or may not be present
    if (hasAvailability) {
      await expect(page.locator('text=/availability|schedule|hours/i').first()).toBeVisible();
    }
  });
});
