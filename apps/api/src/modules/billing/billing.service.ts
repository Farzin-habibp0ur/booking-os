import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { OnboardingDripService } from '../onboarding-drip/onboarding-drip.service';
import { DunningService } from '../dunning/dunning.service';
import { ReferralService } from '../referral/referral.service';
import Stripe from 'stripe';
import {
  PlanTier,
  PLAN_CONFIGS,
  normalizePlanTier,
  TRIAL_DAYS,
  GRACE_PERIOD_DAYS,
} from '../../common/plan-config';

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    private emailService: EmailService,
    private onboardingDrip: OnboardingDripService,
    private dunningService: DunningService,
    private referralService: ReferralService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not configured — billing features disabled');
    }
  }

  // M12 fix: Validate webhook secret at startup when Stripe is enabled
  onModuleInit() {
    if (!this.stripe) return; // Stripe not configured — no webhook to validate
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      const isProduction = this.configService.get('NODE_ENV') === 'production';
      if (isProduction) {
        throw new Error(
          'STRIPE_WEBHOOK_SECRET must be configured in production when STRIPE_SECRET_KEY is set',
        );
      }
      this.logger.warn(
        'STRIPE_WEBHOOK_SECRET not configured — Stripe webhooks will fail. Set this before deploying.',
      );
    }
  }

  private requireStripe(): Stripe {
    if (!this.stripe) {
      throw new BadRequestException('Billing is not configured');
    }
    return this.stripe;
  }

  async createCheckoutSession(
    businessId: string,
    plan: PlanTier,
    billing: 'monthly' | 'annual' = 'monthly',
  ) {
    const stripe = this.requireStripe();

    const planConfig = PLAN_CONFIGS[plan];
    if (!planConfig) throw new BadRequestException(`Invalid plan: ${plan}`);

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new BadRequestException('Business not found');

    const envKey =
      billing === 'annual' ? planConfig.stripePriceEnvAnnual : planConfig.stripePriceEnvMonthly;
    const priceId = this.configService.get<string>(envKey);

    if (!priceId)
      throw new BadRequestException(`No price configured for plan: ${plan} (${billing})`);

    // Get or create Stripe customer
    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });

    let customerId = subscription?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { businessId },
        name: business.name,
      });
      customerId = customer.id;
    }

    const webUrl = this.configService.get<string>('WEB_URL', 'http://localhost:3000');
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${webUrl}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${webUrl}/settings/billing?canceled=true`,
      metadata: { businessId, plan, billing },
    });

    return { url: session.url };
  }

  async createPortalSession(businessId: string) {
    const stripe = this.requireStripe();

    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });

    if (!subscription) throw new BadRequestException('No subscription found');

    const apiUrl = this.configService.get<string>('API_URL', 'http://localhost:3001');
    const session = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${apiUrl}/settings/billing`,
    });

    return { url: session.url };
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string) {
    const stripe = this.requireStripe();
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) throw new BadRequestException('Stripe webhook secret not configured');

    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutComplete(session);
        break;
      }
      case 'invoice.paid': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handleInvoicePaid(invoice);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        await this.handlePaymentFailed(invoice);
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionDeleted(sub);
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdated(sub);
        break;
      }
      case 'customer.subscription.trial_will_end': {
        const sub = event.data.object as Stripe.Subscription;
        await this.handleTrialWillEnd(sub);
        break;
      }
      case 'payment_intent.succeeded': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentIntentSucceeded(paymentIntent);
        break;
      }
      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await this.handlePaymentIntentFailed(paymentIntent);
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const businessId = session.metadata?.businessId;
    const rawPlan = session.metadata?.plan || 'starter';
    const plan = normalizePlanTier(rawPlan);
    if (!businessId || !session.subscription) return;

    const stripe = this.requireStripe();
    const sub = await stripe.subscriptions.retrieve(session.subscription as string);

    await this.prisma.subscription.upsert({
      where: { businessId },
      create: {
        businessId,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: sub.id,
        plan,
        status: sub.status,
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
      },
      update: {
        stripeSubscriptionId: sub.id,
        plan,
        status: sub.status,
        currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
      },
    });

    // Clear trial/grace dates on successful conversion
    await this.prisma.business.update({
      where: { id: businessId },
      data: { trialEndsAt: null, graceEndsAt: null },
    });

    // Cancel onboarding drip (user converted)
    try {
      await this.onboardingDrip.cancelDrip(businessId);
    } catch {
      // Non-critical — drip emails will skip subscribed businesses anyway
    }

    // Send welcome-to-paid email
    try {
      const business = await this.prisma.business.findUnique({
        where: { id: businessId },
        include: { staff: { where: { role: 'ADMIN' }, take: 1 } },
      });
      if (business?.staff[0]) {
        const staff = business.staff[0];
        await this.emailService.sendGeneric(staff.email, {
          subject: `Welcome to Booking OS ${PLAN_CONFIGS[plan].label}!`,
          headline: 'Your subscription is active',
          body: `Thanks for subscribing to Booking OS ${PLAN_CONFIGS[plan].label}. All features for your plan are now unlocked. If you have any questions, reply to this email.`,
          ctaLabel: 'Go to Dashboard',
          ctaUrl: `${this.configService.get('WEB_URL', 'http://localhost:3000')}/dashboard`,
        });
      }
    } catch (err) {
      this.logger.warn(`Failed to send welcome-to-paid email for business ${businessId}`, err);
    }

    // Convert referral if this is a referred business making their first payment
    try {
      await this.referralService.convertReferral(businessId, stripe);
    } catch (err) {
      this.logger.warn(
        `Failed to process referral conversion for business ${businessId}: ${(err as Error).message}`,
      );
    }

    this.logger.log(`Subscription created for business ${businessId}: ${plan}`);
  }

  private async handleInvoicePaid(invoice: Stripe.Invoice) {
    if (!(invoice as any).subscription) return;

    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: (invoice as any).subscription as string },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'active' },
      });

      // Cancel any active dunning sequence (payment recovered)
      try {
        await this.dunningService.cancelDunning(subscription.businessId);
      } catch {
        // Non-critical — dunning emails will skip active subscriptions anyway
      }
    }
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice) {
    if (!(invoice as any).subscription) return;

    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: (invoice as any).subscription as string },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'past_due' },
      });
      this.logger.warn(`Payment failed for business ${subscription.businessId}`);

      // Trigger dunning email sequence
      try {
        const business = await this.prisma.business.findUnique({
          where: { id: subscription.businessId },
          include: { staff: { where: { role: 'ADMIN' }, take: 1 } },
        });
        if (business?.staff[0]) {
          const staff = business.staff[0];
          await this.dunningService.scheduleDunning(
            subscription.businessId,
            staff.email,
            staff.name,
          );
        }
      } catch (err) {
        this.logger.warn(
          `Failed to schedule dunning for business ${subscription.businessId}: ${(err as Error).message}`,
        );
      }
    }
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: sub.id },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled', canceledAt: new Date() },
      });

      // Set grace period: 7 days from now
      const graceEnd = new Date(Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);
      await this.prisma.business.update({
        where: { id: subscription.businessId },
        data: { graceEndsAt: graceEnd },
      });

      this.logger.log(`Subscription canceled for business ${subscription.businessId}`);
    }
  }

  private async handleSubscriptionUpdated(sub: Stripe.Subscription) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: sub.id },
    });

    if (subscription) {
      const plan = normalizePlanTier((sub as any).metadata?.plan || subscription.plan);
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          status: sub.status,
          plan,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
      });
    }
  }

  private async handleTrialWillEnd(sub: Stripe.Subscription) {
    // Triggered 3 days before trial ends
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: sub.id },
    });

    if (!subscription) return;

    try {
      const business = await this.prisma.business.findUnique({
        where: { id: subscription.businessId },
        include: { staff: { where: { role: 'ADMIN' }, take: 1 } },
      });

      if (business?.staff[0]) {
        const staff = business.staff[0];
        const webUrl = this.configService.get('WEB_URL', 'http://localhost:3000');
        await this.emailService.sendGeneric(staff.email, {
          subject: 'Your Booking OS trial ends in 3 days',
          headline: 'Trial ending soon',
          body: `Your 14-day free trial of Booking OS ends in 3 days. Choose a plan to keep all your data, settings, and automations running without interruption.`,
          ctaLabel: 'Choose a Plan',
          ctaUrl: `${webUrl}/settings/billing`,
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to send trial-will-end email for business ${subscription.businessId}`,
        err,
      );
    }
  }

  private async handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });
    if (!payment) {
      this.logger.log(`No payment found for PaymentIntent ${paymentIntent.id}`);
      return;
    }
    if (payment.status === 'COMPLETED') {
      this.logger.log(`Payment ${payment.id} already completed (idempotent)`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'COMPLETED' },
    });

    // Safety net: confirm booking if still PENDING_DEPOSIT
    if (payment.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: payment.bookingId },
      });
      if (booking && booking.status === 'PENDING_DEPOSIT') {
        await this.prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'CONFIRMED' },
        });
        this.logger.log(`Booking ${booking.id} confirmed via webhook safety net`);
      }
    }
  }

  private async handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent) {
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: paymentIntent.id },
    });
    if (!payment) {
      this.logger.warn(`No payment found for failed PaymentIntent ${paymentIntent.id}`);
      return;
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'FAILED' },
    });
    this.logger.warn(`Payment ${payment.id} marked as failed`);
  }

  // Deposit payment for a booking
  async createDepositPaymentIntent(businessId: string, bookingId: string) {
    const stripe = this.requireStripe();

    // C8 fix: Wrap in transaction with row lock to prevent deposit race condition
    const { paymentIntent, amount } = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Booking" WHERE id = ${bookingId} AND "businessId" = ${businessId} FOR UPDATE`;

      const booking = await tx.booking.findFirst({
        where: { id: bookingId, businessId },
        include: { service: true },
      });

      if (!booking) throw new BadRequestException('Booking not found');
      if (!booking.service.depositRequired)
        throw new BadRequestException('Deposit not required for this service');

      const amount = booking.service.depositAmount || booking.service.price;
      if (!amount || amount <= 0) throw new BadRequestException('Invalid deposit amount');

      // C9 fix: Add idempotency key to prevent duplicate payment intents on retry
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: Math.round(amount * 100), // Stripe uses cents
          currency: 'usd',
          metadata: { bookingId, businessId },
        },
        { idempotencyKey: `deposit-${bookingId}` },
      );

      await tx.payment.create({
        data: {
          businessId,
          bookingId,
          stripePaymentIntentId: paymentIntent.id,
          amount,
          currency: 'usd',
          status: 'pending',
        },
      });

      return { paymentIntent, amount };
    });

    return {
      clientSecret: paymentIntent.client_secret,
      amount,
    };
  }

  async getSubscription(businessId: string) {
    return this.prisma.subscription.findUnique({ where: { businessId } });
  }

  /** Get billing status including trial info for the frontend */
  async getBillingStatus(businessId: string) {
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      include: { subscription: true },
    });

    if (!business) throw new BadRequestException('Business not found');

    const now = new Date();
    const isTrial = business.trialEndsAt ? business.trialEndsAt > now : false;
    const trialDaysRemaining =
      isTrial && business.trialEndsAt
        ? Math.max(
            0,
            Math.ceil((business.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
          )
        : 0;

    const isGracePeriod =
      business.trialEndsAt &&
      business.graceEndsAt &&
      now > business.trialEndsAt &&
      now <= business.graceEndsAt;

    const trialExpired = business.trialEndsAt ? now > business.trialEndsAt : false;

    const subscription = business.subscription;
    const plan = subscription ? normalizePlanTier(subscription.plan) : 'starter';

    return {
      plan,
      status: subscription?.status || (isTrial ? 'trialing' : trialExpired ? 'expired' : 'none'),
      isTrial,
      trialDaysRemaining,
      trialEndsAt: business.trialEndsAt?.toISOString() || null,
      isGracePeriod: !!isGracePeriod,
      graceEndsAt: business.graceEndsAt?.toISOString() || null,
      subscription: subscription
        ? {
            id: subscription.id,
            plan: normalizePlanTier(subscription.plan),
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
            canceledAt: subscription.canceledAt?.toISOString() || null,
          }
        : null,
    };
  }

  /** Switch current subscription from monthly to annual billing */
  async switchToAnnual(businessId: string) {
    const stripe = this.requireStripe();

    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });
    if (!subscription?.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found');
    }

    const plan = normalizePlanTier(subscription.plan);
    const planConfig = PLAN_CONFIGS[plan];
    const annualPriceId = this.configService.get<string>(planConfig.stripePriceEnvAnnual);
    if (!annualPriceId) throw new BadRequestException('Annual price not configured');

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const itemId = (stripeSub as any).items?.data?.[0]?.id;
    if (!itemId) throw new BadRequestException('Subscription has no items');

    const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{ id: itemId, price: annualPriceId }],
      proration_behavior: 'create_prorations',
    });

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodEnd: new Date((updated as any).current_period_end * 1000),
      },
    });

    const savings = this.calculateAnnualSavings(plan);
    return { subscription: updated, savings };
  }

  /** Switch current subscription from annual to monthly billing */
  async switchToMonthly(businessId: string) {
    const stripe = this.requireStripe();

    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });
    if (!subscription?.stripeSubscriptionId) {
      throw new BadRequestException('No active subscription found');
    }

    const plan = normalizePlanTier(subscription.plan);
    const planConfig = PLAN_CONFIGS[plan];
    const monthlyPriceId = this.configService.get<string>(planConfig.stripePriceEnvMonthly);
    if (!monthlyPriceId) throw new BadRequestException('Monthly price not configured');

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const itemId = (stripeSub as any).items?.data?.[0]?.id;
    if (!itemId) throw new BadRequestException('Subscription has no items');

    const updated = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      items: [{ id: itemId, price: monthlyPriceId }],
      proration_behavior: 'create_prorations',
    });

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        currentPeriodEnd: new Date((updated as any).current_period_end * 1000),
      },
    });

    return { subscription: updated };
  }

  /** Calculate annual savings for a plan */
  calculateAnnualSavings(plan: string) {
    const tier = normalizePlanTier(plan);
    const config = PLAN_CONFIGS[tier];
    const monthlyTotal = config.monthlyPrice * 12;
    const annualPrice = config.annualPrice * 12;
    const savingsAmount = monthlyTotal - annualPrice;
    const savingsPercent = Math.round((savingsAmount / monthlyTotal) * 100);

    return { monthlyTotal, annualPrice, savingsAmount, savingsPercent };
  }

  /** Get current billing interval from Stripe subscription */
  async getCurrentBillingInterval(businessId: string): Promise<'monthly' | 'annual'> {
    const stripe = this.requireStripe();

    const subscription = await this.prisma.subscription.findUnique({
      where: { businessId },
    });
    if (!subscription?.stripeSubscriptionId) {
      return 'monthly';
    }

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    const interval = (stripeSub as any).items?.data?.[0]?.price?.recurring?.interval;
    return interval === 'year' ? 'annual' : 'monthly';
  }

  /** Start a free trial for a business */
  async startTrial(businessId: string) {
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    const graceEndsAt = new Date(trialEndsAt.getTime() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000);

    await this.prisma.business.update({
      where: { id: businessId },
      data: { trialEndsAt, graceEndsAt },
    });

    return { trialEndsAt, graceEndsAt };
  }
}
