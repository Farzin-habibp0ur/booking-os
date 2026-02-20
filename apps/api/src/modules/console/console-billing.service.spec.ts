import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConsoleBillingService } from './console-billing.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleBillingService', () => {
  let service: ConsoleBillingService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        ConsoleBillingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(ConsoleBillingService);
  });

  describe('getDashboard', () => {
    it('computes MRR correctly with mixed plans', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(5) // active basic
        .mockResolvedValueOnce(3) // active pro
        .mockResolvedValueOnce(2) // trialing
        .mockResolvedValueOnce(1) // past_due
        .mockResolvedValueOnce(4) // canceled
        .mockResolvedValueOnce(2) // canceled recent
        .mockResolvedValueOnce(10) // trial created recent
        .mockResolvedValueOnce(7); // trial converted recent

      const result = await service.getDashboard();

      expect(result.mrr).toBe(5 * 49 + 3 * 149); // 245 + 447 = 692
      expect(result.activeCount).toBe(8);
    });

    it('handles zero subscriptions gracefully', async () => {
      prisma.subscription.count.mockResolvedValue(0);

      const result = await service.getDashboard();

      expect(result.mrr).toBe(0);
      expect(result.activeCount).toBe(0);
      expect(result.churnRate).toBe(0);
      expect(result.arpa).toBe(0);
      expect(result.trialToPaidRate).toBe(0);
    });

    it('calculates churn rate correctly', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(8) // active basic
        .mockResolvedValueOnce(2) // active pro
        .mockResolvedValueOnce(0) // trialing
        .mockResolvedValueOnce(0) // past_due
        .mockResolvedValueOnce(5) // canceled total
        .mockResolvedValueOnce(2) // canceled recent (30d)
        .mockResolvedValueOnce(0) // trial created recent
        .mockResolvedValueOnce(0); // trial converted recent

      const result = await service.getDashboard();

      // churn = 2 / (10 + 2) = 0.1667
      expect(result.churnRate).toBeCloseTo(2 / 12, 4);
    });

    it('calculates ARPA correctly', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(10) // active basic
        .mockResolvedValueOnce(0) // active pro
        .mockResolvedValueOnce(0) // trialing
        .mockResolvedValueOnce(0) // past_due
        .mockResolvedValueOnce(0) // canceled
        .mockResolvedValueOnce(0) // canceled recent
        .mockResolvedValueOnce(0) // trial created recent
        .mockResolvedValueOnce(0); // trial converted recent

      const result = await service.getDashboard();

      expect(result.arpa).toBe(49); // 490 / 10
    });

    it('calculates trial-to-paid rate', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(5) // active basic
        .mockResolvedValueOnce(0) // active pro
        .mockResolvedValueOnce(3) // trialing
        .mockResolvedValueOnce(0) // past_due
        .mockResolvedValueOnce(0) // canceled
        .mockResolvedValueOnce(0) // canceled recent
        .mockResolvedValueOnce(10) // trial created recent
        .mockResolvedValueOnce(6); // trial converted recent

      const result = await service.getDashboard();

      expect(result.trialToPaidRate).toBe(0.6);
    });

    it('returns plan distribution counts', async () => {
      prisma.subscription.count
        .mockResolvedValueOnce(7) // active basic
        .mockResolvedValueOnce(3) // active pro
        .mockResolvedValueOnce(0) // trialing
        .mockResolvedValueOnce(0) // past_due
        .mockResolvedValueOnce(0) // canceled
        .mockResolvedValueOnce(0) // canceled recent
        .mockResolvedValueOnce(0) // trial created recent
        .mockResolvedValueOnce(0); // trial converted recent

      const result = await service.getDashboard();

      expect(result.planDistribution).toEqual({ basic: 7, pro: 3 });
    });

    it('returns all KPI fields', async () => {
      prisma.subscription.count.mockResolvedValue(1);

      const result = await service.getDashboard();

      expect(result).toHaveProperty('mrr');
      expect(result).toHaveProperty('activeCount');
      expect(result).toHaveProperty('trialCount');
      expect(result).toHaveProperty('pastDueCount');
      expect(result).toHaveProperty('canceledCount');
      expect(result).toHaveProperty('churnRate');
      expect(result).toHaveProperty('arpa');
      expect(result).toHaveProperty('trialToPaidRate');
      expect(result).toHaveProperty('planDistribution');
      expect(result).toHaveProperty('totalRevenue30d');
    });
  });

  describe('getPastDue', () => {
    it('returns subscriptions sorted by days past due', async () => {
      const now = new Date();
      const tenDaysAgo = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub1',
          businessId: 'biz1',
          plan: 'basic',
          currentPeriodEnd: tenDaysAgo,
          business: {
            name: 'Old Clinic',
            staff: [{ email: 'old@clinic.com', name: 'Owner' }],
          },
        },
        {
          id: 'sub2',
          businessId: 'biz2',
          plan: 'pro',
          currentPeriodEnd: twoDaysAgo,
          business: {
            name: 'New Clinic',
            staff: [{ email: 'new@clinic.com', name: 'Owner' }],
          },
        },
      ] as any);

      const result = await service.getPastDue();

      expect(result).toHaveLength(2);
      expect(result[0].businessName).toBe('Old Clinic');
      expect(result[0].daysPastDue).toBeGreaterThanOrEqual(9);
      expect(result[1].businessName).toBe('New Clinic');
      expect(result[1].daysPastDue).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array when no past-due subscriptions', async () => {
      prisma.subscription.findMany.mockResolvedValue([]);

      const result = await service.getPastDue();

      expect(result).toEqual([]);
    });

    it('includes business info in results', async () => {
      const pastDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub1',
          businessId: 'biz1',
          plan: 'pro',
          currentPeriodEnd: pastDate,
          business: {
            name: 'Test Clinic',
            staff: [{ email: 'test@clinic.com', name: 'Admin' }],
          },
        },
      ] as any);

      const result = await service.getPastDue();

      expect(result[0]).toHaveProperty('businessName', 'Test Clinic');
      expect(result[0]).toHaveProperty('ownerEmail', 'test@clinic.com');
      expect(result[0]).toHaveProperty('plan', 'pro');
      expect(result[0]).toHaveProperty('daysPastDue');
    });
  });

  describe('getSubscriptions', () => {
    const mockSubList = [
      {
        id: 'sub1',
        businessId: 'biz1',
        plan: 'basic',
        status: 'active',
        currentPeriodEnd: new Date(),
        createdAt: new Date(),
        business: {
          name: 'Clinic A',
          slug: 'clinic-a',
          staff: [{ email: 'a@clinic.com', name: 'Admin A' }],
        },
      },
    ];

    it('returns paginated list', async () => {
      prisma.subscription.findMany.mockResolvedValue(mockSubList as any);
      prisma.subscription.count.mockResolvedValue(1);

      const result = await service.getSubscriptions({});

      expect(result.items).toHaveLength(1);
      expect(result.items[0].businessName).toBe('Clinic A');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(20);
    });

    it('searches by business name', async () => {
      prisma.subscription.findMany.mockResolvedValue([] as any);
      prisma.subscription.count.mockResolvedValue(0);

      await service.getSubscriptions({ search: 'clinic' });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            business: expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({
                  name: { contains: 'clinic', mode: 'insensitive' },
                }),
              ]),
            }),
          }),
        }),
      );
    });

    it('filters by plan', async () => {
      prisma.subscription.findMany.mockResolvedValue([] as any);
      prisma.subscription.count.mockResolvedValue(0);

      await service.getSubscriptions({ plan: 'pro' });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ plan: 'pro' }),
        }),
      );
    });

    it('filters by status', async () => {
      prisma.subscription.findMany.mockResolvedValue([] as any);
      prisma.subscription.count.mockResolvedValue(0);

      await service.getSubscriptions({ status: 'past_due' });

      expect(prisma.subscription.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'past_due' }),
        }),
      );
    });

    it('returns empty result correctly', async () => {
      prisma.subscription.findMany.mockResolvedValue([] as any);
      prisma.subscription.count.mockResolvedValue(0);

      const result = await service.getSubscriptions({});

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getBillingForBusiness', () => {
    it('returns billing summary with subscription and credits', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        subscription: {
          id: 'sub1',
          plan: 'pro',
          status: 'active',
          currentPeriodEnd: new Date(),
          stripeSubscriptionId: 'stripe_sub_1',
          stripeCustomerId: 'cus_1',
          canceledAt: null,
          cancelReason: null,
          planChangedAt: null,
        },
      } as any);
      prisma.billingCredit.findMany.mockResolvedValue([
        {
          id: 'credit1',
          amount: 50,
          reason: 'Goodwill',
          issuedBy: { name: 'Admin', email: 'admin@test.com' },
        },
      ] as any);

      const result = await service.getBillingForBusiness('biz1');

      expect(result.subscription).toBeDefined();
      expect(result.subscription!.plan).toBe('pro');
      expect(result.credits).toHaveLength(1);
      expect(result.recentInvoices).toEqual([]);
    });

    it('throws NotFoundException when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.getBillingForBusiness('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCreditsForBusiness', () => {
    it('returns sorted credit list', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.billingCredit.findMany.mockResolvedValue([
        {
          id: 'c1',
          amount: 100,
          reason: 'Credit 1',
          createdAt: new Date(),
          issuedBy: { name: 'Admin', email: 'admin@test.com' },
        },
        {
          id: 'c2',
          amount: 50,
          reason: 'Credit 2',
          createdAt: new Date(),
          issuedBy: { name: 'Admin', email: 'admin@test.com' },
        },
      ] as any);

      const result = await service.getCreditsForBusiness('biz1');

      expect(result).toHaveLength(2);
    });

    it('returns empty list when no credits', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.billingCredit.findMany.mockResolvedValue([]);

      const result = await service.getCreditsForBusiness('biz1');

      expect(result).toEqual([]);
    });

    it('throws NotFoundException when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.getCreditsForBusiness('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInvoicesForBusiness', () => {
    it('returns empty array when no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getInvoicesForBusiness('biz1');

      expect(result).toEqual([]);
    });
  });

  describe('changePlan', () => {
    it('throws NotFoundException when no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.changePlan('biz1', 'pro', 'Upgrade', 'admin1', 'admin@test.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for same plan', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: 'pro',
        status: 'active',
      } as any);

      await expect(
        service.changePlan('biz1', 'pro', 'No change', 'admin1', 'admin@test.com'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException for canceled subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        plan: 'basic',
        status: 'canceled',
      } as any);

      await expect(
        service.changePlan('biz1', 'pro', 'Upgrade', 'admin1', 'admin@test.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelSubscription', () => {
    it('throws NotFoundException when no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelSubscription('biz1', 'No longer needed', false, 'admin1', 'admin@test.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when already canceled', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'canceled',
      } as any);

      await expect(
        service.cancelSubscription('biz1', 'Duplicate', false, 'admin1', 'admin@test.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reactivateSubscription', () => {
    it('throws NotFoundException when no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.reactivateSubscription('biz1', 'admin1', 'admin@test.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when not canceled', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        status: 'active',
        canceledAt: null,
      } as any);

      await expect(
        service.reactivateSubscription('biz1', 'admin1', 'admin@test.com'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('issueCredit', () => {
    it('throws NotFoundException when no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.issueCredit('biz1', 50, 'Goodwill', undefined, 'admin1', 'admin@test.com'),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates credit record even if Stripe fails', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_1',
      } as any);
      prisma.billingCredit.create.mockResolvedValue({
        id: 'credit1',
        businessId: 'biz1',
        amount: 50,
        reason: 'Goodwill',
      } as any);

      // Stripe not configured (returns BadRequest from requireStripe),
      // but credit should still be saved locally
      const result = await service.issueCredit(
        'biz1',
        50,
        'Goodwill',
        undefined,
        'admin1',
        'admin@test.com',
      );

      expect(prisma.billingCredit.create).toHaveBeenCalled();
      expect(result.id).toBe('credit1');
    });
  });
});
