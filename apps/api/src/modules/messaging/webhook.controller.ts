import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Headers,
  RawBody,
  Res,
  ForbiddenException,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { CustomerService } from '../customer/customer.service';
import { CustomerIdentityService } from '../customer-identity/customer-identity.service';
import { ConversationService } from '../conversation/conversation.service';
import { LocationService } from '../location/location.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { MessagingService } from './messaging.service';
import { MessageService } from '../message/message.service';
import { AiService } from '../ai/ai.service';
import { WebhookInboundDto } from '../../common/dto';
import {
  WhatsAppCloudProvider,
  TwilioSmsProvider,
  InstagramProvider,
  FacebookProvider,
  EmailChannelProvider,
} from '@booking-os/messaging-provider';

@ApiTags('Messaging Webhooks')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private prisma: PrismaService,
    private customerService: CustomerService,
    private customerIdentityService: CustomerIdentityService,
    private conversationService: ConversationService,
    private locationService: LocationService,
    private inboxGateway: InboxGateway,
    private messagingService: MessagingService,
    private messageService: MessageService,
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

    const expected = crypto.createHmac('sha256', secret).update(body).digest('hex');
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
  // M10 fix: Enforce HMAC signature on WhatsApp webhook
  @Post('whatsapp')
  async whatsappInbound(@Body() payload: any, @Headers('x-hub-signature-256') signature?: string) {
    const secret = this.configService.get<string>('WHATSAPP_APP_SECRET');
    if (secret) {
      const raw = JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const sig = (signature || '').replace('sha256=', '');
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new ForbiddenException('Invalid WhatsApp webhook signature');
      }
    }
    const messages = WhatsAppCloudProvider.parseInboundWebhook(payload);
    const results: Array<{ externalId: string; status: 'processed' | 'duplicate' | 'error' }> = [];

    for (const msg of messages) {
      try {
        const result = await this.processInboundMessage(
          msg.from,
          msg.body,
          msg.externalId,
          undefined,
          msg.businessPhoneNumberId,
        );
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
    businessPhoneNumberId?: string,
    instagramContext?: {
      channel: 'INSTAGRAM';
      instagramPageId: string;
      instagramUserId: string;
      metadata?: Record<string, any>;
    },
    channelOverride?: string,
    facebookContext?: {
      channel: 'FACEBOOK';
      facebookPageId: string;
      facebookPsid: string;
      metadata?: Record<string, any>;
    },
    emailContext?: {
      channel: 'EMAIL';
      fromEmail: string;
      toEmail: string;
      subject?: string;
      metadata?: Record<string, any>;
    },
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

    const channel =
      channelOverride ||
      emailContext?.channel ||
      facebookContext?.channel ||
      instagramContext?.channel ||
      'WHATSAPP';

    // Route to Location → Business
    let business;
    let locationId: string | undefined;

    if (instagramContext?.instagramPageId) {
      // Instagram routing: lookup Location by instagramConfig.pageId
      const location = await this.locationService.findByInstagramPageId(
        instagramContext.instagramPageId,
      );
      if (location) {
        locationId = location.id;
        business = await this.prisma.business.findUnique({
          where: { id: location.businessId },
        });
        this.logger.log(`Routed Instagram message to location "${location.name}" (${location.id})`);
      }
    } else if (facebookContext?.facebookPageId) {
      // Facebook routing: lookup Location by facebookConfig.pageId
      const location = await this.locationService.findByFacebookPageId(
        facebookContext.facebookPageId,
      );
      if (location) {
        locationId = location.id;
        business = await this.prisma.business.findUnique({
          where: { id: location.businessId },
        });
        this.logger.log(`Routed Facebook message to location "${location.name}" (${location.id})`);
      }
    } else if (emailContext?.toEmail) {
      // Email routing: lookup Location by emailConfig.inboundAddress
      const location = await this.locationService.findByEmailAddress(emailContext.toEmail);
      if (location) {
        locationId = location.id;
        business = await this.prisma.business.findUnique({
          where: { id: location.businessId },
        });
        this.logger.log(`Routed email to location "${location.name}" (${location.id})`);
      }
    } else if (businessPhoneNumberId) {
      const location =
        await this.locationService.findLocationByWhatsappPhoneNumberId(businessPhoneNumberId);
      if (location) {
        locationId = location.id;
        business = await this.prisma.business.findUnique({
          where: { id: location.businessId },
        });
        this.logger.log(`Routed inbound message to location "${location.name}" (${location.id})`);
      }
    }

    // Fallback: route by business phone
    if (!business && businessPhone) {
      business = await this.prisma.business.findFirst({
        where: { phone: businessPhone },
      });
    }

    // Dev fallback: use first business
    if (!business) {
      const isDev = this.configService.get('NODE_ENV') !== 'production';
      if (!isDev) throw new BadRequestException('Business not found');
      business = await this.prisma.business.findFirst();
    }
    if (!business) throw new BadRequestException('No business found');

    // Customer lookup via CustomerIdentityService (unified resolution)
    let customer;
    if (emailContext) {
      customer = await this.customerIdentityService.resolveCustomer(business.id, {
        email: emailContext.fromEmail,
        name: from,
      });
    } else if (instagramContext) {
      customer = await this.customerIdentityService.resolveCustomer(business.id, {
        instagramUserId: instagramContext.instagramUserId,
        name: from,
      });
    } else if (facebookContext) {
      customer = await this.customerIdentityService.resolveCustomer(business.id, {
        facebookPsid: facebookContext.facebookPsid,
        name: from,
      });
    } else {
      // WhatsApp and SMS both use phone-based resolution
      customer = await this.customerIdentityService.resolveCustomer(business.id, {
        phone: from,
        name: from,
      });
    }

    const conversation = await this.conversationService.findOrCreate(
      business.id,
      customer.id,
      channel,
      locationId,
    );

    // Determine metadata from the appropriate context
    const contextMetadata =
      emailContext?.metadata || facebookContext?.metadata || instagramContext?.metadata;

    let message;
    try {
      message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          content: body,
          contentType: 'TEXT',
          channel,
          externalId,
          ...(contextMetadata &&
            Object.keys(contextMetadata).length > 0 && {
              metadata: contextMetadata,
            }),
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

  // WhatsApp delivery status callbacks
  @Post('whatsapp/status')
  async whatsappStatusCallback(
    @Body() payload: { externalId: string; status: string; errorMessage?: string },
  ) {
    const statusMap: Record<string, 'DELIVERED' | 'READ' | 'FAILED'> = {
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
    };

    const mappedStatus = statusMap[payload.status?.toLowerCase()];
    if (!mappedStatus) {
      return { ok: true, skipped: true, reason: 'Unrecognized status' };
    }

    const result = await this.messageService.updateDeliveryStatus(
      payload.externalId,
      mappedStatus,
      payload.errorMessage,
    );

    return { ok: true, updated: !!result };
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

  /**
   * Twilio SMS inbound webhook.
   * Twilio sends a POST with form-urlencoded body containing From, Body, MessageSid, etc.
   */
  @Post('sms/inbound')
  async smsInbound(
    @Body() body: Record<string, string>,
    @Headers('x-twilio-signature') twilioSignature: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Validate Twilio signature if auth token is configured
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const webhookUrl = this.configService.get<string>('TWILIO_WEBHOOK_URL');
    if (authToken && webhookUrl && twilioSignature) {
      const isValid = TwilioSmsProvider.validateSignature(
        authToken,
        twilioSignature,
        webhookUrl,
        body,
      );
      if (!isValid) {
        throw new ForbiddenException('Invalid Twilio webhook signature');
      }
    }

    // Check for opt-out events (STOP/START/HELP)
    const optOut = TwilioSmsProvider.parseOptOutWebhook(body);
    if (optOut) {
      this.logger.log(`SMS opt-out event: ${optOut.optOutType} from ${optOut.from}`);
      try {
        // Find customer by phone and update opt-out status
        const customer = await this.prisma.customer.findFirst({
          where: { phone: optOut.from },
        });
        if (customer) {
          const customFields = (customer.customFields as Record<string, any>) || {};
          customFields.smsOptOut = optOut.optOutType === 'STOP';
          await this.prisma.customer.update({
            where: { id: customer.id },
            data: { customFields },
          });
          this.logger.log(
            `Updated smsOptOut=${customFields.smsOptOut} for customer ${customer.id}`,
          );
        }
      } catch (err: any) {
        this.logger.error(`Failed to process opt-out: ${err.message}`, err.stack);
      }

      res.type('text/xml');
      return '<Response></Response>';
    }

    const parsed = TwilioSmsProvider.parseInboundWebhook(body);
    if (!parsed) {
      throw new BadRequestException('Invalid SMS webhook payload');
    }

    this.logger.log(`SMS inbound from ${parsed.from}: ${parsed.body.substring(0, 50)}`);

    // Route by SMS phone number on the To field
    if (parsed.to) {
      const location = await this.locationService.findLocationBySmsNumber(parsed.to);
      if (location) {
        this.logger.log(`Routed SMS to location "${location.name}" (${location.id})`);
      }
    }

    try {
      const result = await this.processInboundMessage(
        parsed.from,
        parsed.body,
        parsed.externalId,
        undefined,
        undefined,
        undefined,
        'SMS',
      );

      res.type('text/xml');
      return '<Response></Response>';
    } catch (err: any) {
      this.logger.error(`SMS inbound processing error: ${err.message}`, err.stack);
      res.type('text/xml');
      return '<Response></Response>';
    }
  }

  /**
   * Twilio SMS status callback webhook.
   * Receives delivery status updates (delivered, failed, undelivered, etc.)
   */
  @Post('sms/status')
  async smsStatusCallback(@Body() body: Record<string, string>) {
    const parsed = TwilioSmsProvider.parseStatusWebhook(body);
    if (!parsed) {
      return { ok: true, skipped: true, reason: 'Invalid status payload' };
    }

    const statusMap: Record<string, 'DELIVERED' | 'READ' | 'FAILED'> = {
      delivered: 'DELIVERED',
      read: 'READ',
      failed: 'FAILED',
      undelivered: 'FAILED',
    };

    const mappedStatus = statusMap[parsed.status?.toLowerCase()];
    if (!mappedStatus) {
      return { ok: true, skipped: true, reason: `Unrecognized status: ${parsed.status}` };
    }

    // Build failure reason from error classification
    let failureReason: string | undefined;
    if (mappedStatus === 'FAILED' && parsed.errorCode) {
      const classification = TwilioSmsProvider.classifyError(parsed.errorCode);
      failureReason = `${classification.category}: ${classification.description} (${parsed.errorCode})`;
    }

    const result = await this.messageService.updateDeliveryStatus(
      parsed.messageSid,
      mappedStatus,
      failureReason,
    );

    return { ok: true, updated: !!result };
  }

  // ─── Instagram Webhook Endpoints ─────────────────────────────────────

  /** Meta Instagram webhook verification (GET challenge-response) */
  @Get('instagram')
  instagramVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.configService.get<string>('INSTAGRAM_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Instagram webhook verified');
      return parseInt(challenge);
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  /** Meta Instagram inbound messages (POST from Meta webhook) */
  @Post('instagram')
  async instagramInbound(@Body() payload: any, @Headers('x-hub-signature-256') signature?: string) {
    const secret = this.configService.get<string>('INSTAGRAM_APP_SECRET');
    if (secret) {
      const raw = JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const sig = (signature || '').replace('sha256=', '');
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new ForbiddenException('Invalid Instagram webhook signature');
      }
    }

    const messages = InstagramProvider.parseInboundWebhook(payload);
    const results: Array<{ externalId: string; status: 'processed' | 'duplicate' | 'error' }> = [];

    for (const msg of messages) {
      try {
        const result = await this.processInboundMessage(
          msg.from,
          msg.body,
          msg.externalId,
          undefined,
          undefined,
          {
            channel: 'INSTAGRAM',
            instagramPageId: msg.instagramPageId,
            instagramUserId: msg.from,
            metadata: {
              ...(msg.storyReplyUrl && { storyReplyUrl: msg.storyReplyUrl }),
              ...(msg.referral && { referral: msg.referral }),
              ...(msg.postback && { postback: msg.postback }),
              ...(msg.mediaType && { mediaType: msg.mediaType }),
              ...(msg.mediaUrl && { mediaUrl: msg.mediaUrl }),
            },
          },
        );
        results.push({
          externalId: msg.externalId,
          status: result.duplicate ? 'duplicate' : 'processed',
        });
      } catch (err: any) {
        this.logger.error(`Instagram inbound processing error: ${err.message}`, err.stack);
        results.push({ externalId: msg.externalId, status: 'error' });
      }
    }

    return {
      status: 'EVENT_RECEIVED',
      processed: results.filter((r) => r.status === 'processed').length,
      results,
    };
  }

  /** Instagram delivery/read status webhooks */
  @Post('instagram/status')
  async instagramStatusCallback(
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    const secret = this.configService.get<string>('INSTAGRAM_APP_SECRET');
    if (secret) {
      const raw = JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const sig = (signature || '').replace('sha256=', '');
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new ForbiddenException('Invalid Instagram webhook signature');
      }
    }

    const statuses = InstagramProvider.parseStatusWebhook(payload);
    let updated = 0;

    for (const s of statuses) {
      const mappedStatus = s.status === 'delivered' ? 'DELIVERED' : 'READ';
      const result = await this.messageService.updateDeliveryStatus(s.messageId, mappedStatus);
      if (result) updated++;
    }

    return { ok: true, updated };
  }

  // ─── Facebook Messenger Webhook Endpoints ─────────────────────────────

  /** Facebook Messenger webhook verification */
  @Get('facebook')
  facebookVerify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const verifyToken = this.configService.get<string>('FACEBOOK_VERIFY_TOKEN');
    if (mode === 'subscribe' && token === verifyToken) {
      this.logger.log('Facebook webhook verified');
      return parseInt(challenge);
    }
    throw new ForbiddenException('Webhook verification failed');
  }

  /** Facebook Messenger inbound messages */
  @Post('facebook')
  async facebookInbound(@Body() payload: any, @Headers('x-hub-signature-256') signature?: string) {
    const secret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    if (secret) {
      const raw = JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const sig = (signature || '').replace('sha256=', '');
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new ForbiddenException('Invalid Facebook webhook signature');
      }
    }

    const messages = FacebookProvider.parseInboundWebhook(payload);
    const results: Array<{ externalId: string; status: 'processed' | 'duplicate' | 'error' }> = [];

    for (const msg of messages) {
      try {
        const result = await this.processInboundMessage(
          msg.from,
          msg.body,
          msg.externalId,
          undefined,
          undefined,
          undefined, // no instagramContext
          undefined, // no channelOverride
          {
            channel: 'FACEBOOK',
            facebookPageId: msg.pageId,
            facebookPsid: msg.from,
            metadata: {
              ...(msg.referral && { referral: msg.referral }),
              ...(msg.postback && { postback: msg.postback }),
              ...(msg.mediaType && { mediaType: msg.mediaType }),
              ...(msg.mediaUrl && { mediaUrl: msg.mediaUrl }),
            },
          },
        );
        results.push({
          externalId: msg.externalId,
          status: result.duplicate ? 'duplicate' : 'processed',
        });
      } catch (err: any) {
        this.logger.error(`Facebook inbound processing error: ${err.message}`, err.stack);
        results.push({ externalId: msg.externalId, status: 'error' });
      }
    }

    return {
      status: 'EVENT_RECEIVED',
      processed: results.filter((r) => r.status === 'processed').length,
      results,
    };
  }

  /** Facebook Messenger delivery/read status webhooks */
  @Post('facebook/status')
  async facebookStatusCallback(
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature?: string,
  ) {
    const secret = this.configService.get<string>('FACEBOOK_APP_SECRET');
    if (secret) {
      const raw = JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', secret).update(raw).digest('hex');
      const sig = (signature || '').replace('sha256=', '');
      const sigBuf = Buffer.from(sig);
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        throw new ForbiddenException('Invalid Facebook webhook signature');
      }
    }

    const statuses = FacebookProvider.parseStatusWebhook(payload);
    let updated = 0;

    for (const s of statuses) {
      const mappedStatus = s.status === 'delivered' ? 'DELIVERED' : 'READ';
      const result = await this.messageService.updateDeliveryStatus(s.messageId, mappedStatus);
      if (result) updated++;
    }

    return { ok: true, updated };
  }

  // ─── Email Webhook Endpoints ──────────────────────────────────────────

  /** Email inbound webhook (SendGrid Inbound Parse / Resend) */
  @Post('email/inbound')
  async emailInbound(
    @Body() body: Record<string, string>,
    @Headers('x-twilio-email-integrity') integritySignature?: string,
    @RawBody() rawBody?: Buffer,
  ) {
    const emailWebhookSecret = this.configService.get<string>('SENDGRID_INBOUND_WEBHOOK_SECRET');
    if (emailWebhookSecret) {
      if (integritySignature && rawBody) {
        const isValid = EmailChannelProvider.verifyWebhookIntegrity(
          rawBody.toString(),
          integritySignature,
          emailWebhookSecret,
        );
        if (!isValid) {
          throw new ForbiddenException('Invalid email webhook signature');
        }
      } else if (!integritySignature) {
        this.logger.warn(
          'Email webhook received without integrity signature — consider requiring signatures in production',
        );
      }
    } else {
      this.logger.warn(
        'SENDGRID_INBOUND_WEBHOOK_SECRET not configured — email webhook signature verification disabled',
      );
    }

    const messages = EmailChannelProvider.parseInboundWebhook(body);
    if (messages.length === 0) {
      return { status: 'EVENT_RECEIVED', processed: 0 };
    }

    const results: Array<{ externalId: string; status: string }> = [];
    for (const msg of messages) {
      try {
        const result = await this.processInboundMessage(
          msg.from,
          msg.body,
          msg.externalId,
          undefined,
          undefined,
          undefined,
          undefined,
          undefined,
          {
            channel: 'EMAIL',
            fromEmail: msg.from,
            toEmail: msg.to,
            subject: msg.subject,
            metadata: {
              ...(msg.inReplyTo && { inReplyTo: msg.inReplyTo }),
              ...(msg.messageId && { messageId: msg.messageId }),
              ...(msg.subject && { subject: msg.subject }),
            },
          },
        );
        results.push({
          externalId: msg.externalId,
          status: result.duplicate ? 'duplicate' : 'processed',
        });
      } catch (err: any) {
        this.logger.error(`Email inbound processing error: ${err.message}`, err.stack);
        results.push({ externalId: msg.externalId, status: 'error' });
      }
    }

    return {
      status: 'EVENT_RECEIVED',
      processed: results.filter((r) => r.status === 'processed').length,
      results,
    };
  }
}
