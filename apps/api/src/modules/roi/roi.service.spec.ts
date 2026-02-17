import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { RoiService } from './roi.service';
import { PrismaService } from '../../common/prisma.service';
import { ReportsService } from '../reports/reports.service';
import { EmailService } from '../email/email.service';
import {
  createMockPrisma,
  createMockReportsService,
  createMockEmailService,
} from '../../test/mocks';

describe('RoiService', () => {
  let roiService: RoiService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let reportsService: ReturnType<typeof createMockReportsService>;
  let emailService: ReturnType<typeof createMockEmailService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    reportsService = createMockReportsService();
    emailService = createMockEmailService();

    const module = await Test.createTestingModule({
      providers: [
        RoiService,
        { provide: PrismaService, useValue: prisma },
        { provide: ReportsService, useValue: reportsService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    roiService = module.get(RoiService);
  });

  describe('goLive', () => {
    it('creates a baseline when none exists', async () => {
      prisma.roiBaseline.findFirst.mockResolvedValue(null);
      prisma.roiBaseline.create.mockResolvedValue({
        id: 'bl1',
        businessId: 'biz1',
        goLiveDate: new Date(),
        baselineStart: new Date(),
        baselineEnd: new Date(),
        metrics: {},
        createdAt: new Date(),
      });

      const result = await roiService.goLive('biz1');

      expect(prisma.roiBaseline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
          }),
        }),
      );
      expect(result.id).toBe('bl1');
    });

    it('throws BadRequestException when baseline already exists', async () => {
      prisma.roiBaseline.findFirst.mockResolvedValue({
        id: 'existing',
        businessId: 'biz1',
        goLiveDate: new Date(),
        baselineStart: new Date(),
        baselineEnd: new Date(),
        metrics: {},
        createdAt: new Date(),
      });

      await expect(roiService.goLive('biz1')).rejects.toThrow(BadRequestException);
    });

    it('snapshots metrics from ReportsService', async () => {
      prisma.roiBaseline.findFirst.mockResolvedValue(null);
      prisma.roiBaseline.create.mockResolvedValue({
        id: 'bl1',
        businessId: 'biz1',
        goLiveDate: new Date(),
        baselineStart: new Date(),
        baselineEnd: new Date(),
        metrics: {},
        createdAt: new Date(),
      } as any);

      await roiService.goLive('biz1');

      expect(reportsService.noShowRate).toHaveBeenCalledWith(
        'biz1',
        7,
        expect.any(Date),
        expect.any(Date),
      );
      expect(reportsService.consultToTreatmentConversion).toHaveBeenCalled();
      expect(reportsService.responseTimes).toHaveBeenCalledWith('biz1');
      expect(reportsService.revenueOverTime).toHaveBeenCalled();
      expect(reportsService.statusBreakdown).toHaveBeenCalled();

      const createCall = prisma.roiBaseline.create.mock.calls[0][0];
      const metrics = createCall.data.metrics;
      expect(metrics).toHaveProperty('noShowRate');
      expect(metrics).toHaveProperty('avgBookingValue');
      expect(metrics).toHaveProperty('totalRevenue');
    });
  });

  describe('getBaseline', () => {
    it('returns the most recent baseline', async () => {
      const baseline = {
        id: 'bl1',
        businessId: 'biz1',
        goLiveDate: new Date(),
        baselineStart: new Date(),
        baselineEnd: new Date(),
        metrics: { noShowRate: 15 },
        createdAt: new Date(),
      };
      prisma.roiBaseline.findFirst.mockResolvedValue(baseline);

      const result = await roiService.getBaseline('biz1');

      expect(result).toEqual(baseline);
      expect(prisma.roiBaseline.findFirst).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns null when no baseline exists', async () => {
      prisma.roiBaseline.findFirst.mockResolvedValue(null);

      const result = await roiService.getBaseline('biz1');

      expect(result).toBeNull();
    });
  });

  describe('getRoiDashboard', () => {
    it('returns hasBaseline:false when no baseline exists', async () => {
      prisma.roiBaseline.findFirst.mockResolvedValue(null);

      const result = await roiService.getRoiDashboard('biz1', 30);

      expect(result).toEqual({ hasBaseline: false });
    });

    it('computes correct deltas', async () => {
      const baseline = {
        id: 'bl1',
        businessId: 'biz1',
        goLiveDate: new Date(),
        baselineStart: new Date(),
        baselineEnd: new Date(),
        metrics: {
          noShowRate: 20,
          consultConversionRate: 40,
          avgResponseMinutes: 15,
          totalRevenue: 3000,
          noShowTotal: 50,
          noShowCount: 10,
          avgBookingValue: 100,
          completedBookings: 30,
        },
        createdAt: new Date(),
      };
      prisma.roiBaseline.findFirst.mockResolvedValue(baseline);

      // Current metrics: noShowRate=10, consultConversion=60, avgResponse=8, revenue=500
      const result = (await roiService.getRoiDashboard('biz1', 30)) as any;

      expect(result.hasBaseline).toBe(true);
      expect(result.deltas.noShowRate).toBe(10); // 20 - 10 = +10 (improved)
      expect(result.deltas.consultConversionRate).toBe(20); // 60 - 40 = +20 (improved)
      expect(result.deltas.avgResponseMinutes).toBe(7); // 15 - 8 = +7 (improved)
    });

    it('computes recovered revenue when sufficient data', async () => {
      const baseline = {
        id: 'bl1',
        businessId: 'biz1',
        goLiveDate: new Date(),
        baselineStart: new Date(),
        baselineEnd: new Date(),
        metrics: {
          noShowRate: 20,
          noShowTotal: 50,
          noShowCount: 10,
          consultConversionRate: 40,
          avgResponseMinutes: 15,
          totalRevenue: 5000,
          completedBookings: 40,
          avgBookingValue: 125,
        },
        createdAt: new Date(),
      };
      prisma.roiBaseline.findFirst.mockResolvedValue(baseline);

      // Current: noShowRate=10, noShowTotal=50 (via mock defaults)
      reportsService.noShowRate.mockResolvedValue({ total: 50, noShows: 5, rate: 10 });

      const result = (await roiService.getRoiDashboard('biz1', 30)) as any;

      expect(result.recoveredRevenue.sufficient).toBe(true);
      expect(result.recoveredRevenue.amount).toBeGreaterThan(0);
      expect(result.recoveredRevenue.formula).toBeDefined();
      expect(result.recoveredRevenue.formula.baselineNoShowRate).toBe(20);
      expect(result.recoveredRevenue.formula.currentNoShowRate).toBe(10);
    });

    it('returns insufficient_data when less than 20 bookings', async () => {
      const baseline = {
        id: 'bl1',
        businessId: 'biz1',
        goLiveDate: new Date(),
        baselineStart: new Date(),
        baselineEnd: new Date(),
        metrics: {
          noShowRate: 20,
          noShowTotal: 10, // < 20
          noShowCount: 2,
          consultConversionRate: 40,
          avgResponseMinutes: 15,
          totalRevenue: 1000,
          completedBookings: 8,
          avgBookingValue: 125,
        },
        createdAt: new Date(),
      };
      prisma.roiBaseline.findFirst.mockResolvedValue(baseline);

      const result = (await roiService.getRoiDashboard('biz1', 30)) as any;

      expect(result.recoveredRevenue.sufficient).toBe(false);
      expect(result.recoveredRevenue.reason).toBe('insufficient_data');
      expect(result.recoveredRevenue.amount).toBeNull();
    });

    it('returns no_improvement when no-show rate did not improve', async () => {
      const baseline = {
        id: 'bl1',
        businessId: 'biz1',
        goLiveDate: new Date(),
        baselineStart: new Date(),
        baselineEnd: new Date(),
        metrics: {
          noShowRate: 5, // lower than current
          noShowTotal: 50,
          noShowCount: 3,
          consultConversionRate: 40,
          avgResponseMinutes: 15,
          totalRevenue: 5000,
          completedBookings: 47,
          avgBookingValue: 106,
        },
        createdAt: new Date(),
      };
      prisma.roiBaseline.findFirst.mockResolvedValue(baseline);

      // Current noShowRate=10, which is worse than baseline's 5
      reportsService.noShowRate.mockResolvedValue({ total: 50, noShows: 5, rate: 10 });

      const result = (await roiService.getRoiDashboard('biz1', 30)) as any;

      expect(result.recoveredRevenue.sufficient).toBe(true);
      expect(result.recoveredRevenue.reason).toBe('no_improvement');
      expect(result.recoveredRevenue.amount).toBeNull();
    });
  });

  describe('getWeeklyReview', () => {
    it('returns thisWeek, lastWeek, and weekDelta objects', async () => {
      const result = await roiService.getWeeklyReview('biz1');

      expect(result).toHaveProperty('thisWeek');
      expect(result).toHaveProperty('lastWeek');
      expect(result).toHaveProperty('weekDelta');
      expect(result).toHaveProperty('weekNumber');
      expect(result).toHaveProperty('dateRange');
      expect(result).toHaveProperty('generatedAt');
      expect(result.thisWeek).toHaveProperty('noShowRate');
      expect(result.thisWeek).toHaveProperty('consultConversionRate');
      expect(result.thisWeek).toHaveProperty('totalRevenue');
      expect(result.thisWeek).toHaveProperty('completedBookings');
      expect(result.thisWeek).toHaveProperty('depositCompliance');
    });

    it('computes correct week-over-week deltas', async () => {
      // thisWeek: noShowRate=10 (from mock default)
      // lastWeek: noShowRate=10 (same mock)
      // For a meaningful test, differentiate the two calls
      reportsService.noShowRate
        .mockResolvedValueOnce({ total: 50, noShows: 3, rate: 6 }) // thisWeek
        .mockResolvedValueOnce({ total: 50, noShows: 5, rate: 10 }); // lastWeek

      const result = await roiService.getWeeklyReview('biz1');

      // noShowRate delta: lastWeek(10) - thisWeek(6) = 4 (positive = improved)
      expect(result.weekDelta.noShowRate).toBe(4);
      expect(result.thisWeek.noShowRate).toBe(6);
      expect(result.lastWeek.noShowRate).toBe(10);
    });

    it('handles zero bookings gracefully', async () => {
      reportsService.noShowRate.mockResolvedValue({ total: 0, noShows: 0, rate: 0 });
      reportsService.consultToTreatmentConversion.mockResolvedValue({
        consultCustomers: 0,
        converted: 0,
        rate: 0,
      });
      reportsService.revenueOverTime.mockResolvedValue([]);
      reportsService.statusBreakdown.mockResolvedValue([]);

      const result = await roiService.getWeeklyReview('biz1');

      expect(result.thisWeek.totalRevenue).toBe(0);
      expect(result.thisWeek.completedBookings).toBe(0);
      expect(result.weekDelta.totalRevenue).toBe(0);
    });
  });

  describe('emailWeeklyReview', () => {
    it('calls EmailService.send with HTML containing metrics', async () => {
      const result = await roiService.emailWeeklyReview('biz1', 'sarah@test.com', 'Sarah');

      expect(result).toEqual({ sent: true });
      expect(emailService.send).toHaveBeenCalledTimes(1);
      const call = emailService.send.mock.calls[0][0];
      expect(call.html).toContain('No-show rate');
      expect(call.html).toContain('Revenue');
      expect(call.html).toContain('Consult conversion');
      expect(call.subject).toContain('Review');
    });

    it('includes correct recipient email', async () => {
      await roiService.emailWeeklyReview('biz1', 'manager@clinic.com', 'Manager');

      const call = emailService.send.mock.calls[0][0];
      expect(call.to).toBe('manager@clinic.com');
    });
  });
});
