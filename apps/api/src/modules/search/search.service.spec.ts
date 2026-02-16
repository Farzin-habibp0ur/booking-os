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
      providers: [
        SearchService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    searchService = module.get(SearchService);
  });

  it('returns empty results for short queries', async () => {
    const result = await searchService.globalSearch('biz1', 'a');

    expect(result).toEqual({
      customers: [],
      bookings: [],
      services: [],
      conversations: [],
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
    });
  });

  it('searches across all entity types', async () => {
    const customers = [{ id: 'c1', name: 'Alice', phone: '+1234', email: null }];
    const bookings = [{ id: 'b1', startTime: new Date(), status: 'CONFIRMED', customer: { name: 'Alice' }, service: { name: 'Botox' } }];
    const services = [{ id: 's1', name: 'Botox', durationMins: 30, price: 200 }];
    const conversations = [{ id: 'conv1', customer: { name: 'Alice' }, lastMessageAt: new Date(), status: 'OPEN' }];

    prisma.customer.findMany.mockResolvedValue(customers as any);
    prisma.booking.findMany.mockResolvedValue(bookings as any);
    prisma.service.findMany.mockResolvedValue(services as any);
    prisma.conversation.findMany.mockResolvedValue(conversations as any);

    const result = await searchService.globalSearch('biz1', 'Alice');

    expect(result.customers).toEqual(customers);
    expect(result.bookings).toEqual(bookings);
    expect(result.services).toEqual(services);
    expect(result.conversations).toEqual(conversations);
  });

  it('scopes search to business', async () => {
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.service.findMany.mockResolvedValue([]);
    prisma.conversation.findMany.mockResolvedValue([]);

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
    prisma.customer.findMany.mockResolvedValue([]);
    prisma.booking.findMany.mockResolvedValue([]);
    prisma.service.findMany.mockResolvedValue([]);
    prisma.conversation.findMany.mockResolvedValue([]);

    await searchService.globalSearch('biz1', 'test', 3);

    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 3 }),
    );
  });
});
