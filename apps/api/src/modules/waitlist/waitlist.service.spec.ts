import { Test } from '@nestjs/testing';
import { WaitlistService } from './waitlist.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('WaitlistService', () => {
  let service: WaitlistService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        WaitlistService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(WaitlistService);
  });

  describe('joinWaitlist', () => {
    it('should create a waitlist entry', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1', businessId: 'biz1', isActive: true,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue(null);
      prisma.waitlistEntry.create.mockResolvedValue({
        id: 'wl1', businessId: 'biz1', customerId: 'cust1',
        serviceId: 'svc1', status: 'ACTIVE',
      } as any);

      const result = await service.joinWaitlist({
        businessId: 'biz1',
        customerId: 'cust1',
        serviceId: 'svc1',
        notes: 'Morning preferred',
      });

      expect(result.id).toBe('wl1');
      expect(prisma.waitlistEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            customerId: 'cust1',
            serviceId: 'svc1',
          }),
        }),
      );
    });

    it('should reject duplicate active entries', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1', businessId: 'biz1', isActive: true,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        id: 'existing', status: 'ACTIVE',
      } as any);

      await expect(
        service.joinWaitlist({ businessId: 'biz1', customerId: 'cust1', serviceId: 'svc1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if service not found', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        service.joinWaitlist({ businessId: 'biz1', customerId: 'cust1', serviceId: 'bad' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEntries', () => {
    it('should return entries with filters', async () => {
      prisma.waitlistEntry.findMany.mockResolvedValue([
        { id: 'wl1', status: 'ACTIVE' },
      ] as any);

      const result = await service.getEntries('biz1', { status: 'ACTIVE' });

      expect(result).toHaveLength(1);
      expect(prisma.waitlistEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', status: 'ACTIVE' },
        }),
      );
    });
  });

  describe('cancelEntry', () => {
    it('should cancel an active entry', async () => {
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        id: 'wl1', status: 'ACTIVE',
      } as any);
      prisma.waitlistEntry.update.mockResolvedValue({
        id: 'wl1', status: 'CANCELLED',
      } as any);

      const result = await service.cancelEntry('biz1', 'wl1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should reject cancelling a booked entry', async () => {
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        id: 'wl1', status: 'BOOKED',
      } as any);

      await expect(service.cancelEntry('biz1', 'wl1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveEntry', () => {
    it('should resolve an entry with booking', async () => {
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        id: 'wl1', status: 'OFFERED',
      } as any);
      prisma.waitlistEntry.update.mockResolvedValue({
        id: 'wl1', status: 'BOOKED', bookingId: 'book1',
      } as any);

      const result = await service.resolveEntry('biz1', 'wl1', 'book1');
      expect(result.status).toBe('BOOKED');
      expect(result.bookingId).toBe('book1');
    });

    it('should throw if entry not found', async () => {
      prisma.waitlistEntry.findFirst.mockResolvedValue(null);

      await expect(service.resolveEntry('biz1', 'bad', 'book1')).rejects.toThrow(NotFoundException);
    });
  });
});
