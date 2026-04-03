import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Redis-backed store for portal OTPs and JWT blacklist.
 * Falls back to in-memory Maps when REDIS_URL is not configured.
 */
@Injectable()
export class PortalRedisService implements OnModuleInit {
  private readonly logger = new Logger(PortalRedisService.name);
  private client: any = null;
  private useRedis = false;

  // In-memory fallbacks
  private memoryStore = new Map<string, { value: string; expiresAt: number }>();
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(private config: ConfigService) {
    this.cleanupTimer = setInterval(() => this.cleanupMemory(), 60 * 1000);
    this.cleanupTimer.unref();
  }

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL');
    if (!redisUrl) {
      this.logger.log('No REDIS_URL — portal OTP/blacklist using in-memory store');
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
      this.logger.log('Portal Redis store connected');
    } catch (err: any) {
      this.logger.warn(`Failed to connect Redis: ${err.message} — using in-memory fallback`);
    }
  }

  async set(key: string, value: string, ttlMs: number): Promise<void> {
    if (this.useRedis && this.client) {
      try {
        await this.client.set(key, value, { PX: ttlMs });
        return;
      } catch {
        this.logger.warn('Redis SET failed, falling back to memory');
      }
    }
    this.memoryStore.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  async get(key: string): Promise<string | null> {
    if (this.useRedis && this.client) {
      try {
        return await this.client.get(key);
      } catch {
        this.logger.warn('Redis GET failed, falling back to memory');
      }
    }
    const entry = this.memoryStore.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return null;
    }
    return entry.value;
  }

  async del(key: string): Promise<void> {
    if (this.useRedis && this.client) {
      try {
        await this.client.del(key);
        return;
      } catch {
        this.logger.warn('Redis DEL failed, falling back to memory');
      }
    }
    this.memoryStore.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    if (this.useRedis && this.client) {
      try {
        return (await this.client.exists(key)) === 1;
      } catch {
        this.logger.warn('Redis EXISTS failed, falling back to memory');
      }
    }
    const entry = this.memoryStore.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.memoryStore.delete(key);
      return false;
    }
    return true;
  }

  async incr(key: string, ttlMs?: number): Promise<number> {
    if (this.useRedis && this.client) {
      try {
        const val = await this.client.incr(key);
        if (ttlMs && val === 1) {
          await this.client.pExpire(key, ttlMs);
        }
        return val;
      } catch {
        this.logger.warn('Redis INCR failed, falling back to memory');
      }
    }
    const entry = this.memoryStore.get(key);
    const now = Date.now();
    if (entry && now <= entry.expiresAt) {
      const newVal = parseInt(entry.value, 10) + 1;
      entry.value = String(newVal);
      return newVal;
    }
    const expiresAt = ttlMs ? now + ttlMs : now + 86400000;
    this.memoryStore.set(key, { value: '1', expiresAt });
    return 1;
  }

  isRedisConnected(): boolean {
    return this.useRedis;
  }

  /** Clear all in-memory entries — for tests */
  clearMemory() {
    this.memoryStore.clear();
  }

  private cleanupMemory() {
    const now = Date.now();
    for (const [key, entry] of this.memoryStore) {
      if (now > entry.expiresAt) this.memoryStore.delete(key);
    }
  }
}
