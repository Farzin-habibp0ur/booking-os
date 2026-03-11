import { Test } from '@nestjs/testing';
import { VehicleService } from './vehicle.service';
import { PrismaService } from '../../common/prisma.service';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';

describe('VehicleService', () => {
  let service: VehicleService;
  let prisma: any;

  const businessId = 'biz-1';
  const mockBusiness = { id: businessId, verticalPack: 'dealership', name: 'AutoMax' };
  const mockVehicle = {
    id: 'veh-1',
    businessId,
    stockNumber: 'AUT-00001',
    vin: 'JH4KA7660MC000001',
    year: 2024,
    make: 'Toyota',
    model: 'Camry',
    trim: 'XLE',
    color: 'White',
    mileage: 5000,
    condition: 'USED',
    status: 'IN_STOCK',
    askingPrice: 28000,
    costPrice: 22000,
    description: null,
    features: ['Bluetooth', 'Backup Camera'],
    imageUrls: [],
    locationId: null,
    addedById: 'staff-1',
    soldAt: null,
    createdAt: new Date('2026-02-01'),
    updatedAt: new Date(),
    location: null,
    addedBy: { id: 'staff-1', name: 'John' },
  };

  beforeEach(async () => {
    prisma = {
      business: { findUnique: jest.fn() },
      vehicle: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      location: { findFirst: jest.fn() },
    };

    const module = await Test.createTestingModule({
      providers: [VehicleService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(VehicleService);
  });

  describe('create', () => {
    it('should create a vehicle with auto-generated stock number', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(null);
      prisma.vehicle.findUnique.mockResolvedValue(null);
      prisma.vehicle.create.mockResolvedValue(mockVehicle);

      const result = await service.create(businessId, {
        year: 2024,
        make: 'Toyota',
        model: 'Camry',
      });

      expect(result).toEqual(mockVehicle);
      expect(prisma.vehicle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ businessId, make: 'Toyota' }),
        }),
      );
    });

    it('should reject non-dealership businesses', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'aesthetic' });

      await expect(
        service.create(businessId, { year: 2024, make: 'Toyota', model: 'Camry' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject duplicate stock number', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(null);
      prisma.vehicle.findUnique.mockResolvedValueOnce(mockVehicle); // stock number check

      await expect(
        service.create(businessId, { year: 2024, make: 'Toyota', model: 'Camry', stockNumber: 'AUT-00001' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate VIN', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(null);
      prisma.vehicle.findUnique
        .mockResolvedValueOnce(null) // stock number check
        .mockResolvedValueOnce(mockVehicle); // VIN check

      await expect(
        service.create(businessId, {
          year: 2024,
          make: 'Toyota',
          model: 'Camry',
          vin: 'JH4KA7660MC000001',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should uppercase VIN', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(null);
      prisma.vehicle.findUnique.mockResolvedValue(null);
      prisma.vehicle.create.mockResolvedValue(mockVehicle);

      await service.create(businessId, {
        year: 2024,
        make: 'Toyota',
        model: 'Camry',
        vin: 'jh4ka7660mc000001',
      });

      expect(prisma.vehicle.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ vin: 'JH4KA7660MC000001' }),
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should list vehicles with filters', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findMany.mockResolvedValue([mockVehicle]);
      prisma.vehicle.count.mockResolvedValue(1);

      const result = await service.findAll(businessId, { status: 'IN_STOCK' });

      expect(result).toEqual({ data: [mockVehicle], total: 1 });
    });

    it('should support search', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findMany.mockResolvedValue([]);
      prisma.vehicle.count.mockResolvedValue(0);

      await service.findAll(businessId, { search: 'Toyota' });

      expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ make: { contains: 'Toyota', mode: 'insensitive' } }),
            ]),
          }),
        }),
      );
    });

    it('should support price range filters', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findMany.mockResolvedValue([]);
      prisma.vehicle.count.mockResolvedValue(0);

      await service.findAll(businessId, { priceMin: 10000, priceMax: 30000 });

      expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            askingPrice: { gte: 10000, lte: 30000 },
          }),
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return vehicle with relations', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);

      const result = await service.findOne(businessId, 'veh-1');
      expect(result).toEqual(mockVehicle);
    });

    it('should throw NotFoundException for missing vehicle', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(null);

      await expect(service.findOne(businessId, 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update vehicle', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.vehicle.update.mockResolvedValue({ ...mockVehicle, color: 'Black' });

      const result = await service.update(businessId, 'veh-1', { color: 'Black' });
      expect(result.color).toBe('Black');
    });

    it('should set soldAt when status changes to SOLD', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.vehicle.update.mockResolvedValue({ ...mockVehicle, status: 'SOLD' });

      await service.update(businessId, 'veh-1', { status: 'SOLD' });

      expect(prisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ soldAt: expect.any(Date) }),
        }),
      );
    });

    it('should clear soldAt when status changes from SOLD', async () => {
      const soldVehicle = { ...mockVehicle, status: 'SOLD', soldAt: new Date() };
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(soldVehicle);
      prisma.vehicle.update.mockResolvedValue({ ...soldVehicle, status: 'IN_STOCK' });

      await service.update(businessId, 'veh-1', { status: 'IN_STOCK' });

      expect(prisma.vehicle.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ soldAt: null }),
        }),
      );
    });
  });

  describe('remove', () => {
    it('should soft delete by setting status to ARCHIVED', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.vehicle.update.mockResolvedValue({ ...mockVehicle, status: 'ARCHIVED' });

      await service.remove(businessId, 'veh-1');

      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'veh-1' },
        data: { status: 'ARCHIVED' },
      });
    });
  });

  describe('stats', () => {
    it('should return inventory statistics', async () => {
      prisma.business.findUnique.mockResolvedValue(mockBusiness);
      prisma.vehicle.findMany.mockResolvedValue([
        { status: 'IN_STOCK', askingPrice: 28000, createdAt: new Date('2026-02-01') },
        { status: 'IN_STOCK', askingPrice: 35000, createdAt: new Date('2026-03-01') },
        { status: 'SOLD', askingPrice: 22000, createdAt: new Date('2026-01-01') },
      ]);

      const result = await service.stats(businessId);

      expect(result.total).toBe(3);
      expect(result.countByStatus).toEqual({ IN_STOCK: 2, SOLD: 1 });
      expect(result.totalValue).toBe(85000);
      expect(result.avgDaysOnLot).toBeGreaterThan(0);
    });
  });
});
