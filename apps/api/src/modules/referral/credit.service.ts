import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class CreditService {
  private readonly logger = new Logger(CreditService.name);

  constructor(private prisma: PrismaService) {}

  async issueCredit({
    businessId,
    customerId,
    amount,
    source,
    referralId,
    expiryMonths,
  }: {
    businessId: string;
    customerId: string;
    amount: number;
    source: string;
    referralId?: string;
    expiryMonths?: number;
  }) {
    const expiresAt = expiryMonths
      ? new Date(Date.now() + expiryMonths * 30 * 24 * 60 * 60 * 1000)
      : null;

    return this.prisma.customerCredit.create({
      data: {
        businessId,
        customerId,
        amount,
        remainingAmount: amount,
        source,
        referralId: referralId ?? null,
        expiresAt,
      },
    });
  }

  async getAvailableCredits(customerId: string, businessId: string) {
    const now = new Date();
    const credits = await this.prisma.customerCredit.findMany({
      where: {
        customerId,
        businessId,
        remainingAmount: { gt: 0 },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      orderBy: { expiresAt: 'asc' },
    });

    const total = credits.reduce((sum, c) => sum + c.remainingAmount, 0);
    return { total, credits };
  }

  async redeemCredit({
    customerId,
    businessId,
    bookingId,
    amount,
  }: {
    customerId: string;
    businessId: string;
    bookingId: string;
    amount: number;
  }) {
    return this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const credits = await tx.customerCredit.findMany({
        where: {
          customerId,
          businessId,
          remainingAmount: { gt: 0 },
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        orderBy: { expiresAt: 'asc' },
      });

      const totalAvailable = credits.reduce((sum, c) => sum + c.remainingAmount, 0);
      if (totalAvailable < amount) {
        throw new BadRequestException(
          `Insufficient credits. Available: $${totalAvailable.toFixed(2)}, requested: $${amount.toFixed(2)}`,
        );
      }

      let remaining = amount;
      const redemptions = [];

      for (const credit of credits) {
        if (remaining <= 0) break;

        const redeemAmount = Math.min(credit.remainingAmount, remaining);

        await tx.customerCredit.update({
          where: { id: credit.id },
          data: { remainingAmount: credit.remainingAmount - redeemAmount },
        });

        const redemption = await tx.creditRedemption.create({
          data: {
            creditId: credit.id,
            bookingId,
            amount: redeemAmount,
          },
        });

        redemptions.push(redemption);
        remaining -= redeemAmount;
      }

      return redemptions;
    });
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async expireCredits() {
    const now = new Date();
    const result = await this.prisma.customerCredit.updateMany({
      where: {
        expiresAt: { lt: now },
        remainingAmount: { gt: 0 },
      },
      data: { remainingAmount: 0 },
    });

    if (result.count > 0) {
      this.logger.log(`Expired ${result.count} customer credits`);
    }

    return result.count;
  }
}
