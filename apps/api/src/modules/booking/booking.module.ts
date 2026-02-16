import { Module } from '@nestjs/common';
import { BookingController } from './booking.controller';
import { BookingService } from './booking.service';
import { RecurringController } from './recurring.controller';
import { RecurringService } from './recurring.service';
import { NotificationModule } from '../notification/notification.module';
import { BusinessModule } from '../business/business.module';

@Module({
  imports: [NotificationModule, BusinessModule],
  controllers: [RecurringController, BookingController],
  providers: [BookingService, RecurringService],
  exports: [BookingService],
})
export class BookingModule {}
