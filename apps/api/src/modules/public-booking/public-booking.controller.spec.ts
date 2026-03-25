import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PublicBookingController } from './public-booking.controller';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('PublicBookingController', () => {
  let controller: PublicBookingController;
  let prisma: MockPrisma;
  let availabilityService: any;
  let customerService: any;
  let bookingService: any;
  let configService: any;

  const mockBusiness = {
    id: 'biz1',
    name: 'Glow Clinic',
    slug: 'glow-clinic',
    timezone: 'America/New_York',
  };
  const mockService = {
    id: 'svc1',
    name: 'Botox',
    description: 'Anti-wrinkle treatment',
    durationMins: 30,
    price: 200,
    category: 'Aesthetic',
    depositRequired: false,
    depositAmount: null,
    isActive: true,
  };
  const mockCustomer = {
    id: 'cust1',
    name: 'Jane',
    phone: '+1234567890',
    email: null,
    businessId: 'biz1',
  };
  const mockBooking = {
    id: 'book1',
    status: 'CONFIRMED',
    startTime: new Date('2026-03-01T10:00:00Z'),
    service: { name: 'Botox', depositRequired: false, depositAmount: null, price: 200 },
    staff: { name: 'Dr. Sarah' },
  };

  let waitlistService: any;

  beforeEach(() => {
    prisma = createMockPrisma();
    availabilityService = { getAvailableSlots: jest.fn() };
    customerService = { findOrCreateByPhone: jest.fn() };
    bookingService = { create: jest.fn() };
    waitlistService = { joinWaitlist: jest.fn() };
    configService = { get: jest.fn().mockReturnValue(undefined) };

    controller = new PublicBookingController(
      prisma as any,
      availabilityService,
      customerService,
      bookingService,
      waitlistService,
      configService,
    );
  });

  describe('getBusiness', () => {
    it('returns business info by slug with empty policy text by default', async () => {
      prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
      prisma.subscription.findFirst.mockResolvedValue(null);
      const result = await controller.getBusiness('glow-clinic');
      expect(result).toEqual({
        name: 'Glow Clinic',
        slug: 'glow-clinic',
        timezone: 'America/New_York',
        cancellationPolicyText: '',
        reschedulePolicyText: '',
        whiteLabel: false,
        paymentEnabled: false,
        logoUrl: null,
        brandPrimaryColor: '#71907C',
        brandTagline: '',
      });
    });

    it('returns policy text when policySettings has text', async () => {
      prisma.business.findFirst.mockResolvedValue({
        ...mockBusiness,
        policySettings: {
          cancellationPolicyText: 'No cancellations within 24h',
          reschedulePolicyText: 'No reschedules within 24h',
        },
      } as any);
      prisma.subscription.findFirst.mockResolvedValue(null);
      const result = await controller.getBusiness('glow-clinic');
      expect(result.cancellationPolicyText).toBe('No cancellations within 24h');
      expect(result.reschedulePolicyText).toBe('No reschedules within 24h');
    });

    it('throws 404 for invalid slug with no fuzzy matches', async () => {
      prisma.business.findFirst.mockResolvedValue(null);
      prisma.business.findMany.mockResolvedValue([]);
      await expect(controller.getBusiness('not-real')).rejects.toThrow(NotFoundException);
    });

    it('resolves slug via startsWith fallback when exact match fails', async () => {
      prisma.business.findFirst.mockResolvedValueOnce(null); // exact match fails
      prisma.business.findMany.mockResolvedValue([mockBusiness] as any); // startsWith finds one
      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await controller.getBusiness('glow');
      expect(result.slug).toBe('glow-clinic');
    });

    it('throws 404 when startsWith returns multiple candidates', async () => {
      prisma.business.findFirst.mockResolvedValue(null);
      prisma.business.findMany.mockResolvedValue([
        { ...mockBusiness, id: 'biz1' },
        { ...mockBusiness, id: 'biz2', slug: 'glow-spa' },
      ] as any);
      await expect(controller.getBusiness('glow')).rejects.toThrow(NotFoundException);
    });

    it('resolves slug with common suffix stripped (e.g. -clinic)', async () => {
      prisma.business.findFirst
        .mockResolvedValueOnce(null) // exact match fails
        .mockResolvedValueOnce(mockBusiness as any); // stripped match
      prisma.business.findMany.mockResolvedValue([]); // startsWith returns nothing

      prisma.subscription.findFirst.mockResolvedValue(null);

      const result = await controller.getBusiness('glow-clinic-clinic');
      // After stripping "-clinic", tries startsWith "glow-clinic" which matches
      expect(result.slug).toBe('glow-clinic');
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
        {
          time: '2026-03-01T10:00:00Z',
          display: '10:00',
          staffId: 's1',
          staffName: 'Sarah',
          available: true,
        },
        {
          time: '2026-03-01T10:30:00Z',
          display: '10:30',
          staffId: 's1',
          staffName: 'Sarah',
          available: false,
        },
        {
          time: '2026-03-01T11:00:00Z',
          display: '11:00',
          staffId: 's1',
          staffName: 'Sarah',
          available: true,
        },
      ]);

      const result = await controller.getAvailability('glow-clinic', '2026-03-01', 'svc1');
      expect(result).toHaveLength(2);
      expect(result.every((s: any) => s.available)).toBe(true);
    });

    it('throws if date or serviceId missing', async () => {
      await expect(controller.getAvailability('glow-clinic', '', 'svc1')).rejects.toThrow(
        BadRequestException,
      );
      await expect(controller.getAvailability('glow-clinic', '2026-03-01', '')).rejects.toThrow(
        BadRequestException,
      );
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

      expect(customerService.findOrCreateByPhone).toHaveBeenCalledWith(
        'biz1',
        '+1234567890',
        'Jane',
      );
      expect(bookingService.create).toHaveBeenCalledWith(
        'biz1',
        expect.objectContaining({
          customerId: 'cust1',
          serviceId: 'svc1',
          startTime: '2026-03-01T10:00:00Z',
          source: 'PORTAL',
        }),
      );
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

    it('creates payment record when paymentIntentId is provided', async () => {
      prisma.business.findFirst.mockResolvedValue(mockBusiness as any);
      customerService.findOrCreateByPhone.mockResolvedValue(mockCustomer);
      bookingService.create.mockResolvedValue({
        ...mockBooking,
        status: 'PENDING_DEPOSIT',
        service: { ...mockBooking.service, depositRequired: true, depositAmount: 50 },
      });

      const result = await controller.createBooking('glow-clinic', {
        serviceId: 'svc1',
        startTime: '2026-03-01T10:00:00Z',
        customerName: 'Jane',
        customerPhone: '+1234567890',
        paymentIntentId: 'pi_test_123',
      });

      expect(prisma.payment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          bookingId: 'book1',
          stripePaymentIntentId: 'pi_test_123',
          method: 'STRIPE',
          status: 'COMPLETED',
        }),
      });
      expect(result.status).toBe('CONFIRMED');
      expect(result.depositRequired).toBe(false);
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

  describe('createPaymentIntent', () => {
    it('throws when Stripe is not configured', async () => {
      await expect(
        controller.createPaymentIntent('glow-clinic', { serviceId: 'svc1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws when serviceId is missing', async () => {
      // Create controller with Stripe configured
      configService.get.mockReturnValue('sk_test_123');
      const stripeController = new PublicBookingController(
        prisma as any,
        availabilityService,
        customerService,
        bookingService,
        waitlistService,
        configService,
      );

      await expect(
        stripeController.createPaymentIntent('glow-clinic', { serviceId: '' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReferralInfo', () => {
    it('returns credit amount and business name for valid code', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        name: 'Jane Doe',
        business: { name: 'Acme Corp', packConfig: { referral: { refereeCredit: 75 } } },
      } as any);

      const result = await controller.getReferralInfo('VALIDCODE');
      expect(result).toEqual({
        creditAmount: 75,
        businessName: 'Acme Corp',
        referrerName: 'Jane Doe',
      });
    });

    it('returns default credit amount when no packConfig.referral', async () => {
      prisma.customer.findFirst.mockResolvedValue({
        name: 'John Smith',
        business: { name: 'Beta Corp', packConfig: {} },
      } as any);

      const result = await controller.getReferralInfo('CODE2');
      expect(result).toEqual({
        creditAmount: 25,
        businessName: 'Beta Corp',
        referrerName: 'John Smith',
      });
    });

    it('throws NotFoundException for invalid code', async () => {
      prisma.customer.findFirst.mockResolvedValue(null);
      await expect(controller.getReferralInfo('INVALID')).rejects.toThrow();
    });

    it('throws BadRequestException when no code provided', async () => {
      await expect(controller.getReferralInfo('')).rejects.toThrow();
    });
  });
});
