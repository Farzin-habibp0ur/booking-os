import { Test, TestingModule } from '@nestjs/testing';
import { ReferralPublicController } from './referral-public.controller';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';

const mockReferralService = {
  trackReferralClick: jest.fn(),
  getCustomerReferralInfo: jest.fn().mockResolvedValue({ referralCode: 'ABC123' }),
};

const mockCreditService = {
  getAvailableCredits: jest.fn().mockResolvedValue({ total: 50, credits: [] }),
};

describe('ReferralPublicController', () => {
  let controller: ReferralPublicController;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReferralPublicController],
      providers: [
        { provide: ReferralService, useValue: mockReferralService },
        { provide: CreditService, useValue: mockCreditService },
      ],
    }).compile();

    controller = module.get<ReferralPublicController>(ReferralPublicController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('validateReferralCode', () => {
    it('should return valid=true for valid code', async () => {
      mockReferralService.trackReferralClick.mockResolvedValue({
        valid: true,
        referrerName: 'Jane',
        businessName: 'Glow',
        creditAmount: 25,
      });

      const result = await controller.validateReferralCode('ABC123', 'glow-clinic');
      expect(result.valid).toBe(true);
      expect(result.referrerName).toBe('Jane');
    });

    it('should return valid=false when slug is missing', async () => {
      const result = await controller.validateReferralCode('ABC123', '');
      expect(result).toEqual({ valid: false });
    });

    it('should return valid=false when code is missing', async () => {
      const result = await controller.validateReferralCode('', 'glow-clinic');
      expect(result).toEqual({ valid: false });
    });
  });

  describe('getPortalReferralInfo', () => {
    it('should return customer referral info', async () => {
      const result = await controller.getPortalReferralInfo('cust-1', 'biz-1');
      expect(result.referralCode).toBe('ABC123');
    });
  });

  describe('getPortalCredits', () => {
    it('should return available credits', async () => {
      const result = await controller.getPortalCredits('cust-1', 'biz-1');
      expect(result.total).toBe(50);
    });
  });
});
