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

  describe('exportCsv', () => {
    const makeItem = (overrides: any = {}) => ({
      id: 'ah1',
      actorType: 'STAFF',
      actorName: 'Sarah',
      action: 'BOOKING_CREATED',
      entityType: 'BOOKING',
      entityId: 'book1',
      description: 'Booking created',
      createdAt: new Date('2026-02-01T10:00:00Z'),
      ...overrides,
    });

    it('returns CSV with headers and rows', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([makeItem()] as any);

      const csv = await service.exportCsv('biz1');

      expect(csv).toContain(
        'id,actorType,actorName,action,entityType,entityId,description,createdAt',
      );
      expect(csv).toContain('ah1,STAFF,Sarah,BOOKING_CREATED,BOOKING,book1,Booking created,');
      expect(csv).toContain('2026-02-01T10:00:00.000Z');
    });

    it('returns only headers when no data', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);

      const csv = await service.exportCsv('biz1');

      const lines = csv.trim().split('\r\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe(
        'id,actorType,actorName,action,entityType,entityId,description,createdAt',
      );
    });

    it('escapes values containing commas', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([
        makeItem({ description: 'Status changed from PENDING, to CONFIRMED' }),
      ] as any);

      const csv = await service.exportCsv('biz1');

      expect(csv).toContain('"Status changed from PENDING, to CONFIRMED"');
    });

    it('escapes values containing quotes', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([
        makeItem({ description: 'Said "hello"' }),
      ] as any);

      const csv = await service.exportCsv('biz1');

      expect(csv).toContain('"Said ""hello"""');
    });

    it('filters by entityType', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);

      await service.exportCsv('biz1', { entityType: 'BOOKING' });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ entityType: 'BOOKING' }),
        }),
      );
    });

    it('filters by actorType', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);

      await service.exportCsv('biz1', { actorType: 'AI' });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ actorType: 'AI' }),
        }),
      );
    });

    it('filters by date range', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);

      await service.exportCsv('biz1', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          }),
        }),
      );
    });

    it('caps at 10000 rows', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([]);

      await service.exportCsv('biz1');

      expect(prisma.actionHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10000 }),
      );
    });

    it('handles null values gracefully', async () => {
      prisma.actionHistory.findMany.mockResolvedValue([
        makeItem({ actorName: null, description: null }),
      ] as any);

      const csv = await service.exportCsv('biz1');

      expect(csv).toContain('ah1,STAFF,,BOOKING_CREATED,BOOKING,book1,,');
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
