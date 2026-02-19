import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: (origin: string, callback: (err: Error | null, allow?: boolean) => void) => {
      // Dynamic CORS check happens in the gateway constructor via ConfigService
      // This default allows all origins; the actual restriction is applied at init
      callback(null, true);
    },
  },
})
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(InboxGateway.name);
  private allowedOrigins: string[];
  // Best-effort presence tracking (in-memory, ephemeral on restart)
  private presence = new Map<
    string,
    Set<{ staffId: string; staffName: string; socketId: string }>
  >();

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.allowedOrigins = configService.get<string>('CORS_ORIGINS')
      ? configService
          .get<string>('CORS_ORIGINS')!
          .split(',')
          .map((o) => o.trim())
      : ['http://localhost:3000', 'http://localhost:3002'];
  }

  async afterInit(server: Server) {
    // Apply dynamic CORS
    (server as any).opts = {
      ...(server as any).opts,
      cors: {
        origin: this.allowedOrigins,
        credentials: true,
      },
    };

    // Attach Redis adapter for multi-instance support when REDIS_URL is set
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      try {
        const { createClient } = await import('redis');
        const { createAdapter } = await import('@socket.io/redis-adapter');
        const pubClient = createClient({ url: redisUrl });
        const subClient = pubClient.duplicate();
        await Promise.all([pubClient.connect(), subClient.connect()]);
        server.adapter(createAdapter(pubClient, subClient) as any);
        this.logger.log('Redis adapter attached — WebSocket events shared across instances');
      } catch (err: any) {
        this.logger.warn(`Failed to attach Redis adapter: ${err.message}`);
      }
    }
  }

  handleConnection(client: Socket) {
    try {
      // Only accept token from auth header, not query params (prevents token leakage in logs/URLs)
      const token = client.handshake.auth?.token as string;

      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token, {
        secret: this.configService.get<string>('JWT_SECRET'),
      });

      if (!payload.businessId) {
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      // Store user info on socket for future use
      (client as any).user = payload;
      client.join(`business:${payload.businessId}`);
    } catch {
      client.emit('error', { message: 'Invalid or expired token' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const user = (client as any).user;
    this.logger.log(
      `Client disconnected: ${client.id}${user?.businessId ? ` (business: ${user.businessId})` : ''}`,
    );
    // Clean up presence for this socket
    for (const [conversationId, viewers] of this.presence.entries()) {
      for (const viewer of viewers) {
        if (viewer.socketId === client.id) {
          viewers.delete(viewer);
          if (user?.businessId) {
            this.emitToBusinessRoom(user.businessId, 'presence:update', {
              conversationId,
              viewers: Array.from(viewers).map((v) => ({
                staffId: v.staffId,
                staffName: v.staffName,
              })),
            });
          }
          break;
        }
      }
      if (viewers.size === 0) this.presence.delete(conversationId);
    }
  }

  @SubscribeMessage('viewing:start')
  handleViewingStart(client: Socket, data: { conversationId: string }) {
    const user = (client as any).user;
    if (!user?.businessId || !data?.conversationId) return;

    if (!this.presence.has(data.conversationId)) {
      this.presence.set(data.conversationId, new Set());
    }
    const viewers = this.presence.get(data.conversationId)!;
    // Remove any existing entry for this socket
    for (const v of viewers) {
      if (v.socketId === client.id) {
        viewers.delete(v);
        break;
      }
    }
    viewers.add({
      staffId: user.sub,
      staffName: user.name || 'Staff',
      socketId: client.id,
    });

    this.emitToBusinessRoom(user.businessId, 'presence:update', {
      conversationId: data.conversationId,
      viewers: Array.from(viewers).map((v) => ({
        staffId: v.staffId,
        staffName: v.staffName,
      })),
    });
  }

  @SubscribeMessage('viewing:stop')
  handleViewingStop(client: Socket, data: { conversationId: string }) {
    const user = (client as any).user;
    if (!user?.businessId || !data?.conversationId) return;

    const viewers = this.presence.get(data.conversationId);
    if (!viewers) return;

    for (const v of viewers) {
      if (v.socketId === client.id) {
        viewers.delete(v);
        break;
      }
    }

    this.emitToBusinessRoom(user.businessId, 'presence:update', {
      conversationId: data.conversationId,
      viewers: Array.from(viewers).map((v) => ({
        staffId: v.staffId,
        staffName: v.staffName,
      })),
    });

    if (viewers.size === 0) this.presence.delete(data.conversationId);
  }

  // Emit events to all clients in a business room
  emitToBusinessRoom(businessId: string, event: string, data: unknown) {
    this.server.to(`business:${businessId}`).emit(event, data);
  }

  notifyNewMessage(businessId: string, message: unknown) {
    this.emitToBusinessRoom(businessId, 'message:new', message);
  }

  notifyConversationUpdate(businessId: string, conversation: unknown) {
    this.emitToBusinessRoom(businessId, 'conversation:update', conversation);
  }

  notifyBookingUpdate(businessId: string, booking: unknown) {
    this.emitToBusinessRoom(businessId, 'booking:update', booking);
  }

  notifyAiSuggestions(businessId: string, data: unknown) {
    this.emitToBusinessRoom(businessId, 'ai:suggestions', data);
  }
}
