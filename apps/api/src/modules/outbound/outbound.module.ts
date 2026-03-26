import { Module, forwardRef } from '@nestjs/common';
import { OutboundController } from './outbound.controller';
import { OutboundService } from './outbound.service';
import { MessageModule } from '../message/message.module';
import { ConversationModule } from '../conversation/conversation.module';

@Module({
  imports: [forwardRef(() => MessageModule), ConversationModule],
  controllers: [OutboundController],
  providers: [OutboundService],
  exports: [OutboundService],
})
export class OutboundModule {}
