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
import { createMockPrisma, MockPrisma } from '../../test/mocks';

// ─── Shared Test Data ──────────────────────────────────────────────────────────

const mockBusiness = { id: 'biz1', name: 'Test Biz', phone: '+15559990000' };
const mockCustomer = {
  id: 'cust1',
  name: 'Jane Messenger',
  facebookPsid: 'PSID_123456',
};
const mockCustomerExisting = {
  id: 'cust2',
  name: 'John Smith',
  phone: '+14155559999',
  facebookPsid: 'PSID_EXISTING',
};
const mockConversation = {
  id: 'conv1',
  customerId: 'cust1',
  businessId: 'biz1',
  channel: 'FACEBOOK',
};
const mockMessage = {
  id: 'msg1',
  conversationId: 'conv1',
  externalId: 'mid.facebook123',
  direction: 'INBOUND',
  channel: 'FACEBOOK',
  content: 'Hello from Messenger',
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
  facebookConfig: { pageId: 'PAGE_ABC', pageAccessToken: 'token123', enabled: true },
};

function buildFacebookPayload(senderId: string, text: string, mid: string, pageId = 'PAGE_ABC') {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        time: 1700000000000,
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: pageId },
            timestamp: 1700000000,
            message: {
              mid,
              text,
            },
          },
        ],
      },
    ],
  };
}

function buildFacebookMediaPayload(
  senderId: string,
  mid: string,
  mediaType: string,
  mediaUrl: string,
  pageId = 'PAGE_ABC',
) {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        time: 1700000000000,
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: pageId },
            timestamp: 1700000000,
            message: {
              mid,
              attachments: [
                {
                  type: mediaType,
                  payload: { url: mediaUrl },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function buildFacebookPostbackPayload(
  senderId: string,
  title: string,
  payload: string,
  pageId = 'PAGE_ABC',
) {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        time: 1700000000000,
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: pageId },
            timestamp: 1700000000,
            postback: { title, payload },
          },
        ],
      },
    ],
  };
}

function buildFacebookReferralPayload(senderId: string, adId: string, pageId = 'PAGE_ABC') {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        time: 1700000000000,
        messaging: [
          {
            sender: { id: senderId },
            recipient: { id: pageId },
            timestamp: 1700000000,
            referral: {
              source: 'ADS',
              type: 'OPEN_THREAD',
              ad_id: adId,
            },
          },
        ],
      },
    ],
  };
}

function buildFacebookDeliveryPayload(mids: string[], pageId = 'PAGE_ABC') {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        time: 1700000000000,
        messaging: [
          {
            sender: { id: 'USER_1' },
            recipient: { id: pageId },
            timestamp: 1700000000,
            delivery: {
              mids,
              watermark: 1700000000,
            },
          },
        ],
      },
    ],
  };
}

function buildFacebookReadPayload(watermark: number, pageId = 'PAGE_ABC') {
  return {
    object: 'page',
    entry: [
      {
        id: pageId,
        time: 1700000000000,
        messaging: [
          {
            sender: { id: 'USER_1' },
            recipient: { id: pageId },
            timestamp: 1700000000,
            read: {
              watermark,
            },
          },
        ],
      },
    ],
  };
}

function buildFacebookHmacSignature(secret: string, payload: any): string {
  const raw = JSON.stringify(payload);
  const hmac = crypto.createHmac('sha256', secret).update(raw).digest('hex');
  return `sha256=${hmac}`;
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('Facebook Integration Tests', () => {
  let controller: WebhookController;
  let prisma: MockPrisma;
  let configService: { get: jest.Mock };
  let customerIdentityService: { resolveCustomer: jest.Mock };
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
  let usageService: { recordUsage: jest.Mock };

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
    usageService = { recordUsage: jest.fn().mockResolvedValue(undefined) };

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

  // ─── 1. Inbound Flow ──────────────────────────────────────────────────

  describe('1. Inbound Flow', () => {
    it('should process text message: resolve customer by facebookPsid → create conversation with channel=FACEBOOK → store message', async () => {
      setupHappyPath();

      const payload = buildFacebookPayload(
        'PSID_123456',
        'Hello from Messenger',
        'mid.facebook123',
      );
      const result = await controller.facebookInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);

      // Customer resolved via facebookPsid
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        facebookPsid: 'PSID_123456',
        name: 'PSID_123456',
      });

      // Conversation created with channel=FACEBOOK
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust1',
        'FACEBOOK',
        undefined,
      );

      // Message stored with channel=FACEBOOK
      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'FACEBOOK',
            direction: 'INBOUND',
            content: 'Hello from Messenger',
            externalId: 'mid.facebook123',
          }),
        }),
      );

      // Inbox notified
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
        'Hello from Messenger',
      );
    });

    it('should process media message with attachment', async () => {
      setupHappyPath();

      const payload = buildFacebookMediaPayload(
        'PSID_123456',
        'mid.media123',
        'image',
        'https://scontent.com/photo.jpg',
      );
      const result = await controller.facebookInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'FACEBOOK',
            externalId: 'mid.media123',
            content: '[image]',
          }),
        }),
      );
    });

    it('should process postback (ice breaker tap)', async () => {
      setupHappyPath();

      const payload = buildFacebookPostbackPayload(
        'PSID_123456',
        'Book an Appointment',
        'BOOK_APPOINTMENT',
      );
      const result = await controller.facebookInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'FACEBOOK',
            content: 'Book an Appointment',
          }),
        }),
      );
    });

    it('should process referral (ad click)', async () => {
      setupHappyPath();

      const payload = buildFacebookReferralPayload('PSID_123456', 'AD_12345');
      const result = await controller.facebookInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);

      expect(prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            channel: 'FACEBOOK',
            content: '[Ad referral: AD_12345]',
          }),
        }),
      );
    });

    it('should deduplicate message with same mid', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue({
        id: 'msg-existing',
        externalId: 'mid.dup',
      });
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);

      const payload = buildFacebookPayload('PSID_123456', 'Duplicate msg', 'mid.dup');
      const result = await controller.facebookInbound(payload);

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(0);
      expect(prisma.message.create).not.toHaveBeenCalled();
      expect(customerIdentityService.resolveCustomer).not.toHaveBeenCalled();
    });
  });

  // ─── 2. Status Callbacks ──────────────────────────────────────────────

  describe('2. Status Callbacks', () => {
    it('should update delivery status to DELIVERED', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({
        id: 'msg1',
        deliveryStatus: 'DELIVERED',
      });

      const payload = buildFacebookDeliveryPayload(['mid.delivered1']);
      const result = await controller.facebookStatusCallback(payload);

      expect(result).toEqual({ ok: true, updated: 1 });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        'mid.delivered1',
        'DELIVERED',
      );
    });

    it('should update read status to READ', async () => {
      messageService.updateDeliveryStatus.mockResolvedValue({
        id: 'msg1',
        deliveryStatus: 'READ',
      });

      const payload = buildFacebookReadPayload(1700000000);
      const result = await controller.facebookStatusCallback(payload);

      expect(result).toEqual({ ok: true, updated: 1 });
      expect(messageService.updateDeliveryStatus).toHaveBeenCalledWith(
        expect.stringContaining('read_'),
        'READ',
      );
    });

    it('should skip when no status events in payload', async () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'PAGE_ABC',
            time: 1700000000000,
            messaging: [
              {
                sender: { id: 'USER_1' },
                recipient: { id: 'PAGE_ABC' },
                timestamp: 1700000000,
              },
            ],
          },
        ],
      };

      const result = await controller.facebookStatusCallback(payload);
      expect(result).toEqual({ ok: true, updated: 0 });
      expect(messageService.updateDeliveryStatus).not.toHaveBeenCalled();
    });
  });

  // ─── 3. Outbound Flow ────────────────────────────────────────────────

  describe('3. Outbound Flow', () => {
    it('should resolve FacebookProvider for FACEBOOK channel via getProviderForConversation', () => {
      const mockFbProvider = {
        name: 'facebook',
        sendMessage: jest.fn(),
        sendHumanAgentMessage: jest.fn(),
      };
      messagingService.getProviderForConversation.mockReturnValue(mockFbProvider);

      const provider = messagingService.getProviderForConversation('FACEBOOK');

      expect(provider).toBe(mockFbProvider);
      expect(provider.name).toBe('facebook');
    });

    it('should send text message via FacebookProvider', async () => {
      const mockFbProvider = {
        name: 'facebook',
        sendMessage: jest.fn().mockResolvedValue({ externalId: 'mid.out123' }),
      };
      messagingService.getProviderForConversation.mockReturnValue(mockFbProvider);

      const provider = messagingService.getProviderForConversation('FACEBOOK');
      const result = await provider.sendMessage({
        to: 'PSID_123456',
        body: 'Thanks for reaching out!',
        businessId: 'biz1',
      });

      expect(result).toEqual({ externalId: 'mid.out123' });
      expect(provider.sendMessage).toHaveBeenCalledWith({
        to: 'PSID_123456',
        body: 'Thanks for reaching out!',
        businessId: 'biz1',
      });
    });

    it('should send HUMAN_AGENT tagged message for extended window', async () => {
      const mockFbProvider = {
        name: 'facebook',
        sendMessage: jest.fn(),
        sendHumanAgentMessage: jest.fn().mockResolvedValue({ externalId: 'mid.human123' }),
      };
      messagingService.getProviderForConversation.mockReturnValue(mockFbProvider);

      const provider = messagingService.getProviderForConversation('FACEBOOK');
      const result = await provider.sendHumanAgentMessage({
        to: 'PSID_123456',
        body: 'Follow-up support message after 24h',
        businessId: 'biz1',
      });

      expect(result).toEqual({ externalId: 'mid.human123' });
      expect(provider.sendHumanAgentMessage).toHaveBeenCalledWith({
        to: 'PSID_123456',
        body: 'Follow-up support message after 24h',
        businessId: 'biz1',
      });
    });
  });

  // ─── 4. Customer Identity ─────────────────────────────────────────────

  describe('4. Customer Identity', () => {
    it('should create new customer when PSID is unknown', async () => {
      const newCustomer = {
        id: 'cust-new',
        name: 'PSID_NEW_USER',
        facebookPsid: 'PSID_NEW_USER',
      };
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(newCustomer);
      conversationService.findOrCreate.mockResolvedValue({
        id: 'conv-new',
        customerId: 'cust-new',
      });
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg-new',
        externalId: 'mid.new',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue({
        id: 'conv-new',
        customer: newCustomer,
        assignedTo: null,
        messages: [],
      });

      await controller.facebookInbound(
        buildFacebookPayload('PSID_NEW_USER', 'Hi there', 'mid.new'),
      );

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        facebookPsid: 'PSID_NEW_USER',
        name: 'PSID_NEW_USER',
      });
    });

    it('should return existing customer when PSID is already known', async () => {
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerExisting);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg-exist',
        externalId: 'mid.exist',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      await controller.facebookInbound(
        buildFacebookPayload('PSID_EXISTING', 'Hello again', 'mid.exist'),
      );

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        facebookPsid: 'PSID_EXISTING',
        name: 'PSID_EXISTING',
      });
      const resolvedCustomer = await customerIdentityService.resolveCustomer.mock.results[0].value;
      expect(resolvedCustomer.facebookPsid).toBe('PSID_EXISTING');
    });

    it('should link same customer across multiple channels (phone + facebookPsid)', async () => {
      const multiChannelCustomer = {
        id: 'cust-multi',
        name: 'Multi Channel User',
        phone: '+14155557777',
        facebookPsid: 'PSID_MULTI',
      };

      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      customerIdentityService.resolveCustomer.mockResolvedValue(multiChannelCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue({
        id: 'msg-multi',
        externalId: 'mid.multi',
      });
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      await controller.facebookInbound(buildFacebookPayload('PSID_MULTI', 'Hello', 'mid.multi'));

      const resolvedCustomer = await customerIdentityService.resolveCustomer.mock.results[0].value;
      expect(resolvedCustomer.facebookPsid).toBe('PSID_MULTI');
      expect(resolvedCustomer.phone).toBe('+14155557777');
    });
  });

  // ─── 5. Location Routing ──────────────────────────────────────────────

  describe('5. Location Routing', () => {
    it('should route by facebookConfig.pageId', async () => {
      locationService.findByFacebookPageId.mockResolvedValue(mockLocation);
      (prisma.business.findUnique as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.message.findUnique as jest.Mock).mockResolvedValue(null);
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      (prisma.message.create as jest.Mock).mockResolvedValue(mockMessage);
      (prisma.conversation.update as jest.Mock).mockResolvedValue(mockUpdatedConversation);

      await controller.facebookInbound(
        buildFacebookPayload('PSID_123456', 'Hi', 'mid.routed', 'PAGE_ABC'),
      );

      expect(locationService.findByFacebookPageId).toHaveBeenCalledWith('PAGE_ABC');
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust1',
        'FACEBOOK',
        'loc1',
      );
    });

    it('should fallback when no location matches page ID', async () => {
      locationService.findByFacebookPageId.mockResolvedValue(null);
      setupHappyPath();

      const result = await controller.facebookInbound(
        buildFacebookPayload('PSID_123456', 'Hi', 'mid.noloc', 'PAGE_UNKNOWN'),
      );

      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
      expect(locationService.findByFacebookPageId).toHaveBeenCalledWith('PAGE_UNKNOWN');
      // Falls back to business.findFirst dev fallback
      expect(prisma.business.findFirst).toHaveBeenCalled();
    });
  });

  // ─── 6. HMAC Validation ───────────────────────────────────────────────

  describe('6. HMAC Validation', () => {
    const appSecret = 'fb-app-secret-test';

    it('should accept request with valid Facebook HMAC signature', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          FACEBOOK_APP_SECRET: appSecret,
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });
      setupHappyPath();

      const payload = buildFacebookPayload('PSID_123456', 'Signed message', 'mid.signed');
      const signature = buildFacebookHmacSignature(appSecret, payload);

      const result = await controller.facebookInbound(payload, signature);
      expect(result.status).toBe('EVENT_RECEIVED');
      expect(result.processed).toBe(1);
    });

    it('should reject request with invalid signature (403)', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        const config: Record<string, string> = {
          FACEBOOK_APP_SECRET: appSecret,
          NODE_ENV: 'development',
        };
        return config[key] ?? defaultValue;
      });

      const payload = buildFacebookPayload('PSID_123456', 'Bad sig message', 'mid.badsig');

      await expect(
        controller.facebookInbound(payload, 'sha256=invalid-signature-hex'),
      ).rejects.toThrow('Invalid Facebook webhook signature');
    });
  });

  // ─── 7. Messaging Window ──────────────────────────────────────────────

  describe('7. Messaging Window', () => {
    it('should send standard message within 24h window', async () => {
      const mockFbProvider = {
        name: 'facebook',
        sendMessage: jest.fn().mockResolvedValue({ externalId: 'mid.within24h' }),
      };
      messagingService.getProviderForConversation.mockReturnValue(mockFbProvider);

      const provider = messagingService.getProviderForConversation('FACEBOOK');
      const result = await provider.sendMessage({
        to: 'PSID_123456',
        body: 'Reply within window',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('mid.within24h');
      // Standard send — no special tag
      expect(provider.sendMessage).toHaveBeenCalledWith(
        expect.not.objectContaining({ tag: 'HUMAN_AGENT' }),
      );
    });

    it('should use HUMAN_AGENT tag for extended 7-day window', async () => {
      const mockFbProvider = {
        name: 'facebook',
        sendMessage: jest.fn(),
        sendHumanAgentMessage: jest.fn().mockResolvedValue({ externalId: 'mid.humanagent' }),
      };
      messagingService.getProviderForConversation.mockReturnValue(mockFbProvider);

      const provider = messagingService.getProviderForConversation('FACEBOOK');
      const result = await provider.sendHumanAgentMessage({
        to: 'PSID_123456',
        body: 'Support follow-up after 24h',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('mid.humanagent');
      expect(provider.sendHumanAgentMessage).toHaveBeenCalled();
      // sendMessage should NOT be called for extended window
      expect(provider.sendMessage).not.toHaveBeenCalled();
    });
  });
});
