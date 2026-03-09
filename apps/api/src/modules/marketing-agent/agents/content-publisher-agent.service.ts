import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma.service';
import { AgentFrameworkService, BackgroundAgent } from '../../agent/agent-framework.service';

@Injectable()
export class ContentPublisherAgentService implements BackgroundAgent, OnModuleInit {
  readonly agentType = 'MKT_PUBLISHER';
  private readonly logger = new Logger(ContentPublisherAgentService.name);

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

    // Find scheduled drafts whose scheduledFor has passed
    const ready = await this.prisma.contentDraft.findMany({
      where: {
        businessId,
        status: 'SCHEDULED',
        scheduledFor: { lte: now },
      },
      orderBy: { scheduledFor: 'asc' },
      take: 20,
    });

    if (ready.length === 0) {
      return { cardsCreated: 0 };
    }

    let published = 0;

    for (const draft of ready) {
      await this.prisma.contentDraft.update({
        where: { id: draft.id },
        data: {
          status: 'PUBLISHED',
          publishedAt: now,
        },
      });

      published++;
    }

    this.logger.log(
      `Publisher agent published ${published} drafts for business ${businessId}`,
    );

    return { cardsCreated: published };
  }
}
