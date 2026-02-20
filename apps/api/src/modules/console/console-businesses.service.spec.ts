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
});
