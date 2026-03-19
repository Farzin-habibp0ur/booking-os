import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CircuitBreakerService, CircuitOpenException } from './circuit-breaker.service';

// Mock ConfigService with no REDIS_URL to test in-memory mode
const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

describe('CircuitBreakerService', () => {
  let service: CircuitBreakerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CircuitBreakerService, { provide: ConfigService, useValue: mockConfig }],
    }).compile();

    service = module.get<CircuitBreakerService>(CircuitBreakerService);
    await service.onModuleInit();
  });

  describe('execute — CLOSED state', () => {
    it('should run fn successfully when circuit is CLOSED', async () => {
      const result = await service.execute('whatsapp', async () => 'ok');
      expect(result).toBe('ok');
    });

    it('should return the value from fn', async () => {
      const result = await service.execute('whatsapp', async () => ({
        sent: true,
      }));
      expect(result).toEqual({ sent: true });
    });

    it('should propagate errors from fn', async () => {
      await expect(
        service.execute('whatsapp', async () => {
          throw new Error('send failed');
        }),
      ).rejects.toThrow('send failed');
    });

    it('should record failures on error', async () => {
      try {
        await service.execute('whatsapp', async () => {
          throw new Error('fail');
        });
      } catch {}

      const state = await service.getState('whatsapp');
      expect(state.failures).toBe(1);
      expect(state.state).toBe('CLOSED');
    });

    it('should remain CLOSED when failures are below threshold', async () => {
      for (let i = 0; i < 4; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      const state = await service.getState('whatsapp');
      expect(state.failures).toBe(4);
      expect(state.state).toBe('CLOSED');
    });
  });

  describe('execute — threshold and OPEN state', () => {
    it('should open circuit after 5 failures', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      const state = await service.getState('whatsapp');
      expect(state.state).toBe('OPEN');
      expect(state.failures).toBe(5);
    });

    it('should throw CircuitOpenException when circuit is OPEN', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      await expect(service.execute('whatsapp', async () => 'should not run')).rejects.toThrow(
        CircuitOpenException,
      );
    });

    it('should include provider name in CircuitOpenException', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('twilio-sms', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      try {
        await service.execute('twilio-sms', async () => 'nope');
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CircuitOpenException);
        expect((err as CircuitOpenException).providerName).toBe('twilio-sms');
      }
    });

    it('should not call fn when circuit is OPEN (within cooldown)', async () => {
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      const fn = jest.fn().mockResolvedValue('should not run');
      await expect(service.execute('whatsapp', fn)).rejects.toThrow(CircuitOpenException);
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('execute — HALF_OPEN state', () => {
    it('should transition to HALF_OPEN after cooldown expires', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      // Fast-forward past cooldown by manipulating state
      const state = await service.getState('whatsapp');
      // Set lastStateChange to 31 seconds ago
      (service as any).memoryStore.set('whatsapp', {
        ...state,
        lastStateChange: Date.now() - 31_000,
      });

      // The next call should attempt (HALF_OPEN)
      const result = await service.execute('whatsapp', async () => 'recovered');
      expect(result).toBe('recovered');

      const newState = await service.getState('whatsapp');
      expect(newState.state).toBe('CLOSED');
    });

    it('should transition HALF_OPEN -> CLOSED on success', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      // Fast-forward past cooldown
      const state = await service.getState('whatsapp');
      (service as any).memoryStore.set('whatsapp', {
        ...state,
        lastStateChange: Date.now() - 31_000,
      });

      await service.execute('whatsapp', async () => 'ok');

      const newState = await service.getState('whatsapp');
      expect(newState.state).toBe('CLOSED');
      expect(newState.failures).toBe(0);
    });

    it('should transition HALF_OPEN -> OPEN on failure', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      // Fast-forward past cooldown
      const state = await service.getState('whatsapp');
      (service as any).memoryStore.set('whatsapp', {
        ...state,
        lastStateChange: Date.now() - 31_000,
      });

      await expect(
        service.execute('whatsapp', async () => {
          throw new Error('still broken');
        }),
      ).rejects.toThrow('still broken');

      const newState = await service.getState('whatsapp');
      expect(newState.state).toBe('OPEN');
    });
  });

  describe('getState', () => {
    it('should return default CLOSED state for unknown provider', async () => {
      const state = await service.getState('unknown-provider');
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
      expect(state.lastFailureAt).toBe(0);
      expect(state.lastStateChange).toBe(0);
    });

    it('should return correct state after failures', async () => {
      try {
        await service.execute('instagram', async () => {
          throw new Error('fail');
        });
      } catch {}

      const state = await service.getState('instagram');
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(1);
      expect(state.lastFailureAt).toBeGreaterThan(0);
    });
  });

  describe('resetCircuit', () => {
    it('should reset an OPEN circuit to CLOSED', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      expect((await service.getState('whatsapp')).state).toBe('OPEN');

      await service.resetCircuit('whatsapp');

      const state = await service.getState('whatsapp');
      expect(state.state).toBe('CLOSED');
      expect(state.failures).toBe(0);
    });

    it('should allow calls after reset', async () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      await service.resetCircuit('whatsapp');

      const result = await service.execute('whatsapp', async () => 'working again');
      expect(result).toBe('working again');
    });
  });

  describe('getAllStates', () => {
    it('should return empty record when no providers tracked', async () => {
      const states = await service.getAllStates();
      expect(states).toEqual({});
    });

    it('should return all tracked providers', async () => {
      // Trigger failures on two providers
      try {
        await service.execute('whatsapp', async () => {
          throw new Error('fail');
        });
      } catch {}
      try {
        await service.execute('instagram', async () => {
          throw new Error('fail');
        });
      } catch {}

      const states = await service.getAllStates();
      expect(Object.keys(states)).toContain('whatsapp');
      expect(Object.keys(states)).toContain('instagram');
      expect(states['whatsapp'].failures).toBe(1);
      expect(states['instagram'].failures).toBe(1);
    });
  });

  describe('in-memory fallback', () => {
    it('should use in-memory store when REDIS_URL is not configured', async () => {
      expect(mockConfig.get).toHaveBeenCalledWith('REDIS_URL');
      // Service should work fine without Redis
      const result = await service.execute('resend', async () => 'sent');
      expect(result).toBe('sent');
    });
  });

  describe('failure window', () => {
    it('should reset failure count when failures are outside the window', async () => {
      // Record 3 failures
      for (let i = 0; i < 3; i++) {
        try {
          await service.execute('sendgrid', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      expect((await service.getState('sendgrid')).failures).toBe(3);

      // Move lastFailureAt outside the 60s window
      const state = await service.getState('sendgrid');
      (service as any).memoryStore.set('sendgrid', {
        ...state,
        lastFailureAt: Date.now() - 61_000,
      });

      // Next failure should start fresh (count = 1, not 4)
      try {
        await service.execute('sendgrid', async () => {
          throw new Error('fail again');
        });
      } catch {}

      const newState = await service.getState('sendgrid');
      expect(newState.failures).toBe(1);
      expect(newState.state).toBe('CLOSED');
    });

    it('should not open circuit if failures are spread across windows', async () => {
      // 4 failures in first window
      for (let i = 0; i < 4; i++) {
        try {
          await service.execute('facebook', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      // Move outside window
      const state = await service.getState('facebook');
      (service as any).memoryStore.set('facebook', {
        ...state,
        lastFailureAt: Date.now() - 61_000,
      });

      // 4 more failures in new window — should NOT reach threshold (resets to 0 + 4 = 4)
      for (let i = 0; i < 4; i++) {
        try {
          await service.execute('facebook', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      const newState = await service.getState('facebook');
      expect(newState.state).toBe('CLOSED');
      expect(newState.failures).toBe(4);
    });
  });

  describe('provider isolation', () => {
    it('should track each provider independently', async () => {
      // Open whatsapp circuit
      for (let i = 0; i < 5; i++) {
        try {
          await service.execute('whatsapp', async () => {
            throw new Error('fail');
          });
        } catch {}
      }

      // Instagram should still be CLOSED
      const result = await service.execute('instagram', async () => 'ok');
      expect(result).toBe('ok');

      expect((await service.getState('whatsapp')).state).toBe('OPEN');
      expect((await service.getState('instagram')).state).toBe('CLOSED');
    });
  });
});
