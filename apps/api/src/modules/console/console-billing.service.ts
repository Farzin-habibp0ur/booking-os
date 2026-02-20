import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import Stripe from 'stripe';

const PLAN_PRICES: Record<string, number> = { basic: 49, pro: 149 };

interface SubscriptionListQuery {
  search?: string;
  plan?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ConsoleBillingService {
  private readonly logger = new Logger(ConsoleBillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Billing is not configured');
    }
    return this.stripe;
  }

  async getDashboard() {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Batch 1: status counts + plan counts
    const [activeBasic, activePro, trialCount, pastDueCount, canceledCount, canceledRecent] =
      await Promise.all([
        this.prisma.subscription.count({
          where: { status: 'active', plan: 'basic' },
        }),
        this.prisma.subscription.count({
          where: { status: 'active', plan: 'pro' },
        }),
        this.prisma.subscription.count({ where: { status: 'trialing' } }),
        this.prisma.subscription.count({ where: { status: 'past_due' } }),
        this.prisma.subscription.count({ where: { status: 'canceled' } }),
        this.prisma.subscription.count({
          where: { status: 'canceled', updatedAt: { gte: thirtyDaysAgo } },
        }),
      ]);

    // Batch 2: trial-to-paid rate
    const [trialCreatedRecent, trialConvertedRecent] = await Promise.all([
      this.prisma.subscription.count({
        where: { createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.subscription.count({
        where: {
          createdAt: { gte: thirtyDaysAgo },
          status: 'active',
        },
      }),
    ]);

    const activeCount = activeBasic + activePro;
    const mrr = activeBasic * PLAN_PRICES.basic + activePro * PLAN_PRICES.pro;
    const churnDenominator = activeCount + canceledRecent;
    const churnRate = churnDenominator > 0 ? canceledRecent / churnDenominator : 0;
    const arpa = activeCount > 0 ? mrr / activeCount : 0;
    const trialToPaidRate = trialCreatedRecent > 0 ? trialConvertedRecent / trialCreatedRecent : 0;

    return {
      mrr,
      activeCount,
      trialCount,
      pastDueCount,
      canceledCount,
      churnRate,
      arpa,
      trialToPaidRate,
      planDistribution: { basic: activeBasic, pro: activePro },
      totalRevenue30d: mrr,
    };
  }

  async getPastDue() {
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: 'past_due' },
      include: {
        business: {
          include: {
            staff: {
              where: { role: 'ADMIN' },
              take: 1,
              select: { email: true, name: true },
            },
          },
        },
      },
      orderBy: { currentPeriodEnd: 'asc' },
    });

    const now = new Date();
    return subscriptions.map((sub) => {
      const daysPastDue = Math.floor(
        (now.getTime() - sub.currentPeriodEnd.getTime()) / (1000 * 60 * 60 * 24),
      );
      return {
        id: sub.id,
        businessId: sub.businessId,
        businessName: sub.business.name,
        ownerEmail: sub.business.staff[0]?.email || null,
        plan: sub.plan,
        currentPeriodEnd: sub.currentPeriodEnd,
        daysPastDue: Math.max(0, daysPastDue),
      };
    });
  }

  async getSubscriptions(query: SubscriptionListQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.plan) where.plan = query.plan;
    if (query.status) where.status = query.status;

    if (query.search) {
      where.business = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { slug: { contains: query.search, mode: 'insensitive' } },
          {
            staff: {
              some: {
                email: { contains: query.search, mode: 'insensitive' },
                role: 'ADMIN',
              },
            },
          },
        ],
      };
    }

    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        include: {
          business: {
            include: {
              staff: {
                where: { role: 'ADMIN' },
                take: 1,
                select: { email: true, name: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.subscription.count({ where }),
    ]);

    const items = subscriptions.map((sub) => ({
      id: sub.id,
      businessId: sub.businessId,
      businessName: sub.business.name,
      businessSlug: sub.business.slug,
      ownerEmail: sub.business.staff[0]?.email || null,
      plan: sub.plan,
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      createdAt: sub.createdAt,
    }));

    return { items, total, page, pageSize };
  }

  async getBillingForBusiness(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { subscription: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    const credits = await this.prisma.billingCredit.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { issuedBy: { select: { name: true, email: true } } },
    });

    let invoices: any[] = [];
    if (business.subscription?.stripeCustomerId) {
      invoices = await this.fetchInvoicesFromStripe(business.subscription.stripeCustomerId);
    }

    return {
      subscription: business.subscription
        ? {
            id: business.subscription.id,
            plan: business.subscription.plan,
            status: business.subscription.status,
            currentPeriodEnd: business.subscription.currentPeriodEnd,
            stripeSubscriptionId: business.subscription.stripeSubscriptionId,
            canceledAt: business.subscription.canceledAt,
            cancelReason: business.subscription.cancelReason,
            planChangedAt: business.subscription.planChangedAt,
          }
        : null,
      credits,
      recentInvoices: invoices.slice(0, 5),
    };
  }

  async getInvoicesForBusiness(businessId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) return [];

    return this.fetchInvoicesFromStripe(subscription.stripeCustomerId);
  }

  private async fetchInvoicesFromStripe(stripeCustomerId: string): Promise<any[]> {
    try {
      const stripe = this.requireStripe();
      const invoices = await stripe.invoices.list({
        customer: stripeCustomerId,
        limit: 20,
      });

      return invoices.data.map((inv) => ({
        id: inv.id,
        amount: (inv.amount_paid || 0) / 100,
        status: inv.status,
        date: inv.created ? new Date(inv.created * 1000).toISOString() : null,
        pdfUrl: inv.invoice_pdf || null,
      }));
    } catch (error) {
      this.logger.warn('Failed to fetch invoices from Stripe', error);
      return [];
    }
  }

  async changePlan(
    businessId: string,
    newPlan: string,
    reason: string,
    actorId: string,
    actorEmail: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) throw new NotFoundException('No subscription found');
    if (subscription.status === 'canceled') {
      throw new BadRequestException('Cannot change plan on canceled subscription');
    }
    if (subscription.plan === newPlan) {
      throw new BadRequestException('Subscription is already on this plan');
    }

    const stripe = this.requireStripe();
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const itemId = stripeSub.items.data[0]?.id;
    if (!itemId) throw new BadRequestException('No subscription item found');

    const newPriceId =
      newPlan === 'pro'
        ? this.configService.get<string>('STRIPE_PRICE_ID_PRO')
        : this.configService.get<string>('STRIPE_PRICE_ID_BASIC');

    if (!newPriceId) {
      throw new BadRequestException(`No price configured for plan: ${newPlan}`);
    }

    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{ id: itemId, price: newPriceId }],
      proration_behavior: 'create_prorations',
    });

    const oldPlan = subscription.plan;
    const updated = await this.prisma.subscription.update({
      where: { businessId },
      data: { plan: newPlan, planChangedAt: new Date() },
    });

    return { subscription: updated, oldPlan, newPlan };
  }

  async issueCredit(
    businessId: string,
    amount: number,
    reason: string,
    expiresAt: string | undefined,
    actorId: string,
    actorEmail: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });
    if (!subscription) throw new NotFoundException('No subscription found');

    const credit = await this.prisma.billingCredit.create({
      data: {
        businessId,
        issuedById: actorId,
        amount,
        reason,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    // Apply to Stripe balance
    try {
      const stripe = this.requireStripe();
      const balanceTx = await stripe.customers.createBalanceTransaction(
        subscription.stripeCustomerId,
        {
          amount: -Math.round(amount * 100),
          currency: 'usd',
          description: reason,
        },
      );

      await this.prisma.billingCredit.update({
        where: { id: credit.id },
        data: { appliedAt: new Date(), stripeId: balanceTx.id },
      });

      return { ...credit, appliedAt: new Date(), stripeId: balanceTx.id };
    } catch (error) {
      this.logger.warn(`Failed to apply credit to Stripe for business ${businessId}`, error);
      return credit;
    }
  }

  async cancelSubscription(
    businessId: string,
    reason: string,
    immediate: boolean,
    actorId: string,
    actorEmail: string,
  ) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) throw new NotFoundException('No subscription found');
    if (subscription.status === 'canceled') {
      throw new BadRequestException('Subscription is already canceled');
    }

    const stripe = this.requireStripe();

    if (immediate) {
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
    } else {
      await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });
    }

    const updated = await this.prisma.subscription.update({
      where: { businessId },
      data: {
        status: immediate ? 'canceled' : subscription.status,
        canceledAt: new Date(),
        cancelReason: reason,
      },
    });

    return updated;
  }

  async reactivateSubscription(businessId: string, actorId: string, actorEmail: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) throw new NotFoundException('No subscription found');
    if (!subscription.canceledAt && subscription.status !== 'canceled') {
      throw new BadRequestException('Subscription is not canceled');
    }

    const stripe = this.requireStripe();
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    const updated = await this.prisma.subscription.update({
      where: { businessId },
      data: {
        status: 'active',
        canceledAt: null,
        cancelReason: null,
      },
    });

    return updated;
  }

  async getCreditsForBusiness(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { id: true },
    });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.billingCredit.findMany({
      where: { businessId },
      include: { issuedBy: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
