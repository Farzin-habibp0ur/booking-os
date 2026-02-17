import { Module } from '@nestjs/common';
import { SelfServeController } from './self-serve.controller';
import { SelfServeService } from './self-serve.service';
import { AuthModule } from '../auth/auth.module';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingModule } from '../booking/booking.module';
import { BusinessModule } from '../business/business.module';
import { WaitlistModule } from '../waitlist/waitlist.module';
import { QuoteModule } from '../quote/quote.module';

@Module({
  imports: [AuthModule, AvailabilityModule, BookingModule, BusinessModule, WaitlistModule, QuoteModule],
  controllers: [SelfServeController],
  providers: [SelfServeService],
})
export class SelfServeModule {}
