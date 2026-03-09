import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { calendarPlannerPrompt } from '../prompts/calendar-planner.prompt';

@Injectable()
export class ContentCalendarAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_CALENDAR_PLANNER';
  private readonly logger = new Logger(ContentCalendarAgentService.name);

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
      this.logger.warn('Claude client not available, skipping calendar planner agent');
      return { cardsCreated: 0 };
    }

    const context = await this.marketingAgentService.getBusinessContext(businessId);
    const recentTopics = await this.marketingAgentService.getRecentDraftTopics(businessId);
    const gaps = await this.marketingAgentService.getContentGaps(businessId);

    const prompt = calendarPlannerPrompt({ ...context, gaps, recentTopics });

    const raw = await this.claudeClient.complete(
      'haiku',
      prompt.system,
      [{ role: 'user', content: prompt.userMessage }],
      1024,
    );

    const parsed = this.marketingAgentService.parseAIResponse(raw);

    this.logger.log(`Calendar plan: ${parsed.summary?.slice(0, 100) || 'completed'}`);

    return { cardsCreated: 0 };
  }
}
