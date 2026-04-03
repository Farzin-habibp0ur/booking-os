import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { DistributedLockService } from '../../common/distributed-lock.service';

export interface BackgroundAgent {
  agentType: string;
  execute(businessId: string, config: any): Promise<{ cardsCreated: number }>;
  validateConfig(config: any): boolean;
}

@Injectable()
export class AgentFrameworkService {
  private readonly logger = new Logger(AgentFrameworkService.name);
  private readonly agents = new Map<string, BackgroundAgent>();

  constructor(
    private prisma: PrismaService,
    private lockService: DistributedLockService,
  ) {}

  registerAgent(agent: BackgroundAgent) {
    this.agents.set(agent.agentType, agent);
    this.logger.log(`Registered agent: ${agent.agentType}`);
  }

  getRegisteredAgents(): string[] {
    return Array.from(this.agents.keys());
  }

  getAgent(agentType: string): BackgroundAgent | undefined {
    return this.agents.get(agentType);
  }

  async getConfigs(businessId: string) {
    return this.prisma.agentConfig.findMany({
      where: { businessId },
      orderBy: { agentType: 'asc' },
    });
  }

  async getConfig(businessId: string, agentType: string) {
    const config = await this.prisma.agentConfig.findUnique({
      where: { businessId_agentType: { businessId, agentType } },
    });
    if (!config) throw new NotFoundException(`Agent config not found for ${agentType}`);
    return config;
  }

  async upsertConfig(
    businessId: string,
    agentType: string,
    data: { isEnabled?: boolean; autonomyLevel?: string; config?: any; roleVisibility?: string[] },
  ) {
    return this.prisma.agentConfig.upsert({
      where: { businessId_agentType: { businessId, agentType } },
      create: {
        businessId,
        agentType,
        isEnabled: data.isEnabled ?? false,
        autonomyLevel: data.autonomyLevel ?? 'SUGGEST',
        config: data.config ?? {},
        roleVisibility: data.roleVisibility ?? [],
      },
      update: {
        ...(data.isEnabled !== undefined && { isEnabled: data.isEnabled }),
        ...(data.autonomyLevel !== undefined && { autonomyLevel: data.autonomyLevel }),
        ...(data.config !== undefined && { config: data.config }),
        ...(data.roleVisibility !== undefined && { roleVisibility: data.roleVisibility }),
      },
    });
  }

  async triggerAgent(businessId: string, agentType: string) {
    const agent = this.agents.get(agentType);
    if (!agent) throw new NotFoundException(`Agent type ${agentType} not registered`);

    const config = await this.prisma.agentConfig.findUnique({
      where: { businessId_agentType: { businessId, agentType } },
    });
    if (!config || !config.isEnabled) {
      throw new BadRequestException(`Agent ${agentType} is not enabled for this business`);
    }

    // FIX-19: Daily card cap — prevent agents from creating unbounded cards per day
    const AGENT_CARD_TYPE_MAP: Record<string, string> = {
      WAITLIST: 'WAITLIST_MATCH',
      RETENTION: 'RETENTION_DUE',
      DATA_HYGIENE: 'DUPLICATE_CUSTOMER',
      SCHEDULING_OPTIMIZER: 'SCHEDULE_GAP',
      QUOTE_FOLLOWUP: 'STALLED_QUOTE',
    };
    const cardType = AGENT_CARD_TYPE_MAP[agentType];
    if (cardType) {
      const dailyCardCap: number = (config.config as any)?.dailyCardCap ?? 50;
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayCount = await this.prisma.actionCard.count({
        where: { businessId, type: cardType, createdAt: { gte: todayStart } },
      });
      if (todayCount >= dailyCardCap) {
        throw new BadRequestException(
          `Agent ${agentType} has reached its daily card cap of ${dailyCardCap}`,
        );
      }
    }

    const lockKey = `agent-lock:${businessId}:${agentType}`;
    const unlock = await this.lockService.acquire(lockKey, 120_000); // 2-minute TTL
    if (!unlock) {
      throw new BadRequestException(`Agent ${agentType} is already running for this business`);
    }

    const run = await this.prisma.agentRun.create({
      data: { businessId, agentType, status: 'RUNNING' },
    });

    try {
      const result = await agent.execute(businessId, config.config);

      const now = new Date();
      const [completed] = await Promise.all([
        this.prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: 'COMPLETED',
            cardsCreated: result.cardsCreated,
            completedAt: now,
          },
        }),
        this.prisma.agentConfig.update({
          where: { businessId_agentType: { businessId, agentType } },
          data: { lastRunAt: now },
        }),
      ]);

      this.logger.log(
        `Agent ${agentType} completed for business ${businessId}: ${result.cardsCreated} cards created`,
      );

      return completed;
    } catch (err: any) {
      const failedAt = new Date();
      const [failed] = await Promise.all([
        this.prisma.agentRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            error: err.message,
            completedAt: failedAt,
          },
        }),
        this.prisma.agentConfig.update({
          where: { businessId_agentType: { businessId, agentType } },
          data: { lastRunAt: failedAt },
        }),
      ]);

      this.logger.error(`Agent ${agentType} failed for business ${businessId}: ${err.message}`);

      return failed;
    } finally {
      await unlock();
    }
  }

  async getRuns(
    businessId: string,
    query: { agentType?: string; status?: string; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { businessId };
    if (query.agentType) where.agentType = query.agentType;
    if (query.status) where.status = query.status;

    const [items, total] = await Promise.all([
      this.prisma.agentRun.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.agentRun.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async submitFeedback(
    businessId: string,
    actionCardId: string,
    staffId: string,
    rating: string,
    comment?: string,
  ) {
    if (!['HELPFUL', 'NOT_HELPFUL'].includes(rating)) {
      throw new BadRequestException('Rating must be HELPFUL or NOT_HELPFUL');
    }

    return this.prisma.agentFeedback.upsert({
      where: { actionCardId_staffId: { actionCardId, staffId } },
      create: { businessId, actionCardId, staffId, rating, comment },
      update: { rating, comment },
    });
  }

  async getFeedbackStats(businessId: string, agentType?: string) {
    const where: any = { businessId };
    if (agentType) {
      where.actionCard = { type: { startsWith: agentType } };
    }

    const [helpful, notHelpful] = await Promise.all([
      this.prisma.agentFeedback.count({ where: { ...where, rating: 'HELPFUL' } }),
      this.prisma.agentFeedback.count({ where: { ...where, rating: 'NOT_HELPFUL' } }),
    ]);

    const total = helpful + notHelpful;
    return {
      helpful,
      notHelpful,
      total,
      helpfulRate: total > 0 ? Math.round((helpful / total) * 100) : 0,
    };
  }
}
