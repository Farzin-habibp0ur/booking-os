import { NextResponse } from 'next/server';

export async function GET() {
  const payload: Record<string, unknown> = {
    status: 'ok',
    service: 'booking-os-web',
    timestamp: new Date().toISOString(),
  };

  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (apiUrl) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${apiUrl}/health`, { signal: controller.signal });
      clearTimeout(timer);
      payload.backend = res.ok ? 'ok' : 'unreachable';
    } catch {
      payload.backend = 'unreachable';
    }
  }

  return NextResponse.json(payload);
}
