import {
  Controller,
  Get,
  Post,
  Put,
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

  @Put('draft/auto-save')
  autoSaveDraft(
    @BusinessId() businessId: string,
    @CurrentUser('sub') staffId: string,
    @Body() body: { conversationId: string; channel: string; content: string; subject?: string },
  ) {
    return this.outboundService.autoSaveDraft(businessId, staffId, body);
  }

  @Get('draft/auto-save')
  getAutoSaveDrafts(
    @BusinessId() businessId: string,
    @CurrentUser('sub') staffId: string,
    @Query('conversationId') conversationId: string,
  ) {
    return this.outboundService.getAutoSaveDrafts(businessId, staffId, conversationId);
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

  @Post(':id/send')
  async approveAndSend(
    @BusinessId() businessId: string,
    @Param('id') id: string,
    @CurrentUser('sub') staffId: string,
  ) {
    // Approve the draft
    const draft = await this.outboundService.approve(businessId, id, staffId);

    // Send the message
    const conversationId = draft.conversationId;
    if (!conversationId) {
      // Find or create conversation for the customer
      const conversation = await this.conversationService.findOrCreate(
        businessId,
        draft.customerId,
        draft.channel || 'WHATSAPP',
      );
      const provider = this.messagingService.getProvider();
      const message = await this.messageService.sendMessage(
        businessId,
        conversation.id,
        staffId,
        draft.content,
        provider,
      );
      await this.outboundService.markSent(businessId, id, conversation.id);
      return { message, conversationId: conversation.id, draftId: id };
    }

    // Use existing conversation
    const conversation = await this.conversationService.findById(businessId, conversationId);
    const provider = this.messagingService.getProviderForConversation(
      conversation?.channel || draft.channel || 'WHATSAPP',
      null,
      null,
    );
    const message = await this.messageService.sendMessage(
      businessId,
      conversationId,
      staffId,
      draft.content,
      provider,
    );
    await this.outboundService.markSent(businessId, id, conversationId);
    return { message, conversationId, draftId: id };
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
