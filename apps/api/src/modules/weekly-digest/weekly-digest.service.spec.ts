import { Test } from '@nestjs/testing';
import { WeeklyDigestService } from './weekly-digest.service';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { createMockPrisma } from '../../test/mocks';

describe('WeeklyDigestService', () => {
  let service: WeeklyDigestService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let emailService: { send: jest.Mock; buildBrandedHtml: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    emailService = {
      send: jest.fn().mockResolvedValue(true),
      buildBrandedHtml: jest.fn((html: string) => `<html>${html}</html>`),
    };

    const module = await Test.createTestingModule({
      providers: [
        WeeklyDigestService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    service = module.get(WeeklyDigestService);
  });

  // ─── gatherDigestData ────────────────────────────────────────────────

  describe('gatherDigestData', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      // Set to Monday 2027-01-18 at noon to avoid UTC boundary issues
      jest.setSystemTime(new Date('2027-01-18T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('returns digest data with bookings and revenue', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(10) // bookings this week
        .mockResolvedValueOnce(8); // bookings last week

      (prisma.booking.findMany as jest.Mock)
        .mockResolvedValueOnce([
          // revenue this week
          { service: { price: 100 } },
          { service: { price: 200 } },
        ] as any)
        .mockResolvedValueOnce([
          // revenue last week
          { service: { price: 150 } },
        ] as any)
        .mockResolvedValueOnce([
          // top services
          { service: { name: 'Botox', price: 250 } },
          { service: { name: 'Botox', price: 250 } },
          { service: { name: 'Facial', price: 100 } },
        ] as any)
        .mockResolvedValueOnce([
          // upcoming today
          {
            service: { name: 'Botox' },
            customer: { name: 'Emma' },
            startTime: new Date('2027-01-18T14:00:00'),
          },
        ] as any);

      const result = await service.gatherDigestData('biz1', 'Test Clinic');

      expect(result.businessName).toBe('Test Clinic');
      expect(result.bookingsThisWeek).toBe(10);
      expect(result.bookingsLastWeek).toBe(8);
      expect(result.bookingsDelta).toBe(25); // (10-8)/8 * 100
      expect(result.revenueThisWeek).toBe(300);
      expect(result.revenueLastWeek).toBe(150);
      expect(result.revenueDelta).toBe(100); // (300-150)/150 * 100
      expect(result.topServices).toHaveLength(2);
      expect(result.topServices[0]!.name).toBe('Botox');
      expect(result.topServices[0]!.count).toBe(2);
      expect(result.upcomingToday).toHaveLength(1);
      expect(result.upcomingToday[0]!.customerName).toBe('Emma');
    });

    test('handles zero bookings last week (delta = 100% if this week > 0)', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(5) // this week
        .mockResolvedValueOnce(0); // last week

      (prisma.booking.findMany as jest.Mock)
        .mockResolvedValueOnce([{ service: { price: 100 } }] as any) // revenue this week
        .mockResolvedValueOnce([] as any) // revenue last week
        .mockResolvedValueOnce([] as any) // top services
        .mockResolvedValueOnce([] as any); // upcoming today

      const result = await service.gatherDigestData('biz1', 'Clinic');

      expect(result.bookingsDelta).toBe(100);
      expect(result.revenueDelta).toBe(100);
    });

    test('handles zero bookings both weeks (delta = 0)', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(0) // this week
        .mockResolvedValueOnce(0); // last week

      (prisma.booking.findMany as jest.Mock)
        .mockResolvedValueOnce([] as any) // revenue this week
        .mockResolvedValueOnce([] as any) // revenue last week
        .mockResolvedValueOnce([] as any) // top services
        .mockResolvedValueOnce([] as any); // upcoming today

      const result = await service.gatherDigestData('biz1', 'Clinic');

      expect(result.bookingsDelta).toBe(0);
      expect(result.revenueDelta).toBe(0);
      expect(result.topServices).toHaveLength(0);
      expect(result.upcomingToday).toHaveLength(0);
    });

    test('limits top services to 5', async () => {
      prisma.booking.count.mockResolvedValueOnce(12).mockResolvedValueOnce(10);

      const manyServices = [
        { service: { name: 'Svc1', price: 100 } },
        { service: { name: 'Svc1', price: 100 } },
        { service: { name: 'Svc2', price: 200 } },
        { service: { name: 'Svc3', price: 150 } },
        { service: { name: 'Svc4', price: 120 } },
        { service: { name: 'Svc5', price: 180 } },
        { service: { name: 'Svc6', price: 90 } },
      ];

      (prisma.booking.findMany as jest.Mock)
        .mockResolvedValueOnce([] as any) // revenue this week
        .mockResolvedValueOnce([] as any) // revenue last week
        .mockResolvedValueOnce(manyServices as any) // top services
        .mockResolvedValueOnce([] as any); // upcoming today

      const result = await service.gatherDigestData('biz1', 'Clinic');

      expect(result.topServices).toHaveLength(5);
    });

    test('handles negative delta when this week is worse', async () => {
      prisma.booking.count
        .mockResolvedValueOnce(5) // this week
        .mockResolvedValueOnce(10); // last week

      (prisma.booking.findMany as jest.Mock)
        .mockResolvedValueOnce([{ service: { price: 100 } }] as any) // revenue this week
        .mockResolvedValueOnce([{ service: { price: 300 } }] as any) // revenue last week
        .mockResolvedValueOnce([] as any) // top services
        .mockResolvedValueOnce([] as any); // upcoming today

      const result = await service.gatherDigestData('biz1', 'Clinic');

      expect(result.bookingsDelta).toBe(-50);
      expect(result.revenueDelta).toBe(-67); // (100-300)/300 * 100 = -66.67 → -67
    });
  });

  // ─── buildDigestHtml ─────────────────────────────────────────────────

  describe('buildDigestHtml', () => {
    test('generates HTML with stats and tables', () => {
      const html = service.buildDigestHtml({
        businessName: 'Glow Clinic',
        bookingsThisWeek: 12,
        bookingsLastWeek: 10,
        bookingsDelta: 20,
        revenueThisWeek: 3500,
        revenueLastWeek: 2800,
        revenueDelta: 25,
        topServices: [
          { name: 'Botox', count: 5, revenue: 1250 },
          { name: 'Facial', count: 3, revenue: 450 },
        ],
        upcomingToday: [{ serviceName: 'Botox', customerName: 'Emma', time: '10:00 AM' }],
      });

      expect(html).toContain('Weekly Digest');
      expect(html).toContain('Glow Clinic');
      expect(html).toContain('12'); // bookings this week
      expect(html).toContain('20%'); // booking delta
      expect(html).toContain('$3500.00'); // revenue
      expect(html).toContain('Botox');
      expect(html).toContain('Facial');
      expect(html).toContain('Emma');
      expect(html).toContain('10:00 AM');
      expect(html).toContain('opt out');
    });

    test('shows empty state when no bookings', () => {
      const html = service.buildDigestHtml({
        businessName: 'New Biz',
        bookingsThisWeek: 0,
        bookingsLastWeek: 0,
        bookingsDelta: 0,
        revenueThisWeek: 0,
        revenueLastWeek: 0,
        revenueDelta: 0,
        topServices: [],
        upcomingToday: [],
      });

      expect(html).toContain('No bookings this week');
      expect(html).toContain('No upcoming bookings today');
    });

    test('shows red color for negative delta', () => {
      const html = service.buildDigestHtml({
        businessName: 'Biz',
        bookingsThisWeek: 5,
        bookingsLastWeek: 10,
        bookingsDelta: -50,
        revenueThisWeek: 100,
        revenueLastWeek: 200,
        revenueDelta: -50,
        topServices: [],
        upcomingToday: [],
      });

      expect(html).toContain('#EF4444'); // red for negative
    });

    test('shows green color for positive delta', () => {
      const html = service.buildDigestHtml({
        businessName: 'Biz',
        bookingsThisWeek: 10,
        bookingsLastWeek: 5,
        bookingsDelta: 100,
        revenueThisWeek: 200,
        revenueLastWeek: 100,
        revenueDelta: 100,
        topServices: [],
        upcomingToday: [],
      });

      expect(html).toContain('#71907C'); // sage green for positive
    });
  });

  // ─── sendWeeklyDigests ───────────────────────────────────────────────

  describe('sendWeeklyDigests', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2027-01-18T12:00:00'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('sends digest to each business owner', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Glow Clinic',
          packConfig: {},
          staff: [{ email: 'owner@glow.com', name: 'Sarah', role: 'ADMIN' }],
        },
      ] as any);

      // Mock the 6 Prisma calls for gatherDigestData
      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);

      await service.sendWeeklyDigests();

      expect(emailService.send).toHaveBeenCalledTimes(1);
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@glow.com',
          subject: 'Weekly Digest - Glow Clinic',
        }),
      );
    });

    test('skips businesses with weeklyDigestOptOut flag', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Opted Out Biz',
          packConfig: { weeklyDigestOptOut: true },
          staff: [{ email: 'owner@test.com', name: 'Owner', role: 'ADMIN' }],
        },
      ] as any);

      await service.sendWeeklyDigests();

      expect(emailService.send).not.toHaveBeenCalled();
    });

    test('skips businesses with no owner staff', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'No Owner Biz',
          packConfig: {},
          staff: [],
        },
      ] as any);

      await service.sendWeeklyDigests();

      expect(emailService.send).not.toHaveBeenCalled();
    });

    test('handles email send failure gracefully', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Clinic',
          packConfig: {},
          staff: [{ email: 'owner@test.com', name: 'Owner', role: 'ADMIN' }],
        },
      ] as any);

      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);
      emailService.send.mockRejectedValue(new Error('SMTP error'));

      // Should not throw
      await service.sendWeeklyDigests();
    });

    test('sends to multiple businesses', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Clinic A',
          packConfig: {},
          staff: [{ email: 'a@test.com', name: 'Owner A', role: 'ADMIN' }],
        },
        {
          id: 'biz2',
          name: 'Clinic B',
          packConfig: {},
          staff: [{ email: 'b@test.com', name: 'Owner B', role: 'ADMIN' }],
        },
      ] as any);

      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);

      await service.sendWeeklyDigests();

      expect(emailService.send).toHaveBeenCalledTimes(2);
    });

    test('prevents concurrent execution', async () => {
      (prisma.business.findMany as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve([
                  {
                    id: 'biz1',
                    name: 'Clinic',
                    packConfig: {},
                    staff: [{ email: 'owner@test.com', name: 'Owner', role: 'ADMIN' }],
                  },
                ]),
              100,
            ),
          ),
      );

      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);

      // Start two concurrent calls
      const first = service.sendWeeklyDigests();
      const second = service.sendWeeklyDigests();

      jest.advanceTimersByTime(200);

      await Promise.all([first, second]);

      // Only one should have actually queried businesses
      expect(prisma.business.findMany).toHaveBeenCalledTimes(1);
    });

    test('handles null packConfig gracefully', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Clinic',
          packConfig: null,
          staff: [{ email: 'owner@test.com', name: 'Owner', role: 'ADMIN' }],
        },
      ] as any);

      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);

      // Should not throw
      await service.sendWeeklyDigests();

      expect(emailService.send).toHaveBeenCalledTimes(1);
    });

    test('handles cron failure gracefully', async () => {
      prisma.business.findMany.mockRejectedValue(new Error('Database down'));

      // Should not throw
      await service.sendWeeklyDigests();

      expect(emailService.send).not.toHaveBeenCalled();
    });

    test('wraps email in branded layout', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Clinic',
          packConfig: {},
          staff: [{ email: 'owner@test.com', name: 'Owner', role: 'ADMIN' }],
        },
      ] as any);

      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);

      await service.sendWeeklyDigests();

      expect(emailService.buildBrandedHtml).toHaveBeenCalledWith(
        expect.stringContaining('Weekly Digest'),
      );
    });

    test('weeklyDigestOptOut false still sends digest', async () => {
      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Clinic',
          packConfig: { weeklyDigestOptOut: false },
          staff: [{ email: 'owner@test.com', name: 'Owner', role: 'ADMIN' }],
        },
      ] as any);

      prisma.booking.count.mockResolvedValue(0);
      prisma.booking.findMany.mockResolvedValue([]);

      await service.sendWeeklyDigests();

      expect(emailService.send).toHaveBeenCalledTimes(1);
    });
  });
});
