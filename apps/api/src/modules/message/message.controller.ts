import { Controller, Post, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { MessageService } from './message.service';
import { MessagingService } from '../messaging/messaging.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@ApiTags('Messages')
@Controller('conversations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class MessageController {
  constructor(
    private messageService: MessageService,
    private messagingService: MessagingService,
  ) {}

  @Post(':id/messages')
  sendMessage(
    @BusinessId() businessId: string,
    @Param('id') conversationId: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: { content: string },
  ) {
    return this.messageService.sendMessage(
      businessId,
      conversationId,
      staffId,
      body.content,
      this.messagingService.getProvider(),
    );
  }
}
