import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

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
      const [
        activeSubscriptions,
        trialSubscriptions,
        pastDueSubscriptions,
        canceledSubscriptions,
      ] = await Promise.all([
        this.prisma.subscription.count({ where: { status: 'active' } }),
        this.prisma.subscription.count({ where: { status: 'trialing' } }),
        this.prisma.subscription.count({ where: { status: 'past_due' } }),
        this.prisma.subscription.count({ where: { status: 'canceled' } }),
      ]);

      // Batch 4: Agents + support + security
      const [totalAgentRuns, agentRuns7d, failedAgentRuns7d, openSupportCases, activeViewAsSessions] =
        await Promise.all([
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
    } catch (error) {
      this.logger.error('Failed to get overview data', error);
      throw error;
    }
  }
}
