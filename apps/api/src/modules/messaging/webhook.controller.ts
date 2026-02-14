import { Controller, Post, Get, Body, Query } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CustomerService } from '../customer/customer.service';
import { ConversationService } from '../conversation/conversation.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { MessagingService } from './messaging.service';

@Controller('webhook')
export class WebhookController {
  constructor(
    private prisma: PrismaService,
    private customerService: CustomerService,
    private conversationService: ConversationService,
    private inboxGateway: InboxGateway,
    private messagingService: MessagingService,
  ) {}

  @Post('inbound')
  async inbound(@Body() body: { from: string; body: string; externalId: string; timestamp?: string }) {
    // Find business by phone or use the first business (dev mode)
    const business = await this.prisma.business.findFirst();
    if (!business) return { ok: false, error: 'No business found' };

    // Find or create customer
    const customer = await this.customerService.findOrCreateByPhone(
      business.id,
      body.from,
      body.from,
    );

    // Find or create conversation
    const conversation = await this.conversationService.findOrCreate(
      business.id,
      customer.id,
      'WHATSAPP',
    );

    // Create message
    const message = await this.prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: 'INBOUND',
        content: body.body,
        contentType: 'TEXT',
        externalId: body.externalId,
      },
    });

    // Update conversation
    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: 'OPEN' },
      include: {
        customer: true,
        assignedTo: { select: { id: true, name: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    // Notify via WebSocket
    this.inboxGateway.notifyNewMessage(business.id, message);
    this.inboxGateway.notifyConversationUpdate(business.id, updatedConversation);

    return { ok: true, conversationId: conversation.id, messageId: message.id };
  }

  // Simulator-only: poll for outbound messages
  @Get('simulator/outbox')
  async simulatorOutbox(@Query('since') since?: string): Promise<any[]> {
    const provider = this.messagingService.getMockProvider();
    if (since) {
      return provider.getOutboxSince(new Date(since));
    }
    return provider.getFullOutbox();
  }
}
