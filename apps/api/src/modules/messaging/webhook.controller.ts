import { Controller, Post, Get, Body, Query, Headers, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
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
    private configService: ConfigService,
  ) {}

  private verifyHmac(body: string, signature: string | undefined): boolean {
    const secret = this.configService.get<string>('WEBHOOK_SECRET');
    if (!secret) return true; // No secret configured — dev mode
    if (!signature) return false;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expected),
    );
  }

  @Post('inbound')
  async inbound(
    @Body() body: { from: string; body: string; externalId: string; timestamp?: string; businessPhone?: string },
    @Headers('x-webhook-signature') signature?: string,
  ) {
    // Verify HMAC signature if WEBHOOK_SECRET is configured
    const webhookSecret = this.configService.get<string>('WEBHOOK_SECRET');
    if (webhookSecret) {
      if (!this.verifyHmac(JSON.stringify(body), signature)) {
        throw new ForbiddenException('Invalid webhook signature');
      }
    }

    // Find business by phone — require businessPhone or fallback to first business only in dev
    let business;
    if (body.businessPhone) {
      business = await this.prisma.business.findFirst({
        where: { phone: body.businessPhone },
      });
    }
    if (!business) {
      const isDev = this.configService.get('NODE_ENV') !== 'production';
      if (!isDev) {
        throw new BadRequestException('Business not found');
      }
      business = await this.prisma.business.findFirst();
    }
    if (!business) throw new BadRequestException('No business found');

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

  // Simulator-only: poll for outbound messages — only available in development
  @Get('simulator/outbox')
  async simulatorOutbox(@Query('since') since?: string): Promise<any[]> {
    const isDev = this.configService.get('NODE_ENV') !== 'production';
    if (!isDev) {
      throw new ForbiddenException('Simulator not available in production');
    }

    const provider = this.messagingService.getMockProvider();
    if (since) {
      return provider.getOutboxSince(new Date(since));
    }
    return provider.getFullOutbox();
  }
}
