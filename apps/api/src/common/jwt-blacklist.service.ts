import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';

/**
 * H1 fix: In-memory JWT blacklist for token revocation.
 * Tokens are blacklisted on logout and password change.
 * Entries auto-expire based on the token's remaining TTL.
 *
 * Note: This is an in-memory store suitable for single-instance deployments.
 * For multi-instance, replace with Redis-backed implementation.
 */
@Injectable()
export class JwtBlacklistService {
  private blacklist = new Map<string, number>();

  constructor() {
    // Cleanup expired entries every 5 minutes
    const timer = setInterval(() => this.cleanup(), 5 * 60 * 1000);
    timer.unref(); // Don't prevent process exit
  }

  blacklistToken(token: string, ttlMs = 15 * 60 * 1000) {
    const hash = createHash('sha256').update(token).digest('hex');
    this.blacklist.set(hash, Date.now() + ttlMs);
  }

  isBlacklisted(token: string): boolean {
    const hash = createHash('sha256').update(token).digest('hex');
    const expiry = this.blacklist.get(hash);
    if (!expiry) return false;
    if (Date.now() > expiry) {
      this.blacklist.delete(hash);
      return false;
    }
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [hash, expiry] of this.blacklist) {
      if (now > expiry) this.blacklist.delete(hash);
    }
  }
}
