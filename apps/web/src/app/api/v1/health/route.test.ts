jest.mock('next/server', () => ({
  NextResponse: {
    json: (body: any) => ({
      status: 200,
      json: async () => body,
    }),
  },
}));

import { GET } from './route';

describe('GET /api/v1/health', () => {
  it('returns 200 with status ok and frontend flag', async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.frontend).toBe(true);
    expect(body.timestamp).toBeDefined();
  });
});
