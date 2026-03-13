import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { UpdateAgentConfigDto } from './dto';

const MARKETING_AGENTS = [
  // Content agents
  { agentType: 'BlogWriter', config: { description: 'SEO blog post writer' } },
  { agentType: 'SocialCreator', config: { description: 'Social media content creator' } },
  { agentType: 'EmailComposer', config: { description: 'Email campaign composer' } },
  { agentType: 'CaseStudyWriter', config: { description: 'Customer case study writer' } },
  { agentType: 'VideoScriptWriter', config: { description: 'Video script writer' } },
  { agentType: 'NewsletterComposer', config: { description: 'Newsletter composer' } },
  // Distribution agents
  { agentType: 'ContentScheduler', config: { description: 'Content scheduling agent' } },
  { agentType: 'ContentPublisher', config: { description: 'Content publishing agent' } },
  // Analytics agents
  { agentType: 'PerformanceTracker', config: { description: 'Content performance tracker' } },
  { agentType: 'TrendAnalyzer', config: { description: 'Trend analysis agent' } },
  { agentType: 'ContentCalendar', config: { description: 'Content calendar manager' } },
  { agentType: 'ContentROI', config: { description: 'Content ROI analyzer' } },
];

@Injectable()
export class AgentConfigService {
  private readonly logger = new Logger(AgentConfigService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @InjectQueue(QUEUE_NAMES.AGENT_PROCESSING) private agentQueue?: Queue,
  ) {}

  async findAll(businessId: string) {
    await this.seedDefaultConfigs(businessId);

    return this.prisma.agentConfig.findMany({
      where: { businessId },
      orderBy: { agentType: 'asc' },
    });
  }

  async findOne(businessId: string, agentType: string) {
    await this.seedDefaultConfigs(businessId);

    const config = await this.prisma.agentConfig.findFirst({
      where: { businessId, agentType },
    });
    if (!config) throw new NotFoundException(`Agent config for ${agentType} not found`);
    return config;
  }

  async update(businessId: string, agentType: string, dto: UpdateAgentConfigDto) {
    const config = await this.findOne(businessId, agentType);

    return this.prisma.agentConfig.update({
      where: { id: config.id },
      data: {
        isEnabled: dto.isEnabled,
        runIntervalMinutes: dto.runIntervalMinutes,
        autonomyLevel: dto.autonomyLevel,
        config: dto.config,
      },
    });
  }

  async runNow(businessId: string, agentType: string) {
    const config = await this.findOne(businessId, agentType);

    if (!config.isEnabled) {
      this.logger.warn(`Agent ${agentType} is disabled for business ${businessId}`);
    }

    if (this.agentQueue) {
      await this.agentQueue.add('run-agent', {
        businessId,
        agentType,
        triggeredManually: true,
      });
    }

    return { queued: true, agentType, businessId };
  }

  async getPerformanceSummary(businessId: string) {
    const runs = await this.prisma.agentRun.groupBy({
      by: ['agentType', 'status'],
      where: { businessId },
      _count: true,
      _sum: { cardsCreated: true },
    });

    const summary: Record<string, any> = {};
    for (const run of runs) {
      if (!summary[run.agentType]) {
        summary[run.agentType] = { total: 0, completed: 0, failed: 0, cardsCreated: 0 };
      }
      summary[run.agentType].total += run._count;
      if (run.status === 'COMPLETED') {
        summary[run.agentType].completed += run._count;
        summary[run.agentType].cardsCreated += run._sum.cardsCreated || 0;
      }
      if (run.status === 'FAILED') {
        summary[run.agentType].failed += run._count;
      }
    }

    for (const agent of Object.keys(summary)) {
      const s = summary[agent];
      s.successRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
    }

    return summary;
  }

  private async seedDefaultConfigs(businessId: string) {
    const existing = await this.prisma.agentConfig.count({
      where: {
        businessId,
        agentType: { in: MARKETING_AGENTS.map((a) => a.agentType) },
      },
    });

    if (existing >= MARKETING_AGENTS.length) return;

    for (const agent of MARKETING_AGENTS) {
      await this.prisma.agentConfig
        .create({
          data: {
            businessId,
            agentType: agent.agentType,
            isEnabled: false,
            autonomyLevel: 'SUGGEST',
            config: agent.config,
          },
        })
        .catch(() => {
          // unique constraint — config already exists, skip
        });
    }
  }
}
