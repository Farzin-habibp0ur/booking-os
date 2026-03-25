import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ReferralController } from './referral.controller';
import { ReferralPublicController } from './referral-public.controller';
import { ReferralService } from './referral.service';
import { CreditService } from './credit.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [ReferralController, ReferralPublicController],
  providers: [ReferralService, CreditService],
  exports: [ReferralService, CreditService],
})
export class ReferralModule {}
