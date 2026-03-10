import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { randomBytes } from 'crypto';

const REFERRAL_CREDIT_AMOUNT = 50;

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private getWebUrl(): string {
    const webUrl = this.config.get<string>('WEB_URL');
    if (webUrl) return webUrl;

    // Fallback: derive from CORS_ORIGINS (first origin is the web app)
    const corsOrigins = this.config.get<string>('CORS_ORIGINS');
    if (corsOrigins) {
      const firstOrigin = corsOrigins.split(',')[0].trim();
      if (firstOrigin && !firstOrigin.includes('localhost')) return firstOrigin;
    }

    return 'http://localhost:3000';
  }

  /**
   * Generate a unique referral code for a business.
   * Called lazily on first access or on business creation.
   */
  async getOrCreateReferralCode(businessId: string): Promise<string> {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { referralCode: true },
    });

    if (!business) throw new BadRequestException('Business not found');

    if (business.referralCode) return business.referralCode;

    // Generate a short, unique referral code
    const code = this.generateCode();
    const updated = await this.prisma.business.update({
      where: { id: businessId },
      data: { referralCode: code },
    });

    return updated.referralCode!;
  }

  /**
   * Get the full referral link for a business.
   */
  async getReferralLink(businessId: string): Promise<string> {
    const code = await this.getOrCreateReferralCode(businessId);
    return `${this.getWebUrl()}/signup?ref=${code}`;
  }

  /**
   * Track a referral when a new business signs up with a referral code.
   * Creates a PENDING referral record linking the referrer to the referred business.
   */
  async trackReferral(referralCode: string, referredBusinessId: string): Promise<void> {
    // Find the referrer business by code
    const referrer = await this.prisma.business.findUnique({
      where: { referralCode: referralCode },
      select: { id: true },
    });

    if (!referrer) {
      this.logger.warn(`Invalid referral code used: ${referralCode}`);
      return; // Silently ignore invalid codes — don't block signup
    }

    // Don't allow self-referral
    if (referrer.id === referredBusinessId) {
      this.logger.warn(`Self-referral attempted: ${referredBusinessId}`);
      return;
    }

    // Check if this referral already exists
    const existing = await this.prisma.referral.findFirst({
      where: { referredBusinessId },
    });

    if (existing) {
      this.logger.warn(`Business ${referredBusinessId} already has a referral record`);
      return;
    }

    await this.prisma.referral.create({
      data: {
        referrerBusinessId: referrer.id,
        referredBusinessId,
        referralCode,
        status: 'PENDING',
        creditAmount: REFERRAL_CREDIT_AMOUNT,
      },
    });

    this.logger.log(
      `Referral tracked: ${referrer.id} referred ${referredBusinessId} via code ${referralCode}`,
    );
  }

  /**
   * Called when a referred business makes their first payment.
   * Applies $50 credit to both the referrer and the referred business via Stripe.
   */
  async convertReferral(referredBusinessId: string, stripe: any): Promise<void> {
    const referral = await this.prisma.referral.findFirst({
      where: {
        referredBusinessId,
        status: 'PENDING',
      },
      include: {
        referrerBusiness: {
          include: { subscription: true },
        },
        referredBusiness: {
          include: { subscription: true },
        },
      },
    });

    if (!referral) return; // No pending referral for this business

    try {
      // Apply credits to both businesses via Stripe customer balance
      const referrerSub = referral.referrerBusiness?.subscription;
      const referredSub = referral.referredBusiness?.subscription;

      if (referrerSub?.stripeCustomerId && stripe) {
        await stripe.customers.createBalanceTransaction(referrerSub.stripeCustomerId, {
          amount: -REFERRAL_CREDIT_AMOUNT * 100, // Negative = credit in Stripe (cents)
          currency: 'usd',
          description: 'Referral credit — Give $50, Get $50',
        });
      }

      if (referredSub?.stripeCustomerId && stripe) {
        await stripe.customers.createBalanceTransaction(referredSub.stripeCustomerId, {
          amount: -REFERRAL_CREDIT_AMOUNT * 100,
          currency: 'usd',
          description: 'Referral credit — Welcome bonus from referral',
        });
      }

      // Update referral status
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: 'CREDITED',
          convertedAt: new Date(),
          creditedAt: new Date(),
        },
      });

      this.logger.log(
        `Referral credited: referrer=${referral.referrerBusinessId}, referred=${referredBusinessId}, amount=$${REFERRAL_CREDIT_AMOUNT} each`,
      );
    } catch (err) {
      // Mark as converted even if Stripe credit fails — can be retried
      await this.prisma.referral.update({
        where: { id: referral.id },
        data: {
          status: 'CONVERTED',
          convertedAt: new Date(),
        },
      });
      this.logger.error(
        `Failed to apply referral credits for referral ${referral.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Get referral stats for a business (as referrer).
   */
  async getReferralStats(businessId: string) {
    const code = await this.getOrCreateReferralCode(businessId);

    const referrals = await this.prisma.referral.findMany({
      where: { referrerBusinessId: businessId },
      select: {
        id: true,
        status: true,
        creditAmount: true,
        createdAt: true,
        convertedAt: true,
        creditedAt: true,
        referredBusiness: {
          select: { name: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalInvites = referrals.length;
    const successfulReferrals = referrals.filter(
      (r) => r.status === 'CREDITED' || r.status === 'CONVERTED',
    ).length;
    const pendingReferrals = referrals.filter((r) => r.status === 'PENDING').length;
    const totalCreditsEarned = referrals
      .filter((r) => r.status === 'CREDITED')
      .reduce((sum, r) => sum + r.creditAmount, 0);

    const referralLink = `${this.getWebUrl()}/signup?ref=${code}`;

    return {
      referralCode: code,
      referralLink,
      totalInvites,
      successfulReferrals,
      pendingReferrals,
      totalCreditsEarned,
      referrals: referrals.map((r) => ({
        id: r.id,
        status: r.status,
        creditAmount: r.creditAmount,
        businessName: r.referredBusiness?.name || 'Pending',
        createdAt: r.createdAt.toISOString(),
        convertedAt: r.convertedAt?.toISOString() || null,
        creditedAt: r.creditedAt?.toISOString() || null,
      })),
    };
  }

  private generateCode(): string {
    // Generate a 6-character alphanumeric code
    return randomBytes(4).toString('base64url').slice(0, 8).toUpperCase();
  }
}
