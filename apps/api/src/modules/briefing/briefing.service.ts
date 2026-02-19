import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

interface BriefingCard {
  id: string;
  type: string;
  category: string;
  priority: number;
  title: string;
  description: string;
  suggestedAction?: string | null;
  ctaConfig: any;
  autonomyLevel: string;
  status: string;
  customer?: { id: string; name: string } | null;
  booking?: { id: string; startTime: Date; service?: { name: string } | null } | null;
  staff?: { id: string; name: string } | null;
  conversationId?: string | null;
  createdAt: Date;
  expiresAt?: Date | null;
}

interface BriefingGroup {
  category: string;
  label: string;
  cards: BriefingCard[];
}

export interface BriefingResult {
  groups: BriefingGroup[];
  totalPending: number;
  urgentCount: number;
  lastRefreshed: Date;
}

const CATEGORY_ORDER = ['URGENT_TODAY', 'NEEDS_APPROVAL', 'OPPORTUNITY', 'HYGIENE'];
const CATEGORY_LABELS: Record<string, string> = {
  URGENT_TODAY: 'Urgent Today',
  NEEDS_APPROVAL: 'Needs Your Approval',
  OPPORTUNITY: 'Opportunities',
  HYGIENE: 'Hygiene & Maintenance',
};

@Injectable()
export class BriefingService {
  private readonly logger = new Logger(BriefingService.name);

  constructor(private prisma: PrismaService) {}

  async getBriefing(businessId: string, staffId?: string, role?: string): Promise<BriefingResult> {
    const where: any = {
      businessId,
      status: 'PENDING',
    };

    // Non-admin staff only see cards assigned to them or unassigned
    if (role && role !== 'ADMIN' && staffId) {
      where.OR = [{ staffId }, { staffId: null }];
    }

    const cards = await this.prisma.actionCard.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true } },
        booking: {
          select: {
            id: true,
            startTime: true,
            service: { select: { name: true } },
          },
        },
        staff: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    // Group by category
    const groupMap = new Map<string, BriefingCard[]>();
    for (const card of cards) {
      const cat = card.category || 'HYGIENE';
      if (!groupMap.has(cat)) groupMap.set(cat, []);
      groupMap.get(cat)!.push(card);
    }

    // Build sorted groups
    const groups: BriefingGroup[] = [];
    for (const category of CATEGORY_ORDER) {
      const groupCards = groupMap.get(category);
      if (groupCards && groupCards.length > 0) {
        groups.push({
          category,
          label: CATEGORY_LABELS[category] || category,
          cards: groupCards,
        });
      }
    }

    // Any remaining categories not in order
    for (const [cat, groupCards] of groupMap) {
      if (!CATEGORY_ORDER.includes(cat)) {
        groups.push({
          category: cat,
          label: CATEGORY_LABELS[cat] || cat,
          cards: groupCards,
        });
      }
    }

    const urgentCount = groupMap.get('URGENT_TODAY')?.length || 0;

    return {
      groups,
      totalPending: cards.length,
      urgentCount,
      lastRefreshed: new Date(),
    };
  }

  async getOpportunities(businessId: string): Promise<BriefingCard[]> {
    return this.prisma.actionCard.findMany({
      where: {
        businessId,
        status: 'PENDING',
        category: 'OPPORTUNITY',
      },
      include: {
        customer: { select: { id: true, name: true } },
        booking: {
          select: {
            id: true,
            startTime: true,
            service: { select: { name: true } },
          },
        },
        staff: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 20,
    });
  }
}
