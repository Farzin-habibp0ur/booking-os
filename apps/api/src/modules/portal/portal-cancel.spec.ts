import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PrismaService } from '../../common/prisma.service';
import { BookingService } from '../booking/booking.service';

describe('PortalService — cancelBooking', () => {
  let service: PortalService;
  let prisma: {
    customer: { findFirst: jest.Mock; update: jest.Mock };
    booking: {
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      aggregate: jest.Mock;
      update: jest.Mock;
    };
  };
  let bookingService: {
    checkPolicyAllowed: jest.Mock;
    updateStatus: jest.Mock;
  };

  const businessId = 'biz-1';
  const customerId = 'cust-1';
  const bookingId = 'book-1';

  const mockBooking = {
    id: bookingId,
    customerId,
    businessId,
    status: 'PENDING',
    startTime: new Date('2027-01-15T12:00:00'),
    endTime: new Date('2027-01-15T13:00:00'),
    amount: 100,
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PortalService,
        {
          provide: PrismaService,
          useValue: {
            customer: { findFirst: jest.fn(), update: jest.fn() },
            booking: {
              findFirst: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              aggregate: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: BookingService,
          useValue: {
            checkPolicyAllowed: jest.fn(),
            updateStatus: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PortalService);
    prisma = module.get(PrismaService);
    bookingService = module.get(BookingService);

    // Default mocks
    prisma.booking.findFirst.mockResolvedValue({ ...mockBooking });
    bookingService.checkPolicyAllowed.mockResolvedValue({ allowed: true });
    bookingService.updateStatus.mockResolvedValue({
      ...mockBooking,
      status: 'CANCELLED',
    });
  });

  it('should successfully cancel a PENDING booking', async () => {
    const result = await service.cancelBooking(customerId, businessId, bookingId);

    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { id: bookingId, customerId, businessId },
    });
    expect(bookingService.checkPolicyAllowed).toHaveBeenCalledWith(businessId, bookingId, 'cancel');
    expect(bookingService.updateStatus).toHaveBeenCalledWith(businessId, bookingId, 'CANCELLED', {
      reason: 'Cancelled by customer via portal',
    });
    expect(result.status).toBe('CANCELLED');
  });

  it('should successfully cancel a CONFIRMED booking', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...mockBooking,
      status: 'CONFIRMED',
    });

    const result = await service.cancelBooking(customerId, businessId, bookingId);

    expect(bookingService.updateStatus).toHaveBeenCalledWith(businessId, bookingId, 'CANCELLED', {
      reason: 'Cancelled by customer via portal',
    });
    expect(result.status).toBe('CANCELLED');
  });

  it('should throw NotFoundException when booking not found', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);

    await expect(service.cancelBooking(customerId, businessId, bookingId)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw ConflictException when booking status is COMPLETED', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...mockBooking,
      status: 'COMPLETED',
    });

    await expect(service.cancelBooking(customerId, businessId, bookingId)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw ConflictException when booking status is CANCELLED', async () => {
    prisma.booking.findFirst.mockResolvedValue({
      ...mockBooking,
      status: 'CANCELLED',
    });

    await expect(service.cancelBooking(customerId, businessId, bookingId)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should throw ForbiddenException when cancellation policy disallows', async () => {
    bookingService.checkPolicyAllowed.mockResolvedValue({
      allowed: false,
      reason: 'Too close to appointment time',
    });

    await expect(service.cancelBooking(customerId, businessId, bookingId)).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('should pass reason to updateStatus when provided', async () => {
    const reason = 'Schedule conflict';

    await service.cancelBooking(customerId, businessId, bookingId, reason);

    expect(bookingService.updateStatus).toHaveBeenCalledWith(businessId, bookingId, 'CANCELLED', {
      reason: 'Schedule conflict',
    });
  });

  it('should use default reason when no reason is provided', async () => {
    await service.cancelBooking(customerId, businessId, bookingId);

    expect(bookingService.updateStatus).toHaveBeenCalledWith(businessId, bookingId, 'CANCELLED', {
      reason: 'Cancelled by customer via portal',
    });
  });
});
