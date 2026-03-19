import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { WebChatGateway } from '../../common/web-chat.gateway';
import { PrismaService } from '../../common/prisma.service';
import { CustomerIdentityService } from '../customer-identity/customer-identity.service';
import { ConversationService } from '../conversation/conversation.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { Socket } from 'socket.io';

// ─── Shared Test Data ──────────────────────────────────────────────────────────

const mockBusiness = {
  id: 'biz1',
  name: 'Test Biz',
  channelSettings: null,
};

const mockCustomer = {
  id: 'cust1',
  name: 'Alice Visitor',
  email: 'alice@test.com',
  webChatSessionId: null,
};

const mockCustomerByPhone = {
  id: 'cust2',
  name: 'Bob Caller',
  phone: '+14155551234',
  webChatSessionId: null,
};

const mockCustomerAnonymous = {
  id: 'cust-anon',
  name: 'Visitor',
  webChatSessionId: 'sess-anon',
};

const mockCustomerMultiChannel = {
  id: 'cust-multi',
  name: 'Multi User',
  phone: '+14155557777',
  email: 'multi@test.com',
  webChatSessionId: 'sess-multi',
};

const mockConversation = {
  id: 'conv1',
  customerId: 'cust1',
  businessId: 'biz1',
  channel: 'WEB_CHAT',
};

const mockMessage = {
  id: 'msg1',
  conversationId: 'conv1',
  direction: 'INBOUND',
  content: 'Hello from web chat',
  contentType: 'TEXT',
  channel: 'WEB_CHAT',
  createdAt: new Date('2026-03-19T10:00:00Z'),
};

const mockUpdatedConversation = {
  id: 'conv1',
  customer: mockCustomer,
  assignedTo: null,
  messages: [mockMessage],
};

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createMockSocket(auth: Record<string, any> = {}): Socket {
  return {
    id: `socket_${Math.random().toString(36).slice(2)}`,
    handshake: { auth },
    emit: jest.fn(),
    join: jest.fn(),
    disconnect: jest.fn(),
  } as unknown as Socket;
}

// ─── Test Suite ────────────────────────────────────────────────────────────────

describe('WebChat Integration Tests', () => {
  let gateway: WebChatGateway;

  let mockPrisma: {
    business: { findUnique: jest.Mock };
    customer: { update: jest.Mock };
    message: { create: jest.Mock };
    conversation: { update: jest.Mock; findUnique: jest.Mock };
  };
  let customerIdentityService: { resolveCustomer: jest.Mock };
  let conversationService: { findOrCreate: jest.Mock };
  let inboxGateway: {
    notifyNewMessage: jest.Mock;
    notifyConversationUpdate: jest.Mock;
    emitToBusinessRoom: jest.Mock;
  };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  /** Connect a visitor and return the connected socket + session */
  async function connectVisitor(
    authOverrides: Record<string, any> = {},
  ): Promise<{ client: Socket; session: any }> {
    const client = createMockSocket({ businessId: 'biz1', ...authOverrides });
    mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
    jwtService.sign.mockReturnValue('session-token-test');
    await gateway.handleConnection(client);
    return { client, session: (client as any).webChatSession };
  }

  /** Start a chat for a connected visitor */
  async function startChat(
    client: Socket,
    data: { name: string; email?: string; phone?: string; message?: string },
    customer = mockCustomer,
    conversation = mockConversation,
  ) {
    customerIdentityService.resolveCustomer.mockResolvedValue(customer);
    conversationService.findOrCreate.mockResolvedValue(conversation);
    if (data.message) {
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.conversation.update.mockResolvedValue({ id: conversation.id });
      mockPrisma.conversation.findUnique.mockResolvedValue(mockUpdatedConversation);
    }
    await gateway.handleChatStart(client, data);
  }

  beforeEach(async () => {
    mockPrisma = {
      business: { findUnique: jest.fn() },
      customer: { update: jest.fn() },
      message: { create: jest.fn() },
      conversation: { update: jest.fn(), findUnique: jest.fn() },
    };
    customerIdentityService = { resolveCustomer: jest.fn() };
    conversationService = { findOrCreate: jest.fn() };
    inboxGateway = {
      notifyNewMessage: jest.fn(),
      notifyConversationUpdate: jest.fn(),
      emitToBusinessRoom: jest.fn(),
    };
    jwtService = { sign: jest.fn(), verify: jest.fn() };
    configService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return 'test-jwt-secret';
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebChatGateway,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CustomerIdentityService, useValue: customerIdentityService },
        { provide: ConversationService, useValue: conversationService },
        { provide: InboxGateway, useValue: inboxGateway },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    gateway = module.get<WebChatGateway>(WebChatGateway);
    (gateway as any).server = mockServer;

    jest.clearAllMocks();
  });

  // ─── 1. End-to-End Chat Flow (5 tests) ──────────────────────────────────────

  describe('1. End-to-End Chat Flow', () => {
    it('should process full flow: connect → session token → pre-chat form → customer created → conversation created with channel=WEB_CHAT → message stored', async () => {
      // Step 1: Connect
      const { client, session } = await connectVisitor();

      expect(client.emit).toHaveBeenCalledWith(
        'session:created',
        expect.objectContaining({
          sessionToken: 'session-token-test',
          businessName: 'Test Biz',
        }),
      );
      expect(session.businessId).toBe('biz1');
      expect(session.sessionId).toBeDefined();

      // Step 2: Start chat with pre-chat form and initial message
      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv1' });
      mockPrisma.conversation.findUnique.mockResolvedValue(mockUpdatedConversation);

      await gateway.handleChatStart(client, {
        name: 'Alice Visitor',
        email: 'alice@test.com',
        message: 'Hello from web chat',
      });

      // Customer resolved
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({ name: 'Alice Visitor', email: 'alice@test.com' }),
      );

      // Conversation created with WEB_CHAT channel
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust1',
        'WEB_CHAT',
      );

      // Message stored with correct fields
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv1',
          direction: 'INBOUND',
          content: 'Hello from web chat',
          contentType: 'TEXT',
          channel: 'WEB_CHAT',
        }),
      });

      // Client notified
      expect(client.emit).toHaveBeenCalledWith('chat:started', {
        conversationId: 'conv1',
        customerId: 'cust1',
        customerName: 'Alice Visitor',
      });
    });

    it('should reuse same conversation for follow-up messages with channel=WEB_CHAT', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com', message: 'Hi' });

      // Clear mocks to track follow-up
      jest.clearAllMocks();

      // Send follow-up message
      const followUpMessage = {
        id: 'msg-follow',
        conversationId: 'conv1',
        direction: 'INBOUND',
        content: 'Follow-up question',
        contentType: 'TEXT',
        channel: 'WEB_CHAT',
        createdAt: new Date(),
      };
      mockPrisma.message.create.mockResolvedValue(followUpMessage);
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleChatMessage(client, { content: 'Follow-up question' });

      // Same conversation used
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv1',
          direction: 'INBOUND',
          content: 'Follow-up question',
          channel: 'WEB_CHAT',
        }),
      });

      // Ack sent
      expect(client.emit).toHaveBeenCalledWith('chat:message:ack', {
        messageId: 'msg-follow',
        createdAt: followUpMessage.createdAt,
      });
    });

    it('should bridge staff reply to web chat client via sendToWebChatClient', async () => {
      const { client, session } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      // Staff sends reply through the bridge
      const staffReply = {
        id: 'msg-staff',
        content: 'Thanks for reaching out!',
        createdAt: new Date(),
        senderName: 'Agent Sarah',
      };

      const result = gateway.sendToWebChatClient('conv1', staffReply);

      expect(result).toBe(true);
      expect(mockServer.to).toHaveBeenCalledWith(`webchat:${session.sessionId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('chat:reply', {
        messageId: 'msg-staff',
        content: 'Thanks for reaching out!',
        createdAt: staffReply.createdAt,
        senderName: 'Agent Sarah',
      });
    });

    it('should resume session on reconnect with valid session token — same customer and conversation', async () => {
      // Initial connection
      const { client: client1, session: session1 } = await connectVisitor();
      await startChat(client1, { name: 'Alice', email: 'alice@test.com' });

      const sessionId = session1.sessionId;

      // Disconnect
      gateway.handleDisconnect(client1);

      // Reconnect with session token
      jwtService.verify.mockReturnValue({
        sessionId,
        businessId: 'biz1',
        type: 'web-chat',
      });
      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);

      const client2 = createMockSocket({
        businessId: 'biz1',
        sessionToken: 'session-token-test',
      });
      await gateway.handleConnection(client2);

      const session2 = (client2 as any).webChatSession;

      // Same session, same customer, same conversation
      expect(session2.sessionId).toBe(sessionId);
      expect(session2.customerId).toBe('cust1');
      expect(session2.conversationId).toBe('conv1');

      // Should NOT emit session:created (resumed, not new)
      expect(client2.emit).not.toHaveBeenCalledWith('session:created', expect.anything());
    });

    it('should create customer with webChatSessionId for anonymous visitor (no email/phone)', async () => {
      const { client, session } = await connectVisitor();

      customerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-anon',
        name: 'Visitor',
        webChatSessionId: session.sessionId,
      });
      conversationService.findOrCreate.mockResolvedValue(mockConversation);

      await gateway.handleChatStart(client, { name: 'Visitor' });

      // Should use webChatSessionId as identifier
      const callArgs = customerIdentityService.resolveCustomer.mock.calls[0][1];
      expect(callArgs.webChatSessionId).toBe(session.sessionId);
      expect(callArgs.email).toBeUndefined();
      expect(callArgs.phone).toBeUndefined();
    });
  });

  // ─── 2. Pre-Chat Form Variants (3 tests) ────────────────────────────────────

  describe('2. Pre-Chat Form Variants', () => {
    it('should resolve customer by email when pre-chat form includes email', async () => {
      const { client } = await connectVisitor();

      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);

      await gateway.handleChatStart(client, {
        name: 'Alice',
        email: 'alice@test.com',
      });

      const callArgs = customerIdentityService.resolveCustomer.mock.calls[0][1];
      expect(callArgs.email).toBe('alice@test.com');
      expect(callArgs.webChatSessionId).toBeUndefined();
    });

    it('should resolve customer by phone when pre-chat form includes phone', async () => {
      const { client } = await connectVisitor();

      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerByPhone);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);

      await gateway.handleChatStart(client, {
        name: 'Bob',
        phone: '+14155551234',
      });

      const callArgs = customerIdentityService.resolveCustomer.mock.calls[0][1];
      expect(callArgs.phone).toBe('+14155551234');
      expect(callArgs.webChatSessionId).toBeUndefined();
    });

    it('should resolve customer with both email and phone — phone takes priority (both passed to resolveCustomer)', async () => {
      const { client } = await connectVisitor();

      const customerBothChannels = {
        id: 'cust-both',
        name: 'Carol',
        phone: '+14155559999',
        email: 'carol@test.com',
      };
      customerIdentityService.resolveCustomer.mockResolvedValue(customerBothChannels);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);

      await gateway.handleChatStart(client, {
        name: 'Carol',
        email: 'carol@test.com',
        phone: '+14155559999',
      });

      const callArgs = customerIdentityService.resolveCustomer.mock.calls[0][1];
      expect(callArgs.email).toBe('carol@test.com');
      expect(callArgs.phone).toBe('+14155559999');
      // webChatSessionId should NOT be set when email or phone is provided
      expect(callArgs.webChatSessionId).toBeUndefined();
    });
  });

  // ─── 3. Offline Form (3 tests) ──────────────────────────────────────────────

  describe('3. Offline Form', () => {
    it('should process offline form: create customer → create conversation → store message with offlineForm metadata', async () => {
      const { client } = await connectVisitor();

      customerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-off',
        name: 'Offline User',
        email: 'off@test.com',
      });
      conversationService.findOrCreate.mockResolvedValue({ id: 'conv-off' });
      const offlineMsg = { id: 'msg-off', createdAt: new Date() };
      mockPrisma.message.create.mockResolvedValue(offlineMsg);
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleOfflineForm(client, {
        name: 'Offline User',
        email: 'off@test.com',
        message: 'Need help with booking',
      });

      // Customer created
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({ email: 'off@test.com', name: 'Offline User' }),
      );

      // Conversation created with WEB_CHAT
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust-off',
        'WEB_CHAT',
      );

      // Message stored with offline metadata
      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv-off',
          direction: 'INBOUND',
          content: '[Offline Form] Need help with booking',
          contentType: 'TEXT',
          channel: 'WEB_CHAT',
          metadata: {
            offlineForm: true,
            email: 'off@test.com',
            phone: undefined,
          },
        }),
      });

      // Ack sent
      expect(client.emit).toHaveBeenCalledWith('chat:offline:ack', { success: true });
    });

    it('should find existing customer when offline form email matches', async () => {
      const { client } = await connectVisitor();

      const existingCustomer = {
        id: 'cust-existing',
        name: 'Known User',
        email: 'known@test.com',
      };
      customerIdentityService.resolveCustomer.mockResolvedValue(existingCustomer);
      conversationService.findOrCreate.mockResolvedValue({ id: 'conv-existing' });
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-existing' });
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleOfflineForm(client, {
        name: 'Known User',
        email: 'known@test.com',
        message: 'Question about hours',
      });

      // resolveCustomer returns the existing customer
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({ email: 'known@test.com' }),
      );

      // Conversation created with existing customer
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust-existing',
        'WEB_CHAT',
      );
    });

    it('should notify staff inbox when offline form is submitted', async () => {
      const { client } = await connectVisitor();

      customerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-off',
        name: 'Offline User',
      });
      conversationService.findOrCreate.mockResolvedValue({ id: 'conv-off' });
      const offlineMsg = { id: 'msg-off-notify', createdAt: new Date() };
      mockPrisma.message.create.mockResolvedValue(offlineMsg);
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleOfflineForm(client, {
        name: 'Offline User',
        email: 'off@test.com',
        message: 'Urgent request',
      });

      // Staff inbox notified
      expect(inboxGateway.notifyNewMessage).toHaveBeenCalledWith('biz1', offlineMsg);
    });
  });

  // ─── 4. Customer Identity Integration (3 tests) ─────────────────────────────

  describe('4. Customer Identity Integration', () => {
    it('should create new customer with webChatSessionId when no email/phone provided', async () => {
      const { client, session } = await connectVisitor();

      const anonCustomer = {
        id: 'cust-new-anon',
        name: 'New Visitor',
        webChatSessionId: null, // not yet linked
      };
      customerIdentityService.resolveCustomer.mockResolvedValue(anonCustomer);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);
      mockPrisma.customer.update.mockResolvedValue({});

      await gateway.handleChatStart(client, { name: 'New Visitor' });

      // Called with webChatSessionId
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({
          name: 'New Visitor',
          webChatSessionId: session.sessionId,
        }),
      );

      // Since customer.webChatSessionId is null, the gateway links it
      expect(mockPrisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust-new-anon' },
        data: { webChatSessionId: session.sessionId },
      });
    });

    it('should link existing customer (resolved by phone) when they start web chat with email', async () => {
      const { client } = await connectVisitor();

      // Customer exists by phone, now connecting via web chat with email
      const existingByPhone = {
        id: 'cust-phone',
        name: 'Phone User',
        phone: '+14155551234',
        email: null,
        webChatSessionId: null,
      };
      customerIdentityService.resolveCustomer.mockResolvedValue(existingByPhone);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);

      await gateway.handleChatStart(client, {
        name: 'Phone User',
        email: 'phoneuser@test.com',
      });

      // resolveCustomer was called with email — the identity service handles linking
      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({
          name: 'Phone User',
          email: 'phoneuser@test.com',
        }),
      );

      // Conversation created with the existing customer's ID
      expect(conversationService.findOrCreate).toHaveBeenCalledWith(
        'biz1',
        'cust-phone',
        'WEB_CHAT',
      );
    });

    it('should support customer with multiple channels (phone + email + webChatSessionId) — all linked', async () => {
      const { client } = await connectVisitor();

      customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomerMultiChannel);
      conversationService.findOrCreate.mockResolvedValue(mockConversation);

      await gateway.handleChatStart(client, {
        name: 'Multi User',
        email: 'multi@test.com',
        phone: '+14155557777',
      });

      // Verify the resolved customer has all channel identifiers
      const resolvedCustomer =
        await customerIdentityService.resolveCustomer.mock.results[0].value;
      expect(resolvedCustomer.phone).toBe('+14155557777');
      expect(resolvedCustomer.email).toBe('multi@test.com');
      expect(resolvedCustomer.webChatSessionId).toBe('sess-multi');
    });
  });

  // ─── 5. Message Flow (3 tests) ──────────────────────────────────────────────

  describe('5. Message Flow', () => {
    it('should store inbound message with correct fields: channel=WEB_CHAT, direction=INBOUND, contentType=TEXT', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      jest.clearAllMocks();

      const inboundMsg = {
        id: 'msg-inbound',
        conversationId: 'conv1',
        direction: 'INBOUND',
        content: 'What are your hours?',
        contentType: 'TEXT',
        channel: 'WEB_CHAT',
        createdAt: new Date(),
      };
      mockPrisma.message.create.mockResolvedValue(inboundMsg);
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleChatMessage(client, { content: 'What are your hours?' });

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: {
          conversationId: 'conv1',
          direction: 'INBOUND',
          content: 'What are your hours?',
          contentType: 'TEXT',
          channel: 'WEB_CHAT',
        },
      });
    });

    it('should trigger sendToWebChatClient bridge when staff sends outbound message', async () => {
      const { client, session } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      jest.clearAllMocks();

      // Staff outbound message
      const outboundMessage = {
        id: 'msg-outbound',
        content: 'We are open 9-5!',
        createdAt: new Date(),
        senderName: 'Agent Mike',
      };

      const delivered = gateway.sendToWebChatClient('conv1', outboundMessage);

      expect(delivered).toBe(true);
      expect(mockServer.to).toHaveBeenCalledWith(`webchat:${session.sessionId}`);
      expect(mockServer.emit).toHaveBeenCalledWith('chat:reply', {
        messageId: 'msg-outbound',
        content: 'We are open 9-5!',
        createdAt: outboundMessage.createdAt,
        senderName: 'Agent Mike',
      });
    });

    it('should forward typing indicator to staff inbox', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      gateway.handleTyping(client, { isTyping: true });

      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'webchat:typing',
        {
          conversationId: 'conv1',
          isTyping: true,
        },
      );

      // Also test stopping typing
      gateway.handleTyping(client, { isTyping: false });

      expect(inboxGateway.emitToBusinessRoom).toHaveBeenCalledWith(
        'biz1',
        'webchat:typing',
        {
          conversationId: 'conv1',
          isTyping: false,
        },
      );
    });
  });

  // ─── 6. Session Management (3 tests) ────────────────────────────────────────

  describe('6. Session Management', () => {
    it('should persist session after disconnect — allows reconnect within 24h', async () => {
      const { client, session } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      const sessionCountBefore = gateway.getSessionCount();

      // Disconnect
      gateway.handleDisconnect(client);

      // Session still exists
      expect(gateway.getSessionCount()).toBe(sessionCountBefore);

      // Reconnect
      jwtService.verify.mockReturnValue({
        sessionId: session.sessionId,
        businessId: 'biz1',
        type: 'web-chat',
      });
      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);

      const client2 = createMockSocket({
        businessId: 'biz1',
        sessionToken: 'session-token-test',
      });
      await gateway.handleConnection(client2);

      const resumedSession = (client2 as any).webChatSession;
      expect(resumedSession.sessionId).toBe(session.sessionId);
      expect(resumedSession.customerId).toBe('cust1');
      expect(resumedSession.conversationId).toBe('conv1');
    });

    it('should create new session when invalid session token is provided', async () => {
      // Token verification throws (expired or tampered)
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });
      mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
      jwtService.sign.mockReturnValue('new-session-token');

      const client = createMockSocket({
        businessId: 'biz1',
        sessionToken: 'invalid-expired-token',
      });
      await gateway.handleConnection(client);

      // New session created (not resumed)
      expect(client.emit).toHaveBeenCalledWith(
        'session:created',
        expect.objectContaining({
          sessionToken: 'new-session-token',
          businessName: 'Test Biz',
        }),
      );

      const session = (client as any).webChatSession;
      expect(session).toBeDefined();
      expect(session.businessId).toBe('biz1');
    });

    it('should filter getActiveSessions by businessId', async () => {
      // Connect two visitors to biz1
      const { session: s1 } = await connectVisitor();
      const { session: s2 } = await connectVisitor();

      // Manually add a session for a different business
      const sessions = (gateway as any).sessions as Map<string, any>;
      sessions.set('sess-other-biz', {
        sessionId: 'sess-other-biz',
        businessId: 'biz2',
        socketId: 'socket-other',
        connectedAt: Date.now(),
      });

      const biz1Sessions = gateway.getActiveSessions('biz1');
      const biz2Sessions = gateway.getActiveSessions('biz2');

      expect(biz1Sessions).toHaveLength(2);
      expect(biz1Sessions.map((s: any) => s.sessionId).sort()).toEqual(
        [s1.sessionId, s2.sessionId].sort(),
      );

      expect(biz2Sessions).toHaveLength(1);
      expect(biz2Sessions[0].sessionId).toBe('sess-other-biz');

      // Unknown business returns empty
      expect(gateway.getActiveSessions('biz-unknown')).toEqual([]);
    });
  });
});
