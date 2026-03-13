import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface BriefingItem {
  id: string;
  title: string;
  description: string;
  priority: 'URGENT_TODAY' | 'NEEDS_APPROVAL' | 'OPPORTUNITY' | 'HYGIENE';
  sourceAgent: string | null;
  createdAt: Date;
  quickActions: string[];
}

const PRIORITY_ORDER = ['URGENT_TODAY', 'NEEDS_APPROVAL', 'OPPORTUNITY', 'HYGIENE'];

@Injectable()
export class DashboardBriefingService {
  constructor(private prisma: PrismaService) {}

  async getBriefingFeed(businessId: string): Promise<BriefingItem[]> {
    const cards = await this.prisma.actionCard.findMany({
      where: { businessId, status: 'PENDING' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
      take: 50,
    });

    const items: BriefingItem[] = cards.map((card) => {
      const metadata = card.metadata as any;
      const priority = this.classifyPriority(card.priority, card.category);

      return {
        id: card.id,
        title: card.title,
        description: card.description,
        priority,
        sourceAgent: metadata?.sourceAgentId ?? card.type,
        createdAt: card.createdAt,
        quickActions: ['approve', 'dismiss', 'snooze', 'expand'],
      };
    });

    return items.sort(
      (a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority),
    );
  }

  async getBriefingCount(businessId: string) {
    const cards = await this.prisma.actionCard.findMany({
      where: { businessId, status: 'PENDING' },
      select: { priority: true, category: true },
    });

    const counts: Record<string, number> = {
      URGENT_TODAY: 0,
      NEEDS_APPROVAL: 0,
      OPPORTUNITY: 0,
      HYGIENE: 0,
    };

    for (const card of cards) {
      const priority = this.classifyPriority(card.priority, card.category);
      counts[priority]++;
    }

    return {
      URGENT_TODAY: counts.URGENT_TODAY,
      NEEDS_APPROVAL: counts.NEEDS_APPROVAL,
      OPPORTUNITY: counts.OPPORTUNITY,
      HYGIENE: counts.HYGIENE,
      total: cards.length,
    };
  }

  async executeBriefingAction(
    businessId: string,
    cardId: string,
    action: string,
    staffId?: string,
  ) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id: cardId, businessId },
    });
    if (!card) throw new NotFoundException('Briefing item not found');

    switch (action) {
      case 'approve':
        return this.prisma.actionCard.update({
          where: { id: cardId },
          data: { status: 'APPROVED', resolvedAt: new Date(), resolvedById: staffId },
        });
      case 'dismiss':
        return this.prisma.actionCard.update({
          where: { id: cardId },
          data: { status: 'DISMISSED', resolvedAt: new Date(), resolvedById: staffId },
        });
      case 'snooze': {
        const snoozedUntil = new Date();
        snoozedUntil.setHours(snoozedUntil.getHours() + 4);
        return this.prisma.actionCard.update({
          where: { id: cardId },
          data: { status: 'SNOOZED', snoozedUntil },
        });
      }
      default:
        return card;
    }
  }

  async getMonthlyReview(businessId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      contentDrafts,
      prevContentDrafts,
      rejectionLogs,
      agentRuns,
      budgetEntries,
      actionCards,
    ] = await Promise.all([
      this.prisma.contentDraft.count({
        where: { businessId, createdAt: { gte: monthStart } },
      }),
      this.prisma.contentDraft.count({
        where: { businessId, createdAt: { gte: prevMonthStart, lt: monthStart } },
      }),
      this.prisma.rejectionLog.count({
        where: { businessId, createdAt: { gte: monthStart } },
      }),
      this.prisma.agentRun.count({
        where: { businessId, startedAt: { gte: monthStart } },
      }),
      this.prisma.budgetEntry.findMany({
        where: { businessId, month: now.getMonth() + 1, year: now.getFullYear() },
      }),
      this.prisma.actionCard.count({
        where: { businessId, createdAt: { gte: monthStart }, status: 'EXECUTED' },
      }),
    ]);

    const totalBudget = budgetEntries.reduce((sum, e) => sum + Number(e.amount), 0);
    const contentGrowth =
      prevContentDrafts > 0
        ? Math.round(((contentDrafts - prevContentDrafts) / prevContentDrafts) * 100)
        : 0;

    return {
      period: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
      content: {
        totalDrafts: contentDrafts,
        previousMonth: prevContentDrafts,
        growthPercent: contentGrowth,
        rejections: rejectionLogs,
      },
      agents: {
        totalRuns: agentRuns,
        cardsExecuted: actionCards,
      },
      budget: {
        totalSpend: totalBudget,
        entryCount: budgetEntries.length,
      },
      generatedAt: new Date(),
    };
  }

  async generateMonthlyReview(businessId: string) {
    const review = await this.getMonthlyReview(businessId);

    const recommendations: string[] = [];

    if (review.content.rejections > review.content.totalDrafts * 0.2) {
      recommendations.push('Rejection rate above 20%. Review quality gate criteria and agent prompts.');
    }
    if (review.content.growthPercent < 0) {
      recommendations.push('Content output declined. Check agent scheduling and capacity.');
    }
    if (review.budget.totalSpend === 0) {
      recommendations.push('No budget allocated this month. Consider tool investments for growth.');
    }
    if (review.agents.totalRuns === 0) {
      recommendations.push('No agent runs recorded. Verify agent configs and scheduling.');
    }

    return { ...review, recommendations };
  }

  private classifyPriority(
    priority: number,
    category: string,
  ): 'URGENT_TODAY' | 'NEEDS_APPROVAL' | 'OPPORTUNITY' | 'HYGIENE' {
    if (priority >= 80) return 'URGENT_TODAY';
    if (priority >= 60 || category === 'CONTENT_REVIEW') return 'NEEDS_APPROVAL';
    if (priority >= 30) return 'OPPORTUNITY';
    return 'HYGIENE';
  }
}
