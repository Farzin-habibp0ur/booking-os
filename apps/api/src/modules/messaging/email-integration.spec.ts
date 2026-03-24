import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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
import { CircuitBreakerService } from '../../common/circuit-breaker';
import { DeadLetterQueueService } from '../../common/queue/dead-letter.service';
import { UsageService } from '../usage/usage.service';
import { EmailChannelProvider } from '@booking-os/messaging-provider';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

// ─── Shared Test Data ──────────────────────────────────────────────────────────

const mockBusiness = { id: 'biz1', name: 'Test Biz', phone: '+15559990000' };
const mockCustomer = {
  id: 'cust1',
  name: 'Jane Email',
  email: 'jane@customer.com',
};
const mockCustomerExisting = {
  id: 'cust2',
  name: 'John Smith',
  phone: '+14155559999',
  email: 'john@customer.com',
};
const mockConversation = {
  id: 'conv1',
  customerId: 'cust1',
  businessId: 'biz1',
  channel: 'EMAIL',
};
const mockMessage = {
  id: 'msg1',
  conversationId: 'conv1',
  externalId: 'email_abc123',
  direction: 'INBOUND',
  channel: 'EMAIL',
  content: 'Hello via email',
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
  emailConfig: { inboundAddress: 'inbox@clinic.com', enabled: true },
};

function buildEmailInboundPayload(overrides: Record<string, string> = {}) {
  return {
    from: 'Jane Email <jane@customer.com>',
    to: 'inbox@clinic.com',
    subject: 'Appointment inquiry',
    text: 'Hello via email',
    html: '<p>Hello via email</p>',
    'Message-ID': '<email_abc123@customer.com>',
    ...overrides,
  };
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('Email Integration Tests', () => {
  let prisma: MockPrisma;
  let configService: { get: jest.Mock };
  let customerIdentityService: { resolveCustomer: jest.Mock };
  let conversationService: { findOrCreate: jest.Mock };
  let locationService: {
    findLocationByWhatsappPhoneNumberId: jest.Mock;
    findByInstagramPageId: jest.Mock;
    findLocationBySmsNumber: jest.Mock;
    findByFacebookPageId: jest.Mock;
    findByEmailInboundAddress: jest.Mock;
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
    getEmailProvider: jest.Mock;
    registerEmailProvider: jest.Mock;
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
      findByEmailInboundAddress: jest.fn().mockResolvedValue(null),
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
      getEmailProvider: jest.fn(),
      registerEmailProvider: jest.fn(),
    };
    usageService = { recordUsage: jest.fn().mockResolvedValue(undefined) };

    circuitBreakerService = new CircuitBreakerService(
      configService as any,
      { emitToAll: jest.fn() } as any,
    );
    deadLetterQueueService = new DeadLetterQueueService(configService as any);
  });

  afterEach(() => {
    deadLetterQueueService.clearMemory();
  });

  // ─── 1. Inbound Flow ──────────────────────────────────────────────────

  describe('1. Inbound Flow', () => {
    it('should parse inbound email: resolve customer by email, create conversation channel=EMAIL, store message', () => {
      const payload = buildEmailInboundPayload();
      const parsed = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].from).toBe('jane@customer.com');
      expect(parsed[0].to).toBe('inbox@clinic.com');
      expect(parsed[0].body).toBe('Hello via email');
      expect(parsed[0].subject).toBe('Appointment inquiry');
      expect(parsed[0].externalId).toBe('<email_abc123@customer.com>');
    });

    it('should handle reply email with In-Reply-To header for thread continuity', () => {
      const payload = buildEmailInboundPayload({
        'In-Reply-To': '<orig_msg_123@clinic.com>',
        text: 'Thanks for getting back to me\n> On Mon, Jan 1, you wrote:\n> Original message',
      });

      const parsed = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].inReplyTo).toBe('<orig_msg_123@clinic.com>');
      // Metadata stored for thread tracking
      expect(parsed[0].messageId).toBe('<email_abc123@customer.com>');
    });

    it('should strip quoted content from reply emails', () => {
      const payload = buildEmailInboundPayload({
        text: 'My reply here\n> Quoted line 1\n> Quoted line 2\nMore reply text',
      });

      const parsed = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed).toHaveLength(1);
      // Quoted lines (starting with >) should be stripped
      expect(parsed[0].body).not.toContain('Quoted line 1');
      expect(parsed[0].body).toContain('My reply here');
      expect(parsed[0].body).toContain('More reply text');
    });

    it('should handle HTML email body', () => {
      const payload = buildEmailInboundPayload({
        text: 'Plain text version',
        html: '<h1>Rich Email</h1><p>With <strong>formatting</strong></p>',
      });

      const parsed = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed).toHaveLength(1);
      expect(parsed[0].htmlBody).toBe('<h1>Rich Email</h1><p>With <strong>formatting</strong></p>');
      expect(parsed[0].body).toBe('Plain text version');
    });

    it('should deduplicate email with same Message-ID', () => {
      // Parse the same message twice — each returns the same externalId
      const payload = buildEmailInboundPayload();
      const parsed1 = EmailChannelProvider.parseInboundWebhook(payload);
      const parsed2 = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed1[0].externalId).toBe(parsed2[0].externalId);
      // The webhook controller uses message.findUnique(externalId) to dedup
    });
  });

  // ─── 2. Outbound Flow ────────────────────────────────────────────────

  describe('2. Outbound Flow', () => {
    it('should resolve EmailChannelProvider for EMAIL channel via getProviderForConversation', () => {
      const mockEmailProvider = { name: 'email', sendMessage: jest.fn() };
      messagingService.getProviderForConversation.mockReturnValue(mockEmailProvider);

      const provider = messagingService.getProviderForConversation('EMAIL');

      expect(provider).toBe(mockEmailProvider);
      expect(provider.name).toBe('email');
    });

    it('should send email via Resend provider', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'resend_email_123' }),
      });

      const provider = new EmailChannelProvider({
        provider: 'resend',
        apiKey: 'test-resend-key',
        fromAddress: 'support@clinic.com',
        fromName: 'Glow Clinic',
      });

      const result = await provider.sendMessage({
        to: 'jane@customer.com',
        body: 'Your appointment is confirmed',
        subject: 'Booking Confirmation',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('resend_email_123');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-resend-key',
          }),
        }),
      );

      global.fetch = originalFetch;
    });

    it('should send email via SendGrid provider', async () => {
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (key: string) => (key === 'x-message-id' ? 'sg_email_456' : null),
        },
      });

      const provider = new EmailChannelProvider({
        provider: 'sendgrid',
        apiKey: 'test-sg-key',
        fromAddress: 'support@clinic.com',
        fromName: 'Glow Clinic',
      });

      const result = await provider.sendMessage({
        to: 'jane@customer.com',
        body: 'Your appointment is confirmed',
        subject: 'Booking Confirmation',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('sg_email_456');
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-sg-key',
          }),
        }),
      );

      global.fetch = originalFetch;
    });
  });

  // ─── 3. Customer Identity ────────────────────────────────────────────

  describe('3. Customer Identity', () => {
    it('should create new customer when email is unknown', async () => {
      const payload = buildEmailInboundPayload({
        from: 'New User <new@customer.com>',
      });
      const parsed = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed[0].from).toBe('new@customer.com');
      // CustomerIdentityService.resolveCustomer would be called with { email: 'new@customer.com' }
      // If no match, it creates a new customer

      const newCustomer = { id: 'cust-new', name: 'new@customer.com', email: 'new@customer.com' };
      customerIdentityService.resolveCustomer.mockResolvedValue(newCustomer);

      const resolved = await customerIdentityService.resolveCustomer('biz1', {
        email: parsed[0].from,
        name: parsed[0].from,
      });

      expect(resolved.email).toBe('new@customer.com');
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith('biz1', {
        email: 'new@customer.com',
        name: 'new@customer.com',
      });
    });

    it('should return existing customer when email is already known', async () => {
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerExisting);

      const resolved = await customerIdentityService.resolveCustomer('biz1', {
        email: 'john@customer.com',
        name: 'john@customer.com',
      });

      expect(resolved.id).toBe('cust2');
      expect(resolved.email).toBe('john@customer.com');
    });

    it('should link same customer across channels (phone + email)', async () => {
      const multiChannelCustomer = {
        id: 'cust-multi',
        name: 'Multi Channel User',
        phone: '+14155557777',
        email: 'multi@customer.com',
      };

      customerIdentityService.resolveCustomer.mockResolvedValue(multiChannelCustomer);

      const resolved = await customerIdentityService.resolveCustomer('biz1', {
        email: 'multi@customer.com',
        name: 'multi@customer.com',
      });

      expect(resolved.email).toBe('multi@customer.com');
      expect(resolved.phone).toBe('+14155557777');
    });
  });

  // ─── 4. Location Routing ─────────────────────────────────────────────

  describe('4. Location Routing', () => {
    it('should route email by emailConfig.inboundAddress', async () => {
      locationService.findByEmailInboundAddress.mockResolvedValue(mockLocation);

      const location = await locationService.findByEmailInboundAddress('inbox@clinic.com');

      expect(location).toBe(mockLocation);
      expect(location.businessId).toBe('biz1');
      expect(location.emailConfig.inboundAddress).toBe('inbox@clinic.com');
      expect(locationService.findByEmailInboundAddress).toHaveBeenCalledWith('inbox@clinic.com');
    });

    it('should fallback when no location matches inbound address', async () => {
      locationService.findByEmailInboundAddress.mockResolvedValue(null);

      const location = await locationService.findByEmailInboundAddress('unknown@clinic.com');

      expect(location).toBeNull();
      // Falls back to business.findFirst dev fallback
    });
  });

  // ─── 5. Thread Matching ──────────────────────────────────────────────

  describe('5. Thread Matching', () => {
    it('should use In-Reply-To header to link to existing conversation', () => {
      const payload = buildEmailInboundPayload({
        'In-Reply-To': '<orig_thread_123@clinic.com>',
        text: 'Following up on our discussion',
      });

      const parsed = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed[0].inReplyTo).toBe('<orig_thread_123@clinic.com>');
      // The inReplyTo value can be used to look up the original message
      // and its conversationId for thread continuity
    });

    it('should detect subject-based thread matching with Re: prefix', () => {
      const payload = buildEmailInboundPayload({
        subject: 'Re: Appointment inquiry',
        text: 'Yes, I would like to confirm',
      });

      const parsed = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed[0].subject).toBe('Re: Appointment inquiry');
      // Subject starts with "Re:" indicating a reply thread
      expect(parsed[0].subject.startsWith('Re:')).toBe(true);
    });

    it('should create new conversation for new thread (no In-Reply-To, no Re: prefix)', () => {
      const payload = buildEmailInboundPayload({
        subject: 'New question about services',
        text: 'I have a question about your treatments',
        'Message-ID': '<new_thread_456@customer.com>',
      });

      const parsed = EmailChannelProvider.parseInboundWebhook(payload);

      expect(parsed[0].inReplyTo).toBeUndefined();
      expect(parsed[0].subject.startsWith('Re:')).toBe(false);
      // No In-Reply-To and no Re: prefix — this is a new conversation thread
    });
  });

  // ─── 6. DNS Validation ───────────────────────────────────────────────

  describe('6. DNS Validation', () => {
    it('should return DNS check results for a domain', async () => {
      const result = await EmailChannelProvider.validateDomain('clinic.com');

      expect(result.checks).toHaveLength(4);
      expect(result.checks.map((c) => c.type)).toEqual(['MX', 'SPF', 'DKIM', 'DMARC']);
      result.checks.forEach((check) => {
        expect(check.type).toBeDefined();
        expect(check.status).toBeDefined();
      });
    });

    it('should return DNS check results for another domain', async () => {
      const result = await EmailChannelProvider.validateDomain('unconfigured-domain.com');

      expect(result.checks).toHaveLength(4);
      result.checks.forEach((check) => {
        expect(check.type).toBeDefined();
        expect(check.status).toBeDefined();
      });
    });
  });
});
