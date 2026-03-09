import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class MarketingAgentService {
  private readonly logger = new Logger(MarketingAgentService.name);

  constructor(private prisma: PrismaService) {}

  async getBusinessContext(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, verticalPack: true },
    });

    const topServices = await this.prisma.service.findMany({
      where: { businessId, isActive: true },
      select: { name: true, description: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
    });

    return {
      businessName: business?.name || 'Unknown Business',
      vertical: business?.verticalPack || 'GENERAL',
      description: '',
      topServices: topServices.map((s) => s.name),
    };
  }

  async getRecentDraftTopics(businessId: string, days = 14): Promise<string[]> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const drafts = await this.prisma.contentDraft.findMany({
      where: { businessId, createdAt: { gte: since } },
      select: { title: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return drafts.map((d) => d.title);
  }

  async pickNextPillar(businessId: string): Promise<string> {
    const pillars = [
      'INDUSTRY_INSIGHTS',
      'PRODUCT_EDUCATION',
      'CUSTOMER_SUCCESS',
      'THOUGHT_LEADERSHIP',
      'TECHNICAL',
    ];

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const counts = await this.prisma.contentDraft.groupBy({
      by: ['pillar'],
      where: { businessId, createdAt: { gte: since }, pillar: { not: null } },
      _count: true,
    });

    const countMap: Record<string, number> = {};
    for (const c of counts) {
      if (c.pillar) countMap[c.pillar] = c._count;
    }

    // Pick pillar with fewest recent drafts
    let minCount = Infinity;
    let picked = pillars[0];
    for (const p of pillars) {
      const count = countMap[p] || 0;
      if (count < minCount) {
        minCount = count;
        picked = p;
      }
    }

    return picked;
  }

  async getContentGaps(businessId: string) {
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const scheduled = await this.prisma.contentDraft.findMany({
      where: {
        businessId,
        status: { in: ['SCHEDULED', 'APPROVED'] },
        scheduledFor: { lte: nextWeek },
      },
      select: { channel: true, pillar: true },
    });

    const allChannels = ['BLOG', 'TWITTER', 'LINKEDIN', 'INSTAGRAM', 'EMAIL', 'YOUTUBE'];
    const allPillars = [
      'INDUSTRY_INSIGHTS',
      'PRODUCT_EDUCATION',
      'CUSTOMER_SUCCESS',
      'THOUGHT_LEADERSHIP',
      'TECHNICAL',
    ];

    const coveredChannels = new Set(scheduled.map((s) => s.channel));
    const coveredPillars = new Set(scheduled.filter((s) => s.pillar).map((s) => s.pillar));

    return {
      missingChannels: allChannels.filter((c) => !coveredChannels.has(c)),
      missingPillars: allPillars.filter((p) => !coveredPillars.has(p)),
    };
  }

  parseAIResponse(raw: string): { title?: string; body?: string; summary?: string; recommendations?: string[] } {
    try {
      return JSON.parse(raw);
    } catch {
      this.logger.warn('Failed to parse AI response as JSON, using raw text');
      return { title: 'Generated Content', body: raw };
    }
  }
}
