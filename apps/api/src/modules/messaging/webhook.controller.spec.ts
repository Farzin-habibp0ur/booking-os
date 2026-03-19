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
  };
  let inboxGateway: { notifyNewMessage: jest.Mock; notifyConversationUpdate: jest.Mock };
  let aiService: { processInboundMessage: jest.Mock };
  let messageService: { updateDeliveryStatus: jest.Mock };

  const WEBHOOK_SECRET = 'test-webhook-secret';

  function signPayload(payload: any, secret: string): string {
    return crypto.createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
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
    };
    inboxGateway = { notifyNewMessage: jest.fn(), notifyConversationUpdate: jest.fn() };
    aiService = { processInboundMessage: jest.fn().mockResolvedValue(undefined) };
    messageService = { updateDeliveryStatus: jest.fn() };

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
    it('should process SMS inbound messages correctly', async () => {
      setupHappyPath();

      const result = await controller.smsInbound({
        From: '+1234567890',
        Body: 'Hello via SMS',
        MessageSid: 'SM-abc123',
        To: '+15551234567',
      });

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
    });

    it('should call CustomerIdentityService.resolveCustomer with phone for SMS', async () => {
      setupHappyPath();

      await controller.smsInbound({
        From: '+1234567890',
        Body: 'SMS resolve test',
        MessageSid: 'SM-resolve',
        To: '+15551234567',
      });

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        phone: '+1234567890',
        name: '+1234567890',
      });
    });

    it('should set channel to SMS on created messages', async () => {
      setupHappyPath();

      await controller.smsInbound({
        From: '+1234567890',
        Body: 'Channel SMS test',
        MessageSid: 'SM-chan',
        To: '+15551234567',
      });

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
      await expect(controller.smsInbound({})).rejects.toThrow('Invalid SMS webhook payload');
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

      const result = await controller.smsInbound(body, validSignature);
      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
    });

    it('should skip signature validation when auth token is not configured', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });

      setupHappyPath();

      // No signature provided, but no auth token either — should pass through
      const result = await controller.smsInbound({
        From: '+1234567890',
        Body: 'No auth check',
        MessageSid: 'SM-noauth',
        To: '+15551234567',
      });

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
    });

    it('should handle MMS with media metadata', async () => {
      setupHappyPath();

      const result = await controller.smsInbound({
        From: '+1234567890',
        Body: 'See attached',
        MessageSid: 'SM-mms',
        To: '+15551234567',
        NumMedia: '1',
        MediaUrl0: 'https://api.twilio.com/media/img.jpg',
      });

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
    });

    it('should attempt SMS location routing by To number', async () => {
      setupHappyPath();

      await controller.smsInbound({
        From: '+1234567890',
        Body: 'Route test',
        MessageSid: 'SM-route',
        To: '+15551234567',
      });

      expect(locationService.findLocationBySmsNumber).toHaveBeenCalledWith('+15551234567');
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
      await expect(
        controller.facebookInbound(payload, 'sha256=invalidhash'),
      ).rejects.toThrow('Invalid Facebook webhook signature');
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
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'read_1700000000',
        'READ',
      );
    });

    it('should validate HMAC signature on status callback', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'FACEBOOK_APP_SECRET') return 'fb-status-secret';
        return defaultValue;
      });

      const payload = {
        entry: [
          { messaging: [{ delivery: { mids: ['mid.x'] }, timestamp: 123 }] },
        ],
      };

      await expect(
        controller.facebookStatusCallback(payload, 'sha256=wrong'),
      ).rejects.toThrow('Invalid Facebook webhook signature');
    });

    it('should return updated 0 for empty payload', async () => {
      const result = await controller.facebookStatusCallback({});
      expect(result.ok).toBe(true);
      expect(result.updated).toBe(0);
    });
  });

  // ─── Email Stub Endpoint ────────────────────────────────────────────

  describe('Email inbound (stub)', () => {
    it('should return EVENT_RECEIVED with processed 0', async () => {
      const result = await controller.emailInbound({ from: 'test@example.com', subject: 'Test' });
      expect(result).toEqual({ status: 'EVENT_RECEIVED', processed: 0 });
    });

    it('should handle any payload without errors', async () => {
      const result = await controller.emailInbound({});
      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
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
