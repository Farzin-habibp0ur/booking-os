import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    frontend: true,
    timestamp: new Date().toISOString(),
  });
}
