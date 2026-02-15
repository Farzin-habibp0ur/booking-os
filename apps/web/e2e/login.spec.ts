import { test, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

test.describe('Login', () => {
  test('login page loads with email and password fields', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('textbox', { name: /email/i })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /password/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /sign.in/i })).toBeVisible();
  });

  test('login with valid credentials redirects to dashboard', async ({ page }) => {
    await loginViaUi(page, 'sarah@glowclinic.com', 'password123');

    await expect(page).toHaveURL(/\/dashboard/);
    // Dashboard should render content indicating we are logged in
    await expect(page.locator('aside nav')).toBeVisible({ timeout: 10000 });
  });

  test('login with invalid credentials shows an error', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('textbox', { name: /email/i }).fill('wrong@test.com');
    await page.getByRole('textbox', { name: /password/i }).fill('wrongpassword');
    await page.getByRole('button', { name: /sign.in/i }).click();

    // Should stay on the login page
    await expect(page).toHaveURL(/\/login/);

    // Error message should be visible (red error div)
    await expect(page.locator('.bg-red-50')).toBeVisible({ timeout: 5000 });
  });

  test('logout returns to login page', async ({ page }) => {
    // Log in first
    await loginViaUi(page, 'sarah@glowclinic.com', 'password123');
    await expect(page).toHaveURL(/\/dashboard/);

    // Find and click the logout button in the sidebar
    const logoutButton = page.getByRole('button', { name: /log.?out/i });
    await logoutButton.click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });
  });
});
