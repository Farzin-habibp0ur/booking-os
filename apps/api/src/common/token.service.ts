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
}
