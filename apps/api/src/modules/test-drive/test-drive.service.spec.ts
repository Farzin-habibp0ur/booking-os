import { Test } from '@nestjs/testing';
import { TestDriveService } from './test-drive.service';
import { PrismaService } from '../../common/prisma.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('TestDriveService', () => {
  let service: TestDriveService;
  let prisma: any;

  const businessId = 'biz-1';
  const mockBusiness = { id: businessId, verticalPack: 'dealership' };
  const mockVehicle = {
    id: 'veh-1',
    businessId,
    stockNumber: 'AUT-00001',
    year: 2024,
    make: 'Toyota',
    model: 'Camry',
    status: 'IN_STOCK',
  };
  const mockCustomer = { id: 'cust-1', businessId, name: 'Jane Doe', deletedAt: null };
  const mockTestDrive = {
    id: 'td-1',
    vehicleId: 'veh-1',
    customerId: 'cust-1',
    bookingId: 'book-1',
    staffId: null,
    status: 'SCHEDULED',
    feedback: null,
    notes: null,
    createdAt: new Date(),
    vehicle: {
      id: 'veh-1',
      stockNumber: 'AUT-00001',
      year: 2024,
      make: 'Toyota',
      model: 'Camry',
      vin: null,
    },
    customer: { id: 'cust-1', name: 'Jane Doe', phone: '1234567890', email: null },
    staff: null,
    booking: { id: 'book-1', startTime: new Date(), endTime: new Date(), status: 'CONFIRMED' },
  };

  beforeEach(async () => {
    prisma = {
      business: { findUnique: jest.fn() },
      vehicle: { findFirst: jest.fn() },
      customer: { findFirst: jest.fn() },
      staff: { findFirst: jest.fn() },
      service: { findFirst: jest.fn() },
      booking: { create: jest.fn(), update: jest.fn() },
      testDrive: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [TestDriveService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(TestDriveService);
  });

  describe('create', () => {
    it('should create a test drive and linked booking', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc-1',
        name: 'Test Drive',
        durationMins: 30,
      });
      prisma.booking.create.mockResolvedValue({ id: 'book-1' });
      prisma.testDrive.create.mockResolvedValue(mockTestDrive);

      const result = await service.create(businessId, {
        vehicleId: 'veh-1',
        customerId: 'cust-1',
        startTime: '2026-04-01T10:00:00Z',
      });

      expect(result).toEqual(mockTestDrive);
      expect(prisma.booking.create).toHaveBeenCalled();
      expect(prisma.testDrive.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ vehicleId: 'veh-1', bookingId: 'book-1' }),
        }),
      );
    });

    it('should reject non-dealership businesses', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });

      await expect(
        service.create(businessId, {
          vehicleId: 'veh-1',
          customerId: 'cust-1',
          startTime: '2026-04-01T10:00:00Z',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject sold vehicles', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue({ ...mockVehicle, status: 'SOLD' });

      await expect(
        service.create(businessId, {
          vehicleId: 'veh-1',
          customerId: 'cust-1',
          startTime: '2026-04-01T10:00:00Z',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject missing vehicle', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.create(businessId, {
          vehicleId: 'bad',
          customerId: 'cust-1',
          startTime: '2026-04-01T10:00:00Z',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should create without booking if no Test Drive service exists', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.customer.findFirst.mockResolvedValue(mockCustomer);
      prisma.service.findFirst.mockResolvedValue(null);
      prisma.testDrive.create.mockResolvedValue({ ...mockTestDrive, bookingId: null });

      await service.create(businessId, {
        vehicleId: 'veh-1',
        customerId: 'cust-1',
        startTime: '2026-04-01T10:00:00Z',
      });

      expect(prisma.booking.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update test drive status', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.testDrive.findFirst.mockResolvedValue(mockTestDrive);
      prisma.testDrive.update.mockResolvedValue({ ...mockTestDrive, status: 'COMPLETED' });

      const result = await service.update(businessId, 'td-1', { status: 'COMPLETED' });
      expect(result.status).toBe('COMPLETED');
    });

    it('should update linked booking status', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.testDrive.findFirst.mockResolvedValue(mockTestDrive);
      prisma.booking.update.mockResolvedValue({});
      prisma.testDrive.update.mockResolvedValue({ ...mockTestDrive, status: 'COMPLETED' });

      await service.update(businessId, 'td-1', { status: 'COMPLETED' });

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'book-1' },
        data: { status: 'COMPLETED' },
      });
    });

    it('should throw NotFoundException for missing test drive', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.testDrive.findFirst.mockResolvedValue(null);

      await expect(service.update(businessId, 'bad', { status: 'COMPLETED' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findAll', () => {
    it('should list test drives with vehicle filter', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.testDrive.findMany.mockResolvedValue([mockTestDrive]);

      const result = await service.findAll(businessId, { vehicleId: 'veh-1' });
      expect(result).toHaveLength(1);
    });

    it('should list test drives with customer filter', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.testDrive.findMany.mockResolvedValue([mockTestDrive]);

      const result = await service.findAll(businessId, { customerId: 'cust-1' });
      expect(result).toHaveLength(1);
    });
  });
});
