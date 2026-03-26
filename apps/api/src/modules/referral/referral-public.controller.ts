import { Controller, Get, Post, Param, Query, Body, BadRequestException } from '@nestjs/common';
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

  @Post('portal/referral/redeem')
  async redeemCredit(
    @Body()
    body: {
      customerId: string;
      businessId: string;
      bookingId: string;
      amount: number;
    },
  ) {
    if (!body.customerId || !body.businessId || !body.bookingId || !body.amount) {
      throw new BadRequestException('customerId, businessId, bookingId, and amount are required');
    }
    if (body.amount <= 0) throw new BadRequestException('Amount must be positive');
    return this.creditService.redeemCredit(body);
  }
}
