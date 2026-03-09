import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { emailComposerPrompt } from '../prompts/email-composer.prompt';

@Injectable()
export class EmailComposerAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_EMAIL_COMPOSER';
  private readonly logger = new Logger(EmailComposerAgentService.name);

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
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    if (!this.claudeClient.isAvailable()) {
      this.logger.warn('Claude client not available, skipping email composer agent');
      return { cardsCreated: 0 };
    }

    const context = await this.marketingAgentService.getBusinessContext(businessId);
    const pillar = await this.marketingAgentService.pickNextPillar(businessId);
    const recentTopics = await this.marketingAgentService.getRecentDraftTopics(businessId);

    const prompt = emailComposerPrompt({ ...context, pillar, recentTopics });

    const raw = await this.claudeClient.complete(
      'sonnet',
      prompt.system,
      [{ role: 'user', content: prompt.userMessage }],
      1536,
    );

    const parsed = this.marketingAgentService.parseAIResponse(raw);

    await this.contentQueueService.create(businessId, {
      title: parsed.title || 'Email Draft',
      body: parsed.body || raw,
      contentType: 'EMAIL',
      channel: 'EMAIL',
      pillar,
      agentId: this.agentType,
      metadata: { generatedBy: this.agentType },
    });

    return { cardsCreated: 1 };
  }
}
