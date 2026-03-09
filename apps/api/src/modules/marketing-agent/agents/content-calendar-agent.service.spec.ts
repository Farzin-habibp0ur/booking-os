import { Test } from '@nestjs/testing';
import { ContentCalendarAgentService } from './content-calendar-agent.service';
import { AgentFrameworkService } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('ContentCalendarAgentService', () => {
  let service: ContentCalendarAgentService;
  let agentFramework: { registerAgent: jest.Mock };
  let claudeClient: { complete: jest.Mock; isAvailable: jest.Mock };
  let contentQueueService: { create: jest.Mock };
  let marketingAgentService: {
    getBusinessContext: jest.Mock;
    getRecentDraftTopics: jest.Mock;
    getContentGaps: jest.Mock;
    parseAIResponse: jest.Mock;
  };

  beforeEach(async () => {
    agentFramework = { registerAgent: jest.fn() };
    claudeClient = {
      complete: jest.fn().mockResolvedValue('{"summary":"Plan...","recommendations":["X"]}'),
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
      getRecentDraftTopics: jest.fn().mockResolvedValue([]),
      getContentGaps: jest.fn().mockResolvedValue({
        missingChannels: ['TWITTER'],
        missingPillars: ['TECHNICAL'],
      }),
      parseAIResponse: jest.fn().mockReturnValue({ summary: 'Plan...', recommendations: ['X'] }),
    };

    const module = await Test.createTestingModule({
      providers: [
        ContentCalendarAgentService,
        { provide: PrismaService, useValue: createMockPrisma() },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ClaudeClient, useValue: claudeClient },
        { provide: ContentQueueService, useValue: contentQueueService },
        { provide: MarketingAgentService, useValue: marketingAgentService },
      ],
    }).compile();

    service = module.get(ContentCalendarAgentService);
  });

  it('has correct agent type', () => {
    expect(service.agentType).toBe('MKT_CALENDAR_PLANNER');
  });

  it('registers itself on module init', () => {
    service.onModuleInit();
    expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
  });

  describe('execute', () => {
    it('plans content and returns 0 cards', async () => {
      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
      expect(marketingAgentService.getContentGaps).toHaveBeenCalledWith('biz1');
    });

    it('returns 0 when Claude is unavailable', async () => {
      claudeClient.isAvailable.mockReturnValue(false);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });
  });
});
