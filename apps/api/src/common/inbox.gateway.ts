import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3002'],
  },
})
export class InboxGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  handleConnection(client: Socket) {
    const businessId = client.handshake.query.businessId as string;
    if (businessId) {
      client.join(`business:${businessId}`);
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
