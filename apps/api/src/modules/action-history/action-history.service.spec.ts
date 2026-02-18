import { Test } from '@nestjs/testing';
import { ActionHistoryService } from './action-history.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ActionHistoryService', () => {
  let service: ActionHistoryService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [ActionHistoryService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ActionHistoryService);
  });

  describe('create', () => {
    it('creates an action history entry', async () => {
      const entry = {
        id: 'ah1',
        businessId: 'biz1',
        actorType: 'STAFF',
        actorId: 'staff1',
        actorName: 'Sarah',
        action: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: 'book1',
        description: 'Booking created',
        diff: { after: { status: 'CONFIRMED' } },
        metadata: {},
        createdAt: new Date(),
      };
      prisma.actionHistory.create.mockResolvedValue(entry as any);

      const result = await service.create({
        businessId: 'biz1',
        actorType: 'STAFF',
        actorId: 'staff1',
        actorName: 'Sarah',
        action: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: 'book1',
        description: 'Booking created',
        diff: { after: { status: 'CONFIRMED' } },
      });

      expect(result).toEqual(entry);
      expect(prisma.actionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          actorType: 'STAFF',
          action: 'BOOKING_CREATED',
          entityType: 'BOOKING',
          entityId: 'book1',
        }),
      });
    });

    it('returns null on database error', async () => {
      prisma.actionHistory.create.mockRejectedValue(new Error('DB error'));

      const result = await service.create({
        businessId: 'biz1',
        actorType: 'SYSTEM',
        action: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: 'book1',
      });

      expect(result).toBeNull();
    });

    it('creates entry without optional fields', async () => {
      const entry = {
        id: 'ah2',
        businessId: 'biz1',
        actorType: 'SYSTEM',
        actorId: null,
        actorName: null,
        action: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: 'book1',
        description: null,
        diff: null,
        metadata: {},
        createdAt: new Date(),
      };
      prisma.actionHistory.create.mockResolvedValue(entry as any);

      const result = await service.create({
        businessId: 'biz1',
        actorType: 'SYSTEM',
        action: 'BOOKING_CREATED',
        entityType: 'BOOKING',
        entityId: 'book1',
      });

      expect(result).toEqual(entry);
    });
  });

  describe('findAll', () => {
    it('returns paginated results with defaults', async () => {
      const items = [
        { id: 'ah1', action: 'BOOKING_CREATED', createdAt: new Date() },
        { id: 'ah2', action: 'BOOKING_UPDATED', createdAt: new Date() },
      ];
      prisma.actionHistory.findMany.mockResolvedValue(items as any);
      prisma.actionHistory.count.mockResolvedValue(2);

      const result = await service.findAll('biz1', {});

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('filters by entityType', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);
      prisma.actionHistory.count.mockResolvedValue(0);

      await service.findAll('biz1', { entityType: 'BOOKING' });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz1', entityType: 'BOOKING' }),
        }),
      );
    });

    it('filters by entityId', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);
      prisma.actionHistory.count.mockResolvedValue(0);

      await service.findAll('biz1', { entityType: 'BOOKING', entityId: 'book1' });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            entityType: 'BOOKING',
            entityId: 'book1',
          }),
        }),
      );
    });

    it('filters by actorId', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);
      prisma.actionHistory.count.mockResolvedValue(0);

      await service.findAll('biz1', { actorId: 'staff1' });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz1', actorId: 'staff1' }),
        }),
      );
    });

    it('filters by action', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);
      prisma.actionHistory.count.mockResolvedValue(0);

      await service.findAll('biz1', { action: 'BOOKING_CANCELLED' });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz1', action: 'BOOKING_CANCELLED' }),
        }),
      );
    });

    it('respects pagination params', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);
      prisma.actionHistory.count.mockResolvedValue(50);

      const result = await service.findAll('biz1', { page: 3, pageSize: 10 });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it('caps pageSize at 100', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);
      prisma.actionHistory.count.mockResolvedValue(0);

      await service.findAll('biz1', { pageSize: 500 });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });

    it('orders by createdAt desc', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);
      prisma.actionHistory.count.mockResolvedValue(0);

      await service.findAll('biz1', {});

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  describe('findByEntity', () => {
    it('returns history for specific entity', async () => {
      const items = [
        { id: 'ah1', action: 'BOOKING_CREATED', entityType: 'BOOKING', entityId: 'book1' },
      ];
      prisma.actionHistory.findMany.mockResolvedValue(items as any);

      const result = await service.findByEntity('biz1', 'BOOKING', 'book1');

      expect(result).toEqual(items);
      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', entityType: 'BOOKING', entityId: 'book1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });

    it('returns empty array when no history exists', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);

      const result = await service.findByEntity('biz1', 'CONVERSATION', 'conv1');

      expect(result).toEqual([]);
    });
  });
});
