/**
 * Test that the PUBLIC_PATHS array in middleware.ts includes all expected paths.
 * We test the middleware logic by importing the source and checking behavior directly.
 */

// Mock next/server before importing middleware
const mockRedirect = jest.fn().mockReturnValue({ type: 'redirect' });
const mockNext = jest.fn().mockReturnValue({ type: 'next' });

jest.mock('next/server', () => ({
  NextResponse: {
    redirect: (...args: any[]) => mockRedirect(...args),
    next: (...args: any[]) => mockNext(...args),
  },
}));

import { middleware } from './middleware';

function createRequest(pathname: string, hasCookie = false) {
  return {
    nextUrl: { pathname },
    url: `http://localhost:3000${pathname}`,
    cookies: {
      get: (name: string) => (hasCookie ? { name, value: 'mock-token' } : undefined),
    },
  } as any;
}

describe('middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('public paths allowed without auth', () => {
    const publicPaths = [
      '/',
      '/login',
      '/signup',
      '/forgot-password',
      '/reset-password',
      '/accept-invite',
      '/verify-email',
      '/book/some-slug',
      '/pricing',
      '/blog',
      '/blog/some-post',
      '/faq',
    ];

    it.each(publicPaths)('allows %s without auth', (path) => {
      middleware(createRequest(path));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });

  describe('protected paths redirect without auth', () => {
    it('redirects /dashboard to login when no token', () => {
      middleware(createRequest('/dashboard'));
      expect(mockRedirect).toHaveBeenCalled();
    });

    it('redirects /settings to login when no token', () => {
      middleware(createRequest('/settings'));
      expect(mockRedirect).toHaveBeenCalled();
    });
  });

  describe('authenticated access', () => {
    it('allows protected path with access_token cookie', () => {
      middleware(createRequest('/dashboard', true));
      expect(mockNext).toHaveBeenCalled();
      expect(mockRedirect).not.toHaveBeenCalled();
    });
  });
});
