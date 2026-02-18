import { api } from './api';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Mock localStorage
const mockLocalStorage: Record<string, string> = {};
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      mockLocalStorage[key] = value;
    }),
    removeItem: jest.fn((key: string) => {
      delete mockLocalStorage[key];
    }),
  },
  writable: true,
});

// Mock window.location
delete (window as any).location;
window.location = { href: '', pathname: '/dashboard' } as any;

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    Object.keys(mockLocalStorage).forEach((key) => delete mockLocalStorage[key]);
    api.setToken(null);
  });

  describe('setToken', () => {
    it('stores token in memory only (C2 fix: no localStorage)', () => {
      api.setToken('test-token');

      expect(api.getToken()).toBe('test-token');
      // Should NOT touch localStorage
      expect(window.localStorage.setItem).not.toHaveBeenCalled();
    });

    it('clears in-memory token when set to null', () => {
      api.setToken('existing-token');
      api.setToken(null);

      expect(api.getToken()).toBeNull();
      // Should NOT touch localStorage
      expect(window.localStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  describe('getToken', () => {
    it('returns in-memory token without localStorage fallback', () => {
      mockLocalStorage['token'] = 'stored-token';

      const token = api.getToken();

      // Should NOT read from localStorage (C2 fix)
      expect(token).toBeNull();
      expect(window.localStorage.getItem).not.toHaveBeenCalled();
    });

    it('returns null when no token exists', () => {
      const token = api.getToken();

      expect(token).toBeNull();
    });
  });

  describe('request', () => {
    it('adds Authorization header when token exists', async () => {
      api.setToken('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

      await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
    });

    it('adds credentials: include to all requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: 'success' }),
      });

      await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: 'include',
        }),
      );
    });

    it('redirects to /login on 401 when refresh also fails', async () => {
      window.location.pathname = '/dashboard';
      api.setToken('expired-token');
      mockFetch
        // First call: /test returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Unauthorized' }),
        })
        // Second call: /auth/refresh also fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Refresh failed' }),
        })
        // Third call: retry /test returns 401 (shouldn't happen, but safety)
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Unauthorized' }),
        });

      await expect(api.get('/test')).rejects.toThrow('Unauthorized');

      expect(api.getToken()).toBeNull();
      expect(window.location.href).toBe('/login');
    });

    it('throws error on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Internal Server Error' }),
      });

      await expect(api.get('/test')).rejects.toThrow('Internal Server Error');
    });

    it('throws generic error when response has no message', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      });

      await expect(api.get('/test')).rejects.toThrow('HTTP 404');
    });

    it('handles JSON parse errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('Invalid JSON');
        },
      });

      await expect(api.get('/test')).rejects.toThrow('Request failed');
    });
  });

  describe('HTTP methods', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });
    });

    it('get() makes GET request', async () => {
      await api.get('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          credentials: 'include',
        }),
      );
      // GET request should not have a method property (undefined = GET)
      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.method).toBeUndefined();
    });

    it('post() makes POST request with body', async () => {
      await api.post('/test', { data: 'value' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ data: 'value' }),
        }),
      );
    });

    it('patch() makes PATCH request with body', async () => {
      await api.patch('/test', { data: 'updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ data: 'updated' }),
        }),
      );
    });

    it('del() makes DELETE request', async () => {
      await api.del('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'DELETE',
        }),
      );
    });
  });

  describe('upload', () => {
    it('uploads FormData without Content-Type header', async () => {
      api.setToken('test-token');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ url: 'uploaded.jpg' }),
      });

      const formData = new FormData();
      formData.append('file', new Blob(['test']), 'test.jpg');

      await api.upload('/upload', formData);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/upload'),
        expect.objectContaining({
          method: 'POST',
          body: formData,
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );

      // Ensure Content-Type is NOT set (browser will set it with boundary)
      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders['Content-Type']).toBeUndefined();
    });

    it('redirects to /login on 401 during upload', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      });

      const formData = new FormData();
      await expect(api.upload('/upload', formData)).rejects.toThrow('Unauthorized');

      expect(window.location.href).toBe('/login');
    });
  });

  describe('token refresh', () => {
    beforeEach(() => {
      window.location.pathname = '/dashboard';
    });

    it('automatically refreshes token on 401 and retries request', async () => {
      api.setToken('expired-token');
      mockFetch
        // First: /test returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Unauthorized' }),
        })
        // Second: /auth/refresh succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accessToken: 'new-token' }),
        })
        // Third: retry /test succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: 'success' }),
        });

      const result = await api.get('/test');

      expect(result).toEqual({ data: 'success' });
      expect(api.getToken()).toBe('new-token');
      expect(mockFetch).toHaveBeenCalledTimes(3);
      // Verify refresh was called with POST and credentials
      expect(mockFetch.mock.calls[1][0]).toContain('/auth/refresh');
      expect(mockFetch.mock.calls[1][1]).toEqual(
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
    });

    it('does not attempt refresh for /auth/ endpoints', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(api.get('/auth/me')).rejects.toThrow('Invalid credentials');

      // Only 1 call — no refresh attempt
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('does not retry after refresh failure', async () => {
      api.setToken('expired-token');
      mockFetch
        // /test returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Unauthorized' }),
        })
        // /auth/refresh fails
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Refresh expired' }),
        });

      await expect(api.get('/test')).rejects.toThrow('Unauthorized');

      // 2 calls: original + refresh (no retry)
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(window.location.href).toBe('/login');
    });

    it('deduplicates concurrent refresh calls', async () => {
      api.setToken('expired');
      let refreshCallCount = 0;
      mockFetch.mockImplementation(async (url: string) => {
        if (url.includes('/auth/refresh')) {
          refreshCallCount++;
          return { ok: true, json: async () => ({ accessToken: 'new' }) };
        }
        // First 2 calls return 401, then success on retry
        if (refreshCallCount === 0) {
          return { ok: false, status: 401, json: async () => ({ message: 'Unauthorized' }) };
        }
        return { ok: true, json: async () => ({ data: 'ok' }) };
      });

      const [r1, r2] = await Promise.all([api.get('/test1'), api.get('/test2')]);

      expect(r1).toEqual({ data: 'ok' });
      expect(r2).toEqual({ data: 'ok' });
      // Refresh should only be called once despite two concurrent 401s
      expect(refreshCallCount).toBe(1);
    });

    it('retries upload after successful refresh', async () => {
      api.setToken('expired');
      mockFetch
        // Upload returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          json: async () => ({ message: 'Unauthorized' }),
        })
        // Refresh succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ accessToken: 'new-token' }),
        })
        // Retry upload succeeds
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ url: 'uploaded.jpg' }),
        });

      const formData = new FormData();
      const result = await api.upload('/upload', formData);

      expect(result).toEqual({ url: 'uploaded.jpg' });
      expect(api.getToken()).toBe('new-token');
    });
  });

  describe('edge cases', () => {
    it('does not redirect to /login on 401 when already on login page', async () => {
      window.location.pathname = '/login';
      window.location.href = '/login';

      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Invalid credentials' }),
      });

      await expect(api.get('/test')).rejects.toThrow();

      // Should NOT redirect since we're already on /login
      expect(window.location.href).toBe('/login');
    });

    it('truncates long error messages to 200 chars', async () => {
      const longMessage = 'A'.repeat(300);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: longMessage }),
      });

      try {
        await api.get('/test');
      } catch (e: any) {
        expect(e.message.length).toBeLessThanOrEqual(200);
      }
    });

    it('strips stack traces from error messages', async () => {
      const messageWithStack = 'Something failed at Module.foo (file.js:1:2)';
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ message: messageWithStack }),
      });

      try {
        await api.get('/test');
      } catch (e: any) {
        expect(e.message).not.toContain('at Module.foo (file.js:1:2)');
        expect(e.message).toContain('Something failed');
      }
    });

    it('post() sends request without body when body is undefined', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.post('/test');

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.method).toBe('POST');
      expect(callArgs.body).toBeUndefined();
    });

    it('patch() sends request without body when body is undefined', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.patch('/test');

      const callArgs = mockFetch.mock.calls[0][1];
      expect(callArgs.method).toBe('PATCH');
      expect(callArgs.body).toBeUndefined();
    });
  });
});
