import {
  Injectable,
  Logger,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { CreditService } from './credit.service';
import { UpdateReferralSettingsDto } from './dto/update-referral-settings.dto';

const DEFAULT_SETTINGS = {
  enabled: true,
  referrerCredit: 25,
  refereeCredit: 25,
  maxReferralsPerCustomer: 0,
  creditExpiryMonths: 6,
  messageTemplate:
    'Hi! I love {businessName}. Book your first appointment with my link and we both get ${creditAmount} off: {referralLink}',
  emailSubject: "You've been referred to {businessName}!",
};

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private creditService: CreditService,
  ) {}

  private async assertReferralVertical(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (!business) throw new NotFoundException('Business not found');
    const allowed = ['AESTHETIC', 'WELLNESS'];
    if (!allowed.includes(business.verticalPack.toUpperCase())) {
      throw new ForbiddenException(
        'Referral program is only available for Aesthetic and Wellness verticals',
      );
    }
  }

  async getOrCreateReferralCode(customerId: string, businessId: string): Promise<string> {
    await this.assertReferralVertical(businessId);

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
      select: { referralCode: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    if (customer.referralCode) return customer.referralCode;

    const code = randomBytes(6).toString('base64url').slice(0, 8).toUpperCase();
    const updated = await this.prisma.customer.update({
      where: { id: customerId },
      data: { referralCode: code },
    });
    return updated.referralCode!;
  }

  async getReferralLink(customerId: string, businessId: string): Promise<string> {
    const code = await this.getOrCreateReferralCode(customerId, businessId);
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { slug: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    const webUrl = this.getWebUrl();
    return `${webUrl}/book/${business.slug}?ref=${code}`;
  }

  async trackReferralClick(
    referralCode: string,
    businessSlug: string,
  ): Promise<{
    valid: boolean;
    referrerName?: string;
    businessName?: string;
    creditAmount?: number;
  }> {
    const business = await this.prisma.business.findUnique({
      where: { slug: businessSlug },
      select: { id: true, name: true, packConfig: true },
    });
    if (!business) return { valid: false };

    const customer = await this.prisma.customer.findFirst({
      where: { referralCode, businessId: business.id },
      select: { name: true },
    });
    if (!customer) return { valid: false };

    const settings = this.parseSettings(business.packConfig);
    return {
      valid: true,
      referrerName: customer.name,
      businessName: business.name,
      creditAmount: settings.refereeCredit,
    };
  }

  async createPendingReferral(
    referralCode: string,
    referredCustomerId: string,
    businessId: string,
  ) {
    await this.assertReferralVertical(businessId);

    const referrer = await this.prisma.customer.findFirst({
      where: { referralCode, businessId },
    });
    if (!referrer) throw new BadRequestException('Invalid referral code');
    if (referrer.id === referredCustomerId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    const settings = this.parseSettings(
      (await this.prisma.business.findUnique({
        where: { id: businessId },
        select: { packConfig: true },
      }))!.packConfig,
    );

    // Check max referrals cap
    if (settings.maxReferralsPerCustomer > 0) {
      const count = await this.prisma.customerReferral.count({
        where: { referrerCustomerId: referrer.id, businessId },
      });
      if (count >= settings.maxReferralsPerCustomer) {
        throw new BadRequestException('Maximum referral limit reached');
      }
    }

    // Check duplicate
    const existing = await this.prisma.customerReferral.findFirst({
      where: {
        businessId,
        referrerCustomerId: referrer.id,
        referredCustomerId,
      },
    });
    if (existing) throw new BadRequestException('Referral already exists');

    return this.prisma.customerReferral.create({
      data: {
        businessId,
        referrerCustomerId: referrer.id,
        referredCustomerId,
        referralCode,
        status: 'PENDING',
        referrerCreditAmount: settings.referrerCredit,
        refereeCreditAmount: settings.refereeCredit,
      },
    });
  }

  async completeReferral(bookingId: string) {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      select: { id: true, customerId: true, businessId: true },
    });
    if (!booking) return;

    // Find a PENDING referral where this customer was referred
    const referral = await this.prisma.customerReferral.findFirst({
      where: {
        referredCustomerId: booking.customerId,
        businessId: booking.businessId,
        status: 'PENDING',
      },
    });
    if (!referral) return;

    const business = await this.prisma.business.findUnique({
      where: { id: booking.businessId },
      select: { packConfig: true },
    });
    const settings = this.parseSettings(business?.packConfig);

    // Update referral to COMPLETED
    await this.prisma.customerReferral.update({
      where: { id: referral.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        bookingId,
      },
    });

    // Issue credits to both parties
    await this.creditService.issueCredit({
      businessId: booking.businessId,
      customerId: referral.referrerCustomerId,
      amount: referral.referrerCreditAmount,
      source: 'REFERRAL_GIVEN',
      referralId: referral.id,
      expiryMonths: settings.creditExpiryMonths,
    });

    await this.creditService.issueCredit({
      businessId: booking.businessId,
      customerId: booking.customerId,
      amount: referral.refereeCreditAmount,
      source: 'REFERRAL_RECEIVED',
      referralId: referral.id,
      expiryMonths: settings.creditExpiryMonths,
    });

    this.logger.log(
      `Referral ${referral.id} completed for booking ${bookingId}: ` +
        `referrer ${referral.referrerCustomerId} gets $${referral.referrerCreditAmount}, ` +
        `referee ${booking.customerId} gets $${referral.refereeCreditAmount}`,
    );
  }

  async getReferralSettings(businessId: string) {
    await this.assertReferralVertical(businessId);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { packConfig: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    return this.parseSettings(business.packConfig);
  }

  async updateReferralSettings(businessId: string, dto: UpdateReferralSettingsDto) {
    await this.assertReferralVertical(businessId);

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { packConfig: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    const currentConfig =
      typeof business.packConfig === 'object' && business.packConfig !== null
        ? (business.packConfig as Record<string, unknown>)
        : {};

    const currentReferral =
      typeof currentConfig.referral === 'object' && currentConfig.referral !== null
        ? (currentConfig.referral as Record<string, unknown>)
        : {};

    const updatedReferral = { ...currentReferral, ...dto };
    const updatedConfig = { ...currentConfig, referral: updatedReferral };

    await this.prisma.business.update({
      where: { id: businessId },
      data: { packConfig: updatedConfig },
    });

    return updatedReferral;
  }

  async getReferralStats(businessId: string) {
    await this.assertReferralVertical(businessId);

    const [totalReferrals, completedReferrals, pendingReferrals] = await Promise.all([
      this.prisma.customerReferral.count({ where: { businessId } }),
      this.prisma.customerReferral.count({ where: { businessId, status: 'COMPLETED' } }),
      this.prisma.customerReferral.count({ where: { businessId, status: 'PENDING' } }),
    ]);

    const credits = await this.prisma.customerCredit.aggregate({
      where: {
        businessId,
        source: { in: ['REFERRAL_GIVEN', 'REFERRAL_RECEIVED'] },
      },
      _sum: { amount: true },
    });

    const redemptions = await this.prisma.creditRedemption.aggregate({
      where: {
        credit: { businessId },
      },
      _sum: { amount: true },
    });

    const recentReferrals = await this.prisma.customerReferral.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        referrerCustomer: { select: { id: true, name: true } },
        referredCustomer: { select: { id: true, name: true } },
      },
    });

    return {
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalCreditsIssued: credits._sum.amount ?? 0,
      totalCreditsRedeemed: redemptions._sum.amount ?? 0,
      recentReferrals: recentReferrals.map((r) => ({
        id: r.id,
        referrerName: r.referrerCustomer.name,
        referredName: r.referredCustomer?.name ?? 'Pending',
        status: r.status,
        referrerCreditAmount: r.referrerCreditAmount,
        refereeCreditAmount: r.refereeCreditAmount,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    };
  }

  async getCustomerReferralInfo(customerId: string, businessId: string) {
    await this.assertReferralVertical(businessId);

    const code = await this.getOrCreateReferralCode(customerId, businessId);
    const link = await this.getReferralLink(customerId, businessId);
    const { total: creditsRemaining } = await this.creditService.getAvailableCredits(
      customerId,
      businessId,
    );

    const referrals = await this.prisma.customerReferral.findMany({
      where: { referrerCustomerId: customerId, businessId },
      orderBy: { createdAt: 'desc' },
      include: {
        referredCustomer: { select: { name: true } },
      },
    });

    const creditsEarned = await this.prisma.customerCredit.aggregate({
      where: {
        customerId,
        businessId,
        source: { in: ['REFERRAL_GIVEN', 'REFERRAL_RECEIVED'] },
      },
      _sum: { amount: true },
    });

    return {
      referralCode: code,
      referralLink: link,
      totalReferrals: referrals.length,
      creditsEarned: creditsEarned._sum.amount ?? 0,
      creditsRemaining,
      referrals: referrals.map((r) => ({
        id: r.id,
        referredName: r.referredCustomer?.name ?? 'Pending',
        status: r.status,
        creditAmount: r.referrerCreditAmount,
        createdAt: r.createdAt,
        completedAt: r.completedAt,
      })),
    };
  }

  private getWebUrl(): string {
    const webUrl = this.config.get<string>('WEB_URL');
    if (webUrl) return webUrl;

    const corsOrigins = this.config.get<string>('CORS_ORIGINS', 'http://localhost:3000');
    return corsOrigins.split(',')[0].trim();
  }

  private parseSettings(packConfig: unknown) {
    const config =
      typeof packConfig === 'object' && packConfig !== null
        ? (packConfig as Record<string, unknown>)
        : {};
    const referral =
      typeof config.referral === 'object' && config.referral !== null
        ? (config.referral as Record<string, unknown>)
        : {};

    return {
      enabled: (referral.enabled as boolean) ?? DEFAULT_SETTINGS.enabled,
      referrerCredit: (referral.referrerCredit as number) ?? DEFAULT_SETTINGS.referrerCredit,
      refereeCredit: (referral.refereeCredit as number) ?? DEFAULT_SETTINGS.refereeCredit,
      maxReferralsPerCustomer:
        (referral.maxReferralsPerCustomer as number) ?? DEFAULT_SETTINGS.maxReferralsPerCustomer,
      creditExpiryMonths:
        (referral.creditExpiryMonths as number) ?? DEFAULT_SETTINGS.creditExpiryMonths,
      messageTemplate: (referral.messageTemplate as string) ?? DEFAULT_SETTINGS.messageTemplate,
      emailSubject: (referral.emailSubject as string) ?? DEFAULT_SETTINGS.emailSubject,
    };
  }
}
