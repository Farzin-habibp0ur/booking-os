import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const TEST_EMAIL = process.env.E2E_EMAIL || 'sarah@glowclinic.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'password123';
const PORTAL_SLUG = process.env.E2E_PORTAL_SLUG || 'glow-clinic';

async function login(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(TEST_EMAIL);
  await page.getByLabel('Password').fill(TEST_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL('**/dashboard**');
}

// Public pages (no auth needed)
const publicPages = [
  { name: 'Login', path: '/login' },
  { name: 'Forgot Password', path: '/forgot-password' },
];

// Protected pages (need auth)
const protectedPages = [
  { name: 'Dashboard', path: '/dashboard' },
  { name: 'Bookings', path: '/bookings' },
  { name: 'Calendar', path: '/calendar' },
  { name: 'Customers', path: '/customers' },
  { name: 'Services', path: '/services' },
  { name: 'Staff', path: '/staff' },
  { name: 'Inbox', path: '/inbox' },
  { name: 'Settings', path: '/settings' },
];

test.describe('Accessibility - Public Pages', () => {
  for (const { name, path } of publicPages) {
    test(`${name} page should have no critical a11y violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast']) // May have false positives with custom theme
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(critical).toEqual([]);
    });
  }
});

test.describe('Accessibility - Protected Pages', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  for (const { name, path } of protectedPages) {
    test(`${name} page should have no critical a11y violations`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');

      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .disableRules(['color-contrast'])
        .analyze();

      const critical = results.violations.filter(
        (v) => v.impact === 'critical' || v.impact === 'serious',
      );
      expect(critical).toEqual([]);
    });
  }
});

test.describe('Accessibility - Portal', () => {
  test(`Portal page should have no critical a11y violations`, async ({ page }) => {
    await page.goto(`/portal/${PORTAL_SLUG}`);
    await page.waitForLoadState('networkidle');

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    const critical = results.violations.filter(
      (v) => v.impact === 'critical' || v.impact === 'serious',
    );
    expect(critical).toEqual([]);
  });
});
