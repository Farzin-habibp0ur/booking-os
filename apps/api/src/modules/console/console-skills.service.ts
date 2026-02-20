import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PACK_SKILLS, AgentSkillDefinition } from '../agent-skills/agent-skills.service';

@Injectable()
export class ConsoleSkillsService {
  private readonly logger = new Logger(ConsoleSkillsService.name);

  constructor(private prisma: PrismaService) {}

  async getCatalog() {
    const packs = await Promise.all(
      Object.entries(PACK_SKILLS).map(async ([slug, skills]) => {
        const businessCount = await this.prisma.business.count({
          where: { verticalPack: slug },
        });

        const skillStats = await Promise.all(
          skills.map(async (skill) => {
            const enabledCount = businessCount > 0
              ? await this.prisma.agentConfig.count({
                  where: {
                    agentType: skill.agentType,
                    isEnabled: true,
                    business: { verticalPack: slug },
                  },
                })
              : 0;

            return {
              agentType: skill.agentType,
              name: skill.name,
              description: skill.description,
              category: skill.category,
              defaultEnabled: skill.defaultEnabled,
              enabledCount,
              businessCount,
              adoptionPercent:
                businessCount > 0
                  ? Math.round((enabledCount / businessCount) * 100)
                  : 0,
            };
          }),
        );

        return { slug, skills: skillStats };
      }),
    );

    return { packs };
  }

  async getSkillAdoption(agentType: string) {
    const skillDef = this.findSkillDefinition(agentType);
    if (!skillDef) {
      throw new NotFoundException(`Unknown agent type: ${agentType}`);
    }

    const configs = await this.prisma.agentConfig.findMany({
      where: { agentType },
      include: {
        business: {
          select: { id: true, name: true, slug: true, verticalPack: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalBusinesses = await this.prisma.business.count();
    const enabledCount = configs.filter((c) => c.isEnabled).length;

    return {
      agentType,
      name: skillDef.name,
      category: skillDef.category,
      totalBusinesses,
      enabledCount,
      configs: configs.map((c) => ({
        businessId: c.business.id,
        businessName: c.business.name,
        businessSlug: c.business.slug,
        verticalPack: c.business.verticalPack,
        isEnabled: c.isEnabled,
        autonomyLevel: c.autonomyLevel,
        createdAt: c.createdAt,
      })),
    };
  }

  async platformOverride(agentType: string, enabled: boolean, actorId: string) {
    const skillDef = this.findSkillDefinition(agentType);
    if (!skillDef) {
      throw new NotFoundException(`Unknown agent type: ${agentType}`);
    }

    const businesses = await this.prisma.business.findMany({
      select: { id: true },
    });

    if (businesses.length === 0) {
      return { agentType, enabled, affectedCount: 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const biz of businesses) {
        await tx.agentConfig.upsert({
          where: { businessId_agentType: { businessId: biz.id, agentType } },
          create: {
            businessId: biz.id,
            agentType,
            isEnabled: enabled,
            autonomyLevel: 'SUGGEST',
            config: {},
            roleVisibility: [],
          },
          update: { isEnabled: enabled },
        });
      }
    });

    this.logger.warn(
      `Platform override: ${agentType} → ${enabled ? 'enabled' : 'disabled'} for ${businesses.length} businesses by ${actorId}`,
    );

    return { agentType, enabled, affectedCount: businesses.length };
  }

  private findSkillDefinition(agentType: string): AgentSkillDefinition | null {
    for (const skills of Object.values(PACK_SKILLS)) {
      const found = skills.find((s) => s.agentType === agentType);
      if (found) return found;
    }
    return null;
  }
}
