import { Module } from '@nestjs/common';
import { PublicBookingController } from './public-booking.controller';
import { AvailabilityModule } from '../availability/availability.module';
import { CustomerModule } from '../customer/customer.module';
import { BookingModule } from '../booking/booking.module';
import { WaitlistModule } from '../waitlist/waitlist.module';

@Module({
  imports: [AvailabilityModule, CustomerModule, BookingModule, WaitlistModule],
  controllers: [PublicBookingController],
})
export class PublicBookingModule {}
