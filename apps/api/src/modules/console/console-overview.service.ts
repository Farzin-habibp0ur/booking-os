import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class ConsoleOverviewService {
  private readonly logger = new Logger(ConsoleOverviewService.name);

  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      totalBusinesses,
      totalStaff,
      totalCustomers,
      totalBookings,
      bookingsToday,
      bookings7d,
      bookings30d,
      totalConversations,
      activeSubscriptions,
      trialSubscriptions,
      pastDueSubscriptions,
      canceledSubscriptions,
      totalAgentRuns,
      agentRuns7d,
      failedAgentRuns7d,
      openSupportCases,
      recentAuditLogs,
      activeViewAsSessions,
    ] = await Promise.all([
      this.prisma.business.count(),
      this.prisma.staff.count({ where: { isActive: true } }),
      this.prisma.customer.count(),
      this.prisma.booking.count(),
      this.prisma.booking.count({ where: { createdAt: { gte: todayStart } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      this.prisma.booking.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.conversation.count(),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.subscription.count({ where: { status: 'trialing' } }),
      this.prisma.subscription.count({ where: { status: 'past_due' } }),
      this.prisma.subscription.count({ where: { status: 'canceled' } }),
      this.prisma.agentRun.count(),
      this.prisma.agentRun.count({ where: { startedAt: { gte: sevenDaysAgo } } }),
      this.prisma.agentRun.count({
        where: { startedAt: { gte: sevenDaysAgo }, status: 'FAILED' },
      }),
      this.prisma.supportCase.count({ where: { status: { in: ['open', 'in_progress'] } } }),
      this.prisma.platformAuditLog.findMany({
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
      }),
      this.prisma.viewAsSession.count({
        where: { endedAt: null, expiresAt: { gt: now } },
      }),
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
    };
  }
}
