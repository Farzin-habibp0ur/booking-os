import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { CustomerIdentityService } from '../modules/customer-identity/customer-identity.service';
import { ConversationService } from '../modules/conversation/conversation.service';
import { InboxGateway } from './inbox.gateway';
import * as crypto from 'crypto';

interface WebChatSession {
  sessionId: string;
  businessId: string;
  customerId?: string;
  conversationId?: string;
  customerName?: string;
  customerEmail?: string;
  socketId: string;
  connectedAt: number;
}

@WebSocketGateway({ namespace: '/web-chat', cors: { origin: '*', credentials: false } })
export class WebChatGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebChatGateway.name);
  // In-memory session store (always maintained for fast lookups)
  private sessions = new Map<string, WebChatSession>();
  // Redis client for cross-instance session persistence
  private redisClient: any = null;

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private customerIdentityService: CustomerIdentityService,
    private conversationService: ConversationService,
    private inboxGateway: InboxGateway,
  ) {}

  async afterInit(server: Server) {
    this.logger.log('WebChat gateway initialized on /web-chat namespace');

    // Connect to Redis for session persistence
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        const { createClient } = await import('redis');
        this.redisClient = createClient({ url: redisUrl });
        this.redisClient.on('error', (err: any) => {
          this.logger.warn(`Redis error for webchat sessions: ${err.message}`);
          this.redisClient = null;
        });
        await this.redisClient.connect();
        this.logger.log('WebChat Redis session store connected');
      } catch (err: any) {
        this.logger.warn(
          `Failed to connect Redis for webchat sessions: ${err.message} — using in-memory only`,
        );
      }
    }
  }

  private async getSession(sessionId: string): Promise<WebChatSession | null> {
    // Check in-memory first (fastest)
    const local = this.sessions.get(sessionId);
    if (local) return local;

    // Fall back to Redis
    if (this.redisClient) {
      try {
        const data = await this.redisClient.get(`webchat:session:${sessionId}`);
        if (data) {
          const session = JSON.parse(data) as WebChatSession;
          this.sessions.set(sessionId, session); // Cache locally
          return session;
        }
      } catch {
        // Redis read failed — fall through
      }
    }

    return null;
  }

  private async saveSession(sessionId: string, session: WebChatSession): Promise<void> {
    this.sessions.set(sessionId, session);
    if (this.redisClient) {
      try {
        await this.redisClient.set(
          `webchat:session:${sessionId}`,
          JSON.stringify(session),
          { EX: 86400 }, // 24-hour TTL
        );
      } catch {
        // Redis write failed — in-memory still holds it
      }
    }
  }

  /**
   * Connection handler.
   * Widget connects with { businessId } in handshake auth.
   * Assigns a session token (JWT) so the visitor can reconnect.
   */
  async handleConnection(client: Socket) {
    const businessId = client.handshake.auth?.businessId as string;
    const existingToken = client.handshake.auth?.sessionToken as string;

    if (!businessId) {
      client.emit('error', { message: 'businessId required' });
      client.disconnect();
      return;
    }

    // Verify business exists
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true, name: true, channelSettings: true },
    });
    if (!business) {
      client.emit('error', { message: 'Business not found' });
      client.disconnect();
      return;
    }

    let session: WebChatSession | undefined;

    // Try to resume existing session
    if (existingToken) {
      try {
        const payload = this.jwtService.verify(existingToken, {
          secret: this.configService.get<string>('JWT_SECRET'),
        });
        if (payload.type === 'web-chat' && payload.businessId === businessId) {
          const existingSession = await this.getSession(payload.sessionId);
          if (existingSession) {
            existingSession.socketId = client.id;
            await this.saveSession(payload.sessionId, existingSession);
            session = existingSession;
            this.logger.log(`WebChat session resumed: ${session.sessionId}`);
          }
        }
      } catch {
        // Invalid token — create new session
      }
    }

    // Create new session if not resumed
    if (!session) {
      const sessionId = crypto.randomUUID();
      session = {
        sessionId,
        businessId,
        socketId: client.id,
        connectedAt: Date.now(),
      };
      await this.saveSession(sessionId, session);

      // Generate session token for reconnection
      const sessionToken = this.jwtService.sign(
        { sessionId, businessId, type: 'web-chat' },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '24h',
        },
      );

      client.emit('session:created', {
        sessionId,
        sessionToken,
        businessName: business.name,
      });
      this.logger.log(`WebChat new session: ${sessionId} for business ${businessId}`);
    }

    // Store session ref on socket
    (client as any).webChatSession = session;
    client.join(`webchat:${session.sessionId}`);
  }

  handleDisconnect(client: Socket) {
    const session = (client as any).webChatSession as WebChatSession | undefined;
    if (session) {
      this.logger.log(`WebChat disconnected: ${session.sessionId}`);
      // Don't delete session — allow reconnection within 24h
    }
  }

  /**
   * Pre-chat form submission. Creates/resolves customer and starts conversation.
   * Payload: { name: string, email?: string, phone?: string, message?: string }
   */
  @SubscribeMessage('chat:start')
  async handleChatStart(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { name: string; email?: string; phone?: string; message?: string },
  ) {
    const session = (client as any).webChatSession as WebChatSession;
    if (!session) return;

    try {
      // Resolve customer
      const identifiers: any = { name: data.name };
      if (data.email) identifiers.email = data.email;
      if (data.phone) identifiers.phone = data.phone;
      if (!data.email && !data.phone) {
        identifiers.webChatSessionId = session.sessionId;
      }

      const customer = await this.customerIdentityService.resolveCustomer(
        session.businessId,
        identifiers,
      );

      // If customer was created with webChatSessionId, link it
      if (!data.email && !data.phone && !customer.webChatSessionId) {
        await this.prisma.customer.update({
          where: { id: customer.id },
          data: { webChatSessionId: session.sessionId },
        });
      }

      // Create conversation
      const conversation = await this.conversationService.findOrCreate(
        session.businessId,
        customer.id,
        'WEB_CHAT',
      );

      // Update session
      session.customerId = customer.id;
      session.conversationId = conversation.id;
      session.customerName = data.name;
      session.customerEmail = data.email;

      // If initial message provided, create it
      if (data.message?.trim()) {
        const message = await this.prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: 'INBOUND',
            content: data.message.trim(),
            contentType: 'TEXT',
            channel: 'WEB_CHAT',
          },
        });

        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { lastMessageAt: new Date(), status: 'OPEN' },
        });

        // Notify staff inbox
        this.inboxGateway.notifyNewMessage(session.businessId, message);
        const updatedConv = await this.prisma.conversation.findUnique({
          where: { id: conversation.id },
          include: {
            customer: true,
            assignedTo: { select: { id: true, name: true } },
            messages: { take: 1, orderBy: { createdAt: 'desc' } },
          },
        });
        if (updatedConv) {
          this.inboxGateway.notifyConversationUpdate(session.businessId, updatedConv);
        }
      }

      client.emit('chat:started', {
        conversationId: conversation.id,
        customerId: customer.id,
        customerName: customer.name,
      });
    } catch (err: any) {
      this.logger.error(`WebChat start error: ${err.message}`, err.stack);
      client.emit('chat:error', { message: 'Failed to start chat' });
    }
  }

  /**
   * Visitor sends a message.
   * Payload: { content: string }
   */
  @SubscribeMessage('chat:message')
  async handleChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { content: string },
  ) {
    const session = (client as any).webChatSession as WebChatSession;
    if (!session?.conversationId) {
      client.emit('chat:error', {
        message: 'Chat not started. Send chat:start first.',
      });
      return;
    }

    if (!data?.content?.trim()) return;

    try {
      const message = await this.prisma.message.create({
        data: {
          conversationId: session.conversationId,
          direction: 'INBOUND',
          content: data.content.trim(),
          contentType: 'TEXT',
          channel: 'WEB_CHAT',
        },
      });

      await this.prisma.conversation.update({
        where: { id: session.conversationId },
        data: { lastMessageAt: new Date(), status: 'OPEN' },
      });

      // Notify staff inbox
      this.inboxGateway.notifyNewMessage(session.businessId, message);

      // Confirm to widget
      client.emit('chat:message:ack', {
        messageId: message.id,
        createdAt: message.createdAt,
      });
    } catch (err: any) {
      this.logger.error(`WebChat message error: ${err.message}`, err.stack);
      client.emit('chat:error', { message: 'Failed to send message' });
    }
  }

  /**
   * Offline form (when no staff is available or business hours are over).
   * Payload: { name, email, phone?, message }
   */
  @SubscribeMessage('chat:offline')
  async handleOfflineForm(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { name: string; email: string; phone?: string; message: string },
  ) {
    const session = (client as any).webChatSession as WebChatSession;
    if (!session) return;

    try {
      // Create customer and conversation even when offline
      const customer = await this.customerIdentityService.resolveCustomer(session.businessId, {
        email: data.email,
        phone: data.phone,
        name: data.name,
      });

      const conversation = await this.conversationService.findOrCreate(
        session.businessId,
        customer.id,
        'WEB_CHAT',
      );

      const message = await this.prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: 'INBOUND',
          content: `[Offline Form] ${data.message}`,
          contentType: 'TEXT',
          channel: 'WEB_CHAT',
          metadata: {
            offlineForm: true,
            email: data.email,
            phone: data.phone,
          },
        },
      });

      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { lastMessageAt: new Date(), status: 'OPEN' },
      });

      this.inboxGateway.notifyNewMessage(session.businessId, message);

      client.emit('chat:offline:ack', { success: true });
    } catch (err: any) {
      this.logger.error(`WebChat offline form error: ${err.message}`, err.stack);
      client.emit('chat:error', { message: 'Failed to submit form' });
    }
  }

  /**
   * Bridge: Staff sends a reply from the inbox → forward to web chat widget.
   * Called by the messaging flow when an outbound message targets a WEB_CHAT conversation.
   */
  sendToWebChatClient(
    conversationId: string,
    message: {
      id: string;
      content: string;
      createdAt: Date;
      senderName?: string;
    },
  ) {
    // Find session by conversationId
    for (const session of this.sessions.values()) {
      if (session.conversationId === conversationId) {
        const roomName = `webchat:${session.sessionId}`;

        this.server.to(roomName).emit('chat:reply', {
          messageId: message.id,
          content: message.content,
          createdAt: message.createdAt,
          senderName: message.senderName || 'Support',
        });

        // Check if visitor is connected — if not and has email, log notification
        this.server
          .in(roomName)
          .fetchSockets()
          .then((connectedSockets) => {
            if (connectedSockets.length === 0 && session.customerEmail) {
              this.logger.log(
                `Visitor offline for conversation ${conversationId} — ` +
                  `would send email notification to ${session.customerEmail}`,
              );
            }
          })
          .catch(() => {
            // Ignore socket check errors
          });

        return true;
      }
    }
    return false;
  }

  /**
   * Typing indicator from visitor.
   */
  @SubscribeMessage('chat:typing')
  handleTyping(@ConnectedSocket() client: Socket, @MessageBody() data: { isTyping: boolean }) {
    const session = (client as any).webChatSession as WebChatSession;
    if (!session?.conversationId) return;

    // Forward typing state to staff inbox
    this.inboxGateway.emitToBusinessRoom(session.businessId, 'webchat:typing', {
      conversationId: session.conversationId,
      isTyping: data.isTyping,
    });
  }

  /**
   * Identify a visitor by linking them to an existing customer record.
   * Re-issues JWT with customerId for future session resumption.
   * Payload: { email?: string, phone?: string }
   */
  @SubscribeMessage('session:identify')
  async handleSessionIdentify(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { email?: string; phone?: string },
  ) {
    const session = (client as any).webChatSession as WebChatSession;
    if (!session) return;

    if (!data?.email && !data?.phone) {
      client.emit('session:identify:error', { message: 'Email or phone required' });
      return;
    }

    try {
      const identifiers: any = {};
      if (data.email) identifiers.email = data.email;
      if (data.phone) identifiers.phone = data.phone;

      const customer = await this.customerIdentityService.resolveCustomer(
        session.businessId,
        identifiers,
      );

      session.customerId = customer.id;
      session.customerEmail = data.email;

      // Re-issue JWT with customerId
      const sessionToken = this.jwtService.sign(
        {
          sessionId: session.sessionId,
          businessId: session.businessId,
          customerId: customer.id,
          type: 'web-chat',
        },
        {
          secret: this.configService.get<string>('JWT_SECRET'),
          expiresIn: '24h',
        },
      );

      client.emit('session:identified', {
        customerId: customer.id,
        customerName: customer.name,
        sessionToken,
      });
    } catch (err: any) {
      this.logger.error(`Session identify error: ${err.message}`, err.stack);
      client.emit('session:identify:error', { message: 'Failed to identify session' });
    }
  }

  /**
   * Load paginated message history for the current conversation.
   * Payload: { cursor?: string, limit?: number }
   */
  @SubscribeMessage('history:request')
  async handleHistoryRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { cursor?: string; limit?: number },
  ) {
    const session = (client as any).webChatSession as WebChatSession;
    if (!session?.conversationId) {
      client.emit('history:error', { message: 'No active conversation' });
      return;
    }

    try {
      const take = Math.min(data?.limit || 20, 50);
      const messages = await this.prisma.message.findMany({
        where: { conversationId: session.conversationId },
        orderBy: { createdAt: 'desc' },
        take,
        ...(data?.cursor && {
          cursor: { id: data.cursor },
          skip: 1,
        }),
        select: {
          id: true,
          content: true,
          direction: true,
          createdAt: true,
          contentType: true,
        },
      });

      client.emit('history:response', {
        messages: messages.reverse(),
        hasMore: messages.length === take,
        cursor: messages.length > 0 ? messages[0].id : null,
      });
    } catch (err: any) {
      this.logger.error(`History request error: ${err.message}`, err.stack);
      client.emit('history:error', { message: 'Failed to load history' });
    }
  }

  private static readonly UPLOAD_ALLOWED_TYPES = [
    'image/png',
    'image/jpeg',
    'image/gif',
    'application/pdf',
  ];
  private static readonly UPLOAD_MAX_SIZE = 5 * 1024 * 1024; // 5MB

  @SubscribeMessage('file:upload-request')
  async handleFileUploadRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { fileName?: string; mimeType?: string; size?: number; data?: string },
  ) {
    const session = (client as any).webChatSession as WebChatSession | undefined;
    if (!session?.conversationId || !session?.businessId) {
      client.emit('file:upload-response', {
        supported: true,
        success: false,
        message: 'No active conversation. Please start a chat first.',
      });
      return;
    }

    if (!payload?.fileName || !payload?.mimeType || !payload?.data) {
      client.emit('file:upload-response', {
        supported: true,
        success: false,
        message: 'Missing required fields: fileName, mimeType, data.',
      });
      return;
    }

    if (!WebChatGateway.UPLOAD_ALLOWED_TYPES.includes(payload.mimeType)) {
      client.emit('file:upload-response', {
        supported: true,
        success: false,
        message: `Unsupported file type: ${payload.mimeType}. Allowed: PNG, JPEG, GIF, PDF.`,
      });
      return;
    }

    const buffer = Buffer.from(payload.data, 'base64');
    if (buffer.length > WebChatGateway.UPLOAD_MAX_SIZE) {
      client.emit('file:upload-response', {
        supported: true,
        success: false,
        message: `File too large (${(buffer.length / 1024 / 1024).toFixed(1)}MB). Maximum: 5MB.`,
      });
      return;
    }

    try {
      const fs = await import('fs');
      const path = await import('path');

      const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const ext = path.extname(payload.fileName) || this.mimeToExt(payload.mimeType);
      const fileKey = `${crypto.randomUUID()}${ext}`;
      const filePath = path.join(uploadDir, fileKey);
      fs.writeFileSync(filePath, buffer);

      // TODO: Move to S3/CloudFront for production scale
      const fileUrl = `/uploads/${fileKey}`;

      const message = await this.prisma.message.create({
        data: {
          conversationId: session.conversationId,
          content: `[File: ${payload.fileName}]`,
          direction: 'INBOUND',
          channel: 'WEB_CHAT',
          contentType: 'MEDIA',
          metadata: {
            attachment: {
              fileName: payload.fileName,
              mimeType: payload.mimeType,
              size: buffer.length,
              url: fileUrl,
            },
          },
        },
      });

      // Emit to conversation for staff to see
      this.inboxGateway.emitToBusinessRoom(session.businessId, 'message:new', {
        conversationId: session.conversationId,
        message: {
          id: message.id,
          content: message.content,
          direction: 'INBOUND',
          channel: 'WEB_CHAT',
          contentType: 'MEDIA',
          createdAt: message.createdAt,
          metadata: message.metadata,
        },
      });

      client.emit('file:upload-response', {
        supported: true,
        success: true,
        messageId: message.id,
        fileName: payload.fileName,
      });
    } catch (err: any) {
      this.logger.error(`File upload failed: ${err.message}`, err.stack);
      client.emit('file:upload-response', {
        supported: true,
        success: false,
        message: 'File upload failed. Please try again.',
      });
    }
  }

  private mimeToExt(mimeType: string): string {
    const map: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/gif': '.gif',
      'application/pdf': '.pdf',
    };
    return map[mimeType] || '';
  }

  getActiveSessions(businessId: string): WebChatSession[] {
    return Array.from(this.sessions.values()).filter((s) => s.businessId === businessId);
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}
