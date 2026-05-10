import { Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/v1';

/**
 * page.request automatically uses cookies from the BrowserContext, so as long
 * as the page is authenticated (via loginViaApi or loginViaUi), API calls go
 * through with the access_token cookie. We do not need to read a Bearer token
 * from localStorage — auth is httpOnly cookie based.
 */
function getHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}

export async function getServicesViaApi(page: Page) {
  const response = await page.request.get(`${API_URL}/services`, { headers: getHeaders() });
  const body = await response.json();
  return body?.data || body || [];
}

export async function getStaffViaApi(page: Page) {
  const response = await page.request.get(`${API_URL}/staff`, { headers: getHeaders() });
  return response.json();
}

export async function getCustomersViaApi(page: Page) {
  const response = await page.request.get(`${API_URL}/customers`, { headers: getHeaders() });
  const body = await response.json();
  return body?.data || body || [];
}

export async function createBookingViaApi(
  page: Page,
  data: { serviceId: string; staffId: string; customerId: string; startTime: string },
) {
  const response = await page.request.post(`${API_URL}/bookings`, {
    headers: getHeaders(),
    data,
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Create booking failed (${response.status()}): ${body}`);
  }
  return response.json();
}

export async function updateBookingStatusViaApi(
  page: Page,
  bookingId: string,
  status: string,
  reason?: string,
) {
  const response = await page.request.patch(`${API_URL}/bookings/${bookingId}/status`, {
    headers: getHeaders(),
    data: { status, ...(reason ? { reason } : {}) },
  });
  return response.json();
}

export async function sendRescheduleLinkViaApi(page: Page, bookingId: string) {
  const response = await page.request.post(
    `${API_URL}/bookings/${bookingId}/send-reschedule-link`,
    {
      headers: getHeaders(),
    },
  );
  return response.json();
}

export async function sendCancelLinkViaApi(page: Page, bookingId: string) {
  const response = await page.request.post(`${API_URL}/bookings/${bookingId}/send-cancel-link`, {
    headers: getHeaders(),
  });
  return response.json();
}
