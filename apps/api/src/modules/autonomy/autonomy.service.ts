import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export type AutonomyLevel = 'OFF' | 'ASSISTED' | 'AUTO';

@Injectable()
export class AutonomyService {
  private readonly logger = new Logger(AutonomyService.name);

  constructor(private prisma: PrismaService) {}

  async getConfigs(businessId: string) {
    return this.prisma.autonomyConfig.findMany({
      where: { businessId },
      orderBy: { actionType: 'asc' },
    });
  }

  async getConfig(businessId: string, actionType: string) {
    return this.prisma.autonomyConfig.findUnique({
      where: { businessId_actionType: { businessId, actionType } },
    });
  }

  async upsertConfig(
    businessId: string,
    actionType: string,
    data: {
      autonomyLevel: AutonomyLevel;
      requiredRole?: string;
      constraints?: any;
    },
  ) {
    return this.prisma.autonomyConfig.upsert({
      where: { businessId_actionType: { businessId, actionType } },
      create: {
        businessId,
        actionType,
        autonomyLevel: data.autonomyLevel,
        requiredRole: data.requiredRole,
        constraints: data.constraints || {},
      },
      update: {
        autonomyLevel: data.autonomyLevel,
        requiredRole: data.requiredRole,
        constraints: data.constraints || {},
      },
    });
  }

  async getLevel(businessId: string, actionType: string): Promise<AutonomyLevel> {
    // Check specific config first, then fallback to wildcard "*", then default
    const specific = await this.prisma.autonomyConfig.findUnique({
      where: { businessId_actionType: { businessId, actionType } },
    });
    if (specific) return specific.autonomyLevel as AutonomyLevel;

    const wildcard = await this.prisma.autonomyConfig.findUnique({
      where: { businessId_actionType: { businessId, actionType: '*' } },
    });
    if (wildcard) return wildcard.autonomyLevel as AutonomyLevel;

    return 'ASSISTED';
  }

  async checkConstraints(
    businessId: string,
    actionType: string,
  ): Promise<{ allowed: boolean; reason?: string }> {
    const config = await this.prisma.autonomyConfig.findUnique({
      where: { businessId_actionType: { businessId, actionType } },
    });

    if (!config) return { allowed: true };

    const constraints = (config.constraints as any) || {};

    if (constraints.maxPerDay) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const count = await this.prisma.actionCard.count({
        where: {
          businessId,
          type: actionType,
          status: 'EXECUTED',
          resolvedAt: { gte: todayStart },
        },
      });
      if (count >= constraints.maxPerDay) {
        return {
          allowed: false,
          reason: `Daily limit of ${constraints.maxPerDay} reached for ${actionType}`,
        };
      }
    }

    return { allowed: true };
  }
}
