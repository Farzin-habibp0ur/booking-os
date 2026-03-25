import { Test, TestingModule } from '@nestjs/testing';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';

const mockReferralService = {
  getReferralStats: jest.fn().mockResolvedValue({ totalReferrals: 10 }),
  getReferralSettings: jest.fn().mockResolvedValue({ enabled: true, referrerCredit: 25 }),
  updateReferralSettings: jest.fn().mockResolvedValue({ enabled: true, referrerCredit: 50 }),
  getCustomerReferralInfo: jest.fn().mockResolvedValue({ referralCode: 'ABC123' }),
};

const mockCreditService = {
  getAvailableCredits: jest.fn().mockResolvedValue({ total: 50, credits: [] }),
};

describe('ReferralController', () => {
  let controller: ReferralController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReferralController],
      providers: [
        { provide: ReferralService, useValue: mockReferralService },
        { provide: CreditService, useValue: mockCreditService },
      ],
    }).compile();

    controller = module.get<ReferralController>(ReferralController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
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

  describe('getCustomerReferralInfo', () => {
    it('should return customer referral info', async () => {
      const result = await controller.getCustomerReferralInfo('biz-1', 'cust-1');
      expect(result.referralCode).toBe('ABC123');
      expect(mockReferralService.getCustomerReferralInfo).toHaveBeenCalledWith('cust-1', 'biz-1');
    });
  });
});
