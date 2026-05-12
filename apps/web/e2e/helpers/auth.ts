import { Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/v1';

/**
 * Authenticate by calling the API and propagating the resulting httpOnly cookies
 * into the browser context. This is faster than UI login because it skips form
 * fill/submit and a redirect cycle, but it correctly mirrors production auth
 * which uses httpOnly cookies (not localStorage).
 *
 * The cookies set by the API are scoped to localhost:3001, but Next.js
 * middleware runs on localhost:3000, so we copy them to both origins.
 */
export async function loginViaApi(
  page: Page,
  email = 'sarah@glowclinic.com',
  password = 'Bk0s!DemoSecure#2026',
) {
  // Call the login endpoint directly. APIRequestContext shares the storage state
  // with the page's BrowserContext, so cookies set on the API origin are
  // available on subsequent fetches the page makes — but middleware on the
  // web origin needs the cookies on its origin too. We add them explicitly.
  const response = await page.request.post(`${API_URL}/auth/login`, {
    data: { email, password },
  });

  if (!response.ok()) {
    throw new Error(`Login API returned ${response.status()}: ${await response.text()}`);
  }

  const body = await response.json();
  if (!body.accessToken) {
    throw new Error('No accessToken in login response');
  }

  // Mirror the auth cookies onto the web app origin so middleware sees them
  // (cookies set by the API on its own origin won't be sent to localhost:3000).
  const cookies = await page.context().cookies();
  const accessCookie = cookies.find((c) => c.name === 'access_token');
  const refreshCookie = cookies.find((c) => c.name === 'refresh_token');

  if (!accessCookie || !refreshCookie) {
    throw new Error('Login did not set access_token / refresh_token cookies');
  }

  await page.context().addCookies([
    {
      name: 'access_token',
      value: accessCookie.value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
    {
      name: 'refresh_token',
      value: refreshCookie.value,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
}

/**
 * Login via the UI form. Useful for testing the login flow itself.
 */
export async function loginViaUi(
  page: Page,
  email = 'sarah@glowclinic.com',
  password = 'Bk0s!DemoSecure#2026',
) {
  await page.goto('/login');
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(/\/(dashboard|setup)/, { timeout: 15000 });
}
