import { Test } from '@nestjs/testing';
import { PerformanceTrackerAgentService } from './performance-tracker-agent.service';
import { AgentFrameworkService } from '../../agent/agent-framework.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('PerformanceTrackerAgentService', () => {
  let service: PerformanceTrackerAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PerformanceTrackerAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
      ],
    }).compile();

    service = module.get(PerformanceTrackerAgentService);
  });

  it('has correct agent type', () => {
    expect(service.agentType).toBe('MKT_PERF_TRACKER');
  });

  it('registers itself on module init', () => {
    service.onModuleInit();
    expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });
  });

  describe('execute', () => {
    it('aggregates stats and returns 0 cards', async () => {
      prisma.contentDraft.count.mockResolvedValue(10);
      prisma.contentDraft.groupBy.mockResolvedValue([]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
      expect(prisma.contentDraft.count).toHaveBeenCalled();
    });
  });
});
