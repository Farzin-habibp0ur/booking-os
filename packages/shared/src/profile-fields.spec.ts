import { checkProfileCompleteness, PROFILE_FIELDS } from './profile-fields';

describe('checkProfileCompleteness', () => {
  describe('firstName', () => {
    it('extracts firstName from full name', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane Doe' },
        ['firstName'],
      );
      expect(result.complete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('extracts firstName from single name', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane' },
        ['firstName'],
      );
      expect(result.complete).toBe(true);
    });

    it('marks firstName missing for empty string', () => {
      const result = checkProfileCompleteness(
        { name: '' },
        ['firstName'],
      );
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual([
        expect.objectContaining({ key: 'firstName' }),
      ]);
    });

    it('marks firstName missing for whitespace-only name', () => {
      const result = checkProfileCompleteness(
        { name: '   ' },
        ['firstName'],
      );
      expect(result.complete).toBe(false);
    });
  });

  describe('lastName', () => {
    it('extracts lastName from "Jane Doe"', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane Doe' },
        ['lastName'],
      );
      expect(result.complete).toBe(true);
    });

    it('marks lastName missing from single name "Jane"', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane' },
        ['lastName'],
      );
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual([
        expect.objectContaining({ key: 'lastName' }),
      ]);
    });

    it('extracts lastName from multi-part name', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane Van Doe' },
        ['lastName'],
      );
      expect(result.complete).toBe(true);
    });
  });

  describe('email', () => {
    it('present when email is a string', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane', email: 'jane@test.com' },
        ['email'],
      );
      expect(result.complete).toBe(true);
    });

    it('missing when email is null', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane', email: null },
        ['email'],
      );
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual([
        expect.objectContaining({ key: 'email' }),
      ]);
    });

    it('missing when email is undefined', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane' },
        ['email'],
      );
      expect(result.complete).toBe(false);
    });
  });

  describe('customFields (allergies, address, etc.)', () => {
    it('present when customField exists', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane', customFields: { allergies: 'Penicillin' } },
        ['allergies'],
      );
      expect(result.complete).toBe(true);
    });

    it('missing when customField is absent', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane', customFields: {} },
        ['allergies'],
      );
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual([
        expect.objectContaining({ key: 'allergies' }),
      ]);
    });

    it('missing when no customFields object at all', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane' },
        ['address'],
      );
      expect(result.complete).toBe(false);
    });

    it('present for address in customFields', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane', customFields: { address: '123 Main St' } },
        ['address'],
      );
      expect(result.complete).toBe(true);
    });
  });

  describe('unknown keys', () => {
    it('skips unknown key gracefully', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane' },
        ['unknownField'],
      );
      expect(result.complete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });
  });

  describe('multiple required fields', () => {
    it('returns all missing fields', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane' },
        ['firstName', 'lastName', 'email', 'allergies'],
      );
      expect(result.complete).toBe(false);
      const missingKeys = result.missingFields.map((f) => f.key);
      expect(missingKeys).toContain('lastName');
      expect(missingKeys).toContain('email');
      expect(missingKeys).toContain('allergies');
      expect(missingKeys).not.toContain('firstName');
    });

    it('returns complete when all fields present', () => {
      const result = checkProfileCompleteness(
        {
          name: 'Jane Doe',
          email: 'jane@test.com',
          customFields: { allergies: 'None', address: '123 Main St' },
        },
        ['firstName', 'lastName', 'email', 'allergies', 'address'],
      );
      expect(result.complete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('empty required keys returns complete', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane' },
        [],
      );
      expect(result.complete).toBe(true);
    });

    it('missingFields contain full ProfileFieldDef objects', () => {
      const result = checkProfileCompleteness(
        { name: 'Jane' },
        ['email'],
      );
      expect(result.missingFields[0]).toEqual(
        PROFILE_FIELDS.find((f) => f.key === 'email'),
      );
    });
  });
});
