import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InboxGateway } from './inbox.gateway';

describe('InboxGateway', () => {
  let gateway: InboxGateway;
  let mockServer: { emit: jest.Mock; to: jest.Mock };

  beforeEach(async () => {
    mockServer = {
      emit: jest.fn(),
      to: jest.fn().mockReturnValue({ emit: jest.fn() }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboxGateway,
        { provide: JwtService, useValue: { verify: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'CORS_ORIGINS') return 'http://localhost:3000';
              if (key === 'JWT_SECRET') return 'test-secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    gateway = module.get<InboxGateway>(InboxGateway);
    (gateway as any).server = mockServer;
  });

  describe('emitToAll', () => {
    it('should emit event to all connected clients via server.emit', () => {
      const data = { provider: 'twilio', from: 'CLOSED', to: 'OPEN' };
      gateway.emitToAll('circuit:state-change', data);

      expect(mockServer.emit).toHaveBeenCalledWith('circuit:state-change', data);
    });

    it('should pass any event name and data through', () => {
      gateway.emitToAll('custom:event', { key: 'value' });

      expect(mockServer.emit).toHaveBeenCalledWith('custom:event', { key: 'value' });
    });

    it('should handle null/undefined data', () => {
      gateway.emitToAll('test:event', null);
      expect(mockServer.emit).toHaveBeenCalledWith('test:event', null);

      gateway.emitToAll('test:event', undefined);
      expect(mockServer.emit).toHaveBeenCalledWith('test:event', undefined);
    });
  });

  describe('emitToBusinessRoom', () => {
    it('should emit to the correct business room', () => {
      const roomEmit = jest.fn();
      mockServer.to.mockReturnValue({ emit: roomEmit });

      gateway.emitToBusinessRoom('biz1', 'message:new', { id: 'msg1' });

      expect(mockServer.to).toHaveBeenCalledWith('business:biz1');
      expect(roomEmit).toHaveBeenCalledWith('message:new', { id: 'msg1' });
    });
  });

  describe('notifyMessageStatus', () => {
    it('should emit message:status event to the correct business room', () => {
      const roomEmit = jest.fn();
      mockServer.to.mockReturnValue({ emit: roomEmit });

      const data = {
        conversationId: 'conv1',
        messageId: 'msg1',
        deliveryStatus: 'DELIVERED',
        deliveredAt: '2026-03-20T10:00:00Z',
      };

      gateway.notifyMessageStatus('biz1', data);

      expect(mockServer.to).toHaveBeenCalledWith('business:biz1');
      expect(roomEmit).toHaveBeenCalledWith('message:status', data);
    });

    it('should handle data with optional readAt field', () => {
      const roomEmit = jest.fn();
      mockServer.to.mockReturnValue({ emit: roomEmit });

      const data = {
        conversationId: 'conv1',
        messageId: 'msg1',
        deliveryStatus: 'READ',
        deliveredAt: '2026-03-20T10:00:00Z',
        readAt: '2026-03-20T10:05:00Z',
      };

      gateway.notifyMessageStatus('biz1', data);

      expect(roomEmit).toHaveBeenCalledWith('message:status', data);
    });
  });
});
