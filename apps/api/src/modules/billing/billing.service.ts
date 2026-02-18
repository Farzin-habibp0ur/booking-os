import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import Stripe from 'stripe';

@Injectable()
export class BillingService implements OnModuleInit {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
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

  async createCheckoutSession(businessId: string, plan: 'basic' | 'pro') {
    const stripe = this.requireStripe();

    const business = await this.prisma.business.findUnique({ where: { id: businessId } });
    if (!business) throw new BadRequestException('Business not found');

    const priceId =
      plan === 'pro'
        ? this.configService.get<string>('STRIPE_PRICE_ID_PRO')
        : this.configService.get<string>('STRIPE_PRICE_ID_BASIC');

    if (!priceId) throw new BadRequestException(`No price configured for plan: ${plan}`);

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

    const apiUrl = this.configService.get<string>('API_URL', 'http://localhost:3001');
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${apiUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${apiUrl}/billing/cancel`,
      metadata: { businessId, plan },
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
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session) {
    const businessId = session.metadata?.businessId;
    const plan = session.metadata?.plan || 'basic';
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
    }
  }

  private async handleSubscriptionDeleted(sub: Stripe.Subscription) {
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeSubscriptionId: sub.id },
    });

    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: 'canceled' },
      });
      this.logger.log(`Subscription canceled for business ${subscription.businessId}`);
    }
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
          bookingId,
          stripePaymentIntentId: paymentIntent.id,
          amount,
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
}
