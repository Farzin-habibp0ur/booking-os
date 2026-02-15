import { Test } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../common/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { createMockPrisma } from '../../test/mocks';

describe('DashboardService', () => {
  let dashboardService: DashboardService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let reportsService: {
    noShowRate: jest.Mock;
    responseTimes: jest.Mock;
    statusBreakdown: jest.Mock;
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
    };

    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReportsService, useValue: reportsService },
      ],
    }).compile();

    dashboardService = module.get(DashboardService);
  });

  describe('getDashboard', () => {
    beforeEach(() => {
      // Setup default mocks for all prisma calls in getDashboard
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);
      prisma.customer.count.mockResolvedValue(0);
      prisma.conversation.count.mockResolvedValue(0);
    });

    it('returns dashboard with all sections', async () => {
      const todayBooking = { id: 'b1', customer: {}, service: { price: 100 }, staff: {} };
      const unassignedConv = { id: 'conv1', customer: {}, messages: [] };

      prisma.booking.findMany
        .mockResolvedValueOnce([todayBooking] as any) // todayBookings
        .mockResolvedValueOnce([] as any); // revenueThisMonth (completed bookings)
      prisma.conversation.findMany.mockResolvedValue([unassignedConv] as any);
      prisma.booking.count
        .mockResolvedValueOnce(15) // thisWeekBookings
        .mockResolvedValueOnce(10); // lastWeekBookings
      prisma.customer.count
        .mockResolvedValueOnce(100) // totalCustomers
        .mockResolvedValueOnce(5); // newCustomersThisWeek
      prisma.conversation.count.mockResolvedValue(3); // openConversationCount

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
    });

    it('correctly rounds revenue', async () => {
      prisma.booking.findMany
        .mockResolvedValueOnce([]) // todayBookings
        .mockResolvedValueOnce([
          { id: 'b1', service: { price: 33.333 } },
          { id: 'b2', service: { price: 66.667 } },
        ] as any); // revenueThisMonth
      prisma.conversation.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);
      prisma.customer.count.mockResolvedValue(0);
      prisma.conversation.count.mockResolvedValue(0);

      const result = await dashboardService.getDashboard('biz1');

      // 33.333 + 66.667 = 100.0 → Math.round(100.0 * 100) / 100 = 100
      expect(result.metrics.revenueThisMonth).toBe(100);
    });
  });
});
