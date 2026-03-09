import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { blogWriterPrompt } from '../prompts/blog-writer.prompt';

@Injectable()
export class BlogWriterAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_BLOG_WRITER';
  private readonly logger = new Logger(BlogWriterAgentService.name);

  constructor(
    private prisma: PrismaService,
    private agentFramework: AgentFrameworkService,
    private claudeClient: ClaudeClient,
    private contentQueueService: ContentQueueService,
    private marketingAgentService: MarketingAgentService,
  ) {}

  onModuleInit() {
    this.agentFramework.registerAgent(this);
  }

  validateConfig(config: any): boolean {
    if (!config) return true;
    if (config.maxDraftsPerRun !== undefined) {
      if (typeof config.maxDraftsPerRun !== 'number' || config.maxDraftsPerRun < 1) return false;
    }
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    if (!this.claudeClient.isAvailable()) {
      this.logger.warn('Claude client not available, skipping blog writer agent');
      return { cardsCreated: 0 };
    }

    const context = await this.marketingAgentService.getBusinessContext(businessId);
    const pillar = await this.marketingAgentService.pickNextPillar(businessId);
    const recentTopics = await this.marketingAgentService.getRecentDraftTopics(businessId);

    const prompt = blogWriterPrompt({ ...context, pillar, recentTopics });

    const raw = await this.claudeClient.complete(
      'sonnet',
      prompt.system,
      [{ role: 'user', content: prompt.userMessage }],
      2048,
    );

    const parsed = this.marketingAgentService.parseAIResponse(raw);

    await this.contentQueueService.create(businessId, {
      title: parsed.title || 'Blog Post Draft',
      body: parsed.body || raw,
      contentType: 'BLOG_POST',
      channel: 'BLOG',
      pillar,
      agentId: this.agentType,
      metadata: { generatedBy: this.agentType },
    });

    return { cardsCreated: 1 };
  }
}
