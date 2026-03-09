import { Test } from '@nestjs/testing';
import { ContentPublisherAgentService } from './content-publisher-agent.service';
import { AgentFrameworkService } from '../../agent/agent-framework.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('ContentPublisherAgentService', () => {
  let service: ContentPublisherAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ContentPublisherAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
      ],
    }).compile();

    service = module.get(ContentPublisherAgentService);
  });

  it('has correct agent type', () => {
    expect(service.agentType).toBe('MKT_PUBLISHER');
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
    it('returns 0 when no ready drafts', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([]);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });

    it('publishes scheduled drafts past their time', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([
        { id: 'd1', status: 'SCHEDULED', scheduledFor: new Date(Date.now() - 60000) },
      ] as any);
      prisma.contentDraft.update.mockResolvedValue({} as any);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
      expect(prisma.contentDraft.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'd1' },
          data: expect.objectContaining({ status: 'PUBLISHED' }),
        }),
      );
    });
  });
});
