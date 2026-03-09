import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { OnboardingDripService } from '../onboarding-drip/onboarding-drip.service';
import { DunningService } from '../dunning/dunning.service';
import { ReferralService } from '../referral/referral.service';
import { createMockPrisma } from '../../test/mocks';

// Shared mock instance so tests can override constructEvent
const mockStripeInstance = {
  customers: {
    create: jest.fn().mockResolvedValue({ id: 'cus_test123' }),
  },
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        url: 'https://checkout.stripe.com/test',
      }),
    },
  },
  billingPortal: {
    sessions: {
      create: jest.fn().mockResolvedValue({
        url: 'https://billing.stripe.com/test',
      }),
    },
  },
  subscriptions: {
    retrieve: jest.fn().mockResolvedValue({
      id: 'sub_test123',
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      items: { data: [{ id: 'si_item1', price: { recurring: { interval: 'month' } } }] },
    }),
    update: jest.fn().mockResolvedValue({
      id: 'sub_test123',
      status: 'active',
      current_period_end: Math.floor(Date.now() / 1000) + 86400 * 365,
    }),
  },
  paymentIntents: {
    create: jest.fn().mockResolvedValue({
      id: 'pi_test123',
      client_secret: 'pi_test123_secret',
    }),
  },
  webhooks: {
    constructEvent: jest.fn().mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          customer: 'cus_test123',
          subscription: 'sub_test123',
          metadata: { businessId: 'biz1', plan: 'starter' },
        },
      },
    }),
  },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

describe('BillingService', () => {
  let service: BillingService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockDunningService: { scheduleDunning: jest.Mock; cancelDunning: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockDunningService = {
      scheduleDunning: jest.fn().mockResolvedValue(undefined),
      cancelDunning: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EmailService,
          useValue: { sendGeneric: jest.fn().mockResolvedValue(true) },
        },
        {
          provide: OnboardingDripService,
          useValue: { scheduleDrip: jest.fn(), cancelDrip: jest.fn() },
        },
        {
          provide: DunningService,
          useValue: mockDunningService,
        },
        {
          provide: ReferralService,
          useValue: { convertReferral: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, string> = {
                STRIPE_SECRET_KEY: 'sk_test_123',
                STRIPE_WEBHOOK_SECRET: 'whsec_test',
                STRIPE_PRICE_ID_STARTER_MONTHLY: 'price_starter_m',
                STRIPE_PRICE_ID_STARTER_ANNUAL: 'price_starter_a',
                STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY: 'price_pro_m',
                STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL: 'price_pro_a',
                STRIPE_PRICE_ID_ENTERPRISE_MONTHLY: 'price_ent_m',
                STRIPE_PRICE_ID_ENTERPRISE_ANNUAL: 'price_ent_a',
                API_URL: 'http://localhost:3001',
                WEB_URL: 'http://localhost:3000',
              };
              return config[key] ?? defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(BillingService);
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session for starter plan', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Test Business',
      } as any);
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.createCheckoutSession('biz1', 'starter');
      expect(result.url).toBe('https://checkout.stripe.com/test');
    });

    it('should throw for missing business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.createCheckoutSession('missing', 'starter')).rejects.toThrow(
        'Business not found',
      );
    });
  });

  describe('createPortalSession', () => {
    it('should create a portal session', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_test123',
      } as any);

      const result = await service.createPortalSession('biz1');
      expect(result.url).toBe('https://billing.stripe.com/test');
    });

    it('should throw if no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.createPortalSession('biz1')).rejects.toThrow('No subscription found');
    });
  });

  describe('createDepositPaymentIntent', () => {
    it('should create a payment intent for deposit', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking1',
        service: {
          depositRequired: true,
          depositAmount: 25.0,
          price: 100.0,
        },
      } as any);
      prisma.payment.create.mockResolvedValue({ id: 'pay1' } as any);

      const result = await service.createDepositPaymentIntent('biz1', 'booking1');
      expect(result.clientSecret).toBe('pi_test123_secret');
      expect(result.amount).toBe(25.0);
    });

    it('should throw if deposit not required', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking1',
        service: { depositRequired: false },
      } as any);

      await expect(service.createDepositPaymentIntent('biz1', 'booking1')).rejects.toThrow(
        'Deposit not required',
      );
    });
  });

  describe('getSubscription', () => {
    it('should return subscription for business', async () => {
      const sub = { id: 'sub1', businessId: 'biz1', plan: 'basic', status: 'active' };
      prisma.subscription.findUnique.mockResolvedValue(sub as any);

      const result = await service.getSubscription('biz1');
      expect(result).toEqual(sub);
    });
  });

  describe('handleWebhookEvent', () => {
    const mockSignature = 'test-signature';
    const mockRawBody = Buffer.from('test-body');

    it('should process checkout.session.completed event', async () => {
      prisma.subscription.upsert.mockResolvedValue({} as any);
      prisma.business.update.mockResolvedValue({} as any);
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        staff: [{ email: 'admin@test.com', name: 'Admin' }],
      } as any);

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          create: expect.objectContaining({
            businessId: 'biz1',
            plan: 'starter',
            stripeCustomerId: 'cus_test123',
            stripeSubscriptionId: 'sub_test123',
            status: 'active',
          }),
        }),
      );
      // Should clear trial dates
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { trialEndsAt: null, graceEndsAt: null },
      });
    });

    it('should skip handleCheckoutComplete when no businessId in metadata', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_test',
            subscription: 'sub_test',
            metadata: {},
          },
        },
      });

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('should skip handleCheckoutComplete when no subscription', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'checkout.session.completed',
        data: {
          object: {
            customer: 'cus_test',
            subscription: null,
            metadata: { businessId: 'biz1', plan: 'pro' },
          },
        },
      });

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.upsert).not.toHaveBeenCalled();
    });

    it('should process invoice.paid event and cancel dunning', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: {
          object: { subscription: 'sub_test123' },
        },
      });
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        stripeSubscriptionId: 'sub_test123',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { status: 'active' },
      });
      expect(mockDunningService.cancelDunning).toHaveBeenCalledWith('biz1');
    });

    it('should skip invoice.paid when no subscription in invoice', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: { object: {} },
      });

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    });

    it('should skip invoice.paid when subscription not found in DB', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: { object: { subscription: 'sub_unknown' } },
      });
      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should process invoice.payment_failed event and trigger dunning', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: {
          object: { subscription: 'sub_test123' },
        },
      });
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        stripeSubscriptionId: 'sub_test123',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        staff: [{ email: 'admin@test.com', name: 'Admin' }],
      } as any);

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { status: 'past_due' },
      });
      expect(mockDunningService.scheduleDunning).toHaveBeenCalledWith(
        'biz1',
        'admin@test.com',
        'Admin',
      );
    });

    it('should skip invoice.payment_failed when no subscription', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.payment_failed',
        data: { object: {} },
      });

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.findFirst).not.toHaveBeenCalled();
    });

    it('should process customer.subscription.deleted event', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: {
          object: { id: 'sub_test123' },
        },
      });
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        stripeSubscriptionId: 'sub_test123',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);
      prisma.business.update.mockResolvedValue({} as any);

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { status: 'canceled', canceledAt: expect.any(Date) },
      });
      // Should set grace period on business
      expect(prisma.business.update).toHaveBeenCalledWith({
        where: { id: 'biz1' },
        data: { graceEndsAt: expect.any(Date) },
      });
    });

    it('should skip subscription.deleted when not found in DB', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'customer.subscription.deleted',
        data: { object: { id: 'sub_unknown' } },
      });
      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    it('should handle unknown event type gracefully', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'some.unknown.event',
        data: { object: {} },
      });

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
    });

    it('should use existing stripe customer ID if subscription exists', async () => {
      mockStripeInstance.customers.create.mockClear();
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Test Business',
      } as any);
      prisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: 'existing_cus_id',
      } as any);

      await service.createCheckoutSession('biz1', 'professional');

      expect(mockStripeInstance.customers.create).not.toHaveBeenCalled();
    });

    it('should use service price when depositAmount is not set', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking1',
        service: {
          depositRequired: true,
          depositAmount: null,
          price: 100.0,
        },
      } as any);
      prisma.payment.create.mockResolvedValue({ id: 'pay1' } as any);

      const result = await service.createDepositPaymentIntent('biz1', 'booking1');
      expect(result.amount).toBe(100.0);
    });

    it('should throw when booking not found for deposit', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.createDepositPaymentIntent('biz1', 'missing')).rejects.toThrow(
        'Booking not found',
      );
    });

    it('should throw when deposit amount is zero or negative', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'booking1',
        service: {
          depositRequired: true,
          depositAmount: 0,
          price: 0,
        },
      } as any);

      await expect(service.createDepositPaymentIntent('biz1', 'booking1')).rejects.toThrow(
        'Invalid deposit amount',
      );
    });
  });

  // M12 fix: Webhook secret startup validation
  describe('onModuleInit webhook secret validation', () => {
    it('does not throw when webhook secret is configured', () => {
      // Default service has both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET
      expect(() => service.onModuleInit()).not.toThrow();
    });

    it('warns in development when webhook secret is missing', async () => {
      const module2 = await Test.createTestingModule({
        providers: [
          BillingService,
          { provide: PrismaService, useValue: prisma },
          { provide: EmailService, useValue: { sendGeneric: jest.fn().mockResolvedValue(true) } },
          {
            provide: OnboardingDripService,
            useValue: { scheduleDrip: jest.fn(), cancelDrip: jest.fn() },
          },
          {
            provide: DunningService,
            useValue: { scheduleDunning: jest.fn(), cancelDunning: jest.fn() },
          },
          {
            provide: ReferralService,
            useValue: { convertReferral: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, string> = {
                  STRIPE_SECRET_KEY: 'sk_test_123',
                  NODE_ENV: 'development',
                };
                return config[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const service2 = module2.get(BillingService);
      const loggerSpy = jest.spyOn((service2 as any).logger, 'warn');

      expect(() => service2.onModuleInit()).not.toThrow();
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining('STRIPE_WEBHOOK_SECRET not configured'),
      );
    });

    it('throws in production when webhook secret is missing and Stripe is enabled', async () => {
      const module2 = await Test.createTestingModule({
        providers: [
          BillingService,
          { provide: PrismaService, useValue: prisma },
          { provide: EmailService, useValue: { sendGeneric: jest.fn().mockResolvedValue(true) } },
          {
            provide: OnboardingDripService,
            useValue: { scheduleDrip: jest.fn(), cancelDrip: jest.fn() },
          },
          {
            provide: DunningService,
            useValue: { scheduleDunning: jest.fn(), cancelDunning: jest.fn() },
          },
          {
            provide: ReferralService,
            useValue: { convertReferral: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, string> = {
                  STRIPE_SECRET_KEY: 'sk_test_123',
                  NODE_ENV: 'production',
                };
                return config[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const service2 = module2.get(BillingService);

      expect(() => service2.onModuleInit()).toThrow(
        'STRIPE_WEBHOOK_SECRET must be configured in production',
      );
    });

    it('skips validation when Stripe is not configured', async () => {
      const module2 = await Test.createTestingModule({
        providers: [
          BillingService,
          { provide: PrismaService, useValue: prisma },
          { provide: EmailService, useValue: { sendGeneric: jest.fn().mockResolvedValue(true) } },
          {
            provide: OnboardingDripService,
            useValue: { scheduleDrip: jest.fn(), cancelDrip: jest.fn() },
          },
          {
            provide: DunningService,
            useValue: { scheduleDunning: jest.fn(), cancelDunning: jest.fn() },
          },
          {
            provide: ReferralService,
            useValue: { convertReferral: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, string> = {
                  NODE_ENV: 'production',
                };
                return config[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const service2 = module2.get(BillingService);

      // Should not throw even in production — Stripe is not enabled
      expect(() => service2.onModuleInit()).not.toThrow();
    });
  });

  describe('switchToAnnual', () => {
    it('calls Stripe subscription update with annual price', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        stripeSubscriptionId: 'sub_test123',
        plan: 'professional',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.switchToAnnual('biz1');

      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        items: [{ id: 'si_item1', price: 'price_pro_a' }],
        proration_behavior: 'create_prorations',
      });
      expect(result.savings).toBeDefined();
      expect(result.savings.savingsPercent).toBeGreaterThan(0);
    });

    it('throws when no subscription found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.switchToAnnual('biz1')).rejects.toThrow('No active subscription found');
    });
  });

  describe('switchToMonthly', () => {
    it('calls Stripe subscription update with monthly price', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        stripeSubscriptionId: 'sub_test123',
        plan: 'professional',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);

      await service.switchToMonthly('biz1');

      expect(mockStripeInstance.subscriptions.update).toHaveBeenCalledWith('sub_test123', {
        items: [{ id: 'si_item1', price: 'price_pro_m' }],
        proration_behavior: 'create_prorations',
      });
    });

    it('throws when no subscription found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(service.switchToMonthly('biz1')).rejects.toThrow('No active subscription found');
    });
  });

  describe('calculateAnnualSavings', () => {
    it('returns correct savings for starter plan', () => {
      const result = service.calculateAnnualSavings('starter');
      expect(result.monthlyTotal).toBe(588); // 49 * 12
      expect(result.annualPrice).toBe(468); // 39 * 12
      expect(result.savingsAmount).toBe(120);
      expect(result.savingsPercent).toBe(20);
    });

    it('returns correct savings for professional plan', () => {
      const result = service.calculateAnnualSavings('professional');
      expect(result.monthlyTotal).toBe(1188); // 99 * 12
      expect(result.annualPrice).toBe(948); // 79 * 12
      expect(result.savingsAmount).toBe(240);
      expect(result.savingsPercent).toBe(20);
    });

    it('returns correct savings for enterprise plan', () => {
      const result = service.calculateAnnualSavings('enterprise');
      expect(result.monthlyTotal).toBe(2388); // 199 * 12
      expect(result.annualPrice).toBe(1908); // 159 * 12
      expect(result.savingsAmount).toBe(480);
      expect(result.savingsPercent).toBe(20);
    });
  });

  describe('getCurrentBillingInterval', () => {
    it('returns monthly for monthly interval', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_test123',
      } as any);

      const result = await service.getCurrentBillingInterval('biz1');
      expect(result).toBe('monthly');
    });

    it('returns annual for yearly interval', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        stripeSubscriptionId: 'sub_test123',
      } as any);
      mockStripeInstance.subscriptions.retrieve.mockResolvedValueOnce({
        id: 'sub_test123',
        items: { data: [{ id: 'si_item1', price: { recurring: { interval: 'year' } } }] },
      });

      const result = await service.getCurrentBillingInterval('biz1');
      expect(result).toBe('annual');
    });

    it('returns monthly when no subscription', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.getCurrentBillingInterval('biz1');
      expect(result).toBe('monthly');
    });
  });

  describe('createCheckoutSession edge cases', () => {
    it('should throw when price ID not configured', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Test Business',
      } as any);
      prisma.subscription.findUnique.mockResolvedValue(null);

      // Override config to return no price
      const module2 = await Test.createTestingModule({
        providers: [
          BillingService,
          { provide: PrismaService, useValue: prisma },
          { provide: EmailService, useValue: { sendGeneric: jest.fn().mockResolvedValue(true) } },
          {
            provide: OnboardingDripService,
            useValue: { scheduleDrip: jest.fn(), cancelDrip: jest.fn() },
          },
          {
            provide: DunningService,
            useValue: { scheduleDunning: jest.fn(), cancelDunning: jest.fn() },
          },
          {
            provide: ReferralService,
            useValue: { convertReferral: jest.fn().mockResolvedValue(undefined) },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn((key: string, defaultValue?: any) => {
                const config: Record<string, string> = {
                  STRIPE_SECRET_KEY: 'sk_test_123',
                };
                return config[key] ?? defaultValue;
              }),
            },
          },
        ],
      }).compile();

      const service2 = module2.get(BillingService);
      await expect(service2.createCheckoutSession('biz1', 'starter')).rejects.toThrow(
        'No price configured',
      );
    });
  });
});
