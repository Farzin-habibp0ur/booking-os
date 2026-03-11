import { Test, TestingModule } from '@nestjs/testing';
import { PackageService } from './package.service';
import { PrismaService } from '../../common/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('PackageService', () => {
  let service: PackageService;
  let prisma: any;

  const businessId = 'biz-1';

  beforeEach(async () => {
    prisma = {
      business: { findUnique: jest.fn() },
      service: { findFirst: jest.fn() },
      servicePackage: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      packagePurchase: {
        create: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      packageRedemption: {
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
      },
      customer: { findFirst: jest.fn() },
      payment: { create: jest.fn() },
      booking: { findFirst: jest.fn() },
      $transaction: jest.fn(),
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackageService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PackageService>(PackageService);
  });

  describe('validateWellnessVertical', () => {
    it('should throw if business is not wellness', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'aesthetic' });
      await expect(service.create(businessId, { name: 'Test', totalSessions: 5, price: 100 }))
        .rejects.toThrow(BadRequestException);
    });

    it('should throw if business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      await expect(service.create(businessId, { name: 'Test', totalSessions: 5, price: 100 }))
        .rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a package', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.servicePackage.create.mockResolvedValue({
        id: 'pkg-1',
        name: '10 Sessions',
        totalSessions: 10,
        price: '250.00',
      });

      const result = await service.create(businessId, {
        name: '10 Sessions',
        totalSessions: 10,
        price: 250,
      });

      expect(result.name).toBe('10 Sessions');
      expect(prisma.servicePackage.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId,
            name: '10 Sessions',
            totalSessions: 10,
            price: 250,
          }),
        }),
      );
    });

    it('should validate service exists if serviceId provided', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.create(businessId, { name: 'Test', totalSessions: 5, price: 100, serviceId: 'bad-id' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('should return packages for business', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.servicePackage.findMany.mockResolvedValue([
        { id: 'pkg-1', name: '10 Sessions' },
        { id: 'pkg-2', name: '5 Sessions' },
      ]);

      const result = await service.findAll(businessId);
      expect(result).toHaveLength(2);
    });
  });

  describe('findOne', () => {
    it('should return package with purchases', async () => {
      prisma.servicePackage.findFirst.mockResolvedValue({
        id: 'pkg-1',
        name: '10 Sessions',
        purchases: [],
      });

      const result = await service.findOne(businessId, 'pkg-1');
      expect(result.id).toBe('pkg-1');
    });

    it('should throw if not found', async () => {
      prisma.servicePackage.findFirst.mockResolvedValue(null);
      await expect(service.findOne(businessId, 'bad')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update package', async () => {
      prisma.servicePackage.findFirst.mockResolvedValue({ id: 'pkg-1' });
      prisma.servicePackage.update.mockResolvedValue({ id: 'pkg-1', name: 'Updated' });

      const result = await service.update(businessId, 'pkg-1', { name: 'Updated' });
      expect(result.name).toBe('Updated');
    });

    it('should throw if package not found', async () => {
      prisma.servicePackage.findFirst.mockResolvedValue(null);
      await expect(service.update(businessId, 'bad', { name: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('delete', () => {
    it('should delete package with no purchases', async () => {
      prisma.servicePackage.findFirst.mockResolvedValue({ id: 'pkg-1', _count: { purchases: 0 } });
      prisma.servicePackage.delete.mockResolvedValue({ id: 'pkg-1' });

      await service.delete(businessId, 'pkg-1');
      expect(prisma.servicePackage.delete).toHaveBeenCalled();
    });

    it('should deactivate package with purchases', async () => {
      prisma.servicePackage.findFirst.mockResolvedValue({ id: 'pkg-1', _count: { purchases: 3 } });
      prisma.servicePackage.update.mockResolvedValue({ id: 'pkg-1', isActive: false });

      await service.delete(businessId, 'pkg-1');
      expect(prisma.servicePackage.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });

  describe('purchase', () => {
    it('should create a purchase', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.servicePackage.findFirst.mockResolvedValue({
        id: 'pkg-1',
        totalSessions: 10,
        price: '250.00',
        validityDays: 365,
        currency: 'USD',
        isActive: true,
        name: '10 Sessions',
      });
      prisma.customer.findFirst.mockResolvedValue({ id: 'cust-1' });
      prisma.payment.create.mockResolvedValue({ id: 'pay-1' });
      prisma.packagePurchase.create.mockResolvedValue({
        id: 'pur-1',
        totalSessions: 10,
        usedSessions: 0,
        status: 'ACTIVE',
      });

      const result = await service.purchase(businessId, 'pkg-1', {
        customerId: 'cust-1',
        paymentMethod: 'CASH',
      });
      expect(result.totalSessions).toBe(10);
    });

    it('should throw if package inactive', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.servicePackage.findFirst.mockResolvedValue(null);

      await expect(
        service.purchase(businessId, 'pkg-1', { customerId: 'cust-1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if customer not found', async () => {
      prisma.business.findUnique.mockResolvedValue({ verticalPack: 'wellness' });
      prisma.servicePackage.findFirst.mockResolvedValue({
        id: 'pkg-1',
        isActive: true,
        totalSessions: 10,
        price: '250.00',
        validityDays: 365,
        currency: 'USD',
        name: 'Pkg',
      });
      prisma.customer.findFirst.mockResolvedValue(null);

      await expect(
        service.purchase(businessId, 'pkg-1', { customerId: 'bad' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('redeem', () => {
    it('should redeem a session', async () => {
      const txMock = {
        $queryRaw: jest.fn(),
        packagePurchase: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'pur-1',
            status: 'ACTIVE',
            usedSessions: 2,
            totalSessions: 10,
            expiresAt: new Date(Date.now() + 86400000),
            customerId: 'cust-1',
            package: { serviceId: null },
          }),
          update: jest.fn(),
        },
        booking: {
          findFirst: jest.fn().mockResolvedValue({ id: 'book-1', serviceId: 'svc-1', customerId: 'cust-1' }),
        },
        packageRedemption: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'red-1' }),
        },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      const result = await service.redeem(businessId, 'pur-1', { bookingId: 'book-1' });
      expect(result.usedSessions).toBe(3);
      expect(result.remaining).toBe(7);
      expect(result.status).toBe('ACTIVE');
    });

    it('should set EXHAUSTED when all sessions used', async () => {
      const txMock = {
        $queryRaw: jest.fn(),
        packagePurchase: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'pur-1',
            status: 'ACTIVE',
            usedSessions: 9,
            totalSessions: 10,
            expiresAt: new Date(Date.now() + 86400000),
            customerId: 'cust-1',
            package: { serviceId: null },
          }),
          update: jest.fn(),
        },
        booking: {
          findFirst: jest.fn().mockResolvedValue({ id: 'book-1', serviceId: 'svc-1', customerId: 'cust-1' }),
        },
        packageRedemption: {
          findUnique: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue({ id: 'red-1' }),
        },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      const result = await service.redeem(businessId, 'pur-1', { bookingId: 'book-1' });
      expect(result.status).toBe('EXHAUSTED');
      expect(result.remaining).toBe(0);
    });

    it('should reject if package expired', async () => {
      const txMock = {
        $queryRaw: jest.fn(),
        packagePurchase: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'pur-1',
            status: 'ACTIVE',
            usedSessions: 2,
            totalSessions: 10,
            expiresAt: new Date(Date.now() - 86400000), // expired
            customerId: 'cust-1',
            package: { serviceId: null },
          }),
        },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      await expect(
        service.redeem(businessId, 'pur-1', { bookingId: 'book-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject if wrong service', async () => {
      const txMock = {
        $queryRaw: jest.fn(),
        packagePurchase: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'pur-1',
            status: 'ACTIVE',
            usedSessions: 2,
            totalSessions: 10,
            expiresAt: new Date(Date.now() + 86400000),
            customerId: 'cust-1',
            package: { serviceId: 'svc-specific' },
          }),
        },
        booking: {
          findFirst: jest.fn().mockResolvedValue({ id: 'book-1', serviceId: 'svc-other', customerId: 'cust-1' }),
        },
        packageRedemption: {
          findUnique: jest.fn().mockResolvedValue(null),
        },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      await expect(
        service.redeem(businessId, 'pur-1', { bookingId: 'book-1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate redemption for same booking', async () => {
      const txMock = {
        $queryRaw: jest.fn(),
        packagePurchase: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'pur-1',
            status: 'ACTIVE',
            usedSessions: 2,
            totalSessions: 10,
            expiresAt: new Date(Date.now() + 86400000),
            customerId: 'cust-1',
            package: { serviceId: null },
          }),
        },
        booking: {
          findFirst: jest.fn().mockResolvedValue({ id: 'book-1', serviceId: 'svc-1', customerId: 'cust-1' }),
        },
        packageRedemption: {
          findUnique: jest.fn().mockResolvedValue({ id: 'existing-red' }),
        },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      await expect(
        service.redeem(businessId, 'pur-1', { bookingId: 'book-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('unredeemOnCancel', () => {
    it('should restore session on cancel', async () => {
      prisma.packageRedemption.findUnique.mockResolvedValue({
        id: 'red-1',
        purchaseId: 'pur-1',
        purchase: { id: 'pur-1', businessId, usedSessions: 5, status: 'ACTIVE' },
      });

      const txMock = {
        packageRedemption: { delete: jest.fn() },
        packagePurchase: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      const result = await service.unredeemOnCancel('book-1', businessId);
      expect(result).toEqual({ unredeemedPurchaseId: 'pur-1', newUsedSessions: 4 });
    });

    it('should reactivate exhausted package', async () => {
      prisma.packageRedemption.findUnique.mockResolvedValue({
        id: 'red-1',
        purchaseId: 'pur-1',
        purchase: { id: 'pur-1', businessId, usedSessions: 10, status: 'EXHAUSTED' },
      });

      const txMock = {
        packageRedemption: { delete: jest.fn() },
        packagePurchase: { update: jest.fn() },
      };
      prisma.$transaction.mockImplementation((fn: any) => fn(txMock));

      const result = await service.unredeemOnCancel('book-1', businessId);
      expect(result?.newUsedSessions).toBe(9);
      expect(txMock.packagePurchase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'ACTIVE' }),
        }),
      );
    });

    it('should return null if no redemption', async () => {
      prisma.packageRedemption.findUnique.mockResolvedValue(null);
      const result = await service.unredeemOnCancel('book-1', businessId);
      expect(result).toBeNull();
    });
  });

  describe('getCustomerActivePackages', () => {
    it('should return active packages for customer', async () => {
      prisma.packagePurchase.findMany.mockResolvedValue([
        { id: 'pur-1', package: { serviceId: null } },
        { id: 'pur-2', package: { serviceId: 'svc-1' } },
      ]);

      const result = await service.getCustomerActivePackages(businessId, 'cust-1');
      expect(result).toHaveLength(2);
    });

    it('should filter by service compatibility', async () => {
      prisma.packagePurchase.findMany.mockResolvedValue([
        { id: 'pur-1', package: { serviceId: null } },
        { id: 'pur-2', package: { serviceId: 'svc-1' } },
        { id: 'pur-3', package: { serviceId: 'svc-2' } },
      ]);

      const result = await service.getCustomerActivePackages(businessId, 'cust-1', 'svc-1');
      expect(result).toHaveLength(2); // null (any service) + svc-1
    });
  });

  describe('stats', () => {
    it('should return stats', async () => {
      prisma.servicePackage.count.mockResolvedValue(5);
      prisma.packagePurchase.count.mockResolvedValue(12);
      prisma.packagePurchase.findMany.mockResolvedValue([
        { package: { price: '100.00' } },
        { package: { price: '250.00' } },
      ]);
      prisma.packageRedemption.count.mockResolvedValue(30);

      const result = await service.stats(businessId);
      expect(result).toEqual({
        totalPackages: 5,
        activePurchases: 12,
        totalRevenue: 350,
        totalRedemptions: 30,
      });
    });
  });

  describe('checkExpiredPackages', () => {
    it('should expire active packages past expiresAt', async () => {
      prisma.packagePurchase.findMany.mockResolvedValue([
        { id: 'pur-1', customerId: 'cust-1', businessId },
        { id: 'pur-2', customerId: 'cust-2', businessId },
      ]);
      prisma.packagePurchase.updateMany.mockResolvedValue({ count: 2 });

      await service.checkExpiredPackages();
      expect(prisma.packagePurchase.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'EXPIRED' },
        }),
      );
    });

    it('should skip if no expired packages', async () => {
      prisma.packagePurchase.findMany.mockResolvedValue([]);
      await service.checkExpiredPackages();
      expect(prisma.packagePurchase.updateMany).not.toHaveBeenCalled();
    });
  });
});
