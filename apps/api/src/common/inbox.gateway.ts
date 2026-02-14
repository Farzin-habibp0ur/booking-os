import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002'],
  },
})
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  handleConnection(client: Socket) {
    try {
      const token =
        (client.handshake.auth?.token as string) ||
        (client.handshake.query.token as string);

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
}
