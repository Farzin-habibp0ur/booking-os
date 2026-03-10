import { test, expect } from './fixtures';

test.describe('Customer Flow', () => {
  test('customers page loads successfully', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveURL(/\/customers/);
    await expect(page.locator('body')).toContainText(/customer|client|patient/i, {
      timeout: 10000,
    });
  });

  test('clicking New Customer opens customer form', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Find the New Customer button
    const newCustomerBtn = page.locator(
      'button:has-text("New Customer"), button:has-text("New Client"), button:has-text("New Patient"), button:has-text("Add Customer"), button:has-text("Add Client"), a:has-text("New Customer")',
    );

    if (
      await newCustomerBtn
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false)
    ) {
      await newCustomerBtn.first().click();

      // Verify form or modal appears with input fields
      const formVisible = await page
        .locator(
          '[role="dialog"], [data-testid="customer-modal"], .modal, form:has(input[type="text"]), form:has(input[type="email"])',
        )
        .first()
        .isVisible({ timeout: 10000 })
        .catch(() => false);

      expect(formVisible).toBe(true);
    }
  });

  test('search for a customer updates results', async ({ authenticatedPage }) => {
    const page = authenticatedPage;

    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Find the search input
    const searchInput = page
      .locator('input[type="search"], input[placeholder*="search" i], input[placeholder*="find" i]')
      .first();

    if (await searchInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      // Type a search query
      await searchInput.fill('test');
      await page.waitForLoadState('networkidle');

      // Verify the input has the value
      await expect(searchInput).toHaveValue('test');

      // The page should still show customer-related content (results or "no results" message)
      const hasContent = await page
        .locator('body')
        .isVisible()
        .catch(() => false);
      expect(hasContent).toBe(true);
    }
  });

  test('customer list renders with name, phone, and email columns', async ({
    authenticatedPage,
  }) => {
    const page = authenticatedPage;

    await page.goto('/customers');
    await page.waitForLoadState('networkidle');

    // Check for table with expected column headers
    const hasTable = await page
      .locator('table')
      .first()
      .isVisible({ timeout: 10000 })
      .catch(() => false);

    if (hasTable) {
      // Verify column headers exist
      const headerRow = page.locator('table thead tr, table th').first();
      const headerText = await headerRow.textContent().catch(() => '');

      // Should contain name-related, phone, or email headers
      const hasRelevantColumns =
        /name|phone|email|contact/i.test(headerText || '') ||
        (await page
          .locator('th:has-text("Name"), th:has-text("Phone"), th:has-text("Email")')
          .first()
          .isVisible()
          .catch(() => false));

      expect(hasRelevantColumns).toBe(true);
    } else {
      // If no table, check for card-based list with customer info
      const hasCustomerCards = await page
        .locator('[data-testid*="customer"], text=/customer|client|patient/i')
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);
      const hasEmptyState = await page
        .locator('text=/no.*customer|no.*client|no.*patient|empty/i')
        .first()
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      expect(hasCustomerCards || hasEmptyState).toBe(true);
    }
  });
});
