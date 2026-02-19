import { Module, forwardRef } from '@nestjs/common';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { ConversationModule } from '../conversation/conversation.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [ConversationModule, forwardRef(() => MessagingModule)],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
