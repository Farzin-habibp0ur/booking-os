import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SelfServeService } from './self-serve.service';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { AvailabilityService } from '../availability/availability.service';
import { BookingService } from '../booking/booking.service';
import { BusinessService } from '../business/business.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import {
  createMockPrisma,
  createMockTokenService,
  createMockAvailabilityService,
  createMockBusinessService,
  createMockWaitlistService,
} from '../../test/mocks';

describe('SelfServeService', () => {
  let service: SelfServeService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockTokenService: ReturnType<typeof createMockTokenService>;
  let mockAvailabilityService: ReturnType<typeof createMockAvailabilityService>;
  let mockBusinessService: ReturnType<typeof createMockBusinessService>;
  let mockWaitlistService: ReturnType<typeof createMockWaitlistService>;
  let mockBookingService: any;

  const mockBooking = {
    id: 'b1',
    businessId: 'biz1',
    serviceId: 'svc1',
    staffId: 'staff1',
    status: 'CONFIRMED',
    startTime: new Date('2026-03-01T10:00:00Z'),
    endTime: new Date('2026-03-01T11:00:00Z'),
    customFields: {},
    customer: { id: 'cust1', name: 'Jane Doe', phone: '+1234567890', email: 'jane@test.com' },
    service: { id: 'svc1', name: 'Botox', durationMins: 60, price: 200 },
    staff: { id: 'staff1', name: 'Dr. Chen' },
    business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic', policySettings: {} },
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockTokenService = createMockTokenService();
    mockAvailabilityService = createMockAvailabilityService();
    mockBusinessService = createMockBusinessService();
    mockWaitlistService = createMockWaitlistService();
    mockBookingService = {
      checkPolicyAllowed: jest.fn().mockResolvedValue({ allowed: true }),
      update: jest
        .fn()
        .mockResolvedValue({ ...mockBooking, startTime: new Date('2026-03-02T14:00:00Z') }),
      updateStatus: jest.fn().mockResolvedValue({ ...mockBooking, status: 'CANCELLED' }),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'newbook1', businessId: 'biz1', status: 'CONFIRMED' }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SelfServeService,
        { provide: PrismaService, useValue: prisma },
        { provide: TokenService, useValue: mockTokenService },
        { provide: AvailabilityService, useValue: mockAvailabilityService },
        { provide: BookingService, useValue: mockBookingService },
        { provide: BusinessService, useValue: mockBusinessService },
        { provide: WaitlistService, useValue: mockWaitlistService },
      ],
    }).compile();

    service = module.get(SelfServeService);
  });

  describe('validateToken', () => {
    it('returns booking for a valid token', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'abc123',
        type: 'RESCHEDULE_LINK',
        email: 'jane@test.com',
        bookingId: 'b1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);

      const result = await service.validateToken('abc123', 'RESCHEDULE_LINK');

      expect(result.booking.id).toBe('b1');
      expect(result.tokenRecord.bookingId).toBe('b1');
    });

    it('throws for expired token', async () => {
      mockTokenService.validateToken.mockRejectedValue(
        new BadRequestException('Token has expired'),
      );

      await expect(service.validateToken('expired', 'RESCHEDULE_LINK')).rejects.toThrow(
        'Token has expired',
      );
    });

    it('throws for already used token', async () => {
      mockTokenService.validateToken.mockRejectedValue(
        new BadRequestException('Token has already been used'),
      );

      await expect(service.validateToken('used', 'RESCHEDULE_LINK')).rejects.toThrow(
        'Token has already been used',
      );
    });

    it('throws for wrong token type', async () => {
      mockTokenService.validateToken.mockRejectedValue(new BadRequestException('Invalid token'));

      await expect(service.validateToken('wrongtype', 'CANCEL_LINK')).rejects.toThrow(
        'Invalid token',
      );
    });

    it('throws when token has no bookingId', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'abc123',
        type: 'RESCHEDULE_LINK',
        email: 'test@test.com',
        bookingId: null,
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });

      await expect(service.validateToken('abc123', 'RESCHEDULE_LINK')).rejects.toThrow(
        'Invalid token',
      );
    });

    it('throws when booking not found', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'abc123',
        type: 'RESCHEDULE_LINK',
        email: 'test@test.com',
        bookingId: 'nonexistent',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(service.validateToken('abc123', 'RESCHEDULE_LINK')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getAvailability', () => {
    it('returns filtered available slots', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'abc123',
        type: 'RESCHEDULE_LINK',
        email: 'jane@test.com',
        bookingId: 'b1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      mockAvailabilityService.getAvailableSlots.mockResolvedValue([
        {
          time: '2026-03-02T10:00:00Z',
          display: '10:00',
          staffId: 'staff1',
          staffName: 'Dr. Chen',
          available: true,
        },
        {
          time: '2026-03-02T10:30:00Z',
          display: '10:30',
          staffId: 'staff1',
          staffName: 'Dr. Chen',
          available: false,
        },
        {
          time: '2026-03-02T11:00:00Z',
          display: '11:00',
          staffId: 'staff1',
          staffName: 'Dr. Chen',
          available: true,
        },
      ]);

      const result = await service.getAvailability('abc123', '2026-03-02');

      expect(result).toHaveLength(2);
      expect(result.every((s: any) => s.available)).toBe(true);
    });
  });

  describe('executeReschedule', () => {
    beforeEach(() => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'abc123',
        type: 'RESCHEDULE_LINK',
        email: 'jane@test.com',
        bookingId: 'b1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      prisma.booking.update.mockResolvedValue(mockBooking as any);
    });

    it('reschedules booking, marks token used, appends selfServeLog', async () => {
      const result = await service.executeReschedule('abc123', '2026-03-02T14:00:00Z');

      expect(mockBookingService.update).toHaveBeenCalledWith('biz1', 'b1', {
        startTime: '2026-03-02T14:00:00Z',
      });
      expect(mockTokenService.markUsed).toHaveBeenCalledWith('token1');
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              selfServeLog: [
                expect.objectContaining({
                  type: 'RESCHEDULED_BY_CUSTOMER',
                  newStartTime: '2026-03-02T14:00:00Z',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('throws when policy blocks reschedule', async () => {
      mockBookingService.checkPolicyAllowed.mockResolvedValue({
        allowed: false,
        reason: 'Cannot reschedule within 24 hours',
        policyText: 'No reschedules within 24h',
      });

      await expect(service.executeReschedule('abc123', '2026-03-02T14:00:00Z')).rejects.toThrow(
        'No reschedules within 24h',
      );
    });

    it('throws when booking status is not rescheduable', async () => {
      prisma.booking.findFirst.mockResolvedValue({ ...mockBooking, status: 'COMPLETED' } as any);

      await expect(service.executeReschedule('abc123', '2026-03-02T14:00:00Z')).rejects.toThrow(
        'This booking cannot be rescheduled',
      );
    });
  });

  describe('executeCancel', () => {
    beforeEach(() => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'abc123',
        type: 'CANCEL_LINK',
        email: 'jane@test.com',
        bookingId: 'b1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      });
      prisma.booking.findFirst.mockResolvedValue(mockBooking as any);
      prisma.booking.update.mockResolvedValue(mockBooking as any);
    });

    it('cancels booking, marks token used, appends selfServeLog', async () => {
      await service.executeCancel('abc123', 'Changed plans');

      expect(mockBookingService.updateStatus).toHaveBeenCalledWith('biz1', 'b1', 'CANCELLED');
      expect(mockTokenService.markUsed).toHaveBeenCalledWith('token1');
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'b1' },
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              selfServeLog: [
                expect.objectContaining({
                  type: 'CANCELLED_BY_CUSTOMER',
                  reason: 'Changed plans',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('throws when policy blocks cancellation', async () => {
      mockBookingService.checkPolicyAllowed.mockResolvedValue({
        allowed: false,
        reason: 'Cannot cancel within 24 hours',
        policyText: 'No cancellations within 24h',
      });

      await expect(service.executeCancel('abc123')).rejects.toThrow('No cancellations within 24h');
    });

    it('throws when booking status is not cancellable', async () => {
      prisma.booking.findFirst.mockResolvedValue({ ...mockBooking, status: 'COMPLETED' } as any);

      await expect(service.executeCancel('abc123')).rejects.toThrow(
        'This booking cannot be cancelled',
      );
    });
  });

  describe('getWaitlistClaimSummary', () => {
    const mockEntry = {
      id: 'wl1',
      businessId: 'biz1',
      status: 'OFFERED',
      offeredSlot: {
        startTime: '2026-03-15T10:00:00Z',
        serviceName: 'Botox',
        staffName: 'Dr. Chen',
      },
      offerExpiresAt: new Date(Date.now() + 600000),
      customer: { id: 'c1', name: 'Alice' },
      service: { id: 'svc1', name: 'Botox', durationMins: 30, price: 100 },
      staff: { id: 'staff1', name: 'Dr. Chen' },
      business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
    };

    it('should return claim summary for valid token', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'wl-token',
        type: 'WAITLIST_CLAIM',
        bookingId: 'wl1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue(mockEntry as any);

      const result = await service.getWaitlistClaimSummary('wl-token');

      expect(result.entry.id).toBe('wl1');
      expect(result.entry.status).toBe('OFFERED');
      expect(result.business.name).toBe('Glow Clinic');
    });

    it('should throw for expired offer', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'wl-token',
        type: 'WAITLIST_CLAIM',
        bookingId: 'wl1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        ...mockEntry,
        offerExpiresAt: new Date(Date.now() - 60000), // expired 1 minute ago
      } as any);

      await expect(service.getWaitlistClaimSummary('wl-token')).rejects.toThrow(
        'This offer has expired',
      );
    });

    it('should throw if entry is not in OFFERED status', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'wl-token',
        type: 'WAITLIST_CLAIM',
        bookingId: 'wl1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        ...mockEntry,
        status: 'BOOKED',
      } as any);

      await expect(service.getWaitlistClaimSummary('wl-token')).rejects.toThrow(
        'This offer is no longer available',
      );
    });
  });

  describe('claimWaitlistSlot', () => {
    const mockEntry = {
      id: 'wl1',
      businessId: 'biz1',
      customerId: 'c1',
      serviceId: 'svc1',
      staffId: 'staff1',
      status: 'OFFERED',
      offeredSlot: {
        startTime: '2026-03-15T10:00:00Z',
        serviceName: 'Botox',
        staffName: 'Dr. Chen',
      },
      offerExpiresAt: new Date(Date.now() + 600000),
      customer: { id: 'c1', name: 'Alice' },
      service: { id: 'svc1', name: 'Botox', durationMins: 30, price: 100 },
      staff: { id: 'staff1', name: 'Dr. Chen' },
    };

    it('should create booking and resolve waitlist entry', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'wl-token',
        type: 'WAITLIST_CLAIM',
        bookingId: 'wl1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue(mockEntry as any);

      const result = await service.claimWaitlistSlot('wl-token');

      expect(mockBookingService.create).toHaveBeenCalledWith('biz1', {
        customerId: 'c1',
        serviceId: 'svc1',
        staffId: 'staff1',
        startTime: '2026-03-15T10:00:00Z',
      });
      expect(mockWaitlistService.resolveEntry).toHaveBeenCalledWith('biz1', 'wl1', 'newbook1');
      expect(mockTokenService.markUsed).toHaveBeenCalledWith('token1');
      expect(result.id).toBe('newbook1');
    });

    it('should throw for expired offer', async () => {
      mockTokenService.validateToken.mockResolvedValue({
        id: 'token1',
        token: 'wl-token',
        type: 'WAITLIST_CLAIM',
        bookingId: 'wl1',
        expiresAt: new Date(Date.now() + 3600000),
        usedAt: null,
      } as any);
      prisma.waitlistEntry.findFirst.mockResolvedValue({
        ...mockEntry,
        offerExpiresAt: new Date(Date.now() - 60000),
      } as any);

      await expect(service.claimWaitlistSlot('wl-token')).rejects.toThrow('This offer has expired');
    });
  });
});
