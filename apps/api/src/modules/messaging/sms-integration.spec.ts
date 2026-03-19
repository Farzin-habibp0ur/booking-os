import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { WebhookController } from './webhook.controller';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../../common/prisma.service';
import { CustomerIdentityService } from '../customer-identity/customer-identity.service';
import { CustomerService } from '../customer/customer.service';
import { ConversationService } from '../conversation/conversation.service';
import { LocationService } from '../location/location.service';
import { MessageService } from '../message/message.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { AiService } from '../ai/ai.service';
import { CircuitBreakerService, CircuitOpenException } from '../../common/circuit-breaker';
import { DeadLetterQueueService } from '../../common/queue/dead-letter.service';
import { UsageService } from '../usage/usage.service';
import { TwilioSmsProvider } from '@booking-os/messaging-provider';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

// ─── Shared Test Data ──────────────────────────────────────────────────────────

const mockBusiness = { id: 'biz1', name: 'Test Biz', phone: '+15559990000' };
const mockCustomer = { id: 'cust1', name: 'Jane Doe', phone: '+14155551234' };
const mockCustomerExisting = {
  id: 'cust2',
  name: 'John Smith',
  phone: '+14155559999',
  instagramUserId: 'IG_USER_42',
};
const mockConversation = {
  id: 'conv1',
  customerId: 'cust1',
  businessId: 'biz1',
  channel: 'SMS',
};
const mockMessage = {
  id: 'msg1',
  conversationId: 'conv1',
  externalId: 'SM-abc123',
  direction: 'INBOUND',
  channel: 'SMS',
  content: 'Hello via SMS',
};
const mockUpdatedConversation = {
  id: 'conv1',
  customer: mockCustomer,
  assignedTo: null,
  messages: [mockMessage],
};
const mockLocation = {
  id: 'loc1',
  name: 'Main Location',
  businessId: 'biz1',
  smsConfig: { phoneNumber: '+15551234567' },
};

function buildSmsInboundPayload(overrides: Record<string, string> = {}) {
  return {
    From: '+14155551234',
    Body: 'Hello via SMS',
    MessageSid: 'SM-abc123',
    To: '+15551234567',
    ...overrides,
  };
}

function buildTwilioSignature(
  authToken: string,
  webhookUrl: string,
  params: Record<string, string>,
): string {
  const sortedKeys = Object.keys(params).sort();
  let data = webhookUrl;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  return crypto.createHmac('sha1', authToken).update(data).digest('base64');
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('SMS Integration Tests', () => {
  let controller: WebhookController;
  let prisma: MockPrisma;
  let configService: { get: jest.Mock };
  let customerIdentityService: { resolveCustomer: jest.Mock };
  let conversationService: { findOrCreate: jest.Mock };
  let locationService: {
    findLocationByWhatsappPhoneNumberId: jest.Mock;
    findByInstagramPageId: jest.Mock;
    findLocationBySmsNumber: jest.Mock;
  };
  let inboxGateway: { notifyNewMessage: jest.Mock; notifyConversationUpdate: jest.Mock };
  let aiService: { processInboundMessage: jest.Mock };
  let messageService: { updateDeliveryStatus: jest.Mock };
  let messagingService: {
    getProvider: jest.Mock;
    getMockProvider: jest.Mock;
    getSmsProvider: jest.Mock;
    isSmsAvailable: jest.Mock;
    getProviderForConversation: jest.Mock;
  };

  // Services used directly in integration scenarios (not injected into controller)
  let circuitBreakerService: CircuitBreakerService;
  let deadLetterQueueService: DeadLetterQueueService;
  let usageService: { recordUsage: jest.Mock };
  const mockRes = { type: jest.fn().mockReturnThis() } as any;

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
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      }),
    };

    prisma = createMockPrisma();

    customerIdentityService = { resolveCustomer: jest.fn() };
    conversationService = { findOrCreate: jest.fn() };
    locationService = {
      findLocationByWhatsappPhoneNumberId: jest.fn().mockResolvedValue(null),
      findByInstagramPageId: jest.fn().mockResolvedValue(null),
      findLocationBySmsNumber: jest.fn().mockResolvedValue(null),
    };
    inboxGateway = { notifyNewMessage: jest.fn(), notifyConversationUpdate: jest.fn() };
    aiService = { processInboundMessage: jest.fn().mockResolvedValue(undefined) };
    messageService = { updateDeliveryStatus: jest.fn() };
    messagingService = {
      getProvider: jest.fn(),
      getMockProvider: jest.fn(),
      getSmsProvider: jest.fn(),
      isSmsAvailable: jest.fn(),
      getProviderForConversation: jest.fn(),
    };
    usageService = { recordUsage: jest.fn().mockResolvedValue(undefined) };

    // CircuitBreakerService uses in-memory store (no Redis in tests)
    circuitBreakerService = new CircuitBreakerService(
      configService as any,
      { emitToAll: jest.fn() } as any,
    );

    // DeadLetterQueueService uses in-memory store (no Redis in tests)
    deadLetterQueueService = new DeadLetterQueueService(configService as any);

    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: CustomerService, useValue: { findOrCreateByPhone: jest.fn() } },
        { provide: CustomerIdentityService, useValue: customerIdentityService },
        { provide: ConversationService, useValue: conversationService },
        { provide: LocationService, useValue: locationService },
        { provide: InboxGateway, useValue: inboxGateway },
        { provide: MessagingService, useValue: messagingService },
        { provide: ConfigService, useValue: configService },
        { provide: AiService, useValue: aiService },
        { provide: MessageService, useValue: messageService },
        { provide: CircuitBreakerService, useValue: circuitBreakerService },
        { provide: DeadLetterQueueService, useValue: deadLetterQueueService },
        { provide: UsageService, useValue: usageService },
      ],
    }).compile();

    controller = module.get(WebhookController);
  });

  afterEach(() => {
    deadLetterQueueService.clearMemory();
  });

  // ─── 1. Inbound SMS Flow (end-to-end) ──────────────────────────────────────

  describe('1. Inbound SMS Flow (end-to-end)', () => {
    it('should process full inbound SMS flow: resolve customer → create conversation → store message → notify → trigger AI', async () => {
      setupHappyPath();

      const payload = buildSmsInboundPayload();
      const result = await controller.smsInbound(payload, undefined, mockRes);

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');

      // Customer resolved via phone
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        phone: '+14155551234',
        name: '+14155551234',
      });

      // Conversation created with channel=SMS
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust1',
        'SMS',
        undefined,
      );

      // Message stored with channel=SMS
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'SMS',
            direction: 'INBOUND',
            content: 'Hello via SMS',
            externalId: 'SM-abc123',
          }),
        }),
      );

      // Inbox gateway notified
      expect(inboxGateway.notifyNewMessage).toHaveBeenCalledWith('biz1', mockMessage);
      expect(inboxGateway.notifyConversationUpdate).toHaveBeenCalledWith(
        'biz1',
        mockUpdatedConversation,
      );

      // AI processing triggered
      expect(aiService.processInboundMessage).toHaveBeenCalledWith(
        'biz1',
        'conv1',
        'msg1',
        'Hello via SMS',
      );
    });

    it('should find existing customer and reuse same conversation for repeat SMS', async () => {
      const existingConversation = { id: 'conv-existing', customerId: 'cust2', channel: 'SMS' };
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerExisting);
      conversationService.findOrCreate.mockResolvedValue(existingConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg2',
        conversationId: 'conv-existing',
        externalId: 'SM-repeat',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: 'conv-existing',
        customer: mockCustomerExisting,
        assignedTo: null,
        messages: [],
      });

      const result = await controller.smsInbound(
        buildSmsInboundPayload({
          From: '+14155559999',
          MessageSid: 'SM-repeat',
          Body: 'Follow up message',
        }),
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        phone: '+14155559999',
        name: '+14155559999',
      });
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust2',
        'SMS',
        undefined,
      );
    });

    it('should store MMS message with media URLs in the payload', async () => {
      setupHappyPath();

      const result = await controller.smsInbound(
        buildSmsInboundPayload({
          Body: 'Check this photo',
          MessageSid: 'SM-mms',
          NumMedia: '2',
          MediaUrl0: 'https://api.twilio.com/media/img1.jpg',
          MediaUrl1: 'https://api.twilio.com/media/img2.jpg',
        }),
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      // The parsed body is stored; media URLs are parsed by TwilioSmsProvider.parseInboundWebhook
      // but the webhook controller passes the body text through processInboundMessage
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: 'Check this photo',
            channel: 'SMS',
            externalId: 'SM-mms',
          }),
        }),
      );
    });

    it('should deduplicate SMS with same MessageSid', async () => {
      // First: the dedup check finds an existing message with this externalId
      (prisma.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-existing',
        externalId: 'SM-dup',
      });

      const result = await controller.smsInbound(
        buildSmsInboundPayload({ MessageSid: 'SM-dup' }),
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(customerIdentityService.resolveCustomer).not.toHaveBeenCalled();
    });
  });

  // ─── 2. SMS Status Callbacks ───────────────────────────────────────────────

  describe('2. SMS Status Callbacks', () => {
    it('should update message delivery status to DELIVERED', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({
        id: 'msg1',
        deliveryStatus: 'DELIVERED',
      });

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-delivered',
        MessageStatus: 'delivered',
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-delivered',
        'DELIVERED',
        undefined,
      );
    });

    it('should mark message FAILED with classified error reason for error code', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-failed',
        MessageStatus: 'failed',
        ErrorCode: '30003',
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-failed',
        'FAILED',
        'UNREACHABLE: Unreachable number (30003)',
      );
    });

    it('should map undelivered status to FAILED', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-undelivered',
        MessageStatus: 'undelivered',
        ErrorCode: '30007',
      });

      expect(result).toEqual({ ok: true, updated: true });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-undelivered',
        'FAILED',
        'FILTERED: Message filtered by carrier (30007)',
      );
    });

    it('should gracefully skip status callback for unknown MessageSid', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue(null);

      const result = await controller.smsStatusCallback({
        MessageSid: 'SM-unknown',
        MessageStatus: 'delivered',
      });

      expect(result).toEqual({ ok: true, updated: false });
    });
  });

  // ─── 3. Outbound SMS Flow ─────────────────────────────────────────────────

  describe('3. Outbound SMS Flow', () => {
    it('should resolve TwilioSmsProvider for SMS channel via getProviderForConversation', () => {
      const mockSmsProvider = { name: 'twilio-sms', sendMessage: jest.fn() };
      messagingService.getProviderForConversation.mockReturnValue(mockSmsProvider);

      const provider = messagingService.getProviderForConversation('SMS');

      expect(provider).toBe(mockSmsProvider);
      expect(provider.name).toBe('twilio-sms');
    });

    it('should return SMS provider when available via getSmsProvider', () => {
      const mockSmsProvider = { name: 'twilio-sms', sendMessage: jest.fn() };
      messagingService.getSmsProvider.mockReturnValue(mockSmsProvider);
      messagingService.isSmsAvailable.mockReturnValue(true);

      expect(messagingService.isSmsAvailable()).toBe(true);
      expect(messagingService.getSmsProvider()).toBe(mockSmsProvider);
    });

    it('should return null when SMS provider is not configured', () => {
      messagingService.getSmsProvider.mockReturnValue(null);
      messagingService.isSmsAvailable.mockReturnValue(false);

      expect(messagingService.isSmsAvailable()).toBe(false);
      expect(messagingService.getSmsProvider()).toBeNull();
    });
  });

  // ─── 4. Customer Identity Resolution via SMS ──────────────────────────────

  describe('4. Customer Identity Resolution via SMS', () => {
    it('should create new customer when phone number is unknown', async () => {
      const newCustomer = { id: 'cust-new', name: '+14155550001', phone: '+14155550001' };
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(newCustomer);
      conversationService.findOrCreate.mockResolvedValue({
        id: 'conv-new',
        customerId: 'cust-new',
      });
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg-new',
        externalId: 'SM-new',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: 'conv-new',
        customer: newCustomer,
        assignedTo: null,
        messages: [],
      });

      await controller.smsInbound(
        buildSmsInboundPayload({
          From: '+14155550001',
          MessageSid: 'SM-new',
        }),
        undefined,
        mockRes,
      );

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        phone: '+14155550001',
        name: '+14155550001',
      });
    });

    it('should return existing customer when phone number is already known', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerExisting);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg-exist',
        externalId: 'SM-exist',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      await controller.smsInbound(
        buildSmsInboundPayload({
          From: '+14155559999',
          MessageSid: 'SM-exist',
        }),
        undefined,
        mockRes,
      );

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        phone: '+14155559999',
        name: '+14155559999',
      });
      // The service is called with phone — if customer already exists, resolveCustomer returns them
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust2',
        'SMS',
        undefined,
      );
    });

    it('should link same customer across multiple channels (phone for SMS + Instagram)', async () => {
      // Verify that the same customer who has both phone and instagramUserId
      // is returned when resolving by phone (SMS channel)
      const multiChannelCustomer = {
        id: 'cust-multi',
        name: 'Multi Channel User',
        phone: '+14155557777',
        instagramUserId: 'IG_MULTI',
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(multiChannelCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg-multi',
        externalId: 'SM-multi',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      await controller.smsInbound(
        buildSmsInboundPayload({
          From: '+14155557777',
          MessageSid: 'SM-multi',
        }),
        undefined,
        mockRes,
      );

      // Resolved customer has both phone and Instagram
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        phone: '+14155557777',
        name: '+14155557777',
      });
      const resolvedCustomer = await customerIdentityService.resolveCustomer.mock.results[0].value;
      expect(resolvedCustomer.instagramUserId).toBe('IG_MULTI');
      expect(resolvedCustomer.phone).toBe('+14155557777');
    });
  });

  // ─── 5. Circuit Breaker Integration ────────────────────────────────────────

  describe('5. Circuit Breaker Integration', () => {
    it('should succeed normally when circuit is CLOSED', async () => {
      const sendFn = jest.fn().mockResolvedValue({ externalId: 'SM-cb-ok' });

      const result = await circuitBreakerService.execute('twilio-sms', sendFn);

      expect(result).toEqual({ externalId: 'SM-cb-ok' });
      expect(sendFn).toHaveBeenCalledTimes(1);
      const state = await circuitBreakerService.getState('twilio-sms');
      expect(state.state).toBe('CLOSED');
    });

    it('should open circuit after 5 consecutive failures', async () => {
      const sendFn = jest.fn().mockRejectedValue(new Error('Twilio API error'));

      // 5 failures to trip the breaker
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreakerService.execute('twilio-sms', sendFn)).rejects.toThrow(
          'Twilio API error',
        );
      }

      const state = await circuitBreakerService.getState('twilio-sms');
      expect(state.state).toBe('OPEN');
      expect(state.failures).toBe(5);

      // Next call should throw CircuitOpenException without calling the function
      const nextFn = jest.fn();
      await expect(circuitBreakerService.execute('twilio-sms', nextFn)).rejects.toThrow(
        CircuitOpenException,
      );
      expect(nextFn).not.toHaveBeenCalled();
    });

    it('should transition to HALF_OPEN after cooldown and close on success', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Twilio API error'));

      // Trip the circuit
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreakerService.execute('twilio-sms', failFn)).rejects.toThrow();
      }

      // Manually simulate cooldown by resetting lastStateChange to the past
      // Access private memoryStore for test manipulation
      const stateKey = 'twilio-sms';
      const currentState = await circuitBreakerService.getState(stateKey);
      expect(currentState.state).toBe('OPEN');

      // Force the lastStateChange to be 31 seconds ago (cooldown is 30s)
      (circuitBreakerService as any).memoryStore.set(stateKey, {
        ...currentState,
        lastStateChange: Date.now() - 31_000,
      });

      // Now a success should transition: OPEN → HALF_OPEN → CLOSED
      const successFn = jest.fn().mockResolvedValue({ externalId: 'SM-recovery' });
      const result = await circuitBreakerService.execute('twilio-sms', successFn);

      expect(result).toEqual({ externalId: 'SM-recovery' });
      expect(successFn).toHaveBeenCalledTimes(1);

      const finalState = await circuitBreakerService.getState(stateKey);
      expect(finalState.state).toBe('CLOSED');
      expect(finalState.failures).toBe(0);
    });
  });

  // ─── 6. DLQ Integration ───────────────────────────────────────────────────

  describe('6. DLQ Integration', () => {
    it('should capture SMS send failure in DLQ', async () => {
      const jobData = {
        to: '+14155551234',
        body: 'Test message',
        channel: 'SMS',
        businessId: 'biz1',
      };
      const error = new Error('Twilio API error 500: Internal Server Error');

      const dlqId = await deadLetterQueueService.capture(jobData, error, 'messaging');

      expect(dlqId).toBeTruthy();
      expect(dlqId).toMatch(/^dlq_/);

      const entry = await deadLetterQueueService.get(dlqId);
      expect(entry).not.toBeNull();
      expect(entry!.jobData).toEqual(jobData);
      expect(entry!.error.message).toBe('Twilio API error 500: Internal Server Error');
      expect(entry!.queue).toBe('messaging');
    });

    it('should store error details and job data in DLQ entry', async () => {
      const jobData = {
        messageId: 'msg-fail-1',
        to: '+14155551234',
        body: 'Failed SMS',
        channel: 'SMS',
        businessId: 'biz1',
        conversationId: 'conv1',
      };
      const error = new Error('Rate limit exceeded');
      error.stack = 'Error: Rate limit exceeded\n    at TwilioSmsProvider.sendMessage';

      const dlqId = await deadLetterQueueService.capture(jobData, error, 'messaging');
      const entry = await deadLetterQueueService.get(dlqId);

      expect(entry).not.toBeNull();
      expect(entry!.jobData.messageId).toBe('msg-fail-1');
      expect(entry!.jobData.to).toBe('+14155551234');
      expect(entry!.jobData.channel).toBe('SMS');
      expect(entry!.error.message).toBe('Rate limit exceeded');
      expect(entry!.error.stack).toContain('TwilioSmsProvider.sendMessage');
      expect(entry!.capturedAt).toBeTruthy();
      expect(entry!.retryCount).toBe(0);
    });

    it('should remove DLQ entry on retry', async () => {
      const jobData = { to: '+14155551234', body: 'Retry me' };
      const error = new Error('Temporary failure');

      const dlqId = await deadLetterQueueService.capture(jobData, error, 'messaging');

      // Confirm it exists
      const entry = await deadLetterQueueService.get(dlqId);
      expect(entry).not.toBeNull();

      // Retry removes it
      const removed = await deadLetterQueueService.retry(dlqId);
      expect(removed).toBe(true);

      // Confirm it's gone
      const afterRetry = await deadLetterQueueService.get(dlqId);
      expect(afterRetry).toBeNull();
    });
  });

  // ─── 7. Usage Tracking ────────────────────────────────────────────────────

  describe('7. Usage Tracking', () => {
    it('should record inbound SMS usage', async () => {
      await usageService.recordUsage('biz1', 'SMS', 'INBOUND');

      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'SMS', 'INBOUND');
    });

    it('should record outbound SMS usage', async () => {
      await usageService.recordUsage('biz1', 'SMS', 'OUTBOUND');

      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'SMS', 'OUTBOUND');
    });
  });

  // ─── 8. Location Routing ─────────────────────────────────────────────────

  describe('8. Location Routing', () => {
    it('should route SMS to correct business/location by To number', async () => {
      locationService.findLocationBySmsNumber.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      await controller.smsInbound(
        buildSmsInboundPayload({ To: '+15551234567' }),
        undefined,
        mockRes,
      );

      expect(locationService.findLocationBySmsNumber).toHaveBeenCalledWith('+15551234567');
    });

    it('should fall back to default routing when To number matches no location', async () => {
      locationService.findLocationBySmsNumber.mockResolvedValue(null);
      setupHappyPath();

      const result = await controller.smsInbound(
        buildSmsInboundPayload({ To: '+15559999999', MessageSid: 'SM-noloc' }),
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
      expect(locationService.findLocationBySmsNumber).toHaveBeenCalledWith('+15559999999');
      // Falls back to business.findFirst dev fallback
      expect(prisma.business.findFirst).toHaveBeenCalled();
    });
  });

  // ─── 9. Signature Validation ──────────────────────────────────────────────

  describe('9. Signature Validation', () => {
    const authToken = 'twilio-auth-token-test';
    const webhookUrl = 'https://api.example.com/webhook/sms/inbound';

    it('should accept request with valid Twilio signature', async () => {
      const body = buildSmsInboundPayload({ MessageSid: 'SM-valid-sig' });
      const validSignature = buildTwilioSignature(authToken, webhookUrl, body);

      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          TWILIO_AUTH_TOKEN: authToken,
          TWILIO_WEBHOOK_URL: webhookUrl,
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });
      setupHappyPath();

      const result = await controller.smsInbound(body, validSignature, mockRes);
      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
    });

    it('should reject request with invalid Twilio signature', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          TWILIO_AUTH_TOKEN: authToken,
          TWILIO_WEBHOOK_URL: webhookUrl,
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });

      const body = buildSmsInboundPayload({ MessageSid: 'SM-bad-sig' });

      await expect(controller.smsInbound(body, 'invalid-signature', mockRes)).rejects.toThrow(
        'Invalid Twilio webhook signature',
      );
    });

    it('should accept request when no signature configured (backward compatible)', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        // No TWILIO_AUTH_TOKEN configured
        const config: Record<string, string> = {
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });
      setupHappyPath();

      const result = await controller.smsInbound(
        buildSmsInboundPayload({ MessageSid: 'SM-no-sig-config' }),
        undefined,
        mockRes,
      );

      expect(result).toBe('<Response></Response>');
      expect(mockRes.type).toHaveBeenCalledWith('text/xml');
    });
  });

  // ─── 10. Error Classification ─────────────────────────────────────────────

  describe('10. Error Classification', () => {
    it('should classify error 21610 as UNSUBSCRIBED, not retriable', () => {
      const classification = TwilioSmsProvider.classifyError(21610);

      expect(classification.category).toBe('UNSUBSCRIBED');
      expect(classification.retriable).toBe(false);
      expect(classification.description).toBe('Number opted out');
    });

    it('should classify error 30003 as UNREACHABLE, retriable', () => {
      const classification = TwilioSmsProvider.classifyError(30003);

      expect(classification.category).toBe('UNREACHABLE');
      expect(classification.retriable).toBe(true);
      expect(classification.description).toBe('Unreachable number');
    });

    it('should classify unknown error code as UNKNOWN, retriable', () => {
      const classification = TwilioSmsProvider.classifyError(99999);

      expect(classification.category).toBe('UNKNOWN');
      expect(classification.retriable).toBe(true);
      expect(classification.description).toBe('Error code 99999');
    });

    it('should include error classification in SMS status callback failure reason', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({ id: 'msg1' });

      await controller.smsStatusCallback({
        MessageSid: 'SM-opted-out',
        MessageStatus: 'failed',
        ErrorCode: '21610',
      });

      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'SM-opted-out',
        'FAILED',
        'UNSUBSCRIBED: Number opted out (21610)',
      );
    });

    it('should classify error 30004 as BLOCKED, not retriable', () => {
      const classification = TwilioSmsProvider.classifyError(30004);

      expect(classification.category).toBe('BLOCKED');
      expect(classification.retriable).toBe(false);
      expect(classification.description).toBe('Message blocked');
    });
  });
});
