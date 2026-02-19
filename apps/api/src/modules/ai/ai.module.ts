import { Module, forwardRef } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { ClaudeClient } from './claude.client';
import { IntentDetector } from './intent-detector';
import { ReplyGenerator } from './reply-generator';
import { BookingAssistant } from './booking-assistant';
import { CancelAssistant } from './cancel-assistant';
import { RescheduleAssistant } from './reschedule-assistant';
import { SummaryGenerator } from './summary-generator';
import { ProfileExtractor } from './profile-extractor';
import { ProfileCollector } from './profile-collector';
import { ConversationActionHandler } from './conversation-action-handler';
import { BusinessModule } from '../business/business.module';
import { ServiceModule } from '../service/service.module';
import { AvailabilityModule } from '../availability/availability.module';
import { BookingModule } from '../booking/booking.module';
import { MessageModule } from '../message/message.module';
import { ActionCardModule } from '../action-card/action-card.module';

@Module({
  // MessagingModule is @Global() so no need to import it here
  // MessageModule uses forwardRef to break circular: AiModule -> MessageModule -> MessagingModule -> AiModule
  imports: [
    BusinessModule,
    ServiceModule,
    AvailabilityModule,
    BookingModule,
    forwardRef(() => MessageModule),
    ActionCardModule,
  ],
  controllers: [AiController],
  providers: [
    AiService,
    ClaudeClient,
    IntentDetector,
    ReplyGenerator,
    BookingAssistant,
    CancelAssistant,
    RescheduleAssistant,
    SummaryGenerator,
    ProfileExtractor,
    ProfileCollector,
    ConversationActionHandler,
  ],
  exports: [AiService, ProfileExtractor],
})
export class AiModule {}
