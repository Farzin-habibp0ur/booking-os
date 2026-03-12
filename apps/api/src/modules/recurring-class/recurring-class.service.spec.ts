import { Test, TestingModule } from '@nestjs/testing';
import { RecurringClassService } from './recurring-class.service';
import { PrismaService } from '../../common/prisma.service';
import { ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';

describe('RecurringClassService', () => {
  let service: RecurringClassService;
  let prisma: any;

  const mockPrisma = {
    business: { findUnique: jest.fn() },
    service: { findFirst: jest.fn() },
    staff: { findFirst: jest.fn(), findMany: jest.fn() },
    resource: { findUnique: jest.fn() },
    customer: { findFirst: jest.fn() },
    recurringClass: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    booking: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [RecurringClassService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    service = module.get(RecurringClassService);
    prisma = module.get(PrismaService);
  });

  const bizId = 'biz-1';

  describe('validateWellnessVertical', () => {
    it('throws if not wellness', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'general' });
      await expect(
        service.create(bizId, {
          serviceId: 's',
          staffId: 's',
          dayOfWeek: 1,
          startTime: '09:00',
          maxParticipants: 10,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('create', () => {
    it('creates a recurring class', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.service.findFirst.mockResolvedValue({ id: 'svc-1', businessId: bizId });
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff-1', businessId: bizId });
      const expected = { id: 'rc-1', dayOfWeek: 1, startTime: '09:00' };
      prisma.recurringClass.create.mockResolvedValue(expected);

      const result = await service.create(bizId, {
        serviceId: 'svc-1',
        staffId: 'staff-1',
        dayOfWeek: 1,
        startTime: '09:00',
        maxParticipants: 10,
      });

      expect(result).toEqual(expected);
      expect(prisma.recurringClass.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: bizId,
            serviceId: 'svc-1',
            dayOfWeek: 1,
          }),
        }),
      );
    });

    it('throws if service not found', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.create(bizId, {
          serviceId: 'x',
          staffId: 'y',
          dayOfWeek: 1,
          startTime: '09:00',
          maxParticipants: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws if staff not found', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.service.findFirst.mockResolvedValue({ id: 'svc-1', businessId: bizId });
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(
        service.create(bizId, {
          serviceId: 'svc-1',
          staffId: 'x',
          dayOfWeek: 1,
          startTime: '09:00',
          maxParticipants: 5,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('returns all classes for wellness business', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.recurringClass.findMany.mockResolvedValue([{ id: 'rc-1' }]);

      const result = await service.findAll(bizId);
      expect(result).toHaveLength(1);
    });
  });

  describe('findOne', () => {
    it('returns a class by id', async () => {
      const cls = { id: 'rc-1', businessId: bizId };
      prisma.recurringClass.findFirst.mockResolvedValue(cls);

      const result = await service.findOne(bizId, 'rc-1');
      expect(result).toEqual(cls);
    });

    it('throws if not found', async () => {
      prisma.recurringClass.findFirst.mockResolvedValue(null);
      await expect(service.findOne(bizId, 'x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates a class', async () => {
      prisma.recurringClass.findFirst.mockResolvedValue({ id: 'rc-1', businessId: bizId });
      prisma.recurringClass.update.mockResolvedValue({ id: 'rc-1', maxParticipants: 20 });

      const result = await service.update(bizId, 'rc-1', { maxParticipants: 20 });
      expect(result.maxParticipants).toBe(20);
    });
  });

  describe('remove', () => {
    it('deletes a class', async () => {
      prisma.recurringClass.findFirst.mockResolvedValue({ id: 'rc-1', businessId: bizId });
      prisma.recurringClass.delete.mockResolvedValue({ id: 'rc-1' });

      const result = await service.remove(bizId, 'rc-1');
      expect(result.id).toBe('rc-1');
    });
  });

  describe('getWeeklySchedule', () => {
    it('throws on invalid week format', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      await expect(service.getWeeklySchedule(bizId, 'bad')).rejects.toThrow(BadRequestException);
    });

    it('returns schedule with enrollment counts', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.recurringClass.findMany.mockResolvedValue([
        {
          id: 'rc-1',
          serviceId: 'svc-1',
          staffId: 'staff-1',
          dayOfWeek: 1,
          startTime: '09:00',
          maxParticipants: 10,
          service: { id: 'svc-1', name: 'Yoga', durationMins: 60, price: 30 },
          staff: { id: 'staff-1', name: 'Alice' },
          resource: null,
          location: null,
        },
      ]);
      prisma.booking.count.mockResolvedValue(3);

      const result = await service.getWeeklySchedule(bizId, '2026-W12');
      expect(result).toHaveLength(1);
      expect(result[0].enrollmentCount).toBe(3);
      expect(result[0].spotsRemaining).toBe(7);
    });
  });

  describe('enroll', () => {
    const setupEnroll = () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.recurringClass.findFirst.mockResolvedValue({
        id: 'rc-1',
        businessId: bizId,
        serviceId: 'svc-1',
        staffId: 'staff-1',
        dayOfWeek: 3,
        startTime: '10:00',
        maxParticipants: 10,
        isActive: true,
        resourceId: null,
        locationId: null,
        service: { id: 'svc-1', name: 'Yoga', durationMins: 60 },
      });
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1', businessId: bizId });
    };

    it('enrolls a customer', async () => {
      setupEnroll();
      prisma.booking.count.mockResolvedValue(3);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'bk-1', status: 'CONFIRMED' });

      const result = await service.enroll(bizId, 'rc-1', 'cust-1');
      expect(result.status).toBe('CONFIRMED');
    });

    it('throws when class is full', async () => {
      setupEnroll();
      prisma.booking.count.mockResolvedValue(10);

      await expect(service.enroll(bizId, 'rc-1', 'cust-1')).rejects.toThrow(BadRequestException);
    });

    it('throws when already enrolled', async () => {
      setupEnroll();
      prisma.booking.count.mockResolvedValue(3);
      prisma.booking.findFirst.mockResolvedValue({ id: 'bk-existing' });

      await expect(service.enroll(bizId, 'rc-1', 'cust-1')).rejects.toThrow(BadRequestException);
    });

    it('throws when customer not found', async () => {
      setupEnroll();
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(service.enroll(bizId, 'rc-1', 'bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
