import {
  getPlanLimits,
  getUpgradePlan,
  isNearLimit,
  isAtLimit,
  getUsagePercent,
  getLimitValue,
} from './plan-limits';

describe('plan-limits', () => {
  describe('getPlanLimits', () => {
    it('returns free tier limits for unknown plan', () => {
      const limits = getPlanLimits('unknown');
      expect(limits.bookings).toBe(50);
      expect(limits.staff).toBe(1);
    });

    it('returns starter limits', () => {
      const limits = getPlanLimits('starter');
      expect(limits.bookings).toBe(500);
      expect(limits.staff).toBe(3);
      expect(limits.automations).toBe(5);
      expect(limits.sequences).toBe(3);
      expect(limits.services).toBe(10);
    });

    it('returns professional limits', () => {
      const limits = getPlanLimits('professional');
      expect(limits.bookings).toBe(5000);
      expect(limits.staff).toBe(10);
    });

    it('returns enterprise limits with Infinity', () => {
      const limits = getPlanLimits('enterprise');
      expect(limits.bookings).toBe(Infinity);
      expect(limits.staff).toBe(Infinity);
    });

    it('is case-insensitive', () => {
      const limits = getPlanLimits('Starter');
      expect(limits.bookings).toBe(500);
    });
  });

  describe('getUpgradePlan', () => {
    it('returns starter for free', () => {
      const result = getUpgradePlan('free');
      expect(result).toEqual({ tier: 'starter', label: 'Starter' });
    });

    it('returns professional for starter', () => {
      const result = getUpgradePlan('starter');
      expect(result).toEqual({ tier: 'professional', label: 'Professional' });
    });

    it('returns enterprise for professional', () => {
      const result = getUpgradePlan('professional');
      expect(result).toEqual({ tier: 'enterprise', label: 'Enterprise' });
    });

    it('returns null for enterprise', () => {
      expect(getUpgradePlan('enterprise')).toBeNull();
    });
  });

  describe('isNearLimit', () => {
    it('returns true when at 80% of limit', () => {
      // starter bookings = 500, 80% = 400
      expect(isNearLimit(400, 'starter', 'bookings')).toBe(true);
    });

    it('returns true when above 80% of limit', () => {
      expect(isNearLimit(450, 'starter', 'bookings')).toBe(true);
    });

    it('returns false when below 80% of limit', () => {
      expect(isNearLimit(300, 'starter', 'bookings')).toBe(false);
    });

    it('returns false for enterprise (Infinity)', () => {
      expect(isNearLimit(9999, 'enterprise', 'bookings')).toBe(false);
    });
  });

  describe('isAtLimit', () => {
    it('returns true when at limit', () => {
      expect(isAtLimit(500, 'starter', 'bookings')).toBe(true);
    });

    it('returns true when above limit', () => {
      expect(isAtLimit(600, 'starter', 'bookings')).toBe(true);
    });

    it('returns false when below limit', () => {
      expect(isAtLimit(499, 'starter', 'bookings')).toBe(false);
    });

    it('returns false for enterprise', () => {
      expect(isAtLimit(999999, 'enterprise', 'staff')).toBe(false);
    });
  });

  describe('getUsagePercent', () => {
    it('returns 0 for enterprise', () => {
      expect(getUsagePercent(100, 'enterprise', 'bookings')).toBe(0);
    });

    it('returns correct percentage', () => {
      expect(getUsagePercent(250, 'starter', 'bookings')).toBe(50);
    });

    it('caps at 100', () => {
      expect(getUsagePercent(600, 'starter', 'bookings')).toBe(100);
    });
  });

  describe('getLimitValue', () => {
    it('returns the limit for the resource', () => {
      expect(getLimitValue('starter', 'bookings')).toBe(500);
      expect(getLimitValue('professional', 'staff')).toBe(10);
      expect(getLimitValue('free', 'services')).toBe(3);
    });
  });
});
