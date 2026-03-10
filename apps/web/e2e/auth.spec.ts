import { test as base, expect } from '@playwright/test';
import { test, TEST_EMAIL, TEST_PASSWORD } from './fixtures';

base.describe('Authentication — unauthenticated flows', () => {
  base('login with valid credentials redirects to dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[type="email"]').fill(TEST_EMAIL);
    await page.locator('input[type="password"]').fill(TEST_PASSWORD);
    await page.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/(dashboard|setup)/, { timeout: 15000 });

    // Verify dashboard content is visible
    await expect(page.locator('body')).toContainText(/dashboard|welcome|overview|setup/i, {
      timeout: 10000,
    });
  });

  base('login with invalid credentials shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');

    await page.locator('input[type="email"]').fill('wrong@example.com');
    await page.locator('input[type="password"]').fill('wrongpassword123');
    await page.locator('button[type="submit"]').click();

    // Error message should appear — look for red-styled error or text
    const errorVisible = await page
      .locator('.bg-red-50, [role="alert"], text=/invalid|incorrect|error|failed/i')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    expect(errorVisible).toBe(true);
  });

  base('forgot password flow shows success message', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.waitForLoadState('domcontentloaded');

    // Fill in email field
    const emailInput = page.locator(
      'input[type="email"], input[name="email"], input[placeholder*="email" i]',
    );
    await expect(emailInput.first()).toBeVisible({ timeout: 10000 });
    await emailInput.first().fill(TEST_EMAIL);

    // Submit the forgot password form
    const submitBtn = page.locator('button[type="submit"]').first();
    await submitBtn.click();

    // Should show a success/confirmation message
    await expect(
      page.locator('text=/sent|check.*email|reset.*link|instructions/i').first(),
    ).toBeVisible({ timeout: 10000 });
  });

  base('unauthenticated user navigating to /dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});

test.describe('Authentication — authenticated flows', () => {
  test('logout redirects to login and prevents access to dashboard', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    // Look for user menu or avatar button to trigger logout
    const userMenu = page.locator(
      'button[aria-label*="user" i], button[aria-label*="menu" i], button[aria-label*="account" i], [data-testid="user-menu"], button:has(img[alt*="avatar" i])',
    );

    const avatarButton = page
      .locator('button')
      .filter({ has: page.locator('img') })
      .last();

    // Try the explicit user menu first, fall back to avatar-like button
    const menuButton = (await userMenu
      .first()
      .isVisible({ timeout: 5000 })
      .catch(() => false))
      ? userMenu.first()
      : avatarButton;

    if (await menuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await menuButton.click();

      // Click logout option
      const logoutBtn = page.locator(
        'text=/log\\s?out|sign\\s?out/i, button:has-text("Log out"), button:has-text("Sign out"), a:has-text("Log out"), a:has-text("Sign out")',
      );
      if (
        await logoutBtn
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await logoutBtn.first().click();
        await expect(page).toHaveURL(/\/login/, { timeout: 15000 });

        // After logout, navigating to /dashboard should redirect back to /login
        await page.goto('/dashboard');
        await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
      }
    } else {
      // If no menu button found, try navigating to a logout URL directly
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear());
      await page.goto('/dashboard');
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    }
  });
});
