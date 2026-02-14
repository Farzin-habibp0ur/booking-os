import { Global, Module } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { WebhookController } from './webhook.controller';
import { CustomerModule } from '../customer/customer.module';
import { ConversationModule } from '../conversation/conversation.module';

@Global()
@Module({
  imports: [CustomerModule, ConversationModule],
  controllers: [WebhookController],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
