import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';
import { PrismaService } from '../../common/prisma.service';

const mockPrisma = {
  business: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  customer: {
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  customerReferral: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  customerCredit: {
    aggregate: jest.fn(),
  },
  creditRedemption: {
    aggregate: jest.fn(),
  },
  booking: {
    findUnique: jest.fn(),
  },
};

const mockConfig = {
  get: jest.fn((key: string, defaultValue?: string) => {
    if (key === 'WEB_URL') return 'https://example.com';
    return defaultValue;
  }),
};

const mockCreditService = {
  issueCredit: jest.fn(),
  getAvailableCredits: jest.fn().mockResolvedValue({ total: 0, credits: [] }),
};

describe('ReferralService', () => {
  let service: ReferralService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: CreditService, useValue: mockCreditService },
      ],
    }).compile();

    service = module.get<ReferralService>(ReferralService);
  });

  describe('assertReferralVertical', () => {
    it('should allow AESTHETIC vertical', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'AESTHETIC' });
      mockPrisma.customer.findFirst.mockResolvedValue({ referralCode: 'ABC123' });

      await expect(service.getOrCreateReferralCode('cust-1', 'biz-1')).resolves.toBe('ABC123');
    });

    it('should allow WELLNESS vertical', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'WELLNESS' });
      mockPrisma.customer.findFirst.mockResolvedValue({ referralCode: 'XYZ789' });

      await expect(service.getOrCreateReferralCode('cust-1', 'biz-1')).resolves.toBe('XYZ789');
    });

    it('should throw ForbiddenException for DEALERSHIP vertical', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'DEALERSHIP' });

      await expect(service.getOrCreateReferralCode('cust-1', 'biz-1')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw ForbiddenException for GENERAL vertical', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'GENERAL' });

      await expect(service.getOrCreateReferralCode('cust-1', 'biz-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getOrCreateReferralCode', () => {
    it('should return existing code if customer already has one', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'AESTHETIC' });
      mockPrisma.customer.findFirst.mockResolvedValue({ referralCode: 'EXISTING' });

      const code = await service.getOrCreateReferralCode('cust-1', 'biz-1');
      expect(code).toBe('EXISTING');
      expect(mockPrisma.customer.update).not.toHaveBeenCalled();
    });

    it('should generate a new code if customer has none', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'AESTHETIC' });
      mockPrisma.customer.findFirst.mockResolvedValue({ referralCode: null });
      mockPrisma.customer.update.mockResolvedValue({ referralCode: 'NEWCODE1' });

      const code = await service.getOrCreateReferralCode('cust-1', 'biz-1');
      expect(code).toBe('NEWCODE1');
      expect(mockPrisma.customer.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if customer not found', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'AESTHETIC' });
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.getOrCreateReferralCode('cust-1', 'biz-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getReferralLink', () => {
    it('should return correct format', async () => {
      mockPrisma.business.findUnique
        .mockResolvedValueOnce({ verticalPack: 'AESTHETIC' })
        .mockResolvedValueOnce({ slug: 'glow-clinic' });
      mockPrisma.customer.findFirst.mockResolvedValue({ referralCode: 'ABC123' });

      const link = await service.getReferralLink('cust-1', 'biz-1');
      expect(link).toBe('https://example.com/book/glow-clinic?ref=ABC123');
    });
  });

  describe('trackReferralClick', () => {
    it('should return valid=true for valid code', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        name: 'Glow Clinic',
        packConfig: { referral: { refereeCredit: 30 } },
      });
      mockPrisma.customer.findFirst.mockResolvedValue({ name: 'Jane Doe' });

      const result = await service.trackReferralClick('ABC123', 'glow-clinic');
      expect(result).toEqual({
        valid: true,
        referrerName: 'Jane Doe',
        businessName: 'Glow Clinic',
        creditAmount: 30,
      });
    });

    it('should return valid=false for invalid business', async () => {
      mockPrisma.business.findUnique.mockResolvedValue(null);

      const result = await service.trackReferralClick('ABC123', 'nonexistent');
      expect(result).toEqual({ valid: false });
    });

    it('should return valid=false for invalid code', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        name: 'Glow',
        packConfig: {},
      });
      mockPrisma.customer.findFirst.mockResolvedValue(null);

      const result = await service.trackReferralClick('INVALID', 'glow');
      expect(result).toEqual({ valid: false });
    });

    it('should return valid=false when referral program is disabled', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        name: 'Glow Clinic',
        packConfig: { referral: { enabled: false } },
      });

      const result = await service.trackReferralClick('ABC123', 'glow-clinic');
      expect(result).toEqual({ valid: false });
      expect(mockPrisma.customer.findFirst).not.toHaveBeenCalled();
    });
  });

  describe('createPendingReferral', () => {
    beforeEach(() => {
      // Called twice: once for assertReferralVertical, once for packConfig
      mockPrisma.business.findUnique.mockResolvedValue({
        verticalPack: 'AESTHETIC',
        packConfig: { referral: { enabled: true, referrerCredit: 25, refereeCredit: 25 } },
      });
    });

    it('should throw when referral program is disabled', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        verticalPack: 'AESTHETIC',
        packConfig: { referral: { enabled: false } },
      });

      await expect(service.createPendingReferral('CODE1', 'referred-1', 'biz-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create a PENDING referral', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'referrer-1' });
      mockPrisma.customerReferral.count.mockResolvedValue(0);
      mockPrisma.customerReferral.findFirst.mockResolvedValue(null);
      mockPrisma.customerReferral.create.mockResolvedValue({ id: 'ref-1', status: 'PENDING' });

      const result = await service.createPendingReferral('CODE1', 'referred-1', 'biz-1');
      expect(result.status).toBe('PENDING');
    });

    it('should reject self-referral', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'same-person' });

      await expect(service.createPendingReferral('CODE1', 'same-person', 'biz-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should enforce max referrals cap', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        verticalPack: 'AESTHETIC',
        packConfig: { referral: { maxReferralsPerCustomer: 5 } },
      });
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'referrer-1' });
      mockPrisma.customerReferral.count.mockResolvedValue(5);

      await expect(service.createPendingReferral('CODE1', 'referred-1', 'biz-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should reject duplicate referral', async () => {
      mockPrisma.customer.findFirst.mockResolvedValue({ id: 'referrer-1' });
      mockPrisma.customerReferral.count.mockResolvedValue(0);
      mockPrisma.customerReferral.findFirst.mockResolvedValue({ id: 'existing' });

      await expect(service.createPendingReferral('CODE1', 'referred-1', 'biz-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeReferral', () => {
    it('should complete referral and issue credits to both parties', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        customerId: 'referred-1',
        businessId: 'biz-1',
      });
      mockPrisma.customerReferral.findFirst.mockResolvedValue({
        id: 'ref-1',
        referrerCustomerId: 'referrer-1',
        referrerCreditAmount: 25,
        refereeCreditAmount: 25,
      });
      mockPrisma.business.findUnique.mockResolvedValue({
        packConfig: { referral: { creditExpiryMonths: 6 } },
      });
      mockPrisma.customerReferral.update.mockResolvedValue({});

      await service.completeReferral('book-1');

      expect(mockPrisma.customerReferral.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'ref-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
      expect(mockCreditService.issueCredit).toHaveBeenCalledTimes(2);
      expect(mockCreditService.issueCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'referrer-1',
          source: 'REFERRAL_GIVEN',
          amount: 25,
        }),
      );
      expect(mockCreditService.issueCredit).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'referred-1',
          source: 'REFERRAL_RECEIVED',
          amount: 25,
        }),
      );
    });

    it('should skip if booking not found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(null);

      await service.completeReferral('nonexistent');
      expect(mockPrisma.customerReferral.findFirst).not.toHaveBeenCalled();
    });

    it('should skip if no pending referral exists', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        id: 'book-1',
        customerId: 'cust-1',
        businessId: 'biz-1',
      });
      mockPrisma.customerReferral.findFirst.mockResolvedValue(null);

      await service.completeReferral('book-1');
      expect(mockCreditService.issueCredit).not.toHaveBeenCalled();
    });
  });

  describe('getReferralSettings', () => {
    it('should return defaults when no packConfig', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        verticalPack: 'WELLNESS',
        packConfig: {},
      });

      const settings = await service.getReferralSettings('biz-1');
      expect(settings.enabled).toBe(true);
      expect(settings.referrerCredit).toBe(25);
      expect(settings.refereeCredit).toBe(25);
      expect(settings.creditExpiryMonths).toBe(6);
    });

    it('should return custom settings from packConfig', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        verticalPack: 'AESTHETIC',
        packConfig: { referral: { referrerCredit: 50, refereeCredit: 30, creditExpiryMonths: 3 } },
      });

      const settings = await service.getReferralSettings('biz-1');
      expect(settings.referrerCredit).toBe(50);
      expect(settings.refereeCredit).toBe(30);
      expect(settings.creditExpiryMonths).toBe(3);
    });
  });

  describe('updateReferralSettings', () => {
    it('should merge settings into packConfig', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        verticalPack: 'AESTHETIC',
        packConfig: { referral: { referrerCredit: 25 }, other: 'data' },
      });
      mockPrisma.business.update.mockResolvedValue({});

      await service.updateReferralSettings('biz-1', { referrerCredit: 50 });

      expect(mockPrisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz-1' },
        data: {
          packConfig: {
            other: 'data',
            referral: { referrerCredit: 50 },
          },
        },
      });
    });
  });

  describe('getReferralStats', () => {
    it('should return correct stats', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({ verticalPack: 'AESTHETIC' });
      mockPrisma.customerReferral.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(3);
      mockPrisma.customerCredit.aggregate.mockResolvedValue({ _sum: { amount: 350 } });
      mockPrisma.creditRedemption.aggregate.mockResolvedValue({ _sum: { amount: 100 } });
      mockPrisma.customerReferral.findMany.mockResolvedValue([]);

      const stats = await service.getReferralStats('biz-1');
      expect(stats.totalReferrals).toBe(10);
      expect(stats.completedReferrals).toBe(7);
      expect(stats.pendingReferrals).toBe(3);
      expect(stats.totalCreditsIssued).toBe(350);
      expect(stats.totalCreditsRedeemed).toBe(100);
    });
  });

  describe('getCustomerReferralInfo', () => {
    it('should return customer referral data', async () => {
      // assertReferralVertical (from getCustomerReferralInfo)
      // then getOrCreateReferralCode calls assertReferralVertical again
      // then getReferralLink calls getOrCreateReferralCode (assertReferralVertical again) + business.findUnique for slug
      mockPrisma.business.findUnique
        .mockResolvedValueOnce({ verticalPack: 'AESTHETIC' }) // getCustomerReferralInfo -> assertReferralVertical
        .mockResolvedValueOnce({ verticalPack: 'AESTHETIC' }) // getOrCreateReferralCode -> assertReferralVertical
        .mockResolvedValueOnce({ verticalPack: 'AESTHETIC' }) // getReferralLink -> getOrCreateReferralCode -> assertReferralVertical
        .mockResolvedValueOnce({ slug: 'glow-clinic' }); // getReferralLink -> business slug lookup
      mockPrisma.customer.findFirst.mockResolvedValue({ referralCode: 'CODE1' });
      mockPrisma.customerReferral.findMany.mockResolvedValue([]);
      mockPrisma.customerCredit.aggregate.mockResolvedValue({ _sum: { amount: 50 } });

      const info = await service.getCustomerReferralInfo('cust-1', 'biz-1');
      expect(info.referralCode).toBe('CODE1');
      expect(info.referralLink).toContain('ref=CODE1');
      expect(info.creditsEarned).toBe(50);
    });
  });
});
