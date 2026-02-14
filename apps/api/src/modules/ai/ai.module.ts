import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ClaudeClient } from './claude.client';
import { IntentDetector } from './intent-detector';
import { ReplyGenerator } from './reply-generator';
import { BookingAssistant } from './booking-assistant';
import { SummaryGenerator } from './summary-generator';
import { BusinessModule } from '../business/business.module';
import { ServiceModule } from '../service/service.module';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [BusinessModule, ServiceModule, AvailabilityModule, BookingModule],
  controllers: [AiController],
  providers: [
    AiService,
    ClaudeClient,
    IntentDetector,
    ReplyGenerator,
    BookingAssistant,
    SummaryGenerator,
  ],
  exports: [AiService],
})
export class AiModule {}
