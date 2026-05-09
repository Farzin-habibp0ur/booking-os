import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConsoleBusinessesService } from './console-businesses.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleBusinessesService', () => {
  let service: ConsoleBusinessesService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [ConsoleBusinessesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ConsoleBusinessesService);
  });

  describe('findAll', () => {
    const mockBusiness = {
      id: 'biz1',
      name: 'Glow Clinic',
      slug: 'glow-clinic',
      timezone: 'UTC',
      verticalPack: 'aesthetics',
      createdAt: new Date(),
      subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date() },
      staff: [{ email: 'admin@glow.com', name: 'Admin' }],
      _count: { bookings: 50, customers: 20 },
    };

    it('returns paginated businesses', async () => {
      prisma.business.findMany.mockResolvedValue([mockBusiness] as any);
      prisma.business.count.mockResolvedValue(1);
      prisma.booking.findFirst.mockResolvedValue({ createdAt: new Date() } as any);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].name).toBe('Glow Clinic');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('searches by name', async () => {
      prisma.business.findMany.mockResolvedValue([mockBusiness] as any);
      prisma.business.count.mockResolvedValue(1);
      prisma.booking.findFirst.mockResolvedValue({ createdAt: new Date() } as any);

      await service.findAll({ search: 'glow' });

      expect(prisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ name: { contains: 'glow', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('filters by vertical', async () => {
      prisma.business.findMany.mockResolvedValue([] as any);
      prisma.business.count.mockResolvedValue(0);

      await service.findAll({ vertical: 'aesthetics' });

      expect(prisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ verticalPack: 'aesthetics' }),
        }),
      );
    });

    it('filters by plan', async () => {
      prisma.business.findMany.mockResolvedValue([] as any);
      prisma.business.count.mockResolvedValue(0);

      await service.findAll({ plan: 'pro' });

      expect(prisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscription: expect.objectContaining({ plan: 'pro' }),
          }),
        }),
      );
    });

    it('filters by billing status', async () => {
      prisma.business.findMany.mockResolvedValue([] as any);
      prisma.business.count.mockResolvedValue(0);

      await service.findAll({ billingStatus: 'past_due' });

      expect(prisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            subscription: expect.objectContaining({ status: 'past_due' }),
          }),
        }),
      );
    });

    it('paginates correctly', async () => {
      prisma.business.findMany.mockResolvedValue([] as any);
      prisma.business.count.mockResolvedValue(50);

      const result = await service.findAll({ page: 3, pageSize: 10 });

      expect(prisma.business.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 10 }),
      );
      expect(result.page).toBe(3);
      expect(result.pageSize).toBe(10);
    });

    it('filters by health post-query', async () => {
      const recentDate = new Date();
      prisma.business.findMany.mockResolvedValue([mockBusiness] as any);
      prisma.business.count.mockResolvedValue(1);
      prisma.booking.findFirst.mockResolvedValue({ createdAt: recentDate } as any);

      const result = await service.findAll({ health: 'green' });

      expect(result.items.every((i) => i.health === 'green')).toBe(true);
    });
  });

  describe('findById', () => {
    it('returns business with details', async () => {
      const mockBiz = {
        id: 'biz1',
        name: 'Glow Clinic',
        slug: 'glow-clinic',
        timezone: 'UTC',
        verticalPack: 'aesthetics',
        packConfig: {},
        defaultLocale: 'en',
        createdAt: new Date(),
        subscription: { plan: 'pro', status: 'active', currentPeriodEnd: new Date() },
        staff: [{ email: 'admin@glow.com', name: 'Admin' }],
        _count: {
          bookings: 50,
          customers: 20,
          conversations: 10,
          staff: 3,
          services: 5,
          campaigns: 2,
          waitlistEntries: 1,
        },
      };
      prisma.business.findUnique.mockResolvedValue(mockBiz as any);
      prisma.booking.findFirst.mockResolvedValue({ createdAt: new Date() } as any);

      const result = await service.findById('biz1');

      expect(result.name).toBe('Glow Clinic');
      expect(result.subscription).toBeDefined();
      expect(result.counts).toBeDefined();
    });

    it('throws NotFoundException when not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.findById('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStaff', () => {
    it('returns staff list for business', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.staff.findMany.mockResolvedValue([
        {
          id: 's1',
          name: 'Admin',
          email: 'admin@test.com',
          role: 'ADMIN',
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 's2',
          name: 'Agent',
          email: 'agent@test.com',
          role: 'AGENT',
          isActive: true,
          createdAt: new Date(),
        },
      ] as any);

      const result = await service.getStaff('biz1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Admin');
    });

    it('throws NotFoundException when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.getStaff('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getUsageSnapshot', () => {
    it('returns usage counts', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.booking.count
        .mockResolvedValueOnce(15) // 7d
        .mockResolvedValueOnce(45); // 30d
      prisma.conversation.count.mockResolvedValue(10);
      prisma.waitlistEntry.count.mockResolvedValue(3);
      prisma.campaign.count.mockResolvedValue(2);
      prisma.agentRun.count.mockResolvedValue(5);

      const result = await service.getUsageSnapshot('biz1');

      expect(result.bookings7d).toBe(15);
      expect(result.bookings30d).toBe(45);
      expect(result.conversations).toBe(10);
      expect(result.waitlistEntries).toBe(3);
      expect(result.campaigns).toBe(2);
      expect(result.agentRuns).toBe(5);
    });

    it('throws NotFoundException when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.getUsageSnapshot('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('computeHealth', () => {
    it('returns green for recent activity and active billing', () => {
      const recentDate = new Date();
      expect(service.computeHealth(recentDate, 'active')).toBe('green');
    });

    it('returns yellow for past_due billing', () => {
      const recentDate = new Date();
      expect(service.computeHealth(recentDate, 'past_due')).toBe('yellow');
    });

    it('returns yellow for activity older than 7 days but within 30 days', () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      expect(service.computeHealth(twoWeeksAgo, 'active')).toBe('yellow');
    });

    it('returns red for canceled billing', () => {
      const recentDate = new Date();
      expect(service.computeHealth(recentDate, 'canceled')).toBe('red');
    });

    it('returns red for no activity', () => {
      expect(service.computeHealth(null, 'active')).toBe('red');
    });

    it('returns red for activity older than 30 days', () => {
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
      expect(service.computeHealth(sixtyDaysAgo, 'active')).toBe('red');
    });
  });

  describe('getBaseline', () => {
    it('returns baseline values from the business row', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        baselineMonthlyBookings: 80,
        baselineMonthlyRevenue: 24500,
        baselineCapturedAt: new Date('2026-05-01T00:00:00Z'),
        baselineSource: 'concierge_call',
      } as any);

      const result = await service.getBaseline('biz1');
      expect(result.monthlyBookings).toBe(80);
      expect(result.monthlyRevenue).toBe(24500);
      expect(result.source).toBe('concierge_call');
    });

    it('throws NotFoundException when business is missing', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.getBaseline('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateBaseline', () => {
    it('persists numeric inputs and stamps source as concierge_call', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.business.update.mockResolvedValue({
        baselineMonthlyBookings: 90,
        baselineMonthlyRevenue: 27000,
        baselineCapturedAt: new Date('2026-05-08T00:00:00Z'),
        baselineSource: 'concierge_call',
      } as any);

      const result = await service.updateBaseline('biz1', {
        monthlyBookings: 90,
        monthlyRevenue: 27000,
        capturedAt: '2026-05-08T00:00:00Z',
      });

      expect(prisma.business.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'biz1' },
          data: expect.objectContaining({
            baselineMonthlyBookings: 90,
            baselineMonthlyRevenue: 27000,
            baselineSource: 'concierge_call',
            baselineCapturedAt: expect.any(Date),
          }),
        }),
      );
      expect(result.monthlyBookings).toBe(90);
      expect(result.monthlyRevenue).toBe(27000);
    });

    it('throws BadRequestException for negative revenue', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      await expect(service.updateBaseline('biz1', { monthlyRevenue: -10 })).rejects.toThrow();
    });
  });

  describe('getPilotHealth', () => {
    it('computes scorecard, day count, and revenue rollups', async () => {
      const now = new Date();
      const ownerCreated = new Date(now.getTime() - 12 * 24 * 60 * 60 * 1000);

      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        baselineMonthlyBookings: 60,
        baselineMonthlyRevenue: 18000,
        baselineCapturedAt: new Date(),
      } as any);
      prisma.staff.findFirst.mockResolvedValue({
        id: 'staff1',
        createdAt: ownerCreated,
      } as any);
      prisma.message.count.mockResolvedValue(20);
      prisma.outboundDraft.count.mockResolvedValue(8);
      prisma.message.findMany.mockResolvedValue([
        { conversationId: 'c1', direction: 'INBOUND', createdAt: new Date(now.getTime() - 1000) },
        { conversationId: 'c1', direction: 'OUTBOUND', createdAt: new Date(now.getTime() - 500) },
      ] as any);
      prisma.frontDeskAttribution.findMany
        .mockResolvedValueOnce([
          { revenueAtBooking: 500, estimatedValue: null },
          { revenueAtBooking: 1500, estimatedValue: null },
        ] as any)
        .mockResolvedValueOnce([{ revenueAtBooking: null, estimatedValue: 1000 }] as any);

      const result = await service.getPilotHealth('biz1');

      expect(result.daysIntoPilot).toBe(12);
      expect(result.messagesHandled).toBe(20);
      expect(result.draftsApproved).toBe(8);
      expect(result.captured).toEqual({ count: 2, revenue: 2000 });
      expect(result.wouldHaveBeenMissed).toEqual({ count: 1, revenue: 1000 });
      expect(result.scorecard.messagesHandled).toEqual({ value: 20, target: 10, met: true });
      // baseline 60 / 12 = 5; max(5, 5) = 5; total bookings = 3 (captured 2 + missed 1) -> not met
      expect(result.scorecard.bookings.target).toBe(5);
      expect(result.scorecard.bookings.value).toBe(3);
      expect(result.scorecard.bookings.met).toBe(false);
      expect(result.scorecard.continuationLogged).toBe(false);
    });

    it('uses now as start when no OWNER staff exists', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        baselineMonthlyBookings: null,
        baselineMonthlyRevenue: null,
        baselineCapturedAt: null,
      } as any);
      prisma.staff.findFirst.mockResolvedValue(null);
      prisma.message.count.mockResolvedValue(0);
      prisma.outboundDraft.count.mockResolvedValue(0);
      prisma.message.findMany.mockResolvedValue([]);
      prisma.frontDeskAttribution.findMany.mockResolvedValue([]);

      const result = await service.getPilotHealth('biz1');
      expect(result.daysIntoPilot).toBe(0);
      expect(result.scorecard.bookings.target).toBe(5);
    });

    it('throws NotFoundException when business is missing', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.getPilotHealth('missing')).rejects.toThrow(NotFoundException);
    });
  });
});
