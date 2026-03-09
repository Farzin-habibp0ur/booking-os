import { Test } from '@nestjs/testing';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

describe('ReferralController', () => {
  let controller: ReferralController;
  let referralService: {
    getReferralStats: jest.Mock;
    getReferralLink: jest.Mock;
  };

  beforeEach(async () => {
    referralService = {
      getReferralStats: jest.fn(),
      getReferralLink: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [ReferralController],
      providers: [{ provide: ReferralService, useValue: referralService }],
    }).compile();

    controller = module.get(ReferralController);
  });

  describe('getStats', () => {
    it('returns referral stats for the business', async () => {
      const mockStats = {
        referralCode: 'CODE1',
        referralLink: 'http://localhost:3000/signup?ref=CODE1',
        totalInvites: 3,
        successfulReferrals: 1,
        pendingReferrals: 2,
        totalCreditsEarned: 50,
        referrals: [],
      };
      referralService.getReferralStats.mockResolvedValue(mockStats);

      const result = await controller.getStats('biz1');
      expect(result).toEqual(mockStats);
      expect(referralService.getReferralStats).toHaveBeenCalledWith('biz1');
    });
  });

  describe('getLink', () => {
    it('returns referral link wrapped in object', async () => {
      referralService.getReferralLink.mockResolvedValue('http://localhost:3000/signup?ref=CODE1');

      const result = await controller.getLink('biz1');
      expect(result).toEqual({ link: 'http://localhost:3000/signup?ref=CODE1' });
    });
  });
});
