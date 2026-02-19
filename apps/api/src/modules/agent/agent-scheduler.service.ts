import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { AgentFrameworkService } from './agent-framework.service';

@Injectable()
export class AgentSchedulerService {
  private readonly logger = new Logger(AgentSchedulerService.name);
  private processing = false;

  private static readonly MAX_EXECUTION_MS = 50_000;

  constructor(
    private prisma: PrismaService,
    private agentFramework: AgentFrameworkService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async runScheduledAgents() {
    if (this.processing) return;
    this.processing = true;
    const startTime = Date.now();

    try {
      const configs = await this.prisma.agentConfig.findMany({
        where: { isEnabled: true },
        orderBy: { agentType: 'asc' },
      });

      for (const config of configs) {
        if (Date.now() - startTime > AgentSchedulerService.MAX_EXECUTION_MS) {
          this.logger.warn('Agent scheduler time limit reached, deferring remaining agents');
          break;
        }

        const agent = this.agentFramework.getAgent(config.agentType);
        if (!agent) continue;

        // Check if agent ran recently (within last 4 minutes to avoid overlap)
        const recentRun = await this.prisma.agentRun.findFirst({
          where: {
            businessId: config.businessId,
            agentType: config.agentType,
            startedAt: { gte: new Date(Date.now() - 4 * 60 * 1000) },
          },
          orderBy: { startedAt: 'desc' },
        });

        if (recentRun) continue;

        try {
          await this.agentFramework.triggerAgent(config.businessId, config.agentType);
        } catch (err: any) {
          this.logger.error(
            `Scheduled agent ${config.agentType} failed for business ${config.businessId}: ${err.message}`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Agent scheduler error: ${err.message}`);
    } finally {
      this.processing = false;
    }
  }
}
