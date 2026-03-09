import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { ConversationModule } from '../conversation/conversation.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    ConversationModule,
    forwardRef(() => MessagingModule),
    BullModule.registerQueue({ name: 'messaging' }),
  ],
  controllers: [MessageController],
  providers: [MessageService],
  exports: [MessageService],
})
export class MessageModule {}
