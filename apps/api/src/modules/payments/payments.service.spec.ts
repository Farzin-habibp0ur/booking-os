import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: MockPrisma;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [PaymentsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('create', () => {
    it('creates a payment with businessId and recordedById', async () => {
      const payment = {
        id: 'p1',
        businessId: 'biz1',
        amount: 100,
        method: 'CASH',
        recordedById: 'staff1',
      };
      prisma.payment.create.mockResolvedValue(payment as any);

      const result = await service.create('biz1', { amount: 100, method: 'CASH' }, 'staff1');

      expect(result).toEqual(payment);
      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          bookingId: undefined,
          customerId: undefined,
          amount: 100,
          method: 'CASH',
          reference: undefined,
          notes: undefined,
          recordedById: 'staff1',
        },
        include: { booking: true, customer: true },
      });
    });

    it('passes optional fields when provided', async () => {
      prisma.payment.create.mockResolvedValue({ id: 'p2' } as any);

      await service.create(
        'biz1',
        {
          amount: 250,
          method: 'CARD',
          bookingId: 'b1',
          customerId: 'c1',
          reference: 'REF-001',
          notes: 'Test note',
        },
        'staff1',
      );

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          bookingId: 'b1',
          customerId: 'c1',
          amount: 250,
          method: 'CARD',
          reference: 'REF-001',
          notes: 'Test note',
          recordedById: 'staff1',
        },
        include: { booking: true, customer: true },
      });
    });
  });

  describe('findAll', () => {
    it('lists payments filtered by businessId', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      const result = await service.findAll('biz1', {});

      expect(result).toEqual({ data: [], total: 0 });
      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
          include: { booking: true, customer: true },
        }),
      );
    });

    it('filters by bookingId when provided', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll('biz1', { bookingId: 'b1' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', bookingId: 'b1' },
        }),
      );
    });

    it('filters by customerId when provided', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll('biz1', { customerId: 'c1' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', customerId: 'c1' },
        }),
      );
    });

    it('applies date range filter', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll('biz1', {
        from: '2026-01-01',
        to: '2026-01-31',
      });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          },
        }),
      );
    });

    it('applies only from date when to is not provided', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll('biz1', { from: '2026-01-01' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            createdAt: { gte: new Date('2026-01-01') },
          },
        }),
      );
    });

    it('respects skip and take pagination params', async () => {
      prisma.payment.findMany.mockResolvedValue([]);
      prisma.payment.count.mockResolvedValue(0);

      await service.findAll('biz1', { skip: '10', take: '5' });

      expect(prisma.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 5 }),
      );
    });

    it('returns data and total count', async () => {
      const payments = [{ id: 'p1' }, { id: 'p2' }];
      prisma.payment.findMany.mockResolvedValue(payments as any);
      prisma.payment.count.mockResolvedValue(2);

      const result = await service.findAll('biz1', {});

      expect(result).toEqual({ data: payments, total: 2 });
    });
  });

  describe('findOne', () => {
    it('returns payment when found', async () => {
      const payment = { id: 'p1', businessId: 'biz1' };
      prisma.payment.findFirst.mockResolvedValue(payment as any);

      const result = await service.findOne('biz1', 'p1');

      expect(result).toEqual(payment);
    });

    it('throws NotFoundException when payment not found', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'p1')).rejects.toThrow(NotFoundException);
    });

    it('filters by businessId for tenant isolation', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      try {
        await service.findOne('biz1', 'p1');
      } catch {}

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', businessId: 'biz1' },
        include: { booking: true, customer: true },
      });
    });
  });

  describe('summary', () => {
    it('returns revenue summary without date filters', async () => {
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: 500 },
        _count: { id: 3 },
      } as any);
      prisma.payment.groupBy.mockResolvedValue([
        { method: 'CASH', _sum: { amount: 200 }, _count: { id: 1 } },
        { method: 'CARD', _sum: { amount: 300 }, _count: { id: 2 } },
      ] as any);

      const result = await service.summary('biz1');

      expect(result).toEqual({
        totalAmount: 500,
        count: 3,
        byMethod: [
          { method: 'CASH', totalAmount: 200, count: 1 },
          { method: 'CARD', totalAmount: 300, count: 2 },
        ],
      });
      expect(prisma.payment.aggregate).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        _sum: { amount: true },
        _count: { id: true },
      });
    });

    it('applies date range when from and to are provided', async () => {
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: 0 },
        _count: { id: 0 },
      } as any);
      prisma.payment.groupBy.mockResolvedValue([] as any);

      await service.summary('biz1', '2026-01-01', '2026-01-31');

      expect(prisma.payment.aggregate).toHaveBeenCalledWith({
        where: {
          businessId: 'biz1',
          createdAt: {
            gte: new Date('2026-01-01'),
            lte: new Date('2026-01-31'),
          },
        },
        _sum: { amount: true },
        _count: { id: true },
      });
    });

    it('defaults totalAmount to 0 when _sum.amount is null', async () => {
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: null },
        _count: { id: 0 },
      } as any);
      prisma.payment.groupBy.mockResolvedValue([] as any);

      const result = await service.summary('biz1');

      expect(result.totalAmount).toBe(0);
    });

    it('defaults byMethod totalAmount to 0 when _sum.amount is null', async () => {
      prisma.payment.aggregate.mockResolvedValue({
        _sum: { amount: 100 },
        _count: { id: 1 },
      } as any);
      prisma.payment.groupBy.mockResolvedValue([
        { method: 'CASH', _sum: { amount: null }, _count: { id: 0 } },
      ] as any);

      const result = await service.summary('biz1');

      expect(result.byMethod[0]!.totalAmount).toBe(0);
    });
  });

  describe('update', () => {
    it('updates notes and reference', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'p1',
        businessId: 'biz1',
      } as any);
      prisma.payment.update.mockResolvedValue({
        id: 'p1',
        notes: 'updated',
      } as any);

      await service.update('biz1', 'p1', { notes: 'updated' });

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { notes: 'updated' },
      });
    });

    it('updates only reference when notes is not provided', async () => {
      prisma.payment.findFirst.mockResolvedValue({
        id: 'p1',
        businessId: 'biz1',
      } as any);
      prisma.payment.update.mockResolvedValue({
        id: 'p1',
        reference: 'REF-002',
      } as any);

      await service.update('biz1', 'p1', { reference: 'REF-002' });

      expect(prisma.payment.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { reference: 'REF-002' },
      });
    });

    it('throws NotFoundException when payment not found', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      await expect(service.update('biz1', 'p1', { notes: 'x' })).rejects.toThrow(NotFoundException);
    });

    it('verifies tenant isolation before updating', async () => {
      prisma.payment.findFirst.mockResolvedValue(null);

      try {
        await service.update('biz1', 'p1', { notes: 'x' });
      } catch {}

      expect(prisma.payment.findFirst).toHaveBeenCalledWith({
        where: { id: 'p1', businessId: 'biz1' },
      });
    });
  });
});
