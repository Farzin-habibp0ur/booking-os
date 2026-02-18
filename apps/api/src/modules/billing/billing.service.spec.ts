import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from '../../common/prisma.service';
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
          metadata: { businessId: 'biz1', plan: 'basic' },
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

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, string> = {
                STRIPE_SECRET_KEY: 'sk_test_123',
                STRIPE_WEBHOOK_SECRET: 'whsec_test',
                STRIPE_PRICE_ID_BASIC: 'price_basic',
                STRIPE_PRICE_ID_PRO: 'price_pro',
                API_URL: 'http://localhost:3001',
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
    it('should create a checkout session for basic plan', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        name: 'Test Business',
      } as any);
      prisma.subscription.findUnique.mockResolvedValue(null);

      const result = await service.createCheckoutSession('biz1', 'basic');
      expect(result.url).toBe('https://checkout.stripe.com/test');
    });

    it('should throw for missing business', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(service.createCheckoutSession('missing', 'basic')).rejects.toThrow(
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

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          create: expect.objectContaining({
            businessId: 'biz1',
            plan: 'basic',
            stripeCustomerId: 'cus_test123',
            stripeSubscriptionId: 'sub_test123',
            status: 'active',
          }),
        }),
      );
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

    it('should process invoice.paid event', async () => {
      mockStripeInstance.webhooks.constructEvent.mockReturnValue({
        type: 'invoice.paid',
        data: {
          object: { subscription: 'sub_test123' },
        },
      });
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub1',
        stripeSubscriptionId: 'sub_test123',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { status: 'active' },
      });
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

    it('should process invoice.payment_failed event', async () => {
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

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { status: 'past_due' },
      });
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

      const result = await service.handleWebhookEvent(mockRawBody, mockSignature);
      expect(result).toEqual({ received: true });
      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { status: 'canceled' },
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

      await service.createCheckoutSession('biz1', 'pro');

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
      await expect(service2.createCheckoutSession('biz1', 'basic')).rejects.toThrow(
        'No price configured',
      );
    });
  });
});
