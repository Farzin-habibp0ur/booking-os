import { Controller, Post, Get, Body, Query, Headers, RawBody, ForbiddenException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { CustomerService } from '../customer/customer.service';
import { ConversationService } from '../conversation/conversation.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { MessagingService } from './messaging.service';
import { AiService } from '../ai/ai.service';
import { WebhookInboundDto } from '../../common/dto';
import { WhatsAppCloudProvider } from '@booking-os/messaging-provider';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private prisma: PrismaService,
    private customerService: CustomerService,
    private conversationService: ConversationService,
    private inboxGateway: InboxGateway,
    private messagingService: MessagingService,
    private configService: ConfigService,
    @Inject(forwardRef(() => AiService)) private aiService: AiService,
  ) {}

  private verifyHmac(body: string, signature: string | undefined): boolean {
    const secret = this.configService.get<string>('WEBHOOK_SECRET');
    if (!secret) {
      this.logger.warn('WEBHOOK_SECRET not configured — rejecting webhook request');
      return false;
    }
    if (!signature) return false;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  // Meta WhatsApp webhook verification (GET challenge-response)
  @Get('whatsapp')
  whatsappVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.configService.get<string>('WHATSAPP_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('WhatsApp webhook verified');
      return parseInt(challenge);
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  // Meta WhatsApp inbound messages (POST from Meta webhook)
  @Post('whatsapp')
  async whatsappInbound(@Body() payload: any) {
    const messages = WhatsAppCloudProvider.parseInboundWebhook(payload);
    const results: Array<{ externalId: string; status: 'processed' | 'duplicate' | 'error' }> = [];

    for (const msg of messages) {
      try {
        const result = await this.processInboundMessage(msg.from, msg.body, msg.externalId, undefined);
        results.push({
          externalId: msg.externalId,
          status: result.duplicate ? 'duplicate' : 'processed',
        });
      } catch (err: any) {
        this.logger.error(`WhatsApp inbound processing error: ${err.message}`, err.stack);
        results.push({ externalId: msg.externalId, status: 'error' });
      }
    }

    // Meta requires 200 response within 5 seconds
    return {
      status: 'EVENT_RECEIVED',
      processed: results.filter((r) => r.status === 'processed').length,
      results,
    };
  }

  private async processInboundMessage(
    from: string,
    body: string,
    externalId: string,
    businessPhone: string | undefined,
  ): Promise<{ conversationId?: string; messageId?: string; duplicate?: boolean }> {
    // Dedup: check if message with this externalId already exists
    if (externalId) {
      const existing = await this.prisma.message.findUnique({
        where: { externalId },
      });
      if (existing) {
        this.logger.log(`Duplicate message skipped: externalId=${externalId}`);
        return { duplicate: true };
      }
    }

    // Find business
    let business;
    if (businessPhone) {
      business = await this.prisma.business.findFirst({
        where: { phone: businessPhone },
      });
    }
    if (!business) {
      const isDev = this.configService.get('NODE_ENV') !== 'production';
      if (!isDev) throw new BadRequestException('Business not found');
      business = await this.prisma.business.findFirst();
    }
    if (!business) throw new BadRequestException('No business found');

    const customer = await this.customerService.findOrCreateByPhone(business.id, from, from);
    const conversation = await this.conversationService.findOrCreate(business.id, customer.id, 'WHATSAPP');

    let message;
    try {
      message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          content: body,
          contentType: 'TEXT',
          externalId,
        },
      });
    } catch (err: any) {
      // P2002 = unique constraint violation (race condition: another request inserted first)
      if (err.code === 'P2002' && err.meta?.target?.includes('externalId')) {
        this.logger.log(`Duplicate message caught by constraint: externalId=${externalId}`);
        return { duplicate: true };
      }
      throw err;
    }

    const updatedConversation = await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: 'OPEN' },
      include: {
        customer: true,
        assignedTo: { select: { id: true, name: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    this.inboxGateway.notifyNewMessage(business.id, message);
    this.inboxGateway.notifyConversationUpdate(business.id, updatedConversation);

    this.aiService
      .processInboundMessage(business.id, conversation.id, message.id, body)
      .catch((err) => this.logger.error(`AI processing error: ${err.message}`));

    return { conversationId: conversation.id, messageId: message.id };
  }

  @Post('inbound')
  async inbound(
    @Body() body: WebhookInboundDto,
    @Headers('x-webhook-signature') signature?: string,
  ) {
    // Verify HMAC signature
    if (!this.verifyHmac(JSON.stringify(body), signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }

    const result = await this.processInboundMessage(
      body.from,
      body.body,
      body.externalId,
      body.businessPhone,
    );

    return { ok: true, ...result };
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
