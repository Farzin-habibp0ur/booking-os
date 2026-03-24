import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { AgentConfigService } from './agent-config.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('AgentConfigService', () => {
  let service: AgentConfigService;
  let prisma: MockPrisma;
  let mockQueue: { add: jest.Mock };

  const mockConfig = {
    id: 'cfg1',
    businessId: 'biz1',
    agentType: 'WAITLIST',
    isEnabled: true,
    autonomyLevel: 'SUGGEST',
    config: { description: 'Waitlist agent' },
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
    it('returns only core agent configs, excluding marketing agents', async () => {
      prisma.agentConfig.findMany.mockResolvedValue([mockConfig] as any);

      const result = await service.findAll('biz1');

      expect(result).toEqual([mockConfig]);
      expect(prisma.agentConfig.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz1',
          agentType: {
            notIn: expect.arrayContaining(['BlogWriter', 'SocialCreator', 'ContentROI']),
          },
        },
        orderBy: { agentType: 'asc' },
      });
    });

    it('does not seed marketing agents', async () => {
      prisma.agentConfig.findMany.mockResolvedValue([]);

      await service.findAll('biz1');

      expect(prisma.agentConfig.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('returns config for a core agent type', async () => {
      prisma.agentConfig.findFirst.mockResolvedValue(mockConfig as any);

      const result = await service.findOne('biz1', 'WAITLIST');

      expect(result).toEqual(mockConfig);
      expect(prisma.agentConfig.findFirst).toHaveBeenCalledWith({
        where: { businessId: 'biz1', agentType: 'WAITLIST' },
      });
    });

    it('throws ForbiddenException for marketing agent types', async () => {
      await expect(service.findOne('biz1', 'BlogWriter')).rejects.toThrow(ForbiddenException);
      await expect(service.findOne('biz1', 'SocialCreator')).rejects.toThrow(ForbiddenException);
      await expect(service.findOne('biz1', 'ContentROI')).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.agentConfig.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'Unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates config fields', async () => {
      prisma.agentConfig.findFirst.mockResolvedValue(mockConfig as any);
      prisma.agentConfig.update.mockResolvedValue({
        ...mockConfig,
        isEnabled: false,
        runIntervalMinutes: 60,
      } as any);

      const result = await service.update('biz1', 'WAITLIST', {
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
      prisma.agentConfig.findFirst.mockResolvedValue(mockConfig as any);

      const result = await service.runNow('biz1', 'WAITLIST');

      expect(mockQueue.add).toHaveBeenCalledWith('run-agent', {
        businessId: 'biz1',
        agentType: 'WAITLIST',
        triggeredManually: true,
      });
      expect(result).toEqual({ queued: true, agentType: 'WAITLIST', businessId: 'biz1' });
    });

    it('works without queue (graceful degradation)', async () => {
      const serviceNoQueue = new AgentConfigService(prisma as any);
      prisma.agentConfig.findFirst.mockResolvedValue(mockConfig as any);

      const result = await serviceNoQueue.runNow('biz1', 'WAITLIST');

      expect(result.queued).toBe(true);
    });
  });

  describe('getPerformanceSummary', () => {
    it('aggregates run stats by agent, excluding marketing agents', async () => {
      prisma.agentRun.groupBy.mockResolvedValue([
        { agentType: 'WAITLIST', status: 'COMPLETED', _count: 10, _sum: { cardsCreated: 8 } },
        { agentType: 'WAITLIST', status: 'FAILED', _count: 2, _sum: { cardsCreated: 0 } },
        { agentType: 'RETENTION', status: 'COMPLETED', _count: 5, _sum: { cardsCreated: 5 } },
      ] as any);

      const result = await service.getPerformanceSummary('biz1');

      expect(result.WAITLIST).toEqual({
        total: 12,
        completed: 10,
        failed: 2,
        cardsCreated: 8,
        successRate: 83,
      });
      expect(result.RETENTION).toEqual({
        total: 5,
        completed: 5,
        failed: 0,
        cardsCreated: 5,
        successRate: 100,
      });

      // Verify marketing agents are excluded via notIn filter
      expect(prisma.agentRun.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            agentType: {
              notIn: expect.arrayContaining(['BlogWriter', 'SocialCreator']),
            },
          }),
        }),
      );
    });
  });

  describe('tenant isolation', () => {
    it('findAll filters by businessId', async () => {
      prisma.agentConfig.findMany.mockResolvedValue([]);

      await service.findAll('biz1');

      expect(prisma.agentConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz1' }),
        }),
      );
    });

    it('getPerformanceSummary filters by businessId', async () => {
      prisma.agentRun.groupBy.mockResolvedValue([] as any);

      await service.getPerformanceSummary('biz1');

      expect(prisma.agentRun.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz1' }),
        }),
      );
    });
  });
});
