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
window.location = { href: '' } as any;

describe('ApiClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
    Object.keys(mockLocalStorage).forEach(key => delete mockLocalStorage[key]);
    api.setToken(null);
  });

  describe('setToken', () => {
    it('stores token in localStorage', () => {
      api.setToken('test-token');

      expect(window.localStorage.setItem).toHaveBeenCalledWith('token', 'test-token');
      expect(mockLocalStorage['token']).toBe('test-token');
    });

    it('removes token from localStorage when set to null', () => {
      mockLocalStorage['token'] = 'existing-token';

      api.setToken(null);

      expect(window.localStorage.removeItem).toHaveBeenCalledWith('token');
      expect(mockLocalStorage['token']).toBeUndefined();
    });
  });

  describe('getToken', () => {
    it('retrieves token from localStorage', () => {
      mockLocalStorage['token'] = 'stored-token';

      const token = api.getToken();

      expect(token).toBe('stored-token');
      expect(window.localStorage.getItem).toHaveBeenCalledWith('token');
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
            'Authorization': 'Bearer test-token',
          }),
        })
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
        })
      );
    });

    it('redirects to /login on 401 response', async () => {
      api.setToken('expired-token');
      mockFetch.mockResolvedValue({
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
        })
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
        })
      );
    });

    it('patch() makes PATCH request with body', async () => {
      await api.patch('/test', { data: 'updated' });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ data: 'updated' }),
        })
      );
    });

    it('del() makes DELETE request', async () => {
      await api.del('/test');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'DELETE',
        })
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
            'Authorization': 'Bearer test-token',
          }),
        })
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
});
