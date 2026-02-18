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
      providers: [WaitlistService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(WaitlistService);
  });

  describe('joinWaitlist', () => {
    it('should create a waitlist entry', async () => {
      prisma.service.findFirst.mockResolvedValue({
        id: 'svc1',
        businessId: 'biz1',
        isActive: true,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue(null);
      prisma.waitlistEntry.create.mockResolvedValue({
        id: 'wl1',
        businessId: 'biz1',
        customerId: 'cust1',
        serviceId: 'svc1',
        status: 'ACTIVE',
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
        id: 'svc1',
        businessId: 'biz1',
        isActive: true,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        id: 'existing',
        status: 'ACTIVE',
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
      prisma.waitlistEntry.findMany.mockResolvedValue([{ id: 'wl1', status: 'ACTIVE' }] as any);

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
        id: 'wl1',
        status: 'ACTIVE',
      } as any);
      prisma.waitlistEntry.update.mockResolvedValue({
        id: 'wl1',
        status: 'CANCELLED',
      } as any);

      const result = await service.cancelEntry('biz1', 'wl1');
      expect(result.status).toBe('CANCELLED');
    });

    it('should reject cancelling a booked entry', async () => {
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        id: 'wl1',
        status: 'BOOKED',
      } as any);

      await expect(service.cancelEntry('biz1', 'wl1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resolveEntry', () => {
    it('should resolve an entry with booking', async () => {
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        id: 'wl1',
        status: 'OFFERED',
      } as any);
      prisma.waitlistEntry.update.mockResolvedValue({
        id: 'wl1',
        status: 'BOOKED',
        bookingId: 'book1',
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

  describe('offerOpenSlot', () => {
    const booking = {
      id: 'book1',
      businessId: 'biz1',
      serviceId: 'svc1',
      staffId: 'staff1',
      startTime: new Date('2026-03-15T10:00:00Z'),
      service: { name: 'Botox' },
      staff: { name: 'Dr. Chen' },
    };

    it('should offer slot to matching waitlist entries', async () => {
      // Mock Date to 14:00 UTC so we never hit quiet hours in any timezone
      const realDate = Date;
      const mockDate = new Date('2026-03-15T14:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) return mockDate;
        return new (realDate as any)(...args);
      });
      (Date as any).now = () => mockDate.getTime();

      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: {
          waitlist: { offerCount: 2, expiryMinutes: 15, quietStart: '23:00', quietEnd: '06:00' },
        },
      } as any);
      prisma.waitlistEntry.findMany.mockResolvedValue([
        {
          id: 'wl1',
          customerId: 'c1',
          customer: { id: 'c1', name: 'Alice', phone: '+1', email: 'a@b.com' },
          service: { name: 'Botox' },
        },
        {
          id: 'wl2',
          customerId: 'c2',
          customer: { id: 'c2', name: 'Bob', phone: '+2', email: 'b@b.com' },
          service: { name: 'Botox' },
        },
      ] as any);
      prisma.waitlistEntry.update.mockResolvedValue({} as any);

      await service.offerOpenSlot(booking);

      expect(prisma.waitlistEntry.update).toHaveBeenCalledTimes(2);
      expect(prisma.waitlistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'wl1' },
          data: expect.objectContaining({ status: 'OFFERED' }),
        }),
      );

      jest.restoreAllMocks();
    });

    it('should skip offers during quiet hours', async () => {
      // Mock Date to be during quiet hours (22:00)
      const realDate = Date;
      const mockDate = new Date('2026-03-15T22:00:00');
      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) return mockDate;
        return new (realDate as any)(...args);
      });
      (Date as any).now = () => mockDate.getTime();

      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: { waitlist: { quietStart: '21:00', quietEnd: '09:00' } },
      } as any);

      await service.offerOpenSlot(booking);

      expect(prisma.waitlistEntry.findMany).not.toHaveBeenCalled();

      jest.restoreAllMocks();
    });

    it('should not offer if no matching entries', async () => {
      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: { waitlist: { quietStart: '23:00', quietEnd: '06:00' } },
      } as any);
      prisma.waitlistEntry.findMany.mockResolvedValue([]);

      await service.offerOpenSlot(booking);

      expect(prisma.waitlistEntry.update).not.toHaveBeenCalled();
    });

    it('should continue offering to remaining entries when one update fails', async () => {
      const realDate = Date;
      const mockDate = new Date('2026-03-15T14:00:00Z');
      jest.spyOn(global, 'Date').mockImplementation((...args: any[]) => {
        if (args.length === 0) return mockDate;
        return new (realDate as any)(...args);
      });
      (Date as any).now = () => mockDate.getTime();

      prisma.business.findUnique.mockResolvedValue({
        id: 'biz1',
        packConfig: {
          waitlist: { offerCount: 3, expiryMinutes: 15, quietStart: '23:00', quietEnd: '06:00' },
        },
      } as any);
      prisma.waitlistEntry.findMany.mockResolvedValue([
        { id: 'wl1', customerId: 'c1', customer: { id: 'c1' }, service: { name: 'Botox' } },
        { id: 'wl2', customerId: 'c2', customer: { id: 'c2' }, service: { name: 'Botox' } },
        { id: 'wl3', customerId: 'c3', customer: { id: 'c3' }, service: { name: 'Botox' } },
      ] as any);

      prisma.waitlistEntry.update
        .mockResolvedValueOnce({} as any) // wl1 succeeds
        .mockRejectedValueOnce(new Error('DB error')) // wl2 fails
        .mockResolvedValueOnce({} as any); // wl3 succeeds

      await service.offerOpenSlot(booking);

      expect(prisma.waitlistEntry.update).toHaveBeenCalledTimes(3);
      expect(prisma.waitlistEntry.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'wl3' } }),
      );

      jest.restoreAllMocks();
    });
  });

  describe('getMetrics', () => {
    it('should return waitlist metrics', async () => {
      prisma.waitlistEntry.count
        .mockResolvedValueOnce(10 as any) // totalEntries
        .mockResolvedValueOnce(6 as any) // offeredCount
        .mockResolvedValueOnce(4 as any); // claimedCount
      prisma.booking.count.mockResolvedValue(8 as any);
      prisma.waitlistEntry.findMany.mockResolvedValue([
        {
          offeredAt: new Date('2026-03-01T10:00:00Z'),
          claimedAt: new Date('2026-03-01T10:05:00Z'),
        },
        {
          offeredAt: new Date('2026-03-02T14:00:00Z'),
          claimedAt: new Date('2026-03-02T14:10:00Z'),
        },
      ] as any);

      const metrics = await service.getMetrics('biz1', 30);

      expect(metrics.totalEntries).toBe(10);
      expect(metrics.offers).toBe(6);
      expect(metrics.claimed).toBe(4);
      expect(metrics.cancellations).toBe(8);
      expect(metrics.fillRate).toBe(67); // 4/6 ≈ 67%
      expect(metrics.avgTimeToFill).toBe(8); // avg(5,10) = 7.5 → 8 rounded
    });

    it('should return zero fill rate when no offers', async () => {
      prisma.waitlistEntry.count
        .mockResolvedValueOnce(0 as any)
        .mockResolvedValueOnce(0 as any)
        .mockResolvedValueOnce(0 as any);
      prisma.booking.count.mockResolvedValue(0 as any);
      prisma.waitlistEntry.findMany.mockResolvedValue([]);

      const metrics = await service.getMetrics('biz1', 30);

      expect(metrics.fillRate).toBe(0);
      expect(metrics.avgTimeToFill).toBe(0);
    });
  });

  describe('expireStaleOffers', () => {
    it('should expire offers past their expiry time', async () => {
      prisma.waitlistEntry.updateMany.mockResolvedValue({ count: 3 } as any);

      await service.expireStaleOffers();

      expect(prisma.waitlistEntry.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'OFFERED',
            offerExpiresAt: expect.objectContaining({ lt: expect.any(Date) }),
          }),
          data: { status: 'EXPIRED' },
        }),
      );
    });

    it('should not throw when database fails', async () => {
      prisma.waitlistEntry.updateMany.mockRejectedValue(new Error('DB connection lost'));

      await expect(service.expireStaleOffers()).resolves.not.toThrow();
    });
  });
});
