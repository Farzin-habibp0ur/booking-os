import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConsoleAgentsService } from './console-agents.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleAgentsService', () => {
  let service: ConsoleAgentsService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [
        ConsoleAgentsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = module.get(ConsoleAgentsService);
  });

  describe('getPerformanceDashboard', () => {
    it('returns aggregated stats from runs and feedback', async () => {
      const now = new Date();
      prisma.agentRun.findMany.mockResolvedValue([
        { id: '1', businessId: 'biz1', agentType: 'WAITLIST', status: 'COMPLETED', cardsCreated: 3, startedAt: now, completedAt: now, error: null },
        { id: '2', businessId: 'biz1', agentType: 'WAITLIST', status: 'FAILED', cardsCreated: 0, startedAt: now, completedAt: null, error: 'timeout' },
        { id: '3', businessId: 'biz2', agentType: 'RETENTION', status: 'COMPLETED', cardsCreated: 2, startedAt: now, completedAt: now, error: null },
      ] as any);
      prisma.agentFeedback.findMany.mockResolvedValue([
        { id: 'f1', businessId: 'biz1', rating: 'HELPFUL', createdAt: now },
        { id: 'f2', businessId: 'biz1', rating: 'NOT_HELPFUL', createdAt: now },
        { id: 'f3', businessId: 'biz2', rating: 'HELPFUL', createdAt: now },
      ] as any);

      const result = await service.getPerformanceDashboard();

      expect(result.totalRuns).toBe(3);
      expect(result.successRate).toBe(67);
      expect(result.cardsCreated).toBe(5);
      expect(result.feedbackHelpfulRate).toBe(67);
      expect(result.byAgentType).toHaveLength(5);

      const waitlist = result.byAgentType.find((a) => a.agentType === 'WAITLIST');
      expect(waitlist?.runs).toBe(2);
      expect(waitlist?.completed).toBe(1);
      expect(waitlist?.failed).toBe(1);
    });

    it('handles empty data gracefully', async () => {
      prisma.agentRun.findMany.mockResolvedValue([]);
      prisma.agentFeedback.findMany.mockResolvedValue([]);

      const result = await service.getPerformanceDashboard();

      expect(result.totalRuns).toBe(0);
      expect(result.successRate).toBe(0);
      expect(result.cardsCreated).toBe(0);
      expect(result.feedbackHelpfulRate).toBe(0);
      expect(result.byAgentType).toHaveLength(5);
      expect(result.byAgentType[0].runs).toBe(0);
    });

    it('groups stats by agent type correctly', async () => {
      const now = new Date();
      prisma.agentRun.findMany.mockResolvedValue([
        { id: '1', businessId: 'biz1', agentType: 'DATA_HYGIENE', status: 'COMPLETED', cardsCreated: 5, startedAt: now },
        { id: '2', businessId: 'biz1', agentType: 'DATA_HYGIENE', status: 'COMPLETED', cardsCreated: 3, startedAt: now },
      ] as any);
      prisma.agentFeedback.findMany.mockResolvedValue([]);

      const result = await service.getPerformanceDashboard();

      const hygiene = result.byAgentType.find((a) => a.agentType === 'DATA_HYGIENE');
      expect(hygiene?.runs).toBe(2);
      expect(hygiene?.completed).toBe(2);
      expect(hygiene?.successRate).toBe(100);
      expect(hygiene?.cardsCreated).toBe(8);
    });
  });

  describe('getActionCardFunnel', () => {
    it('counts cards by status', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        { status: 'PENDING' },
        { status: 'PENDING' },
        { status: 'APPROVED' },
        { status: 'DISMISSED' },
        { status: 'EXECUTED' },
        { status: 'EXECUTED' },
        { status: 'EXPIRED' },
        { status: 'SNOOZED' },
      ] as any);

      const result = await service.getActionCardFunnel();

      expect(result.total).toBe(8);
      expect(result.pending).toBe(2);
      expect(result.approved).toBe(1);
      expect(result.dismissed).toBe(1);
      expect(result.executed).toBe(2);
      expect(result.expired).toBe(1);
      expect(result.snoozed).toBe(1);
      expect(result.approvalRate).toBe(38); // (1+2)/8 = 37.5 → 38
      expect(result.executionRate).toBe(25); // 2/8
    });

    it('handles empty cards', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);

      const result = await service.getActionCardFunnel();

      expect(result.total).toBe(0);
      expect(result.approvalRate).toBe(0);
      expect(result.executionRate).toBe(0);
    });
  });

  describe('getTopFailures', () => {
    it('groups and sorts failures by count', async () => {
      const now = new Date();
      prisma.agentRun.findMany.mockResolvedValue([
        { id: '1', error: 'timeout', agentType: 'WAITLIST', startedAt: now, status: 'FAILED' },
        { id: '2', error: 'timeout', agentType: 'WAITLIST', startedAt: now, status: 'FAILED' },
        { id: '3', error: 'rate_limit', agentType: 'RETENTION', startedAt: now, status: 'FAILED' },
      ] as any);

      const result = await service.getTopFailures();

      expect(result).toHaveLength(2);
      expect(result[0].error).toBe('timeout');
      expect(result[0].count).toBe(2);
      expect(result[1].error).toBe('rate_limit');
      expect(result[1].count).toBe(1);
    });

    it('handles null error as "Unknown error"', async () => {
      const now = new Date();
      prisma.agentRun.findMany.mockResolvedValue([
        { id: '1', error: null, agentType: 'WAITLIST', startedAt: now, status: 'FAILED' },
      ] as any);

      const result = await service.getTopFailures();

      expect(result[0].error).toBe('Unknown error');
    });

    it('respects limit parameter', async () => {
      const now = new Date();
      const runs = Array.from({ length: 15 }, (_, i) => ({
        id: `${i}`,
        error: `error_${i}`,
        agentType: 'WAITLIST',
        startedAt: now,
        status: 'FAILED',
      }));
      prisma.agentRun.findMany.mockResolvedValue(runs as any);

      const result = await service.getTopFailures(5);

      expect(result).toHaveLength(5);
    });

    it('returns empty array when no failures', async () => {
      prisma.agentRun.findMany.mockResolvedValue([]);

      const result = await service.getTopFailures();

      expect(result).toEqual([]);
    });
  });

  describe('getAbnormalTenants', () => {
    it('flags tenants with >2x avg failure rate', async () => {
      prisma.agentRun.findMany.mockResolvedValue([
        // biz1: 5/5 fail = 100%
        ...Array.from({ length: 5 }, () => ({ businessId: 'biz1', status: 'FAILED' })),
        // biz2: 0/15 fail = 0% → platform avg = 5/20 = 25%, threshold = 50%
        ...Array.from({ length: 15 }, () => ({ businessId: 'biz2', status: 'COMPLETED' })),
      ] as any);

      prisma.business.findMany.mockResolvedValue([
        { id: 'biz1', name: 'Bad Clinic', slug: 'bad-clinic' },
      ] as any);

      const result = await service.getAbnormalTenants();

      expect(result).toHaveLength(1);
      expect(result[0].businessId).toBe('biz1');
      expect(result[0].businessName).toBe('Bad Clinic');
      expect(result[0].failureRate).toBe(100);
      expect(result[0].platformAvgRate).toBe(25);
    });

    it('returns empty array when no runs', async () => {
      prisma.agentRun.findMany.mockResolvedValue([]);

      const result = await service.getAbnormalTenants();

      expect(result).toEqual([]);
    });

    it('returns empty when all tenants are similar', async () => {
      prisma.agentRun.findMany.mockResolvedValue([
        { businessId: 'biz1', status: 'FAILED' },
        { businessId: 'biz1', status: 'COMPLETED' },
        { businessId: 'biz2', status: 'FAILED' },
        { businessId: 'biz2', status: 'COMPLETED' },
      ] as any);

      const result = await service.getAbnormalTenants();

      expect(result).toEqual([]);
    });
  });

  describe('getTenantAgentStatus', () => {
    it('returns agent configs and recent stats', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Test Clinic',
      } as any);

      prisma.agentConfig.findMany.mockResolvedValue([
        { agentType: 'WAITLIST', isEnabled: true, autonomyLevel: 'AUTO' },
        { agentType: 'RETENTION', isEnabled: false, autonomyLevel: 'SUGGEST' },
      ] as any);

      const now = new Date();
      prisma.agentRun.findMany.mockResolvedValue([
        { agentType: 'WAITLIST', status: 'COMPLETED', cardsCreated: 2, startedAt: now },
        { agentType: 'WAITLIST', status: 'FAILED', cardsCreated: 0, startedAt: now },
      ] as any);

      const result = await service.getTenantAgentStatus('biz1');

      expect(result.businessName).toBe('Test Clinic');
      expect(result.agents).toHaveLength(5);
      const waitlist = result.agents.find((a) => a.agentType === 'WAITLIST');
      expect(waitlist?.isEnabled).toBe(true);
      expect(waitlist?.autonomyLevel).toBe('AUTO');
      expect(waitlist?.runsLast7d).toBe(2);
      expect(waitlist?.successRate).toBe(50);
    });

    it('throws NotFoundException for invalid business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.getTenantAgentStatus('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('pauseAllAgents', () => {
    it('disables all agent configs for business', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.agentConfig.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.pauseAllAgents('biz1');

      expect(result.affectedCount).toBe(3);
      expect(prisma.agentConfig.updateMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        data: { isEnabled: false },
      });
    });

    it('throws NotFoundException for invalid business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.pauseAllAgents('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('resumeAllAgents', () => {
    it('enables all agent configs for business', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.agentConfig.updateMany.mockResolvedValue({ count: 2 });

      const result = await service.resumeAllAgents('biz1');

      expect(result.affectedCount).toBe(2);
      expect(prisma.agentConfig.updateMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        data: { isEnabled: true },
      });
    });

    it('throws NotFoundException for invalid business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.resumeAllAgents('invalid')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateTenantAgent', () => {
    it('upserts agent config', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.platformAgentDefault.findUnique.mockResolvedValue(null);
      prisma.agentConfig.upsert.mockResolvedValue({
        id: 'cfg1',
        businessId: 'biz1',
        agentType: 'WAITLIST',
        isEnabled: true,
        autonomyLevel: 'SUGGEST',
      } as any);

      const result = await service.updateTenantAgent('biz1', 'WAITLIST', {
        isEnabled: true,
      });

      expect(result.isEnabled).toBe(true);
      expect(prisma.agentConfig.upsert).toHaveBeenCalled();
    });

    it('rejects autonomy level exceeding platform ceiling', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.platformAgentDefault.findUnique.mockResolvedValue({
        agentType: 'WAITLIST',
        maxAutonomyLevel: 'SUGGEST',
      } as any);

      await expect(
        service.updateTenantAgent('biz1', 'WAITLIST', { autonomyLevel: 'AUTO' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows autonomy level within platform ceiling', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.platformAgentDefault.findUnique.mockResolvedValue({
        agentType: 'WAITLIST',
        maxAutonomyLevel: 'AUTO',
      } as any);
      prisma.agentConfig.upsert.mockResolvedValue({
        id: 'cfg1',
        agentType: 'WAITLIST',
        autonomyLevel: 'SUGGEST',
      } as any);

      const result = await service.updateTenantAgent('biz1', 'WAITLIST', {
        autonomyLevel: 'SUGGEST',
      });

      expect(result.agentType).toBe('WAITLIST');
    });

    it('throws BadRequestException for unknown agent type', async () => {
      await expect(
        service.updateTenantAgent('biz1', 'UNKNOWN', { isEnabled: true }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException for invalid business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(
        service.updateTenantAgent('invalid', 'WAITLIST', { isEnabled: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPlatformDefaults', () => {
    it('returns existing defaults', async () => {
      const defaults = [
        { id: 'd1', agentType: 'DATA_HYGIENE', maxAutonomyLevel: 'SUGGEST', defaultEnabled: false, confidenceThreshold: 0.7, requiresReview: true },
        { id: 'd2', agentType: 'QUOTE_FOLLOWUP', maxAutonomyLevel: 'AUTO', defaultEnabled: true, confidenceThreshold: 0.8, requiresReview: false },
        { id: 'd3', agentType: 'RETENTION', maxAutonomyLevel: 'SUGGEST', defaultEnabled: false, confidenceThreshold: 0.7, requiresReview: true },
        { id: 'd4', agentType: 'SCHEDULING_OPTIMIZER', maxAutonomyLevel: 'SUGGEST', defaultEnabled: false, confidenceThreshold: 0.7, requiresReview: true },
        { id: 'd5', agentType: 'WAITLIST', maxAutonomyLevel: 'SUGGEST', defaultEnabled: false, confidenceThreshold: 0.7, requiresReview: true },
      ];
      prisma.platformAgentDefault.findMany.mockResolvedValue(defaults as any);

      const result = await service.getPlatformDefaults();

      expect(result).toHaveLength(5);
    });

    it('auto-seeds missing agent types', async () => {
      prisma.platformAgentDefault.findMany.mockResolvedValue([
        { id: 'd1', agentType: 'WAITLIST', maxAutonomyLevel: 'SUGGEST', defaultEnabled: false, confidenceThreshold: 0.7, requiresReview: true },
      ] as any);

      (prisma.platformAgentDefault.create as jest.Mock).mockImplementation(async ({ data }: any) => ({
        id: `new-${data.agentType}`,
        ...data,
        updatedAt: new Date(),
        updatedById: null,
      }));

      const result = await service.getPlatformDefaults();

      expect(result).toHaveLength(5);
      expect(prisma.platformAgentDefault.create).toHaveBeenCalledTimes(4);
    });
  });

  describe('updatePlatformDefault', () => {
    it('upserts platform default', async () => {
      const data = {
        maxAutonomyLevel: 'AUTO',
        defaultEnabled: true,
        confidenceThreshold: 0.8,
        requiresReview: false,
      };

      prisma.platformAgentDefault.upsert.mockResolvedValue({
        id: 'd1',
        agentType: 'WAITLIST',
        ...data,
        updatedById: 'admin1',
      } as any);

      const result = await service.updatePlatformDefault('WAITLIST', data, 'admin1');

      expect(result.agentType).toBe('WAITLIST');
      expect(result.maxAutonomyLevel).toBe('AUTO');
      expect(prisma.platformAgentDefault.upsert).toHaveBeenCalled();
    });

    it('throws BadRequestException for unknown agent type', async () => {
      await expect(
        service.updatePlatformDefault('UNKNOWN', {
          maxAutonomyLevel: 'AUTO',
          defaultEnabled: true,
          confidenceThreshold: 0.8,
          requiresReview: false,
        }, 'admin1'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
