import { Test, TestingModule } from '@nestjs/testing';
import { WebChatGateway } from './web-chat.gateway';
import { InboxGateway } from './inbox.gateway';
import { PrismaService } from './prisma.service';
import { CustomerIdentityService } from '../modules/customer-identity/customer-identity.service';
import { ConversationService } from '../modules/conversation/conversation.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

describe('WebChatGateway', () => {
  let gateway: WebChatGateway;

  const mockPrisma = {
    business: { findUnique: jest.fn() },
    customer: { update: jest.fn() },
    message: { create: jest.fn() },
    conversation: { update: jest.fn(), findUnique: jest.fn() },
  };
  const mockCustomerIdentityService = { resolveCustomer: jest.fn() };
  const mockConversationService = { findOrCreate: jest.fn() };
  const mockInboxGateway = {
    notifyNewMessage: jest.fn(),
    notifyConversationUpdate: jest.fn(),
    emitToBusinessRoom: jest.fn(),
  };
  const mockJwtService = { sign: jest.fn(), verify: jest.fn() };
  const mockConfigService = { get: jest.fn() };

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  };

  function createMockSocket(overrides: Partial<Socket> = {}): Socket {
    return {
      id: 'socket-1',
      handshake: { auth: {} },
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
      ...overrides,
    } as unknown as Socket;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfigService.get.mockReturnValue('test-jwt-secret');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebChatGateway,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: CustomerIdentityService, useValue: mockCustomerIdentityService },
        { provide: ConversationService, useValue: mockConversationService },
        { provide: InboxGateway, useValue: mockInboxGateway },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    gateway = module.get<WebChatGateway>(WebChatGateway);
    (gateway as any).server = mockServer;
  });

  describe('afterInit', () => {
    it('should log initialization', () => {
      // Should not throw
      gateway.afterInit({} as any);
    });
  });

  describe('handleConnection', () => {
    it('should assign session with valid businessId', async () => {
      const client = createMockSocket({
        handshake: { auth: { businessId: 'biz-1' } } as any,
      } as any);

      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        name: 'Test Biz',
        channelSettings: null,
      });
      mockJwtService.sign.mockReturnValue('session-token-123');

      await gateway.handleConnection(client);

      expect(mockPrisma.business.findUnique).toHaveBeenCalledWith({
        where: { id: 'biz-1' },
        select: { id: true, name: true, channelSettings: true },
      });
      expect(client.emit).toHaveBeenCalledWith(
        'session:created',
        expect.objectContaining({
          sessionToken: 'session-token-123',
          businessName: 'Test Biz',
        }),
      );
      expect(client.join).toHaveBeenCalledWith(expect.stringMatching(/^webchat:/));
      expect((client as any).webChatSession).toBeDefined();
      expect((client as any).webChatSession.businessId).toBe('biz-1');
    });

    it('should reject without businessId', async () => {
      const client = createMockSocket({
        handshake: { auth: {} } as any,
      } as any);

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'businessId required' });
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should reject with invalid businessId', async () => {
      const client = createMockSocket({
        handshake: { auth: { businessId: 'invalid-biz' } } as any,
      } as any);
      mockPrisma.business.findUnique.mockResolvedValue(null);

      await gateway.handleConnection(client);

      expect(client.emit).toHaveBeenCalledWith('error', { message: 'Business not found' });
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should resume existing session with valid token', async () => {
      // First, create a session
      const client1 = createMockSocket({
        id: 'socket-1',
        handshake: { auth: { businessId: 'biz-1' } } as any,
      } as any);
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        name: 'Test Biz',
        channelSettings: null,
      });
      mockJwtService.sign.mockReturnValue('session-token-abc');
      await gateway.handleConnection(client1);

      const session = (client1 as any).webChatSession;
      const sessionId = session.sessionId;

      // Now reconnect with the session token
      mockJwtService.verify.mockReturnValue({
        sessionId,
        businessId: 'biz-1',
        type: 'web-chat',
      });

      const client2 = createMockSocket({
        id: 'socket-2',
        handshake: {
          auth: { businessId: 'biz-1', sessionToken: 'session-token-abc' },
        } as any,
      } as any);

      await gateway.handleConnection(client2);

      // Should not emit session:created again (session was resumed)
      expect(client2.emit).not.toHaveBeenCalledWith('session:created', expect.anything());
      expect((client2 as any).webChatSession.sessionId).toBe(sessionId);
      expect((client2 as any).webChatSession.socketId).toBe('socket-2');
    });
  });

  describe('handleChatStart', () => {
    let client: Socket;
    const session = {
      sessionId: 'sess-1',
      businessId: 'biz-1',
      socketId: 'socket-1',
      connectedAt: Date.now(),
    };

    beforeEach(() => {
      client = createMockSocket();
      (client as any).webChatSession = session;
    });

    it('should create customer and conversation', async () => {
      mockCustomerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-1',
        name: 'Alice',
        webChatSessionId: 'sess-1',
      });
      mockConversationService.findOrCreate.mockResolvedValue({
        id: 'conv-1',
      });

      await gateway.handleChatStart(client, { name: 'Alice' });

      expect(mockCustomerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz-1',
        expect.objectContaining({ name: 'Alice', webChatSessionId: 'sess-1' }),
      );
      expect(mockConversationService.findOrCreate).toHaveBeenCalledWith(
        'biz-1',
        'cust-1',
        'WEB_CHAT',
      );
      expect(client.emit).toHaveBeenCalledWith('chat:started', {
        conversationId: 'conv-1',
        customerId: 'cust-1',
        customerName: 'Alice',
      });
    });

    it('should resolve existing customer by email', async () => {
      mockCustomerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-existing',
        name: 'Alice',
        email: 'alice@test.com',
        webChatSessionId: null,
      });
      mockConversationService.findOrCreate.mockResolvedValue({ id: 'conv-1' });

      await gateway.handleChatStart(client, {
        name: 'Alice',
        email: 'alice@test.com',
      });

      expect(mockCustomerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz-1',
        expect.objectContaining({ name: 'Alice', email: 'alice@test.com' }),
      );
      // Should NOT include webChatSessionId when email is provided
      const callArgs = mockCustomerIdentityService.resolveCustomer.mock.calls[0][1];
      expect(callArgs.webChatSessionId).toBeUndefined();
    });

    it('should use webChatSessionId for anonymous visitors (no email/phone)', async () => {
      mockCustomerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-anon',
        name: 'Visitor',
        webChatSessionId: 'sess-1',
      });
      mockConversationService.findOrCreate.mockResolvedValue({ id: 'conv-1' });

      await gateway.handleChatStart(client, { name: 'Visitor' });

      const callArgs = mockCustomerIdentityService.resolveCustomer.mock.calls[0][1];
      expect(callArgs.webChatSessionId).toBe('sess-1');
    });

    it('should send initial message if provided', async () => {
      mockCustomerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-1',
        name: 'Alice',
        webChatSessionId: 'sess-1',
      });
      mockConversationService.findOrCreate.mockResolvedValue({ id: 'conv-1' });
      const mockMessage = { id: 'msg-1', createdAt: new Date() };
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        customer: {},
        assignedTo: null,
        messages: [mockMessage],
      });

      await gateway.handleChatStart(client, {
        name: 'Alice',
        message: 'Hello!',
      });

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv-1',
          direction: 'INBOUND',
          content: 'Hello!',
          contentType: 'TEXT',
          channel: 'WEB_CHAT',
        }),
      });
    });

    it('should notify staff inbox on initial message', async () => {
      mockCustomerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-1',
        name: 'Alice',
        webChatSessionId: 'sess-1',
      });
      mockConversationService.findOrCreate.mockResolvedValue({ id: 'conv-1' });
      const mockMessage = { id: 'msg-1', createdAt: new Date() };
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv-1' });
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv-1',
        customer: {},
        assignedTo: null,
        messages: [mockMessage],
      });

      await gateway.handleChatStart(client, {
        name: 'Alice',
        message: 'Hello!',
      });

      expect(mockInboxGateway.notifyNewMessage).toHaveBeenCalledWith('biz-1', mockMessage);
      expect(mockInboxGateway.notifyConversationUpdate).toHaveBeenCalledWith(
        'biz-1',
        expect.objectContaining({ id: 'conv-1' }),
      );
    });

    it('should emit chat:error on failure', async () => {
      mockCustomerIdentityService.resolveCustomer.mockRejectedValue(new Error('DB down'));

      await gateway.handleChatStart(client, { name: 'Alice' });

      expect(client.emit).toHaveBeenCalledWith('chat:error', {
        message: 'Failed to start chat',
      });
    });
  });

  describe('handleChatMessage', () => {
    let client: Socket;

    beforeEach(() => {
      client = createMockSocket();
    });

    it('should store message with channel=WEB_CHAT', async () => {
      (client as any).webChatSession = {
        sessionId: 'sess-1',
        businessId: 'biz-1',
        conversationId: 'conv-1',
        socketId: 'socket-1',
      };
      const mockMessage = { id: 'msg-1', createdAt: new Date() };
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleChatMessage(client, { content: 'Hi there' });

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          conversationId: 'conv-1',
          direction: 'INBOUND',
          content: 'Hi there',
          contentType: 'TEXT',
          channel: 'WEB_CHAT',
        }),
      });
    });

    it('should reject before chat:start', async () => {
      (client as any).webChatSession = {
        sessionId: 'sess-1',
        businessId: 'biz-1',
        socketId: 'socket-1',
        // no conversationId
      };

      await gateway.handleChatMessage(client, { content: 'Hello' });

      expect(client.emit).toHaveBeenCalledWith('chat:error', {
        message: 'Chat not started. Send chat:start first.',
      });
      expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });

    it('should notify staff inbox', async () => {
      (client as any).webChatSession = {
        sessionId: 'sess-1',
        businessId: 'biz-1',
        conversationId: 'conv-1',
        socketId: 'socket-1',
      };
      const mockMessage = { id: 'msg-2', createdAt: new Date() };
      mockPrisma.message.create.mockResolvedValue(mockMessage);
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleChatMessage(client, { content: 'Question' });

      expect(mockInboxGateway.notifyNewMessage).toHaveBeenCalledWith('biz-1', mockMessage);
    });

    it('should confirm with ack', async () => {
      (client as any).webChatSession = {
        sessionId: 'sess-1',
        businessId: 'biz-1',
        conversationId: 'conv-1',
        socketId: 'socket-1',
      };
      const createdAt = new Date();
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-3', createdAt });
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleChatMessage(client, { content: 'Test' });

      expect(client.emit).toHaveBeenCalledWith('chat:message:ack', {
        messageId: 'msg-3',
        createdAt,
      });
    });

    it('should ignore empty content', async () => {
      (client as any).webChatSession = {
        sessionId: 'sess-1',
        businessId: 'biz-1',
        conversationId: 'conv-1',
        socketId: 'socket-1',
      };

      await gateway.handleChatMessage(client, { content: '   ' });

      expect(mockPrisma.message.create).not.toHaveBeenCalled();
    });
  });

  describe('handleOfflineForm', () => {
    let client: Socket;

    beforeEach(() => {
      client = createMockSocket();
      (client as any).webChatSession = {
        sessionId: 'sess-1',
        businessId: 'biz-1',
        socketId: 'socket-1',
      };
    });

    it('should create customer and conversation', async () => {
      mockCustomerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-off',
        name: 'Offline User',
      });
      mockConversationService.findOrCreate.mockResolvedValue({ id: 'conv-off' });
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-off' });
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleOfflineForm(client, {
        name: 'Offline User',
        email: 'off@test.com',
        message: 'Need help',
      });

      expect(mockCustomerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz-1',
        expect.objectContaining({ email: 'off@test.com', name: 'Offline User' }),
      );
      expect(mockConversationService.findOrCreate).toHaveBeenCalledWith(
        'biz-1',
        'cust-off',
        'WEB_CHAT',
      );
      expect(client.emit).toHaveBeenCalledWith('chat:offline:ack', { success: true });
    });

    it('should store message with offline metadata', async () => {
      mockCustomerIdentityService.resolveCustomer.mockResolvedValue({
        id: 'cust-off',
        name: 'Bob',
      });
      mockConversationService.findOrCreate.mockResolvedValue({ id: 'conv-off' });
      mockPrisma.message.create.mockResolvedValue({ id: 'msg-off' });
      mockPrisma.conversation.update.mockResolvedValue({});

      await gateway.handleOfflineForm(client, {
        name: 'Bob',
        email: 'bob@test.com',
        phone: '+1234567890',
        message: 'Urgent request',
      });

      expect(mockPrisma.message.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          content: '[Offline Form] Urgent request',
          channel: 'WEB_CHAT',
          metadata: {
            offlineForm: true,
            email: 'bob@test.com',
            phone: '+1234567890',
          },
        }),
      });
    });
  });

  describe('handleTyping', () => {
    it('should forward to staff inbox', () => {
      const client = createMockSocket();
      (client as any).webChatSession = {
        sessionId: 'sess-1',
        businessId: 'biz-1',
        conversationId: 'conv-1',
        socketId: 'socket-1',
      };

      gateway.handleTyping(client, { isTyping: true });

      expect(mockInboxGateway.emitToBusinessRoom).toHaveBeenCalledWith('biz-1', 'webchat:typing', {
        conversationId: 'conv-1',
        isTyping: true,
      });
    });

    it('should not forward if no conversationId', () => {
      const client = createMockSocket();
      (client as any).webChatSession = {
        sessionId: 'sess-1',
        businessId: 'biz-1',
        socketId: 'socket-1',
        // no conversationId
      };

      gateway.handleTyping(client, { isTyping: true });

      expect(mockInboxGateway.emitToBusinessRoom).not.toHaveBeenCalled();
    });
  });

  describe('sendToWebChatClient', () => {
    it('should deliver to correct session', () => {
      // Manually add a session with a conversationId
      const sessions = (gateway as any).sessions as Map<string, any>;
      sessions.set('sess-A', {
        sessionId: 'sess-A',
        businessId: 'biz-1',
        conversationId: 'conv-target',
        socketId: 'socket-A',
      });

      const message = {
        id: 'msg-reply',
        content: 'Staff reply',
        createdAt: new Date(),
        senderName: 'Agent Bob',
      };

      const result = gateway.sendToWebChatClient('conv-target', message);

      expect(result).toBe(true);
      expect(mockServer.to).toHaveBeenCalledWith('webchat:sess-A');
      expect(mockServer.emit).toHaveBeenCalledWith('chat:reply', {
        messageId: 'msg-reply',
        content: 'Staff reply',
        createdAt: message.createdAt,
        senderName: 'Agent Bob',
      });
    });

    it('should return false for unknown conversation', () => {
      const result = gateway.sendToWebChatClient('conv-unknown', {
        id: 'msg-1',
        content: 'Hello',
        createdAt: new Date(),
      });

      expect(result).toBe(false);
    });

    it('should default senderName to Support', () => {
      const sessions = (gateway as any).sessions as Map<string, any>;
      sessions.set('sess-B', {
        sessionId: 'sess-B',
        businessId: 'biz-1',
        conversationId: 'conv-B',
        socketId: 'socket-B',
      });

      gateway.sendToWebChatClient('conv-B', {
        id: 'msg-2',
        content: 'Hi',
        createdAt: new Date(),
      });

      expect(mockServer.emit).toHaveBeenCalledWith(
        'chat:reply',
        expect.objectContaining({ senderName: 'Support' }),
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should filter by businessId', () => {
      const sessions = (gateway as any).sessions as Map<string, any>;
      sessions.set('s1', { sessionId: 's1', businessId: 'biz-1', socketId: 'x' });
      sessions.set('s2', { sessionId: 's2', businessId: 'biz-2', socketId: 'y' });
      sessions.set('s3', { sessionId: 's3', businessId: 'biz-1', socketId: 'z' });

      const result = gateway.getActiveSessions('biz-1');

      expect(result).toHaveLength(2);
      expect(result.map((s: any) => s.sessionId).sort()).toEqual(['s1', 's3']);
    });

    it('should return empty for unknown business', () => {
      expect(gateway.getActiveSessions('biz-unknown')).toEqual([]);
    });
  });

  describe('getSessionCount', () => {
    it('should return total session count', () => {
      const sessions = (gateway as any).sessions as Map<string, any>;
      sessions.set('a', {});
      sessions.set('b', {});
      expect(gateway.getSessionCount()).toBe(2);
    });
  });

  describe('handleDisconnect', () => {
    it('should not delete session (allows reconnect)', async () => {
      // First connect to create a session
      const client = createMockSocket({
        id: 'socket-disc',
        handshake: { auth: { businessId: 'biz-1' } } as any,
      } as any);
      mockPrisma.business.findUnique.mockResolvedValue({
        id: 'biz-1',
        name: 'Biz',
        channelSettings: null,
      });
      mockJwtService.sign.mockReturnValue('tok');
      await gateway.handleConnection(client);

      const sessionsBefore = gateway.getSessionCount();

      gateway.handleDisconnect(client);

      // Session should still exist
      expect(gateway.getSessionCount()).toBe(sessionsBefore);
    });
  });
});
