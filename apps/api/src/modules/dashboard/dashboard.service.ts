import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ReportsService } from '../reports/reports.service';

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
  ) {}

  async getDashboard(businessId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [
      todayBookings,
      unassignedConversations,
      thisWeekBookings,
      lastWeekBookings,
      noShowData,
      responseData,
      statusBreakdown,
      totalCustomers,
      newCustomersThisWeek,
      openConversationCount,
      revenueThisMonth,
      consultConversion,
    ] = await Promise.all([
      this.prisma.booking.findMany({
        where: {
          businessId,
          startTime: { gte: today, lt: tomorrow },
          status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'] },
        },
        include: { customer: true, service: true, staff: true },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.conversation.findMany({
        where: { businessId, assignedToId: null, status: 'OPEN' },
        include: {
          customer: true,
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { lastMessageAt: 'desc' },
        take: 10,
      }),
      this.prisma.booking.count({
        where: { businessId, createdAt: { gte: weekAgo } },
      }),
      this.prisma.booking.count({
        where: { businessId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      this.reportsService.noShowRate(businessId, 30),
      this.reportsService.responseTimes(businessId),
      this.reportsService.statusBreakdown(businessId, 7),
      this.prisma.customer.count({ where: { businessId } }),
      this.prisma.customer.count({
        where: { businessId, createdAt: { gte: weekAgo } },
      }),
      this.prisma.conversation.count({
        where: { businessId, status: { in: ['OPEN', 'WAITING'] } },
      }),
      this.prisma.booking
        .findMany({
          where: { businessId, createdAt: { gte: monthAgo }, status: 'COMPLETED' },
          include: { service: { select: { price: true } } },
        })
        .then((bookings) => bookings.reduce((sum, b) => sum + b.service.price, 0)),
      this.reportsService.consultToTreatmentConversion(businessId, 30),
    ]);

    return {
      todayBookings,
      unassignedConversations,
      metrics: {
        totalBookingsThisWeek: thisWeekBookings,
        totalBookingsLastWeek: lastWeekBookings,
        noShowRate: noShowData.rate,
        avgResponseTimeMins: responseData.avgMinutes,
        totalCustomers,
        newCustomersThisWeek,
        openConversationCount,
        revenueThisMonth: Math.round(revenueThisMonth * 100) / 100,
      },
      statusBreakdown,
      consultConversion,
    };
  }
}
