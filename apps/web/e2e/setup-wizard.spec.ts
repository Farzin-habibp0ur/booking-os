import { test, expect } from '@playwright/test';

test.describe('Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.getByRole('textbox', { name: /email/i }).fill('sarah@glowclinic.com');
    await page.getByRole('textbox', { name: /password/i }).fill('password123');
    await page.getByRole('button', { name: /sign.in/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('loads setup page with all steps', async ({ page }) => {
    await page.goto('/setup');
    await expect(page).toHaveURL(/\/setup/);

    // Should show the business info step (step 1)
    await expect(page.getByText(/business/i).first()).toBeVisible({ timeout: 10000 });
  });

  test('can navigate through steps using next button', async ({ page }) => {
    await page.goto('/setup');

    // Step 1: Business Info
    await expect(page.getByText(/business/i).first()).toBeVisible({ timeout: 10000 });

    // Click Next to go to step 2
    const nextButton = page.getByRole('button', { name: /next/i });
    await nextButton.click();

    // Step 2: WhatsApp
    await expect(page.getByText(/whatsapp/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('can go back to previous step', async ({ page }) => {
    await page.goto('/setup');

    // Go forward
    const nextButton = page.getByRole('button', { name: /next/i });
    await nextButton.click();

    // Go back
    const backButton = page.getByRole('button', { name: /back/i });
    await backButton.click();

    // Should be back on step 1
    await expect(page.locator('input[placeholder]').first()).toBeVisible();
  });
});
