import { Global, Module, forwardRef } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { WebhookController } from './webhook.controller';
import { SmsController } from './sms.controller';
import { FacebookController } from './facebook.controller';
import { EmailChannelController } from './email-channel.controller';
import { ChatWidgetController } from './chat-widget.controller';
import { WebChatController } from './web-chat.controller';
import { ChannelStatusController } from './channel-status.controller';
import { CustomerModule } from '../customer/customer.module';
import { ConversationModule } from '../conversation/conversation.module';
import { LocationModule } from '../location/location.module';
import { MessageModule } from '../message/message.module';
import { AiModule } from '../ai/ai.module';
import { CustomerIdentityModule } from '../customer-identity/customer-identity.module';

@Global()
@Module({
  imports: [
    CustomerModule,
    ConversationModule,
    LocationModule,
    CustomerIdentityModule,
    forwardRef(() => MessageModule),
    forwardRef(() => AiModule),
  ],
  controllers: [
    WebhookController,
    SmsController,
    FacebookController,
    EmailChannelController,
    ChatWidgetController,
    WebChatController,
    ChannelStatusController,
  ],
  providers: [MessagingService],
  exports: [MessagingService],
})
export class MessagingModule {}
