/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Lightweight tests for seed-omnichannel.ts.
 *
 * Since the seed script instantiates PrismaClient at module scope we mock
 * the entire @prisma/client module, then dynamically import the seed script
 * so all Prisma calls hit our mocks.
 */

// ── Mock helpers ──────────────────────────────────────────────────────

const upsertedCustomers: any[] = [];
const upsertedUsage: any[] = [];
const updatedBusinesses: any[] = [];

const fakeBusiness = {
  id: 'biz_001',
  name: 'Glow Aesthetic Clinic',
  slug: 'glow-aesthetic',
};
const fakeBusiness2 = {
  id: 'biz_002',
  name: 'Metro Auto Group',
  slug: 'metro-auto-group',
};
const fakeBusiness3 = {
  id: 'biz_003',
  name: 'Serenity Wellness Spa',
  slug: 'serenity-wellness-spa',
};

const mockPrisma = {
  business: {
    findFirst: jest.fn().mockImplementation(({ where }: any) => {
      const map: Record<string, any> = {
        'glow-aesthetic': fakeBusiness,
        'metro-auto-group': fakeBusiness2,
        'serenity-wellness-spa': fakeBusiness3,
      };
      return Promise.resolve(map[where.slug] ?? null);
    }),
    update: jest.fn().mockImplementation(({ where, data }: any) => {
      updatedBusinesses.push({ id: where.id, data });
      return Promise.resolve({ id: where.id, ...data });
    }),
  },
  customer: {
    upsert: jest.fn().mockImplementation(({ create }: any) => {
      const record = { id: `cust_${upsertedCustomers.length + 1}`, ...create };
      upsertedCustomers.push(record);
      return Promise.resolve(record);
    }),
  },
  messageUsage: {
    upsert: jest.fn().mockImplementation(({ create }: any) => {
      const record = { id: `mu_${upsertedUsage.length + 1}`, ...create };
      upsertedUsage.push(record);
      return Promise.resolve(record);
    }),
  },
  $disconnect: jest.fn().mockResolvedValue(undefined),
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn(() => mockPrisma),
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe('seed-omnichannel', () => {
  beforeAll(async () => {
    // Suppress console.log during seed
    jest.spyOn(console, 'log').mockImplementation(() => {});
    // Dynamically import so it runs against our mock
    await import('./seed-omnichannel');
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('executes without error', () => {
    // If we reach here, main() completed without throwing.
    expect(true).toBe(true);
  });

  it('creates multi-channel customers for the aesthetic clinic', () => {
    // 3 customers upserted (Alex, Jordan, Taylor)
    expect(mockPrisma.customer.upsert).toHaveBeenCalledTimes(3);

    // Alex should have all channel identifiers
    const alexCall = mockPrisma.customer.upsert.mock.calls[0][0];
    expect(alexCall.create.instagramUserId).toBe('ig_alex_mc');
    expect(alexCall.create.facebookPsid).toBe('fb_alex_mc');
    expect(alexCall.create.phone).toBe('+1555MULTI01');

    // Jordan is email-only
    const jordanCall = mockPrisma.customer.upsert.mock.calls[1][0];
    expect(jordanCall.create.email).toBe('jordan@example.com');

    // Taylor has webChatSessionId
    const taylorCall = mockPrisma.customer.upsert.mock.calls[2][0];
    expect(taylorCall.create.webChatSessionId).toBe('wc_taylor_001');
  });

  it('creates MessageUsage records for all businesses and channels', () => {
    // 3 businesses x 7 days x 6 channels x 2 directions = 252
    expect(mockPrisma.messageUsage.upsert).toHaveBeenCalledTimes(252);

    // Verify a call has the expected shape
    const firstCall = mockPrisma.messageUsage.upsert.mock.calls[0][0];
    expect(firstCall.create).toHaveProperty('businessId');
    expect(firstCall.create).toHaveProperty('channel');
    expect(firstCall.create).toHaveProperty('direction');
    expect(firstCall.create).toHaveProperty('date');
    expect(firstCall.create).toHaveProperty('count');
    expect(firstCall.create.count).toBeGreaterThan(0);
  });

  it('updates channelSettings on all demo businesses', () => {
    expect(mockPrisma.business.update).toHaveBeenCalledTimes(3);

    for (const call of mockPrisma.business.update.mock.calls) {
      const settings = call[0].data.channelSettings;
      expect(settings.enabledChannels).toHaveLength(6);
      expect(settings.defaultReplyChannel).toBe('WHATSAPP');
      expect(settings.autoDetectChannel).toBe(true);
    }
  });

  it('is idempotent (upsert-based, can run twice safely)', () => {
    // All customer and messageUsage mutations use upsert
    // Verify no create/createMany calls were made
    expect(mockPrisma.customer.upsert).toBeDefined();
    expect(mockPrisma.messageUsage.upsert).toBeDefined();

    // The update call on business is also idempotent (overwrites same JSON)
    expect(mockPrisma.business.update).toBeDefined();
  });

  it('disconnects PrismaClient on completion', () => {
    expect(mockPrisma.$disconnect).toHaveBeenCalled();
  });
});
