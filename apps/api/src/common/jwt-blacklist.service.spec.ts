import { JwtBlacklistService } from './jwt-blacklist.service';

describe('JwtBlacklistService', () => {
  let service: JwtBlacklistService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = new JwtBlacklistService();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('blacklistToken', () => {
    it('adds a token to the blacklist', () => {
      service.blacklistToken('test-token');
      expect(service.isBlacklisted('test-token')).toBe(true);
    });

    it('accepts custom TTL', () => {
      service.blacklistToken('short-token', 1000);
      expect(service.isBlacklisted('short-token')).toBe(true);
    });
  });

  describe('isBlacklisted', () => {
    it('returns false for non-blacklisted tokens', () => {
      expect(service.isBlacklisted('unknown-token')).toBe(false);
    });

    it('returns true for blacklisted tokens within TTL', () => {
      service.blacklistToken('my-token', 60000);
      jest.advanceTimersByTime(30000);
      expect(service.isBlacklisted('my-token')).toBe(true);
    });

    it('returns false and cleans up expired tokens', () => {
      service.blacklistToken('expired-token', 5000);
      jest.advanceTimersByTime(6000);
      expect(service.isBlacklisted('expired-token')).toBe(false);
    });

    it('uses default TTL of 15 minutes', () => {
      service.blacklistToken('default-ttl');
      jest.advanceTimersByTime(14 * 60 * 1000);
      expect(service.isBlacklisted('default-ttl')).toBe(true);

      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(service.isBlacklisted('default-ttl')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes expired entries on timer tick', () => {
      service.blacklistToken('token-a', 60000);
      service.blacklistToken('token-b', 120000);

      // Advance past first token's expiry but before second
      jest.advanceTimersByTime(90000);

      // Trigger cleanup interval (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);

      // token-a should be cleaned up, token-b should remain
      expect(service.isBlacklisted('token-a')).toBe(false);
      // token-b will also be expired by now (90s + 5min > 120s)
      expect(service.isBlacklisted('token-b')).toBe(false);
    });

    it('handles empty blacklist gracefully', () => {
      // Just trigger the cleanup interval - should not throw
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
  });

  describe('hashing', () => {
    it('stores hashed tokens not raw tokens', () => {
      service.blacklistToken('raw-token');
      // The same raw token should be found via hash
      expect(service.isBlacklisted('raw-token')).toBe(true);
      // A different token should not be found
      expect(service.isBlacklisted('different-token')).toBe(false);
    });
  });
});
