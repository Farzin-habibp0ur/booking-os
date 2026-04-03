import { Controller, Post, Get, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { MessageService } from './message.service';
import { MessagingService } from '../messaging/messaging.service';
import { PrismaService } from '../../common/prisma.service';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { TenantGuard } from '../../common/tenant.guard';

@ApiTags('Messages')
@Controller('conversations')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class MessageController {
  constructor(
    private messageService: MessageService,
    private messagingService: MessagingService,
    private prisma: PrismaService,
  ) {}

  @Post(':id/messages')
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  async sendMessage(
    @BusinessId() businessId: string,
    @Param('id') conversationId: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: { content: string; scheduledFor?: string },
  ) {
    // Resolve the correct provider based on conversation channel + location config
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
      include: {
        location: {
          select: {
            whatsappConfig: true,
            instagramConfig: true,
            facebookConfig: true,
            emailConfig: true,
          },
        },
      },
    });

    const provider = this.messagingService.getProviderForConversation(
      conversation?.channel || 'WHATSAPP',
      conversation?.location?.instagramConfig as Record<string, any> | null,
      conversation?.location?.whatsappConfig as Record<string, any> | null,
      conversation?.location?.facebookConfig as Record<string, any> | null,
      conversation?.location?.emailConfig as Record<string, any> | null,
    );

    const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : undefined;
    return this.messageService.sendMessage(
      businessId,
      conversationId,
      staffId,
      body.content,
      provider,
      scheduledFor,
    );
  }

  @Get(':id/messages/scheduled')
  getScheduledMessages(@BusinessId() businessId: string, @Param('id') conversationId: string) {
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
