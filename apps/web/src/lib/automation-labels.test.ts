import {
  getTriggerLabel,
  getActionLabel,
  TRIGGER_LABELS,
  ACTION_LABELS,
  TRIGGER_CATEGORIES,
} from './automation-labels';

describe('automation-labels', () => {
  describe('TRIGGER_LABELS', () => {
    it('contains all 12 trigger types', () => {
      const expected = [
        'BOOKING_CREATED',
        'BOOKING_UPCOMING',
        'STATUS_CHANGED',
        'BOOKING_CANCELLED',
        'CUSTOMER_CREATED',
        'PAYMENT_RECEIVED',
        'TESTIMONIAL_SUBMITTED',
        'CAMPAIGN_SENT',
        'REFERRAL_EARNED',
        'REFERRAL_REDEEMED',
        'MESSAGE_RECEIVED',
        'NO_RESPONSE',
      ];
      for (const trigger of expected) {
        expect(TRIGGER_LABELS[trigger]).toBeDefined();
        expect(TRIGGER_LABELS[trigger].label).toBeTruthy();
        expect(TRIGGER_LABELS[trigger].icon).toBeDefined();
        expect(TRIGGER_LABELS[trigger].category).toBeTruthy();
      }
    });
  });

  describe('ACTION_LABELS', () => {
    it('contains all 10 action types', () => {
      const expected = [
        'SEND_MESSAGE',
        'SEND_EMAIL',
        'SEND_TEMPLATE',
        'REQUEST_TESTIMONIAL',
        'UPDATE_STATUS',
        'ADD_TAG',
        'UPDATE_CUSTOMER_FIELD',
        'ASSIGN_STAFF',
        'SEND_NOTIFICATION',
        'WEBHOOK',
      ];
      for (const action of expected) {
        expect(ACTION_LABELS[action]).toBeDefined();
        expect(ACTION_LABELS[action].label).toBeTruthy();
        expect(ACTION_LABELS[action].icon).toBeDefined();
      }
    });
  });

  describe('TRIGGER_CATEGORIES', () => {
    it('covers all 12 triggers exactly once', () => {
      const allTriggers = TRIGGER_CATEGORIES.flatMap((c) => c.triggers);
      expect(allTriggers).toHaveLength(12);
      const unique = new Set(allTriggers);
      expect(unique.size).toBe(12);
    });
  });

  describe('getTriggerLabel', () => {
    it('returns human-readable label for known triggers', () => {
      expect(getTriggerLabel('BOOKING_CREATED')).toBe('When a booking is created');
      expect(getTriggerLabel('NO_RESPONSE')).toBe("When customer doesn't respond");
    });

    it('falls back gracefully for unknown triggers', () => {
      expect(getTriggerLabel('UNKNOWN_TYPE')).toBe('unknown type');
    });
  });

  describe('getActionLabel', () => {
    it('returns human-readable label for known actions', () => {
      expect(getActionLabel('SEND_TEMPLATE')).toBe('Send a message template');
      expect(getActionLabel('ASSIGN_STAFF')).toBe('Assign to staff member');
    });

    it('falls back gracefully for unknown actions', () => {
      expect(getActionLabel('CUSTOM_ACTION')).toBe('custom action');
    });
  });
});
