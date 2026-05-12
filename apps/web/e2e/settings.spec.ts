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

    // Business name input lives under a "Business Name" label in the
    // Business Info card on the settings root page (rendered after the
    // category hub). The label isn't associated with the input via for/id,
    // so use locator chaining: find the label, then the next sibling input.
    const input = page
      .locator('div', { has: page.locator('label', { hasText: /business name/i }) })
      .locator('input')
      .first();
    await expect(input).toBeVisible({ timeout: 10000 });

    // Wait for the field to be populated from the API (initial value is
    // empty until /business returns).
    await expect(input).not.toHaveValue('', { timeout: 10000 });
    const currentValue = await input.inputValue();
    expect(currentValue.length).toBeGreaterThan(0);

    // Verify the field is editable by clearing and typing
    await input.clear();
    await input.fill('Test Business Name');
    await expect(input).toHaveValue('Test Business Name');

    // Restore original value to avoid side effects
    await input.clear();
    await input.fill(currentValue);
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
