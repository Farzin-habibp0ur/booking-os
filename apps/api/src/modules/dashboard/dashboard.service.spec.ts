import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../common/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import { createMockPrisma, createMockWaitlistService } from '../../test/mocks';

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let reportsService: {
    noShowRate: jest.Mock;
    responseTimes: jest.Mock;
    statusBreakdown: jest.Mock;
    consultToTreatmentConversion: jest.Mock;
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    reportsService = {
      noShowRate: jest.fn().mockResolvedValue({ rate: 5.5 }),
      responseTimes: jest.fn().mockResolvedValue({ avgMinutes: 3.2 }),
      statusBreakdown: jest.fn().mockResolvedValue([
        { status: 'CONFIRMED', count: 10 },
        { status: 'CANCELLED', count: 2 },
      ]),
      consultToTreatmentConversion: jest.fn().mockResolvedValue({
        consultCustomers: 10,
        converted: 6,
        rate: 60,
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReportsService, useValue: reportsService },
        { provide: WaitlistService, useValue: createMockWaitlistService() },
      ],
    }).compile();

    dashboardService = module.get(DashboardService);
  });

  /**
   * Sets up all default mocks for getDashboard.
   * Each call returns sensible empty/zero defaults.
   */
  function setupDefaultMocks(overrides?: {
    depositPendingBookings?: any[];
    tomorrowBookings?: any[];
    overdueConversations?: any[];
    nonAdminStaffCount?: number;
    activeServiceCount?: number;
    calendarConnectionCount?: number;
    templates?: any[];
    anyBookingCount?: number;
    depositPaymentCount?: number;
    roiBaselineCount?: number;
    completedBookingsCount?: number;
    enabledAgentCount?: number;
    business?: any;
  }) {
    const o = overrides || {};

    // booking.findMany is called 4 times:
    // 1: todayBookings, 2: revenueThisMonth, 3: depositPendingBookings, 4: tomorrowBookings
    prisma.booking.findMany
      .mockResolvedValueOnce([]) // todayBookings
      .mockResolvedValueOnce([]) // revenueThisMonth
      .mockResolvedValueOnce(o.depositPendingBookings ?? []) // depositPendingBookings
      .mockResolvedValueOnce(o.tomorrowBookings ?? []); // tomorrowBookings

    // conversation.findMany is called 2 times:
    // 1: unassignedConversations, 2: overdueConversationsRaw
    prisma.conversation.findMany
      .mockResolvedValueOnce([]) // unassignedConversations
      .mockResolvedValueOnce(o.overdueConversations ?? []); // overdueConversationsRaw

    // booking.count is called 5 times:
    // 1: thisWeekBookings, 2: lastWeekBookings, 3: anyBookingCount, 4: completedBookingsCount
    // Wait — let me count:
    // thisWeekBookings, lastWeekBookings, anyBookingCount, completedBookingsCount = 4 calls
    prisma.booking.count
      .mockResolvedValueOnce(0) // thisWeekBookings
      .mockResolvedValueOnce(0) // lastWeekBookings
      .mockResolvedValueOnce(o.anyBookingCount ?? 0) // anyBookingCount
      .mockResolvedValueOnce(o.completedBookingsCount ?? 0); // completedBookingsCount

    prisma.customer.count
      .mockResolvedValueOnce(0) // totalCustomers
      .mockResolvedValueOnce(0); // newCustomersThisWeek

    prisma.conversation.count.mockResolvedValueOnce(0); // openConversationCount

    // P1-20 queries
    prisma.staff.count.mockResolvedValueOnce(o.nonAdminStaffCount ?? 0);
    prisma.service.count.mockResolvedValueOnce(o.activeServiceCount ?? 0);
    prisma.calendarConnection.count.mockResolvedValueOnce(o.calendarConnectionCount ?? 0);
    prisma.messageTemplate.findMany.mockResolvedValueOnce(o.templates ?? []);
    prisma.payment.count.mockResolvedValueOnce(o.depositPaymentCount ?? 0);
    prisma.roiBaseline.count.mockResolvedValueOnce(o.roiBaselineCount ?? 0);
    prisma.agentConfig.count.mockResolvedValueOnce(o.enabledAgentCount ?? 0);

    // P1-21 business query
    prisma.business.findUnique.mockResolvedValueOnce(
      (o.business ?? { name: 'Test Clinic', packConfig: {} }) as any,
    );
  }

  describe('getDashboard', () => {
    beforeEach(() => {
      // Setup default mocks for all prisma calls in getDashboard
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);
      prisma.customer.count.mockResolvedValue(0);
      prisma.conversation.count.mockResolvedValue(0);
      prisma.agentConfig.count.mockResolvedValue(0);
    });

    it('returns dashboard with all sections', async () => {
      const todayBooking = { id: 'b1', customer: {}, service: { price: 100 }, staff: {} };
      const unassignedConv = { id: 'conv1', customer: {}, messages: [] };

      prisma.booking.findMany
        .mockResolvedValueOnce([todayBooking] as any) // todayBookings
        .mockResolvedValueOnce([] as any) // revenueThisMonth (completed bookings)
        .mockResolvedValueOnce([] as any) // depositPendingBookings
        .mockResolvedValueOnce([] as any); // tomorrowBookings
      prisma.conversation.findMany
        .mockResolvedValueOnce([unassignedConv] as any) // unassignedConversations
        .mockResolvedValueOnce([] as any); // overdueConversationsRaw
      prisma.booking.count
        .mockResolvedValueOnce(15) // thisWeekBookings
        .mockResolvedValueOnce(10) // lastWeekBookings
        .mockResolvedValueOnce(0) // anyBookingCount
        .mockResolvedValueOnce(0); // completedBookingsCount
      prisma.customer.count
        .mockResolvedValueOnce(100) // totalCustomers
        .mockResolvedValueOnce(5); // newCustomersThisWeek
      prisma.conversation.count.mockResolvedValue(3); // openConversationCount
      prisma.staff.count.mockResolvedValueOnce(0);
      prisma.service.count.mockResolvedValueOnce(0);
      prisma.calendarConnection.count.mockResolvedValueOnce(0);
      prisma.messageTemplate.findMany.mockResolvedValueOnce([]);
      prisma.payment.count.mockResolvedValueOnce(0);
      prisma.roiBaseline.count.mockResolvedValueOnce(0);
      prisma.agentConfig.count.mockResolvedValueOnce(0);
      prisma.business.findUnique.mockResolvedValueOnce({
        name: 'Test Clinic',
        packConfig: {},
      } as any);

      const result = await dashboardService.getDashboard('biz1');

      expect(result.todayBookings).toEqual([todayBooking]);
      expect(result.unassignedConversations).toEqual([unassignedConv]);
      expect(result.metrics.totalBookingsThisWeek).toBe(15);
      expect(result.metrics.totalBookingsLastWeek).toBe(10);
      expect(result.metrics.noShowRate).toBe(5.5);
      expect(result.metrics.avgResponseTimeMins).toBe(3.2);
      expect(result.metrics.totalCustomers).toBe(100);
      expect(result.metrics.newCustomersThisWeek).toBe(5);
      expect(result.metrics.openConversationCount).toBe(3);
      expect(result.statusBreakdown).toEqual([
        { status: 'CONFIRMED', count: 10 },
        { status: 'CANCELLED', count: 2 },
      ]);
      expect(result.consultConversion).toEqual({
        consultCustomers: 10,
        converted: 6,
        rate: 60,
      });
    });

    it('correctly rounds revenue', async () => {
      prisma.booking.findMany
        .mockResolvedValueOnce([]) // todayBookings
        .mockResolvedValueOnce([
          { id: 'b1', service: { price: 33.333 } },
          { id: 'b2', service: { price: 66.667 } },
        ] as any) // revenueThisMonth
        .mockResolvedValueOnce([]) // depositPendingBookings
        .mockResolvedValueOnce([]); // tomorrowBookings
      prisma.conversation.findMany
        .mockResolvedValueOnce([]) // unassigned
        .mockResolvedValueOnce([]); // overdue
      prisma.booking.count.mockResolvedValue(0);
      prisma.customer.count.mockResolvedValue(0);
      prisma.conversation.count.mockResolvedValue(0);
      prisma.staff.count.mockResolvedValueOnce(0);
      prisma.service.count.mockResolvedValueOnce(0);
      prisma.calendarConnection.count.mockResolvedValueOnce(0);
      prisma.messageTemplate.findMany.mockResolvedValueOnce([]);
      prisma.payment.count.mockResolvedValueOnce(0);
      prisma.roiBaseline.count.mockResolvedValueOnce(0);
      prisma.agentConfig.count.mockResolvedValueOnce(0);
      prisma.business.findUnique.mockResolvedValueOnce({ name: 'Test', packConfig: {} } as any);

      const result = await dashboardService.getDashboard('biz1');

      // 33.333 + 66.667 = 100.0 → Math.round(100.0 * 100) / 100 = 100
      expect(result.metrics.revenueThisMonth).toBe(100);
    });
  });

  // P1-18: Attention Needed tests
  describe('attention needed', () => {
    it('returns deposit-pending bookings', async () => {
      const pendingBooking = {
        id: 'b1',
        customer: { name: 'Alice' },
        service: { name: 'Botox' },
        staff: null,
      };
      setupDefaultMocks({ depositPendingBookings: [pendingBooking] });

      const result = await dashboardService.getDashboard('biz1');

      expect(result.attentionNeeded.depositPendingBookings).toEqual([pendingBooking]);
    });

    it('returns tomorrow bookings', async () => {
      const booking = {
        id: 'b2',
        customer: { name: 'Bob' },
        service: { name: 'Consult' },
        staff: null,
        startTime: new Date(),
      };
      setupDefaultMocks({ tomorrowBookings: [booking] });

      const result = await dashboardService.getDashboard('biz1');

      expect(result.attentionNeeded.tomorrowBookings).toEqual([booking]);
    });

    it('returns overdue conversations where last message is INBOUND', async () => {
      const conv = {
        id: 'c1',
        customer: { name: 'Carol' },
        messages: [{ direction: 'INBOUND', content: 'Hello?' }],
        lastMessageAt: new Date(Date.now() - 60 * 60 * 1000),
      };
      setupDefaultMocks({ overdueConversations: [conv] });

      const result = await dashboardService.getDashboard('biz1');

      expect(result.attentionNeeded.overdueConversations).toEqual([conv]);
    });

    it('filters out conversations where last message is OUTBOUND', async () => {
      const conv = {
        id: 'c2',
        customer: { name: 'Dave' },
        messages: [{ direction: 'OUTBOUND', content: 'We replied' }],
        lastMessageAt: new Date(Date.now() - 60 * 60 * 1000),
      };
      setupDefaultMocks({ overdueConversations: [conv] });

      const result = await dashboardService.getDashboard('biz1');

      expect(result.attentionNeeded.overdueConversations).toEqual([]);
    });

    it('returns empty arrays when no attention items', async () => {
      setupDefaultMocks();

      const result = await dashboardService.getDashboard('biz1');

      expect(result.attentionNeeded.depositPendingBookings).toEqual([]);
      expect(result.attentionNeeded.tomorrowBookings).toEqual([]);
      expect(result.attentionNeeded.overdueConversations).toEqual([]);
    });
  });

  // P1-20: Go-Live Checklist tests
  describe('go-live checklist', () => {
    it('returns allComplete:true when all conditions met', async () => {
      setupDefaultMocks({
        nonAdminStaffCount: 2,
        activeServiceCount: 3,
        calendarConnectionCount: 1,
        templates: [{ category: 'CONFIRMATION' }, { category: 'REMINDER' }],
        anyBookingCount: 5,
        depositPaymentCount: 1,
        roiBaselineCount: 1,
        enabledAgentCount: 1,
        business: { name: 'Glow Clinic', packConfig: {} },
      });

      const result = await dashboardService.getDashboard('biz1');

      expect(result.goLiveChecklist.allComplete).toBe(true);
      expect(result.goLiveChecklist.items.every((i: any) => i.done)).toBe(true);
    });

    it('returns partial checklist for new business', async () => {
      setupDefaultMocks({
        business: { name: 'My Business', packConfig: {} },
      });

      const result = await dashboardService.getDashboard('biz1');

      expect(result.goLiveChecklist.allComplete).toBe(false);
      // "My Business" is the default name, should be considered not done
      const businessNameItem = result.goLiveChecklist.items.find(
        (i: any) => i.key === 'business_name',
      );
      expect(businessNameItem!.done).toBe(false);
    });

    it('detects missing templates (has CONFIRMATION but no REMINDER)', async () => {
      setupDefaultMocks({
        templates: [{ category: 'CONFIRMATION' }],
      });

      const result = await dashboardService.getDashboard('biz1');

      const templatesItem = result.goLiveChecklist.items.find(
        (i: any) => i.key === 'templates_ready',
      );
      expect(templatesItem!.done).toBe(false);
    });

    it('each item has correct fixUrl', async () => {
      setupDefaultMocks();

      const result = await dashboardService.getDashboard('biz1');

      const expectedUrls: Record<string, string> = {
        business_name: '/settings',
        staff_added: '/staff',
        services_created: '/services',
        whatsapp_connected: '/settings/calendar-sync',
        templates_ready: '/settings/templates',
        first_booking: '/calendar',
        first_deposit: '/bookings',
        roi_baseline: '/roi',
        agents_configured: '/settings/agents',
      };

      for (const item of result.goLiveChecklist.items) {
        expect(item.fixUrl).toBe(expectedUrls[item.key]);
      }
    });
  });

  // P1-21: Milestone Progress tests
  describe('milestone progress', () => {
    it('returns correct completed bookings count', async () => {
      setupDefaultMocks({ completedBookingsCount: 7 });

      const result = await dashboardService.getDashboard('biz1');

      expect(result.milestoneProgress.completedBookings).toBe(7);
    });

    it('returns appropriate nudge for milestone threshold', async () => {
      setupDefaultMocks({ completedBookingsCount: 3 });

      const result = await dashboardService.getDashboard('biz1');

      // With 3 completed, the highest applicable is nudge_3 (threshold 3)
      expect(result.milestoneProgress.currentNudge).toEqual({
        id: 'nudge_3',
        link: '/settings/templates',
      });
    });

    it('skips dismissed nudges', async () => {
      setupDefaultMocks({
        completedBookingsCount: 3,
        business: {
          name: 'Test Clinic',
          packConfig: { dismissedNudges: ['nudge_3'] },
        },
      });

      const result = await dashboardService.getDashboard('biz1');

      // nudge_3 is dismissed, so next highest applicable is nudge_1 (threshold 1)
      expect(result.milestoneProgress.currentNudge).toEqual({
        id: 'nudge_1',
        link: '/settings/notifications',
      });
    });

    it('returns null nudge when all applicable nudges dismissed', async () => {
      setupDefaultMocks({
        completedBookingsCount: 3,
        business: {
          name: 'Test Clinic',
          packConfig: { dismissedNudges: ['nudge_0', 'nudge_1', 'nudge_3'] },
        },
      });

      const result = await dashboardService.getDashboard('biz1');

      expect(result.milestoneProgress.currentNudge).toBeNull();
    });
  });

  // Mission Control: staff-scoped queries
  describe('staff-scoped queries', () => {
    it('returns staff bookings and conversations when staffId provided', async () => {
      const myBooking = { id: 'mb1', customer: { name: 'Alice' }, service: { name: 'Botox' } };
      const myConv = { id: 'mc1', customer: { name: 'Bob' }, messages: [{ content: 'Hi' }] };

      // Batch 1: booking.findMany (todayBookings), conv.findMany (unassigned)
      prisma.booking.findMany
        .mockResolvedValueOnce([]) // todayBookings
        .mockResolvedValueOnce([]) // revenueThisMonth
        .mockResolvedValueOnce([]) // depositPendingBookings
        .mockResolvedValueOnce([]) // tomorrowBookings
        .mockResolvedValueOnce([myBooking] as any); // myBookingsToday (staff-scoped)
      prisma.conversation.findMany
        .mockResolvedValueOnce([]) // unassigned
        .mockResolvedValueOnce([]) // overdue
        .mockResolvedValueOnce([myConv] as any); // myAssignedConversations (staff-scoped)
      // booking.count: thisWeek, lastWeek, then completedTodayByStaff (staff-scoped), then anyBooking, completed
      prisma.booking.count
        .mockResolvedValueOnce(0) // thisWeekBookings
        .mockResolvedValueOnce(0) // lastWeekBookings
        .mockResolvedValueOnce(3) // completedTodayByStaff (staff-scoped)
        .mockResolvedValueOnce(0) // anyBookingCount
        .mockResolvedValueOnce(0); // completedBookingsCount
      prisma.customer.count.mockResolvedValue(0);
      prisma.conversation.count.mockResolvedValue(0);
      prisma.staff.count.mockResolvedValueOnce(0);
      prisma.service.count.mockResolvedValueOnce(0);
      prisma.calendarConnection.count.mockResolvedValueOnce(0);
      prisma.messageTemplate.findMany.mockResolvedValueOnce([]);
      prisma.payment.count.mockResolvedValueOnce(0);
      prisma.roiBaseline.count.mockResolvedValueOnce(0);
      prisma.agentConfig.count.mockResolvedValueOnce(0);
      prisma.business.findUnique.mockResolvedValueOnce({ name: 'Test', packConfig: {} } as any);

      const result = await dashboardService.getDashboard('biz1', 'staff1', 'ADMIN', 'admin');

      expect(result.myBookingsToday).toEqual([myBooking]);
      expect(result.myAssignedConversations).toEqual([myConv]);
      expect(result.completedTodayByStaff).toBe(3);
    });

    it('returns empty arrays when no staffId', async () => {
      setupDefaultMocks();

      const result = await dashboardService.getDashboard('biz1');

      expect(result.myBookingsToday).toEqual([]);
      expect(result.myAssignedConversations).toEqual([]);
      expect(result.completedTodayByStaff).toBe(0);
    });

    it('queries with correct staffId filter', async () => {
      // Set up mocks accounting for staff-scoped calls between batch 2 and 3
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.booking.count
        .mockResolvedValueOnce(0) // thisWeekBookings
        .mockResolvedValueOnce(0) // lastWeekBookings
        .mockResolvedValueOnce(0) // completedTodayByStaff
        .mockResolvedValueOnce(0) // anyBookingCount
        .mockResolvedValueOnce(0); // completedBookingsCount
      prisma.customer.count.mockResolvedValue(0);
      prisma.conversation.count.mockResolvedValue(0);
      prisma.staff.count.mockResolvedValueOnce(0);
      prisma.service.count.mockResolvedValueOnce(0);
      prisma.calendarConnection.count.mockResolvedValueOnce(0);
      prisma.messageTemplate.findMany.mockResolvedValueOnce([]);
      prisma.payment.count.mockResolvedValueOnce(0);
      prisma.roiBaseline.count.mockResolvedValueOnce(0);
      prisma.agentConfig.count.mockResolvedValueOnce(0);
      prisma.business.findUnique.mockResolvedValueOnce({ name: 'Test', packConfig: {} } as any);

      await dashboardService.getDashboard('biz1', 'staff42', 'AGENT', 'agent');

      // 5th booking.findMany call should be staff-scoped
      const bookingCalls = prisma.booking.findMany.mock.calls;
      const staffBookingCall = bookingCalls[bookingCalls.length - 1][0] as any;
      expect(staffBookingCall.where.staffId).toBe('staff42');

      // 3rd conversation.findMany call should be staff-scoped
      const convCalls = prisma.conversation.findMany.mock.calls;
      const staffConvCall = convCalls[convCalls.length - 1][0] as any;
      expect(staffConvCall.where.assignedToId).toBe('staff42');
    });
  });

  // dismissNudge tests
  describe('dismissNudge', () => {
    it('adds nudgeId to packConfig.dismissedNudges', async () => {
      prisma.business.findUnique.mockResolvedValue({
        packConfig: { setupComplete: true },
      } as any);
      prisma.business.update.mockResolvedValue({} as any);

      await dashboardService.dismissNudge('biz1', 'nudge_3');

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          packConfig: { setupComplete: true, dismissedNudges: ['nudge_3'] },
        },
      });
    });

    it('preserves existing packConfig fields and deduplicates', async () => {
      prisma.business.findUnique.mockResolvedValue({
        packConfig: {
          setupComplete: true,
          someSetting: 'value',
          dismissedNudges: ['nudge_0'],
        },
      } as any);
      prisma.business.update.mockResolvedValue({} as any);

      await dashboardService.dismissNudge('biz1', 'nudge_0');

      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: {
          packConfig: {
            setupComplete: true,
            someSetting: 'value',
            dismissedNudges: ['nudge_0'],
          },
        },
      });
    });
  });
});
