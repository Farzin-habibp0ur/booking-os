import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';
import { ClaudeClient } from '../../ai/claude.client';
import { ContentQueueService } from '../../content-queue/content-queue.service';
import { MarketingAgentService } from '../marketing-agent.service';
import { roiReporterPrompt } from '../prompts/roi-reporter.prompt';

@Injectable()
export class ContentROIAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_ROI_REPORTER';
  private readonly logger = new Logger(ContentROIAgentService.name);

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
      this.logger.warn('Claude client not available, skipping ROI reporter agent');
      return { cardsCreated: 0 };
    }

    const context = await this.marketingAgentService.getBusinessContext(businessId);
    const last7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [byContentType, byStatus, bookingCount] = await Promise.all([
      this.prisma.contentDraft.groupBy({
        by: ['contentType'],
        where: { businessId, createdAt: { gte: last7d } },
        _count: true,
      }),
      this.prisma.contentDraft.groupBy({
        by: ['status'],
        where: { businessId, createdAt: { gte: last7d } },
        _count: true,
      }),
      this.prisma.booking.count({
        where: { businessId, createdAt: { gte: last7d } },
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

    const prompt = roiReporterPrompt({
      ...context,
      contentStats,
      bookingCount,
      period: 'last 7 days',
    });

    const raw = await this.claudeClient.complete(
      'sonnet',
      prompt.system,
      [{ role: 'user', content: prompt.userMessage }],
      1024,
    );

    const parsed = this.marketingAgentService.parseAIResponse(raw);

    this.logger.log(`ROI report: ${parsed.summary?.slice(0, 100) || 'completed'}`);

    return { cardsCreated: 0 };
  }
}
