import { InboxGateway } from './inbox.gateway';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

describe('InboxGateway', () => {
  let gateway: InboxGateway;
  let jwtService: { verify: jest.Mock };
  let configService: { get: jest.Mock };

  function createMockSocket(auth?: { token?: string }) {
    return {
      handshake: { auth: auth || {} },
      emit: jest.fn(),
      disconnect: jest.fn(),
      join: jest.fn(),
    } as any;
  }

  function createMockServer() {
    const mockRoom = { emit: jest.fn() };
    return {
      to: jest.fn().mockReturnValue(mockRoom),
      adapter: jest.fn(),
      opts: {},
      _mockRoom: mockRoom,
    } as any;
  }

  beforeEach(() => {
    jwtService = { verify: jest.fn() };
    configService = {
      get: jest.fn((key: string) => {
        const config: Record<string, string> = {
          JWT_SECRET: 'test-secret',
          CORS_ORIGINS: 'http://localhost:3000,http://localhost:3002',
        };
        return config[key];
      }),
    };
    gateway = new InboxGateway(
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );
    gateway.server = createMockServer();
  });

  describe('constructor', () => {
    it('parses CORS_ORIGINS from config', () => {
      expect(configService.get).toHaveBeenCalledWith('CORS_ORIGINS');
    });

    it('uses defaults when CORS_ORIGINS is not set', () => {
      configService.get.mockReturnValue(undefined);
      const gw = new InboxGateway(
        jwtService as unknown as JwtService,
        configService as unknown as ConfigService,
      );
      expect(gw).toBeDefined();
    });
  });

  describe('afterInit', () => {
    it('applies CORS settings to server', async () => {
      const server = createMockServer();
      configService.get.mockImplementation((key: string) => {
        if (key === 'CORS_ORIGINS') return 'http://localhost:3000';
        return undefined;
      });

      await gateway.afterInit(server);
      expect(server.opts.cors).toBeDefined();
      expect(server.opts.cors.credentials).toBe(true);
    });

    it('skips Redis adapter when REDIS_URL not set', async () => {
      const server = createMockServer();
      configService.get.mockImplementation((key: string) => {
        if (key === 'REDIS_URL') return undefined;
        return undefined;
      });

      await gateway.afterInit(server);
      expect(server.adapter).not.toHaveBeenCalled();
    });
  });

  describe('handleConnection', () => {
    it('authenticates valid token and joins business room', () => {
      jwtService.verify.mockReturnValue({ sub: 'staff1', businessId: 'biz1' });
      const socket = createMockSocket({ token: 'valid-jwt' });

      gateway.handleConnection(socket);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-jwt', { secret: 'test-secret' });
      expect(socket.join).toHaveBeenCalledWith('business:biz1');
      expect((socket as any).user).toEqual({ sub: 'staff1', businessId: 'biz1' });
    });

    it('disconnects when no token is provided', () => {
      const socket = createMockSocket({});

      gateway.handleConnection(socket);
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required' });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when token is missing in auth object', () => {
      const socket = createMockSocket({ token: undefined });

      gateway.handleConnection(socket);
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Authentication required' });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when token verification fails', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });
      const socket = createMockSocket({ token: 'bad-jwt' });

      gateway.handleConnection(socket);
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid or expired token' });
      expect(socket.disconnect).toHaveBeenCalled();
    });

    it('disconnects when token has no businessId', () => {
      jwtService.verify.mockReturnValue({ sub: 'staff1' });
      const socket = createMockSocket({ token: 'valid-but-no-biz' });

      gateway.handleConnection(socket);
      expect(socket.emit).toHaveBeenCalledWith('error', { message: 'Invalid token' });
      expect(socket.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleDisconnect', () => {
    it('does not throw', () => {
      const socket = createMockSocket();
      socket.id = 'socket-123';
      expect(() => gateway.handleDisconnect(socket)).not.toThrow();
    });

    it('logs disconnect with business id when user is set', () => {
      const socket = createMockSocket();
      socket.id = 'socket-456';
      (socket as any).user = { businessId: 'biz1', sub: 'staff1' };

      const logSpy = jest.spyOn((gateway as any).logger, 'log');
      gateway.handleDisconnect(socket);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('socket-456'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('biz1'));
    });

    it('logs disconnect without business id when user is not set', () => {
      const socket = createMockSocket();
      socket.id = 'socket-789';

      const logSpy = jest.spyOn((gateway as any).logger, 'log');
      gateway.handleDisconnect(socket);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('socket-789'));
      expect(logSpy).toHaveBeenCalledWith(expect.not.stringContaining('business:'));
    });
  });

  describe('emitToBusinessRoom', () => {
    it('emits event to correct business room', () => {
      const data = { message: 'test' };
      gateway.emitToBusinessRoom('biz1', 'test:event', data);

      expect(gateway.server.to).toHaveBeenCalledWith('business:biz1');
      expect((gateway.server as any)._mockRoom.emit).toHaveBeenCalledWith('test:event', data);
    });
  });

  describe('notifyNewMessage', () => {
    it('emits message:new event', () => {
      const msg = { id: 'msg1', content: 'Hello' };
      gateway.notifyNewMessage('biz1', msg);

      expect(gateway.server.to).toHaveBeenCalledWith('business:biz1');
      expect((gateway.server as any)._mockRoom.emit).toHaveBeenCalledWith('message:new', msg);
    });
  });

  describe('notifyConversationUpdate', () => {
    it('emits conversation:update event', () => {
      const conv = { id: 'conv1' };
      gateway.notifyConversationUpdate('biz1', conv);

      expect((gateway.server as any)._mockRoom.emit).toHaveBeenCalledWith(
        'conversation:update',
        conv,
      );
    });
  });

  describe('notifyBookingUpdate', () => {
    it('emits booking:update event', () => {
      const booking = { id: 'book1' };
      gateway.notifyBookingUpdate('biz1', booking);

      expect((gateway.server as any)._mockRoom.emit).toHaveBeenCalledWith(
        'booking:update',
        booking,
      );
    });
  });

  describe('notifyAiSuggestions', () => {
    it('emits ai:suggestions event', () => {
      const data = { suggestions: ['Try this'] };
      gateway.notifyAiSuggestions('biz1', data);

      expect((gateway.server as any)._mockRoom.emit).toHaveBeenCalledWith('ai:suggestions', data);
    });
  });
});
