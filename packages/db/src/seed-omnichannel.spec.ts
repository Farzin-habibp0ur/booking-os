import { randomBetween, pastDate, computeSegmentsAndCost, CHANNEL_RATES } from './seed-omnichannel';

describe('seed-omnichannel helpers', () => {
  describe('randomBetween', () => {
    it('returns a value within the specified range', () => {
      for (let i = 0; i < 100; i++) {
        const val = randomBetween(5, 10);
        expect(val).toBeGreaterThanOrEqual(5);
        expect(val).toBeLessThanOrEqual(10);
      }
    });

    it('returns the only value when min equals max', () => {
      expect(randomBetween(7, 7)).toBe(7);
    });

    it('returns an integer', () => {
      const val = randomBetween(1, 100);
      expect(Number.isInteger(val)).toBe(true);
    });
  });

  describe('pastDate', () => {
    it('returns a string in YYYY-MM-DD format', () => {
      const result = pastDate(3);
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('returns today when daysAgo is 0', () => {
      const today = new Date().toISOString().split('T')[0];
      expect(pastDate(0)).toBe(today);
    });

    it('returns yesterday when daysAgo is 1', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const expected = yesterday.toISOString().split('T')[0];
      expect(pastDate(1)).toBe(expected);
    });
  });

  describe('CHANNEL_RATES', () => {
    it('has rates for all expected channels', () => {
      const expected = ['SMS', 'MMS', 'EMAIL', 'WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'WEB_CHAT'];
      for (const ch of expected) {
        expect(CHANNEL_RATES).toHaveProperty(ch);
        expect(CHANNEL_RATES[ch]).toHaveProperty('inbound');
        expect(CHANNEL_RATES[ch]).toHaveProperty('outbound');
      }
    });

    it('has zero rates for free channels', () => {
      const freeChannels = ['WHATSAPP', 'INSTAGRAM', 'FACEBOOK', 'WEB_CHAT'];
      for (const ch of freeChannels) {
        expect(CHANNEL_RATES[ch].inbound).toBe(0);
        expect(CHANNEL_RATES[ch].outbound).toBe(0);
      }
    });

    it('has positive rates for paid channels', () => {
      expect(CHANNEL_RATES['SMS'].inbound).toBeGreaterThan(0);
      expect(CHANNEL_RATES['SMS'].outbound).toBeGreaterThan(0);
      expect(CHANNEL_RATES['EMAIL'].inbound).toBeGreaterThan(0);
      expect(CHANNEL_RATES['EMAIL'].outbound).toBeGreaterThan(0);
    });

    it('has correct SMS rates', () => {
      expect(CHANNEL_RATES['SMS'].inbound).toBe(0.0075);
      expect(CHANNEL_RATES['SMS'].outbound).toBe(0.0079);
    });
  });

  describe('computeSegmentsAndCost', () => {
    it('computes segments 1-3 for SMS', () => {
      for (let i = 0; i < 50; i++) {
        const { segments } = computeSegmentsAndCost('SMS', 'OUTBOUND', 10);
        expect(segments).toBeGreaterThanOrEqual(1);
        expect(segments).toBeLessThanOrEqual(3);
      }
    });

    it('computes 0 segments for non-SMS channels', () => {
      const channels = ['WHATSAPP', 'INSTAGRAM', 'EMAIL', 'FACEBOOK', 'WEB_CHAT'];
      for (const ch of channels) {
        const { segments } = computeSegmentsAndCost(ch, 'INBOUND', 10);
        expect(segments).toBe(0);
      }
    });

    it('computes correct cost for SMS outbound', () => {
      const count = 10;
      const { segments, cost } = computeSegmentsAndCost('SMS', 'OUTBOUND', count);
      // cost = count * segments * rate = 10 * segments * 0.0079
      expect(cost).toBeCloseTo(count * segments * 0.0079, 6);
    });

    it('computes correct cost for EMAIL', () => {
      const count = 20;
      const { segments, cost } = computeSegmentsAndCost('EMAIL', 'INBOUND', count);
      expect(segments).toBe(0);
      // When segments is 0, cost = count * 1 * rate
      expect(cost).toBeCloseTo(count * 1 * 0.00065, 6);
    });

    it('computes zero cost for free channels', () => {
      const { cost } = computeSegmentsAndCost('WHATSAPP', 'OUTBOUND', 50);
      expect(cost).toBe(0);
    });

    it('handles unknown channels with zero cost', () => {
      const { segments, cost } = computeSegmentsAndCost('UNKNOWN', 'INBOUND', 10);
      expect(segments).toBe(0);
      expect(cost).toBe(0);
    });
  });
});
