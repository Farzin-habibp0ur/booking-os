import { NotFoundException } from '@nestjs/common';
import { AgentConfigService } from './agent-config.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('AgentConfigService', () => {
  let service: AgentConfigService;
  let prisma: MockPrisma;
  let mockQueue: { add: jest.Mock };

  const mockConfig = {
    id: 'cfg1',
    businessId: 'biz1',
    agentType: 'BlogWriter',
    isEnabled: true,
    autonomyLevel: 'SUGGEST',
    config: { description: 'SEO blog post writer' },
    roleVisibility: [],
    runIntervalMinutes: null,
    lastRunAt: null,
    nextRunAt: null,
    performanceScore: null,
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    mockQueue = { add: jest.fn() };
    service = new AgentConfigService(prisma as any, mockQueue as any);
  });

  describe('findAll', () => {
    it('seeds defaults then returns all configs for business', async () => {
      prisma.agentConfig.count.mockResolvedValue(12);
      prisma.agentConfig.findMany.mockResolvedValue([mockConfig] as any);

      const result = await service.findAll('biz1');

      expect(result).toEqual([mockConfig]);
      expect(prisma.agentConfig.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { agentType: 'asc' },
      });
    });

    it('seeds missing configs when count is less than 12', async () => {
      prisma.agentConfig.count.mockResolvedValue(0);
      prisma.agentConfig.create.mockResolvedValue({} as any);
      prisma.agentConfig.findMany.mockResolvedValue([]);

      await service.findAll('biz1');

      expect(prisma.agentConfig.create).toHaveBeenCalledTimes(12);
      expect(prisma.agentConfig.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            agentType: 'BlogWriter',
            isEnabled: false,
            autonomyLevel: 'SUGGEST',
          }),
        }),
      );
    });

    it('skips seeding when all 12 exist', async () => {
      prisma.agentConfig.count.mockResolvedValue(12);
      prisma.agentConfig.findMany.mockResolvedValue([]);

      await service.findAll('biz1');

      expect(prisma.agentConfig.create).not.toHaveBeenCalled();
    });

    it('handles duplicate constraint errors during seeding gracefully', async () => {
      prisma.agentConfig.count.mockResolvedValue(0);
      prisma.agentConfig.create.mockRejectedValue(new Error('Unique constraint'));
      prisma.agentConfig.findMany.mockResolvedValue([]);

      await expect(service.findAll('biz1')).resolves.toEqual([]);
    });
  });

  describe('findOne', () => {
    it('returns config by agentType', async () => {
      prisma.agentConfig.count.mockResolvedValue(12);
      prisma.agentConfig.findFirst.mockResolvedValue(mockConfig as any);

      const result = await service.findOne('biz1', 'BlogWriter');

      expect(result).toEqual(mockConfig);
      expect(prisma.agentConfig.findFirst).toHaveBeenCalledWith({
        where: { businessId: 'biz1', agentType: 'BlogWriter' },
      });
    });

    it('throws NotFoundException when not found', async () => {
      prisma.agentConfig.count.mockResolvedValue(12);
      prisma.agentConfig.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'Unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates config fields', async () => {
      prisma.agentConfig.count.mockResolvedValue(12);
      prisma.agentConfig.findFirst.mockResolvedValue(mockConfig as any);
      prisma.agentConfig.update.mockResolvedValue({
        ...mockConfig,
        isEnabled: false,
        runIntervalMinutes: 60,
      } as any);

      const result = await service.update('biz1', 'BlogWriter', {
        isEnabled: false,
        runIntervalMinutes: 60,
      });

      expect(prisma.agentConfig.update).toHaveBeenCalledWith({
        where: { id: 'cfg1' },
        data: {
          isEnabled: false,
          runIntervalMinutes: 60,
          autonomyLevel: undefined,
          config: undefined,
        },
      });
    });
  });

  describe('runNow', () => {
    it('adds job to AGENT_PROCESSING queue', async () => {
      prisma.agentConfig.count.mockResolvedValue(12);
      prisma.agentConfig.findFirst.mockResolvedValue(mockConfig as any);

      const result = await service.runNow('biz1', 'BlogWriter');

      expect(mockQueue.add).toHaveBeenCalledWith('run-agent', {
        businessId: 'biz1',
        agentType: 'BlogWriter',
        triggeredManually: true,
      });
      expect(result).toEqual({ queued: true, agentType: 'BlogWriter', businessId: 'biz1' });
    });

    it('works without queue (graceful degradation)', async () => {
      const serviceNoQueue = new AgentConfigService(prisma as any);
      prisma.agentConfig.count.mockResolvedValue(12);
      prisma.agentConfig.findFirst.mockResolvedValue(mockConfig as any);

      const result = await serviceNoQueue.runNow('biz1', 'BlogWriter');

      expect(result.queued).toBe(true);
    });
  });

  describe('getPerformanceSummary', () => {
    it('aggregates run stats by agent', async () => {
      prisma.agentRun.groupBy.mockResolvedValue([
        { agentType: 'BlogWriter', status: 'COMPLETED', _count: 10, _sum: { cardsCreated: 8 } },
        { agentType: 'BlogWriter', status: 'FAILED', _count: 2, _sum: { cardsCreated: 0 } },
        { agentType: 'SocialCreator', status: 'COMPLETED', _count: 5, _sum: { cardsCreated: 5 } },
      ] as any);

      const result = await service.getPerformanceSummary('biz1');

      expect(result.BlogWriter).toEqual({
        total: 12,
        completed: 10,
        failed: 2,
        cardsCreated: 8,
        successRate: 83,
      });
      expect(result.SocialCreator).toEqual({
        total: 5,
        completed: 5,
        failed: 0,
        cardsCreated: 5,
        successRate: 100,
      });
    });
  });

  describe('tenant isolation', () => {
    it('findAll filters by businessId', async () => {
      prisma.agentConfig.count.mockResolvedValue(12);
      prisma.agentConfig.findMany.mockResolvedValue([]);

      await service.findAll('biz1');

      expect(prisma.agentConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });

    it('getPerformanceSummary filters by businessId', async () => {
      prisma.agentRun.groupBy.mockResolvedValue([] as any);

      await service.getPerformanceSummary('biz1');

      expect(prisma.agentRun.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });
  });
});
