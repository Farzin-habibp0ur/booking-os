import { Injectable, NotFoundException, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { UpdateAgentConfigDto } from './dto';

/**
 * Marketing agents are BookingOS's internal growth engine — they should NOT
 * be created or returned for customer businesses.  The list is kept here so
 * that existing marketing-agent rows can be excluded from customer-facing
 * queries (they may already exist in the DB from prior seeds).
 */
const MARKETING_AGENT_TYPES = [
  'BlogWriter',
  'SocialCreator',
  'EmailComposer',
  'CaseStudyWriter',
  'VideoScriptWriter',
  'NewsletterComposer',
  'ContentScheduler',
  'ContentPublisher',
  'PerformanceTracker',
  'TrendAnalyzer',
  'ContentCalendar',
  'ContentROI',
];

@Injectable()
export class AgentConfigService {
  private readonly logger = new Logger(AgentConfigService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @InjectQueue(QUEUE_NAMES.AGENT_PROCESSING) private agentQueue?: Queue,
  ) {}

  /** Customer-facing: excludes marketing agents */
  async findAll(businessId: string) {
    return this.prisma.agentConfig.findMany({
      where: {
        businessId,
        agentType: { notIn: MARKETING_AGENT_TYPES },
      },
      orderBy: { agentType: 'asc' },
    });
  }

  /** Admin-facing: returns ALL agents including marketing */
  async findAllUnfiltered(businessId: string) {
    return this.prisma.agentConfig.findMany({
      where: { businessId },
      orderBy: { agentType: 'asc' },
    });
  }

  async findOne(businessId: string, agentType: string) {
    if (MARKETING_AGENT_TYPES.includes(agentType)) {
      throw new NotFoundException(`Agent config for ${agentType} not found`);
    }

    const config = await this.prisma.agentConfig.findFirst({
      where: { businessId, agentType },
    });
    if (!config) throw new NotFoundException(`Agent config for ${agentType} not found`);
    return config;
  }

  /** Admin-facing: allows looking up any agent type including marketing */
  async findOneUnfiltered(businessId: string, agentType: string) {
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

  /** Admin-facing: update any agent type including marketing */
  async updateUnfiltered(businessId: string, agentType: string, dto: UpdateAgentConfigDto) {
    const config = await this.findOneUnfiltered(businessId, agentType);
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

  /** Admin-facing: run any agent including marketing */
  async runNowUnfiltered(businessId: string, agentType: string) {
    const config = await this.findOneUnfiltered(businessId, agentType);
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

  /** Admin-facing: all agents performance */
  async getPerformanceSummaryUnfiltered(businessId: string) {
    const runs = await this.prisma.agentRun.groupBy({
      by: ['agentType', 'status'],
      where: { businessId },
      _count: true,
      _sum: { cardsCreated: true },
    });
    return this.buildPerformanceSummary(runs);
  }

  /** Customer-facing: excludes marketing agents */
  async getPerformanceSummary(businessId: string) {
    const runs = await this.prisma.agentRun.groupBy({
      by: ['agentType', 'status'],
      where: {
        businessId,
        agentType: { notIn: MARKETING_AGENT_TYPES },
      },
      _count: true,
      _sum: { cardsCreated: true },
    });
    return this.buildPerformanceSummary(runs);
  }

  private buildPerformanceSummary(runs: any[]) {
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
}
