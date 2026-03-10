import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

// Base32 encoding alphabet (RFC 4648)
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

@Injectable()
export class TwoFactorService {
  /**
   * Generate a random TOTP secret and otpauth URL.
   */
  generateSetup(email: string): { secret: string; otpauthUrl: string } {
    const secretBytes = crypto.randomBytes(20);
    const secret = this.base32Encode(secretBytes);
    const otpauthUrl = this.generateOtpauthUrl(email, secret);
    return { secret, otpauthUrl };
  }

  /**
   * Verify a 6-digit TOTP code against a secret.
   * Allows +/- 1 time step (30 seconds drift).
   */
  verifyCode(secret: string, code: string): boolean {
    if (!code || !/^\d{6}$/.test(code)) return false;

    const now = Math.floor(Date.now() / 1000);
    const timeStep = 30;

    for (let offset = -1; offset <= 1; offset++) {
      const counter = Math.floor(now / timeStep) + offset;
      const expected = this.generateTOTP(secret, counter);
      // Timing-safe comparison to prevent timing attacks
      if (
        expected.length === code.length &&
        crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate 8 random alphanumeric backup codes.
   * Returns both plaintext (for user display) and hashed versions (for storage).
   */
  async generateBackupCodes(): Promise<{ plaintext: string[]; hashed: string[] }> {
    const codes: string[] = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude ambiguous chars (0,O,1,I)

    for (let i = 0; i < 8; i++) {
      let code = '';
      const bytes = crypto.randomBytes(8);
      for (let j = 0; j < 8; j++) {
        code += chars[bytes[j] % chars.length];
      }
      codes.push(code);
    }

    const hashed = await Promise.all(codes.map((c) => bcrypt.hash(c.toLowerCase(), 10)));

    return { plaintext: codes, hashed };
  }

  /**
   * Verify a backup code against stored hashed codes.
   * Returns whether the code is valid and the remaining hashed codes (with the used one removed).
   */
  async verifyBackupCode(
    hashedCodes: string[],
    code: string,
  ): Promise<{ valid: boolean; remainingCodes: string[] }> {
    const normalizedCode = code.toLowerCase().replace(/\s+/g, '');

    for (let i = 0; i < hashedCodes.length; i++) {
      const match = await bcrypt.compare(normalizedCode, hashedCodes[i]);
      if (match) {
        const remainingCodes = [...hashedCodes.slice(0, i), ...hashedCodes.slice(i + 1)];
        return { valid: true, remainingCodes };
      }
    }

    return { valid: false, remainingCodes: hashedCodes };
  }

  // ---- Private helpers ----

  private base32Encode(buffer: Buffer): string {
    let bits = '';
    for (const byte of buffer) {
      bits += byte.toString(2).padStart(8, '0');
    }
    // Pad to multiple of 5
    while (bits.length % 5 !== 0) {
      bits += '0';
    }

    let result = '';
    for (let i = 0; i < bits.length; i += 5) {
      const index = parseInt(bits.substring(i, i + 5), 2);
      result += BASE32_ALPHABET[index];
    }

    return result;
  }

  private base32Decode(encoded: string): Buffer {
    let bits = '';
    for (const char of encoded.toUpperCase()) {
      const idx = BASE32_ALPHABET.indexOf(char);
      if (idx === -1) continue;
      bits += idx.toString(2).padStart(5, '0');
    }

    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      bytes.push(parseInt(bits.substring(i, i + 8), 2));
    }

    return Buffer.from(bytes);
  }

  private generateTOTP(secret: string, counter: number): string {
    const secretBuffer = this.base32Decode(secret);

    // Convert counter to 8-byte big-endian buffer
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    counterBuffer.writeUInt32BE(counter & 0xffffffff, 4);

    // HMAC-SHA1
    const hmac = crypto.createHmac('sha1', secretBuffer);
    hmac.update(counterBuffer);
    const hash = hmac.digest();

    // Dynamic truncation (RFC 4226)
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  private generateOtpauthUrl(email: string, secret: string): string {
    const issuer = 'BookingOS';
    const label = encodeURIComponent(`${issuer}:${email}`);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
  }
}
