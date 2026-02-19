import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TenantGuard } from '../../common/tenant.guard';
import { BusinessId, CurrentUser } from '../../common/decorators';
import { OutboundService } from './outbound.service';
import { MessageService } from '../message/message.service';
import { ConversationService } from '../conversation/conversation.service';
import { MessagingService } from '../messaging/messaging.service';

@Controller('outbound')
@UseGuards(AuthGuard('jwt'), TenantGuard)
export class OutboundController {
  private readonly logger = new Logger(OutboundController.name);

  constructor(
    private outboundService: OutboundService,
    private messageService: MessageService,
    private conversationService: ConversationService,
    private messagingService: MessagingService,
  ) {}

  @Post('draft')
  createDraft(
    @BusinessId() businessId: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: { customerId: string; content: string; channel?: string },
  ) {
    return this.outboundService.createDraft({
      businessId,
      customerId: body.customerId,
      staffId,
      channel: body.channel,
      content: body.content,
    });
  }

  @Get()
  findAll(
    @BusinessId() businessId: string,
    @Query('status') status?: string,
    @Query('customerId') customerId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.outboundService.findAll(businessId, {
      status,
      customerId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Patch(':id/approve')
  approve(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser('sub') staffId: string,
  ) {
    return this.outboundService.approve(businessId, id, staffId);
  }

  @Patch(':id/reject')
  reject(@BusinessId() businessId: string, @Param('id') id: string) {
    return this.outboundService.reject(businessId, id);
  }

  @Post('send-direct')
  async sendDirect(
    @BusinessId() businessId: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: { customerId: string; content: string; channel?: string },
  ) {
    // Find or create conversation
    const conversation = await this.conversationService.findOrCreate(
      businessId,
      body.customerId,
      body.channel || 'WHATSAPP',
    );

    // Send message directly
    const message = await this.messageService.sendMessage(
      businessId,
      conversation.id,
      staffId,
      body.content,
      this.messagingService.getProvider(),
    );

    return { message, conversationId: conversation.id };
  }
}
