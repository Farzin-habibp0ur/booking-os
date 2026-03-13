import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export type MarketingAutonomyLevel = 'OFF' | 'SUGGEST' | 'AUTO_WITH_REVIEW' | 'FULL_AUTO';

export interface AutonomySettingDef {
  actionType: string;
  defaultLevel: MarketingAutonomyLevel;
  description: string;
}

export const DEFAULT_MARKETING_AUTONOMY: AutonomySettingDef[] = [
  {
    actionType: 'GREEN_CONTENT_PUBLISH',
    defaultLevel: 'AUTO_WITH_REVIEW',
    description: 'Publish GREEN tier content',
  },
  {
    actionType: 'YELLOW_CONTENT_PUBLISH',
    defaultLevel: 'SUGGEST',
    description: 'Publish YELLOW tier content',
  },
  {
    actionType: 'RED_CONTENT_PUBLISH',
    defaultLevel: 'OFF',
    description: 'Publish RED tier content (always manual)',
  },
  {
    actionType: 'EMAIL_SEQUENCE_TRIGGER',
    defaultLevel: 'AUTO_WITH_REVIEW',
    description: 'Trigger email sequences',
  },
  {
    actionType: 'SOCIAL_MEDIA_POSTING',
    defaultLevel: 'SUGGEST',
    description: 'Post to social media',
  },
  {
    actionType: 'BUDGET_ALLOCATION',
    defaultLevel: 'OFF',
    description: 'Allocate marketing budget',
  },
  { actionType: 'AB_TEST_CREATION', defaultLevel: 'SUGGEST', description: 'Create A/B tests' },
  {
    actionType: 'AGENT_SCHEDULING',
    defaultLevel: 'AUTO_WITH_REVIEW',
    description: 'Schedule agent runs',
  },
];

@Injectable()
export class AutonomySettingsService {
  constructor(private prisma: PrismaService) {}

  async seedDefaults(businessId: string): Promise<number> {
    let created = 0;
    for (const def of DEFAULT_MARKETING_AUTONOMY) {
      const existing = await this.prisma.autonomyConfig.findUnique({
        where: { businessId_actionType: { businessId, actionType: def.actionType } },
      });
      if (!existing) {
        await this.prisma.autonomyConfig.create({
          data: {
            businessId,
            actionType: def.actionType,
            autonomyLevel: def.defaultLevel,
            scope: 'MARKETING',
            constraints: {},
          },
        });
        created++;
      }
    }
    return created;
  }

  async findAll(businessId: string) {
    const configs = await this.prisma.autonomyConfig.findMany({
      where: { businessId, scope: 'MARKETING' },
      orderBy: { actionType: 'asc' },
    });

    if (configs.length === 0) {
      await this.seedDefaults(businessId);
      return this.prisma.autonomyConfig.findMany({
        where: { businessId, scope: 'MARKETING' },
        orderBy: { actionType: 'asc' },
      });
    }

    return configs;
  }

  async update(businessId: string, actionType: string, level: MarketingAutonomyLevel) {
    const config = await this.prisma.autonomyConfig.findUnique({
      where: { businessId_actionType: { businessId, actionType } },
    });
    if (!config) throw new NotFoundException(`Autonomy setting for ${actionType} not found`);

    return this.prisma.autonomyConfig.update({
      where: { businessId_actionType: { businessId, actionType } },
      data: { autonomyLevel: level },
    });
  }

  async resetToDefaults(businessId: string) {
    await this.prisma.autonomyConfig.deleteMany({
      where: { businessId, scope: 'MARKETING' },
    });
    const count = await this.seedDefaults(businessId);
    return { reset: true, count };
  }

  async getLevel(businessId: string, actionType: string): Promise<MarketingAutonomyLevel> {
    const config = await this.prisma.autonomyConfig.findUnique({
      where: { businessId_actionType: { businessId, actionType } },
    });
    if (config) return config.autonomyLevel as MarketingAutonomyLevel;

    const def = DEFAULT_MARKETING_AUTONOMY.find((d) => d.actionType === actionType);
    return def?.defaultLevel ?? 'SUGGEST';
  }
}
