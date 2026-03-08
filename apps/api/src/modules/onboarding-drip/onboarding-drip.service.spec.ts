import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OnboardingDripService, DRIP_EMAILS, DripJobData } from './onboarding-drip.service';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { createMockPrisma } from '../../test/mocks';

describe('OnboardingDripService', () => {
  let service: OnboardingDripService;
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
        OnboardingDripService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def?: any) => def) },
        },
        { provide: 'QUEUE_AVAILABLE', useValue: true },
        { provide: 'BullQueue_onboarding-drip', useValue: mockQueue },
      ],
    }).compile();

    service = module.get(OnboardingDripService);
    // Inject the mock queue
    (service as any).dripQueue = mockQueue;
  });

  describe('DRIP_EMAILS', () => {
    test('has 13 emails', () => {
      expect(DRIP_EMAILS).toHaveLength(13);
    });

    test('steps are numbered 1-13', () => {
      const steps = DRIP_EMAILS.map((d) => d.step);
      expect(steps).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]);
    });

    test('delays increase monotonically', () => {
      for (let i = 1; i < DRIP_EMAILS.length; i++) {
        expect(DRIP_EMAILS[i]!.delayHours).toBeGreaterThan(DRIP_EMAILS[i - 1]!.delayHours);
      }
    });

    test('all emails have subjects and headlines', () => {
      for (const email of DRIP_EMAILS) {
        expect(email.subject).toBeTruthy();
        expect(email.headline).toBeTruthy();
        expect(email.body).toBeTruthy();
      }
    });

    test('last two emails focus on trial expiry', () => {
      expect(DRIP_EMAILS[10]!.subject).toContain('trial ends');
      expect(DRIP_EMAILS[11]!.subject).toContain('Last day');
      expect(DRIP_EMAILS[12]!.subject).toContain('trial has ended');
    });
  });

  describe('scheduleDrip', () => {
    test('schedules 13 delayed jobs when queue available', async () => {
      await service.scheduleDrip('biz1', 'user@test.com', 'Sarah');

      expect(mockQueue.add).toHaveBeenCalledTimes(13);

      // Verify first job
      expect(mockQueue.add).toHaveBeenCalledWith(
        'drip-step-1',
        { businessId: 'biz1', email: 'user@test.com', name: 'Sarah', step: 1 },
        expect.objectContaining({
          delay: 1 * 60 * 60 * 1000, // 1 hour
          jobId: 'drip-biz1-step-1',
          removeOnComplete: true,
        }),
      );

      // Verify last job
      expect(mockQueue.add).toHaveBeenCalledWith(
        'drip-step-13',
        { businessId: 'biz1', email: 'user@test.com', name: 'Sarah', step: 13 },
        expect.objectContaining({
          delay: 360 * 60 * 60 * 1000, // 360 hours
          jobId: 'drip-biz1-step-13',
        }),
      );
    });
  });

  describe('sendDripEmail', () => {
    const jobData: DripJobData = {
      businessId: 'biz1',
      email: 'user@test.com',
      name: 'Sarah',
      step: 1,
    };

    test('sends email for valid business', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        subscription: null,
      } as any);

      await service.sendDripEmail(jobData);

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'user@test.com',
        expect.objectContaining({
          subject: DRIP_EMAILS[0]!.subject,
          headline: DRIP_EMAILS[0]!.headline,
        }),
      );
    });

    test('skips if business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await service.sendDripEmail(jobData);

      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });

    test('skips if business already subscribed', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        subscription: { status: 'active' },
      } as any);

      await service.sendDripEmail(jobData);

      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });

    test('sends email for trialing business (not yet active)', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        subscription: { status: 'trialing' },
      } as any);

      await service.sendDripEmail(jobData);

      expect(emailService.sendGeneric).toHaveBeenCalled();
    });

    test('includes CTA URL with web URL prefix', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        subscription: null,
      } as any);

      await service.sendDripEmail(jobData);

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'user@test.com',
        expect.objectContaining({
          ctaUrl: expect.stringContaining('/services'),
        }),
      );
    });

    test('handles email send failure gracefully', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        subscription: null,
      } as any);
      emailService.sendGeneric.mockRejectedValue(new Error('Email failed'));

      // Should not throw
      await service.sendDripEmail(jobData);
    });
  });

  describe('cancelDrip', () => {
    test('removes delayed jobs from queue', async () => {
      const mockJob = {
        isDelayed: jest.fn().mockResolvedValue(true),
        remove: jest.fn().mockResolvedValue(undefined),
      };
      mockQueue.getJob.mockResolvedValue(mockJob);

      await service.cancelDrip('biz1');

      expect(mockQueue.getJob).toHaveBeenCalledTimes(13);
      expect(mockQueue.getJob).toHaveBeenCalledWith('drip-biz1-step-1');
      expect(mockJob.remove).toHaveBeenCalledTimes(13);
    });

    test('skips already processed jobs', async () => {
      mockQueue.getJob.mockResolvedValue(null);

      await service.cancelDrip('biz1');

      // Should not throw
      expect(mockQueue.getJob).toHaveBeenCalledTimes(13);
    });
  });

  describe('scheduleDrip without queue', () => {
    test('logs fallback message when no queue', async () => {
      (service as any).queueAvailable = false;
      (service as any).dripQueue = undefined;
      const logSpy = jest.spyOn((service as any).logger, 'log');

      await service.scheduleDrip('biz1', 'user@test.com', 'Sarah');

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('cron fallback'));
    });
  });
});
