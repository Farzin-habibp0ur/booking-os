import { Test } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PortalService } from './portal.service';
import { PrismaService } from '../../common/prisma.service';
import { BookingService } from '../booking/booking.service';

describe('PortalService – rescheduleBooking', () => {
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

  const customerId = 'cust-1';
  const businessId = 'biz-1';
  const bookingId = 'book-1';
  const newStartTime = '2027-01-15T14:00:00Z';

  const makeBooking = (overrides: Record<string, any> = {}) => ({
    id: bookingId,
    customerId,
    businessId,
    status: 'CONFIRMED',
    startTime: new Date('2027-01-15T10:00:00Z'),
    endTime: new Date('2027-01-15T11:00:00Z'),
    service: { durationMins: 60 },
    ...overrides,
  });

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

    // Defaults
    bookingService.checkPolicyAllowed.mockResolvedValue({ allowed: true });
  });

  it('should successfully reschedule a CONFIRMED booking', async () => {
    const booking = makeBooking({ status: 'CONFIRMED' });
    prisma.booking.findFirst.mockResolvedValue(booking);

    const expectedStart = new Date(newStartTime);
    const expectedEnd = new Date(expectedStart.getTime() + 60 * 60000);
    const updatedBooking = {
      ...booking,
      startTime: expectedStart,
      endTime: expectedEnd,
    };
    prisma.booking.update.mockResolvedValue(updatedBooking);

    const result = await service.rescheduleBooking(customerId, businessId, bookingId, newStartTime);

    expect(prisma.booking.findFirst).toHaveBeenCalledWith({
      where: { id: bookingId, customerId, businessId },
      include: { service: { select: { durationMins: true } } },
    });
    expect(bookingService.checkPolicyAllowed).toHaveBeenCalledWith(businessId, bookingId, 'reschedule');
    expect(prisma.booking.update).toHaveBeenCalledWith({
      where: { id: bookingId },
      data: {
        startTime: expectedStart,
        endTime: expectedEnd,
      },
      include: {
        service: { select: { name: true, durationMins: true, price: true } },
        staff: { select: { name: true } },
      },
    });
    expect(result).toEqual(updatedBooking);
  });

  it('should successfully reschedule a PENDING booking', async () => {
    const booking = makeBooking({ status: 'PENDING' });
    prisma.booking.findFirst.mockResolvedValue(booking);

    const expectedStart = new Date(newStartTime);
    const expectedEnd = new Date(expectedStart.getTime() + 60 * 60000);
    const updatedBooking = {
      ...booking,
      startTime: expectedStart,
      endTime: expectedEnd,
    };
    prisma.booking.update.mockResolvedValue(updatedBooking);

    const result = await service.rescheduleBooking(customerId, businessId, bookingId, newStartTime);

    expect(result).toEqual(updatedBooking);
    expect(prisma.booking.update).toHaveBeenCalled();
  });

  it('should throw NotFoundException when booking is not found', async () => {
    prisma.booking.findFirst.mockResolvedValue(null);

    await expect(
      service.rescheduleBooking(customerId, businessId, bookingId, newStartTime),
    ).rejects.toThrow(NotFoundException);

    expect(bookingService.checkPolicyAllowed).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when booking status is COMPLETED', async () => {
    const booking = makeBooking({ status: 'COMPLETED' });
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(
      service.rescheduleBooking(customerId, businessId, bookingId, newStartTime),
    ).rejects.toThrow(ConflictException);

    expect(bookingService.checkPolicyAllowed).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('should throw ConflictException when booking status is CANCELLED', async () => {
    const booking = makeBooking({ status: 'CANCELLED' });
    prisma.booking.findFirst.mockResolvedValue(booking);

    await expect(
      service.rescheduleBooking(customerId, businessId, bookingId, newStartTime),
    ).rejects.toThrow(ConflictException);

    expect(bookingService.checkPolicyAllowed).not.toHaveBeenCalled();
    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('should throw ForbiddenException when reschedule policy disallows', async () => {
    const booking = makeBooking({ status: 'CONFIRMED' });
    prisma.booking.findFirst.mockResolvedValue(booking);
    bookingService.checkPolicyAllowed.mockResolvedValue({
      allowed: false,
      reason: 'Too close to appointment time',
    });

    await expect(
      service.rescheduleBooking(customerId, businessId, bookingId, newStartTime),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.booking.update).not.toHaveBeenCalled();
  });

  it('should calculate correct endTime based on service durationMins', async () => {
    const booking = makeBooking({ service: { durationMins: 90 } });
    prisma.booking.findFirst.mockResolvedValue(booking);

    const expectedStart = new Date(newStartTime);
    const expectedEnd = new Date(expectedStart.getTime() + 90 * 60000);
    prisma.booking.update.mockResolvedValue({
      ...booking,
      startTime: expectedStart,
      endTime: expectedEnd,
    });

    await service.rescheduleBooking(customerId, businessId, bookingId, newStartTime);

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          startTime: expectedStart,
          endTime: expectedEnd,
        },
      }),
    );
  });

  it('should default to 30 minutes when service durationMins is missing', async () => {
    const booking = makeBooking({ service: null });
    prisma.booking.findFirst.mockResolvedValue(booking);

    const expectedStart = new Date(newStartTime);
    const expectedEnd = new Date(expectedStart.getTime() + 30 * 60000);
    prisma.booking.update.mockResolvedValue({
      ...booking,
      startTime: expectedStart,
      endTime: expectedEnd,
    });

    await service.rescheduleBooking(customerId, businessId, bookingId, newStartTime);

    expect(prisma.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          startTime: expectedStart,
          endTime: expectedEnd,
        },
      }),
    );
  });
});
