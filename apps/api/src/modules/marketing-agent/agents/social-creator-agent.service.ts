import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { socialCreatorPrompt } from '../prompts/social-creator.prompt';

const SOCIAL_CHANNELS = ['TWITTER', 'LINKEDIN', 'INSTAGRAM'];

@Injectable()
export class SocialCreatorAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_SOCIAL_CREATOR';
  private readonly logger = new Logger(SocialCreatorAgentService.name);

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
    if (config.channels !== undefined && !Array.isArray(config.channels)) return false;
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    if (!this.claudeClient.isAvailable()) {
      this.logger.warn('Claude client not available, skipping social creator agent');
      return { cardsCreated: 0 };
    }

    const context = await this.marketingAgentService.getBusinessContext(businessId);
    const recentTopics = await this.marketingAgentService.getRecentDraftTopics(businessId);
    const channels = config?.channels || SOCIAL_CHANNELS;

    // Pick one channel per run (rotate)
    const channelIndex = Math.floor(Date.now() / (4 * 60 * 60 * 1000)) % channels.length;
    const channel = channels[channelIndex];

    const prompt = socialCreatorPrompt({ ...context, recentTopics, channel });

    const raw = await this.claudeClient.complete(
      'haiku',
      prompt.system,
      [{ role: 'user', content: prompt.userMessage }],
      512,
    );

    const parsed = this.marketingAgentService.parseAIResponse(raw);

    await this.contentQueueService.create(businessId, {
      title: parsed.title || 'Social Post Draft',
      body: parsed.body || raw,
      contentType: 'SOCIAL_POST',
      channel,
      agentId: this.agentType,
      metadata: { generatedBy: this.agentType, channel },
    });

    return { cardsCreated: 1 };
  }
}
