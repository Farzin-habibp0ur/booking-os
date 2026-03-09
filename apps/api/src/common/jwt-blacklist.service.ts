import { Injectable, Optional } from '@nestjs/common';
import { createHash } from 'crypto';
import { PortalRedisService } from './portal-redis.service';

const BLACKLIST_PREFIX = 'jwt-blacklist:';

/**
 * JWT blacklist for token revocation.
 * Uses Redis when available (via PortalRedisService), falls back to in-memory.
 */
@Injectable()
export class JwtBlacklistService {
  private memoryBlacklist = new Map<string, number>();

  constructor(@Optional() private redisStore?: PortalRedisService) {
    // Cleanup expired in-memory entries every 5 minutes
    const timer = setInterval(() => this.cleanupMemory(), 5 * 60 * 1000);
    timer.unref();
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async blacklistToken(token: string, ttlMs = 15 * 60 * 1000) {
    const h = this.hash(token);

    if (this.redisStore) {
      try {
        await this.redisStore.set(`${BLACKLIST_PREFIX}${h}`, '1', ttlMs);
        return;
      } catch {
        // fall through to memory
      }
    }
    this.memoryBlacklist.set(h, Date.now() + ttlMs);
  }

  async isBlacklisted(token: string): Promise<boolean> {
    const h = this.hash(token);

    if (this.redisStore) {
      try {
        const exists = await this.redisStore.exists(`${BLACKLIST_PREFIX}${h}`);
        if (exists) return true;
      } catch {
        // fall through to memory check
      }
    }

    const expiry = this.memoryBlacklist.get(h);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.memoryBlacklist.delete(h);
      return false;
    }
    return true;
  }

  /** Clear all entries — used in tests */
  clear() {
    this.memoryBlacklist.clear();
  }

  private cleanupMemory() {
    const now = Date.now();
    for (const [hash, expiry] of this.memoryBlacklist) {
      if (now > expiry) this.memoryBlacklist.delete(hash);
    }
  }
}
