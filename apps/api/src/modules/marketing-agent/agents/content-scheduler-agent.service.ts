import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';

@Injectable()
export class ContentSchedulerAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_SCHEDULER';
  private readonly logger = new Logger(ContentSchedulerAgentService.name);

  constructor(
    private prisma: PrismaService,
    private agentFramework: AgentFrameworkService,
  ) {}

  onModuleInit() {
    this.agentFramework.registerAgent(this);
  }

  validateConfig(config: any): boolean {
    if (!config) return true;
    if (config.maxPerRun !== undefined) {
      if (typeof config.maxPerRun !== 'number' || config.maxPerRun < 1) return false;
    }
    return true;
  }

  async execute(businessId: string, config: any): Promise<{ cardsCreated: number }> {
    const maxPerRun = config?.maxPerRun || 10;

    // Find approved drafts without a scheduled date
    const approved = await this.prisma.contentDraft.findMany({
      where: {
        businessId,
        status: 'APPROVED',
        scheduledFor: null,
      },
      orderBy: { createdAt: 'asc' },
      take: maxPerRun,
    });

    if (approved.length === 0) {
      return { cardsCreated: 0 };
    }

    let scheduled = 0;

    for (const draft of approved) {
      // Schedule content spread across next 7 days
      const hoursFromNow = 4 + scheduled * 8; // Stagger by ~8 hours
      const scheduledFor = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);

      await this.prisma.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: 'SCHEDULED',
          scheduledFor,
        },
      });

      scheduled++;
    }

    this.logger.log(`Scheduler agent scheduled ${scheduled} drafts for business ${businessId}`);

    return { cardsCreated: scheduled };
  }
}
