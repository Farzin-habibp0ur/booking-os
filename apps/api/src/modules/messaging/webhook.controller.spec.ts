import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WebhookController } from './webhook.controller';
import { PrismaService } from '../../common/prisma.service';
import { CustomerService } from '../customer/customer.service';
import { ConversationService } from '../conversation/conversation.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { MessagingService } from './messaging.service';
import { AiService } from '../ai/ai.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

function buildWhatsAppPayload(externalId: string, from: string, body: string) {
  return {
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: 'phone1' },
          messages: [{
            id: externalId,
            from,
            type: 'text',
            text: { body },
            timestamp: '1700000000',
          }],
        },
      }],
    }],
  };
}

describe('WebhookController', () => {
  let controller: WebhookController;
  let configService: { get: jest.Mock };
  let prisma: MockPrisma;
  let customerService: { findOrCreateByPhone: jest.Mock };
  let conversationService: { findOrCreate: jest.Mock };
  let inboxGateway: { notifyNewMessage: jest.Mock; notifyConversationUpdate: jest.Mock };
  let aiService: { processInboundMessage: jest.Mock };

  const WEBHOOK_SECRET = 'test-webhook-secret';

  function signPayload(payload: any, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
  }

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          WEBHOOK_SECRET,
          WHATSAPP_VERIFY_TOKEN: 'test-verify-token',
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      }),
    };

    prisma = createMockPrisma();
    customerService = { findOrCreateByPhone: jest.fn() };
    conversationService = { findOrCreate: jest.fn() };
    inboxGateway = { notifyNewMessage: jest.fn(), notifyConversationUpdate: jest.fn() };
    aiService = { processInboundMessage: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CustomerService, useValue: customerService },
        { provide: ConversationService, useValue: conversationService },
        { provide: InboxGateway, useValue: inboxGateway },
        { provide: MessagingService, useValue: { getProvider: jest.fn(), getMockProvider: jest.fn() } },
        { provide: ConfigService, useValue: configService },
        { provide: AiService, useValue: aiService },
      ],
    }).compile();

    controller = module.get(WebhookController);
  });

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

      await expect(
        controller.inbound(body as any, undefined),
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should reject requests with wrong signature', async () => {
      const body = { from: '+1234567890', body: 'test', externalId: 'ext1' };

      await expect(
        controller.inbound(body as any, 'wrong-signature'),
      ).rejects.toThrow('Invalid webhook signature');
    });

    it('should accept requests with valid signature', async () => {
      const body = { from: '+1234567890', body: 'test', externalId: 'ext1' };
      const signature = signPayload(body, WEBHOOK_SECRET);

      // Will throw because of missing business, but that's after signature check
      await expect(
        controller.inbound(body as any, signature),
      ).rejects.toThrow('Business not found');
    });
  });

  describe('WhatsApp webhook verification', () => {
    it('should return challenge for valid verify token', () => {
      const result = controller.whatsappVerify('subscribe', 'test-verify-token', '12345');
      expect(result).toBe(12345);
    });

    it('should reject invalid verify token', () => {
      expect(() =>
        controller.whatsappVerify('subscribe', 'wrong-token', '12345'),
      ).toThrow('Webhook verification failed');
    });

    it('should reject non-subscribe mode', () => {
      expect(() =>
        controller.whatsappVerify('unsubscribe', 'test-verify-token', '12345'),
      ).toThrow('Webhook verification failed');
    });
  });

  describe('Security enforcement', () => {
    it('should reject unsigned requests even in development (no dev bypass)', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_SECRET') return undefined;
        if (key === 'NODE_ENV') return 'development';
        return defaultValue;
      });

      const body = { from: '+1234567890', body: 'test', externalId: 'ext1' };

      await expect(
        controller.inbound(body as any, undefined),
      ).rejects.toThrow('Invalid webhook signature');
    });
  });

  describe('WhatsApp inbound deduplication', () => {
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
      customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);
    }

    it('should process a new message successfully', async () => {
      setupHappyPath();

      const payload = buildWhatsAppPayload('wamid.123', '+1234567890', 'Hello');
      const result = await controller.whatsappInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
      expect(result.results).toEqual([
        { externalId: 'wamid.123', status: 'processed' },
      ]);
      expect(prisma.message.create).toHaveBeenCalledTimes(1);
    });

    it('should skip duplicate messages via findUnique hit', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(mockMessage);

      const payload = buildWhatsAppPayload('wamid.123', '+1234567890', 'Hello');
      const result = await controller.whatsappInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
      expect(result.results).toEqual([
        { externalId: 'wamid.123', status: 'duplicate' },
      ]);
      expect(prisma.message.create).not.toHaveBeenCalled();
    });

    it('should handle P2002 race condition gracefully', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);

      const prismaError = new Error('Unique constraint failed');
      (prismaError as any).code = 'P2002';
      (prismaError as any).meta = { target: ['externalId'] };
      (prisma.message.create as jest.Mock).mockRejectedValue(prismaError);

      const payload = buildWhatsAppPayload('wamid.123', '+1234567890', 'Hello');
      const result = await controller.whatsappInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
      expect(result.results).toEqual([
        { externalId: 'wamid.123', status: 'duplicate' },
      ]);
    });

    it('should continue processing remaining messages when one fails', async () => {
      // First message: error (business not found in production)
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
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone1' },
              messages: [
                { id: 'wamid.1', from: '+111', type: 'text', text: { body: 'msg1' }, timestamp: '1700000000' },
                { id: 'wamid.2', from: '+222', type: 'text', text: { body: 'msg2' }, timestamp: '1700000001' },
              ],
            },
          }],
        }],
      };

      const result = await controller.whatsappInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe('error');
      expect(result.results[1].status).toBe('error');
    });

    it('should return structured JSON response with per-message status', async () => {
      // First message: new, Second message: duplicate
      (prisma.message.findUnique as jest.Mock)
        .mockResolvedValueOnce(null)       // first: not found
        .mockResolvedValueOnce(mockMessage); // second: found (duplicate)
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      const payload = {
        entry: [{
          changes: [{
            value: {
              metadata: { phone_number_id: 'phone1' },
              messages: [
                { id: 'wamid.new', from: '+111', type: 'text', text: { body: 'new msg' }, timestamp: '1700000000' },
                { id: 'wamid.dup', from: '+222', type: 'text', text: { body: 'dup msg' }, timestamp: '1700000001' },
              ],
            },
          }],
        }],
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
  });
});
