import { Test } from '@nestjs/testing';
import { PolicyComplianceService } from './policy-compliance.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('PolicyComplianceService', () => {
  let service: PolicyComplianceService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [PolicyComplianceService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PolicyComplianceService);
  });

  describe('checkDepositPolicy', () => {
    it('returns allowed when service requires deposit', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        depositRequired: true,
        depositAmount: 50,
      } as any);

      const result = await service.checkDepositPolicy('biz1', 'svc1');

      expect(result.allowed).toBe(true);
      expect(result.reason).toContain('$50.00');
    });

    it('returns not allowed when service not found', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      const result = await service.checkDepositPolicy('biz1', 'svc1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Service not found');
    });

    it('returns not allowed when deposit not required', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        depositRequired: false,
      } as any);

      const result = await service.checkDepositPolicy('biz1', 'svc1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Service does not require deposit');
    });

    it('returns not allowed when no deposit amount set', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        depositRequired: true,
        depositAmount: 0,
      } as any);

      const result = await service.checkDepositPolicy('biz1', 'svc1');

      expect(result.allowed).toBe(false);
    });

    it('handles errors gracefully', async () => {
      prisma.service.findFirst.mockRejectedValue(new Error('DB error'));

      const result = await service.checkDepositPolicy('biz1', 'svc1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe('Policy check failed');
    });
  });

  describe('checkCancellationPolicy', () => {
    it('allows cancellation when policy not enabled', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: { policyEnabled: false },
      } as any);

      const result = await service.checkCancellationPolicy('biz1', 'book1');

      expect(result.allowed).toBe(true);
    });

    it('allows cancellation outside window', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: {
          policyEnabled: true,
          cancellationWindowHours: 24,
        },
      } as any);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        startTime: new Date(Date.now() + 48 * 60 * 60 * 1000), // 48h from now
      } as any);

      const result = await service.checkCancellationPolicy('biz1', 'book1');

      expect(result.allowed).toBe(true);
    });

    it('blocks cancellation within window', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: {
          policyEnabled: true,
          cancellationWindowHours: 24,
          cancellationPolicyText: 'No refunds within 24h',
        },
      } as any);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        startTime: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12h from now
      } as any);

      const result = await service.checkCancellationPolicy('biz1', 'book1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('24 hours');
      expect(result.policyText).toBe('No refunds within 24h');
    });

    it('returns not allowed when booking not found', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: { policyEnabled: true, cancellationWindowHours: 24 },
      } as any);
      prisma.booking.findFirst.mockResolvedValue(null);

      const result = await service.checkCancellationPolicy('biz1', 'book1');

      expect(result.allowed).toBe(false);
    });
  });

  describe('checkReschedulePolicy', () => {
    it('allows reschedule when policy not enabled', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: { policyEnabled: false },
      } as any);

      const result = await service.checkReschedulePolicy('biz1', 'book1');

      expect(result.allowed).toBe(true);
    });

    it('blocks reschedule within window', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: {
          policyEnabled: true,
          rescheduleWindowHours: 48,
        },
      } as any);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        startTime: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h from now
      } as any);

      const result = await service.checkReschedulePolicy('biz1', 'book1');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('48 hours');
    });

    it('allows reschedule outside window', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        policySettings: {
          policyEnabled: true,
          rescheduleWindowHours: 24,
        },
      } as any);
      prisma.booking.findFirst.mockResolvedValue({
        id: 'book1',
        startTime: new Date(Date.now() + 72 * 60 * 60 * 1000),
      } as any);

      const result = await service.checkReschedulePolicy('biz1', 'book1');

      expect(result.allowed).toBe(true);
    });
  });

  describe('checkQuietHours', () => {
    it('returns false when no quiet hours configured', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        notificationSettings: {},
      } as any);

      const result = await service.checkQuietHours('biz1');

      expect(result).toBe(false);
    });

    it('returns false when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      const result = await service.checkQuietHours('biz1');

      expect(result).toBe(false);
    });

    it('handles errors gracefully', async () => {
      prisma.business.findUnique.mockRejectedValue(new Error('DB error'));

      const result = await service.checkQuietHours('biz1');

      expect(result).toBe(false);
    });
  });
});
