import { Test } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ReportsService', () => {
  let reportsService: ReportsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    reportsService = module.get(ReportsService);
  });

  // ─── bookingsOverTime ─────────────────────────────────────────────

  describe('bookingsOverTime', () => {
    it('groups bookings by date and returns counts', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-01T10:00:00Z'), status: 'CONFIRMED' },
        { createdAt: new Date('2026-02-01T14:00:00Z'), status: 'COMPLETED' },
        { createdAt: new Date('2026-02-02T09:00:00Z'), status: 'CONFIRMED' },
      ] as any);

      const result = await reportsService.bookingsOverTime('biz1', 30);

      expect(result).toEqual([
        { date: '2026-02-01', count: 2 },
        { date: '2026-02-02', count: 1 },
      ]);
    });

    it('returns empty array when no bookings exist', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.bookingsOverTime('biz1', 30);

      expect(result).toEqual([]);
    });

    it('uses default 30 days when no days param is provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.bookingsOverTime('biz1');

      const call = prisma.booking.findMany.mock.calls[0][0] as any;
      const since = call.where.createdAt.gte as Date;
      const diffDays = Math.round((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(30);
    });

    it('uses custom days parameter for date filtering', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.bookingsOverTime('biz1', 7);

      const call = prisma.booking.findMany.mock.calls[0][0] as any;
      const since = call.where.createdAt.gte as Date;
      const diffDays = Math.round((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('filters by businessId', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.bookingsOverTime('biz-abc', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz-abc' }),
        }),
      );
    });

    it('orders results by createdAt ascending', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.bookingsOverTime('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('handles a single booking correctly', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-10T08:00:00Z'), status: 'CONFIRMED' },
      ] as any);

      const result = await reportsService.bookingsOverTime('biz1', 30);

      expect(result).toEqual([{ date: '2026-02-10', count: 1 }]);
    });

    it('handles multiple bookings on same date', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-05T08:00:00Z'), status: 'CONFIRMED' },
        { createdAt: new Date('2026-02-05T10:00:00Z'), status: 'CONFIRMED' },
        { createdAt: new Date('2026-02-05T14:00:00Z'), status: 'COMPLETED' },
        { createdAt: new Date('2026-02-05T16:00:00Z'), status: 'NO_SHOW' },
      ] as any);

      const result = await reportsService.bookingsOverTime('biz1', 30);

      expect(result).toEqual([{ date: '2026-02-05', count: 4 }]);
    });
  });

  // ─── noShowRate ───────────────────────────────────────────────────

  describe('noShowRate', () => {
    it('uses startDate/endDate when provided', async () => {
      prisma.booking.count.mockResolvedValue(0);
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-07');

      await reportsService.noShowRate('biz1', 30, start, end);

      expect(prisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: { gte: start, lte: end },
          }),
        }),
      );
    });

    it('falls back to days param when no startDate', async () => {
      prisma.booking.count.mockResolvedValue(0);

      await reportsService.noShowRate('biz1', 7);

      const call = prisma.booking.count.mock.calls[0][0] as any;
      expect(call.where.startTime.gte).toBeInstanceOf(Date);
      expect(call.where.startTime.lte).toBeUndefined();
    });

    it('calculates correct no-show rate', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(20) // total (COMPLETED + NO_SHOW)
        .mockResolvedValueOnce(5); // noShows

      const result = await reportsService.noShowRate('biz1', 30);

      expect(result).toEqual({ total: 20, noShows: 5, rate: 25 });
    });

    it('returns 0 rate when no bookings exist', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(0) // total
        .mockResolvedValueOnce(0); // noShows

      const result = await reportsService.noShowRate('biz1', 30);

      expect(result).toEqual({ total: 0, noShows: 0, rate: 0 });
    });

    it('returns 100 rate when all bookings are no-shows', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(10); // noShows

      const result = await reportsService.noShowRate('biz1', 30);

      expect(result).toEqual({ total: 10, noShows: 10, rate: 100 });
    });

    it('rounds the rate to the nearest integer', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(3) // total
        .mockResolvedValueOnce(1); // noShows

      const result = await reportsService.noShowRate('biz1', 30);

      // 1/3 = 33.33 → rounds to 33
      expect(result.rate).toBe(33);
    });

    it('only counts COMPLETED and NO_SHOW statuses for total', async () => {
      prisma.booking.count.mockResolvedValue(0);

      await reportsService.noShowRate('biz1', 30);

      expect(prisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['COMPLETED', 'NO_SHOW'] },
          }),
        }),
      );
    });

    it('uses startDate without endDate when endDate is not provided', async () => {
      prisma.booking.count.mockResolvedValue(0);
      const start = new Date('2026-01-01');

      await reportsService.noShowRate('biz1', 30, start);

      const call = prisma.booking.count.mock.calls[0][0] as any;
      expect(call.where.startTime).toEqual({ gte: start });
    });
  });

  // ─── responseTimes ────────────────────────────────────────────────

  describe('responseTimes', () => {
    it('calculates average response time from inbound-outbound message pairs', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          messages: [
            { direction: 'INBOUND', createdAt: new Date('2026-02-01T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T10:05:00Z') }, // 5 min
          ],
        },
        {
          messages: [
            { direction: 'INBOUND', createdAt: new Date('2026-02-02T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-02T10:15:00Z') }, // 15 min
          ],
        },
      ] as any);

      const result = await reportsService.responseTimes('biz1');

      // Average of 5 and 15 = 10 min
      expect(result).toEqual({ avgMinutes: 10, sampleSize: 2 });
    });

    it('returns zero when no conversations exist', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);

      const result = await reportsService.responseTimes('biz1');

      expect(result).toEqual({ avgMinutes: 0, sampleSize: 0 });
    });

    it('returns zero when conversations have no inbound-outbound pairs', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          messages: [
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T10:05:00Z') },
          ],
        },
      ] as any);

      const result = await reportsService.responseTimes('biz1');

      expect(result).toEqual({ avgMinutes: 0, sampleSize: 0 });
    });

    it('only measures first outbound after each inbound', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          messages: [
            { direction: 'INBOUND', createdAt: new Date('2026-02-01T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T10:10:00Z') }, // 10 min - counted
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T10:20:00Z') }, // not counted, no preceding inbound
          ],
        },
      ] as any);

      const result = await reportsService.responseTimes('biz1');

      expect(result).toEqual({ avgMinutes: 10, sampleSize: 1 });
    });

    it('handles multiple inbound-outbound pairs in a single conversation', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          messages: [
            { direction: 'INBOUND', createdAt: new Date('2026-02-01T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T10:02:00Z') }, // 2 min
            { direction: 'INBOUND', createdAt: new Date('2026-02-01T11:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T11:08:00Z') }, // 8 min
          ],
        },
      ] as any);

      const result = await reportsService.responseTimes('biz1');

      // Average of 2 and 8 = 5 min
      expect(result).toEqual({ avgMinutes: 5, sampleSize: 2 });
    });

    it('ignores inbound messages with no subsequent outbound', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          messages: [
            { direction: 'INBOUND', createdAt: new Date('2026-02-01T10:00:00Z') },
            // No outbound response
          ],
        },
      ] as any);

      const result = await reportsService.responseTimes('biz1');

      expect(result).toEqual({ avgMinutes: 0, sampleSize: 0 });
    });

    it('rounds average to nearest integer', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          messages: [
            { direction: 'INBOUND', createdAt: new Date('2026-02-01T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T10:03:00Z') }, // 3 min
          ],
        },
        {
          messages: [
            { direction: 'INBOUND', createdAt: new Date('2026-02-02T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-02T10:04:00Z') }, // 4 min
          ],
        },
        {
          messages: [
            { direction: 'INBOUND', createdAt: new Date('2026-02-03T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-03T10:03:00Z') }, // 3 min
          ],
        },
      ] as any);

      const result = await reportsService.responseTimes('biz1');

      // Average of 3, 4, 3 = 3.33 → rounds to 3
      expect(result.avgMinutes).toBe(3);
      expect(result.sampleSize).toBe(3);
    });

    it('queries conversations for the correct business', async () => {
      prisma.conversation.findMany.mockResolvedValue([]);

      await reportsService.responseTimes('biz-xyz');

      expect(prisma.conversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz-xyz' },
          take: 100,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('ignores outbound messages that precede any inbound message', async () => {
      prisma.conversation.findMany.mockResolvedValue([
        {
          messages: [
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T09:00:00Z') }, // no preceding inbound
            { direction: 'INBOUND', createdAt: new Date('2026-02-01T10:00:00Z') },
            { direction: 'OUTBOUND', createdAt: new Date('2026-02-01T10:06:00Z') }, // 6 min
          ],
        },
      ] as any);

      const result = await reportsService.responseTimes('biz1');

      expect(result).toEqual({ avgMinutes: 6, sampleSize: 1 });
    });
  });

  // ─── serviceBreakdown ─────────────────────────────────────────────

  describe('serviceBreakdown', () => {
    it('groups bookings by service with count and revenue', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { service: { id: 'svc1', name: 'Botox', price: 200 } },
        { service: { id: 'svc1', name: 'Botox', price: 200 } },
        { service: { id: 'svc2', name: 'Facial', price: 100 } },
      ] as any);

      const result = await reportsService.serviceBreakdown('biz1', 30);

      expect(result).toEqual([
        { name: 'Botox', count: 2, revenue: 400 },
        { name: 'Facial', count: 1, revenue: 100 },
      ]);
    });

    it('returns empty array when no bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.serviceBreakdown('biz1', 30);

      expect(result).toEqual([]);
    });

    it('sorts results by count descending', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { service: { id: 'svc1', name: 'Botox', price: 200 } },
        { service: { id: 'svc2', name: 'Facial', price: 100 } },
        { service: { id: 'svc2', name: 'Facial', price: 100 } },
        { service: { id: 'svc2', name: 'Facial', price: 100 } },
        { service: { id: 'svc3', name: 'Filler', price: 300 } },
        { service: { id: 'svc3', name: 'Filler', price: 300 } },
      ] as any);

      const result = await reportsService.serviceBreakdown('biz1', 30);

      expect(result[0].name).toBe('Facial');
      expect(result[0].count).toBe(3);
      expect(result[1].name).toBe('Filler');
      expect(result[1].count).toBe(2);
      expect(result[2].name).toBe('Botox');
      expect(result[2].count).toBe(1);
    });

    it('uses custom days parameter', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.serviceBreakdown('biz1', 14);

      const call = prisma.booking.findMany.mock.calls[0][0] as any;
      const since = call.where.createdAt.gte as Date;
      const diffDays = Math.round((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(14);
    });

    it('includes service relation in query', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.serviceBreakdown('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { service: { select: { id: true, name: true, price: true } } },
        }),
      );
    });

    it('accumulates revenue correctly for same service', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { service: { id: 'svc1', name: 'Botox', price: 150 } },
        { service: { id: 'svc1', name: 'Botox', price: 150 } },
        { service: { id: 'svc1', name: 'Botox', price: 150 } },
      ] as any);

      const result = await reportsService.serviceBreakdown('biz1', 30);

      expect(result).toEqual([{ name: 'Botox', count: 3, revenue: 450 }]);
    });
  });

  // ─── staffPerformance ─────────────────────────────────────────────

  describe('staffPerformance', () => {
    it('aggregates staff booking stats correctly', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 200 }, status: 'COMPLETED' },
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 150 }, status: 'COMPLETED' },
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 100 }, status: 'NO_SHOW' },
        { staff: { id: 'st2', name: 'Dr. Lee' }, service: { price: 300 }, status: 'COMPLETED' },
      ] as any);

      const result = await reportsService.staffPerformance('biz1', 30);

      expect(result).toEqual([
        {
          staffId: 'st1',
          name: 'Dr. Chen',
          total: 3,
          completed: 2,
          noShows: 1,
          revenue: 350,
          noShowRate: 33,
        },
        {
          staffId: 'st2',
          name: 'Dr. Lee',
          total: 1,
          completed: 1,
          noShows: 0,
          revenue: 300,
          noShowRate: 0,
        },
      ]);
    });

    it('returns empty array when no bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.staffPerformance('biz1', 30);

      expect(result).toEqual([]);
    });

    it('sorts by total bookings descending', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 100 }, status: 'COMPLETED' },
        { staff: { id: 'st2', name: 'Dr. Lee' }, service: { price: 100 }, status: 'COMPLETED' },
        { staff: { id: 'st2', name: 'Dr. Lee' }, service: { price: 100 }, status: 'COMPLETED' },
        { staff: { id: 'st2', name: 'Dr. Lee' }, service: { price: 100 }, status: 'COMPLETED' },
      ] as any);

      const result = await reportsService.staffPerformance('biz1', 30);

      expect(result[0].staffId).toBe('st2');
      expect(result[0].total).toBe(3);
      expect(result[1].staffId).toBe('st1');
      expect(result[1].total).toBe(1);
    });

    it('only counts revenue from COMPLETED bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 200 }, status: 'COMPLETED' },
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 150 }, status: 'NO_SHOW' },
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 100 }, status: 'CONFIRMED' },
      ] as any);

      const result = await reportsService.staffPerformance('biz1', 30);

      expect(result[0].revenue).toBe(200);
      expect(result[0].completed).toBe(1);
    });

    it('skips bookings with null staff', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { staff: null, service: { price: 200 }, status: 'COMPLETED' },
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 100 }, status: 'COMPLETED' },
      ] as any);

      const result = await reportsService.staffPerformance('biz1', 30);

      expect(result).toHaveLength(1);
      expect(result[0].staffId).toBe('st1');
    });

    it('filters only bookings with staffId not null', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.staffPerformance('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ staffId: { not: null } }),
        }),
      );
    });

    it('uses custom days parameter', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.staffPerformance('biz1', 60);

      const call = prisma.booking.findMany.mock.calls[0][0] as any;
      const since = call.where.createdAt.gte as Date;
      const diffDays = Math.round((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(60);
    });

    it('calculates noShowRate correctly', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 100 }, status: 'NO_SHOW' },
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 100 }, status: 'NO_SHOW' },
        { staff: { id: 'st1', name: 'Dr. Chen' }, service: { price: 100 }, status: 'COMPLETED' },
      ] as any);

      const result = await reportsService.staffPerformance('biz1', 30);

      // 2/3 = 66.67 → rounds to 67
      expect(result[0].noShowRate).toBe(67);
    });
  });

  // ─── revenueOverTime ──────────────────────────────────────────────

  describe('revenueOverTime', () => {
    it('groups completed booking revenue by date', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-01T10:00:00Z'), service: { price: 200 } },
        { createdAt: new Date('2026-02-01T14:00:00Z'), service: { price: 150 } },
        { createdAt: new Date('2026-02-02T09:00:00Z'), service: { price: 300 } },
      ] as any);

      const result = await reportsService.revenueOverTime('biz1', 30);

      expect(result).toEqual([
        { date: '2026-02-01', revenue: 350 },
        { date: '2026-02-02', revenue: 300 },
      ]);
    });

    it('returns empty array when no completed bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.revenueOverTime('biz1', 30);

      expect(result).toEqual([]);
    });

    it('uses startDate and endDate when provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      await reportsService.revenueOverTime('biz1', 30, start, end);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: start, lte: end },
          }),
        }),
      );
    });

    it('uses startDate without endDate', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      const start = new Date('2026-01-01');

      await reportsService.revenueOverTime('biz1', 30, start);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: start },
          }),
        }),
      );
    });

    it('falls back to days when no startDate provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.revenueOverTime('biz1', 14);

      const call = prisma.booking.findMany.mock.calls[0][0] as any;
      const since = call.where.createdAt.gte as Date;
      const diffDays = Math.round((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(14);
    });

    it('filters only COMPLETED bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.revenueOverTime('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('rounds revenue to 2 decimal places', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-01T10:00:00Z'), service: { price: 99.99 } },
        { createdAt: new Date('2026-02-01T14:00:00Z'), service: { price: 0.01 } },
      ] as any);

      const result = await reportsService.revenueOverTime('biz1', 30);

      expect(result).toEqual([{ date: '2026-02-01', revenue: 100 }]);
    });

    it('orders by createdAt ascending', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.revenueOverTime('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'asc' },
        }),
      );
    });

    it('handles fractional prices without floating point errors', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { createdAt: new Date('2026-02-01T10:00:00Z'), service: { price: 33.33 } },
        { createdAt: new Date('2026-02-01T11:00:00Z'), service: { price: 33.33 } },
        { createdAt: new Date('2026-02-01T12:00:00Z'), service: { price: 33.34 } },
      ] as any);

      const result = await reportsService.revenueOverTime('biz1', 30);

      expect(result[0].revenue).toBe(100);
    });
  });

  // ─── statusBreakdown ──────────────────────────────────────────────

  describe('statusBreakdown', () => {
    it('returns counts by status', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'NO_SHOW' },
        { status: 'CONFIRMED' },
        { status: 'CANCELLED' },
        { status: 'CANCELLED' },
      ] as any);

      const result = await reportsService.statusBreakdown('biz1', 30);

      expect(result).toEqual(
        expect.arrayContaining([
          { status: 'COMPLETED', count: 2 },
          { status: 'NO_SHOW', count: 1 },
          { status: 'CONFIRMED', count: 1 },
          { status: 'CANCELLED', count: 2 },
        ]),
      );
    });

    it('returns empty array when no bookings exist', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.statusBreakdown('biz1', 30);

      expect(result).toEqual([]);
    });

    it('uses startDate and endDate when provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      await reportsService.statusBreakdown('biz1', 30, start, end);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: start, lte: end },
          }),
        }),
      );
    });

    it('uses startDate without endDate', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      const start = new Date('2026-02-01');

      await reportsService.statusBreakdown('biz1', 30, start);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: start },
          }),
        }),
      );
    });

    it('falls back to days param when no startDate', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.statusBreakdown('biz1', 7);

      const call = prisma.booking.findMany.mock.calls[0][0] as any;
      const since = call.where.createdAt.gte as Date;
      const diffDays = Math.round((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(7);
    });

    it('handles a single status', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
      ] as any);

      const result = await reportsService.statusBreakdown('biz1', 30);

      expect(result).toEqual([{ status: 'COMPLETED', count: 3 }]);
    });

    it('selects only status field', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.statusBreakdown('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { status: true },
        }),
      );
    });
  });

  // ─── consultToTreatmentConversion ─────────────────────────────────

  describe('consultToTreatmentConversion', () => {
    it('returns zero when no consult bookings exist', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(result).toEqual({ consultCustomers: 0, converted: 0, rate: 0 });
    });

    it('calculates conversion when some consult customers booked treatments', async () => {
      // Customers with completed consult bookings
      prisma.booking.findMany.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
        { customerId: 'c3' },
        { customerId: 'c1' }, // duplicate — same customer, two consults
      ] as any);

      // 2 of 3 unique consult customers later booked a treatment
      prisma.booking.groupBy.mockResolvedValue([{ customerId: 'c1' }, { customerId: 'c3' }] as any);

      const result = await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(result.consultCustomers).toBe(3); // 3 unique customers
      expect(result.converted).toBe(2);
      expect(result.rate).toBe(67); // 2/3 = 66.67 → rounds to 67
    });

    it('returns 100% when all consult customers converted', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
      ] as any);

      prisma.booking.groupBy.mockResolvedValue([{ customerId: 'c1' }, { customerId: 'c2' }] as any);

      const result = await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(result.rate).toBe(100);
    });

    it('queries consult bookings with COMPLETED status', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            status: 'COMPLETED',
            service: { kind: 'CONSULT' },
          }),
        }),
      );
    });

    it('checks treatment bookings with valid statuses', async () => {
      prisma.booking.findMany.mockResolvedValue([{ customerId: 'c1' }] as any);
      prisma.booking.groupBy.mockResolvedValue([]);

      await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(prisma.booking.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] },
            service: { kind: 'TREATMENT' },
          }),
        }),
      );
    });

    it('uses startDate and endDate when provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      await reportsService.consultToTreatmentConversion('biz1', 30, start, end);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: { gte: start, lte: end },
          }),
        }),
      );
    });

    it('falls back to days when no startDate', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.consultToTreatmentConversion('biz1', 14);

      const call = prisma.booking.findMany.mock.calls[0][0] as any;
      const since = call.where.startTime.gte as Date;
      const diffDays = Math.round((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(14);
    });

    it('deduplicates customer IDs before counting', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c1' },
        { customerId: 'c1' },
      ] as any);

      prisma.booking.groupBy.mockResolvedValue([{ customerId: 'c1' }] as any);

      const result = await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(result.consultCustomers).toBe(1);
      expect(result.converted).toBe(1);
      expect(result.rate).toBe(100);
    });

    it('returns 0% when no consult customers converted', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
      ] as any);

      prisma.booking.groupBy.mockResolvedValue([] as any);

      const result = await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(result).toEqual({ consultCustomers: 2, converted: 0, rate: 0 });
    });

    it('passes unique consult customer IDs to groupBy query', async () => {
      prisma.booking.findMany.mockResolvedValue([
        { customerId: 'c1' },
        { customerId: 'c2' },
        { customerId: 'c1' },
      ] as any);

      prisma.booking.groupBy.mockResolvedValue([]);

      await reportsService.consultToTreatmentConversion('biz1', 30);

      expect(prisma.booking.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: { in: expect.arrayContaining(['c1', 'c2']) },
          }),
        }),
      );
    });
  });

  // ─── depositComplianceRate ────────────────────────────────────────

  describe('depositComplianceRate', () => {
    it('returns correct counts for deposit-required bookings', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(10) // totalRequired
        .mockResolvedValueOnce(7); // paid

      const result = await reportsService.depositComplianceRate('biz1');

      expect(result).toEqual({ totalRequired: 10, paid: 7, rate: 70 });
    });

    it('returns 0 rate when no deposit-required bookings', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(0) // totalRequired
        .mockResolvedValueOnce(0); // paid

      const result = await reportsService.depositComplianceRate('biz1');

      expect(result).toEqual({ totalRequired: 0, paid: 0, rate: 0 });
    });

    it('returns 100% when all deposits are paid', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(5) // totalRequired
        .mockResolvedValueOnce(5); // paid

      const result = await reportsService.depositComplianceRate('biz1');

      expect(result).toEqual({ totalRequired: 5, paid: 5, rate: 100 });
    });

    it('rounds rate to nearest integer', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(3) // totalRequired
        .mockResolvedValueOnce(1); // paid

      const result = await reportsService.depositComplianceRate('biz1');

      // 1/3 = 33.33 → rounds to 33
      expect(result.rate).toBe(33);
    });

    it('uses startDate and endDate when provided', async () => {
      prisma.booking.count.mockResolvedValue(0);
      const start = new Date('2026-01-01');
      const end = new Date('2026-01-31');

      await reportsService.depositComplianceRate('biz1', start, end);

      expect(prisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: { gte: start, lte: end },
          }),
        }),
      );
    });

    it('uses startDate without endDate', async () => {
      prisma.booking.count.mockResolvedValue(0);
      const start = new Date('2026-01-01');

      await reportsService.depositComplianceRate('biz1', start);

      expect(prisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startTime: { gte: start },
          }),
        }),
      );
    });

    it('filters for deposit-required services', async () => {
      prisma.booking.count.mockResolvedValue(0);

      await reportsService.depositComplianceRate('biz1');

      expect(prisma.booking.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            service: { depositRequired: true },
          }),
        }),
      );
    });

    it('counts paid as CONFIRMED or COMPLETED status', async () => {
      prisma.booking.count.mockResolvedValue(0);

      await reportsService.depositComplianceRate('biz1');

      // Second call is the "paid" query
      const secondCall = prisma.booking.count.mock.calls[1]?.[0] as any;
      expect(secondCall?.where?.status).toEqual({ in: ['CONFIRMED', 'COMPLETED'] });
    });

    it('omits startTime filter when no dates provided', async () => {
      prisma.booking.count.mockResolvedValue(0);

      await reportsService.depositComplianceRate('biz1');

      const call = prisma.booking.count.mock.calls[0][0] as any;
      expect(call.where.startTime).toBeUndefined();
    });
  });

  // ─── peakHours ────────────────────────────────────────────────────

  describe('peakHours', () => {
    it('counts bookings by hour and day of week', async () => {
      // Monday Feb 2, 2026 at 10:00 AM (UTC)
      // getDay() = 1 (Monday), getHours() depends on local time
      const date1 = new Date('2026-02-02T10:00:00Z');
      const date2 = new Date('2026-02-02T14:00:00Z');
      const date3 = new Date('2026-02-03T10:00:00Z'); // Tuesday

      prisma.booking.findMany.mockResolvedValue([
        { startTime: date1 },
        { startTime: date2 },
        { startTime: date3 },
      ] as any);

      const result = await reportsService.peakHours('biz1', 30);

      expect(result.byHour).toHaveLength(24);
      expect(result.byDay).toHaveLength(7);

      // Check that the total count across all hours equals number of bookings
      const totalHourCount = result.byHour.reduce((sum, h) => sum + h.count, 0);
      expect(totalHourCount).toBe(3);

      // Check that the total count across all days equals number of bookings
      const totalDayCount = result.byDay.reduce((sum, d) => sum + d.count, 0);
      expect(totalDayCount).toBe(3);
    });

    it('returns all zeros when no bookings', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.peakHours('biz1', 30);

      expect(result.byHour).toHaveLength(24);
      expect(result.byDay).toHaveLength(7);
      expect(result.byHour.every((h) => h.count === 0)).toBe(true);
      expect(result.byDay.every((d) => d.count === 0)).toBe(true);
    });

    it('returns correct hour indexes 0-23', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.peakHours('biz1', 30);

      const hours = result.byHour.map((h) => h.hour);
      expect(hours).toEqual(Array.from({ length: 24 }, (_, i) => i));
    });

    it('returns correct day indexes 0-6', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      const result = await reportsService.peakHours('biz1', 30);

      const days = result.byDay.map((d) => d.day);
      expect(days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    });

    it('uses custom days parameter', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.peakHours('biz1', 90);

      const call = prisma.booking.findMany.mock.calls[0][0] as any;
      const since = call.where.startTime.gte as Date;
      const diffDays = Math.round((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24));
      expect(diffDays).toBe(90);
    });

    it('filters by businessId and startTime', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.peakHours('biz-abc', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz-abc',
            startTime: expect.objectContaining({ gte: expect.any(Date) }),
          }),
        }),
      );
    });

    it('selects only startTime', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await reportsService.peakHours('biz1', 30);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          select: { startTime: true },
        }),
      );
    });

    it('accumulates multiple bookings in the same hour', async () => {
      const hour = new Date();
      hour.setMinutes(0, 0, 0);
      const sameHour1 = new Date(hour);
      const sameHour2 = new Date(hour.getTime() + 15 * 60000);
      const sameHour3 = new Date(hour.getTime() + 30 * 60000);

      prisma.booking.findMany.mockResolvedValue([
        { startTime: sameHour1 },
        { startTime: sameHour2 },
        { startTime: sameHour3 },
      ] as any);

      const result = await reportsService.peakHours('biz1', 30);

      const hourBucket = result.byHour.find((h) => h.hour === hour.getHours());
      expect(hourBucket?.count).toBe(3);
    });
  });
});
