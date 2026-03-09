import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
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
    @Body() body: { content: string; scheduledFor?: string },
  ) {
    const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : undefined;
    return this.messageService.sendMessage(
      businessId,
      conversationId,
      staffId,
      body.content,
      this.messagingService.getProvider(),
      scheduledFor,
    );
  }

  @Get(':id/messages/scheduled')
  getScheduledMessages(
    @BusinessId() businessId: string,
    @Param('id') conversationId: string,
  ) {
    return this.messageService.getScheduledMessages(businessId, conversationId);
  }

  @Delete(':id/messages/scheduled/:messageId')
  cancelScheduledMessage(
    @BusinessId() businessId: string,
    @Param('id') conversationId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.messageService.cancelScheduledMessage(businessId, conversationId, messageId);
  }
}
