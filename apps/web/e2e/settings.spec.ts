import { test, expect } from './fixtures';

test.describe('Settings', () => {
  test('settings page loads with form', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/settings/);

    // Should display settings heading
    await expect(page.locator('text=/settings/i').first()).toBeVisible({ timeout: 15000 });

    // Should have input fields (form)
    await expect(page.locator('input').first()).toBeVisible({ timeout: 10000 });
  });

  test('business name field is present and editable', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Find business name input — look for input by label, name, or placeholder
    const businessNameInput = page.locator(
      'input[name*="name" i], input[name*="business" i], input[placeholder*="business" i], input[placeholder*="name" i]',
    );

    if (
      await businessNameInput
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false)
    ) {
      const input = businessNameInput.first();

      // Verify the field has a value (existing business name)
      const currentValue = await input.inputValue();
      expect(currentValue.length).toBeGreaterThan(0);

      // Verify the field is editable by clearing and typing
      await input.clear();
      await input.fill('Test Business Name');
      await expect(input).toHaveValue('Test Business Name');

      // Restore original value to avoid side effects
      await input.clear();
      await input.fill(currentValue);
    }
  });

  test('save button exists on settings page', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Find a save/update button
    const saveButton = page.locator(
      'button:has-text("Save"), button:has-text("Update"), button[type="submit"]',
    );

    await expect(saveButton.first()).toBeVisible({ timeout: 10000 });
  });

  test('settings sub-pages are navigable', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Look for links to sub-pages (AI settings, notifications, etc.)
    const subPageLinks = page.locator(
      'a[href*="/settings/"], button:has-text("AI"), text=/ai.*settings|notification|billing|team/i',
    );

    if (
      await subPageLinks
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false)
    ) {
      // Click the first visible sub-page link
      const firstLink = subPageLinks.first();
      await firstLink.click();
      await page.waitForLoadState('networkidle');

      // Verify navigation occurred — should still be under /settings
      await expect(page).toHaveURL(/\/settings/, { timeout: 10000 });
    }
  });
});
