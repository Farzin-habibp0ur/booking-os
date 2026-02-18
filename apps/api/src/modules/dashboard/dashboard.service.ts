import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { WaitlistService } from '../waitlist/waitlist.service';

const NUDGE_DEFINITIONS = [
  { id: 'nudge_0', threshold: 0, link: '/calendar' },
  { id: 'nudge_1', threshold: 1, link: '/settings/notifications' },
  { id: 'nudge_3', threshold: 3, link: '/settings/templates' },
  { id: 'nudge_5', threshold: 5, link: '/reports' },
  { id: 'nudge_10', threshold: 10, link: '/roi' },
];

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private reportsService: ReportsService,
    private waitlistService: WaitlistService,
  ) {}

  async getDashboard(businessId: string, staffId?: string, role?: string, mode?: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(today);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const monthAgo = new Date(today);
    monthAgo.setDate(monthAgo.getDate() - 30);

    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    // Batch 1: Core data queries
    const [
      todayBookings,
      unassignedConversations,
      thisWeekBookings,
      lastWeekBookings,
      totalCustomers,
      newCustomersThisWeek,
      openConversationCount,
      business,
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
      this.prisma.customer.count({ where: { businessId } }),
      this.prisma.customer.count({
        where: { businessId, createdAt: { gte: weekAgo } },
      }),
      this.prisma.conversation.count({
        where: { businessId, status: { in: ['OPEN', 'WAITING'] } },
      }),
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: { name: true, packConfig: true },
      }),
    ]);

    // Batch 2: Reports + attention needed
    const [
      noShowData,
      responseData,
      statusBreakdown,
      revenueThisMonth,
      consultConversion,
      depositPendingBookings,
      tomorrowBookings,
      overdueConversationsRaw,
    ] = await Promise.all([
      this.reportsService.noShowRate(businessId, 30),
      this.reportsService.responseTimes(businessId),
      this.reportsService.statusBreakdown(businessId, 7),
      this.prisma.booking
        .findMany({
          where: { businessId, createdAt: { gte: monthAgo }, status: 'COMPLETED' },
          include: { service: { select: { price: true } } },
        })
        .then((bookings) => bookings.reduce((sum, b) => sum + b.service.price, 0)),
      this.reportsService.consultToTreatmentConversion(businessId, 30),
      this.prisma.booking.findMany({
        where: { businessId, status: 'PENDING_DEPOSIT' },
        include: { customer: true, service: true, staff: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      this.prisma.booking.findMany({
        where: {
          businessId,
          startTime: { gte: tomorrow, lt: dayAfterTomorrow },
          status: { in: ['PENDING', 'CONFIRMED', 'PENDING_DEPOSIT'] },
        },
        include: { customer: true, service: true, staff: true },
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.conversation.findMany({
        where: {
          businessId,
          status: 'OPEN',
          lastMessageAt: { lt: thirtyMinutesAgo },
        },
        include: {
          customer: true,
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
        },
        orderBy: { lastMessageAt: 'asc' },
        take: 10,
      }),
    ]);

    // Batch 2b: Staff-scoped queries for Mission Control
    const [
      myBookingsToday,
      myAssignedConversations,
      completedTodayByStaff,
    ] = staffId
      ? await Promise.all([
          this.prisma.booking.findMany({
            where: {
              businessId,
              staffId,
              startTime: { gte: today, lt: tomorrow },
              status: { in: ['PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'NO_SHOW'] },
            },
            include: { customer: true, service: true },
            orderBy: { startTime: 'asc' },
          }),
          this.prisma.conversation.findMany({
            where: { businessId, assignedToId: staffId, status: 'OPEN' },
            include: {
              customer: true,
              messages: { take: 1, orderBy: { createdAt: 'desc' } },
            },
            orderBy: { lastMessageAt: 'desc' },
            take: 10,
          }),
          this.prisma.booking.count({
            where: {
              businessId,
              staffId,
              status: 'COMPLETED',
              updatedAt: { gte: today, lt: tomorrow },
            },
          }),
        ])
      : [[], [], 0];

    // Batch 3: Go-live checklist + milestones
    const [
      nonAdminStaffCount,
      activeServiceCount,
      calendarConnectionCount,
      templates,
      anyBookingCount,
      depositPaymentCount,
      roiBaselineCount,
      completedBookingsCount,
    ] = await Promise.all([
      this.prisma.staff.count({
        where: { businessId, role: { not: 'ADMIN' }, isActive: true },
      }),
      this.prisma.service.count({
        where: { businessId, isActive: true },
      }),
      this.prisma.calendarConnection.count({
        where: { staff: { businessId } },
      }),
      this.prisma.messageTemplate.findMany({
        where: {
          businessId,
          category: { in: ['CONFIRMATION', 'REMINDER'] },
        },
        select: { category: true },
      }),
      this.prisma.booking.count({ where: { businessId } }),
      this.prisma.payment.count({
        where: { booking: { businessId }, status: 'succeeded' },
      }),
      this.prisma.roiBaseline.count({ where: { businessId } }),
      this.prisma.booking.count({
        where: { businessId, status: 'COMPLETED' },
      }),
    ]);

    // P1-18: Filter overdue conversations to only those where last message is INBOUND
    const overdueConversations = overdueConversationsRaw.filter(
      (c: any) => c.messages?.[0]?.direction === 'INBOUND',
    );

    // P1-20: Build go-live checklist
    const templateCategories = new Set(templates.map((t: any) => t.category));
    const hasConfirmation = templateCategories.has('CONFIRMATION');
    const hasReminder = templateCategories.has('REMINDER');

    const packConfig = (business?.packConfig as any) || {};
    const businessName = business?.name || '';

    const goLiveItems = [
      {
        key: 'business_name',
        done: businessName.length > 0 && businessName !== 'My Business',
        fixUrl: '/settings',
      },
      { key: 'staff_added', done: nonAdminStaffCount > 0, fixUrl: '/staff' },
      { key: 'services_created', done: activeServiceCount > 0, fixUrl: '/services' },
      {
        key: 'whatsapp_connected',
        done: calendarConnectionCount > 0,
        fixUrl: '/settings/calendar-sync',
      },
      {
        key: 'templates_ready',
        done: hasConfirmation && hasReminder,
        fixUrl: '/settings/templates',
      },
      { key: 'first_booking', done: anyBookingCount > 0, fixUrl: '/calendar' },
      { key: 'first_deposit', done: depositPaymentCount > 0, fixUrl: '/bookings' },
      { key: 'roi_baseline', done: roiBaselineCount > 0, fixUrl: '/roi' },
    ];

    const goLiveChecklist = {
      allComplete: goLiveItems.every((i) => i.done),
      items: goLiveItems,
    };

    // P1-21: Milestone progress + nudge
    const dismissedNudges: string[] = packConfig.dismissedNudges || [];

    // Find the highest applicable non-dismissed nudge
    let currentNudge: { id: string; link: string } | null = null;
    for (let i = NUDGE_DEFINITIONS.length - 1; i >= 0; i--) {
      const nudge = NUDGE_DEFINITIONS[i];
      if (completedBookingsCount >= nudge.threshold && !dismissedNudges.includes(nudge.id)) {
        currentNudge = { id: nudge.id, link: nudge.link };
        break;
      }
    }

    const milestoneProgress = {
      completedBookings: completedBookingsCount,
      currentNudge,
      dismissedNudges,
    };

    // Waitlist backfill stats
    const waitlistMetrics = await this.waitlistService.getMetrics(businessId, 30).catch(() => ({
      totalEntries: 0,
      cancellations: 0,
      offers: 0,
      claimed: 0,
      avgTimeToFill: 0,
      fillRate: 0,
    }));

    return {
      todayBookings,
      unassignedConversations,
      waitlistMetrics,
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
      attentionNeeded: {
        depositPendingBookings,
        tomorrowBookings,
        overdueConversations,
      },
      goLiveChecklist,
      milestoneProgress,
      // Mission Control: staff-scoped data
      myBookingsToday,
      myAssignedConversations,
      completedTodayByStaff,
    };
  }

  async dismissNudge(businessId: string, nudgeId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { packConfig: true },
    });

    const packConfig = (business?.packConfig as any) || {};
    const dismissedNudges: string[] = packConfig.dismissedNudges || [];

    if (!dismissedNudges.includes(nudgeId)) {
      dismissedNudges.push(nudgeId);
    }

    await this.prisma.business.update({
      where: { id: businessId },
      data: {
        packConfig: { ...packConfig, dismissedNudges },
      },
    });

    return { success: true };
  }
}
