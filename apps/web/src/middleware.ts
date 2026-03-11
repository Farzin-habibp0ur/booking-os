import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * H11 fix: Server-side route protection.
 * Checks for access_token cookie on protected routes.
 * Public routes (login, signup, booking portal, self-serve) are allowed without auth.
 */

const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password',
  '/accept-invite',
  '/verify-email',
  '/book',
  '/manage',
  '/claim',
  '/pricing',
  '/blog',
  '/faq',
  '/upgrade',
  '/portal',
  '/og-image.png',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for auth cookies (httpOnly cookies set by API).
  // Allow the request if either access_token or refresh_token exists —
  // the API client will automatically refresh an expired access_token
  // using the refresh_token cookie, so we must not redirect prematurely.
  const accessToken = request.cookies.get('access_token');
  const refreshToken = request.cookies.get('refresh_token');
  if (!accessToken && !refreshToken) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals, static files, and SEO assets
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap\\.xml|robots\\.txt|og-image\\.png).*)',
  ],
};
