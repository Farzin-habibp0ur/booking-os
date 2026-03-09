import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { trendAnalyzerPrompt } from '../prompts/trend-analyzer.prompt';

@Injectable()
export class TrendAnalyzerAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_TREND_ANALYZER';
  private readonly logger = new Logger(TrendAnalyzerAgentService.name);

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
      this.logger.warn('Claude client not available, skipping trend analyzer agent');
      return { cardsCreated: 0 };
    }

    const context = await this.marketingAgentService.getBusinessContext(businessId);
    const recentTopics = await this.marketingAgentService.getRecentDraftTopics(businessId);

    const [byContentType, byStatus] = await Promise.all([
      this.prisma.contentDraft.groupBy({
        by: ['contentType'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.contentDraft.groupBy({
        by: ['status'],
        where: { businessId },
        _count: true,
      }),
    ]);

    const contentStats = {
      byContentType: byContentType.reduce(
        (acc: Record<string, number>, r: any) => ({ ...acc, [r.contentType]: r._count }),
        {},
      ),
      byStatus: byStatus.reduce(
        (acc: Record<string, number>, r: any) => ({ ...acc, [r.status]: r._count }),
        {},
      ),
    };

    const prompt = trendAnalyzerPrompt({ ...context, contentStats, recentTopics });

    const raw = await this.claudeClient.complete(
      'haiku',
      prompt.system,
      [{ role: 'user', content: prompt.userMessage }],
      1024,
    );

    const parsed = this.marketingAgentService.parseAIResponse(raw);

    this.logger.log(`Trend analysis: ${parsed.summary?.slice(0, 100) || 'completed'}`);

    return { cardsCreated: 0 };
  }
}
