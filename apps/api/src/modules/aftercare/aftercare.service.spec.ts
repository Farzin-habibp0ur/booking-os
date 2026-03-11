import { Test, TestingModule } from '@nestjs/testing';
import { AftercareService } from './aftercare.service';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('AftercareService', () => {
  let service: AftercareService;
  let prisma: any;
  let notificationService: any;

  const mockPrisma = {
    service: { findFirst: jest.fn() },
    aftercareProtocol: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    aftercareStep: { deleteMany: jest.fn() },
    aftercareEnrollment: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    aftercareMessage: {
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    booking: { findUnique: jest.fn() },
  };

  const mockNotification = {
    sendAftercareStepMessage: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AftercareService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: NotificationService, useValue: mockNotification },
      ],
    }).compile();

    service = module.get(AftercareService);
    prisma = module.get(PrismaService);
    notificationService = module.get(NotificationService);
  });

  describe('createProtocol', () => {
    const businessId = 'biz-1';
    const data = {
      name: 'Test Protocol',
      steps: [{ sequenceOrder: 1, delayHours: 0, body: 'Hello {{customerName}}' }],
    };

    it('should create a protocol with steps', async () => {
      const created = { id: 'proto-1', ...data, businessId, isDefault: false };
      mockPrisma.aftercareProtocol.create.mockResolvedValue(created);

      const result = await service.createProtocol(businessId, data);
      expect(result).toEqual(created);
      expect(mockPrisma.aftercareProtocol.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ businessId, name: 'Test Protocol' }),
        }),
      );
    });

    it('should validate service exists if serviceId provided', async () => {
      mockPrisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.createProtocol(businessId, { ...data, serviceId: 'svc-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent duplicate service-specific protocols', async () => {
      mockPrisma.service.findFirst.mockResolvedValue({ id: 'svc-1' });
      mockPrisma.aftercareProtocol.findUnique.mockResolvedValue({ id: 'existing' });

      await expect(
        service.createProtocol(businessId, { ...data, serviceId: 'svc-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllProtocols', () => {
    it('should list protocols for a business', async () => {
      const protocols = [{ id: 'p1', name: 'Protocol 1' }];
      mockPrisma.aftercareProtocol.findMany.mockResolvedValue(protocols);

      const result = await service.findAllProtocols('biz-1');
      expect(result).toEqual(protocols);
      expect(mockPrisma.aftercareProtocol.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz-1' } }),
      );
    });
  });

  describe('findProtocol', () => {
    it('should return a protocol by id', async () => {
      const protocol = { id: 'p1', businessId: 'biz-1' };
      mockPrisma.aftercareProtocol.findFirst.mockResolvedValue(protocol);

      const result = await service.findProtocol('biz-1', 'p1');
      expect(result).toEqual(protocol);
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.aftercareProtocol.findFirst.mockResolvedValue(null);

      await expect(service.findProtocol('biz-1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProtocol', () => {
    it('should update protocol fields', async () => {
      mockPrisma.aftercareProtocol.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.aftercareProtocol.update.mockResolvedValue({ id: 'p1', name: 'Updated' });

      const result = await service.updateProtocol('biz-1', 'p1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should replace steps when provided', async () => {
      mockPrisma.aftercareProtocol.findFirst.mockResolvedValue({ id: 'p1' });
      mockPrisma.aftercareStep.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.aftercareProtocol.update.mockResolvedValue({ id: 'p1' });

      await service.updateProtocol('biz-1', 'p1', {
        steps: [{ sequenceOrder: 1, delayHours: 0, body: 'New step' }],
      });

      expect(mockPrisma.aftercareStep.deleteMany).toHaveBeenCalledWith({
        where: { protocolId: 'p1' },
      });
    });

    it('should throw NotFoundException if protocol not found', async () => {
      mockPrisma.aftercareProtocol.findFirst.mockResolvedValue(null);

      await expect(
        service.updateProtocol('biz-1', 'missing', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteProtocol', () => {
    it('should hard delete if no enrollments', async () => {
      mockPrisma.aftercareProtocol.findFirst.mockResolvedValue({
        id: 'p1',
        _count: { enrollments: 0 },
      });
      mockPrisma.aftercareProtocol.delete.mockResolvedValue({ id: 'p1' });

      await service.deleteProtocol('biz-1', 'p1');
      expect(mockPrisma.aftercareProtocol.delete).toHaveBeenCalled();
    });

    it('should soft delete (deactivate) if enrollments exist', async () => {
      mockPrisma.aftercareProtocol.findFirst.mockResolvedValue({
        id: 'p1',
        _count: { enrollments: 3 },
      });
      mockPrisma.aftercareProtocol.update.mockResolvedValue({ id: 'p1', isActive: false });

      await service.deleteProtocol('biz-1', 'p1');
      expect(mockPrisma.aftercareProtocol.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });

  describe('enrollCustomer', () => {
    const mockBooking = {
      id: 'book-1',
      businessId: 'biz-1',
      customerId: 'cust-1',
      serviceId: 'svc-1',
      service: { kind: 'TREATMENT' },
      customer: { name: 'Jane', phone: '+1234567890' },
      business: { verticalPack: 'aesthetic' },
    };

    it('should enroll customer in matching protocol', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.aftercareEnrollment.findUnique.mockResolvedValue(null);
      mockPrisma.aftercareProtocol.findFirst.mockResolvedValue({
        id: 'proto-1',
        name: 'Test',
        steps: [{ id: 'step-1', delayHours: 0, sequenceOrder: 1 }],
      });
      mockPrisma.aftercareEnrollment.create.mockResolvedValue({
        id: 'enroll-1',
        messages: [{ id: 'msg-1' }],
      });

      const result = await service.enrollCustomer('book-1');
      expect(result).toBeDefined();
      expect(mockPrisma.aftercareEnrollment.create).toHaveBeenCalled();
    });

    it('should return null for non-aesthetic businesses', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        business: { verticalPack: 'general' },
      });

      const result = await service.enrollCustomer('book-1');
      expect(result).toBeNull();
    });

    it('should return null for non-treatment bookings', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue({
        ...mockBooking,
        service: { kind: 'CONSULT' },
      });

      const result = await service.enrollCustomer('book-1');
      expect(result).toBeNull();
    });

    it('should return existing enrollment if already enrolled', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      const existing = { id: 'enroll-existing' };
      mockPrisma.aftercareEnrollment.findUnique.mockResolvedValue(existing);

      const result = await service.enrollCustomer('book-1');
      expect(result).toEqual(existing);
    });

    it('should fall back to default protocol if no service-specific found', async () => {
      mockPrisma.booking.findUnique.mockResolvedValue(mockBooking);
      mockPrisma.aftercareEnrollment.findUnique.mockResolvedValue(null);
      mockPrisma.aftercareProtocol.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'default-proto',
          name: 'Default',
          steps: [{ id: 's1', delayHours: 24, sequenceOrder: 1 }],
        });
      mockPrisma.aftercareEnrollment.create.mockResolvedValue({ id: 'enroll-2' });

      const result = await service.enrollCustomer('book-1');
      expect(result).toBeDefined();
    });
  });

  describe('cancelEnrollment', () => {
    it('should cancel enrollment and pending messages', async () => {
      mockPrisma.aftercareEnrollment.findFirst.mockResolvedValue({ id: 'enroll-1' });
      mockPrisma.aftercareMessage.updateMany.mockResolvedValue({ count: 2 });
      mockPrisma.aftercareEnrollment.update.mockResolvedValue({
        id: 'enroll-1',
        status: 'CANCELLED',
      });

      const result = await service.cancelEnrollment('biz-1', 'enroll-1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should throw NotFoundException if enrollment not found', async () => {
      mockPrisma.aftercareEnrollment.findFirst.mockResolvedValue(null);

      await expect(service.cancelEnrollment('biz-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('processScheduledMessages', () => {
    it('should process due messages and send notifications', async () => {
      const messages = [
        {
          id: 'msg-1',
          stepId: 'step-1',
          enrollmentId: 'enroll-1',
          enrollment: {
            customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
            booking: {
              startTime: new Date(),
              service: { name: 'Botox' },
              business: { id: 'biz-1', name: 'Glow Clinic' },
            },
            protocol: {
              steps: [
                { id: 'step-1', body: 'Hi {{customerName}}!', subject: 'Check-in', channel: 'WHATSAPP' },
              ],
            },
          },
        },
      ];

      mockPrisma.aftercareMessage.findMany.mockResolvedValue(messages);
      mockPrisma.aftercareMessage.update.mockResolvedValue({});
      mockPrisma.aftercareMessage.count.mockResolvedValue(0);
      mockPrisma.aftercareEnrollment.update.mockResolvedValue({});
      mockNotification.sendAftercareStepMessage.mockResolvedValue(undefined);

      await service.processScheduledMessages();

      expect(mockNotification.sendAftercareStepMessage).toHaveBeenCalledWith(
        '+1234567890',
        'jane@test.com',
        'Hi Jane!',
        'Check-in',
        'WHATSAPP',
        { id: 'biz-1', name: 'Glow Clinic' },
      );
      expect(mockPrisma.aftercareMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
    });

    it('should mark enrollment as completed when all messages sent', async () => {
      mockPrisma.aftercareMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          stepId: 'step-1',
          enrollmentId: 'enroll-1',
          enrollment: {
            customer: { name: 'Jane', phone: '+1234567890', email: null },
            booking: {
              startTime: new Date(),
              service: { name: 'Botox' },
              business: { id: 'biz-1', name: 'Glow' },
            },
            protocol: {
              steps: [{ id: 'step-1', body: 'Hello', subject: null, channel: 'WHATSAPP' }],
            },
          },
        },
      ]);
      mockPrisma.aftercareMessage.update.mockResolvedValue({});
      mockPrisma.aftercareMessage.count.mockResolvedValue(0);
      mockPrisma.aftercareEnrollment.update.mockResolvedValue({});
      mockNotification.sendAftercareStepMessage.mockResolvedValue(undefined);

      await service.processScheduledMessages();

      expect(mockPrisma.aftercareEnrollment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'COMPLETED' }),
        }),
      );
    });

    it('should mark message as FAILED on send error', async () => {
      mockPrisma.aftercareMessage.findMany.mockResolvedValue([
        {
          id: 'msg-1',
          stepId: 'step-1',
          enrollmentId: 'enroll-1',
          enrollment: {
            customer: { name: 'Jane', phone: '+1234567890', email: null },
            booking: {
              startTime: new Date(),
              service: { name: 'Botox' },
              business: { id: 'biz-1', name: 'Glow' },
            },
            protocol: {
              steps: [{ id: 'step-1', body: 'Hello', subject: null, channel: 'WHATSAPP' }],
            },
          },
        },
      ]);
      mockNotification.sendAftercareStepMessage.mockRejectedValue(new Error('fail'));
      mockPrisma.aftercareMessage.update.mockResolvedValue({});
      mockPrisma.aftercareMessage.count.mockResolvedValue(0);
      mockPrisma.aftercareEnrollment.update.mockResolvedValue({});

      await service.processScheduledMessages();

      expect(mockPrisma.aftercareMessage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'FAILED' } }),
      );
    });

    it('should do nothing when no pending messages', async () => {
      mockPrisma.aftercareMessage.findMany.mockResolvedValue([]);

      await service.processScheduledMessages();

      expect(mockNotification.sendAftercareStepMessage).not.toHaveBeenCalled();
    });
  });

  describe('getPortalAftercareData', () => {
    it('should return enrollments for portal', async () => {
      const enrollments = [{ id: 'e1', status: 'ACTIVE' }];
      mockPrisma.aftercareEnrollment.findMany.mockResolvedValue(enrollments);

      const result = await service.getPortalAftercareData('cust-1', 'biz-1');
      expect(result).toEqual(enrollments);
    });
  });
});
