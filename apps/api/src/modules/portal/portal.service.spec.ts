import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PrismaService } from '../../common/prisma.service';
import { BookingService } from '../booking/booking.service';
import { createMockPrisma } from '../../test/mocks';

describe('PortalService', () => {
  let service: PortalService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const mockCustomer = {
    id: 'cust1',
    businessId: 'biz1',
    name: 'Jane Doe',
    email: 'jane@test.com',
    phone: '+1234567890',
    customFields: { notifyWhatsApp: true },
    createdAt: new Date('2025-06-15'),
  };

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        PortalService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: BookingService,
          useValue: {
            checkPolicyAllowed: jest.fn().mockResolvedValue({ allowed: true }),
            updateStatus: jest.fn().mockResolvedValue({ id: 'b1', status: 'CANCELLED' }),
          },
        },
      ],
    }).compile();

    service = module.get(PortalService);
  });

  describe('getProfile', () => {
    it('returns customer profile with stats', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.booking.count as jest.Mock).mockResolvedValue(12);
      (prisma.booking.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: 450 },
      });

      const result = await service.getProfile('cust1', 'biz1');

      expect(result.name).toBe('Jane Doe');
      expect(result.totalBookings).toBe(12);
      expect(result.totalSpent).toBe(450);
      expect(result.memberSince).toEqual(new Date('2025-06-15'));
    });

    it('returns 0 for totalSpent when no completed bookings', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.booking.count as jest.Mock).mockResolvedValue(0);
      (prisma.booking.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: null },
      });

      const result = await service.getProfile('cust1', 'biz1');
      expect(result.totalSpent).toBe(0);
    });

    it('throws if customer not found', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.getProfile('bad-id', 'biz1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateProfile', () => {
    it('updates allowed fields', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.customer.update as jest.Mock).mockResolvedValue({
        ...mockCustomer,
        name: 'Jane Smith',
      });

      await service.updateProfile('cust1', 'biz1', { name: 'Jane Smith' });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust1' },
        data: { name: 'Jane Smith' },
      });
    });

    it('updates notification preferences', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.customer.update as jest.Mock).mockResolvedValue(mockCustomer);

      await service.updateProfile('cust1', 'biz1', {
        notifyWhatsApp: false,
        notifyEmail: true,
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust1' },
        data: {
          customFields: {
            notifyWhatsApp: false,
            notifyEmail: true,
          },
        },
      });
    });

    it('throws if customer not found', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.updateProfile('bad-id', 'biz1', { name: 'Test' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getBookings', () => {
    it('returns paginated bookings', async () => {
      const mockBookings = [{ id: 'b1', status: 'COMPLETED' }];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(mockBookings);
      (prisma.booking.count as jest.Mock).mockResolvedValue(25);

      const result = await service.getBookings('cust1', 'biz1', { page: 2 });

      expect(result.data).toEqual(mockBookings);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.pageSize).toBe(10);

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });

    it('filters by status', async () => {
      (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.booking.count as jest.Mock).mockResolvedValue(0);

      await service.getBookings('cust1', 'biz1', { status: 'COMPLETED' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { customerId: 'cust1', businessId: 'biz1', status: 'COMPLETED' },
        }),
      );
    });
  });

  describe('getUpcoming', () => {
    it('returns only future bookings with correct statuses', async () => {
      const futureBookings = [{ id: 'b1', startTime: new Date('2027-01-15'), status: 'CONFIRMED' }];
      (prisma.booking.findMany as jest.Mock).mockResolvedValue(futureBookings);

      const result = await service.getUpcoming('cust1', 'biz1');

      expect(result).toEqual(futureBookings);
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust1',
            businessId: 'biz1',
            status: { in: ['PENDING', 'CONFIRMED'] },
          }),
          take: 5,
          orderBy: { startTime: 'asc' },
        }),
      );
    });
  });
});
