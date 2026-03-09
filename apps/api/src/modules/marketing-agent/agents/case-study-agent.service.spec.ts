import { Test } from '@nestjs/testing';
import { CaseStudyAgentService } from './case-study-agent.service';
import { AgentFrameworkService } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('CaseStudyAgentService', () => {
  let service: CaseStudyAgentService;
  let agentFramework: { registerAgent: jest.Mock };
  let claudeClient: { complete: jest.Mock; isAvailable: jest.Mock };
  let contentQueueService: { create: jest.Mock };
  let marketingAgentService: {
    getBusinessContext: jest.Mock;
    getRecentDraftTopics: jest.Mock;
    parseAIResponse: jest.Mock;
  };

  beforeEach(async () => {
    agentFramework = { registerAgent: jest.fn() };
    claudeClient = {
      complete: jest.fn().mockResolvedValue('{"title":"Case Study","body":"Story..."}'),
      isAvailable: jest.fn().mockReturnValue(true),
    };
    contentQueueService = { create: jest.fn().mockResolvedValue({ id: 'draft1' }) };
    marketingAgentService = {
      getBusinessContext: jest.fn().mockResolvedValue({
        businessName: 'Test Biz',
        vertical: 'AESTHETIC',
        description: '',
        topServices: [],
      }),
      getRecentDraftTopics: jest.fn().mockResolvedValue([]),
      parseAIResponse: jest.fn().mockReturnValue({ title: 'Case Study', body: 'Story...' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        CaseStudyAgentService,
        { provide: PrismaService, useValue: createMockPrisma() },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ClaudeClient, useValue: claudeClient },
        { provide: ContentQueueService, useValue: contentQueueService },
        { provide: MarketingAgentService, useValue: marketingAgentService },
      ],
    }).compile();

    service = module.get(CaseStudyAgentService);
  });

  it('has correct agent type', () => {
    expect(service.agentType).toBe('MKT_CASE_STUDY');
  });

  it('registers itself on module init', () => {
    service.onModuleInit();
    expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
  });

  describe('execute', () => {
    it('creates a case study draft', async () => {
      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
      expect(contentQueueService.create).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({
          contentType: 'CASE_STUDY',
          channel: 'BLOG',
          pillar: 'CUSTOMER_SUCCESS',
          agentId: 'MKT_CASE_STUDY',
        }),
      );
    });

    it('returns 0 when Claude is unavailable', async () => {
      claudeClient.isAvailable.mockReturnValue(false);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
    });
  });
});
