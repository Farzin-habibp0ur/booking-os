import { test as base, expect, Page } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

const TEST_EMAIL = process.env.E2E_EMAIL || 'sarah@glowclinic.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'Bk0s!DemoSecure#2026';
const PORTAL_SLUG = process.env.E2E_PORTAL_SLUG || 'glow-clinic';

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }: { page: Page }, use: (page: Page) => Promise<void>) => {
    await loginViaUi(page, TEST_EMAIL, TEST_PASSWORD);
    await use(page);
  },
});

export { expect, TEST_EMAIL, TEST_PASSWORD, PORTAL_SLUG };
