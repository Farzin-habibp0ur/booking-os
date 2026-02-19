import { Injectable, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from './prisma.service';

@Injectable()
export class TokenService {
  constructor(private prisma: PrismaService) {}

  async createToken(
    type: string,
    email: string,
    businessId?: string,
    staffId?: string,
    expiryHours = 24,
    bookingId?: string,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    await this.prisma.token.create({
      data: { token, type, email, businessId, staffId, bookingId, expiresAt },
    });

    return token;
  }

  async validateToken(token: string, type: string) {
    const record = await this.prisma.token.findUnique({ where: { token } });

    if (!record || record.type !== type) {
      throw new BadRequestException('Invalid token');
    }
    if (record.usedAt) {
      throw new BadRequestException('Token has already been used');
    }
    if (record.expiresAt < new Date()) {
      throw new BadRequestException('Token has expired');
    }

    return record;
  }

  /**
   * C1/C2/C3 fix: Atomically validate AND mark a token as used in a single query.
   * Uses updateMany with WHERE conditions so only one concurrent request can succeed.
   * This prevents race conditions where two requests both validate the same token
   * before either marks it used.
   */
  async validateAndConsume(token: string, type: string) {
    const result = await this.prisma.token.updateMany({
      where: {
        token,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });

    if (result.count === 0) {
      // Provide a specific error message
      const record = await this.prisma.token.findUnique({ where: { token } });
      if (!record || record.type !== type) throw new BadRequestException('Invalid token');
      if (record.usedAt) throw new BadRequestException('Token has already been used');
      if (record.expiresAt < new Date()) throw new BadRequestException('Token has expired');
      throw new BadRequestException('Invalid token');
    }

    return this.prisma.token.findUnique({ where: { token } });
  }

  async markUsed(tokenId: string) {
    await this.prisma.token.update({
      where: { id: tokenId },
      data: { usedAt: new Date() },
    });
  }

  async revokeTokens(email: string, type: string) {
    await this.prisma.token.deleteMany({
      where: { email, type },
    });
  }

  async revokeBookingTokens(bookingId: string, type: string) {
    await this.prisma.token.deleteMany({
      where: { bookingId, type },
    });
  }

  // C4 support: Revoke all stored tokens for a user regardless of type
  async revokeAllTokensForEmail(email: string) {
    await this.prisma.token.deleteMany({
      where: { email },
    });
  }
}
