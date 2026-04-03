import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class DistributedLockService implements OnModuleInit {
  private readonly logger = new Logger(DistributedLockService.name);
  private redis: Redis | null = null;

  onModuleInit() {
    if (process.env.REDIS_URL) {
      this.redis = new Redis(process.env.REDIS_URL);
      this.redis.on('error', (err) => {
        this.logger.warn(`Redis lock client error: ${err.message}`);
      });
    }
  }

  /**
   * Acquire a distributed lock using Redis SET NX EX.
   * Returns an unlock function on success, or null if the lock is already held.
   * When Redis is unavailable (dev mode), returns a no-op unlock function (no locking).
   */
  async acquire(key: string, ttlMs: number = 60_000): Promise<(() => Promise<void>) | null> {
    if (!this.redis) {
      // No Redis — no distributed locking; allow all calls through (dev/test mode)
      return async () => {};
    }

    const lockValue = `${Date.now()}-${Math.random()}`;
    const result = await this.redis.set(key, lockValue, 'PX', ttlMs, 'NX');

    if (result !== 'OK') return null; // Lock already held by another instance

    return async () => {
      // Atomic release: only delete if we still own the lock
      const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
      await this.redis!.eval(script, 1, key, lockValue);
    };
  }
}
