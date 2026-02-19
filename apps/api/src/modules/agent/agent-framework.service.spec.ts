import { Test } from '@nestjs/testing';
import { AgentFrameworkService, BackgroundAgent } from './agent-framework.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AgentFrameworkService', () => {
  let service: AgentFrameworkService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const mockAgent: BackgroundAgent = {
    agentType: 'WAITLIST',
    execute: jest.fn().mockResolvedValue({ cardsCreated: 3 }),
    validateConfig: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [AgentFrameworkService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AgentFrameworkService);
  });

  describe('registerAgent', () => {
    it('registers an agent and makes it retrievable', () => {
      service.registerAgent(mockAgent);

      expect(service.getRegisteredAgents()).toContain('WAITLIST');
      expect(service.getAgent('WAITLIST')).toBe(mockAgent);
    });

    it('returns undefined for unregistered agent', () => {
      expect(service.getAgent('UNKNOWN')).toBeUndefined();
    });
  });

  describe('getConfigs', () => {
    it('returns all configs for business', async () => {
      const configs = [
        { id: 'ac1', businessId: 'biz1', agentType: 'WAITLIST', isEnabled: true },
      ];
      prisma.agentConfig.findMany.mockResolvedValue(configs as any);

      const result = await service.getConfigs('biz1');

      expect(result).toEqual(configs);
      expect(prisma.agentConfig.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { agentType: 'asc' },
      });
    });
  });

  describe('getConfig', () => {
    it('returns config for specific agent type', async () => {
      const config = { id: 'ac1', businessId: 'biz1', agentType: 'WAITLIST', isEnabled: true };
      prisma.agentConfig.findUnique.mockResolvedValue(config as any);

      const result = await service.getConfig('biz1', 'WAITLIST');

      expect(result).toEqual(config);
    });

    it('throws NotFoundException when config not found', async () => {
      prisma.agentConfig.findUnique.mockResolvedValue(null);

      await expect(service.getConfig('biz1', 'UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsertConfig', () => {
    it('creates config when it does not exist', async () => {
      const created = {
        id: 'ac1',
        businessId: 'biz1',
        agentType: 'RETENTION',
        isEnabled: true,
        autonomyLevel: 'AUTO',
      };
      prisma.agentConfig.upsert.mockResolvedValue(created as any);

      const result = await service.upsertConfig('biz1', 'RETENTION', {
        isEnabled: true,
        autonomyLevel: 'AUTO',
      });

      expect(result).toEqual(created);
      expect(prisma.agentConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId_agentType: { businessId: 'biz1', agentType: 'RETENTION' } },
          create: expect.objectContaining({
            businessId: 'biz1',
            agentType: 'RETENTION',
            isEnabled: true,
            autonomyLevel: 'AUTO',
          }),
        }),
      );
    });

    it('updates only provided fields', async () => {
      prisma.agentConfig.upsert.mockResolvedValue({ id: 'ac1' } as any);

      await service.upsertConfig('biz1', 'WAITLIST', { isEnabled: false });

      const call = prisma.agentConfig.upsert.mock.calls[0][0] as any;
      expect(call.update).toEqual({ isEnabled: false });
    });
  });

  describe('triggerAgent', () => {
    it('throws NotFoundException when agent type not registered', async () => {
      await expect(service.triggerAgent('biz1', 'UNKNOWN')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when agent not enabled', async () => {
      service.registerAgent(mockAgent);
      prisma.agentConfig.findUnique.mockResolvedValue(null);

      await expect(service.triggerAgent('biz1', 'WAITLIST')).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when agent disabled', async () => {
      service.registerAgent(mockAgent);
      prisma.agentConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        isEnabled: false,
      } as any);

      await expect(service.triggerAgent('biz1', 'WAITLIST')).rejects.toThrow(BadRequestException);
    });

    it('executes agent and records successful run', async () => {
      service.registerAgent(mockAgent);
      prisma.agentConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        isEnabled: true,
        config: { maxCards: 5 },
      } as any);
      prisma.agentRun.create.mockResolvedValue({ id: 'run1', status: 'RUNNING' } as any);
      prisma.agentRun.update.mockResolvedValue({
        id: 'run1',
        status: 'COMPLETED',
        cardsCreated: 3,
      } as any);

      const result = await service.triggerAgent('biz1', 'WAITLIST');

      expect(result.status).toBe('COMPLETED');
      expect(result.cardsCreated).toBe(3);
      expect(mockAgent.execute).toHaveBeenCalledWith('biz1', { maxCards: 5 });
    });

    it('records failed run when agent throws', async () => {
      const failingAgent: BackgroundAgent = {
        agentType: 'FAILING',
        execute: jest.fn().mockRejectedValue(new Error('Agent crashed')),
        validateConfig: jest.fn().mockReturnValue(true),
      };
      service.registerAgent(failingAgent);
      prisma.agentConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        isEnabled: true,
        config: {},
      } as any);
      prisma.agentRun.create.mockResolvedValue({ id: 'run1', status: 'RUNNING' } as any);
      prisma.agentRun.update.mockResolvedValue({
        id: 'run1',
        status: 'FAILED',
        error: 'Agent crashed',
      } as any);

      const result = await service.triggerAgent('biz1', 'FAILING');

      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Agent crashed');
    });
  });

  describe('getRuns', () => {
    it('returns paginated runs', async () => {
      const runs = [{ id: 'run1', agentType: 'WAITLIST', status: 'COMPLETED' }];
      prisma.agentRun.findMany.mockResolvedValue(runs as any);
      prisma.agentRun.count.mockResolvedValue(1);

      const result = await service.getRuns('biz1', { agentType: 'WAITLIST' });

      expect(result.items).toEqual(runs);
      expect(result.total).toBe(1);
    });

    it('filters by status', async () => {
      prisma.agentRun.findMany.mockResolvedValue([] as any);
      prisma.agentRun.count.mockResolvedValue(0);

      await service.getRuns('biz1', { status: 'FAILED' });

      const call = prisma.agentRun.findMany.mock.calls[0][0] as any;
      expect(call.where.status).toBe('FAILED');
    });

    it('clamps page size to 100', async () => {
      prisma.agentRun.findMany.mockResolvedValue([] as any);
      prisma.agentRun.count.mockResolvedValue(0);

      await service.getRuns('biz1', { pageSize: 500 });

      const call = prisma.agentRun.findMany.mock.calls[0][0] as any;
      expect(call.take).toBe(100);
    });
  });

  describe('submitFeedback', () => {
    it('creates feedback with valid rating', async () => {
      const feedback = { id: 'fb1', rating: 'HELPFUL', actionCardId: 'card1', staffId: 'staff1' };
      prisma.agentFeedback.upsert.mockResolvedValue(feedback as any);

      const result = await service.submitFeedback('biz1', 'card1', 'staff1', 'HELPFUL', 'Great suggestion');

      expect(result).toEqual(feedback);
    });

    it('throws BadRequestException for invalid rating', async () => {
      await expect(
        service.submitFeedback('biz1', 'card1', 'staff1', 'INVALID'),
      ).rejects.toThrow(BadRequestException);
    });

    it('upserts on duplicate actionCardId+staffId', async () => {
      prisma.agentFeedback.upsert.mockResolvedValue({ id: 'fb1' } as any);

      await service.submitFeedback('biz1', 'card1', 'staff1', 'NOT_HELPFUL');

      expect(prisma.agentFeedback.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { actionCardId_staffId: { actionCardId: 'card1', staffId: 'staff1' } },
        }),
      );
    });
  });

  describe('getFeedbackStats', () => {
    it('returns aggregated stats', async () => {
      prisma.agentFeedback.count
        .mockResolvedValueOnce(8) // helpful
        .mockResolvedValueOnce(2); // not helpful

      const result = await service.getFeedbackStats('biz1');

      expect(result).toEqual({ helpful: 8, notHelpful: 2, total: 10, helpfulRate: 80 });
    });

    it('returns 0 rate when no feedback', async () => {
      prisma.agentFeedback.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0);

      const result = await service.getFeedbackStats('biz1');

      expect(result.helpfulRate).toBe(0);
    });
  });
});
