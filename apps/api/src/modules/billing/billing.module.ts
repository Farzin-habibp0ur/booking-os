import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { BillingLifecycleService } from './billing-lifecycle.service';
import { EmailModule } from '../email/email.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [EmailModule, ReferralModule],
  controllers: [BillingController],
  providers: [BillingService, BillingLifecycleService],
  exports: [BillingService],
})
export class BillingModule {}
