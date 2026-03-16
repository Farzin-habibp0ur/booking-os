import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const CUSTOMER_APP_URL =
  process.env.NEXT_PUBLIC_CUSTOMER_APP_URL || 'https://businesscommandcentre.com';

const PUBLIC_PATHS = ['/login'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for auth cookies (httpOnly cookies set by API).
  // Allow the request if either access_token or refresh_token exists —
  // the API client will automatically refresh an expired access_token
  // using the refresh_token cookie, so we must not redirect prematurely.
  const accessToken = request.cookies.get('access_token');
  const refreshToken = request.cookies.get('refresh_token');
  if (!accessToken && !refreshToken) {
    return NextResponse.redirect(`${CUSTOMER_APP_URL}/login`);
  }

  // Client-side AuthProvider handles SUPER_ADMIN role validation
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
