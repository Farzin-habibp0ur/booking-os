import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WebhookController } from './webhook.controller';
import { PrismaService } from '../../common/prisma.service';
import { CustomerService } from '../customer/customer.service';
import { CustomerIdentityService } from '../customer-identity/customer-identity.service';
import { ConversationService } from '../conversation/conversation.service';
import { LocationService } from '../location/location.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { MessagingService } from './messaging.service';
import { MessageService } from '../message/message.service';
import { AiService } from '../ai/ai.service';
import { UsageService } from '../usage/usage.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

function buildWhatsAppPayload(externalId: string, from: string, body: string) {
  return {
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: 'phone1' },
              messages: [
                {
                  id: externalId,
                  from,
                  type: 'text',
                  text: { body },
                  timestamp: '1700000000',
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function buildInstagramPayload(senderId: string, text: string, mid: string) {
  return {
    object: 'instagram',
    entry: [
      {
        id: 'PAGE_ABC',
        time: 1700000000,
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: 'PAGE_ABC' },
            timestamp: 1700000000,
            message: { mid, text },
          },
        ],
      },
    ],
  };
}

describe('WebhookController', () => {
  let controller: WebhookController;
  let configService: { get: jest.Mock };
  let prisma: MockPrisma;
  let customerService: { findOrCreateByPhone: jest.Mock; findOrCreateByInstagramId: jest.Mock };
  let customerIdentityService: { resolveCustomer: jest.Mock };
  let conversationService: { findOrCreate: jest.Mock };
  let locationService: {
    findLocationByWhatsappPhoneNumberId: jest.Mock;
    findByInstagramPageId: jest.Mock;
    findByFacebookPageId: jest.Mock;
    findLocationBySmsNumber: jest.Mock;
    findByEmailAddress: jest.Mock;
  };
  let inboxGateway: { notifyNewMessage: jest.Mock; notifyConversationUpdate: jest.Mock };
  let aiService: { processInboundMessage: jest.Mock };
  let messageService: { updateDeliveryStatus: jest.Mock };
  let usageService: { recordUsage: jest.Mock };

  const WEBHOOK_SECRET = 'test-webhook-secret';

  function signPayload(payload: any, secret: string): string {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
  }

  function createMockRes() {
    return { type: jest.fn().mockReturnThis() } as any;
  }

  const mockBusiness = { id: 'biz1', name: 'Test Biz' };
  const mockCustomer = { id: 'cust1', name: 'John' };
  const mockConversation = { id: 'conv1', customerId: 'cust1' };
  const mockMessage = { id: 'msg1', conversationId: 'conv1', externalId: 'wamid.123' };
  const mockUpdatedConversation = {
    id: 'conv1',
    customer: mockCustomer,
    assignedTo: null,
    messages: [mockMessage],
  };

  function setupHappyPath() {
    (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
    customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
    conversationService.findOrCreate.mockResolvedValue(mockConversation);
    (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
    (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);
  }

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          WEBHOOK_SECRET,
          WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
          INSTAGRAM_VERIFY_TOKEN: 'ig-verify-token',
          FACEBOOK_VERIFY_TOKEN: 'fb-verify-token',
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      }),
    };

    prisma = createMockPrisma();
    customerService = {
      findOrCreateByPhone: jest.fn(),
      findOrCreateByInstagramId: jest.fn(),
    };
    customerIdentityService = {
      resolveCustomer: jest.fn(),
    };
    conversationService = { findOrCreate: jest.fn() };
    locationService = {
      findLocationByWhatsappPhoneNumberId: jest.fn().mockResolvedValue(null),
      findByInstagramPageId: jest.fn().mockResolvedValue(null),
      findByFacebookPageId: jest.fn().mockResolvedValue(null),
      findLocationBySmsNumber: jest.fn().mockResolvedValue(null),
      findByEmailAddress: jest.fn().mockResolvedValue(null),
    };
    inboxGateway = { notifyNewMessage: jest.fn(), notifyConversationUpdate: jest.fn() };
    aiService = { processInboundMessage: jest.fn().mockResolvedValue(undefined) };
    messageService = { updateDeliveryStatus: jest.fn() };
    usageService = { recordUsage: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CustomerService, useValue: customerService },
        { provide: CustomerIdentityService, useValue: customerIdentityService },
        { provide: ConversationService, useValue: conversationService },
        { provide: LocationService, useValue: locationService },
        { provide: InboxGateway, useValue: inboxGateway },
        {
          provide: MessagingService,
          useValue: { getProvider: jest.fn(), getMockProvider: jest.fn() },
        },
        { provide: ConfigService, useValue: configService },
        { provide: AiService, useValue: aiService },
        { provide: MessageService, useValue: messageService },
        { provide: UsageService, useValue: usageService },
      ],
    }).compile();

    controller = module.get(WebhookController);
  });

  // ─── HMAC Signature Validation ──────────────────────────────────────

  describe('HMAC signature validation', () => {
    beforeEach(() => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          WEBHOOK_SECRET,
          WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
          NODE_ENV: 'production',
        };
        return config[key] ?? defaultValue;
      });
    });

    it('should reject unsigned requests in production', async () => {
      const body = { from: '+1234567890', body: 'test', externalId: 'ext1' };

      await expect(controller.inbound(body as any, undefined)).rejects.toThrow(
        'Invalid webhook signature',
      );
    });

    it('should reject requests with wrong signature', async () => {
      const body = { from: '+1234567890', body: 'test', externalId: 'ext1' };

      await expect(controller.inbound(body as any, 'wrong-signature')).rejects.toThrow(
        'Invalid webhook signature',
      );
    });

    it('should accept requests with valid signature', async () => {
      const body = { from: '+1234567890', body: 'test', externalId: 'ext1' };
      const signature = signPayload(body, WEBHOOK_SECRET);

      // Will throw because of missing business, but that's after signature check
      await expect(controller.inbound(body as any, signature)).rejects.toThrow(
        'Business not found',
      );
    });
  });

  // ─── WhatsApp Webhook Verification ──────────────────────────────────

  describe('WhatsApp webhook verification', () => {
    it('should return challenge for valid verify token', () => {
      const result = controller.whatsappVerify('subscribe', 'test-verify-token', '12345');
      expect(result).toBe(12345);
    });

    it('should reject invalid verify token', () => {
      expect(() => controller.whatsappVerify('subscribe', 'wrong-token', '12345')).toThrow(
        'Webhook verification failed',
      );
    });

    it('should reject non-subscribe mode', () => {
      expect(() => controller.whatsappVerify('unsubscribe', 'test-verify-token', '12345')).toThrow(
        'Webhook verification failed',
      );
    });
  });

  // ─── Security Enforcement ───────────────────────────────────────────

  describe('Security enforcement', () => {
    it('should reject unsigned requests even in development (no dev bypass)', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_SECRET') return undefined;
        if (key === 'NODE_ENV') return 'development';
        return defaultValue;
      });

      const body = { from: '+1234567890', body: 'test', externalId: 'ext1' };

      await expect(controller.inbound(body as any, undefined)).rejects.toThrow(
        'Invalid webhook signature',
      );
    });
  });

  // ─── WhatsApp Inbound Processing ────────────────────────────────────

  describe('WhatsApp inbound processing', () => {
    it('should process a new message successfully', async () => {
      setupHappyPath();

      const payload = buildWhatsAppPayload('wamid.123', '+1234567890', 'Hello');
      const result = await controller.whatsappInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
      expect(result.results).toEqual([{ externalId: 'wamid.123', status: 'processed' }]);
      expect(prisma.message.create).toHaveBeenCalledTimes(1);
    });

    it('should call CustomerIdentityService.resolveCustomer with phone for WhatsApp', async () => {
      setupHappyPath();

      const payload = buildWhatsAppPayload('wamid.resolve-wa', '+1234567890', 'Hello');
      await controller.whatsappInbound(payload);

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        phone: '+1234567890',
        name: '+1234567890',
      });
    });

    it('should set channel to WHATSAPP on created messages', async () => {
      setupHappyPath();

      const payload = buildWhatsAppPayload('wamid.chan-wa', '+1234567890', 'Hello');
      await controller.whatsappInbound(payload);

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'WHATSAPP',
            direction: 'INBOUND',
            content: 'Hello',
          }),
        }),
      );
    });

    it('should reject invalid WhatsApp webhook signature', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WHATSAPP_APP_SECRET') return 'wa-app-secret';
        return defaultValue;
      });

      const payload = buildWhatsAppPayload('wamid.sig', '+1234567890', 'Hello');
      await expect(controller.whatsappInbound(payload, 'sha256=invalid')).rejects.toThrow(
        'Invalid WhatsApp webhook signature',
      );
    });

    it('should route message via location when phone number matches', async () => {
      const mockLocation = { id: 'loc1', name: 'Service Center', businessId: 'biz-dealer' };
      const dealerBiz = { id: 'biz-dealer', name: 'Metro Auto' };
      locationService.findLocationByWhatsappPhoneNumberId.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(dealerBiz);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue({ id: 'cust1' });
      conversationService.findOrCreate.mockResolvedValue({ id: 'conv1' });
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg1',
        externalId: 'wamid.route',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: 'conv1',
        customer: { id: 'cust1' },
        assignedTo: null,
        messages: [],
      });

      const payload = buildWhatsAppPayload('wamid.route', '+1234567890', 'Hello');
      const result = await controller.whatsappInbound(payload);

      expect(result.processed).toBe(1);
      expect(locationService.findLocationByWhatsappPhoneNumberId).toHaveBeenCalledWith('phone1');
      expect(prisma.business.findUnique).toHaveBeenCalledWith({
        where: { id: 'biz-dealer' },
      });
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz-dealer',
        'cust1',
        'WHATSAPP',
        'loc1',
      );
    });

    it('should fall back to first business when location not found', async () => {
      setupHappyPath();
      locationService.findLocationByWhatsappPhoneNumberId.mockResolvedValue(null);

      const payload = buildWhatsAppPayload('wamid.fallback', '+1234567890', 'Hello');
      const result = await controller.whatsappInbound(payload);

      expect(result.processed).toBe(1);
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust1',
        'WHATSAPP',
        undefined,
      );
    });

    it('should trigger AI processing after message creation', async () => {
      setupHappyPath();

      const payload = buildWhatsAppPayload('wamid.ai', '+1234567890', 'AI test');
      await controller.whatsappInbound(payload);

      expect(aiService.processInboundMessage).toHaveBeenCalledWith(
        'biz1',
        'conv1',
        'msg1',
        'AI test',
      );
    });

    it('should notify inbox gateway with new message and conversation update', async () => {
      setupHappyPath();

      const payload = buildWhatsAppPayload('wamid.notify', '+1234567890', 'Notify test');
      await controller.whatsappInbound(payload);

      expect(inboxGateway.notifyNewMessage).toHaveBeenCalledWith('biz1', mockMessage);
      expect(inboxGateway.notifyConversationUpdate).toHaveBeenCalledWith(
        'biz1',
        mockUpdatedConversation,
      );
    });
  });

  // ─── Duplicate Message Deduplication ────────────────────────────────

  describe('duplicate message deduplication', () => {
    it('should skip duplicate messages via findUnique hit', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);

      const payload = buildWhatsAppPayload('wamid.123', '+1234567890', 'Hello');
      const result = await controller.whatsappInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
      expect(result.results).toEqual([{ externalId: 'wamid.123', status: 'duplicate' }]);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('should handle P2002 race condition gracefully', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);

      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      (prismaError as any).meta = { target: ['externalId'] };
      (prisma.message.create as jest.Mock).mockRejectedValue(prismaError);

      const payload = buildWhatsAppPayload('wamid.123', '+1234567890', 'Hello');
      const result = await controller.whatsappInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
      expect(result.results).toEqual([{ externalId: 'wamid.123', status: 'duplicate' }]);
    });

    it('should return structured JSON response with per-message status', async () => {
      (prisma.message.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockMessage);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'phone1' },
                  messages: [
                    {
                      id: 'wamid.new',
                      from: '+111',
                      type: 'text',
                      text: { body: 'new msg' },
                      timestamp: '1700000000',
                    },
                    {
                      id: 'wamid.dup',
                      from: '+222',
                      type: 'text',
                      text: { body: 'dup msg' },
                      timestamp: '1700000001',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await controller.whatsappInbound(payload);

      expect(result).toEqual({
        status: 'EVENT_RECEIVED',
        processed: 1,
        results: [
          { externalId: 'wamid.new', status: 'processed' },
          { externalId: 'wamid.dup', status: 'duplicate' },
        ],
      });
    });

    it('should continue processing remaining messages when one fails', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          WEBHOOK_SECRET,
          WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
          NODE_ENV: 'production',
        };
        return config[key] ?? defaultValue;
      });
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(null);

      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'phone1' },
                  messages: [
                    {
                      id: 'wamid.1',
                      from: '+111',
                      type: 'text',
                      text: { body: 'msg1' },
                      timestamp: '1700000000',
                    },
                    {
                      id: 'wamid.2',
                      from: '+222',
                      type: 'text',
                      text: { body: 'msg2' },
                      timestamp: '1700000001',
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await controller.whatsappInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('error');
      expect(result.results[1].status).toBe('error');
    });
  });

  // ─── Instagram Webhook Verification ─────────────────────────────────

  describe('Instagram webhook verification', () => {
    it('should return challenge for valid verify token', () => {
      const result = controller.instagramVerify('subscribe', 'ig-verify-token', '67890');
      expect(result).toBe(67890);
    });

    it('should reject invalid verify token', () => {
      expect(() => controller.instagramVerify('subscribe', 'wrong', '67890')).toThrow(
        'Webhook verification failed',
      );
    });
  });

  // ─── Instagram Inbound Processing ───────────────────────────────────

  describe('Instagram inbound processing', () => {
    it('should process an Instagram inbound message', async () => {
      const mockLocation = { id: 'loc1', name: 'Main', businessId: 'biz1' };
      locationService.findByInstagramPageId.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      const payload = buildInstagramPayload('USER_789', 'Hi via Instagram', 'mid.ig1');
      const result = await controller.instagramInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
      expect(locationService.findByInstagramPageId).toHaveBeenCalledWith('PAGE_ABC');
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust1',
        'INSTAGRAM',
        'loc1',
      );
    });

    it('should call CustomerIdentityService.resolveCustomer with instagramUserId', async () => {
      const mockLocation = { id: 'loc1', name: 'Main', businessId: 'biz1' };
      locationService.findByInstagramPageId.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      const payload = buildInstagramPayload('USER_789', 'Hello IG', 'mid.ig-resolve');
      await controller.instagramInbound(payload);

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        instagramUserId: 'USER_789',
        name: 'USER_789',
      });
    });

    it('should set channel to INSTAGRAM on created messages', async () => {
      const mockLocation = { id: 'loc1', name: 'Main', businessId: 'biz1' };
      locationService.findByInstagramPageId.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      const payload = buildInstagramPayload('USER_789', 'Channel IG', 'mid.ig-chan');
      await controller.instagramInbound(payload);

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'INSTAGRAM',
          }),
        }),
      );
    });

    it('should validate HMAC signature when INSTAGRAM_APP_SECRET is set', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'INSTAGRAM_APP_SECRET') return 'ig-app-secret';
        if (key === 'NODE_ENV') return 'production';
        return defaultValue;
      });

      const payload = buildInstagramPayload('USER_789', 'Hello', 'mid.sig');
      const raw = JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', 'ig-app-secret').update(raw).digest('hex');

      locationService.findByInstagramPageId.mockResolvedValue(null);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await controller.instagramInbound(payload, `sha256=${expected}`);
      expect(result.status).toBe('EVENT_RECEIVED');

      await expect(controller.instagramInbound(payload, 'sha256=wrong')).rejects.toThrow(
        'Invalid Instagram webhook signature',
      );
    });
  });

  // ─── SMS Inbound Processing ─────────────────────────────────────────

  describe('SMS inbound processing', () => {
    it('should process SMS inbound messages and return TwiML', async () => {
      setupHappyPath();
      const mockRes = createMockRes();

      const result = await controller.smsInbound(
        {
          From: '+1234567890',
          Body: 'Hello via SMS',
          MessageSid: 'SM-abc123',
          To: '+15551234567',
        },
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
    });

    it('should call CustomerIdentityService.resolveCustomer with phone for SMS', async () => {
      setupHappyPath();
      const mockRes = createMockRes();

      await controller.smsInbound(
        {
          From: '+1234567890',
          Body: 'SMS resolve test',
          MessageSid: 'SM-resolve',
          To: '+15551234567',
        },
        undefined,
        mockRes,
      );

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        phone: '+1234567890',
        name: '+1234567890',
      });
    });

    it('should set channel to SMS on created messages', async () => {
      setupHappyPath();
      const mockRes = createMockRes();

      await controller.smsInbound(
        {
          From: '+1234567890',
          Body: 'Channel SMS test',
          MessageSid: 'SM-chan',
          To: '+15551234567',
        },
        undefined,
        mockRes,
      );

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'SMS',
            direction: 'INBOUND',
            content: 'Channel SMS test',
          }),
        }),
      );
    });

    it('should reject invalid SMS payload', async () => {
      const mockRes = createMockRes();
      await expect(controller.smsInbound({}, undefined, mockRes)).rejects.toThrow(
        'Invalid SMS webhook payload',
      );
    });

    it('should validate Twilio signature when configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          TWILIO_AUTH_TOKEN: 'twilio-test-token',
          TWILIO_WEBHOOK_URL: 'https://example.com/webhook/sms/inbound',
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });

      const mockRes = createMockRes();

      // Invalid signature should throw
      await expect(
        controller.smsInbound(
          {
            From: '+1234567890',
            Body: 'Test',
            MessageSid: 'SM-sigtest',
            To: '+15551234567',
          },
          'invalid-signature',
          mockRes,
        ),
      ).rejects.toThrow('Invalid Twilio webhook signature');
    });

    it('should accept request with valid Twilio signature', async () => {
      const authToken = 'twilio-test-token';
      const webhookUrl = 'https://example.com/webhook/sms/inbound';
      const body = {
        From: '+1234567890',
        Body: 'Signed test',
        MessageSid: 'SM-signed',
        To: '+15551234567',
      };

      // Build a valid Twilio signature
      const sortedKeys = Object.keys(body).sort();
      let data = webhookUrl;
      for (const key of sortedKeys) {
        data += key + body[key as keyof typeof body];
      }
      const validSignature = crypto.createHmac('sha1', authToken).update(data).digest('base64');

      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          TWILIO_AUTH_TOKEN: authToken,
          TWILIO_WEBHOOK_URL: webhookUrl,
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });

      setupHappyPath();
      const mockRes = createMockRes();

      const result = await controller.smsInbound(body, validSignature, mockRes);
      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
    });

    it('should skip signature validation when auth token is not configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });

      setupHappyPath();
      const mockRes = createMockRes();

      // No signature provided, but no auth token either — should pass through
      const result = await controller.smsInbound(
        {
          From: '+1234567890',
          Body: 'No auth check',
          MessageSid: 'SM-noauth',
          To: '+15551234567',
        },
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
    });

    it('should handle MMS with media metadata', async () => {
      setupHappyPath();
      const mockRes = createMockRes();

      const result = await controller.smsInbound(
        {
          From: '+1234567890',
          Body: 'See attached',
          MessageSid: 'SM-mms',
          To: '+15551234567',
          NumMedia: '1',
          MediaUrl0: 'https://api.twilio.com/media/img.jpg',
        },
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
    });

    it('should attempt SMS location routing by To number', async () => {
      setupHappyPath();
      const mockRes = createMockRes();

      await controller.smsInbound(
        {
          From: '+1234567890',
          Body: 'Route test',
          MessageSid: 'SM-route',
          To: '+15551234567',
        },
        undefined,
        mockRes,
      );

      expect(locationService.findLocationBySmsNumber).toHaveBeenCalledWith('+15551234567');
    });

    it('should handle STOP opt-out and update customer', async () => {
      const mockRes = createMockRes();
      const mockCust = { id: 'cust-optout', phone: '+1234567890', customFields: {} };
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCust);
      (prisma.customer.update as jest.Mock).mockResolvedValue({
        ...mockCust,
        customFields: { smsOptOut: true },
      });

      const result = await controller.smsInbound(
        {
          From: '+1234567890',
          OptOutType: 'STOP',
          MessageSid: 'SM-optout-stop',
        },
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(prisma.customer.findFirst).toHaveBeenCalledWith({
        where: { phone: '+1234567890' },
      });
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-optout' },
        data: { customFields: { smsOptOut: true } },
      });
    });

    it('should handle START opt-in and update customer', async () => {
      const mockRes = createMockRes();
      const mockCust = {
        id: 'cust-optin',
        phone: '+1234567890',
        customFields: { smsOptOut: true },
      };
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCust);
      (prisma.customer.update as jest.Mock).mockResolvedValue({
        ...mockCust,
        customFields: { smsOptOut: false },
      });

      const result = await controller.smsInbound(
        {
          From: '+1234567890',
          OptOutType: 'START',
          MessageSid: 'SM-optout-start',
        },
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-optin' },
        data: { customFields: { smsOptOut: false } },
      });
    });

    it('should return TwiML even when processing errors occur', async () => {
      const mockRes = createMockRes();
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await controller.smsInbound(
        {
          From: '+1234567890',
          Body: 'Error test',
          MessageSid: 'SM-error',
          To: '+15551234567',
        },
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
    });
  });

  // ─── SMS Status Callback ──────────────────────────────────────────────

  describe('SMS status callback', () => {
    it('should process delivered status', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-status-1',
        MessageStatus: 'delivered',
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-status-1',
        'DELIVERED',
        undefined,
      );
    });

    it('should process read status', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-status-2',
        MessageStatus: 'read',
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-status-2',
        'READ',
        undefined,
      );
    });

    it('should process failed status', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-status-3',
        MessageStatus: 'failed',
        ErrorCode: '30003',
        ErrorMessage: 'Unreachable',
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-status-3',
        'FAILED',
        'UNREACHABLE: Unreachable number (30003)',
      );
    });

    it('should map undelivered to FAILED', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-status-4',
        MessageStatus: 'undelivered',
        ErrorCode: '30007',
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-status-4',
        'FAILED',
        'FILTERED: Message filtered by carrier (30007)',
      );
    });

    it('should include error classification in failure reason', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      await controller.smsStatusCallback({
        MessageSid: 'SM-err-class',
        MessageStatus: 'failed',
        ErrorCode: '21610',
      });

      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-err-class',
        'FAILED',
        'UNSUBSCRIBED: Number opted out (21610)',
      );
    });

    it('should skip unrecognized status', async () => {
      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-skip',
        MessageStatus: 'queued',
      });

      expect(result).toEqual({
        ok: true,
        skipped: true,
        reason: 'Unrecognized status: queued',
      });
      expect(messageService.updateDeliveryStatus).not.toHaveBeenCalled();
    });

    it('should return skipped for invalid status payload', async () => {
      const result = await controller.smsStatusCallback({});

      expect(result).toEqual({
        ok: true,
        skipped: true,
        reason: 'Invalid status payload',
      });
    });

    it('should handle failed status without error code', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-nocode',
        MessageStatus: 'failed',
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-nocode',
        'FAILED',
        undefined,
      );
    });
  });

  // ─── Instagram Status Webhook ───────────────────────────────────────

  describe('Instagram status webhook', () => {
    it('should process delivery status', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const payload = {
        entry: [
          {
            id: 'PAGE_ABC',
            messaging: [
              {
                timestamp: 1700000000,
                delivery: { mids: ['mid.1'] },
              },
            ],
          },
        ],
      };

      const result = await controller.instagramStatusCallback(payload);

      expect(result.ok).toBe(true);
      expect(result.updated).toBe(1);
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith('mid.1', 'DELIVERED');
    });
  });

  // ─── WhatsApp Status Callback ───────────────────────────────────────

  describe('WhatsApp status callback', () => {
    it('should handle unrecognized status gracefully', async () => {
      const result = await controller.whatsappStatusCallback({
        externalId: 'wamid.status-1',
        status: 'unknown_status',
      });
      expect(result).toEqual({ ok: true, skipped: true, reason: 'Unrecognized status' });
    });

    it('should process delivered status', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.whatsappStatusCallback({
        externalId: 'wamid.status-2',
        status: 'delivered',
      });
      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'wamid.status-2',
        'DELIVERED',
        undefined,
      );
    });

    it('should process read status', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.whatsappStatusCallback({
        externalId: 'wamid.status-3',
        status: 'read',
      });
      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'wamid.status-3',
        'READ',
        undefined,
      );
    });
  });

  // ─── Facebook Webhook Endpoints ─────────────────────────────────────

  function buildFacebookPayload(senderId: string, text: string, mid: string) {
    return {
      object: 'page',
      entry: [
        {
          id: 'PAGE_FB1',
          time: 1700000000,
          messaging: [
            {
              sender: { id: senderId },
              recipient: { id: 'PAGE_FB1' },
              timestamp: 1700000000,
              message: { mid, text },
            },
          ],
        },
      ],
    };
  }

  describe('Facebook webhook verification', () => {
    it('should verify Facebook webhook with correct token', () => {
      const result = controller.facebookVerify('subscribe', 'fb-verify-token', '99999');
      expect(result).toBe(99999);
    });

    it('should reject Facebook webhook with incorrect token', () => {
      expect(() => controller.facebookVerify('subscribe', 'wrong-token', '99999')).toThrow(
        'Webhook verification failed',
      );
    });

    it('should reject Facebook webhook with wrong mode', () => {
      expect(() => controller.facebookVerify('unsubscribe', 'fb-verify-token', '99999')).toThrow(
        'Webhook verification failed',
      );
    });
  });

  describe('Facebook inbound processing', () => {
    it('should process a text message', async () => {
      setupHappyPath();

      const payload = buildFacebookPayload('USER_FB1', 'Hello via FB', 'mid.fb1');
      const result = await controller.facebookInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].status).toBe('processed');
    });

    it('should process a media message', async () => {
      setupHappyPath();

      const payload = {
        object: 'page',
        entry: [
          {
            id: 'PAGE_FB1',
            messaging: [
              {
                sender: { id: 'USER_FB1' },
                recipient: { id: 'PAGE_FB1' },
                timestamp: 1700000000,
                message: {
                  mid: 'mid.fb-media',
                  attachments: [
                    { type: 'image', payload: { url: 'https://cdn.facebook.com/photo.jpg' } },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = await controller.facebookInbound(payload);
      expect(result.processed).toBe(1);
    });

    it('should process a postback', async () => {
      setupHappyPath();

      const payload = {
        object: 'page',
        entry: [
          {
            id: 'PAGE_FB1',
            messaging: [
              {
                sender: { id: 'USER_FB1' },
                recipient: { id: 'PAGE_FB1' },
                timestamp: 1700000000,
                postback: { title: 'Get Started', payload: 'GET_STARTED' },
              },
            ],
          },
        ],
      };

      const result = await controller.facebookInbound(payload);
      expect(result.processed).toBe(1);
    });

    it('should process a referral', async () => {
      setupHappyPath();

      const payload = {
        object: 'page',
        entry: [
          {
            id: 'PAGE_FB1',
            messaging: [
              {
                sender: { id: 'USER_FB1' },
                recipient: { id: 'PAGE_FB1' },
                timestamp: 1700000000,
                referral: { source: 'SHORTLINK', type: 'OPEN_THREAD', ref: 'promo' },
              },
            ],
          },
        ],
      };

      const result = await controller.facebookInbound(payload);
      expect(result.processed).toBe(1);
    });

    it('should resolve customer with facebookPsid', async () => {
      const mockLocation = { id: 'loc1', name: 'Main', businessId: 'biz1' };
      locationService.findByFacebookPageId.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      const payload = buildFacebookPayload('USER_FB1', 'Hello FB', 'mid.fb-resolve');
      await controller.facebookInbound(payload);

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        facebookPsid: 'USER_FB1',
        name: 'USER_FB1',
      });
    });

    it('should handle duplicate messages', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
        externalId: 'mid.fb-dup',
      });

      const payload = buildFacebookPayload('USER_FB1', 'Dup', 'mid.fb-dup');
      const result = await controller.facebookInbound(payload);

      expect(result.results[0].status).toBe('duplicate');
      expect(result.processed).toBe(0);
    });

    it('should validate HMAC signature when FACEBOOK_APP_SECRET is set', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'FACEBOOK_APP_SECRET') return 'fb-app-secret';
        if (key === 'NODE_ENV') return 'development';
        return defaultValue;
      });

      setupHappyPath();

      const payload = buildFacebookPayload('USER_FB1', 'Signed', 'mid.fb-sig');
      const raw = JSON.stringify(payload);
      const expected = crypto.createHmac('sha256', 'fb-app-secret').update(raw).digest('hex');

      const result = await controller.facebookInbound(payload, `sha256=${expected}`);
      expect(result.status).toBe('EVENT_RECEIVED');
    });

    it('should reject invalid HMAC signature', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'FACEBOOK_APP_SECRET') return 'fb-app-secret';
        return defaultValue;
      });

      const payload = buildFacebookPayload('USER_FB1', 'Bad sig', 'mid.fb-badsig');
      await expect(controller.facebookInbound(payload, 'sha256=invalidhash')).rejects.toThrow(
        'Invalid Facebook webhook signature',
      );
    });

    it('should route by Facebook page ID to location', async () => {
      const mockLocation = { id: 'loc-fb', name: 'FB Location', businessId: 'biz1' };
      locationService.findByFacebookPageId.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      const payload = buildFacebookPayload('USER_FB1', 'Route test', 'mid.fb-route');
      await controller.facebookInbound(payload);

      expect(locationService.findByFacebookPageId).toHaveBeenCalledWith('PAGE_FB1');
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust1',
        'FACEBOOK',
        'loc-fb',
      );
    });

    it('should set channel to FACEBOOK on created messages', async () => {
      setupHappyPath();

      const payload = buildFacebookPayload('USER_FB1', 'Channel FB', 'mid.fb-chan');
      await controller.facebookInbound(payload);

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'FACEBOOK',
          }),
        }),
      );
    });

    it('should return empty results for payload with no messages', async () => {
      const payload = { object: 'page', entry: [] };
      const result = await controller.facebookInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('Facebook status callback', () => {
    it('should process delivered status', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const payload = {
        entry: [
          {
            id: 'PAGE_FB1',
            messaging: [
              {
                timestamp: 1700000000,
                delivery: { mids: ['mid.fb-del1'] },
              },
            ],
          },
        ],
      };

      const result = await controller.facebookStatusCallback(payload);
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(1);
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith('mid.fb-del1', 'DELIVERED');
    });

    it('should process read status', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const payload = {
        entry: [
          {
            id: 'PAGE_FB1',
            messaging: [
              {
                timestamp: 1700000000,
                read: { watermark: 1700000000 },
              },
            ],
          },
        ],
      };

      const result = await controller.facebookStatusCallback(payload);
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(1);
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith('read_1700000000', 'READ');
    });

    it('should validate HMAC signature on status callback', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'FACEBOOK_APP_SECRET') return 'fb-status-secret';
        return defaultValue;
      });

      const payload = {
        entry: [{ messaging: [{ delivery: { mids: ['mid.x'] }, timestamp: 123 }] }],
      };

      await expect(controller.facebookStatusCallback(payload, 'sha256=wrong')).rejects.toThrow(
        'Invalid Facebook webhook signature',
      );
    });

    it('should return updated 0 for empty payload', async () => {
      const result = await controller.facebookStatusCallback({});
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(0);
    });
  });

  // ─── Email Inbound Processing ───────────────────────────────────────

  describe('Email inbound processing', () => {
    it('should process a basic inbound email', async () => {
      setupHappyPath();

      const result = await controller.emailInbound({
        from: 'customer@example.com',
        to: 'inbox@mybusiness.com',
        subject: 'Booking question',
        text: 'I want to book an appointment.',
      });

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
      expect(result.results).toHaveLength(1);
      expect(result.results![0].status).toBe('processed');
    });

    it('should resolve customer by email', async () => {
      setupHappyPath();

      await controller.emailInbound({
        from: 'Jane Doe <jane@example.com>',
        to: 'inbox@mybusiness.com',
        subject: 'Hello',
        text: 'Hi there',
      });

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        email: 'jane@example.com',
        name: 'jane@example.com',
      });
    });

    it('should store thread headers (In-Reply-To) in metadata', async () => {
      setupHappyPath();

      await controller.emailInbound({
        from: 'customer@example.com',
        to: 'inbox@mybusiness.com',
        subject: 'Re: Booking',
        text: 'Thanks for confirming.',
        'In-Reply-To': '<original-msg@example.com>',
        'Message-ID': '<reply-msg@example.com>',
      });

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              inReplyTo: '<original-msg@example.com>',
              messageId: '<reply-msg@example.com>',
              subject: 'Re: Booking',
            }),
          }),
        }),
      );
    });

    it('should strip quoted content from email replies', async () => {
      setupHappyPath();

      await controller.emailInbound({
        from: 'customer@example.com',
        to: 'inbox@mybusiness.com',
        subject: 'Re: Booking',
        text: 'Yes, confirmed.\n\n> Previous quoted content\n> More quoted text',
      });

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Yes, confirmed.',
          }),
        }),
      );
    });

    it('should return processed 0 for empty/invalid payload', async () => {
      const result = await controller.emailInbound({});
      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
    });

    it('should route by emailConfig.inboundAddress on location', async () => {
      const mockLocation = { id: 'loc-email', name: 'Email Location', businessId: 'biz-email' };
      const emailBiz = { id: 'biz-email', name: 'Email Biz' };
      locationService.findByEmailAddress.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(emailBiz);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      await controller.emailInbound({
        from: 'customer@example.com',
        to: 'support@mybusiness.com',
        subject: 'Help',
        text: 'Need help',
      });

      expect(locationService.findByEmailAddress).toHaveBeenCalledWith('support@mybusiness.com');
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz-email',
        'cust1',
        'EMAIL',
        'loc-email',
      );
    });

    it('should set channel to EMAIL on created messages', async () => {
      setupHappyPath();

      await controller.emailInbound({
        from: 'customer@example.com',
        to: 'inbox@mybusiness.com',
        subject: 'Test',
        text: 'Channel test',
      });

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'EMAIL',
          }),
        }),
      );
    });

    it('should handle duplicate email dedup', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
        externalId: '<dup-msg@example.com>',
      });

      const result = await controller.emailInbound({
        from: 'customer@example.com',
        to: 'inbox@mybusiness.com',
        text: 'Duplicate',
        'Message-ID': '<dup-msg@example.com>',
      });

      expect(result.results![0].status).toBe('duplicate');
      expect(result.processed).toBe(0);
    });

    it('should handle processing errors gracefully', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(null);
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        return defaultValue;
      });

      const result = await controller.emailInbound({
        from: 'customer@example.com',
        to: 'inbox@mybusiness.com',
        text: 'Error test',
      });

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.results![0].status).toBe('error');
      expect(result.processed).toBe(0);
    });

    it('should return empty results for payload with missing from', async () => {
      const result = await controller.emailInbound({
        to: 'inbox@mybusiness.com',
        text: 'No from field',
      });

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
    });
  });

  // ─── Email Webhook Signature Verification ──────────────────────────

  describe('Email webhook signature verification', () => {
    it('should reject email with invalid signature when secret is configured', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SENDGRID_INBOUND_WEBHOOK_SECRET') return 'email-webhook-secret';
        return undefined;
      });

      await expect(
        controller.emailInbound(
          { from: 'a@b.com', to: 'c@d.com', text: 'hi' },
          'invalid-sig',
          Buffer.from('raw body'),
        ),
      ).rejects.toThrow('Invalid email webhook signature');
    });

    it('should process email with valid signature', async () => {
      const secret = 'email-webhook-secret';
      const rawBody = '{"from":"a@b.com","to":"c@d.com","text":"hi"}';
      const crypto = await import('crypto');
      const validSig = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

      configService.get.mockImplementation((key: string) => {
        if (key === 'SENDGRID_INBOUND_WEBHOOK_SECRET') return secret;
        return undefined;
      });
      setupHappyPath();

      const result = await controller.emailInbound(
        { from: 'a@b.com', to: 'c@d.com', text: 'hi' },
        validSig,
        Buffer.from(rawBody),
      );

      expect(result.status).toBe('EVENT_RECEIVED');
    });

    it('should process email without signature when no secret is configured', async () => {
      configService.get.mockImplementation(() => undefined);
      setupHappyPath();

      const result = await controller.emailInbound({ from: 'a@b.com', to: 'c@d.com', text: 'hi' });

      expect(result.status).toBe('EVENT_RECEIVED');
    });

    it('should warn but process when secret is set but no signature header present', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SENDGRID_INBOUND_WEBHOOK_SECRET') return 'some-secret';
        return undefined;
      });
      setupHappyPath();

      const result = await controller.emailInbound({ from: 'a@b.com', to: 'c@d.com', text: 'hi' });

      expect(result.status).toBe('EVENT_RECEIVED');
    });
  });

  // ─── Email Delivery Status ─────────────────────────────────────────

  describe('emailStatusCallback', () => {
    it('should update status for email.delivered event', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.emailStatusCallback({
        type: 'email.delivered',
        data: { email_id: 'resend-123' },
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'resend-123',
        'DELIVERED',
        undefined,
      );
    });

    it('should set failure reason for email.bounced event', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.emailStatusCallback({
        type: 'email.bounced',
        data: { email_id: 'resend-456', bounce: { message: 'Mailbox full' } },
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'resend-456',
        'FAILED',
        'Mailbox full',
      );
    });

    it('should ignore unknown event type', async () => {
      const result = await controller.emailStatusCallback({
        type: 'email.sent',
        data: { email_id: 'resend-789' },
      });

      expect(result).toEqual({ ok: true, status: 'ignored' });
      expect(messageService.updateDeliveryStatus).not.toHaveBeenCalled();
    });

    it('should ignore when email_id is missing', async () => {
      const result = await controller.emailStatusCallback({
        type: 'email.delivered',
        data: {},
      });

      expect(result).toEqual({ ok: true, status: 'ignored' });
      expect(messageService.updateDeliveryStatus).not.toHaveBeenCalled();
    });
  });

  // ─── Usage Recording ───────────────────────────────────────────────

  describe('Usage recording on inbound messages', () => {
    it('should record usage for WhatsApp inbound', async () => {
      setupHappyPath();

      await controller.whatsappInbound(buildWhatsAppPayload('wamid.usage1', '+14155551234', 'Hi'));

      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'WHATSAPP', 'INBOUND');
    });

    it('should record usage for SMS inbound', async () => {
      setupHappyPath();
      const mockRes = createMockRes();

      await controller.smsInbound(
        { From: '+14155551234', Body: 'Hello', MessageSid: 'SM_USAGE', To: '+15551234567' },
        undefined,
        mockRes,
      );

      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'SMS', 'INBOUND');
    });

    it('should record usage for email inbound', async () => {
      setupHappyPath();

      await controller.emailInbound({
        from: 'test@example.com',
        to: 'inbox@biz.com',
        text: 'Hello',
        subject: 'Test',
      });

      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'EMAIL', 'INBOUND');
    });

    it('should not break message processing when usage recording fails', async () => {
      setupHappyPath();
      usageService.recordUsage.mockRejectedValue(new Error('DB down'));

      const result = await controller.whatsappInbound(
        buildWhatsAppPayload('wamid.usage-fail', '+14155551234', 'Still works'),
      );

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
    });

    it('should not record usage for duplicate messages', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
        externalId: 'wamid.dup-usage',
      });

      await controller.whatsappInbound(
        buildWhatsAppPayload('wamid.dup-usage', '+14155551234', 'Dup'),
      );

      expect(usageService.recordUsage).not.toHaveBeenCalled();
    });
  });

  // ─── Error Handling ─────────────────────────────────────────────────

  describe('error handling', () => {
    it('should throw BadRequestException when no business found in production', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        return defaultValue;
      });
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(null);

      const payload = buildWhatsAppPayload('wamid.err-1', '+10000000000', 'No business');
      const result = await controller.whatsappInbound(payload);

      expect(result.results[0].status).toBe('error');
    });

    it('should fall back to first business in dev when no match', async () => {
      locationService.findLocationByWhatsappPhoneNumberId.mockResolvedValue(null);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      const payload = buildWhatsAppPayload('wamid.dev-fallback', '+10000000000', 'Dev fallback');
      const result = await controller.whatsappInbound(payload);

      expect(result.processed).toBe(1);
      expect(prisma.business.findFirst).toHaveBeenCalled();
    });
  });

  // ─── Simulator Outbox ───────────────────────────────────────────────

  describe('simulatorOutbox', () => {
    it('should throw ForbiddenException in production', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'production';
        return defaultValue;
      });

      await expect(controller.simulatorOutbox()).rejects.toThrow('Simulator not available');
    });
  });
});
