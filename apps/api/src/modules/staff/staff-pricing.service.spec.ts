import { Test } from '@nestjs/testing';
import { StaffService } from './staff.service';
import { PrismaService } from '../../common/prisma.service';
import {
  createMockPrisma,
  createMockTokenService,
  createMockEmailService,
  createMockConfigService,
} from '../../test/mocks';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';

describe('StaffService - pricing', () => {
  let service: StaffService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        StaffService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: createMockTokenService() },
        { provide: EmailService, useValue: createMockEmailService() },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    service = module.get(StaffService);
  });

  describe('getServicePricing', () => {
    it('returns services with override prices', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.service.findMany.mockResolvedValue([
        { id: 'svc1', name: 'Haircut', category: 'General', price: 50 },
        { id: 'svc2', name: 'Coloring', category: 'General', price: 100 },
      ] as any);
      prisma.staffServicePrice.findMany.mockResolvedValue([
        { serviceId: 'svc1', price: 60 },
      ] as any);

      const result = await service.getServicePricing('biz1', 'staff1');

      expect(result).toEqual([
        {
          serviceId: 'svc1',
          serviceName: 'Haircut',
          category: 'General',
          basePrice: 50,
          overridePrice: 60,
        },
        {
          serviceId: 'svc2',
          serviceName: 'Coloring',
          category: 'General',
          basePrice: 100,
          overridePrice: null,
        },
      ]);
    });

    it('throws NotFoundException when staff not found', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(service.getServicePricing('biz1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns empty overrides when none exist', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      prisma.service.findMany.mockResolvedValue([
        { id: 'svc1', name: 'Haircut', category: 'General', price: 50 },
      ] as any);
      prisma.staffServicePrice.findMany.mockResolvedValue([]);

      const result = await service.getServicePricing('biz1', 'staff1');

      expect(result).toEqual([
        {
          serviceId: 'svc1',
          serviceName: 'Haircut',
          category: 'General',
          basePrice: 50,
          overridePrice: null,
        },
      ]);
    });
  });

  describe('setServicePricing', () => {
    it('upserts override prices and removes null overrides', async () => {
      prisma.staff.findFirst.mockResolvedValue({ id: 'staff1' } as any);
      // Mock getServicePricing return for after the update
      prisma.service.findMany.mockResolvedValue([
        { id: 'svc1', name: 'Haircut', category: 'General', price: 50 },
        { id: 'svc2', name: 'Coloring', category: 'General', price: 100 },
      ] as any);
      prisma.staffServicePrice.findMany.mockResolvedValue([
        { serviceId: 'svc1', price: 75 },
      ] as any);
      prisma.staffServicePrice.upsert.mockResolvedValue({} as any);
      prisma.staffServicePrice.deleteMany.mockResolvedValue({ count: 1 } as any);

      const result = await service.setServicePricing('biz1', 'staff1', [
        { serviceId: 'svc1', price: 75 },
        { serviceId: 'svc2', price: null },
      ]);

      expect(prisma.staffServicePrice.upsert).toHaveBeenCalledWith({
        where: {
          staffId_serviceId: { staffId: 'staff1', serviceId: 'svc1' },
        },
        create: {
          staffId: 'staff1',
          serviceId: 'svc1',
          businessId: 'biz1',
          price: 75,
        },
        update: { price: 75 },
      });

      expect(prisma.staffServicePrice.deleteMany).toHaveBeenCalledWith({
        where: { staffId: 'staff1', serviceId: 'svc2', businessId: 'biz1' },
      });
    });

    it('throws NotFoundException when staff not found', async () => {
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(
        service.setServicePricing('biz1', 'nonexistent', [{ serviceId: 'svc1', price: 50 }]),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStaffPriceForService', () => {
    it('returns the override price when one exists', async () => {
      prisma.staffServicePrice.findUnique.mockResolvedValue({
        price: 75,
      } as any);

      const result = await service.getStaffPriceForService('staff1', 'svc1');

      expect(result).toBe(75);
    });

    it('returns null when no override exists', async () => {
      prisma.staffServicePrice.findUnique.mockResolvedValue(null);

      const result = await service.getStaffPriceForService('staff1', 'svc1');

      expect(result).toBeNull();
    });
  });
});
