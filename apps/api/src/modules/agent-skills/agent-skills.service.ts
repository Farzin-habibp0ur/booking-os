import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface AgentSkillDefinition {
  agentType: string;
  name: string;
  description: string;
  category: 'proactive' | 'reactive' | 'maintenance';
  defaultEnabled: boolean;
}

const PACK_SKILLS: Record<string, AgentSkillDefinition[]> = {
  aesthetic: [
    {
      agentType: 'WAITLIST',
      name: 'Waitlist Matching',
      description: 'Automatically matches waitlisted patients with available appointment slots',
      category: 'proactive',
      defaultEnabled: true,
    },
    {
      agentType: 'RETENTION',
      name: 'Patient Retention',
      description: 'Detects patients who are overdue for their regular treatments and suggests follow-up',
      category: 'proactive',
      defaultEnabled: true,
    },
    {
      agentType: 'DATA_HYGIENE',
      name: 'Duplicate Detection',
      description: 'Identifies potential duplicate patient records for review and merge',
      category: 'maintenance',
      defaultEnabled: false,
    },
    {
      agentType: 'SCHEDULING_OPTIMIZER',
      name: 'Schedule Optimization',
      description: 'Finds gaps in provider schedules and suggests fill opportunities',
      category: 'proactive',
      defaultEnabled: true,
    },
    {
      agentType: 'QUOTE_FOLLOWUP',
      name: 'Quote Follow-up',
      description: 'Tracks pending treatment quotes and suggests follow-up when stalled',
      category: 'reactive',
      defaultEnabled: true,
    },
  ],
  dealership: [
    {
      agentType: 'WAITLIST',
      name: 'Service Waitlist',
      description: 'Matches customers on the service waitlist with available bay slots',
      category: 'proactive',
      defaultEnabled: true,
    },
    {
      agentType: 'RETENTION',
      name: 'Service Retention',
      description: 'Identifies vehicles overdue for regular service based on customer visit patterns',
      category: 'proactive',
      defaultEnabled: true,
    },
    {
      agentType: 'DATA_HYGIENE',
      name: 'Customer Dedup',
      description: 'Finds duplicate customer records across sales and service databases',
      category: 'maintenance',
      defaultEnabled: true,
    },
    {
      agentType: 'SCHEDULING_OPTIMIZER',
      name: 'Bay Optimization',
      description: 'Optimizes service bay utilization by identifying scheduling gaps',
      category: 'proactive',
      defaultEnabled: true,
    },
    {
      agentType: 'QUOTE_FOLLOWUP',
      name: 'Estimate Follow-up',
      description: 'Tracks pending repair estimates and follows up with customers',
      category: 'reactive',
      defaultEnabled: true,
    },
  ],
  general: [
    {
      agentType: 'WAITLIST',
      name: 'Waitlist Matching',
      description: 'Matches waitlisted customers with available slots',
      category: 'proactive',
      defaultEnabled: true,
    },
    {
      agentType: 'RETENTION',
      name: 'Customer Retention',
      description: 'Detects customers who may be overdue for their next visit',
      category: 'proactive',
      defaultEnabled: false,
    },
    {
      agentType: 'DATA_HYGIENE',
      name: 'Duplicate Detection',
      description: 'Identifies potential duplicate customer records',
      category: 'maintenance',
      defaultEnabled: false,
    },
    {
      agentType: 'SCHEDULING_OPTIMIZER',
      name: 'Schedule Optimization',
      description: 'Finds gaps in staff schedules and suggests fill opportunities',
      category: 'proactive',
      defaultEnabled: false,
    },
    {
      agentType: 'QUOTE_FOLLOWUP',
      name: 'Quote Follow-up',
      description: 'Tracks pending quotes and suggests follow-up',
      category: 'reactive',
      defaultEnabled: false,
    },
  ],
};

@Injectable()
export class AgentSkillsService {
  private readonly logger = new Logger(AgentSkillsService.name);

  constructor(private prisma: PrismaService) {}

  getSkillsForPack(pack: string): AgentSkillDefinition[] {
    return PACK_SKILLS[pack] || PACK_SKILLS.general || [];
  }

  getAllPackSkills(): Record<string, AgentSkillDefinition[]> {
    return PACK_SKILLS;
  }

  async getBusinessSkills(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });

    if (!business) throw new NotFoundException('Business not found');

    const packSkills = this.getSkillsForPack(business.verticalPack || 'general');

    // Get existing agent configs for this business
    const configs = await this.prisma.agentConfig.findMany({
      where: { businessId },
    });

    const configMap = new Map(configs.map((c) => [c.agentType, c]));

    return packSkills.map((skill) => {
      const config = configMap.get(skill.agentType);
      return {
        ...skill,
        isEnabled: config?.isEnabled ?? skill.defaultEnabled,
        autonomyLevel: config?.autonomyLevel ?? 'SUGGEST',
        config: config?.config ?? {},
        hasConfig: !!config,
      };
    });
  }

  async enableSkill(businessId: string, agentType: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });

    if (!business) throw new NotFoundException('Business not found');

    const packSkills = this.getSkillsForPack(business.verticalPack || 'general');
    const skill = packSkills.find((s) => s.agentType === agentType);
    if (!skill) throw new NotFoundException(`Skill ${agentType} not available for this pack`);

    return this.prisma.agentConfig.upsert({
      where: { businessId_agentType: { businessId, agentType } },
      create: {
        businessId,
        agentType,
        isEnabled: true,
        autonomyLevel: 'SUGGEST',
        config: {},
        roleVisibility: [],
      },
      update: { isEnabled: true },
    });
  }

  async disableSkill(businessId: string, agentType: string) {
    const config = await this.prisma.agentConfig.findUnique({
      where: { businessId_agentType: { businessId, agentType } },
    });

    if (!config) throw new NotFoundException(`Agent config not found for ${agentType}`);

    return this.prisma.agentConfig.update({
      where: { id: config.id },
      data: { isEnabled: false },
    });
  }

  async updateSkillConfig(
    businessId: string,
    agentType: string,
    data: { autonomyLevel?: string; config?: any },
  ) {
    return this.prisma.agentConfig.upsert({
      where: { businessId_agentType: { businessId, agentType } },
      create: {
        businessId,
        agentType,
        isEnabled: false,
        autonomyLevel: data.autonomyLevel ?? 'SUGGEST',
        config: data.config ?? {},
        roleVisibility: [],
      },
      update: {
        ...(data.autonomyLevel !== undefined && { autonomyLevel: data.autonomyLevel }),
        ...(data.config !== undefined && { config: data.config }),
      },
    });
  }
}
