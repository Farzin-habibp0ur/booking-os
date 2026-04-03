import { Test, TestingModule } from '@nestjs/testing';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';
import { PrismaService } from '../../common/prisma.service';

const mockReferralService = {
  getReferralStats: jest.fn().mockResolvedValue({ totalReferrals: 10 }),
  getReferralSettings: jest.fn().mockResolvedValue({ enabled: true, referrerCredit: 25 }),
  updateReferralSettings: jest.fn().mockResolvedValue({ enabled: true, referrerCredit: 50 }),
  getCustomerReferralInfo: jest.fn().mockResolvedValue({ referralCode: 'ABC123' }),
  getTopReferrers: jest
    .fn()
    .mockResolvedValue([
      { customerId: 'c1', name: 'Emma', totalReferrals: 5, totalCreditsEarned: 125 },
    ]),
  parseSettings: jest.fn().mockReturnValue({ enabled: true }),
};

const mockCreditService = {
  getAvailableCredits: jest.fn().mockResolvedValue({ total: 50, credits: [] }),
};

const mockPrisma = {
  business: { findUnique: jest.fn() },
  customerReferral: { count: jest.fn() },
  customerCredit: { aggregate: jest.fn() },
};

describe('ReferralController', () => {
  let controller: ReferralController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReferralController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ReferralService, useValue: mockReferralService },
        { provide: CreditService, useValue: mockCreditService },
      ],
    }).compile();

    controller = module.get<ReferralController>(ReferralController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getStatsSummary', () => {
    it('returns enabled:false when referral program is disabled', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        verticalPack: 'AESTHETIC',
        packConfig: { referral: { enabled: false } },
      });
      mockReferralService.parseSettings.mockReturnValue({ enabled: false });
      const result = await controller.getStatsSummary('biz-1');
      expect(result).toEqual({ supported: true, enabled: false });
    });

    it('returns stats for enabled aesthetic business', async () => {
      mockPrisma.business.findUnique.mockResolvedValue({
        verticalPack: 'AESTHETIC',
        packConfig: { referral: { enabled: true } },
      });
      mockReferralService.parseSettings.mockReturnValue({ enabled: true });
      mockPrisma.customerReferral.count
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(3);
      mockPrisma.customerCredit.aggregate.mockResolvedValue({ _sum: { amount: 350 } });

      const result = await controller.getStatsSummary('biz-1');
      expect(result).toEqual({
        supported: true,
        enabled: true,
        totalReferrals: 10,
        completedReferrals: 7,
        pendingReferrals: 3,
        conversionRate: 70,
        totalCreditsIssued: 350,
      });
    });
  });

  describe('getStats', () => {
    it('should return referral stats', async () => {
      const result = await controller.getStats('biz-1');
      expect(result.totalReferrals).toBe(10);
      expect(mockReferralService.getReferralStats).toHaveBeenCalledWith('biz-1');
    });
  });

  describe('getSettings', () => {
    it('should return referral settings', async () => {
      const result = await controller.getSettings('biz-1');
      expect(result.enabled).toBe(true);
      expect(mockReferralService.getReferralSettings).toHaveBeenCalledWith('biz-1');
    });
  });

  describe('updateSettings', () => {
    it('should update referral settings', async () => {
      const dto = { referrerCredit: 50 };
      const result = await controller.updateSettings('biz-1', dto);
      expect(result.referrerCredit).toBe(50);
      expect(mockReferralService.updateReferralSettings).toHaveBeenCalledWith('biz-1', dto);
    });
  });

  describe('getTopReferrers', () => {
    it('should return top referrers', async () => {
      const result = await controller.getTopReferrers('biz-1');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Emma');
      expect(mockReferralService.getTopReferrers).toHaveBeenCalledWith('biz-1');
    });
  });

  describe('getCustomerReferralInfo', () => {
    it('should return customer referral info', async () => {
      const result = await controller.getCustomerReferralInfo('biz-1', 'cust-1');
      expect(result.referralCode).toBe('ABC123');
      expect(mockReferralService.getCustomerReferralInfo).toHaveBeenCalledWith('cust-1', 'biz-1');
    });
  });
});
