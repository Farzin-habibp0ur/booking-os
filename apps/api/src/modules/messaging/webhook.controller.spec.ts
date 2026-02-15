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
import { createMockPrisma } from '../../test/mocks';

describe('WebhookController', () => {
  let controller: WebhookController;
  let configService: { get: jest.Mock };

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
          NODE_ENV: 'production',
        };
        return config[key] ?? defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PrismaService, useValue: createMockPrisma() },
        { provide: CustomerService, useValue: { findOrCreateByPhone: jest.fn() } },
        { provide: ConversationService, useValue: { findOrCreate: jest.fn() } },
        { provide: InboxGateway, useValue: { notifyNewMessage: jest.fn(), notifyConversationUpdate: jest.fn() } },
        { provide: MessagingService, useValue: { getProvider: jest.fn(), getMockProvider: jest.fn() } },
        { provide: ConfigService, useValue: configService },
        { provide: AiService, useValue: { processInboundMessage: jest.fn().mockResolvedValue(undefined) } },
      ],
    }).compile();

    controller = module.get(WebhookController);
  });

  describe('HMAC signature validation', () => {
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

  describe('Dev mode behavior', () => {
    it('should allow unsigned requests in development', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'WEBHOOK_SECRET') return undefined;
        if (key === 'NODE_ENV') return 'development';
        return defaultValue;
      });

      const body = { from: '+1234567890', body: 'test', externalId: 'ext1' };

      // Will proceed past signature check (will fail at business lookup)
      await expect(
        controller.inbound(body as any, undefined),
      ).rejects.toThrow('No business found');
    });
  });
});
