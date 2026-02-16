import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { NotificationModule } from '../notification/notification.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [NotificationModule, BusinessModule],
  controllers: [BookingController],
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingModule {}
