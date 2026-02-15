import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('shows login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign.in/i })).toBeVisible();
  });

  test('redirects to dashboard on successful login', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('sarah@glowclinic.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    await page.getByRole('button', { name: /sign.in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('wrong@test.com');
    await page.getByRole('textbox', { name: /password/i }).fill('wrong');
    await page.getByRole('button', { name: /sign.in/i }).click();
    // Error message should appear (stays on login page)
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated user is redirected to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });
});
