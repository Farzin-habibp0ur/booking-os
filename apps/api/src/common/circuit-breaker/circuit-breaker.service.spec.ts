import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService, CircuitOpenException } from './circuit-breaker.service';
import { InboxGateway } from '../inbox.gateway';

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;
  let inboxGateway: { emitToAll: jest.Mock };

  beforeEach(async () => {
    inboxGateway = { emitToAll: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CircuitBreakerService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
        { provide: InboxGateway, useValue: inboxGateway },
      ],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
  });

  describe('state change broadcasts', () => {
    it('should emit circuit:state-change when transitioning to OPEN after threshold failures', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-provider', async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      expect(inboxGateway.emitToAll).toHaveBeenCalledWith(
        'circuit:state-change',
        expect.objectContaining({
          provider: 'test-provider',
          from: 'CLOSED',
          to: 'OPEN',
          timestamp: expect.any(String),
        }),
      );
    });

    it('should emit circuit:state-change when transitioning from OPEN to HALF_OPEN', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-provider', async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      jest.clearAllMocks();

      const memoryStore = (service as any).memoryStore as Map<string, any>;
      const state = memoryStore.get('test-provider');
      state.lastStateChange = Date.now() - 60_000;
      memoryStore.set('test-provider', state);

      try {
        await service.execute('test-provider', async () => 'ok');
      } catch {
        // may throw
      }

      expect(inboxGateway.emitToAll).toHaveBeenCalledWith(
        'circuit:state-change',
        expect.objectContaining({
          provider: 'test-provider',
          to: 'HALF_OPEN',
        }),
      );
    });

    it('should emit circuit:state-change when transitioning from HALF_OPEN to CLOSED on success', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-provider', async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      const memoryStore = (service as any).memoryStore as Map<string, any>;
      const state = memoryStore.get('test-provider');
      state.lastStateChange = Date.now() - 60_000;
      memoryStore.set('test-provider', state);

      jest.clearAllMocks();

      const result = await service.execute('test-provider', async () => 'success');

      expect(result).toBe('success');
      expect(inboxGateway.emitToAll).toHaveBeenCalledWith(
        'circuit:state-change',
        expect.objectContaining({
          provider: 'test-provider',
          to: 'CLOSED',
        }),
      );
    });

    it('should not throw if inboxGateway.emitToAll throws (graceful degradation)', async () => {
      inboxGateway.emitToAll.mockImplementation(() => {
        throw new Error('Gateway not ready');
      });

      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('test-provider', async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      const state = await service.getState('test-provider');
      expect(state.state).toBe('OPEN');
    });
  });

  describe('core circuit breaker behavior', () => {
    it('should pass through successful calls in CLOSED state', async () => {
      const result = await service.execute('provider', async () => 'ok');
      expect(result).toBe('ok');
    });

    it('should throw CircuitOpenException when circuit is OPEN and cooldown not expired', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('provider', async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      await expect(service.execute('provider', async () => 'ok')).rejects.toThrow(
        CircuitOpenException,
      );
    });

    it('should reset circuit via resetCircuit', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('provider', async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      await service.resetCircuit('provider');
      const state = await service.getState('provider');
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
    });
  });

  describe('per-provider configuration', () => {
    it('should return default config for unknown providers', () => {
      const config = service.getProviderConfig('unknown-provider');
      expect(config).toEqual({
        failureThreshold: 5,
        failureWindowMs: 60_000,
        cooldownMs: 30_000,
      });
    });

    it('should return custom config for twilio-sms', () => {
      const config = service.getProviderConfig('twilio-sms');
      expect(config.failureThreshold).toBe(3);
      expect(config.failureWindowMs).toBe(30_000);
      expect(config.cooldownMs).toBe(20_000);
    });

    it('should allow runtime config updates', () => {
      service.setProviderConfig('whatsapp', { failureThreshold: 10 });
      const config = service.getProviderConfig('whatsapp');
      expect(config.failureThreshold).toBe(10);
      expect(config.cooldownMs).toBe(30_000); // unchanged
    });

    it('should use provider-specific threshold for twilio-sms (3 failures instead of 5)', async () => {
      // twilio-sms has threshold of 3
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('twilio-sms', async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      const state = await service.getState('twilio-sms');
      expect(state.state).toBe('OPEN');
    });

    it('should NOT open circuit for whatsapp after 3 failures (threshold is 5)', async () => {
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {
          // expected
        }
      }

      const state = await service.getState('whatsapp');
      expect(state.state).toBe('CLOSED');
    });
  });
});
