import {
  BOOKING_STATUS_STYLES,
  CONVERSATION_STATUS_STYLES,
  ELEVATION,
  SPACING,
  OUTBOUND_STATUS_STYLES,
  SUPPORT_STATUS_STYLES,
  SUBSCRIPTION_STATUS_STYLES,
  statusBadgeClasses,
  statusCalendarClasses,
  statusHex,
} from './design-tokens';

const BOOKING_STATUSES = [
  'PENDING',
  'PENDING_DEPOSIT',
  'CONFIRMED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

const CONVERSATION_STATUSES = ['OPEN', 'WAITING', 'RESOLVED', 'SNOOZED'] as const;

describe('design-tokens', () => {
  describe('BOOKING_STATUS_STYLES', () => {
    it('has entries for all 7 booking statuses', () => {
      for (const status of BOOKING_STATUSES) {
        expect(BOOKING_STATUS_STYLES[status]).toBeDefined();
      }
    });

    it('each entry has all required fields', () => {
      for (const status of BOOKING_STATUSES) {
        const entry = BOOKING_STATUS_STYLES[status];
        expect(entry).toHaveProperty('bg');
        expect(entry).toHaveProperty('text');
        expect(entry).toHaveProperty('border');
        expect(entry).toHaveProperty('dot');
        expect(entry).toHaveProperty('label');
        expect(entry).toHaveProperty('hex');
        expect(typeof entry.bg).toBe('string');
        expect(typeof entry.text).toBe('string');
        expect(typeof entry.hex).toBe('string');
        expect(entry.hex).toMatch(/^#[0-9a-fA-F]{6}$/);
      }
    });

    it('uses correct color families per design system', () => {
      expect(BOOKING_STATUS_STYLES.CONFIRMED.bg).toContain('sage');
      expect(BOOKING_STATUS_STYLES.COMPLETED.bg).toContain('sage');
      expect(BOOKING_STATUS_STYLES.PENDING.bg).toContain('lavender');
      expect(BOOKING_STATUS_STYLES.NO_SHOW.bg).toContain('red');
      expect(BOOKING_STATUS_STYLES.IN_PROGRESS.bg).toContain('amber');
    });
  });

  describe('CONVERSATION_STATUS_STYLES', () => {
    it('has entries for all 4 conversation statuses', () => {
      for (const status of CONVERSATION_STATUSES) {
        expect(CONVERSATION_STATUS_STYLES[status]).toBeDefined();
      }
    });

    it('each entry has bg, text, dot, and label', () => {
      for (const status of CONVERSATION_STATUSES) {
        const entry = CONVERSATION_STATUS_STYLES[status];
        expect(entry).toHaveProperty('bg');
        expect(entry).toHaveProperty('text');
        expect(entry).toHaveProperty('dot');
        expect(entry).toHaveProperty('label');
      }
    });
  });

  describe('ELEVATION', () => {
    it('has card, modal, and dropdown entries', () => {
      expect(ELEVATION).toHaveProperty('card');
      expect(ELEVATION).toHaveProperty('modal');
      expect(ELEVATION).toHaveProperty('dropdown');
    });

    it('all entries contain shadow and rounded classes', () => {
      expect(ELEVATION.card).toContain('shadow');
      expect(ELEVATION.card).toContain('rounded');
      expect(ELEVATION.modal).toContain('shadow');
      expect(ELEVATION.modal).toContain('rounded');
      expect(ELEVATION.dropdown).toContain('shadow');
      expect(ELEVATION.dropdown).toContain('rounded');
    });
  });

  describe('SPACING', () => {
    it('has page and card spacing tokens', () => {
      expect(SPACING).toHaveProperty('page');
      expect(SPACING).toHaveProperty('cardPad');
      expect(SPACING).toHaveProperty('gridGap');
    });
  });

  describe('OUTBOUND_STATUS_STYLES', () => {
    it('has entries for DRAFT, APPROVED, SENT, REJECTED', () => {
      for (const status of ['DRAFT', 'APPROVED', 'SENT', 'REJECTED']) {
        expect(OUTBOUND_STATUS_STYLES[status]).toBeDefined();
        expect(OUTBOUND_STATUS_STYLES[status]).toHaveProperty('label');
        expect(OUTBOUND_STATUS_STYLES[status]).toHaveProperty('style');
      }
    });
  });

  describe('SUPPORT_STATUS_STYLES', () => {
    it('has entries for open, in_progress, resolved, closed', () => {
      for (const status of ['open', 'in_progress', 'resolved', 'closed']) {
        expect(typeof SUPPORT_STATUS_STYLES[status]).toBe('string');
      }
    });
  });

  describe('SUBSCRIPTION_STATUS_STYLES', () => {
    it('has entries for active, trialing, past_due, canceled', () => {
      for (const status of ['active', 'trialing', 'past_due', 'canceled']) {
        expect(typeof SUBSCRIPTION_STATUS_STYLES[status]).toBe('string');
      }
    });
  });

  describe('statusBadgeClasses', () => {
    it('returns bg + text classes for known status', () => {
      const result = statusBadgeClasses('CONFIRMED');
      expect(result).toContain('bg-sage-50');
      expect(result).toContain('text-sage-900');
    });

    it('returns fallback for unknown status', () => {
      const result = statusBadgeClasses('UNKNOWN');
      expect(result).toContain('bg-slate-100');
      expect(result).toContain('text-slate-600');
    });
  });

  describe('statusCalendarClasses', () => {
    it('returns bg, border, and text for known status', () => {
      const result = statusCalendarClasses('PENDING');
      expect(result.bg).toContain('lavender');
      expect(result.border).toContain('lavender');
      expect(result.text).toContain('lavender');
    });

    it('returns fallback for unknown status', () => {
      const result = statusCalendarClasses('UNKNOWN');
      expect(result.bg).toContain('slate');
    });
  });

  describe('statusHex', () => {
    it('returns hex value for known status', () => {
      expect(statusHex('CONFIRMED')).toBe('#8AA694');
    });

    it('returns fallback hex for unknown status', () => {
      expect(statusHex('UNKNOWN')).toBe('#64748b');
    });
  });
});
