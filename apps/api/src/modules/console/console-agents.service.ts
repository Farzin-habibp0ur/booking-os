import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

const KNOWN_AGENT_TYPES = [
  'WAITLIST',
  'RETENTION',
  'DATA_HYGIENE',
  'SCHEDULING_OPTIMIZER',
  'QUOTE_FOLLOWUP',
];

const AUTONOMY_RANK: Record<string, number> = {
  REQUIRE_APPROVAL: 0,
  SUGGEST: 1,
  AUTO: 2,
};

@Injectable()
export class ConsoleAgentsService {
  private readonly logger = new Logger(ConsoleAgentsService.name);

  constructor(private prisma: PrismaService) {}

  async getPerformanceDashboard() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [runs, feedback] = await Promise.all([
      this.prisma.agentRun.findMany({
        where: { startedAt: { gte: sevenDaysAgo } },
      }),
      this.prisma.agentFeedback.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
    ]);

    const totalRuns = runs.length;
    const completed = runs.filter((r) => r.status === 'COMPLETED').length;
    const failed = runs.filter((r) => r.status === 'FAILED').length;
    const successRate = totalRuns > 0 ? Math.round((completed / totalRuns) * 100) : 0;
    const cardsCreated = runs.reduce((sum, r) => sum + r.cardsCreated, 0);

    const helpfulCount = feedback.filter((f) => f.rating === 'HELPFUL').length;
    const feedbackHelpfulRate =
      feedback.length > 0 ? Math.round((helpfulCount / feedback.length) * 100) : 0;

    const byAgentType = KNOWN_AGENT_TYPES.map((agentType) => {
      const typeRuns = runs.filter((r) => r.agentType === agentType);
      const typeCompleted = typeRuns.filter((r) => r.status === 'COMPLETED').length;
      const typeFailed = typeRuns.filter((r) => r.status === 'FAILED').length;
      const typeFeedback = feedback.filter((f) =>
        runs.some((r) => r.agentType === agentType && r.businessId === f.businessId),
      );
      const typeHelpful = typeFeedback.filter((f) => f.rating === 'HELPFUL').length;

      return {
        agentType,
        runs: typeRuns.length,
        completed: typeCompleted,
        failed: typeFailed,
        successRate: typeRuns.length > 0 ? Math.round((typeCompleted / typeRuns.length) * 100) : 0,
        cardsCreated: typeRuns.reduce((sum, r) => sum + r.cardsCreated, 0),
        helpfulRate:
          typeFeedback.length > 0 ? Math.round((typeHelpful / typeFeedback.length) * 100) : 0,
      };
    });

    return {
      totalRuns,
      successRate,
      cardsCreated,
      feedbackHelpfulRate,
      byAgentType,
    };
  }

  async getActionCardFunnel() {
    const cards = await this.prisma.actionCard.findMany({
      select: { status: true },
    });

    const total = cards.length;
    const pending = cards.filter((c) => c.status === 'PENDING').length;
    const approved = cards.filter((c) => c.status === 'APPROVED').length;
    const dismissed = cards.filter((c) => c.status === 'DISMISSED').length;
    const executed = cards.filter((c) => c.status === 'EXECUTED').length;
    const expired = cards.filter((c) => c.status === 'EXPIRED').length;
    const snoozed = cards.filter((c) => c.status === 'SNOOZED').length;

    const approvalRate = total > 0 ? Math.round(((approved + executed) / total) * 100) : 0;
    const executionRate = total > 0 ? Math.round((executed / total) * 100) : 0;

    return {
      total,
      pending,
      approved,
      dismissed,
      executed,
      expired,
      snoozed,
      approvalRate,
      executionRate,
    };
  }

  async getTopFailures(limit = 10) {
    const failedRuns = await this.prisma.agentRun.findMany({
      where: { status: 'FAILED' },
      orderBy: { startedAt: 'desc' },
    });

    const errorMap = new Map<string, { count: number; agentType: string; lastSeen: Date }>();

    for (const run of failedRuns) {
      const errorKey = run.error || 'Unknown error';
      const existing = errorMap.get(errorKey);
      if (existing) {
        existing.count++;
        if (run.startedAt > existing.lastSeen) {
          existing.lastSeen = run.startedAt;
        }
      } else {
        errorMap.set(errorKey, {
          count: 1,
          agentType: run.agentType,
          lastSeen: run.startedAt,
        });
      }
    }

    const sorted = Array.from(errorMap.entries())
      .map(([error, data]) => ({ error, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return sorted;
  }

  async getAbnormalTenants() {
    const runs = await this.prisma.agentRun.findMany({
      select: { businessId: true, status: true },
    });

    if (runs.length === 0) return [];

    const tenantMap = new Map<string, { totalRuns: number; failedRuns: number }>();

    for (const run of runs) {
      const existing = tenantMap.get(run.businessId) || {
        totalRuns: 0,
        failedRuns: 0,
      };
      existing.totalRuns++;
      if (run.status === 'FAILED') existing.failedRuns++;
      tenantMap.set(run.businessId, existing);
    }

    const totalFailed = runs.filter((r) => r.status === 'FAILED').length;
    const platformAvgRate = runs.length > 0 ? totalFailed / runs.length : 0;

    const abnormalIds: string[] = [];
    for (const [businessId, stats] of tenantMap) {
      if (stats.totalRuns < 1) continue;
      const rate = stats.failedRuns / stats.totalRuns;
      if (rate > platformAvgRate * 2) {
        abnormalIds.push(businessId);
      }
    }

    if (abnormalIds.length === 0) return [];

    const businesses = await this.prisma.business.findMany({
      where: { id: { in: abnormalIds } },
      select: { id: true, name: true, slug: true },
    });

    const businessMap = new Map(businesses.map((b) => [b.id, b]));

    return abnormalIds
      .map((businessId) => {
        const stats = tenantMap.get(businessId)!;
        const business = businessMap.get(businessId);
        return {
          businessId,
          businessName: business?.name || 'Unknown',
          businessSlug: business?.slug || '',
          totalRuns: stats.totalRuns,
          failedRuns: stats.failedRuns,
          failureRate: Math.round((stats.failedRuns / stats.totalRuns) * 100),
          platformAvgRate: Math.round(platformAvgRate * 100),
        };
      })
      .sort((a, b) => b.failureRate - a.failureRate);
  }

  async getTenantAgentStatus(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const [configs, runs] = await Promise.all([
      this.prisma.agentConfig.findMany({
        where: { businessId },
      }),
      this.prisma.agentRun.findMany({
        where: { businessId, startedAt: { gte: sevenDaysAgo } },
      }),
    ]);

    const agents = KNOWN_AGENT_TYPES.map((agentType) => {
      const config = configs.find((c) => c.agentType === agentType);
      const typeRuns = runs.filter((r) => r.agentType === agentType);
      const completed = typeRuns.filter((r) => r.status === 'COMPLETED').length;

      return {
        agentType,
        isEnabled: config?.isEnabled ?? false,
        autonomyLevel: config?.autonomyLevel ?? 'SUGGEST',
        runsLast7d: typeRuns.length,
        successRate: typeRuns.length > 0 ? Math.round((completed / typeRuns.length) * 100) : 0,
        cardsCreated: typeRuns.reduce((sum, r) => sum + r.cardsCreated, 0),
      };
    });

    return { businessId, businessName: business.name, agents };
  }

  async pauseAllAgents(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const result = await this.prisma.agentConfig.updateMany({
      where: { businessId },
      data: { isEnabled: false },
    });

    this.logger.warn(`Paused all agents for business ${businessId}`);

    return { affectedCount: result.count };
  }

  async resumeAllAgents(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    const result = await this.prisma.agentConfig.updateMany({
      where: { businessId },
      data: { isEnabled: true },
    });

    this.logger.log(`Resumed all agents for business ${businessId}`);

    return { affectedCount: result.count };
  }

  async updateTenantAgent(
    businessId: string,
    agentType: string,
    data: { isEnabled?: boolean; autonomyLevel?: string },
  ) {
    if (!KNOWN_AGENT_TYPES.includes(agentType)) {
      throw new BadRequestException(`Unknown agent type: ${agentType}`);
    }

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    if (!business) {
      throw new NotFoundException('Business not found');
    }

    if (data.autonomyLevel) {
      const platformDefault = await this.prisma.platformAgentDefault.findUnique({
        where: { agentType },
      });

      if (platformDefault) {
        const requestedRank = AUTONOMY_RANK[data.autonomyLevel] ?? 0;
        const maxRank = AUTONOMY_RANK[platformDefault.maxAutonomyLevel] ?? 0;

        if (requestedRank > maxRank) {
          throw new BadRequestException(
            `Autonomy level ${data.autonomyLevel} exceeds platform ceiling of ${platformDefault.maxAutonomyLevel}`,
          );
        }
      }
    }

    const config = await this.prisma.agentConfig.upsert({
      where: { businessId_agentType: { businessId, agentType } },
      create: {
        businessId,
        agentType,
        isEnabled: data.isEnabled ?? false,
        autonomyLevel: data.autonomyLevel ?? 'SUGGEST',
      },
      update: {
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.autonomyLevel && { autonomyLevel: data.autonomyLevel }),
      },
    });

    this.logger.log(
      `Updated agent ${agentType} for business ${businessId}: ${JSON.stringify(data)}`,
    );

    return config;
  }

  async getPlatformDefaults() {
    const defaults = await this.prisma.platformAgentDefault.findMany({
      orderBy: { agentType: 'asc' },
    });

    const existingTypes = new Set(defaults.map((d) => d.agentType));
    const missing = KNOWN_AGENT_TYPES.filter((t) => !existingTypes.has(t));

    if (missing.length > 0) {
      for (const agentType of missing) {
        const created = await this.prisma.platformAgentDefault.create({
          data: {
            agentType,
            maxAutonomyLevel: 'SUGGEST',
            defaultEnabled: false,
            confidenceThreshold: 0.7,
            requiresReview: true,
          },
        });
        defaults.push(created);
      }
      defaults.sort((a, b) => a.agentType.localeCompare(b.agentType));
    }

    return defaults;
  }

  async updatePlatformDefault(
    agentType: string,
    data: {
      maxAutonomyLevel: string;
      defaultEnabled: boolean;
      confidenceThreshold: number;
      requiresReview: boolean;
    },
    actorId: string,
  ) {
    if (!KNOWN_AGENT_TYPES.includes(agentType)) {
      throw new BadRequestException(`Unknown agent type: ${agentType}`);
    }

    const updated = await this.prisma.platformAgentDefault.upsert({
      where: { agentType },
      create: {
        agentType,
        maxAutonomyLevel: data.maxAutonomyLevel,
        defaultEnabled: data.defaultEnabled,
        confidenceThreshold: data.confidenceThreshold,
        requiresReview: data.requiresReview,
        updatedById: actorId,
      },
      update: {
        maxAutonomyLevel: data.maxAutonomyLevel,
        defaultEnabled: data.defaultEnabled,
        confidenceThreshold: data.confidenceThreshold,
        requiresReview: data.requiresReview,
        updatedById: actorId,
      },
    });

    this.logger.log(`Updated platform default for ${agentType}: ${JSON.stringify(data)}`);

    return updated;
  }
}
