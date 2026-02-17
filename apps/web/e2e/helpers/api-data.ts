import { Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/api/v1';

async function getAuthHeaders(page: Page): Promise<Record<string, string>> {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export async function getServicesViaApi(page: Page) {
  const headers = await getAuthHeaders(page);
  const response = await page.request.get(`${API_URL}/services`, { headers });
  const body = await response.json();
  return body?.data || body || [];
}

export async function getStaffViaApi(page: Page) {
  const headers = await getAuthHeaders(page);
  const response = await page.request.get(`${API_URL}/staff`, { headers });
  return response.json();
}

export async function getCustomersViaApi(page: Page) {
  const headers = await getAuthHeaders(page);
  const response = await page.request.get(`${API_URL}/customers`, { headers });
  const body = await response.json();
  return body?.data || body || [];
}

export async function createBookingViaApi(
  page: Page,
  data: { serviceId: string; staffId: string; customerId: string; startTime: string },
) {
  const headers = await getAuthHeaders(page);
  const response = await page.request.post(`${API_URL}/bookings`, {
    headers,
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
  const headers = await getAuthHeaders(page);
  const response = await page.request.patch(`${API_URL}/bookings/${bookingId}/status`, {
    headers,
    data: { status, ...(reason ? { reason } : {}) },
  });
  return response.json();
}

export async function sendRescheduleLinkViaApi(page: Page, bookingId: string) {
  const headers = await getAuthHeaders(page);
  const response = await page.request.post(
    `${API_URL}/bookings/${bookingId}/send-reschedule-link`,
    {
      headers,
    },
  );
  return response.json();
}

export async function sendCancelLinkViaApi(page: Page, bookingId: string) {
  const headers = await getAuthHeaders(page);
  const response = await page.request.post(`${API_URL}/bookings/${bookingId}/send-cancel-link`, {
    headers,
  });
  return response.json();
}
