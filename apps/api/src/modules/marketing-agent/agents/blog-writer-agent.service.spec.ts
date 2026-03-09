import { Test } from '@nestjs/testing';
import { BlogWriterAgentService } from './blog-writer-agent.service';
import { AgentFrameworkService } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { PrismaService } from '../../../common/prisma.service';
import { createMockPrisma } from '../../../test/mocks';

describe('BlogWriterAgentService', () => {
  let service: BlogWriterAgentService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let agentFramework: { registerAgent: jest.Mock };
  let claudeClient: { complete: jest.Mock; isAvailable: jest.Mock };
  let contentQueueService: { create: jest.Mock };
  let marketingAgentService: {
    getBusinessContext: jest.Mock;
    pickNextPillar: jest.Mock;
    getRecentDraftTopics: jest.Mock;
    parseAIResponse: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    agentFramework = { registerAgent: jest.fn() };
    claudeClient = {
      complete: jest.fn().mockResolvedValue('{"title":"Test Blog","body":"Content here"}'),
      isAvailable: jest.fn().mockReturnValue(true),
    };
    contentQueueService = { create: jest.fn().mockResolvedValue({ id: 'draft1' }) };
    marketingAgentService = {
      getBusinessContext: jest.fn().mockResolvedValue({
        businessName: 'Test Biz',
        vertical: 'AESTHETIC',
        description: 'A test business',
        topServices: ['Facial'],
      }),
      pickNextPillar: jest.fn().mockResolvedValue('INDUSTRY_INSIGHTS'),
      getRecentDraftTopics: jest.fn().mockResolvedValue(['Topic 1']),
      parseAIResponse: jest.fn().mockReturnValue({ title: 'Test Blog', body: 'Content here' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        BlogWriterAgentService,
        { provide: PrismaService, useValue: prisma },
        { provide: AgentFrameworkService, useValue: agentFramework },
        { provide: ClaudeClient, useValue: claudeClient },
        { provide: ContentQueueService, useValue: contentQueueService },
        { provide: MarketingAgentService, useValue: marketingAgentService },
      ],
    }).compile();

    service = module.get(BlogWriterAgentService);
  });

  it('has correct agent type', () => {
    expect(service.agentType).toBe('MKT_BLOG_WRITER');
  });

  it('registers itself on module init', () => {
    service.onModuleInit();
    expect(agentFramework.registerAgent).toHaveBeenCalledWith(service);
  });

  describe('validateConfig', () => {
    it('returns true for null config', () => {
      expect(service.validateConfig(null)).toBe(true);
    });

    it('returns true for valid config', () => {
      expect(service.validateConfig({ maxDraftsPerRun: 5 })).toBe(true);
    });

    it('returns false for invalid maxDraftsPerRun', () => {
      expect(service.validateConfig({ maxDraftsPerRun: 0 })).toBe(false);
    });
  });

  describe('execute', () => {
    it('creates a blog draft on success', async () => {
      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 1 });
      expect(claudeClient.complete).toHaveBeenCalledWith(
        'sonnet',
        expect.any(String),
        expect.any(Array),
        2048,
      );
      expect(contentQueueService.create).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({
          contentType: 'BLOG_POST',
          channel: 'BLOG',
          agentId: 'MKT_BLOG_WRITER',
        }),
      );
    });

    it('returns 0 when Claude is unavailable', async () => {
      claudeClient.isAvailable.mockReturnValue(false);

      const result = await service.execute('biz1', {});

      expect(result).toEqual({ cardsCreated: 0 });
      expect(claudeClient.complete).not.toHaveBeenCalled();
    });

    it('uses pillar from pickNextPillar', async () => {
      marketingAgentService.pickNextPillar.mockResolvedValue('TECHNICAL');

      await service.execute('biz1', {});

      expect(contentQueueService.create).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({ pillar: 'TECHNICAL' }),
      );
    });

    it('handles AI errors gracefully', async () => {
      claudeClient.complete.mockRejectedValue(new Error('API timeout'));

      await expect(service.execute('biz1', {})).rejects.toThrow('API timeout');
    });
  });
});
