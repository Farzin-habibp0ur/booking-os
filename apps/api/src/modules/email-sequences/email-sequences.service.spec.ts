import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailSequenceService, DEFAULT_SEQUENCES } from './email-sequences.service';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { createMockPrisma } from '../../test/mocks';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('EmailSequenceService', () => {
  let service: EmailSequenceService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let emailService: { sendGeneric: jest.Mock };
  let mockQueue: { add: jest.Mock; getJob: jest.Mock };

  const mockSequence = {
    id: 'seq1',
    businessId: null,
    name: 'Welcome Series',
    type: 'WELCOME',
    isActive: true,
    steps: [
      {
        step: 1,
        delayHours: 0,
        subject: 'Welcome!',
        headline: 'Welcome',
        body: 'Hello {{name}}',
        ctaLabel: 'Start',
        ctaPath: '/start',
      },
      {
        step: 2,
        delayHours: 24,
        subject: 'Day 2',
        headline: 'Day 2',
        body: 'Next step',
        ctaLabel: 'Go',
        ctaPath: '/go',
      },
    ],
    triggerEvent: 'SIGNUP',
    stopOnEvent: 'SUBSCRIPTION_ACTIVE',
    metadata: {},
    _count: { enrollments: 5 },
  };

  const mockEnrollment = {
    id: 'enr1',
    sequenceId: 'seq1',
    businessId: 'biz1',
    email: 'user@test.com',
    name: 'Sarah',
    currentStep: 0,
    status: 'ACTIVE',
    enrolledAt: new Date(),
    metadata: {},
    sequence: mockSequence,
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    emailService = { sendGeneric: jest.fn().mockResolvedValue(true) };
    mockQueue = {
      add: jest.fn().mockResolvedValue({}),
      getJob: jest.fn().mockResolvedValue(null),
    };

    const module = await Test.createTestingModule({
      providers: [
        EmailSequenceService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: emailService },
        { provide: ConfigService, useValue: { get: jest.fn((key: string, def?: any) => def) } },
        { provide: 'QUEUE_AVAILABLE', useValue: true },
        { provide: 'BullQueue_onboarding-drip', useValue: mockQueue },
      ],
    }).compile();

    service = module.get(EmailSequenceService);
    (service as any).dripQueue = mockQueue;
  });

  describe('DEFAULT_SEQUENCES', () => {
    it('has 7 default sequences', () => {
      expect(DEFAULT_SEQUENCES).toHaveLength(7);
    });

    it('covers all expected types', () => {
      const types = DEFAULT_SEQUENCES.map((s) => s.type);
      expect(types).toContain('WELCOME');
      expect(types).toContain('FEATURE_EDUCATION');
      expect(types).toContain('SOCIAL_PROOF');
      expect(types).toContain('TRIAL_EXPIRY');
      expect(types).toContain('WIN_BACK');
      expect(types).toContain('UPGRADE');
      expect(types).toContain('REFERRAL');
    });

    it('all sequences have steps with required fields', () => {
      for (const seq of DEFAULT_SEQUENCES) {
        expect(seq.steps.length).toBeGreaterThan(0);
        for (const step of seq.steps) {
          expect(step.subject).toBeTruthy();
          expect(step.headline).toBeTruthy();
          expect(step.body).toBeTruthy();
          expect(typeof step.step).toBe('number');
          expect(typeof step.delayHours).toBe('number');
        }
      }
    });
  });

  describe('createSequence', () => {
    it('creates a sequence', async () => {
      prisma.emailSequence.create.mockResolvedValue(mockSequence as any);

      const result = await service.createSequence('biz1', {
        name: 'Custom',
        type: 'CUSTOM',
        steps: [],
      });

      expect(prisma.emailSequence.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ businessId: 'biz1', name: 'Custom', type: 'CUSTOM' }),
      });
      expect(result).toEqual(mockSequence);
    });
  });

  describe('findAll', () => {
    it('returns sequences for business and platform-level', async () => {
      prisma.emailSequence.findMany.mockResolvedValue([mockSequence] as any);

      const result = await service.findAll('biz1');

      expect(prisma.emailSequence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [{ businessId: 'biz1' }, { businessId: null }],
          }),
        }),
      );
      expect(result).toHaveLength(1);
    });

    it('filters by type', async () => {
      prisma.emailSequence.findMany.mockResolvedValue([]);

      await service.findAll('biz1', { type: 'WELCOME' });

      expect(prisma.emailSequence.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'WELCOME' }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns a sequence', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue(mockSequence as any);

      const result = await service.findOne('biz1', 'seq1');

      expect(result).toEqual(mockSequence);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSequence', () => {
    it('updates a sequence', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue(mockSequence as any);
      prisma.emailSequence.update.mockResolvedValue({ ...mockSequence, name: 'Updated' } as any);

      const result = await service.updateSequence('biz1', 'seq1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });
  });

  describe('deleteSequence', () => {
    it('soft-deletes by setting isActive to false', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue(mockSequence as any);
      prisma.emailSequence.update.mockResolvedValue({ ...mockSequence, isActive: false } as any);

      await service.deleteSequence('biz1', 'seq1');

      expect(prisma.emailSequence.update).toHaveBeenCalledWith({
        where: { id: 'seq1' },
        data: { isActive: false },
      });
    });
  });

  describe('getStats', () => {
    it('returns stats', async () => {
      prisma.emailSequence.groupBy.mockResolvedValue([{ type: 'WELCOME', _count: 1 }] as any);
      prisma.emailSequenceEnrollment.groupBy.mockResolvedValue([
        { status: 'ACTIVE', _count: 3 },
      ] as any);
      prisma.emailSequenceEnrollment.count.mockResolvedValue(5);

      const result = await service.getStats('biz1');

      expect(result.totalEnrolled).toBe(5);
      expect((result.byType as Record<string, number>)['WELCOME']).toBe(1);
      expect((result.byStatus as Record<string, number>)['ACTIVE']).toBe(3);
    });
  });

  describe('enroll', () => {
    it('creates enrollment and schedules queue jobs', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue(mockSequence as any);
      prisma.emailSequenceEnrollment.create.mockResolvedValue(mockEnrollment as any);

      const result = await service.enroll('biz1', 'seq1', {
        email: 'user@test.com',
        name: 'Sarah',
      });

      expect(prisma.emailSequenceEnrollment.create).toHaveBeenCalled();
      expect(mockQueue.add).toHaveBeenCalledTimes(2); // 2 steps
      expect(mockQueue.add).toHaveBeenCalledWith(
        'seq-step-1',
        expect.objectContaining({ enrollmentId: 'enr1', step: 1 }),
        expect.objectContaining({ delay: 0, jobId: 'seq-enr1-step-1' }),
      );
      expect(result).toEqual(mockEnrollment);
    });

    it('throws when enrolling in inactive sequence', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue({ ...mockSequence, isActive: false } as any);

      await expect(
        service.enroll('biz1', 'seq1', { email: 'user@test.com', name: 'Sarah' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('cancelEnrollment', () => {
    it('cancels an active enrollment', async () => {
      prisma.emailSequenceEnrollment.findFirst.mockResolvedValue(mockEnrollment as any);
      prisma.emailSequence.findUnique.mockResolvedValue(mockSequence as any);
      prisma.emailSequenceEnrollment.update.mockResolvedValue({
        ...mockEnrollment,
        status: 'CANCELLED',
      } as any);

      await service.cancelEnrollment('biz1', 'enr1');

      expect(prisma.emailSequenceEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr1' },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      });
    });

    it('throws when enrollment not found', async () => {
      prisma.emailSequenceEnrollment.findFirst.mockResolvedValue(null);

      await expect(service.cancelEnrollment('biz1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('throws when enrollment already completed', async () => {
      prisma.emailSequenceEnrollment.findFirst.mockResolvedValue({
        ...mockEnrollment,
        status: 'COMPLETED',
      } as any);

      await expect(service.cancelEnrollment('biz1', 'enr1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('pauseEnrollment', () => {
    it('pauses an active enrollment', async () => {
      prisma.emailSequenceEnrollment.findFirst.mockResolvedValue(mockEnrollment as any);
      prisma.emailSequence.findUnique.mockResolvedValue(mockSequence as any);
      prisma.emailSequenceEnrollment.update.mockResolvedValue({
        ...mockEnrollment,
        status: 'PAUSED',
      } as any);

      await service.pauseEnrollment('biz1', 'enr1');

      expect(prisma.emailSequenceEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr1' },
        data: { status: 'PAUSED' },
      });
    });

    it('throws when not active', async () => {
      prisma.emailSequenceEnrollment.findFirst.mockResolvedValue({
        ...mockEnrollment,
        status: 'PAUSED',
      } as any);

      await expect(service.pauseEnrollment('biz1', 'enr1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resumeEnrollment', () => {
    it('resumes a paused enrollment and reschedules remaining steps', async () => {
      prisma.emailSequenceEnrollment.findFirst.mockResolvedValue({
        ...mockEnrollment,
        status: 'PAUSED',
        currentStep: 1,
      } as any);
      prisma.emailSequenceEnrollment.update.mockResolvedValue({
        ...mockEnrollment,
        status: 'ACTIVE',
      } as any);

      await service.resumeEnrollment('biz1', 'enr1');

      // Only step 2 should be rescheduled (step 1 already done)
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'seq-step-2',
        expect.objectContaining({ step: 2 }),
        expect.any(Object),
      );
    });

    it('throws when not paused', async () => {
      prisma.emailSequenceEnrollment.findFirst.mockResolvedValue(mockEnrollment as any);

      await expect(service.resumeEnrollment('biz1', 'enr1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('processStep', () => {
    it('sends email and updates currentStep', async () => {
      prisma.emailSequenceEnrollment.findUnique.mockResolvedValue(mockEnrollment as any);
      prisma.emailSequenceEnrollment.update.mockResolvedValue({} as any);

      await service.processStep('enr1', 1);

      expect(emailService.sendGeneric).toHaveBeenCalledWith(
        'user@test.com',
        expect.objectContaining({
          subject: 'Welcome!',
          headline: 'Welcome',
          body: 'Hello Sarah',
        }),
      );
      expect(prisma.emailSequenceEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr1' },
        data: { currentStep: 1 },
      });
    });

    it('marks COMPLETED on last step', async () => {
      prisma.emailSequenceEnrollment.findUnique.mockResolvedValue(mockEnrollment as any);
      prisma.emailSequenceEnrollment.update.mockResolvedValue({} as any);

      await service.processStep('enr1', 2); // step 2 is last

      expect(prisma.emailSequenceEnrollment.update).toHaveBeenCalledWith({
        where: { id: 'enr1' },
        data: expect.objectContaining({ currentStep: 2, status: 'COMPLETED' }),
      });
    });

    it('skips cancelled enrollments', async () => {
      prisma.emailSequenceEnrollment.findUnique.mockResolvedValue({
        ...mockEnrollment,
        status: 'CANCELLED',
      } as any);

      await service.processStep('enr1', 1);

      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });

    it('skips when enrollment not found', async () => {
      prisma.emailSequenceEnrollment.findUnique.mockResolvedValue(null);

      await service.processStep('missing', 1);

      expect(emailService.sendGeneric).not.toHaveBeenCalled();
    });

    it('handles email send failure gracefully', async () => {
      prisma.emailSequenceEnrollment.findUnique.mockResolvedValue(mockEnrollment as any);
      emailService.sendGeneric.mockRejectedValue(new Error('Email failed'));

      // Should not throw
      await service.processStep('enr1', 1);
    });
  });

  describe('handleTriggerEvent', () => {
    it('auto-enrolls matching sequences', async () => {
      prisma.emailSequence.findMany.mockResolvedValue([mockSequence] as any);
      prisma.emailSequenceEnrollment.findUnique.mockResolvedValue(null);
      prisma.emailSequence.findFirst.mockResolvedValue(mockSequence as any);
      prisma.emailSequenceEnrollment.create.mockResolvedValue(mockEnrollment as any);

      await service.handleTriggerEvent('biz1', 'SIGNUP', {
        email: 'user@test.com',
        name: 'Sarah',
      });

      expect(prisma.emailSequenceEnrollment.create).toHaveBeenCalled();
    });

    it('skips if already enrolled', async () => {
      prisma.emailSequence.findMany.mockResolvedValue([mockSequence] as any);
      prisma.emailSequenceEnrollment.findUnique.mockResolvedValue(mockEnrollment as any);

      await service.handleTriggerEvent('biz1', 'SIGNUP', {
        email: 'user@test.com',
        name: 'Sarah',
      });

      expect(prisma.emailSequenceEnrollment.create).not.toHaveBeenCalled();
    });
  });

  describe('handleStopEvent', () => {
    it('cancels active enrollments for matching sequences', async () => {
      prisma.emailSequence.findMany.mockResolvedValue([mockSequence] as any);
      prisma.emailSequenceEnrollment.findMany.mockResolvedValue([mockEnrollment] as any);
      prisma.emailSequenceEnrollment.findFirst.mockResolvedValue(mockEnrollment as any);
      prisma.emailSequence.findUnique.mockResolvedValue(mockSequence as any);
      prisma.emailSequenceEnrollment.update.mockResolvedValue({
        ...mockEnrollment,
        status: 'CANCELLED',
      } as any);

      await service.handleStopEvent('biz1', 'SUBSCRIPTION_ACTIVE');

      expect(prisma.emailSequenceEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'CANCELLED' }),
        }),
      );
    });
  });

  describe('seedDefaultSequences', () => {
    it('creates sequences that do not exist', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue(null);
      prisma.emailSequence.create.mockResolvedValue(mockSequence as any);

      const created = await service.seedDefaultSequences();

      expect(created).toBe(7);
      expect(prisma.emailSequence.create).toHaveBeenCalledTimes(7);
    });

    it('skips existing sequences', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue(mockSequence as any);

      const created = await service.seedDefaultSequences();

      expect(created).toBe(0);
      expect(prisma.emailSequence.create).not.toHaveBeenCalled();
    });
  });

  describe('getEnrollments', () => {
    it('returns enrollments for a sequence', async () => {
      prisma.emailSequenceEnrollment.findMany.mockResolvedValue([mockEnrollment] as any);

      const result = await service.getEnrollments('biz1', 'seq1');

      expect(result).toHaveLength(1);
      expect(prisma.emailSequenceEnrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', sequenceId: 'seq1' },
        }),
      );
    });

    it('filters by status', async () => {
      prisma.emailSequenceEnrollment.findMany.mockResolvedValue([]);

      await service.getEnrollments('biz1', 'seq1', { status: 'COMPLETED' });

      expect(prisma.emailSequenceEnrollment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', sequenceId: 'seq1', status: 'COMPLETED' },
        }),
      );
    });
  });
});
