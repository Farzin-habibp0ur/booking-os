import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BillingLifecycleService } from './billing-lifecycle.service';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';

describe('BillingLifecycleService', () => {
  let service: BillingLifecycleService;
  let prisma: any;
  let emailService: any;

  beforeEach(async () => {
    prisma = {
      subscription: { findMany: jest.fn().mockResolvedValue([]) },
      business: { findMany: jest.fn().mockResolvedValue([]) },
    };
    emailService = { sendGeneric: jest.fn().mockResolvedValue(true) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingLifecycleService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => defaultValue || ''),
          },
        },
      ],
    }).compile();

    service = module.get(BillingLifecycleService);
  });

  describe('checkAnnualRenewals', () => {
    it('sends renewal reminder email for subscriptions renewing in 30 days', async () => {
      const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub1',
          businessId: 'biz1',
          currentPeriodEnd: thirtyDays,
          business: {
            id: 'biz1',
            name: 'Test Biz',
            staff: [{ email: 'admin@test.com', name: 'Admin' }],
            _count: { bookings: 150, customers: 45 },
          },
        },
      ]);

      await service.checkAnnualRenewals();

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'admin@test.com',
        expect.objectContaining({
          subject: expect.stringContaining('renews on'),
          body: expect.stringContaining('150 bookings'),
        }),
      );
    });

    it('skips businesses without admin email', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub1',
          businessId: 'biz1',
          currentPeriodEnd: new Date(),
          business: { staff: [], _count: { bookings: 0, customers: 0 } },
        },
      ]);

      await service.checkAnnualRenewals();

      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });

    it('handles email send failure gracefully', async () => {
      prisma.subscription.findMany.mockResolvedValue([
        {
          id: 'sub1',
          businessId: 'biz1',
          currentPeriodEnd: new Date(),
          business: {
            staff: [{ email: 'admin@test.com' }],
            _count: { bookings: 0, customers: 0 },
          },
        },
      ]);
      emailService.sendGeneric.mockRejectedValue(new Error('SMTP error'));

      // Should not throw
      await expect(service.checkAnnualRenewals()).resolves.not.toThrow();
    });
  });

  describe('checkAccountAnniversaries', () => {
    it('sends anniversary email for businesses with matching creation date', async () => {
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());

      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          name: 'Test Biz',
          createdAt: oneYearAgo,
          staff: [{ email: 'admin@test.com', name: 'Admin' }],
          _count: { bookings: 200, customers: 60 },
        },
      ]);

      await service.checkAccountAnniversaries();

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'admin@test.com',
        expect.objectContaining({
          subject: expect.stringContaining('Happy 1 year'),
          body: expect.stringContaining('200 bookings'),
        }),
      );
    });

    it('skips businesses created less than 1 year ago', async () => {
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      // Match day to trigger anniversary check but year diff < 1
      const now = new Date();
      const lessThanYear = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          createdAt: lessThanYear,
          staff: [{ email: 'admin@test.com' }],
          _count: { bookings: 0, customers: 0 },
        },
      ]);

      await service.checkAccountAnniversaries();

      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });

    it('handles email failure gracefully', async () => {
      const now = new Date();
      const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());

      prisma.business.findMany.mockResolvedValue([
        {
          id: 'biz1',
          createdAt: twoYearsAgo,
          staff: [{ email: 'admin@test.com' }],
          _count: { bookings: 0, customers: 0 },
        },
      ]);
      emailService.sendGeneric.mockRejectedValue(new Error('fail'));

      await expect(service.checkAccountAnniversaries()).resolves.not.toThrow();
    });
  });
});
