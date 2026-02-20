import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface AttentionItem {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  title: string;
  description: string;
  actionLabel: string;
  actionHref: string;
  timestamp: string;
}

export interface AtRiskAccount {
  businessId: string;
  businessName: string;
  riskScore: number;
  plan: string | null;
  status: string | null;
  lastBooking: string | null;
  topSignal: string;
}

@Injectable()
export class ConsoleOverviewService {
  private readonly logger = new Logger(ConsoleOverviewService.name);

  constructor(private prisma: PrismaService) {}

  async getOverview() {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Batch 1: Core entity counts
      const [totalBusinesses, totalStaff, totalCustomers, totalConversations] = await Promise.all([
        this.prisma.business.count(),
        this.prisma.staff.count({ where: { isActive: true } }),
        this.prisma.customer.count(),
        this.prisma.conversation.count(),
      ]);

      // Batch 2: Booking counts
      const [totalBookings, bookingsToday, bookings7d, bookings30d] = await Promise.all([
        this.prisma.booking.count(),
        this.prisma.booking.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.booking.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
        this.prisma.booking.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      ]);

      // Batch 3: Subscription + agent counts
      const [activeSubscriptions, trialSubscriptions, pastDueSubscriptions, canceledSubscriptions] =
        await Promise.all([
          this.prisma.subscription.count({ where: { status: 'active' } }),
          this.prisma.subscription.count({ where: { status: 'trialing' } }),
          this.prisma.subscription.count({ where: { status: 'past_due' } }),
          this.prisma.subscription.count({ where: { status: 'canceled' } }),
        ]);

      // Batch 4: Agents + support + security
      const [
        totalAgentRuns,
        agentRuns7d,
        failedAgentRuns7d,
        openSupportCases,
        activeViewAsSessions,
      ] = await Promise.all([
        this.prisma.agentRun.count(),
        this.prisma.agentRun.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
        this.prisma.agentRun.count({
          where: { startedAt: { gte: sevenDaysAgo }, status: 'FAILED' },
        }),
        this.prisma.supportCase.count({ where: { status: { in: ['open', 'in_progress'] } } }),
        this.prisma.viewAsSession.count({
          where: { endedAt: null, expiresAt: { gt: now } },
        }),
      ]);

      // Batch 5: Audit logs (single query)
      const recentAuditLogs = await this.prisma.platformAuditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          actorEmail: true,
          action: true,
          targetType: true,
          targetId: true,
          createdAt: true,
        },
      });

      // Batch 6: Attention items + accounts at risk (parallel)
      const [attentionItems, accountsAtRisk] = await Promise.all([
        this.getAttentionItems(),
        this.getAccountsAtRisk(),
      ]);

      return {
        businesses: {
          total: totalBusinesses,
          withActiveSubscription: activeSubscriptions,
          trial: trialSubscriptions,
          pastDue: pastDueSubscriptions,
          canceled: canceledSubscriptions,
        },
        bookings: {
          total: totalBookings,
          today: bookingsToday,
          last7d: bookings7d,
          last30d: bookings30d,
        },
        platform: {
          totalStaff,
          totalCustomers,
          totalConversations,
          totalAgentRuns,
          agentRuns7d,
          failedAgentRuns7d,
        },
        support: {
          openCases: openSupportCases,
        },
        security: {
          activeViewAsSessions,
        },
        recentAuditLogs,
        attentionItems,
        accountsAtRisk,
      };
    } catch (error) {
      this.logger.error('Failed to get overview data', error);
      throw error;
    }
  }

  async getAttentionItems(): Promise<AttentionItem[]> {
    try {
      const now = new Date();
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        pastDueSubs,
        urgentCases,
        activeViewAs,
        agentRuns7d,
        failedRuns7d,
        dormantBusinesses,
        openCases,
      ] = await Promise.all([
        // Past-due subscriptions > 3 days
        this.prisma.subscription.findMany({
          where: { status: 'past_due', updatedAt: { lte: threeDaysAgo } },
          select: { id: true, businessId: true, business: { select: { name: true } } },
        }),
        // Urgent support cases > 24h old
        this.prisma.supportCase.findMany({
          where: {
            priority: 'urgent',
            status: { in: ['open', 'in_progress'] },
            createdAt: { lte: oneDayAgo },
          },
          select: { id: true, subject: true, businessName: true },
        }),
        // Active view-as sessions
        this.prisma.viewAsSession.findMany({
          where: { endedAt: null, expiresAt: { gt: now } },
          select: { id: true, superAdminId: true, startedAt: true },
        }),
        // Agent runs in 7d (for failure rate)
        this.prisma.agentRun.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
        this.prisma.agentRun.count({
          where: { startedAt: { gte: sevenDaysAgo }, status: 'FAILED' },
        }),
        // Dormant businesses (no bookings in 7d)
        this.prisma.business.findMany({
          where: {
            bookings: { none: { createdAt: { gte: sevenDaysAgo } } },
            subscription: { status: 'active' },
          },
          select: { id: true, name: true },
        }),
        // All open support cases
        this.prisma.supportCase.count({
          where: { status: { in: ['open', 'in_progress'] } },
        }),
      ]);

      const items: AttentionItem[] = [];

      // 1. Critical: Past-due subscriptions
      if (pastDueSubs.length > 0) {
        items.push({
          id: 'past-due-subs',
          severity: 'critical',
          category: 'billing',
          title: `${pastDueSubs.length} past-due subscription${pastDueSubs.length !== 1 ? 's' : ''} (>3 days)`,
          description: pastDueSubs.map((s) => s.business.name).join(', '),
          actionLabel: 'View Billing',
          actionHref: '/console/billing',
          timestamp: now.toISOString(),
        });
      }

      // 2. Warning: Urgent support cases
      if (urgentCases.length > 0) {
        items.push({
          id: 'urgent-support',
          severity: 'warning',
          category: 'support',
          title: `${urgentCases.length} urgent support case${urgentCases.length !== 1 ? 's' : ''} (>24h)`,
          description: urgentCases.map((c) => c.subject).join(', '),
          actionLabel: 'View Support',
          actionHref: '/console/support',
          timestamp: now.toISOString(),
        });
      }

      // 3. Warning: Active view-as sessions
      if (activeViewAs.length > 0) {
        items.push({
          id: 'active-view-as',
          severity: 'warning',
          category: 'security',
          title: `${activeViewAs.length} active view-as session${activeViewAs.length !== 1 ? 's' : ''}`,
          description: 'Admin users are currently impersonating business accounts',
          actionLabel: 'View Security',
          actionHref: '/console/audit',
          timestamp: now.toISOString(),
        });
      }

      // 4. Warning: High agent failure rate
      if (agentRuns7d > 0) {
        const failureRate = (failedRuns7d / agentRuns7d) * 100;
        if (failureRate > 20) {
          items.push({
            id: 'agent-failure-rate',
            severity: 'warning',
            category: 'agents',
            title: `High agent failure rate (${Math.round(failureRate)}%)`,
            description: `${failedRuns7d} of ${agentRuns7d} agent runs failed in the last 7 days`,
            actionLabel: 'View Agents',
            actionHref: '/console/agents',
            timestamp: now.toISOString(),
          });
        }
      }

      // 5. Info: Dormant businesses
      if (dormantBusinesses.length > 0) {
        items.push({
          id: 'dormant-businesses',
          severity: 'info',
          category: 'businesses',
          title: `${dormantBusinesses.length} dormant business${dormantBusinesses.length !== 1 ? 'es' : ''} (no bookings 7d)`,
          description:
            dormantBusinesses
              .slice(0, 3)
              .map((b) => b.name)
              .join(', ') +
            (dormantBusinesses.length > 3 ? ` and ${dormantBusinesses.length - 3} more` : ''),
          actionLabel: 'View Businesses',
          actionHref: '/console/businesses',
          timestamp: now.toISOString(),
        });
      }

      // 6. Info: Open support cases
      if (openCases > 0) {
        items.push({
          id: 'open-support-cases',
          severity: 'info',
          category: 'support',
          title: `${openCases} open support case${openCases !== 1 ? 's' : ''}`,
          description: 'Review and respond to pending support requests',
          actionLabel: 'View Support',
          actionHref: '/console/support',
          timestamp: now.toISOString(),
        });
      }

      // Sort by severity: critical > warning > info
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      items.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

      return items;
    } catch (error) {
      this.logger.error('Failed to get attention items', error);
      return [];
    }
  }

  async getAccountsAtRisk(limit = 10): Promise<AtRiskAccount[]> {
    try {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const businesses = await this.prisma.business.findMany({
        select: {
          id: true,
          name: true,
          subscription: {
            select: { status: true, plan: true },
          },
          bookings: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { createdAt: true },
          },
        },
      });

      // Fetch support cases and agent runs for all businesses
      const [supportCases, agentRuns] = await Promise.all([
        this.prisma.supportCase.findMany({
          where: { status: { in: ['open', 'in_progress'] } },
          select: { businessId: true, priority: true },
        }),
        this.prisma.agentRun.findMany({
          where: { startedAt: { gte: sevenDaysAgo } },
          select: { businessId: true, status: true },
        }),
      ]);

      const supportByBiz = new Map<string, typeof supportCases>();
      for (const sc of supportCases) {
        const arr = supportByBiz.get(sc.businessId) || [];
        arr.push(sc);
        supportByBiz.set(sc.businessId, arr);
      }

      const agentsByBiz = new Map<string, typeof agentRuns>();
      for (const ar of agentRuns) {
        const arr = agentsByBiz.get(ar.businessId) || [];
        arr.push(ar);
        agentsByBiz.set(ar.businessId, arr);
      }

      const scored: AtRiskAccount[] = [];

      for (const biz of businesses) {
        // Billing score (35%)
        let billingScore = 0;
        const billingStatus = biz.subscription?.status || null;
        if (billingStatus === 'past_due') billingScore = 70;
        else if (billingStatus === 'canceled') billingScore = 100;

        // Activity recency score (30%)
        let activityScore = 0;
        const lastBooking = biz.bookings[0]?.createdAt || null;
        if (!lastBooking) {
          activityScore = 100;
        } else {
          const daysSince =
            (now.getTime() - new Date(lastBooking).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSince > 30) activityScore = 100;
          else if (daysSince > 7) activityScore = 50;
        }

        // Support score (20%)
        let supportScore = 0;
        const bizCases = supportByBiz.get(biz.id) || [];
        if (bizCases.some((c) => c.priority === 'urgent')) supportScore = 100;
        else if (bizCases.length >= 2) supportScore = 60;
        else if (bizCases.length === 1) supportScore = 30;

        // AI health score (15%)
        let aiScore = 0;
        const bizRuns = agentsByBiz.get(biz.id) || [];
        if (bizRuns.length > 0) {
          const failRate =
            (bizRuns.filter((r) => r.status === 'FAILED').length / bizRuns.length) * 100;
          if (failRate > 20) aiScore = 100;
          else if (failRate >= 5) aiScore = 50;
        }

        const riskScore = Math.round(
          billingScore * 0.35 + activityScore * 0.3 + supportScore * 0.2 + aiScore * 0.15,
        );

        if (riskScore > 30) {
          // Determine top signal
          const signals = [
            { name: 'Billing', score: billingScore * 0.35 },
            { name: 'Inactivity', score: activityScore * 0.3 },
            { name: 'Support issues', score: supportScore * 0.2 },
            { name: 'AI failures', score: aiScore * 0.15 },
          ];
          const topSignal = signals.sort((a, b) => b.score - a.score)[0].name;

          scored.push({
            businessId: biz.id,
            businessName: biz.name,
            riskScore,
            plan: biz.subscription?.plan || null,
            status: billingStatus,
            lastBooking: lastBooking ? new Date(lastBooking).toISOString() : null,
            topSignal,
          });
        }
      }

      // Sort desc by risk score, limit
      scored.sort((a, b) => b.riskScore - a.riskScore);
      return scored.slice(0, limit);
    } catch (error) {
      this.logger.error('Failed to get accounts at risk', error);
      return [];
    }
  }
}
