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
};

const mockConversation = {
  id: 'conv1',
  customerId: 'cust1',
  businessId: 'biz1',
  channel: 'WEB_CHAT',
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

describe('WebChat Batch 2 — New Handlers', () => {
  let gateway: WebChatGateway;

  let mockPrisma: {
    business: { findUnique: jest.Mock; findFirst: jest.Mock };
    customer: { update: jest.Mock };
    message: { create: jest.Mock; findMany: jest.Mock };
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
    in: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    fetchSockets: jest.fn().mockResolvedValue([]),
  };

  async function connectVisitor(
    authOverrides: Record<string, any> = {},
  ): Promise<{ client: Socket; session: any }> {
    const client = createMockSocket({ businessId: 'biz1', ...authOverrides });
    mockPrisma.business.findUnique.mockResolvedValue(mockBusiness);
    jwtService.sign.mockReturnValue('session-token-test');
    await gateway.handleConnection(client);
    return { client, session: (client as any).webChatSession };
  }

  async function startChat(
    client: Socket,
    data: { name: string; email?: string; phone?: string; message?: string },
  ) {
    customerIdentityService.resolveCustomer.mockResolvedValue(mockCustomer);
    conversationService.findOrCreate.mockResolvedValue(mockConversation);
    if (data.message) {
      mockPrisma.message.create.mockResolvedValue({
        id: 'msg1',
        conversationId: 'conv1',
        createdAt: new Date(),
      });
      mockPrisma.conversation.update.mockResolvedValue({ id: 'conv1' });
      mockPrisma.conversation.findUnique.mockResolvedValue({
        id: 'conv1',
        customer: mockCustomer,
        assignedTo: null,
        messages: [],
      });
    }
    await gateway.handleChatStart(client, data);
  }

  beforeEach(async () => {
    mockPrisma = {
      business: { findUnique: jest.fn(), findFirst: jest.fn() },
      customer: { update: jest.fn() },
      message: { create: jest.fn(), findMany: jest.fn() },
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

  // ─── session:identify ─────────────────────────────────────────────────────────

  describe('session:identify', () => {
    it('should identify session by email and re-issue JWT with customerId', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice' });

      jest.clearAllMocks();

      const resolvedCustomer = { id: 'cust-identified', name: 'Alice Found' };
      customerIdentityService.resolveCustomer.mockResolvedValue(resolvedCustomer);
      jwtService.sign.mockReturnValue('new-identified-token');

      await gateway.handleSessionIdentify(client, { email: 'alice@test.com' });

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({ email: 'alice@test.com' }),
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust-identified',
          type: 'web-chat',
        }),
        expect.objectContaining({ expiresIn: '24h' }),
      );
      expect(client.emit).toHaveBeenCalledWith('session:identified', {
        customerId: 'cust-identified',
        customerName: 'Alice Found',
        sessionToken: 'new-identified-token',
      });
    });

    it('should identify session by phone', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Bob' });

      jest.clearAllMocks();

      const resolvedCustomer = { id: 'cust-phone', name: 'Bob Phone' };
      customerIdentityService.resolveCustomer.mockResolvedValue(resolvedCustomer);
      jwtService.sign.mockReturnValue('phone-token');

      await gateway.handleSessionIdentify(client, { phone: '+14155551234' });

      expect(customerIdentityService.resolveCustomer).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({ phone: '+14155551234' }),
      );
      expect(client.emit).toHaveBeenCalledWith(
        'session:identified',
        expect.objectContaining({ customerId: 'cust-phone' }),
      );
    });

    it('should emit error when neither email nor phone provided', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice' });

      jest.clearAllMocks();

      await gateway.handleSessionIdentify(client, {} as any);

      expect(client.emit).toHaveBeenCalledWith('session:identify:error', {
        message: 'Email or phone required',
      });
      expect(customerIdentityService.resolveCustomer).not.toHaveBeenCalled();
    });

    it('should emit error when resolveCustomer throws', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice' });

      jest.clearAllMocks();

      customerIdentityService.resolveCustomer.mockRejectedValue(new Error('DB error'));

      await gateway.handleSessionIdentify(client, { email: 'alice@test.com' });

      expect(client.emit).toHaveBeenCalledWith('session:identify:error', {
        message: 'Failed to identify session',
      });
    });

    it('should do nothing if no session on socket', async () => {
      const client = createMockSocket();
      await gateway.handleSessionIdentify(client, { email: 'test@test.com' });

      expect(client.emit).not.toHaveBeenCalled();
      expect(customerIdentityService.resolveCustomer).not.toHaveBeenCalled();
    });
  });

  // ─── history:request ──────────────────────────────────────────────────────────

  describe('history:request', () => {
    it('should return paginated message history', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      jest.clearAllMocks();

      const mockMessages = [
        {
          id: 'msg1',
          content: 'Hello',
          direction: 'INBOUND',
          createdAt: new Date(),
          contentType: 'TEXT',
        },
        {
          id: 'msg2',
          content: 'Hi!',
          direction: 'OUTBOUND',
          createdAt: new Date(),
          contentType: 'TEXT',
        },
      ];
      mockPrisma.message.findMany.mockResolvedValue(mockMessages);

      await gateway.handleHistoryRequest(client, {});

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { conversationId: 'conv1' },
          orderBy: { createdAt: 'desc' },
          take: 20,
        }),
      );
      expect(client.emit).toHaveBeenCalledWith('history:response', {
        messages: mockMessages.reverse(),
        hasMore: false,
        cursor: expect.any(String),
      });
    });

    it('should respect limit parameter (capped at 50)', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      jest.clearAllMocks();
      mockPrisma.message.findMany.mockResolvedValue([]);

      await gateway.handleHistoryRequest(client, { limit: 100 });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      );
    });

    it('should use cursor for pagination', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      jest.clearAllMocks();
      mockPrisma.message.findMany.mockResolvedValue([]);

      await gateway.handleHistoryRequest(client, { cursor: 'msg-cursor', limit: 10 });

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          cursor: { id: 'msg-cursor' },
          skip: 1,
          take: 10,
        }),
      );
    });

    it('should emit error when no active conversation', async () => {
      const { client } = await connectVisitor();
      // Don't start chat — no conversationId

      jest.clearAllMocks();

      await gateway.handleHistoryRequest(client, {});

      expect(client.emit).toHaveBeenCalledWith('history:error', {
        message: 'No active conversation',
      });
    });

    it('should emit error on database failure', async () => {
      const { client } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      jest.clearAllMocks();
      mockPrisma.message.findMany.mockRejectedValue(new Error('DB down'));

      await gateway.handleHistoryRequest(client, {});

      expect(client.emit).toHaveBeenCalledWith('history:error', {
        message: 'Failed to load history',
      });
    });
  });

  // ─── file:upload-request ──────────────────────────────────────────────────────

  describe('file:upload-request', () => {
    it('should respond with unsupported message', async () => {
      const { client } = await connectVisitor();

      jest.clearAllMocks();

      gateway.handleFileUploadRequest(client);

      expect(client.emit).toHaveBeenCalledWith('file:upload-response', {
        supported: false,
        message: 'File uploads are not yet supported in web chat. Please share files via email.',
      });
    });
  });

  // ─── sendToWebChatClient offline notification ─────────────────────────────────

  describe('sendToWebChatClient — offline email notification', () => {
    it('should log offline notification when visitor is offline and has email', async () => {
      const { client, session } = await connectVisitor();
      await startChat(client, { name: 'Alice', email: 'alice@test.com' });

      jest.clearAllMocks();

      // Mock fetchSockets returning empty (visitor offline)
      const mockIn = jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([]),
      });
      mockServer.to.mockReturnThis();
      mockServer.in = mockIn;

      const logSpy = jest.spyOn((gateway as any).logger, 'log');

      gateway.sendToWebChatClient('conv1', {
        id: 'msg-reply',
        content: 'Reply from staff',
        createdAt: new Date(),
        senderName: 'Support',
      });

      // Wait for async fetchSockets
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Visitor offline for conversation conv1'),
      );
    });

    it('should return false when conversation not found', () => {
      const result = gateway.sendToWebChatClient('non-existent-conv', {
        id: 'msg1',
        content: 'test',
        createdAt: new Date(),
      });

      expect(result).toBe(false);
    });
  });
});
