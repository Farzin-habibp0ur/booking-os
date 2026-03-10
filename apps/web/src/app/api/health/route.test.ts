jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: Record<string, unknown>) => ({
      status: 200,
      json: async () => body,
    }),
  },
}));

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
  (global as any).fetch = jest.fn();
});

afterEach(() => {
  process.env = originalEnv;
});

describe('GET /api/health', () => {
  it('returns status ok with service name and timestamp', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.service).toBe('booking-os-web');
    expect(body.timestamp).toBeDefined();
  });

  it('includes backend ok when API is reachable', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
    (global as any).fetch = jest.fn().mockResolvedValue({ ok: true });

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(body.backend).toBe('ok');
    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/health',
      expect.objectContaining({ signal: expect.anything() }),
    );
  });

  it('includes backend unreachable when API is down', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'http://localhost:3001/api/v1';
    (global as any).fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const { GET } = await import('./route');
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.backend).toBe('unreachable');
  });
});
