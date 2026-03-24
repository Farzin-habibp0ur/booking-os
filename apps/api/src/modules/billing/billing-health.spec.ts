import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingService } from './billing.service';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { OnboardingDripService } from '../onboarding-drip/onboarding-drip.service';
import { DunningService } from '../dunning/dunning.service';
import { ReferralService } from '../referral/referral.service';
import { createMockPrisma } from '../../test/mocks';

const mockStripeInstance = {
  customers: { create: jest.fn() },
  checkout: { sessions: { create: jest.fn() } },
  billingPortal: { sessions: { create: jest.fn() } },
  subscriptions: { retrieve: jest.fn(), update: jest.fn() },
  paymentIntents: { create: jest.fn() },
  webhooks: { constructEvent: jest.fn() },
  balance: { retrieve: jest.fn() },
};

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => mockStripeInstance);
});

describe('BillingService — checkBillingHealth', () => {
  let service: BillingService;
  let configValues: Record<string, string | undefined>;

  async function createService(overrides: Record<string, string> = {}) {
    configValues = { STRIPE_SECRET_KEY: 'sk_test_123', ...overrides };
    const prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: EmailService,
          useValue: { sendGeneric: jest.fn() },
        },
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
          useValue: { convertReferral: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              return configValues[key] ?? defaultValue ?? undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockStripeInstance.balance.retrieve.mockResolvedValue({ available: [] });
  });

  it('should return "ready" when Stripe key is valid and all prices configured', async () => {
    await createService({
      STRIPE_PRICE_ID_STARTER_MONTHLY: 'price_sm',
      STRIPE_PRICE_ID_STARTER_ANNUAL: 'price_sa',
      STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY: 'price_pm',
      STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL: 'price_pa',
      STRIPE_PRICE_ID_ENTERPRISE_MONTHLY: 'price_em',
      STRIPE_PRICE_ID_ENTERPRISE_ANNUAL: 'price_ea',
    });

    const result = await service.checkBillingHealth();

    expect(result.status).toBe('ready');
    expect(result.stripeKeyValid).toBe(true);
    expect(result.stripeError).toBeNull();
    expect(result.configuredPrices).toHaveLength(6);
    expect(result.missingPrices).toHaveLength(0);
  });

  it('should return "partial" when Stripe key is valid but some prices missing', async () => {
    await createService({
      STRIPE_PRICE_ID_STARTER_MONTHLY: 'price_sm',
      STRIPE_PRICE_ID_STARTER_ANNUAL: 'price_sa',
    });

    const result = await service.checkBillingHealth();

    expect(result.status).toBe('partial');
    expect(result.stripeKeyValid).toBe(true);
    expect(result.configuredPrices).toEqual([
      'STRIPE_PRICE_ID_STARTER_MONTHLY',
      'STRIPE_PRICE_ID_STARTER_ANNUAL',
    ]);
    expect(result.missingPrices).toHaveLength(4);
  });

  it('should return "not_configured" when STRIPE_SECRET_KEY is missing', async () => {
    configValues = {};
    const prisma = createMockPrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: { sendGeneric: jest.fn() } },
        {
          provide: OnboardingDripService,
          useValue: { scheduleDrip: jest.fn(), cancelDrip: jest.fn() },
        },
        {
          provide: DunningService,
          useValue: { scheduleDunning: jest.fn(), cancelDunning: jest.fn() },
        },
        { provide: ReferralService, useValue: { convertReferral: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              return configValues[key] ?? defaultValue ?? undefined;
            }),
          },
        },
      ],
    }).compile();

    const svc = module.get<BillingService>(BillingService);
    const result = await svc.checkBillingHealth();

    expect(result.status).toBe('not_configured');
    expect(result.stripeKeyValid).toBe(false);
    expect(result.stripeError).toBe('STRIPE_SECRET_KEY not configured');
    expect(result.missingPrices).toHaveLength(6);
  });

  it('should return "not_configured" when Stripe balance.retrieve fails', async () => {
    mockStripeInstance.balance.retrieve.mockRejectedValue(
      new Error('Invalid API Key provided'),
    );

    await createService();

    const result = await service.checkBillingHealth();

    expect(result.status).toBe('not_configured');
    expect(result.stripeKeyValid).toBe(false);
    expect(result.stripeError).toBe('Invalid API Key provided');
  });

  it('should list all 6 price env var keys across configured and missing', async () => {
    await createService();

    const result = await service.checkBillingHealth();
    const allKeys = [...result.configuredPrices, ...result.missingPrices];

    expect(allKeys).toContain('STRIPE_PRICE_ID_STARTER_MONTHLY');
    expect(allKeys).toContain('STRIPE_PRICE_ID_STARTER_ANNUAL');
    expect(allKeys).toContain('STRIPE_PRICE_ID_PROFESSIONAL_MONTHLY');
    expect(allKeys).toContain('STRIPE_PRICE_ID_PROFESSIONAL_ANNUAL');
    expect(allKeys).toContain('STRIPE_PRICE_ID_ENTERPRISE_MONTHLY');
    expect(allKeys).toContain('STRIPE_PRICE_ID_ENTERPRISE_ANNUAL');
    expect(allKeys).toHaveLength(6);
  });
});
