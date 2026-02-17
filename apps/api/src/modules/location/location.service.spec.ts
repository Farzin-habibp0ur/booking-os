import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LocationService } from './location.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('LocationService', () => {
  let service: LocationService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        LocationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(LocationService);
  });

  // ---- Locations ----

  describe('findAll', () => {
    it('returns active locations for a business', async () => {
      const locations = [
        { id: 'loc1', name: 'Showroom', isActive: true },
        { id: 'loc2', name: 'Service Center', isActive: true },
      ];
      prisma.location.findMany.mockResolvedValue(locations as any);

      const result = await service.findAll('biz1');

      expect(result).toEqual(locations);
      expect(prisma.location.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', isActive: true },
          orderBy: { name: 'asc' },
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns a location by id', async () => {
      const location = { id: 'loc1', businessId: 'biz1', name: 'Showroom' };
      prisma.location.findFirst.mockResolvedValue(location as any);

      const result = await service.findById('biz1', 'loc1');

      expect(result).toEqual(location);
    });

    it('throws NotFoundException if location not found', async () => {
      prisma.location.findFirst.mockResolvedValue(null);

      await expect(service.findById('biz1', 'nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a new location', async () => {
      const created = { id: 'loc1', businessId: 'biz1', name: 'New Location', isBookable: true };
      prisma.location.create.mockResolvedValue(created as any);

      const result = await service.create('biz1', { name: 'New Location' });

      expect(result).toEqual(created);
      expect(prisma.location.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            name: 'New Location',
            isBookable: true,
          }),
        }),
      );
    });

    it('creates a non-bookable location', async () => {
      const created = { id: 'loc1', businessId: 'biz1', name: 'Warehouse', isBookable: false };
      prisma.location.create.mockResolvedValue(created as any);

      await service.create('biz1', { name: 'Warehouse', isBookable: false });

      expect(prisma.location.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isBookable: false }),
        }),
      );
    });
  });

  describe('update', () => {
    it('updates a location', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.location.update.mockResolvedValue({ id: 'loc1', name: 'Updated' } as any);

      const result = await service.update('biz1', 'loc1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('throws if location not found', async () => {
      prisma.location.findFirst.mockResolvedValue(null);

      await expect(service.update('biz1', 'nope', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('sets isActive to false', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.location.update.mockResolvedValue({ id: 'loc1', isActive: false } as any);

      const result = await service.softDelete('biz1', 'loc1');

      expect(prisma.location.update).toHaveBeenCalledWith({
        where: { id: 'loc1' },
        data: { isActive: false },
      });
    });
  });

  // ---- Resources ----

  describe('findResources', () => {
    it('returns active resources for a location', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      const resources = [{ id: 'r1', name: 'Bay 1' }, { id: 'r2', name: 'Bay 2' }];
      prisma.resource.findMany.mockResolvedValue(resources as any);

      const result = await service.findResources('biz1', 'loc1');

      expect(result).toEqual(resources);
      expect(prisma.resource.findMany).toHaveBeenCalledWith({
        where: { locationId: 'loc1', isActive: true },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('createResource', () => {
    it('creates a resource', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      const resource = { id: 'r1', name: 'Bay 1', type: 'service_bay', locationId: 'loc1' };
      prisma.resource.create.mockResolvedValue(resource as any);

      const result = await service.createResource('biz1', 'loc1', { name: 'Bay 1', type: 'service_bay' });

      expect(result).toEqual(resource);
    });

    it('throws if location not found', async () => {
      prisma.location.findFirst.mockResolvedValue(null);

      await expect(
        service.createResource('biz1', 'nope', { name: 'Bay 1', type: 'service_bay' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateResource', () => {
    it('updates a resource', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.resource.findFirst.mockResolvedValue({ id: 'r1', locationId: 'loc1' } as any);
      prisma.resource.update.mockResolvedValue({ id: 'r1', name: 'Bay 1 Updated' } as any);

      const result = await service.updateResource('biz1', 'loc1', 'r1', { name: 'Bay 1 Updated' });

      expect(result.name).toBe('Bay 1 Updated');
    });

    it('throws if resource not found', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.resource.findFirst.mockResolvedValue(null);

      await expect(
        service.updateResource('biz1', 'loc1', 'nope', { name: 'X' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('softDeleteResource', () => {
    it('sets resource isActive to false', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.resource.findFirst.mockResolvedValue({ id: 'r1', locationId: 'loc1' } as any);
      prisma.resource.update.mockResolvedValue({ id: 'r1', isActive: false } as any);

      await service.softDeleteResource('biz1', 'loc1', 'r1');

      expect(prisma.resource.update).toHaveBeenCalledWith({
        where: { id: 'r1' },
        data: { isActive: false },
      });
    });
  });

  // ---- Staff Assignments ----

  describe('assignStaff', () => {
    it('creates staff-location assignment', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 's1', businessId: 'biz1' } as any);
      const assignment = { id: 'sl1', staffId: 's1', locationId: 'loc1', staff: { id: 's1', name: 'Alex', role: 'AGENT' } };
      prisma.staffLocation.create.mockResolvedValue(assignment as any);

      const result = await service.assignStaff('biz1', 'loc1', 's1');

      expect(result).toEqual(assignment);
    });

    it('throws if staff not in business', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.staff.findFirst.mockResolvedValue(null);

      await expect(service.assignStaff('biz1', 'loc1', 's999')).rejects.toThrow(BadRequestException);
    });

    it('throws if already assigned (P2002)', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.staff.findFirst.mockResolvedValue({ id: 's1', businessId: 'biz1' } as any);
      prisma.staffLocation.create.mockRejectedValue({ code: 'P2002' });

      await expect(service.assignStaff('biz1', 'loc1', 's1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('unassignStaff', () => {
    it('deletes staff-location assignment', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.staffLocation.findUnique.mockResolvedValue({ id: 'sl1', staffId: 's1', locationId: 'loc1' } as any);
      prisma.staffLocation.delete.mockResolvedValue({} as any);

      await service.unassignStaff('biz1', 'loc1', 's1');

      expect(prisma.staffLocation.delete).toHaveBeenCalledWith({
        where: { staffId_locationId: { staffId: 's1', locationId: 'loc1' } },
      });
    });

    it('throws if not assigned', async () => {
      prisma.location.findFirst.mockResolvedValue({ id: 'loc1', businessId: 'biz1' } as any);
      prisma.staffLocation.findUnique.mockResolvedValue(null);

      await expect(service.unassignStaff('biz1', 'loc1', 's1')).rejects.toThrow(NotFoundException);
    });
  });

  // ---- Utility ----

  describe('getStaffForLocation', () => {
    it('returns active staff assigned to location', async () => {
      prisma.staffLocation.findMany.mockResolvedValue([
        { staff: { id: 's1', name: 'Alice', role: 'AGENT', isActive: true } },
        { staff: { id: 's2', name: 'Bob', role: 'SERVICE_PROVIDER', isActive: false } },
      ] as any);

      const result = await service.getStaffForLocation('loc1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('s1');
    });
  });

  describe('findLocationByWhatsappPhoneNumberId', () => {
    it('finds location matching phoneNumberId', async () => {
      prisma.location.findMany.mockResolvedValue([
        { id: 'loc1', whatsappConfig: { phoneNumberId: 'phone_001' }, isActive: true },
        { id: 'loc2', whatsappConfig: { phoneNumberId: 'phone_002' }, isActive: true },
      ] as any);

      const result = await service.findLocationByWhatsappPhoneNumberId('phone_002');

      expect(result?.id).toBe('loc2');
    });

    it('returns undefined when no match', async () => {
      prisma.location.findMany.mockResolvedValue([
        { id: 'loc1', whatsappConfig: { phoneNumberId: 'phone_001' }, isActive: true },
      ] as any);

      const result = await service.findLocationByWhatsappPhoneNumberId('phone_999');

      expect(result).toBeUndefined();
    });

    it('handles locations without whatsappConfig', async () => {
      prisma.location.findMany.mockResolvedValue([
        { id: 'loc1', whatsappConfig: null, isActive: true },
      ] as any);

      const result = await service.findLocationByWhatsappPhoneNumberId('phone_001');

      expect(result).toBeUndefined();
    });
  });
});
