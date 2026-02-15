import { Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/v1';

/**
 * Authenticate by calling the API directly and setting the token in localStorage.
 * This avoids navigating through the login UI for every test, making tests faster.
 */
export async function loginViaApi(
  page: Page,
  email = 'sarah@glowclinic.com',
  password = 'password123',
) {
  // Call the login endpoint directly
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login API returned ${response.status()}: ${await response.text()}`);
  }

  const body = await response.json();
  const token = body.accessToken;

  if (!token) {
    throw new Error('No accessToken in login response');
  }

  // Navigate to a page first so we have a valid origin for localStorage
  await page.goto('/login');

  // Set token in localStorage
  await page.evaluate((t) => {
    localStorage.setItem('token', t);
  }, token);
}

/**
 * Login via the UI form. Useful for testing the login flow itself.
 */
export async function loginViaUi(
  page: Page,
  email = 'sarah@glowclinic.com',
  password = 'password123',
) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: /email/i }).fill(email);
  await page.getByRole('textbox', { name: /password/i }).fill(password);
  await page.getByRole('button', { name: /sign.in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
}
