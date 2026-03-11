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

  describe('getServices', () => {
    it('returns active services for the business', async () => {
      const mockServices = [
        { id: 's1', name: 'Haircut', price: 30, durationMins: 30, isActive: true },
        { id: 's2', name: 'Massage', price: 80, durationMins: 60, isActive: true },
      ];
      (prisma.service.findMany as jest.Mock).mockResolvedValue(mockServices);

      const result = await service.getServices('biz1');

      expect(result).toEqual(mockServices);
      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            isActive: true,
          }),
        }),
      );
    });
  });

  describe('createBooking', () => {
    const createDto = {
      serviceId: 's1',
      staffId: 'staff1',
      startTime: '2027-01-15T10:00:00Z',
      notes: 'First visit',
    };

    it('creates a booking with PORTAL source', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.service.findFirst as jest.Mock).mockResolvedValue({
        id: 's1',
        name: 'Haircut',
        durationMins: 30,
        businessId: 'biz1',
      });
      (prisma.staff.findFirst as jest.Mock).mockResolvedValue({
        id: 'staff1',
        name: 'Dr. Smith',
        businessId: 'biz1',
        isActive: true,
      });
      const mockBooking = { id: 'b1', source: 'PORTAL', status: 'PENDING' };
      (prisma.booking.create as jest.Mock).mockResolvedValue(mockBooking);

      const result = await service.createBooking('cust1', 'biz1', createDto);

      expect(result).toEqual(mockBooking);
      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            source: 'PORTAL',
            customerId: 'cust1',
            businessId: 'biz1',
            serviceId: 's1',
          }),
        }),
      );
      // Verify endTime = startTime + durationMins
      const callData = (prisma.booking.create as jest.Mock).mock.calls[0][0].data;
      const start = new Date(callData.startTime);
      const end = new Date(callData.endTime);
      expect(end.getTime() - start.getTime()).toBe(30 * 60000);
    });

    it('throws NotFoundException when customer not found', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.createBooking('bad-id', 'biz1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws NotFoundException when service not found', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.createBooking('cust1', 'biz1', createDto)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDocuments', () => {
    it('returns intake data and booking notes', async () => {
      const customerWithIntake = {
        ...mockCustomer,
        customFields: {
          intakeComplete: true,
          intakeFullName: 'Jane Doe',
          intakeMedications: 'Ibuprofen',
          intakeSubmittedAt: '2027-01-05',
        },
      };
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(customerWithIntake);
      (prisma.booking.findMany as jest.Mock).mockResolvedValue([
        { id: 'b1', notes: 'Follow-up needed', startTime: new Date('2027-01-10'), service: { name: 'Consult' }, staff: { name: 'Dr. Smith' } },
        { id: 'b2', notes: 'All clear', startTime: new Date('2027-01-12'), service: { name: 'Treatment' }, staff: null },
      ]);

      const result = await service.getDocuments('cust1', 'biz1');

      expect(result.intake).toBeTruthy();
      expect(result.intake!.fullName).toBe('Jane Doe');
      expect(result.intake!.medications).toBe('Ibuprofen');
      expect(result.bookingNotes).toHaveLength(2);
      expect(result.bookingNotes[0].service).toBe('Consult');
    });

    it('returns null intake when intakeComplete is false', async () => {
      const customerNoIntake = {
        ...mockCustomer,
        customFields: { intakeComplete: false },
      };
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(customerNoIntake);
      (prisma.booking.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getDocuments('cust1', 'biz1');

      expect(result.intake).toBeNull();
    });
  });

  describe('createInvoicePaymentSession', () => {
    it('throws NotFoundException when invoice not found', async () => {
      (prisma.invoice.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createInvoicePaymentSession('cust1', 'biz1', 'inv-bad'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
