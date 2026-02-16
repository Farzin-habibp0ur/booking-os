import { validateName, validatePhone, validateEmail } from './page';

describe('BookingPortal validation', () => {
  describe('validateName', () => {
    it('returns error for empty name', () => {
      expect(validateName('')).toBe('Name is required');
      expect(validateName('  ')).toBe('Name is required');
    });

    it('returns error for name shorter than 2 characters', () => {
      expect(validateName('A')).toBe('Name must be at least 2 characters');
    });

    it('returns null for valid name', () => {
      expect(validateName('Jo')).toBeNull();
      expect(validateName('Jane Doe')).toBeNull();
    });
  });

  describe('validatePhone', () => {
    it('returns error for empty phone', () => {
      expect(validatePhone('')).toBe('Phone number is required');
      expect(validatePhone('  ')).toBe('Phone number is required');
    });

    it('returns error for invalid phone format', () => {
      expect(validatePhone('abc')).toBe('Please enter a valid phone number');
      expect(validatePhone('12')).toBe('Please enter a valid phone number');
      expect(validatePhone('not-a-phone!')).toBe('Please enter a valid phone number');
    });

    it('accepts valid phone formats', () => {
      expect(validatePhone('+1 (555) 123-4567')).toBeNull();
      expect(validatePhone('5551234567')).toBeNull();
      expect(validatePhone('+44 20 7946 0958')).toBeNull();
      expect(validatePhone('123-456-7890')).toBeNull();
    });
  });

  describe('validateEmail', () => {
    it('returns null for empty email (optional field)', () => {
      expect(validateEmail('')).toBeNull();
      expect(validateEmail('  ')).toBeNull();
    });

    it('returns error for invalid email format', () => {
      expect(validateEmail('notanemail')).toBe('Please enter a valid email address');
      expect(validateEmail('missing@domain')).toBe('Please enter a valid email address');
      expect(validateEmail('@nodomain.com')).toBe('Please enter a valid email address');
    });

    it('accepts valid email formats', () => {
      expect(validateEmail('user@example.com')).toBeNull();
      expect(validateEmail('jane.doe@clinic.co.uk')).toBeNull();
    });
  });
});
