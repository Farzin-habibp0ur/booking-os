import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { TreatmentPlanService } from './treatment-plan.service';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TreatmentPlanService', () => {
  let service: TreatmentPlanService;
  let prisma: any;
  let notificationService: any;

  const businessId = 'biz-1';
  const staffId = 'staff-1';

  const mockBooking = {
    id: 'booking-1',
    businessId,
    customerId: 'cust-1',
    service: { kind: 'CONSULT', name: 'Consultation' },
    customer: { id: 'cust-1', name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
    business: { id: businessId, name: 'Glow Clinic', verticalPack: 'aesthetic', slug: 'glow' },
  };

  const mockPlan = {
    id: 'plan-1',
    businessId,
    customerId: 'cust-1',
    consultBookingId: 'booking-1',
    createdById: staffId,
    status: 'DRAFT',
    diagnosis: 'Fine lines',
    goals: 'Smooth skin',
    contraindications: null,
    totalEstimate: 700,
    currency: 'USD',
    notes: null,
    sessions: [
      {
        id: 'sess-1',
        sequenceOrder: 1,
        status: 'PENDING',
        service: { id: 'svc-1', name: 'Botox' },
      },
    ],
    customer: { id: 'cust-1', name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
    business: { id: businessId, name: 'Glow Clinic', slug: 'glow' },
  };

  beforeEach(async () => {
    prisma = {
      booking: { findFirst: jest.fn() },
      treatmentPlan: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      treatmentSession: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      service: { findFirst: jest.fn(), findMany: jest.fn() },
    };

    notificationService = {
      sendTreatmentPlanProposal: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TreatmentPlanService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: notificationService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('http://localhost:3000') },
        },
      ],
    }).compile();

    service = module.get<TreatmentPlanService>(TreatmentPlanService);
  });

  describe('create', () => {
    it('creates a treatment plan from a consult booking', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking);
      prisma.treatmentPlan.findUnique.mockResolvedValue(null);
      prisma.service.findMany.mockResolvedValue([{ id: 'svc-1' }]);
      prisma.treatmentPlan.create.mockResolvedValue(mockPlan);

      const result = await service.create(businessId, staffId, {
        consultBookingId: 'booking-1',
        diagnosis: 'Fine lines',
        sessions: [{ serviceId: 'svc-1', sequenceOrder: 1 }],
      });

      expect(result).toEqual(mockPlan);
      expect(prisma.treatmentPlan.create).toHaveBeenCalled();
    });

    it('rejects non-consult booking', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        service: { kind: 'TREATMENT' },
      });

      await expect(
        service.create(businessId, staffId, { consultBookingId: 'booking-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-aesthetic business', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        ...mockBooking,
        business: { ...mockBooking.business, verticalPack: 'general' },
      });

      await expect(
        service.create(businessId, staffId, { consultBookingId: 'booking-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects if plan already exists', async () => {
      prisma.booking.findFirst.mockResolvedValue(mockBooking);
      prisma.treatmentPlan.findUnique.mockResolvedValue(mockPlan);

      await expect(
        service.create(businessId, staffId, { consultBookingId: 'booking-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(
        service.create(businessId, staffId, { consultBookingId: 'bogus' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns plans for business', async () => {
      prisma.treatmentPlan.findMany.mockResolvedValue([mockPlan]);

      const result = await service.findAll(businessId);
      expect(result).toHaveLength(1);
      expect(prisma.treatmentPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId } }),
      );
    });

    it('filters by customerId', async () => {
      prisma.treatmentPlan.findMany.mockResolvedValue([mockPlan]);

      await service.findAll(businessId, 'cust-1');
      expect(prisma.treatmentPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId, customerId: 'cust-1' } }),
      );
    });
  });

  describe('findOne', () => {
    it('returns plan by id', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(mockPlan);

      const result = await service.findOne(businessId, 'plan-1');
      expect(result).toEqual(mockPlan);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(null);

      await expect(service.findOne(businessId, 'bogus')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates plan fields', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(mockPlan);
      prisma.treatmentPlan.update.mockResolvedValue({ ...mockPlan, diagnosis: 'Updated' });

      const result = await service.update(businessId, 'plan-1', { diagnosis: 'Updated' });
      expect(result.diagnosis).toBe('Updated');
    });

    it('validates status transitions', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(mockPlan);

      await expect(service.update(businessId, 'plan-1', { status: 'COMPLETED' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('allows valid status transition DRAFT -> PROPOSED', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(mockPlan);
      prisma.treatmentPlan.update.mockResolvedValue({ ...mockPlan, status: 'PROPOSED' });

      const result = await service.update(businessId, 'plan-1', { status: 'PROPOSED' });
      expect(result.status).toBe('PROPOSED');
    });
  });

  describe('addSession', () => {
    it('adds a session to a draft plan', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(mockPlan);
      prisma.service.findFirst.mockResolvedValue({ id: 'svc-2' });
      prisma.treatmentSession.create.mockResolvedValue({
        id: 'sess-2',
        serviceId: 'svc-2',
        sequenceOrder: 2,
        status: 'PENDING',
        service: { name: 'Filler' },
      });

      const result = await service.addSession(businessId, 'plan-1', {
        serviceId: 'svc-2',
        sequenceOrder: 2,
      });
      expect(result.id).toBe('sess-2');
    });

    it('rejects adding sessions to cancelled plan', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue({ ...mockPlan, status: 'CANCELLED' });

      await expect(
        service.addSession(businessId, 'plan-1', { serviceId: 'svc-2', sequenceOrder: 2 }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateSession', () => {
    it('marks session as completed', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(mockPlan);
      prisma.treatmentSession.findFirst.mockResolvedValue({
        id: 'sess-1',
        treatmentPlanId: 'plan-1',
        status: 'SCHEDULED',
      });
      prisma.treatmentSession.update.mockResolvedValue({
        id: 'sess-1',
        status: 'COMPLETED',
        completedAt: new Date(),
      });
      prisma.treatmentSession.findMany.mockResolvedValue([{ status: 'COMPLETED' }]);
      prisma.treatmentPlan.update.mockResolvedValue({ ...mockPlan, status: 'COMPLETED' });
      prisma.treatmentPlan.findUnique.mockResolvedValue(mockPlan);

      const result = await service.updateSession(businessId, 'plan-1', 'sess-1', {
        status: 'COMPLETED',
      });
      expect(result.status).toBe('COMPLETED');
    });
  });

  describe('propose', () => {
    it('proposes a draft plan', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(mockPlan);
      prisma.treatmentPlan.update.mockResolvedValue({
        ...mockPlan,
        status: 'PROPOSED',
        proposedAt: new Date(),
      });

      const result = await service.propose(businessId, 'plan-1');
      expect(result.status).toBe('PROPOSED');
      expect(notificationService.sendTreatmentPlanProposal).toHaveBeenCalled();
    });

    it('rejects proposing non-draft plan', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue({ ...mockPlan, status: 'PROPOSED' });

      await expect(service.propose(businessId, 'plan-1')).rejects.toThrow(BadRequestException);
    });

    it('rejects plan with no sessions', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue({ ...mockPlan, sessions: [] });

      await expect(service.propose(businessId, 'plan-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('accept', () => {
    it('accepts a proposed plan', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue({ ...mockPlan, status: 'PROPOSED' });
      prisma.treatmentPlan.update.mockResolvedValue({
        ...mockPlan,
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      });

      const result = await service.accept(businessId, 'plan-1');
      expect(result.status).toBe('ACCEPTED');
    });

    it('rejects accepting non-proposed plan', async () => {
      prisma.treatmentPlan.findFirst.mockResolvedValue(mockPlan);

      await expect(service.accept(businessId, 'plan-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('onBookingCompleted', () => {
    it('marks session as completed when linked booking completes', async () => {
      prisma.treatmentSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        treatmentPlanId: 'plan-1',
        bookingId: 'booking-2',
      });
      prisma.treatmentSession.update.mockResolvedValue({
        id: 'sess-1',
        status: 'COMPLETED',
      });
      prisma.treatmentSession.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'PENDING' },
      ]);

      await service.onBookingCompleted('booking-2');
      expect(prisma.treatmentSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sess-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('does nothing when no session linked to booking', async () => {
      prisma.treatmentSession.findUnique.mockResolvedValue(null);

      await service.onBookingCompleted('booking-999');
      expect(prisma.treatmentSession.update).not.toHaveBeenCalled();
    });

    it('auto-completes plan when all sessions done', async () => {
      prisma.treatmentSession.findUnique.mockResolvedValue({
        id: 'sess-1',
        treatmentPlanId: 'plan-1',
        bookingId: 'booking-2',
      });
      prisma.treatmentSession.update.mockResolvedValue({ id: 'sess-1', status: 'COMPLETED' });
      prisma.treatmentSession.findMany.mockResolvedValue([
        { status: 'COMPLETED' },
        { status: 'COMPLETED' },
      ]);
      prisma.treatmentPlan.update.mockResolvedValue({ id: 'plan-1', status: 'COMPLETED' });

      await service.onBookingCompleted('booking-2');
      expect(prisma.treatmentPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'plan-1' },
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });
  });
});
