import { test as base, expect } from '@playwright/test';
import { loginViaUi } from './helpers/auth';

const TEST_EMAIL = process.env.E2E_EMAIL || 'sarah@glowclinic.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD || 'password123';
const PORTAL_SLUG = process.env.E2E_PORTAL_SLUG || 'glow-clinic';

export const test = base.extend<{ authenticatedPage: (typeof base)['prototype'] }>({
  authenticatedPage: async ({ page }, use) => {
    await loginViaUi(page, TEST_EMAIL, TEST_PASSWORD);
    await use(page);
  },
});

export { expect, TEST_EMAIL, TEST_PASSWORD, PORTAL_SLUG };
