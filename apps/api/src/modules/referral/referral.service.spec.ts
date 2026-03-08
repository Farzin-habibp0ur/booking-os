import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReferralService } from './referral.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma, createMockConfigService } from '../../test/mocks';

describe('ReferralService', () => {
  let service: ReferralService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    service = module.get(ReferralService);
  });

  describe('getOrCreateReferralCode', () => {
    it('returns existing referral code if business already has one', async () => {
      prisma.business.findUnique.mockResolvedValue({
        referralCode: 'EXISTING1',
      } as any);

      const code = await service.getOrCreateReferralCode('biz1');
      expect(code).toBe('EXISTING1');
      expect(prisma.business.update).not.toHaveBeenCalled();
    });

    it('generates and saves a new code if business has none', async () => {
      prisma.business.findUnique.mockResolvedValue({
        referralCode: null,
      } as any);
      prisma.business.update.mockResolvedValue({
        referralCode: 'NEW12345',
      } as any);

      const code = await service.getOrCreateReferralCode('biz1');
      expect(code).toBe('NEW12345');
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { referralCode: expect.any(String) },
      });
    });

    it('throws BadRequestException if business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.getOrCreateReferralCode('bad-id')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReferralLink', () => {
    it('returns a full referral URL with the code', async () => {
      prisma.business.findUnique.mockResolvedValue({
        referralCode: 'ABC123',
      } as any);

      const link = await service.getReferralLink('biz1');
      expect(link).toContain('/signup?ref=ABC123');
    });
  });

  describe('trackReferral', () => {
    it('creates a PENDING referral record', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'referrer-biz' } as any);
      prisma.referral.findFirst.mockResolvedValue(null);
      prisma.referral.create.mockResolvedValue({} as any);

      await service.trackReferral('CODE1', 'referred-biz');

      expect(prisma.referral.create).toHaveBeenCalledWith({
        data: {
          referrerBusinessId: 'referrer-biz',
          referredBusinessId: 'referred-biz',
          referralCode: 'CODE1',
          status: 'PENDING',
          creditAmount: 50,
        },
      });
    });

    it('silently ignores invalid referral codes', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await service.trackReferral('INVALID', 'referred-biz');
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('prevents self-referral', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'same-biz' } as any);

      await service.trackReferral('CODE1', 'same-biz');
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });

    it('does not duplicate referral records', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'referrer-biz' } as any);
      prisma.referral.findFirst.mockResolvedValue({ id: 'existing-ref' } as any);

      await service.trackReferral('CODE1', 'referred-biz');
      expect(prisma.referral.create).not.toHaveBeenCalled();
    });
  });

  describe('convertReferral', () => {
    it('applies Stripe credits to both parties and marks as CREDITED', async () => {
      const mockStripe = {
        customers: {
          createBalanceTransaction: jest.fn().mockResolvedValue({}),
        },
      };

      prisma.referral.findFirst.mockResolvedValue({
        id: 'ref1',
        referrerBusinessId: 'referrer-biz',
        referredBusinessId: 'referred-biz',
        status: 'PENDING',
        creditAmount: 50,
        referrerBusiness: {
          subscription: { stripeCustomerId: 'cus_referrer' },
        },
        referredBusiness: {
          subscription: { stripeCustomerId: 'cus_referred' },
        },
      } as any);
      prisma.referral.update.mockResolvedValue({} as any);

      await service.convertReferral('referred-biz', mockStripe);

      expect(mockStripe.customers.createBalanceTransaction).toHaveBeenCalledTimes(2);
      expect(mockStripe.customers.createBalanceTransaction).toHaveBeenCalledWith('cus_referrer', {
        amount: -5000,
        currency: 'usd',
        description: 'Referral credit — Give $50, Get $50',
      });
      expect(mockStripe.customers.createBalanceTransaction).toHaveBeenCalledWith('cus_referred', {
        amount: -5000,
        currency: 'usd',
        description: 'Referral credit — Welcome bonus from referral',
      });
      expect(prisma.referral.update).toHaveBeenCalledWith({
        where: { id: 'ref1' },
        data: {
          status: 'CREDITED',
          convertedAt: expect.any(Date),
          creditedAt: expect.any(Date),
        },
      });
    });

    it('does nothing if no pending referral exists', async () => {
      prisma.referral.findFirst.mockResolvedValue(null);

      await service.convertReferral('some-biz', {});
      expect(prisma.referral.update).not.toHaveBeenCalled();
    });

    it('marks as CONVERTED if Stripe credit fails', async () => {
      const mockStripe = {
        customers: {
          createBalanceTransaction: jest.fn().mockRejectedValue(new Error('Stripe error')),
        },
      };

      prisma.referral.findFirst.mockResolvedValue({
        id: 'ref1',
        referrerBusinessId: 'referrer-biz',
        referredBusinessId: 'referred-biz',
        status: 'PENDING',
        creditAmount: 50,
        referrerBusiness: {
          subscription: { stripeCustomerId: 'cus_referrer' },
        },
        referredBusiness: {
          subscription: { stripeCustomerId: 'cus_referred' },
        },
      } as any);
      prisma.referral.update.mockResolvedValue({} as any);

      await service.convertReferral('referred-biz', mockStripe);

      expect(prisma.referral.update).toHaveBeenCalledWith({
        where: { id: 'ref1' },
        data: {
          status: 'CONVERTED',
          convertedAt: expect.any(Date),
        },
      });
    });
  });

  describe('getReferralStats', () => {
    it('returns stats with code, link, and referral list', async () => {
      prisma.business.findUnique.mockResolvedValue({
        referralCode: 'MYCODE',
      } as any);
      prisma.referral.findMany.mockResolvedValue([
        {
          id: 'ref1',
          status: 'CREDITED',
          creditAmount: 50,
          createdAt: new Date('2026-01-15T12:00:00Z'),
          convertedAt: new Date('2026-01-20T12:00:00Z'),
          creditedAt: new Date('2026-01-20T12:00:00Z'),
          referredBusiness: { name: 'Acme Inc', createdAt: new Date() },
        },
        {
          id: 'ref2',
          status: 'PENDING',
          creditAmount: 50,
          createdAt: new Date('2026-02-01T12:00:00Z'),
          convertedAt: null,
          creditedAt: null,
          referredBusiness: { name: 'Beta Corp', createdAt: new Date() },
        },
      ] as any);

      const stats = await service.getReferralStats('biz1');

      expect(stats.referralCode).toBe('MYCODE');
      expect(stats.referralLink).toContain('/signup?ref=MYCODE');
      expect(stats.totalInvites).toBe(2);
      expect(stats.successfulReferrals).toBe(1);
      expect(stats.pendingReferrals).toBe(1);
      expect(stats.totalCreditsEarned).toBe(50);
      expect(stats.referrals).toHaveLength(2);
    });
  });
});
