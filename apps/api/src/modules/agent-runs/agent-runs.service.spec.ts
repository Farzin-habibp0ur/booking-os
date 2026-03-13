import { NotFoundException } from '@nestjs/common';
import { AgentRunsService } from './agent-runs.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('AgentRunsService', () => {
  let service: AgentRunsService;
  let prisma: MockPrisma;

  const mockRun = {
    id: 'run1',
    businessId: 'biz1',
    agentType: 'BlogWriter',
    status: 'COMPLETED',
    cardsCreated: 3,
    error: null,
    errors: null,
    startedAt: new Date('2026-03-01T10:00:00Z'),
    completedAt: new Date('2026-03-01T10:05:00Z'),
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AgentRunsService(prisma as any);
  });

  describe('findAll', () => {
    it('returns paginated runs with filters', async () => {
      prisma.agentRun.findMany.mockResolvedValue([mockRun] as any);
      prisma.agentRun.count.mockResolvedValue(1);

      const result = await service.findAll('biz1', {
        agentType: 'BlogWriter',
        status: 'COMPLETED',
      } as any);

      expect(result).toEqual({ data: [mockRun], total: 1 });
      expect(prisma.agentRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', agentType: 'BlogWriter', status: 'COMPLETED' },
          skip: 0,
          take: 20,
          orderBy: { startedAt: 'desc' },
        }),
      );
    });

    it('applies date range filters', async () => {
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.agentRun.count.mockResolvedValue(0);

      await service.findAll('biz1', {
        startDate: '2026-03-01',
        endDate: '2026-03-31',
      } as any);

      expect(prisma.agentRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            startedAt: {
              gte: new Date('2026-03-01'),
              lte: new Date('2026-03-31'),
            },
          }),
        }),
      );
    });

    it('caps take at 100', async () => {
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.agentRun.count.mockResolvedValue(0);

      await service.findAll('biz1', { take: '999' } as any);

      expect(prisma.agentRun.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 100 }));
    });
  });

  describe('findOne', () => {
    it('returns run by id', async () => {
      prisma.agentRun.findFirst.mockResolvedValue(mockRun as any);

      const result = await service.findOne('biz1', 'run1');

      expect(result).toEqual(mockRun);
      expect(prisma.agentRun.findFirst).toHaveBeenCalledWith({
        where: { id: 'run1', businessId: 'biz1' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      prisma.agentRun.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStats', () => {
    it('returns aggregate stats with agent breakdown', async () => {
      prisma.agentRun.groupBy.mockResolvedValue([
        { agentType: 'BlogWriter', status: 'COMPLETED', _count: 8, _sum: { cardsCreated: 6 } },
        { agentType: 'BlogWriter', status: 'FAILED', _count: 2, _sum: { cardsCreated: 0 } },
      ] as any);
      prisma.agentRun.aggregate.mockResolvedValue({
        _count: 10,
        _sum: { cardsCreated: 6 },
      } as any);

      const result = await service.getStats('biz1');

      expect(result.totalRuns).toBe(10);
      expect(result.totalCards).toBe(6);
      expect(result.successRate).toBe(80);
      expect(result.agentBreakdown.BlogWriter).toEqual({
        total: 10,
        completed: 8,
        failed: 2,
        cardsCreated: 6,
      });
    });

    it('handles zero runs', async () => {
      prisma.agentRun.groupBy.mockResolvedValue([] as any);
      prisma.agentRun.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { cardsCreated: null },
      } as any);

      const result = await service.getStats('biz1');

      expect(result.totalRuns).toBe(0);
      expect(result.successRate).toBe(0);
    });
  });

  describe('tenant isolation', () => {
    it('findAll filters by businessId', async () => {
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.agentRun.count.mockResolvedValue(0);

      await service.findAll('biz1', {} as any);

      expect(prisma.agentRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });

    it('findOne filters by businessId', async () => {
      prisma.agentRun.findFirst.mockResolvedValue(null);

      try {
        await service.findOne('biz1', 'run1');
      } catch {
        // expected
      }

      expect(prisma.agentRun.findFirst).toHaveBeenCalledWith({
        where: { id: 'run1', businessId: 'biz1' },
      });
    });

    it('getStats filters by businessId', async () => {
      prisma.agentRun.groupBy.mockResolvedValue([] as any);
      prisma.agentRun.aggregate.mockResolvedValue({
        _count: 0,
        _sum: { cardsCreated: null },
      } as any);

      await service.getStats('biz1');

      expect(prisma.agentRun.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });
  });
});
