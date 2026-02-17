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
  '/reset-password',
  '/accept-invite',
  '/verify-email',
  '/book',
  '/manage',
  '/claim',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (pathname === '/' || PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for access_token cookie (httpOnly cookie set by API)
  const token = request.cookies.get('access_token');
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
