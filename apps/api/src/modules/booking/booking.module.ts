import { Module, forwardRef } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { NotificationModule } from '../notification/notification.module';
import { BusinessModule } from '../business/business.module';
import { AuthModule } from '../auth/auth.module';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { InvoiceModule } from '../invoice/invoice.module';
import { TreatmentPlanModule } from '../treatment-plan/treatment-plan.module';
import { AftercareModule } from '../aftercare/aftercare.module';
import { ReferralModule } from '../referral/referral.module';

@Module({
  imports: [
    NotificationModule,
    BusinessModule,
    AuthModule,
    forwardRef(() => WaitlistModule),
    InvoiceModule,
    TreatmentPlanModule,
    AftercareModule,
    ReferralModule,
  ],
  controllers: [RecurringController, BookingController],
  providers: [BookingService, RecurringService],
  exports: [BookingService],
})
export class BookingModule {}
