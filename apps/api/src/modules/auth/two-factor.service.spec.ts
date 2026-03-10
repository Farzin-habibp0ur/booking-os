import { TwoFactorService } from './two-factor.service';

describe('TwoFactorService', () => {
  let service: TwoFactorService;

  beforeEach(() => {
    service = new TwoFactorService();
  });

  describe('generateSetup', () => {
    it('returns a secret and otpauth URL', () => {
      const result = service.generateSetup('test@example.com');

      expect(result.secret).toBeDefined();
      expect(result.secret.length).toBeGreaterThan(0);
      // Base32 chars only
      expect(result.secret).toMatch(/^[A-Z2-7]+$/);
      expect(result.otpauthUrl).toContain('otpauth://totp/');
      expect(result.otpauthUrl).toContain('test%40example.com');
      expect(result.otpauthUrl).toContain('BookingOS');
      expect(result.otpauthUrl).toContain(`secret=${result.secret}`);
    });

    it('generates unique secrets each time', () => {
      const r1 = service.generateSetup('a@b.com');
      const r2 = service.generateSetup('a@b.com');
      expect(r1.secret).not.toBe(r2.secret);
    });
  });

  describe('verifyCode', () => {
    it('verifies a correct TOTP code', () => {
      // Generate a known setup, then produce a code using the same algorithm
      const { secret } = service.generateSetup('test@example.com');

      // Use the internal method to generate a valid code for the current time step
      // We access the private method via the service for testing
      const now = Math.floor(Date.now() / 1000);
      const counter = Math.floor(now / 30);
      const validCode = (service as any).generateTOTP(secret, counter);

      expect(service.verifyCode(secret, validCode)).toBe(true);
    });

    it('rejects an invalid code', () => {
      const { secret } = service.generateSetup('test@example.com');
      expect(service.verifyCode(secret, '000000')).toBe(false);
    });

    it('rejects non-numeric codes', () => {
      const { secret } = service.generateSetup('test@example.com');
      expect(service.verifyCode(secret, 'abcdef')).toBe(false);
    });

    it('rejects codes of wrong length', () => {
      const { secret } = service.generateSetup('test@example.com');
      expect(service.verifyCode(secret, '12345')).toBe(false);
      expect(service.verifyCode(secret, '1234567')).toBe(false);
    });

    it('rejects empty code', () => {
      const { secret } = service.generateSetup('test@example.com');
      expect(service.verifyCode(secret, '')).toBe(false);
    });

    it('allows adjacent time step (drift tolerance)', () => {
      const { secret } = service.generateSetup('test@example.com');
      const now = Math.floor(Date.now() / 1000);
      // Code from previous time step
      const prevCounter = Math.floor(now / 30) - 1;
      const prevCode = (service as any).generateTOTP(secret, prevCounter);
      expect(service.verifyCode(secret, prevCode)).toBe(true);
    });
  });

  describe('generateBackupCodes', () => {
    it('generates 8 codes', async () => {
      const { plaintext, hashed } = await service.generateBackupCodes();

      expect(plaintext).toHaveLength(8);
      expect(hashed).toHaveLength(8);
    });

    it('generates 8-character alphanumeric codes', async () => {
      const { plaintext } = await service.generateBackupCodes();

      for (const code of plaintext) {
        expect(code).toHaveLength(8);
        expect(code).toMatch(/^[A-Z2-9HJKLMNPQRSTUVWXYZ]+$/);
      }
    });

    it('hashed codes are bcrypt hashes', async () => {
      const { hashed } = await service.generateBackupCodes();

      for (const hash of hashed) {
        expect(hash).toMatch(/^\$2[ab]\$/);
      }
    });

    it('generates unique codes', async () => {
      const { plaintext } = await service.generateBackupCodes();
      const unique = new Set(plaintext);
      expect(unique.size).toBe(8);
    });
  });

  describe('verifyBackupCode', () => {
    it('validates a correct backup code', async () => {
      const { plaintext, hashed } = await service.generateBackupCodes();

      const { valid, remainingCodes } = await service.verifyBackupCode(hashed, plaintext[0]);

      expect(valid).toBe(true);
      expect(remainingCodes).toHaveLength(7);
    });

    it('is case-insensitive', async () => {
      const { plaintext, hashed } = await service.generateBackupCodes();

      const { valid } = await service.verifyBackupCode(hashed, plaintext[0].toLowerCase());

      expect(valid).toBe(true);
    });

    it('rejects an invalid backup code', async () => {
      const { hashed } = await service.generateBackupCodes();

      const { valid, remainingCodes } = await service.verifyBackupCode(hashed, 'ZZZZZZZZ');

      expect(valid).toBe(false);
      expect(remainingCodes).toHaveLength(8);
    });

    it('removes used code from remaining codes', async () => {
      const { plaintext, hashed } = await service.generateBackupCodes();

      const { remainingCodes } = await service.verifyBackupCode(hashed, plaintext[2]);

      // Should not be able to use the same code again
      const { valid } = await service.verifyBackupCode(remainingCodes, plaintext[2]);
      expect(valid).toBe(false);
    });
  });
});
