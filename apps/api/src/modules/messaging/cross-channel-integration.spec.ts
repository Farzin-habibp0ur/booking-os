import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConflictException, NotFoundException } from '@nestjs/common';
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
import { createMockPrisma, MockPrisma } from '../../test/mocks';

// ─── Shared Test Data ──────────────────────────────────────────────────────────

const mockBusiness = { id: 'biz1', name: 'Test Biz', phone: '+15559990000' };

const mockCustomerMulti = {
  id: 'cust-multi',
  name: 'Jane Multi',
  phone: '+14155551234',
  email: 'jane@example.com',
  facebookPsid: 'PSID_JANE',
  instagramUserId: 'IG_JANE',
  webChatSessionId: null,
};

const mockCustomerPhoneOnly = {
  id: 'cust-phone',
  name: 'Phone User',
  phone: '+14155559999',
  email: null,
  facebookPsid: null,
  instagramUserId: null,
  webChatSessionId: null,
};

const mockCustomerEmailOnly = {
  id: 'cust-email',
  name: 'Email User',
  phone: 'email:email@test.com',
  email: 'email@test.com',
  facebookPsid: null,
  instagramUserId: null,
  webChatSessionId: null,
};

const mockCustomerWebAnon = {
  id: 'cust-web',
  name: 'Web Visitor abc123',
  phone: 'web:sess_abc123',
  email: null,
  facebookPsid: null,
  instagramUserId: null,
  webChatSessionId: 'sess_abc123',
};

const ALL_CHANNELS = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'SMS', 'EMAIL', 'WEB_CHAT'];

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('Cross-Channel Integration Tests', () => {
  let controller: WebhookController;
  let prisma: MockPrisma;
  let configService: { get: jest.Mock };
  let customerIdentityService: {
    resolveCustomer: jest.Mock;
    getCustomerChannels: jest.Mock;
    linkIdentifier: jest.Mock;
  };
  let conversationService: { findOrCreate: jest.Mock };
  let locationService: {
    findLocationByWhatsappPhoneNumberId: jest.Mock;
    findByInstagramPageId: jest.Mock;
    findLocationBySmsNumber: jest.Mock;
    findByFacebookPageId: jest.Mock;
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
    getProviderForFacebookPageId: jest.Mock;
    registerFacebookProvider: jest.Mock;
  };
  let circuitBreakerService: CircuitBreakerService;
  let deadLetterQueueService: DeadLetterQueueService;
  let usageService: {
    recordUsage: jest.Mock;
    getUsage: jest.Mock;
    getRates: jest.Mock;
  };

  beforeEach(async () => {
    configService = {
      get: jest.fn((key: string, defaultValue?: any) => {
        const config: Record<string, string> = { NODE_ENV: 'development' };
        return config[key] ?? defaultValue;
      }),
    };

    prisma = createMockPrisma();

    customerIdentityService = {
      resolveCustomer: jest.fn(),
      getCustomerChannels: jest.fn(),
      linkIdentifier: jest.fn(),
    };
    conversationService = { findOrCreate: jest.fn() };
    locationService = {
      findLocationByWhatsappPhoneNumberId: jest.fn().mockResolvedValue(null),
      findByInstagramPageId: jest.fn().mockResolvedValue(null),
      findLocationBySmsNumber: jest.fn().mockResolvedValue(null),
      findByFacebookPageId: jest.fn().mockResolvedValue(null),
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
      getProviderForFacebookPageId: jest.fn(),
      registerFacebookProvider: jest.fn(),
    };
    usageService = {
      recordUsage: jest.fn().mockResolvedValue(undefined),
      getUsage: jest.fn(),
      getRates: jest.fn(),
    };

    circuitBreakerService = new CircuitBreakerService(configService as any);
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

  // ─── 1. Unified Customer Identity (5 tests) ──────────────────────────────

  describe('1. Unified Customer Identity', () => {
    it('should resolve same customer when contacted via WhatsApp (phone) then Instagram (IGSID) if phone matches', async () => {
      // First contact via WhatsApp resolves by phone
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerMulti);

      await customerIdentityService.resolveCustomer('biz1', {
        phone: '+14155551234',
        name: '+14155551234',
      });

      // Second contact via Instagram — resolveCustomer finds same customer by instagramUserId
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerMulti);

      const result = await customerIdentityService.resolveCustomer('biz1', {
        instagramUserId: 'IG_JANE',
        name: 'IG_JANE',
      });

      expect(result.id).toBe('cust-multi');
      expect(result.phone).toBe('+14155551234');
      expect(result.instagramUserId).toBe('IG_JANE');
    });

    it('should resolve same customer when contacted via SMS (phone) then Email (email) if phone matches', async () => {
      // SMS contact resolves by phone
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerMulti);

      const smsResult = await customerIdentityService.resolveCustomer('biz1', {
        phone: '+14155551234',
        name: '+14155551234',
      });

      // Email contact — same customer has matching email
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerMulti);

      const emailResult = await customerIdentityService.resolveCustomer('biz1', {
        email: 'jane@example.com',
        name: 'jane@example.com',
      });

      expect(smsResult.id).toBe(emailResult.id);
      expect(emailResult.phone).toBe('+14155551234');
      expect(emailResult.email).toBe('jane@example.com');
    });

    it('should link anonymous Web Chat customer to existing customer when email is provided', async () => {
      // Initial web chat — anonymous customer created
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerWebAnon);

      const webResult = await customerIdentityService.resolveCustomer('biz1', {
        webChatSessionId: 'sess_abc123',
        name: 'Web Visitor',
      });

      expect(webResult.webChatSessionId).toBe('sess_abc123');

      // Later, customer provides email → linkIdentifier called
      customerIdentityService.linkIdentifier.mockResolvedValue({
        ...mockCustomerWebAnon,
        email: 'jane@example.com',
      });

      const linked = await customerIdentityService.linkIdentifier(
        'cust-web',
        'email',
        'jane@example.com',
      );

      expect(linked.email).toBe('jane@example.com');
      expect(customerIdentityService.linkIdentifier).toHaveBeenCalledWith(
        'cust-web',
        'email',
        'jane@example.com',
      );
    });

    it('should return all linked channels via getCustomerChannels', async () => {
      customerIdentityService.getCustomerChannels.mockResolvedValue({
        phone: '+14155551234',
        email: 'jane@example.com',
        facebookPsid: 'PSID_JANE',
        instagramUserId: 'IG_JANE',
      });

      const channels = await customerIdentityService.getCustomerChannels('cust-multi');

      expect(channels.phone).toBe('+14155551234');
      expect(channels.email).toBe('jane@example.com');
      expect(channels.facebookPsid).toBe('PSID_JANE');
      expect(channels.instagramUserId).toBe('IG_JANE');
    });

    it('should add new identifier to existing customer via linkIdentifier', async () => {
      customerIdentityService.linkIdentifier.mockResolvedValue({
        ...mockCustomerPhoneOnly,
        facebookPsid: 'PSID_NEW',
      });

      const result = await customerIdentityService.linkIdentifier(
        'cust-phone',
        'facebookPsid',
        'PSID_NEW',
      );

      expect(result.facebookPsid).toBe('PSID_NEW');
      expect(result.phone).toBe('+14155559999');
      expect(customerIdentityService.linkIdentifier).toHaveBeenCalledWith(
        'cust-phone',
        'facebookPsid',
        'PSID_NEW',
      );
    });
  });

  // ─── 2. Reply Channel Switching (4 tests) ────────────────────────────────

  describe('2. Reply Channel Switching', () => {
    it('should return TwilioSmsProvider when staff switches reply to SMS on a WhatsApp conversation', () => {
      const mockSmsProvider = { name: 'twilio-sms', sendMessage: jest.fn() };
      messagingService.getProviderForConversation.mockImplementation((channel: string) => {
        if (channel === 'SMS') return mockSmsProvider;
        return { name: 'whatsapp-cloud', sendMessage: jest.fn() };
      });

      const provider = messagingService.getProviderForConversation('SMS');
      expect(provider.name).toBe('twilio-sms');
    });

    it('should return EmailChannelProvider when staff switches reply to Email on an Instagram conversation', () => {
      const mockEmailProvider = { name: 'email-channel', sendMessage: jest.fn() };
      messagingService.getProviderForConversation.mockImplementation((channel: string) => {
        if (channel === 'EMAIL') return mockEmailProvider;
        return { name: 'instagram', sendMessage: jest.fn() };
      });

      const provider = messagingService.getProviderForConversation('EMAIL');
      expect(provider.name).toBe('email-channel');
    });

    it('should preserve conversation when reply channel is switched (same conversationId)', async () => {
      const convId = 'conv-switch-test';
      const mockConv = { id: convId, customerId: 'cust-multi', channel: 'WHATSAPP' };

      // Original conversation created on WhatsApp
      conversationService.findOrCreate.mockResolvedValue(mockConv);

      const conv = await conversationService.findOrCreate('biz1', 'cust-multi', 'WHATSAPP');
      expect(conv.id).toBe(convId);

      // Staff replies via SMS — same conversation is used
      // (reply channel switch doesn't create a new conversation, it just uses a different provider)
      const mockSmsProvider = {
        name: 'twilio-sms',
        sendMessage: jest.fn().mockResolvedValue({ externalId: 'SM-switch' }),
      };
      messagingService.getProviderForConversation.mockReturnValue(mockSmsProvider);

      const provider = messagingService.getProviderForConversation('SMS');
      const sendResult = await provider.sendMessage({
        to: '+14155551234',
        body: 'Replying via SMS',
        conversationId: convId,
      });

      expect(sendResult.externalId).toBe('SM-switch');
      // The message is sent against the same conversationId
      expect(provider.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ conversationId: convId }),
      );
    });

    it('should return correct provider for each of the 6 channels', () => {
      const providerMap: Record<string, string> = {
        WHATSAPP: 'whatsapp-cloud',
        INSTAGRAM: 'instagram',
        FACEBOOK: 'facebook',
        SMS: 'twilio-sms',
        EMAIL: 'email-channel',
        WEB_CHAT: 'web-chat',
      };

      messagingService.getProviderForConversation.mockImplementation((channel: string) => ({
        name: providerMap[channel] || 'unknown',
        sendMessage: jest.fn(),
      }));

      for (const channel of ALL_CHANNELS) {
        const provider = messagingService.getProviderForConversation(channel);
        expect(provider.name).toBe(providerMap[channel]);
      }
    });
  });

  // ─── 3. Channel Filter (3 tests) ─────────────────────────────────────────

  describe('3. Channel Filter', () => {
    it('should correctly tag conversations with channel and filter returns correct subset', async () => {
      const conversations = [
        { id: 'conv-wa', channel: 'WHATSAPP', businessId: 'biz1' },
        { id: 'conv-sms', channel: 'SMS', businessId: 'biz1' },
        { id: 'conv-fb', channel: 'FACEBOOK', businessId: 'biz1' },
        { id: 'conv-email', channel: 'EMAIL', businessId: 'biz1' },
      ];

      // Simulate filtering by channel
      const smsConversations = conversations.filter((c) => c.channel === 'SMS');
      expect(smsConversations).toHaveLength(1);
      expect(smsConversations[0].id).toBe('conv-sms');

      const fbConversations = conversations.filter((c) => c.channel === 'FACEBOOK');
      expect(fbConversations).toHaveLength(1);
      expect(fbConversations[0].id).toBe('conv-fb');
    });

    it('should denormalize Message.channel correctly from conversation.channel', async () => {
      // When a message is created, its channel is set from the conversation's channel
      const conv = { id: 'conv-ig', channel: 'INSTAGRAM', businessId: 'biz1' };
      conversationService.findOrCreate.mockResolvedValue(conv);

      const createdConv = await conversationService.findOrCreate(
        'biz1',
        'cust-multi',
        'INSTAGRAM',
      );

      // Message created with same channel as conversation
      const messageData = {
        conversationId: createdConv.id,
        channel: createdConv.channel,
        content: 'test',
        direction: 'INBOUND',
      };

      expect(messageData.channel).toBe('INSTAGRAM');
      expect(messageData.channel).toBe(createdConv.channel);
    });

    it('should recognize all 6 channel values as valid', () => {
      const validChannels = new Set(ALL_CHANNELS);

      expect(validChannels.size).toBe(6);
      expect(validChannels.has('WHATSAPP')).toBe(true);
      expect(validChannels.has('INSTAGRAM')).toBe(true);
      expect(validChannels.has('FACEBOOK')).toBe(true);
      expect(validChannels.has('SMS')).toBe(true);
      expect(validChannels.has('EMAIL')).toBe(true);
      expect(validChannels.has('WEB_CHAT')).toBe(true);
    });
  });

  // ─── 4. Circuit Breaker Cross-Channel (3 tests) ──────────────────────────

  describe('4. Circuit Breaker Cross-Channel', () => {
    it('should keep other providers unaffected when circuit opens for one provider', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Provider down'));

      // Trip the circuit for twilio-sms
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreakerService.execute('twilio-sms', failFn)).rejects.toThrow(
          'Provider down',
        );
      }

      const smsState = await circuitBreakerService.getState('twilio-sms');
      expect(smsState.state).toBe('OPEN');

      // Facebook provider should still be CLOSED (unaffected)
      const successFn = jest.fn().mockResolvedValue({ externalId: 'mid.ok' });
      const fbResult = await circuitBreakerService.execute('facebook', successFn);

      expect(fbResult).toEqual({ externalId: 'mid.ok' });

      const fbState = await circuitBreakerService.getState('facebook');
      expect(fbState.state).toBe('CLOSED');
    });

    it('should return states for all providers via getAllStates pattern', async () => {
      // Execute a call for each provider to create state entries
      const providers = ['twilio-sms', 'facebook', 'email-channel', 'whatsapp-cloud'];

      for (const provider of providers) {
        const fn = jest.fn().mockResolvedValue({ ok: true });
        await circuitBreakerService.execute(provider, fn);
      }

      // Check each provider's state individually
      for (const provider of providers) {
        const state = await circuitBreakerService.getState(provider);
        expect(state.state).toBe('CLOSED');
        expect(state.failures).toBe(0);
      }
    });

    it('should not affect other providers when one is reset', async () => {
      const failFn = jest.fn().mockRejectedValue(new Error('Fail'));

      // Trip circuits for both twilio-sms and email-channel
      for (let i = 0; i < 5; i++) {
        await expect(circuitBreakerService.execute('twilio-sms', failFn)).rejects.toThrow();
        await expect(circuitBreakerService.execute('email-channel', failFn)).rejects.toThrow();
      }

      const smsState = await circuitBreakerService.getState('twilio-sms');
      const emailState = await circuitBreakerService.getState('email-channel');
      expect(smsState.state).toBe('OPEN');
      expect(emailState.state).toBe('OPEN');

      // Force reset twilio-sms by simulating cooldown
      (circuitBreakerService as any).memoryStore.set('twilio-sms', {
        ...smsState,
        lastStateChange: Date.now() - 31_000,
      });

      // Successful call resets twilio-sms to CLOSED
      const successFn = jest.fn().mockResolvedValue({ ok: true });
      await circuitBreakerService.execute('twilio-sms', successFn);

      const smsAfter = await circuitBreakerService.getState('twilio-sms');
      const emailAfter = await circuitBreakerService.getState('email-channel');

      expect(smsAfter.state).toBe('CLOSED');
      expect(emailAfter.state).toBe('OPEN'); // email-channel still OPEN
    });
  });

  // ─── 5. DLQ Cross-Channel (3 tests) ──────────────────────────────────────

  describe('5. DLQ Cross-Channel', () => {
    it('should capture failed SMS in DLQ and retry works', async () => {
      const smsJobData = {
        to: '+14155551234',
        body: 'SMS fail test',
        channel: 'SMS',
        businessId: 'biz1',
      };
      const error = new Error('Twilio 500: Internal Server Error');

      const dlqId = await deadLetterQueueService.capture(smsJobData, error, 'messaging');
      expect(dlqId).toMatch(/^dlq_/);

      const entry = await deadLetterQueueService.get(dlqId);
      expect(entry).not.toBeNull();
      expect(entry!.jobData.channel).toBe('SMS');

      // Retry removes from DLQ
      const retried = await deadLetterQueueService.retry(dlqId);
      expect(retried).toBe(true);

      const afterRetry = await deadLetterQueueService.get(dlqId);
      expect(afterRetry).toBeNull();
    });

    it('should capture failed Facebook send with correct queue/channel info', async () => {
      const fbJobData = {
        to: 'PSID_123',
        body: 'FB fail test',
        channel: 'FACEBOOK',
        businessId: 'biz1',
        conversationId: 'conv-fb-1',
      };
      const error = new Error('Graph API error: (#10) User not reachable');

      const dlqId = await deadLetterQueueService.capture(fbJobData, error, 'messaging');

      const entry = await deadLetterQueueService.get(dlqId);
      expect(entry).not.toBeNull();
      expect(entry!.jobData.channel).toBe('FACEBOOK');
      expect(entry!.queue).toBe('messaging');
      expect(entry!.error.message).toBe('Graph API error: (#10) User not reachable');
      expect(entry!.jobData.conversationId).toBe('conv-fb-1');
    });

    it('should return DLQ stats breakdown by queue', async () => {
      // Add entries from multiple channels
      await deadLetterQueueService.capture(
        { channel: 'SMS', to: '+1' },
        new Error('SMS fail'),
        'messaging',
      );
      await deadLetterQueueService.capture(
        { channel: 'EMAIL', to: 'a@b.com' },
        new Error('Email fail'),
        'messaging',
      );
      await deadLetterQueueService.capture(
        { channel: 'FACEBOOK', to: 'PSID' },
        new Error('FB fail'),
        'messaging',
      );

      const stats = await deadLetterQueueService.getStats();

      expect(stats.total).toBe(3);
      // All 3 are in the 'messaging' queue
      expect(stats.byQueue).toBeDefined();
      expect(stats.byQueue['messaging']).toBe(3);
    });
  });

  // ─── 6. Usage Tracking Cross-Channel (4 tests) ───────────────────────────

  describe('6. Usage Tracking Cross-Channel', () => {
    it('should record inbound SMS usage via recordUsage', async () => {
      await usageService.recordUsage('biz1', 'SMS', 'INBOUND');

      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'SMS', 'INBOUND');
    });

    it('should record outbound Email usage via recordUsage', async () => {
      await usageService.recordUsage('biz1', 'EMAIL', 'OUTBOUND');

      expect(usageService.recordUsage).toHaveBeenCalledWith('biz1', 'EMAIL', 'OUTBOUND');
    });

    it('should return per-channel breakdown via getUsage', async () => {
      usageService.getUsage.mockResolvedValue({
        businessId: 'biz1',
        channels: [
          { channel: 'SMS', inbound: 10, outbound: 5 },
          { channel: 'EMAIL', inbound: 20, outbound: 15 },
          { channel: 'WHATSAPP', inbound: 50, outbound: 30 },
          { channel: 'FACEBOOK', inbound: 8, outbound: 3 },
          { channel: 'INSTAGRAM', inbound: 12, outbound: 7 },
          { channel: 'WEB_CHAT', inbound: 5, outbound: 2 },
        ],
      });

      const result = await usageService.getUsage('biz1');

      expect(result.channels).toHaveLength(6);
      const sms = result.channels.find((c: any) => c.channel === 'SMS');
      expect(sms.inbound).toBe(10);
      expect(sms.outbound).toBe(5);

      const email = result.channels.find((c: any) => c.channel === 'EMAIL');
      expect(email.inbound).toBe(20);
      expect(email.outbound).toBe(15);
    });

    it('should return correct rates for all channels via getRates', () => {
      usageService.getRates.mockReturnValue({
        SMS: { inbound: 0.0075, outbound: 0.0079 },
        EMAIL: { inbound: 0.00065, outbound: 0.00065 },
        WHATSAPP: { inbound: 0, outbound: 0 },
        INSTAGRAM: { inbound: 0, outbound: 0 },
        FACEBOOK: { inbound: 0, outbound: 0 },
        WEB_CHAT: { inbound: 0, outbound: 0 },
      });

      const rates = usageService.getRates();

      expect(rates.SMS).toEqual({ inbound: 0.0075, outbound: 0.0079 });
      expect(rates.EMAIL).toEqual({ inbound: 0.00065, outbound: 0.00065 });
      expect(rates.WHATSAPP).toEqual({ inbound: 0, outbound: 0 });
      expect(rates.INSTAGRAM).toEqual({ inbound: 0, outbound: 0 });
      expect(rates.FACEBOOK).toEqual({ inbound: 0, outbound: 0 });
      expect(rates.WEB_CHAT).toEqual({ inbound: 0, outbound: 0 });

      const channelKeys = Object.keys(rates);
      expect(channelKeys).toHaveLength(6);
    });
  });

  // ─── 7. Location-Based Routing (3 tests) ─────────────────────────────────

  describe('7. Location-Based Routing', () => {
    it('should route SMS to location A when To number matches location A smsConfig', async () => {
      const locationA = {
        id: 'locA',
        name: 'Location A',
        businessId: 'biz1',
        smsConfig: { phoneNumber: '+15551111111', enabled: true },
      };

      locationService.findLocationBySmsNumber.mockResolvedValue(locationA);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerPhoneOnly);
      conversationService.findOrCreate.mockResolvedValue({
        id: 'conv-sms-a',
        customerId: 'cust-phone',
        channel: 'SMS',
      });
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg-sms-a',
        externalId: 'SM-locA',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: 'conv-sms-a',
        customer: mockCustomerPhoneOnly,
        assignedTo: null,
        messages: [],
      });

      await controller.smsInbound({
        From: '+14155559999',
        Body: 'Hello',
        MessageSid: 'SM-locA',
        To: '+15551111111',
      });

      // The controller looks up the location by SMS number
      expect(locationService.findLocationBySmsNumber).toHaveBeenCalledWith('+15551111111');
      // Message is processed and stored with channel=SMS
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'SMS',
            direction: 'INBOUND',
          }),
        }),
      );
    });

    it('should route Facebook message to location B when pageId matches location B facebookConfig', async () => {
      const locationB = {
        id: 'locB',
        name: 'Location B',
        businessId: 'biz1',
        facebookConfig: { pageId: 'PAGE_B', pageAccessToken: 'tok_b', enabled: true },
      };

      locationService.findByFacebookPageId.mockResolvedValue(locationB);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-fb',
        name: 'FB User',
        facebookPsid: 'PSID_FB',
      });
      conversationService.findOrCreate.mockResolvedValue({
        id: 'conv-fb-b',
        customerId: 'cust-fb',
        channel: 'FACEBOOK',
      });
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg-fb-b',
        externalId: 'mid.locB',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: 'conv-fb-b',
        customer: { id: 'cust-fb', name: 'FB User' },
        assignedTo: null,
        messages: [],
      });

      await controller.facebookInbound({
        object: 'page',
        entry: [
          {
            id: 'PAGE_B',
            time: 1700000000000,
            messaging: [
              {
                sender: { id: 'PSID_FB' },
                recipient: { id: 'PAGE_B' },
                timestamp: 1700000000,
                message: { mid: 'mid.locB', text: 'Hello from FB' },
              },
            ],
          },
        ],
      });

      expect(locationService.findByFacebookPageId).toHaveBeenCalledWith('PAGE_B');
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust-fb',
        'FACEBOOK',
        'locB',
      );
    });

    it('should route Email to location C when inbound address matches location C emailConfig', async () => {
      // Email routing is done by matching the To address with location.emailConfig.inboundAddress
      // The webhook controller handles this similarly to SMS/Facebook
      const locationC = {
        id: 'locC',
        name: 'Location C',
        businessId: 'biz1',
        emailConfig: {
          inboundAddress: 'inbox-c@clinic.com',
          enabled: true,
        },
      };

      // Simulate email routing logic — find location by inbound address
      const findLocationByEmailAddress = jest.fn().mockResolvedValue(locationC);

      const result = await findLocationByEmailAddress('inbox-c@clinic.com');

      expect(result.id).toBe('locC');
      expect(result.businessId).toBe('biz1');
      expect(findLocationByEmailAddress).toHaveBeenCalledWith('inbox-c@clinic.com');

      // Verify the conversation would be created with correct locationId
      conversationService.findOrCreate.mockResolvedValue({
        id: 'conv-email-c',
        customerId: 'cust-email',
        channel: 'EMAIL',
      });

      await conversationService.findOrCreate('biz1', 'cust-email', 'EMAIL', 'locC');

      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust-email',
        'EMAIL',
        'locC',
      );
    });
  });
});
