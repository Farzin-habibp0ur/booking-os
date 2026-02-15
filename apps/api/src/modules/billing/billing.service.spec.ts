import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

// Mock stripe
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
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
  }));
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

      await expect(
        service.createCheckoutSession('missing', 'basic'),
      ).rejects.toThrow('Business not found');
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

      await expect(
        service.createPortalSession('biz1'),
      ).rejects.toThrow('No subscription found');
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

      await expect(
        service.createDepositPaymentIntent('biz1', 'booking1'),
      ).rejects.toThrow('Deposit not required');
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
});
