import { RejectionAnalyticsService } from './rejection-analytics.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('RejectionAnalyticsService', () => {
  let service: RejectionAnalyticsService;
  let prisma: MockPrisma;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new RejectionAnalyticsService(prisma as any);
  });

  describe('getLogs', () => {
    it('returns paginated rejection logs with filters', async () => {
      prisma.rejectionLog.findMany.mockResolvedValue([]);
      prisma.rejectionLog.count.mockResolvedValue(0);

      const result = await service.getLogs('biz1', {
        gate: 'GATE_1',
        rejectionCode: 'R01',
      } as any);

      expect(result).toEqual({ data: [], total: 0 });
      expect(prisma.rejectionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', gate: 'GATE_1', rejectionCode: 'R01' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('applies date range filter', async () => {
      prisma.rejectionLog.findMany.mockResolvedValue([]);
      prisma.rejectionLog.count.mockResolvedValue(0);

      await service.getLogs('biz1', {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      } as any);

      expect(prisma.rejectionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: new Date('2026-03-01'), lte: new Date('2026-03-31') },
          }),
        }),
      );
    });

    it('includes content draft details', async () => {
      prisma.rejectionLog.findMany.mockResolvedValue([]);
      prisma.rejectionLog.count.mockResolvedValue(0);

      await service.getLogs('biz1', {} as any);

      expect(prisma.rejectionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { contentDraft: { select: { title: true, contentType: true, pillar: true } } },
        }),
      );
    });
  });

  describe('getWeeklySummary', () => {
    it('returns weekly summary with week-over-week comparison', async () => {
      prisma.rejectionLog.count
        .mockResolvedValueOnce(10) // current week
        .mockResolvedValueOnce(8); // prev week
      prisma.rejectionLog.groupBy
        .mockResolvedValueOnce([{ rejectionCode: 'R01', _count: 5 }, { rejectionCode: 'R03', _count: 5 }] as any)
        .mockResolvedValueOnce([{ agentId: 'BlogWriter', _count: 7 }] as any);
      prisma.contentDraft.count.mockResolvedValue(50);

      const result = await service.getWeeklySummary('biz1');

      expect(result.totalRejections).toBe(10);
      expect(result.previousWeekRejections).toBe(8);
      expect(result.weekOverWeekChange).toBe(25); // (10-8)/8 * 100
      expect(result.rejectionRate).toBe(20); // 10/50 * 100
      expect(result.byCode).toEqual({ R01: 5, R03: 5 });
      expect(result.byAgent).toEqual({ BlogWriter: 7 });
    });

    it('handles zero previous week rejections', async () => {
      prisma.rejectionLog.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0);
      prisma.rejectionLog.groupBy.mockResolvedValue([] as any);
      prisma.contentDraft.count.mockResolvedValue(20);

      const result = await service.getWeeklySummary('biz1');

      expect(result.weekOverWeekChange).toBe(0);
    });
  });

  describe('getStats', () => {
    it('returns aggregate stats by gate, code, agent, severity', async () => {
      prisma.rejectionLog.groupBy
        .mockResolvedValueOnce([{ gate: 'GATE_1', _count: 5 }] as any)
        .mockResolvedValueOnce([{ rejectionCode: 'R01', _count: 3 }] as any)
        .mockResolvedValueOnce([{ agentId: 'BlogWriter', _count: 4 }] as any)
        .mockResolvedValueOnce([{ severity: 'MINOR', _count: 7 }] as any);

      const result = await service.getStats('biz1');

      expect(result.byGate).toEqual({ GATE_1: 5 });
      expect(result.byCode).toEqual({ R01: 3 });
      expect(result.byAgent).toEqual({ BlogWriter: 4 });
      expect(result.bySeverity).toEqual({ MINOR: 7 });
    });

    it('filters all queries by businessId', async () => {
      prisma.rejectionLog.groupBy.mockResolvedValue([] as any);

      await service.getStats('biz1');

      for (const call of prisma.rejectionLog.groupBy.mock.calls) {
        expect(call[0]).toEqual(expect.objectContaining({ where: { businessId: 'biz1' } }));
      }
    });
  });

  describe('getAgentRejectionDetails', () => {
    it('returns agent details with trend indicator', async () => {
      prisma.rejectionLog.count
        .mockResolvedValueOnce(15) // recent
        .mockResolvedValueOnce(10); // previous
      prisma.rejectionLog.groupBy.mockResolvedValue([{ rejectionCode: 'R01', _count: 8 }] as any);
      prisma.rejectionLog.findMany.mockResolvedValue([{ id: 'rl1' }] as any);

      const result = await service.getAgentRejectionDetails('biz1', 'BlogWriter');

      expect(result.agentId).toBe('BlogWriter');
      expect(result.recentRejections).toBe(15);
      expect(result.trend).toBe('up');
      expect(result.byCode).toEqual({ R01: 8 });
    });

    it('returns down trend when rejections decreased', async () => {
      prisma.rejectionLog.count
        .mockResolvedValueOnce(5) // recent
        .mockResolvedValueOnce(15); // previous
      prisma.rejectionLog.groupBy.mockResolvedValue([] as any);
      prisma.rejectionLog.findMany.mockResolvedValue([] as any);

      const result = await service.getAgentRejectionDetails('biz1', 'BlogWriter');

      expect(result.trend).toBe('down');
    });

    it('returns stable trend when similar', async () => {
      prisma.rejectionLog.count
        .mockResolvedValueOnce(10) // recent
        .mockResolvedValueOnce(10); // previous
      prisma.rejectionLog.groupBy.mockResolvedValue([] as any);
      prisma.rejectionLog.findMany.mockResolvedValue([] as any);

      const result = await service.getAgentRejectionDetails('biz1', 'BlogWriter');

      expect(result.trend).toBe('stable');
    });
  });

  describe('tenant isolation', () => {
    it('getLogs filters by businessId', async () => {
      prisma.rejectionLog.findMany.mockResolvedValue([]);
      prisma.rejectionLog.count.mockResolvedValue(0);

      await service.getLogs('biz1', {} as any);

      expect(prisma.rejectionLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });
  });
});
