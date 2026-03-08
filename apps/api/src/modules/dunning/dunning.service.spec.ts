import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  DunningService,
  DUNNING_EMAILS,
  DUNNING_DOWNGRADE_DELAY_MS,
  DunningJobData,
  DunningDowngradeJobData,
} from './dunning.service';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { createMockPrisma } from '../../test/mocks';

describe('DunningService', () => {
  let service: DunningService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let emailService: { sendGeneric: jest.Mock };
  let mockQueue: { add: jest.Mock; getJob: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    emailService = { sendGeneric: jest.fn().mockResolvedValue(true) };
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      getJob: jest.fn().mockResolvedValue(null),
    };

    const module = await Test.createTestingModule({
      providers: [
        DunningService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def?: any) => {
              if (key === 'WEB_URL') return 'http://localhost:3000';
              return def;
            }),
          },
        },
        { provide: 'QUEUE_AVAILABLE', useValue: true },
        { provide: 'BullQueue_dunning', useValue: mockQueue },
      ],
    }).compile();

    service = module.get(DunningService);
    // Inject the mock queue
    (service as any).dunningQueue = mockQueue;
  });

  describe('DUNNING_EMAILS', () => {
    test('has 3 emails', () => {
      expect(DUNNING_EMAILS).toHaveLength(3);
    });

    test('steps are numbered 1-3', () => {
      const steps = DUNNING_EMAILS.map((d) => d.step);
      expect(steps).toEqual([1, 2, 3]);
    });

    test('delays are 0, 3 days, 7 days', () => {
      expect(DUNNING_EMAILS[0]!.delayMs).toBe(0);
      expect(DUNNING_EMAILS[1]!.delayMs).toBe(3 * 24 * 60 * 60 * 1000);
      expect(DUNNING_EMAILS[2]!.delayMs).toBe(7 * 24 * 60 * 60 * 1000);
    });

    test('all emails have subjects and headlines', () => {
      for (const email of DUNNING_EMAILS) {
        expect(email.subject).toBeTruthy();
        expect(email.headline).toBeTruthy();
        expect(email.body).toBeTruthy();
        expect(email.ctaLabel).toBeTruthy();
        expect(email.ctaPath).toBeTruthy();
      }
    });
  });

  describe('DUNNING_DOWNGRADE_DELAY_MS', () => {
    test('is 14 days', () => {
      expect(DUNNING_DOWNGRADE_DELAY_MS).toBe(14 * 24 * 60 * 60 * 1000);
    });
  });

  describe('scheduleDunning', () => {
    test('schedules 3 dunning emails + 1 downgrade job', async () => {
      await service.scheduleDunning('biz1', 'admin@test.com', 'Admin');

      // 3 emails + 1 downgrade = 4 calls
      expect(mockQueue.add).toHaveBeenCalledTimes(4);
    });

    test('schedules email step 1 with no delay', async () => {
      await service.scheduleDunning('biz1', 'admin@test.com', 'Admin');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'dunning-step-1',
        { businessId: 'biz1', email: 'admin@test.com', name: 'Admin', step: 1 },
        expect.objectContaining({
          delay: 0,
          jobId: 'dunning-biz1-step-1',
          removeOnComplete: true,
        }),
      );
    });

    test('schedules email step 2 with 3-day delay', async () => {
      await service.scheduleDunning('biz1', 'admin@test.com', 'Admin');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'dunning-step-2',
        { businessId: 'biz1', email: 'admin@test.com', name: 'Admin', step: 2 },
        expect.objectContaining({
          delay: 3 * 24 * 60 * 60 * 1000,
          jobId: 'dunning-biz1-step-2',
        }),
      );
    });

    test('schedules email step 3 with 7-day delay', async () => {
      await service.scheduleDunning('biz1', 'admin@test.com', 'Admin');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'dunning-step-3',
        { businessId: 'biz1', email: 'admin@test.com', name: 'Admin', step: 3 },
        expect.objectContaining({
          delay: 7 * 24 * 60 * 60 * 1000,
          jobId: 'dunning-biz1-step-3',
        }),
      );
    });

    test('schedules auto-downgrade with 14-day delay', async () => {
      await service.scheduleDunning('biz1', 'admin@test.com', 'Admin');

      expect(mockQueue.add).toHaveBeenCalledWith(
        'dunning-downgrade',
        { businessId: 'biz1' },
        expect.objectContaining({
          delay: 14 * 24 * 60 * 60 * 1000,
          jobId: 'dunning-biz1-downgrade',
        }),
      );
    });

    test('does not schedule when queue unavailable', async () => {
      (service as any).queueAvailable = false;
      (service as any).dunningQueue = undefined;

      await service.scheduleDunning('biz1', 'admin@test.com', 'Admin');

      expect(mockQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('sendDunningEmail', () => {
    const jobData: DunningJobData = {
      businessId: 'biz1',
      email: 'admin@test.com',
      name: 'Admin',
      step: 1,
    };

    test('sends email when subscription is past_due', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'past_due',
      } as any);

      await service.sendDunningEmail(jobData);

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'admin@test.com',
        expect.objectContaining({
          subject: DUNNING_EMAILS[0]!.subject,
          headline: DUNNING_EMAILS[0]!.headline,
          ctaUrl: 'http://localhost:3000/settings/billing',
        }),
      );
    });

    test('skips when no subscription found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await service.sendDunningEmail(jobData);

      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });

    test('skips when subscription is active (payment recovered)', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'active',
      } as any);

      await service.sendDunningEmail(jobData);

      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });

    test('handles email send failure gracefully', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'past_due',
      } as any);
      emailService.sendGeneric.mockRejectedValue(new Error('Email failed'));

      // Should not throw
      await service.sendDunningEmail(jobData);
    });

    test('sends correct email for step 2', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'past_due',
      } as any);

      await service.sendDunningEmail({ ...jobData, step: 2 });

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'admin@test.com',
        expect.objectContaining({
          subject: DUNNING_EMAILS[1]!.subject,
          headline: DUNNING_EMAILS[1]!.headline,
        }),
      );
    });

    test('sends correct email for step 3', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'past_due',
      } as any);

      await service.sendDunningEmail({ ...jobData, step: 3 });

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'admin@test.com',
        expect.objectContaining({
          subject: DUNNING_EMAILS[2]!.subject,
          headline: DUNNING_EMAILS[2]!.headline,
        }),
      );
    });
  });

  describe('processDowngrade', () => {
    const downgradeData: DunningDowngradeJobData = { businessId: 'biz1' };

    test('downgrades past_due subscription to starter', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'past_due',
        plan: 'professional',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        staff: [{ email: 'admin@test.com', name: 'Admin' }],
      } as any);

      await service.processDowngrade(downgradeData);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub1' },
        data: { plan: 'starter', status: 'active' },
      });
    });

    test('sends downgrade notification email', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'past_due',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        staff: [{ email: 'admin@test.com', name: 'Admin' }],
      } as any);

      await service.processDowngrade(downgradeData);

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'admin@test.com',
        expect.objectContaining({
          subject: 'Your Booking OS account has been downgraded',
          headline: 'Account downgraded to Starter',
        }),
      );
    });

    test('skips when no subscription found', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await service.processDowngrade(downgradeData);

      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    test('skips when subscription is not past_due', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'active',
      } as any);

      await service.processDowngrade(downgradeData);

      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });

    test('handles notification email failure gracefully', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'past_due',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        staff: [{ email: 'admin@test.com', name: 'Admin' }],
      } as any);
      emailService.sendGeneric.mockRejectedValue(new Error('Email failed'));

      // Should not throw — downgrade still succeeds
      await service.processDowngrade(downgradeData);

      // The downgrade itself should still have happened
      expect(prisma.subscription.update).toHaveBeenCalled();
    });

    test('skips downgrade when no admin staff found', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        id: 'sub1',
        businessId: 'biz1',
        status: 'past_due',
      } as any);
      prisma.subscription.update.mockResolvedValue({} as any);
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        staff: [],
      } as any);

      // Should not throw
      await service.processDowngrade(downgradeData);

      // Downgrade still happens, just no notification
      expect(prisma.subscription.update).toHaveBeenCalled();
      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });
  });

  describe('cancelDunning', () => {
    test('removes all delayed dunning jobs from queue', async () => {
      const mockJob = {
        isDelayed: jest.fn().mockResolvedValue(true),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      await service.cancelDunning('biz1');

      // 3 email steps + 1 downgrade = 4 getJob calls
      expect(mockQueue.getJob).toHaveBeenCalledTimes(4);
      expect(mockQueue.getJob).toHaveBeenCalledWith('dunning-biz1-step-1');
      expect(mockQueue.getJob).toHaveBeenCalledWith('dunning-biz1-step-2');
      expect(mockQueue.getJob).toHaveBeenCalledWith('dunning-biz1-step-3');
      expect(mockQueue.getJob).toHaveBeenCalledWith('dunning-biz1-downgrade');
      expect(mockJob.remove).toHaveBeenCalledTimes(4);
    });

    test('skips already processed jobs', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await service.cancelDunning('biz1');

      // Should not throw
      expect(mockQueue.getJob).toHaveBeenCalledTimes(4);
    });

    test('skips when queue unavailable', async () => {
      (service as any).queueAvailable = false;
      (service as any).dunningQueue = undefined;

      await service.cancelDunning('biz1');

      expect(mockQueue.getJob).not.toHaveBeenCalled();
    });

    test('handles job removal errors gracefully', async () => {
      const mockJob = {
        isDelayed: jest.fn().mockRejectedValue(new Error('Redis error')),
        remove: jest.fn(),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      // Should not throw
      await service.cancelDunning('biz1');
    });
  });
});
