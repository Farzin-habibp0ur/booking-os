import { api } from './api';

const mockFetch = jest.fn();
global.fetch = mockFetch;

const mockLocalStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });

// Prevent jsdom navigation errors
Object.defineProperty(window, 'location', {
  value: { href: '' },
  writable: true,
});

beforeEach(() => {
  mockFetch.mockReset();
  mockLocalStorage.clear();
  api.setToken(null);
});

describe('ApiClient', () => {
  it('get() sends GET with Authorization header', async () => {
    api.setToken('test-token');
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: 'ok' }),
    });

    const result = await api.get('/test');

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/test'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
    expect(result).toEqual({ data: 'ok' });
  });

  it('post() sends JSON body', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 1 }),
    });

    await api.post('/items', { name: 'test' });

    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/items'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'test' }),
      }),
    );
  });

  it('401 response clears token', async () => {
    api.setToken('old-token');
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ message: 'Unauthorized' }),
    });

    await expect(api.get('/secret')).rejects.toThrow('Unauthorized');
    expect(mockLocalStorage.getItem('token')).toBeNull();
  });

  it('non-ok response throws with error message', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'Bad request data' }),
    });

    await expect(api.post('/bad')).rejects.toThrow('Bad request data');
  });
});
