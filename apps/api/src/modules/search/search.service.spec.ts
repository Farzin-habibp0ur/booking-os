import { Test } from '@nestjs/testing';
import { SearchService } from './search.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('SearchService', () => {
  let searchService: SearchService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [SearchService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    searchService = module.get(SearchService);
  });

  function setupEmptyMocks() {
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.service.findMany.mockResolvedValue([]);
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.customer.count.mockResolvedValue(0);
    prisma.booking.count.mockResolvedValue(0);
    prisma.service.count.mockResolvedValue(0);
    prisma.conversation.count.mockResolvedValue(0);
  }

  it('returns empty results for short queries', async () => {
    const result = await searchService.globalSearch('biz1', 'a');

    expect(result).toEqual({
      customers: [],
      bookings: [],
      services: [],
      conversations: [],
      totals: { customers: 0, bookings: 0, services: 0, conversations: 0 },
    });
    expect(prisma.customer.findMany).not.toHaveBeenCalled();
  });

  it('returns empty results for empty query', async () => {
    const result = await searchService.globalSearch('biz1', '');

    expect(result).toEqual({
      customers: [],
      bookings: [],
      services: [],
      conversations: [],
      totals: { customers: 0, bookings: 0, services: 0, conversations: 0 },
    });
  });

  it('searches across all entity types', async () => {
    const customers = [{ id: 'c1', name: 'Alice', phone: '+1234', email: null }];
    const bookings = [
      {
        id: 'b1',
        startTime: new Date(),
        status: 'CONFIRMED',
        customer: { name: 'Alice' },
        service: { name: 'Botox' },
      },
    ];
    const services = [{ id: 's1', name: 'Botox', durationMins: 30, price: 200 }];
    const conversations = [
      { id: 'conv1', customer: { name: 'Alice' }, lastMessageAt: new Date(), status: 'OPEN' },
    ];

    prisma.customer.findMany.mockResolvedValue(customers as any);
    prisma.booking.findMany.mockResolvedValue(bookings as any);
    prisma.service.findMany.mockResolvedValue(services as any);
    prisma.conversation.findMany.mockResolvedValue(conversations as any);
    prisma.customer.count.mockResolvedValue(1);
    prisma.booking.count.mockResolvedValue(1);
    prisma.service.count.mockResolvedValue(1);
    prisma.conversation.count.mockResolvedValue(1);

    const result = await searchService.globalSearch('biz1', 'Alice');

    expect(result.customers).toEqual(customers);
    expect(result.bookings).toEqual(bookings);
    expect(result.services).toEqual(services);
    expect(result.conversations).toEqual(conversations);
    expect(result.totals).toEqual({
      customers: 1,
      bookings: 1,
      services: 1,
      conversations: 1,
    });
  });

  it('scopes search to business', async () => {
    setupEmptyMocks();

    await searchService.globalSearch('biz1', 'test');

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: 'biz1' }),
      }),
    );
    expect(prisma.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: 'biz1' }),
      }),
    );
  });

  it('respects custom limit', async () => {
    setupEmptyMocks();

    await searchService.globalSearch('biz1', 'test', 3);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 3 }));
  });

  // ─── New: Offset ──────────────────────────────────────────────────

  it('applies offset parameter', async () => {
    setupEmptyMocks();

    await searchService.globalSearch('biz1', 'test', 5, 10);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
    expect(prisma.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });

  it('defaults offset to 0', async () => {
    setupEmptyMocks();

    await searchService.globalSearch('biz1', 'test');

    expect(prisma.customer.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0 }));
  });

  // ─── New: Types filter ────────────────────────────────────────────

  it('filters by types when specified', async () => {
    setupEmptyMocks();

    await searchService.globalSearch('biz1', 'test', 5, 0, ['customer']);

    expect(prisma.customer.findMany).toHaveBeenCalled();
    expect(prisma.customer.count).toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.service.findMany).not.toHaveBeenCalled();
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
  });

  it('filters multiple types', async () => {
    setupEmptyMocks();

    await searchService.globalSearch('biz1', 'test', 5, 0, ['customer', 'service']);

    expect(prisma.customer.findMany).toHaveBeenCalled();
    expect(prisma.service.findMany).toHaveBeenCalled();
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
    expect(prisma.conversation.findMany).not.toHaveBeenCalled();
  });

  it('searches all types when types array is empty', async () => {
    setupEmptyMocks();

    await searchService.globalSearch('biz1', 'test', 5, 0, []);

    expect(prisma.customer.findMany).toHaveBeenCalled();
    expect(prisma.booking.findMany).toHaveBeenCalled();
    expect(prisma.service.findMany).toHaveBeenCalled();
    expect(prisma.conversation.findMany).toHaveBeenCalled();
  });

  // ─── New: Totals ──────────────────────────────────────────────────

  it('returns totals for each entity type', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.service.findMany.mockResolvedValue([]);
    prisma.conversation.findMany.mockResolvedValue([]);
    prisma.customer.count.mockResolvedValue(15);
    prisma.booking.count.mockResolvedValue(8);
    prisma.service.count.mockResolvedValue(3);
    prisma.conversation.count.mockResolvedValue(2);

    const result = await searchService.globalSearch('biz1', 'test');

    expect(result.totals).toEqual({
      customers: 15,
      bookings: 8,
      services: 3,
      conversations: 2,
    });
  });

  it('returns zero totals for unqueried types', async () => {
    setupEmptyMocks();
    prisma.customer.count.mockResolvedValue(5);

    const result = await searchService.globalSearch('biz1', 'test', 5, 0, ['customer']);

    expect(result.totals.customers).toBe(5);
    expect(result.totals.bookings).toBe(0);
    expect(result.totals.services).toBe(0);
    expect(result.totals.conversations).toBe(0);
  });
});
