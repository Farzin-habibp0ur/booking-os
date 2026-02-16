import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PublicBookingController } from './public-booking.controller';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('PublicBookingController', () => {
  let controller: PublicBookingController;
  let prisma: MockPrisma;
  let availabilityService: any;
  let customerService: any;
  let bookingService: any;

  const mockBusiness = { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic', timezone: 'America/New_York' };
  const mockService = { id: 'svc1', name: 'Botox', description: 'Anti-wrinkle treatment', durationMins: 30, price: 200, category: 'Aesthetic' };
  const mockCustomer = { id: 'cust1', name: 'Jane', phone: '+1234567890', email: null, businessId: 'biz1' };
  const mockBooking = {
    id: 'book1',
    startTime: new Date('2026-03-01T10:00:00Z'),
    service: { name: 'Botox' },
    staff: { name: 'Dr. Sarah' },
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    availabilityService = { getAvailableSlots: jest.fn() };
    customerService = { findOrCreateByPhone: jest.fn() };
    bookingService = { create: jest.fn() };

    controller = new PublicBookingController(
      prisma as any,
      availabilityService,
      customerService,
      bookingService,
    );
  });

  describe('getBusiness', () => {
    it('returns business info by slug', async () => {
      prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
      const result = await controller.getBusiness('glow-clinic');
      expect(result).toEqual({ name: 'Glow Clinic', slug: 'glow-clinic', timezone: 'America/New_York' });
    });

    it('throws 404 for invalid slug', async () => {
      prisma.business.findFirst.mockResolvedValue(null);
      await expect(controller.getBusiness('not-real')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getServices', () => {
    it('returns only active services', async () => {
      prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
      prisma.service.findMany.mockResolvedValue([mockService] as any);

      const result = await controller.getServices('glow-clinic');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Botox');
      expect(prisma.service.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1', isActive: true } }),
      );
    });
  });

  describe('getAvailability', () => {
    it('returns available slots for a date', async () => {
      prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
      availabilityService.getAvailableSlots.mockResolvedValue([
        { time: '2026-03-01T10:00:00Z', display: '10:00', staffId: 's1', staffName: 'Sarah', available: true },
        { time: '2026-03-01T10:30:00Z', display: '10:30', staffId: 's1', staffName: 'Sarah', available: false },
        { time: '2026-03-01T11:00:00Z', display: '11:00', staffId: 's1', staffName: 'Sarah', available: true },
      ]);

      const result = await controller.getAvailability('glow-clinic', '2026-03-01', 'svc1');
      expect(result).toHaveLength(2);
      expect(result.every((s: any) => s.available)).toBe(true);
    });

    it('throws if date or serviceId missing', async () => {
      await expect(controller.getAvailability('glow-clinic', '', 'svc1')).rejects.toThrow(BadRequestException);
      await expect(controller.getAvailability('glow-clinic', '2026-03-01', '')).rejects.toThrow(BadRequestException);
    });
  });

  describe('createBooking', () => {
    it('creates booking with new customer', async () => {
      prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
      customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
      bookingService.create.mockResolvedValue(mockBooking);

      const result = await controller.createBooking('glow-clinic', {
        serviceId: 'svc1',
        startTime: '2026-03-01T10:00:00Z',
        customerName: 'Jane',
        customerPhone: '+1234567890',
      });

      expect(customerService.findOrCreateByPhone).toHaveBeenCalledWith('biz1', '+1234567890', 'Jane');
      expect(bookingService.create).toHaveBeenCalledWith('biz1', {
        customerId: 'cust1',
        serviceId: 'svc1',
        staffId: undefined,
        startTime: '2026-03-01T10:00:00Z',
      });
      expect(result.id).toBe('book1');
      expect(result.businessName).toBe('Glow Clinic');
    });

    it('creates booking with existing customer (by phone)', async () => {
      prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
      const existingCustomer = { ...mockCustomer, email: 'jane@example.com' };
      customerService.findOrCreateByPhone.mockResolvedValue(existingCustomer);
      bookingService.create.mockResolvedValue(mockBooking);

      await controller.createBooking('glow-clinic', {
        serviceId: 'svc1',
        startTime: '2026-03-01T10:00:00Z',
        customerName: 'Jane',
        customerPhone: '+1234567890',
        customerEmail: 'newemail@example.com',
      });

      // Should NOT update email since customer already has one
      expect(prisma.customer.update).not.toHaveBeenCalled();
    });

    it('updates customer email if not set', async () => {
      prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
      customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
      bookingService.create.mockResolvedValue(mockBooking);

      await controller.createBooking('glow-clinic', {
        serviceId: 'svc1',
        startTime: '2026-03-01T10:00:00Z',
        customerName: 'Jane',
        customerPhone: '+1234567890',
        customerEmail: 'jane@example.com',
      });

      expect(prisma.customer.update).toHaveBeenCalledWith({
        where: { id: 'cust1' },
        data: { email: 'jane@example.com' },
      });
    });

    it('rejects booking with missing required fields', async () => {
      await expect(
        controller.createBooking('glow-clinic', {
          serviceId: '',
          startTime: '2026-03-01T10:00:00Z',
          customerName: 'Jane',
          customerPhone: '+1234567890',
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.createBooking('glow-clinic', {
          serviceId: 'svc1',
          startTime: '2026-03-01T10:00:00Z',
          customerName: '',
          customerPhone: '+1234567890',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
