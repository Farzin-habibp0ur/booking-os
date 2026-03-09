import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';

@Injectable()
export class PerformanceTrackerAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_PERF_TRACKER';
  private readonly logger = new Logger(PerformanceTrackerAgentService.name);

  constructor(
    private prisma: PrismaService,
    private agentFramework: AgentFrameworkService,
  ) {}

  onModuleInit() {
    this.agentFramework.registerAgent(this);
  }

  validateConfig(config: any): boolean {
    if (!config) return true;
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [totalDrafts, draftsLast24h, byStatus, byContentType, publishedLast7d] =
      await Promise.all([
        this.prisma.contentDraft.count({ where: { businessId } }),
        this.prisma.contentDraft.count({ where: { businessId, createdAt: { gte: last24h } } }),
        this.prisma.contentDraft.groupBy({
          by: ['status'],
          where: { businessId },
          _count: true,
        }),
        this.prisma.contentDraft.groupBy({
          by: ['contentType'],
          where: { businessId },
          _count: true,
        }),
        this.prisma.contentDraft.count({
          where: { businessId, status: 'PUBLISHED', publishedAt: { gte: last7d } },
        }),
      ]);

    const statusMap: Record<string, number> = {};
    for (const r of byStatus as any[]) {
      statusMap[r.status] = r._count;
    }

    const approved = statusMap['APPROVED'] || 0;
    const published = statusMap['PUBLISHED'] || 0;
    const scheduled = statusMap['SCHEDULED'] || 0;
    const acceptedTotal = approved + published + scheduled;

    const approvalRate =
      acceptedTotal > 0 && totalDrafts > 0 ? Math.round((acceptedTotal / totalDrafts) * 100) : 0;

    // Store stats in the run metadata (the framework stores the run result)
    this.logger.log(
      `Performance tracker: ${totalDrafts} total, ${draftsLast24h} last 24h, ${publishedLast7d} published last 7d, ${approvalRate}% approval rate`,
    );

    return { cardsCreated: 0 };
  }
}
