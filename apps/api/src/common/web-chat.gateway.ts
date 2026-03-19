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
export class WebChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(WebChatGateway.name);
  // In-memory session store (ephemeral — sessions don't survive restart)
  private sessions = new Map<string, WebChatSession>();

  constructor(
    private configService: ConfigService,
    private jwtService: JwtService,
    private prisma: PrismaService,
    private customerIdentityService: CustomerIdentityService,
    private conversationService: ConversationService,
    private inboxGateway: InboxGateway,
  ) {}

  afterInit(server: Server) {
    this.logger.log('WebChat gateway initialized on /web-chat namespace');
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
          const existingSession = this.sessions.get(payload.sessionId);
          if (existingSession) {
            existingSession.socketId = client.id;
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
      this.sessions.set(sessionId, session);

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
      this.logger.log(
        `WebChat new session: ${sessionId} for business ${businessId}`,
      );
    }

    // Store session ref on socket
    (client as any).webChatSession = session;
    client.join(`webchat:${session.sessionId}`);
  }

  handleDisconnect(client: Socket) {
    const session = (client as any).webChatSession as
      | WebChatSession
      | undefined;
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
      if (
        !data.email &&
        !data.phone &&
        !customer.webChatSessionId
      ) {
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
          this.inboxGateway.notifyConversationUpdate(
            session.businessId,
            updatedConv,
          );
        }
      }

      client.emit('chat:started', {
        conversationId: conversation.id,
        customerId: customer.id,
        customerName: customer.name,
      });
    } catch (err: any) {
      this.logger.error(
        `WebChat start error: ${err.message}`,
        err.stack,
      );
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
      this.logger.error(
        `WebChat message error: ${err.message}`,
        err.stack,
      );
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
      const customer = await this.customerIdentityService.resolveCustomer(
        session.businessId,
        { email: data.email, phone: data.phone, name: data.name },
      );

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
      this.logger.error(
        `WebChat offline form error: ${err.message}`,
        err.stack,
      );
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
        this.server
          .to(`webchat:${session.sessionId}`)
          .emit('chat:reply', {
            messageId: message.id,
            content: message.content,
            createdAt: message.createdAt,
            senderName: message.senderName || 'Support',
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
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { isTyping: boolean },
  ) {
    const session = (client as any).webChatSession as WebChatSession;
    if (!session?.conversationId) return;

    // Forward typing state to staff inbox
    this.inboxGateway.emitToBusinessRoom(
      session.businessId,
      'webchat:typing',
      {
        conversationId: session.conversationId,
        isTyping: data.isTyping,
      },
    );
  }

  getActiveSessions(businessId: string): WebChatSession[] {
    return Array.from(this.sessions.values()).filter(
      (s) => s.businessId === businessId,
    );
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}
