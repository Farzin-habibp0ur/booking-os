import { Module } from '@nestjs/common';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { CustomerModule } from '../customer/customer.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [CustomerModule, BookingModule],
  controllers: [ConversationController],
  providers: [ConversationService],
  exports: [ConversationService],
})
export class ConversationModule {}
