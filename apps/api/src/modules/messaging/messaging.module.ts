import { Global, Module, forwardRef } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { WebhookController } from './webhook.controller';
import { CustomerModule } from '../customer/customer.module';
import { ConversationModule } from '../conversation/conversation.module';
import { LocationModule } from '../location/location.module';
import { MessageModule } from '../message/message.module';
import { AiModule } from '../ai/ai.module';

@Global()
@Module({
  imports: [
    CustomerModule,
    ConversationModule,
    LocationModule,
    MessageModule,
    forwardRef(() => AiModule),
  ],
  controllers: [WebhookController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
