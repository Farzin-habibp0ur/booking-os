import {
  checkProfileCompleteness,
  checkIntakeCompleteness,
  PROFILE_FIELDS,
} from './profile-fields';

describe('checkProfileCompleteness', () => {
  describe('firstName', () => {
    it('extracts firstName from full name', () => {
      const result = checkProfileCompleteness({ name: 'Jane Doe' }, ['firstName']);
      expect(result.complete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });

    it('extracts firstName from single name', () => {
      const result = checkProfileCompleteness({ name: 'Jane' }, ['firstName']);
      expect(result.complete).toBe(true);
    });

    it('marks firstName missing for empty string', () => {
      const result = checkProfileCompleteness({ name: '' }, ['firstName']);
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual([expect.objectContaining({ key: 'firstName' })]);
    });

    it('marks firstName missing for whitespace-only name', () => {
      const result = checkProfileCompleteness({ name: '   ' }, ['firstName']);
      expect(result.complete).toBe(false);
    });
  });

  describe('lastName', () => {
    it('extracts lastName from "Jane Doe"', () => {
      const result = checkProfileCompleteness({ name: 'Jane Doe' }, ['lastName']);
      expect(result.complete).toBe(true);
    });

    it('marks lastName missing from single name "Jane"', () => {
      const result = checkProfileCompleteness({ name: 'Jane' }, ['lastName']);
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual([expect.objectContaining({ key: 'lastName' })]);
    });

    it('extracts lastName from multi-part name', () => {
      const result = checkProfileCompleteness({ name: 'Jane Van Doe' }, ['lastName']);
      expect(result.complete).toBe(true);
    });
  });

  describe('email', () => {
    it('present when email is a string', () => {
      const result = checkProfileCompleteness({ name: 'Jane', email: 'jane@test.com' }, ['email']);
      expect(result.complete).toBe(true);
    });

    it('missing when email is null', () => {
      const result = checkProfileCompleteness({ name: 'Jane', email: null }, ['email']);
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual([expect.objectContaining({ key: 'email' })]);
    });

    it('missing when email is undefined', () => {
      const result = checkProfileCompleteness({ name: 'Jane' }, ['email']);
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
      const result = checkProfileCompleteness({ name: 'Jane', customFields: {} }, ['allergies']);
      expect(result.complete).toBe(false);
      expect(result.missingFields).toEqual([expect.objectContaining({ key: 'allergies' })]);
    });

    it('missing when no customFields object at all', () => {
      const result = checkProfileCompleteness({ name: 'Jane' }, ['address']);
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
      const result = checkProfileCompleteness({ name: 'Jane' }, ['unknownField']);
      expect(result.complete).toBe(true);
      expect(result.missingFields).toEqual([]);
    });
  });

  describe('multiple required fields', () => {
    it('returns all missing fields', () => {
      const result = checkProfileCompleteness({ name: 'Jane' }, [
        'firstName',
        'lastName',
        'email',
        'allergies',
      ]);
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
      const result = checkProfileCompleteness({ name: 'Jane' }, []);
      expect(result.complete).toBe(true);
    });

    it('missingFields contain full ProfileFieldDef objects', () => {
      const result = checkProfileCompleteness({ name: 'Jane' }, ['email']);
      expect(result.missingFields[0]).toEqual(PROFILE_FIELDS.find((f) => f.key === 'email'));
    });
  });
});

describe('checkIntakeCompleteness', () => {
  const fields = [
    { key: 'concernArea', label: 'Concern Area' },
    { key: 'desiredTreatment', label: 'Desired Treatment' },
    { key: 'budget', label: 'Budget Range' },
    { key: 'isMedicalFlagged', label: 'Medical Flag' },
  ];

  it('returns 0/N when no customFields exist', () => {
    const result = checkIntakeCompleteness({}, fields);
    expect(result.filled).toBe(0);
    expect(result.total).toBe(4);
    expect(result.missing).toEqual([
      'concernArea',
      'desiredTreatment',
      'budget',
      'isMedicalFlagged',
    ]);
  });

  it('returns correct filled count with partial data', () => {
    const result = checkIntakeCompleteness(
      { customFields: { concernArea: 'Fine lines', budget: '$250-$500' } },
      fields,
    );
    expect(result.filled).toBe(2);
    expect(result.total).toBe(4);
    expect(result.missing).toEqual(['desiredTreatment', 'isMedicalFlagged']);
  });

  it('returns N/N when all fields present', () => {
    const result = checkIntakeCompleteness(
      {
        customFields: {
          concernArea: 'Lip volume',
          desiredTreatment: 'Filler',
          budget: '$500-$1000',
          isMedicalFlagged: true,
        },
      },
      fields,
    );
    expect(result.filled).toBe(4);
    expect(result.total).toBe(4);
    expect(result.missing).toEqual([]);
  });

  it('handles boolean false as filled (not missing)', () => {
    const result = checkIntakeCompleteness({ customFields: { isMedicalFlagged: false } }, [
      { key: 'isMedicalFlagged', label: 'Medical Flag' },
    ]);
    expect(result.filled).toBe(1);
    expect(result.missing).toEqual([]);
  });

  it('treats empty string as missing', () => {
    const result = checkIntakeCompleteness({ customFields: { concernArea: '' } }, [
      { key: 'concernArea', label: 'Concern Area' },
    ]);
    expect(result.filled).toBe(0);
    expect(result.missing).toEqual(['concernArea']);
  });

  it('returns missing field keys correctly', () => {
    const result = checkIntakeCompleteness({ customFields: { concernArea: 'Fine lines' } }, fields);
    expect(result.missing).toEqual(['desiredTreatment', 'budget', 'isMedicalFlagged']);
  });
});
