import { Controller, Get, Param, Query } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';

@Controller()
export class ReferralPublicController {
  constructor(
    private referralService: ReferralService,
    private creditService: CreditService,
  ) {}

  @Get('public/referral/validate/:code')
  async validateReferralCode(@Param('code') code: string, @Query('slug') slug: string) {
    if (!slug || !code) return { valid: false };
    return this.referralService.trackReferralClick(code, slug);
  }

  @Get('portal/referral')
  async getPortalReferralInfo(
    @Query('customerId') customerId: string,
    @Query('businessId') businessId: string,
  ) {
    return this.referralService.getCustomerReferralInfo(customerId, businessId);
  }

  @Get('portal/referral/credits')
  async getPortalCredits(
    @Query('customerId') customerId: string,
    @Query('businessId') businessId: string,
  ) {
    return this.creditService.getAvailableCredits(customerId, businessId);
  }
}
