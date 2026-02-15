import {
  WebSocketGateway,
  WebSocketServer,
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

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.allowedOrigins = configService.get<string>('CORS_ORIGINS')
      ? configService.get<string>('CORS_ORIGINS')!.split(',').map((o) => o.trim())
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

  handleDisconnect(_client: Socket) {
    // Socket.IO handles room cleanup automatically
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
