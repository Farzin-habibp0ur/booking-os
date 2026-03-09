import { Test } from '@nestjs/testing';
import { ContentSchedulerAgentService } from './content-scheduler-agent.service';
import { AgentFrameworkService } from '../../agent/agent-framework.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('ContentSchedulerAgentService', () => {
  let service: ContentSchedulerAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ContentSchedulerAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
      ],
    }).compile();

    service = module.get(ContentSchedulerAgentService);
  });

  it('has correct agent type', () => {
    expect(service.agentType).toBe('MKT_SCHEDULER');
  });

  it('registers itself on module init', () => {
    service.onModuleInit();
    expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });

    it('returns false for invalid maxPerRun', () => {
      expect(service.validateConfig({ maxPerRun: 0 })).toBe(false);
    });
  });

  describe('execute', () => {
    it('returns 0 when no approved drafts', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('schedules approved drafts', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([
        { id: 'd1', status: 'APPROVED' },
        { id: 'd2', status: 'APPROVED' },
      ] as any);
      prisma.contentDraft.update.mockResolvedValue({} as any);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 2 });
      expect(prisma.contentDraft.update).toHaveBeenCalledTimes(2);
      expect(prisma.contentDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd1' },
          data: expect.objectContaining({ status: 'SCHEDULED' }),
        }),
      );
    });

    it('respects maxPerRun config', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([
        { id: 'd1', status: 'APPROVED' },
      ] as any);
      prisma.contentDraft.update.mockResolvedValue({} as any);

      const result = await service.execute('biz1', { maxPerRun: 1 });

      expect(result).toEqual({ cardsCreated: 1 });
    });
  });
});
