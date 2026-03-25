import { Module } from '@nestjs/common';
import { ReferralController } from './referral.controller';
import { ReferralPublicController } from './referral-public.controller';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';

@Module({
  controllers: [ReferralController, ReferralPublicController],
  providers: [ReferralService, CreditService],
  exports: [ReferralService, CreditService],
})
export class ReferralModule {}
