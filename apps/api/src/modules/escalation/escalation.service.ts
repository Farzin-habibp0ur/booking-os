import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { QueryEscalationDto } from './dto';

// V1.1 Section 7: Auto-escalation trigger patterns
const YELLOW_TRIGGERS = [
  { type: 'MENTIONS_PRICING', pattern: /\b(price|pricing|cost|fee|discount|free trial)\b/i },
  { type: 'COMPETITOR_NAMES', pattern: /\b(calendly|acuity|mindbody|vagaro|fresha|square)\b/i },
  {
    type: 'GUARANTEES_PROMISES',
    pattern: /\b(guarantee|promise|ensure|100%|always|never fail)\b/i,
  },
  {
    type: 'LEGAL_COMPLIANCE',
    pattern: /\b(hipaa|gdpr|compliant|certified|regulation|privacy policy)\b/i,
  },
  { type: 'NEGATIVE_SENTIMENT', pattern: /\b(worst|terrible|awful|horrible|hate|disgusting)\b/i },
  {
    type: 'RELIGIOUS_POLITICAL',
    pattern: /\b(church|mosque|temple|democrat|republican|liberal|conservative|election)\b/i,
  },
];

const RED_TRIGGERS = [
  { type: 'REVENUE_CLAIMS', pattern: /\b(earn|revenue|income|made \$|gross|net profit)\b/i },
  { type: 'ROI_GUARANTEES', pattern: /\b(roi|return on investment|guaranteed.*return|10x|20x)\b/i },
  {
    type: 'CONTRACT_TERMS',
    pattern: /\b(contract|binding|terms and conditions|agreement|liability)\b/i,
  },
  { type: 'LEGAL_DISCLAIMERS', pattern: /\b(disclaimer|not liable|no warranty|as-is|indemnif)\b/i },
  {
    type: 'FOUNDER_QUOTES',
    pattern: /\b(our (ceo|founder|cto) (said|believes|stated)|according to our founder)\b/i,
  },
  {
    type: 'CLIENT_DATA',
    pattern: /\b(case study.*client|client.*name|real.*result|actual.*customer)\b/i,
  },
  {
    type: 'PRESS_RELEASE',
    pattern: /\b(press release|for immediate release|media contact|pr newswire)\b/i,
  },
];

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  constructor(private prisma: PrismaService) {}

  evaluateAutoEscalation(content: { title: string; body: string; tier?: string | null }): {
    tier: string;
    triggers: string[];
  } {
    const text = `${content.title} ${content.body}`;
    const triggers: string[] = [];
    let tier = content.tier || 'GREEN';

    for (const trigger of RED_TRIGGERS) {
      if (trigger.pattern.test(text)) {
        triggers.push(trigger.type);
        tier = 'RED';
      }
    }

    if (tier !== 'RED') {
      for (const trigger of YELLOW_TRIGGERS) {
        if (trigger.pattern.test(text)) {
          triggers.push(trigger.type);
          if (tier === 'GREEN') tier = 'YELLOW';
        }
      }
    }

    return { tier, triggers };
  }

  async recordEscalation(data: {
    businessId: string;
    triggerType: string;
    severity: string;
    title: string;
    description?: string;
    agentId?: string;
    contentDraftId?: string;
    metadata?: any;
  }) {
    return this.prisma.escalationEvent.create({
      data: {
        businessId: data.businessId,
        triggerType: data.triggerType,
        severity: data.severity,
        title: data.title,
        description: data.description,
        agentId: data.agentId,
        contentDraftId: data.contentDraftId,
        metadata: data.metadata || {},
      },
    });
  }

  async getHistory(businessId: string, query: QueryEscalationDto) {
    const where: any = { businessId };
    if (query.triggerType) where.triggerType = query.triggerType;
    if (query.severity) where.severity = query.severity;
    if (query.isResolved !== undefined) where.isResolved = query.isResolved === 'true';
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = Math.min(query.take ? parseInt(query.take, 10) : 20, 100);

    const [data, total] = await Promise.all([
      this.prisma.escalationEvent.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.escalationEvent.count({ where }),
    ]);

    return { data, total };
  }

  async getStats(businessId: string) {
    const [byTrigger, bySeverity] = await Promise.all([
      this.prisma.escalationEvent.groupBy({
        by: ['triggerType'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.escalationEvent.groupBy({
        by: ['severity'],
        where: { businessId },
        _count: true,
      }),
    ]);

    return {
      byTriggerType: byTrigger.reduce(
        (acc: any, r: any) => ({ ...acc, [r.triggerType]: r._count }),
        {},
      ),
      bySeverity: bySeverity.reduce((acc: any, r: any) => ({ ...acc, [r.severity]: r._count }), {}),
    };
  }
}
