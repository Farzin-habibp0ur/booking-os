import { Injectable, Logger, OnModuleInit, Inject, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InboxGateway } from '../inbox.gateway';

export class CircuitOpenException extends Error {
  constructor(public readonly providerName: string) {
    super(`Circuit breaker OPEN for provider: ${providerName}`);
    this.name = 'CircuitOpenException';
  }
}

type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface CircuitBreakerState {
  state: CircuitState;
  failures: number;
  lastFailureAt: number;
  lastStateChange: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  failureWindowMs: number;
  cooldownMs: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  failureWindowMs: 60_000,
  cooldownMs: 30_000,
};

const REDIS_KEY_PREFIX = 'cb:';

@Injectable()
export class CircuitBreakerService implements OnModuleInit {
  private readonly logger = new Logger(CircuitBreakerService.name);
  private client: any = null;
  private useRedis = false;

  // In-memory fallback
  private memoryStore = new Map<string, CircuitBreakerState>();

  // Per-provider configuration
  private providerConfigs = new Map<string, CircuitBreakerConfig>();

  constructor(
    private config: ConfigService,
    @Inject(forwardRef(() => InboxGateway)) private inboxGateway: InboxGateway,
  ) {
    // SMS is expensive per message — be more sensitive
    this.providerConfigs.set('twilio-sms', {
      failureThreshold: 3,
      failureWindowMs: 30_000,
      cooldownMs: 20_000,
    });
    // Meta APIs share infrastructure
    this.providerConfigs.set('whatsapp', DEFAULT_CONFIG);
    this.providerConfigs.set('instagram', DEFAULT_CONFIG);
    this.providerConfigs.set('facebook', DEFAULT_CONFIG);
    // Email providers
    this.providerConfigs.set('resend', DEFAULT_CONFIG);
    this.providerConfigs.set('sendgrid', DEFAULT_CONFIG);
  }

  getProviderConfig(provider: string): CircuitBreakerConfig {
    return this.providerConfigs.get(provider) || DEFAULT_CONFIG;
  }

  setProviderConfig(provider: string, config: Partial<CircuitBreakerConfig>): void {
    const current = this.getProviderConfig(provider);
    this.providerConfigs.set(provider, { ...current, ...config });
    this.logger.log(
      `Circuit breaker config updated for ${provider}: ${JSON.stringify(this.providerConfigs.get(provider))}`,
    );
  }

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.log('No REDIS_URL — circuit breaker using in-memory store');
      return;
    }

    try {
      const { createClient } = await import('redis');
      this.client = createClient({ url: redisUrl });
      this.client.on('error', (err: any) => {
        this.logger.warn(`Redis error, falling back to memory: ${err.message}`);
        this.useRedis = false;
      });
      await this.client.connect();
      this.useRedis = true;
      this.logger.log('Circuit breaker Redis store connected');
    } catch (err: any) {
      this.logger.warn(`Failed to connect Redis: ${err.message} — using in-memory fallback`);
    }
  }

  /**
   * Execute a function with circuit breaker protection.
   *
   * CLOSED: run fn; on failure record it; if threshold reached -> OPEN
   * OPEN: check cooldown; if expired -> HALF_OPEN and try fn; else throw CircuitOpenException
   * HALF_OPEN: try fn; on success -> CLOSED; on failure -> OPEN
   */
  async execute<T>(providerName: string, fn: () => Promise<T>): Promise<T> {
    const current = await this.getState(providerName);
    const cfg = this.getProviderConfig(providerName);

    if (current.state === 'OPEN') {
      const elapsed = Date.now() - current.lastStateChange;
      if (elapsed >= cfg.cooldownMs) {
        // Transition to HALF_OPEN and attempt
        await this.transitionState(providerName, 'HALF_OPEN');
        return this.attemptHalfOpen(providerName, fn);
      }
      throw new CircuitOpenException(providerName);
    }

    if (current.state === 'HALF_OPEN') {
      return this.attemptHalfOpen(providerName, fn);
    }

    // CLOSED state
    try {
      const result = await fn();
      return result;
    } catch (error) {
      await this.recordFailure(providerName);
      throw error;
    }
  }

  async getState(providerName: string): Promise<CircuitBreakerState> {
    if (this.useRedis && this.client) {
      try {
        return await this.getStateFromRedis(providerName);
      } catch {
        this.logger.warn('Redis GET failed for circuit state, falling back to memory');
      }
    }
    return this.getStateFromMemory(providerName);
  }

  async resetCircuit(providerName: string): Promise<void> {
    const defaultState: CircuitBreakerState = {
      state: 'CLOSED',
      failures: 0,
      lastFailureAt: 0,
      lastStateChange: Date.now(),
    };

    if (this.useRedis && this.client) {
      try {
        await this.saveStateToRedis(providerName, defaultState);
        this.logger.log(`Circuit reset for provider: ${providerName}`);
        return;
      } catch {
        this.logger.warn('Redis SET failed for circuit reset, falling back to memory');
      }
    }

    this.memoryStore.set(providerName, defaultState);
    this.logger.log(`Circuit reset for provider: ${providerName}`);
  }

  async getAllStates(): Promise<Record<string, CircuitBreakerState>> {
    const result: Record<string, CircuitBreakerState> = {};

    if (this.useRedis && this.client) {
      try {
        const keys: string[] = await this.client.keys(`${REDIS_KEY_PREFIX}*:state`);
        const providers = keys.map((k: string) =>
          k.replace(REDIS_KEY_PREFIX, '').replace(':state', ''),
        );
        for (const provider of providers) {
          result[provider] = await this.getStateFromRedis(provider);
        }
        return result;
      } catch {
        this.logger.warn('Redis KEYS failed, falling back to memory');
      }
    }

    for (const [provider, state] of this.memoryStore) {
      result[provider] = { ...state };
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async attemptHalfOpen<T>(providerName: string, fn: () => Promise<T>): Promise<T> {
    try {
      const result = await fn();
      // Success -> CLOSED
      await this.transitionState(providerName, 'CLOSED');
      this.logger.log(`Circuit CLOSED for provider: ${providerName} (test call succeeded)`);
      return result;
    } catch (error) {
      // Failure -> OPEN
      await this.transitionState(providerName, 'OPEN');
      this.logger.warn(
        `Circuit OPEN for provider: ${providerName} (test call failed in HALF_OPEN)`,
      );
      throw error;
    }
  }

  private async recordFailure(providerName: string): Promise<void> {
    const current = await this.getState(providerName);
    const cfg = this.getProviderConfig(providerName);
    const now = Date.now();

    // Reset failure count if outside the failure window
    let failures = current.failures;
    if (now - current.lastFailureAt > cfg.failureWindowMs) {
      failures = 0;
    }

    failures += 1;

    if (failures >= cfg.failureThreshold) {
      // Transition to OPEN
      const openState: CircuitBreakerState = {
        state: 'OPEN',
        failures,
        lastFailureAt: now,
        lastStateChange: now,
      };
      await this.saveState(providerName, openState);
      this.logger.warn(
        `Circuit OPEN for provider: ${providerName} (${failures} failures in window)`,
      );

      try {
        this.inboxGateway.emitToAll('circuit:state-change', {
          provider: providerName,
          from: 'CLOSED',
          to: 'OPEN',
          timestamp: new Date().toISOString(),
        });
      } catch {
        // InboxGateway may not be ready during startup
      }
    } else {
      const updatedState: CircuitBreakerState = {
        ...current,
        failures,
        lastFailureAt: now,
      };
      await this.saveState(providerName, updatedState);
    }
  }

  private async transitionState(providerName: string, newState: CircuitState): Promise<void> {
    const current = await this.getState(providerName);
    const updated: CircuitBreakerState = {
      ...current,
      state: newState,
      lastStateChange: Date.now(),
      ...(newState === 'CLOSED' ? { failures: 0, lastFailureAt: 0 } : {}),
    };
    await this.saveState(providerName, updated);
    this.logger.log(`Circuit state change for ${providerName}: ${current.state} -> ${newState}`);

    // Broadcast state change to all connected clients
    try {
      this.inboxGateway.emitToAll('circuit:state-change', {
        provider: providerName,
        from: current.state,
        to: newState,
        timestamp: new Date().toISOString(),
      });
    } catch {
      // InboxGateway may not be ready during startup
    }
  }

  private async saveState(providerName: string, state: CircuitBreakerState): Promise<void> {
    if (this.useRedis && this.client) {
      try {
        await this.saveStateToRedis(providerName, state);
        return;
      } catch {
        this.logger.warn('Redis SET failed, falling back to memory');
      }
    }
    this.memoryStore.set(providerName, state);
  }

  // Redis helpers

  private async getStateFromRedis(providerName: string): Promise<CircuitBreakerState> {
    const prefix = `${REDIS_KEY_PREFIX}${providerName}`;
    const [state, failures, lastFailureAt, lastStateChange] = await Promise.all([
      this.client.get(`${prefix}:state`),
      this.client.get(`${prefix}:failures`),
      this.client.get(`${prefix}:lastFailure`),
      this.client.get(`${prefix}:lastStateChange`),
    ]);

    return {
      state: (state as CircuitState) || 'CLOSED',
      failures: parseInt(failures || '0', 10),
      lastFailureAt: parseInt(lastFailureAt || '0', 10),
      lastStateChange: parseInt(lastStateChange || '0', 10),
    };
  }

  private async saveStateToRedis(providerName: string, s: CircuitBreakerState): Promise<void> {
    const prefix = `${REDIS_KEY_PREFIX}${providerName}`;
    await Promise.all([
      this.client.set(`${prefix}:state`, s.state),
      this.client.set(`${prefix}:failures`, String(s.failures)),
      this.client.set(`${prefix}:lastFailure`, String(s.lastFailureAt)),
      this.client.set(`${prefix}:lastStateChange`, String(s.lastStateChange)),
    ]);
  }

  // Memory helpers

  private getStateFromMemory(providerName: string): CircuitBreakerState {
    return (
      this.memoryStore.get(providerName) || {
        state: 'CLOSED',
        failures: 0,
        lastFailureAt: 0,
        lastStateChange: 0,
      }
    );
  }
}
