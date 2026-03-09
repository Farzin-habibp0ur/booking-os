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
    it('adds a token to the blacklist', async () => {
      await service.blacklistToken('test-token');
      expect(await service.isBlacklisted('test-token')).toBe(true);
    });

    it('accepts custom TTL', async () => {
      await service.blacklistToken('short-token', 1000);
      expect(await service.isBlacklisted('short-token')).toBe(true);
    });
  });

  describe('isBlacklisted', () => {
    it('returns false for non-blacklisted tokens', async () => {
      expect(await service.isBlacklisted('unknown-token')).toBe(false);
    });

    it('returns true for blacklisted tokens within TTL', async () => {
      await service.blacklistToken('my-token', 60000);
      jest.advanceTimersByTime(30000);
      expect(await service.isBlacklisted('my-token')).toBe(true);
    });

    it('returns false and cleans up expired tokens', async () => {
      await service.blacklistToken('expired-token', 5000);
      jest.advanceTimersByTime(6000);
      expect(await service.isBlacklisted('expired-token')).toBe(false);
    });

    it('uses default TTL of 15 minutes', async () => {
      await service.blacklistToken('default-ttl');
      jest.advanceTimersByTime(14 * 60 * 1000);
      expect(await service.isBlacklisted('default-ttl')).toBe(true);

      jest.advanceTimersByTime(2 * 60 * 1000);
      expect(await service.isBlacklisted('default-ttl')).toBe(false);
    });
  });

  describe('cleanup', () => {
    it('removes expired entries on timer tick', async () => {
      await service.blacklistToken('token-a', 60000);
      await service.blacklistToken('token-b', 120000);

      // Advance past first token's expiry but before second
      jest.advanceTimersByTime(90000);

      // Trigger cleanup interval (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000);

      // token-a should be cleaned up, token-b should remain
      expect(await service.isBlacklisted('token-a')).toBe(false);
      // token-b will also be expired by now (90s + 5min > 120s)
      expect(await service.isBlacklisted('token-b')).toBe(false);
    });

    it('handles empty blacklist gracefully', () => {
      // Just trigger the cleanup interval - should not throw
      jest.advanceTimersByTime(5 * 60 * 1000);
    });
  });

  describe('hashing', () => {
    it('stores hashed tokens not raw tokens', async () => {
      await service.blacklistToken('raw-token');
      // The same raw token should be found via hash
      expect(await service.isBlacklisted('raw-token')).toBe(true);
      // A different token should not be found
      expect(await service.isBlacklisted('different-token')).toBe(false);
    });
  });

  describe('with PortalRedisService', () => {
    it('uses redis store when available', async () => {
      const mockRedis = {
        set: jest.fn().mockResolvedValue(undefined),
        exists: jest.fn().mockResolvedValue(true),
      };
      const redisService = new JwtBlacklistService(mockRedis as any);

      await redisService.blacklistToken('redis-token', 5000);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('jwt-blacklist:'),
        '1',
        5000,
      );

      expect(await redisService.isBlacklisted('redis-token')).toBe(true);
    });
  });
});
