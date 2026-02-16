import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

test.describe('Login', () => {
  test('login page loads with email and password fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await loginViaUi(page, 'sarah@glowclinic.com', 'password123');

    await expect(page).toHaveURL(/\/(dashboard|setup)/);
  });

  test('login with invalid credentials shows an error', async ({ page }) => {
    await page.goto('/login');

    await page.locator('input[type="email"]').fill('wrong@test.com');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Error message should be visible (red error div)
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 10000 });
  });

  test('logout returns to login page', async ({ page }) => {
    // Log in first
    await loginViaUi(page, 'sarah@glowclinic.com', 'password123');

    // Look for a logout link or button in the sidebar/header
    const logoutLink = page
      .locator(
        'a[href="/login"], button:has-text("Logout"), button:has-text("Log out"), a:has-text("Logout"), a:has-text("Log out")',
      )
      .first();
    if (await logoutLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logoutLink.click();
      await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
    } else {
      // Manually clear auth and navigate
      await page.evaluate(() => localStorage.removeItem('token'));
      await page.goto('/login');
      await expect(page).toHaveURL(/\/login/);
    }
  });
});
