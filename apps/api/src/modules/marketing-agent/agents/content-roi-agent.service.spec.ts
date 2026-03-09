import { Test } from '@nestjs/testing';
import { ContentROIAgentService } from './content-roi-agent.service';
import { AgentFrameworkService } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('ContentROIAgentService', () => {
  let service: ContentROIAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };
  let claudeClient: { complete: jest.Mock; isAvailable: jest.Mock };
  let contentQueueService: { create: jest.Mock };
  let marketingAgentService: {
    getBusinessContext: jest.Mock;
    parseAIResponse: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };
    claudeClient = {
      complete: jest.fn().mockResolvedValue('{"summary":"ROI...","recommendations":["R1"]}'),
      isAvailable: jest.fn().mockReturnValue(true),
    };
    contentQueueService = { create: jest.fn() };
    marketingAgentService = {
      getBusinessContext: jest.fn().mockResolvedValue({
        businessName: 'Test',
        vertical: 'AESTHETIC',
        description: '',
        topServices: [],
      }),
      parseAIResponse: jest.fn().mockReturnValue({ summary: 'ROI...', recommendations: ['R1'] }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ContentROIAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ClaudeClient, useValue: claudeClient },
        { provide: ContentQueueService, useValue: contentQueueService },
        { provide: MarketingAgentService, useValue: marketingAgentService },
      ],
    }).compile();

    service = module.get(ContentROIAgentService);
  });

  it('has correct agent type', () => {
    expect(service.agentType).toBe('MKT_ROI_REPORTER');
  });

  it('registers itself on module init', () => {
    service.onModuleInit();
    expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
  });

  describe('execute', () => {
    it('generates ROI report and returns 0 cards', async () => {
      prisma.contentDraft.groupBy.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(15);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
      expect(claudeClient.complete).toHaveBeenCalledWith(
        'sonnet',
        expect.any(String),
        expect.any(Array),
        1024,
      );
    });

    it('returns 0 when Claude is unavailable', async () => {
      claudeClient.isAvailable.mockReturnValue(false);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });
  });
});
