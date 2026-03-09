import { Test } from '@nestjs/testing';
import { SocialCreatorAgentService } from './social-creator-agent.service';
import { AgentFrameworkService } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('SocialCreatorAgentService', () => {
  let service: SocialCreatorAgentService;
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
      complete: jest.fn().mockResolvedValue('{"title":"Social Post","body":"Check us out!"}'),
      isAvailable: jest.fn().mockReturnValue(true),
    };
    contentQueueService = { create: jest.fn().mockResolvedValue({ id: 'draft1' }) };
    marketingAgentService = {
      getBusinessContext: jest.fn().mockResolvedValue({
        businessName: 'Test Biz',
        vertical: 'AESTHETIC',
        description: '',
        topServices: ['Facial'],
      }),
      getRecentDraftTopics: jest.fn().mockResolvedValue([]),
      parseAIResponse: jest.fn().mockReturnValue({ title: 'Social Post', body: 'Check us out!' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SocialCreatorAgentService,
        { provide: PrismaService, useValue: createMockPrisma() },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ClaudeClient, useValue: claudeClient },
        { provide: ContentQueueService, useValue: contentQueueService },
        { provide: MarketingAgentService, useValue: marketingAgentService },
      ],
    }).compile();

    service = module.get(SocialCreatorAgentService);
  });

  it('has correct agent type', () => {
    expect(service.agentType).toBe('MKT_SOCIAL_CREATOR');
  });

  it('registers itself on module init', () => {
    service.onModuleInit();
    expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });

    it('returns false for invalid channels', () => {
      expect(service.validateConfig({ channels: 'not-array' })).toBe(false);
    });
  });

  describe('execute', () => {
    it('creates a social post draft', async () => {
      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
      expect(claudeClient.complete).toHaveBeenCalledWith(
        'haiku',
        expect.any(String),
        expect.any(Array),
        512,
      );
      expect(contentQueueService.create).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({
          contentType: 'SOCIAL_POST',
          agentId: 'MKT_SOCIAL_CREATOR',
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
