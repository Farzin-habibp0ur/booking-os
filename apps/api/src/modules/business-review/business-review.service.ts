import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { ClaudeClient } from '../ai/claude.client';

@Injectable()
export class BusinessReviewService {
  private readonly logger = new Logger(BusinessReviewService.name);

  constructor(
    private prisma: PrismaService,
    private claude: ClaudeClient,
  ) {}

  async getReview(businessId: string, month: string) {
    const existing = await this.prisma.businessReview.findUnique({
      where: { businessId_month: { businessId, month } },
    });
    if (existing) return existing;

    return this.generateReview(businessId, month);
  }

  async listReviews(businessId: string) {
    return this.prisma.businessReview.findMany({
      where: { businessId },
      orderBy: { month: 'desc' },
    });
  }

  async generateReview(businessId: string, month: string) {
    const metrics = await this.aggregateMetrics(businessId, month);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { name: true, verticalPack: true },
    });

    let aiSummary = '';
    if (this.claude.isAvailable()) {
      try {
        aiSummary = await this.claude.complete(
          'sonnet',
          `You are a business analytics assistant for a ${business?.verticalPack || 'general'} business called "${business?.name}". Generate a concise monthly business review summary. Write 3-4 paragraphs covering: overall performance, key wins, areas for improvement, and 3 specific actionable recommendations. Keep the tone professional but encouraging. End with a JSON array of exactly 3 recommendations, each with "title", "description", and "link" (a relative URL path like /calendar, /inbox, /campaigns, /services, /staff, /reports, /settings). Format the recommendations after a line that says "RECOMMENDATIONS_JSON:" followed by the JSON array.`,
          [
            {
              role: 'user',
              content: `Here are the metrics for ${month}:\n${JSON.stringify(metrics, null, 2)}`,
            },
          ],
          1500,
        );
      } catch (err) {
        this.logger.error(`AI summary generation failed: ${(err as Error).message}`);
        aiSummary = 'AI summary is temporarily unavailable. Please check your metrics below for this month\'s performance overview.';
      }
    } else {
      aiSummary = 'AI summary is not available. Configure ANTHROPIC_API_KEY to enable AI-generated business reviews.';
    }

    return this.prisma.businessReview.create({
      data: {
        businessId,
        month,
        metrics,
        aiSummary,
      },
    });
  }

  async aggregateMetrics(businessId: string, month: string) {
    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 1);

    // Previous month for comparison
    const prevStart = new Date(year, mon - 2, 1);
    const prevEnd = new Date(year, mon - 1, 1);

    // Bookings
    const [totalBookings, completedBookings, noShowCount] = await Promise.all([
      this.prisma.booking.count({
        where: { businessId, createdAt: { gte: startDate, lt: endDate } },
      }),
      this.prisma.booking.count({
        where: { businessId, createdAt: { gte: startDate, lt: endDate }, status: 'COMPLETED' },
      }),
      this.prisma.booking.count({
        where: { businessId, createdAt: { gte: startDate, lt: endDate }, status: 'NO_SHOW' },
      }),
    ]);

    const finishedBookings = completedBookings + noShowCount;
    const noShowRate = finishedBookings > 0 ? Math.round((noShowCount / finishedBookings) * 100) : 0;

    // Revenue
    const revenueBookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: { gte: startDate, lt: endDate }, status: 'COMPLETED' },
      include: { service: { select: { price: true } } },
    });
    const totalRevenue = revenueBookings.reduce((sum, b) => sum + b.service.price, 0);
    const avgBookingValue = completedBookings > 0 ? Math.round((totalRevenue / completedBookings) * 100) / 100 : 0;

    // Previous month revenue for comparison
    const prevRevenueBookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: { gte: prevStart, lt: prevEnd }, status: 'COMPLETED' },
      include: { service: { select: { price: true } } },
    });
    const prevRevenue = prevRevenueBookings.reduce((sum, b) => sum + b.service.price, 0);
    const revenueChange = prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : 0;

    // Previous month bookings for comparison
    const prevBookings = await this.prisma.booking.count({
      where: { businessId, createdAt: { gte: prevStart, lt: prevEnd } },
    });
    const bookingsChange = prevBookings > 0 ? Math.round(((totalBookings - prevBookings) / prevBookings) * 100) : 0;

    // Customers
    const newCustomers = await this.prisma.customer.count({
      where: { businessId, createdAt: { gte: startDate, lt: endDate } },
    });

    const customersWithBookings = await this.prisma.booking.groupBy({
      by: ['customerId'],
      where: { businessId, createdAt: { gte: startDate, lt: endDate } },
    });
    const totalCustomersThisMonth = customersWithBookings.length;

    const returningCustomers = await this.prisma.booking.groupBy({
      by: ['customerId'],
      where: {
        businessId,
        createdAt: { gte: startDate, lt: endDate },
        customer: { createdAt: { lt: startDate } },
      },
    });
    const returningCount = returningCustomers.length;
    const retentionRate = totalCustomersThisMonth > 0
      ? Math.round((returningCount / totalCustomersThisMonth) * 100)
      : 0;

    // Top 5 services
    const serviceBookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: { gte: startDate, lt: endDate } },
      include: { service: { select: { id: true, name: true } } },
    });
    const serviceMap: Record<string, { name: string; count: number }> = {};
    for (const b of serviceBookings) {
      if (!serviceMap[b.service.id]) serviceMap[b.service.id] = { name: b.service.name, count: 0 };
      serviceMap[b.service.id].count++;
    }
    const topServices = Object.values(serviceMap).sort((a, b) => b.count - a.count).slice(0, 5);

    // Top 3 staff
    const staffBookings = await this.prisma.booking.findMany({
      where: { businessId, createdAt: { gte: startDate, lt: endDate }, staffId: { not: null }, status: 'COMPLETED' },
      include: { staff: { select: { id: true, name: true } } },
    });
    const staffMap: Record<string, { name: string; completed: number }> = {};
    for (const b of staffBookings) {
      if (!b.staff) continue;
      if (!staffMap[b.staff.id]) staffMap[b.staff.id] = { name: b.staff.name, completed: 0 };
      staffMap[b.staff.id].completed++;
    }
    const topStaff = Object.values(staffMap).sort((a, b) => b.completed - a.completed).slice(0, 3);

    // Busiest days and hours
    const allBookings = await this.prisma.booking.findMany({
      where: { businessId, startTime: { gte: startDate, lt: endDate } },
      select: { startTime: true },
    });
    const dayCounts = new Array(7).fill(0);
    const hourCounts = new Array(24).fill(0);
    for (const b of allBookings) {
      dayCounts[b.startTime.getDay()]++;
      hourCounts[b.startTime.getHours()]++;
    }
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const busiestDays = dayCounts
      .map((count, i) => ({ day: dayNames[i], count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);
    const busiestHours = hourCounts
      .map((count, i) => ({ hour: i, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    // Action card stats
    const [actionCardsCreated, actionCardsApproved, actionCardsDismissed] = await Promise.all([
      this.prisma.actionCard.count({
        where: { businessId, createdAt: { gte: startDate, lt: endDate } },
      }).catch(() => 0),
      this.prisma.actionCard.count({
        where: { businessId, createdAt: { gte: startDate, lt: endDate }, status: 'APPROVED' },
      }).catch(() => 0),
      this.prisma.actionCard.count({
        where: { businessId, createdAt: { gte: startDate, lt: endDate }, status: 'DISMISSED' },
      }).catch(() => 0),
    ]);

    // Content queue stats
    const [contentPublished, contentPending] = await Promise.all([
      this.prisma.contentDraft.count({
        where: { businessId, createdAt: { gte: startDate, lt: endDate }, status: 'PUBLISHED' },
      }).catch(() => 0),
      this.prisma.contentDraft.count({
        where: { businessId, status: { in: ['DRAFT', 'PENDING_REVIEW'] } },
      }).catch(() => 0),
    ]);

    return {
      totalBookings,
      completedBookings,
      noShowCount,
      noShowRate,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      avgBookingValue,
      revenueChange,
      bookingsChange,
      newCustomers,
      returningCustomers: returningCount,
      retentionRate,
      topServices,
      topStaff,
      busiestDays,
      busiestHours,
      aiStats: {
        actionCardsCreated,
        actionCardsApproved,
        actionCardsDismissed,
      },
      contentStats: {
        published: contentPublished,
        pending: contentPending,
      },
    };
  }

  // Run on 2nd of each month at 8 AM UTC
  @Cron('0 8 2 * *')
  async generateMonthlyReviews() {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`;

    const businesses = await this.prisma.business.findMany({
      where: {
        subscription: { status: { in: ['ACTIVE', 'TRIALING'] } },
      },
      select: { id: true, name: true },
    });

    this.logger.log(`Generating monthly reviews for ${businesses.length} businesses (${month})`);

    for (const biz of businesses) {
      try {
        const existing = await this.prisma.businessReview.findUnique({
          where: { businessId_month: { businessId: biz.id, month } },
        });
        if (existing) continue;

        await this.generateReview(biz.id, month);
        this.logger.log(`Generated review for ${biz.name} (${month})`);
      } catch (err) {
        this.logger.error(`Failed to generate review for ${biz.name}: ${(err as Error).message}`);
      }
    }
  }
}
