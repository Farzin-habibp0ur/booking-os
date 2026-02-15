import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('BookingService', () => {
  let bookingService: BookingService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    bookingService = module.get(BookingService);
  });

  describe('findAll', () => {
    it('returns paginated results', async () => {
      const bookings = [{ id: 'b1' }, { id: 'b2' }];
      prisma.booking.findMany.mockResolvedValue(bookings as any);
      prisma.booking.count.mockResolvedValue(2);

      const result = await bookingService.findAll('biz1', {});

      expect(result).toEqual({
        data: bookings,
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('applies status filter', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await bookingService.findAll('biz1', { status: 'CONFIRMED' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', status: 'CONFIRMED' },
        }),
      );
    });

    it('applies staffId filter', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await bookingService.findAll('biz1', { staffId: 'staff1' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', staffId: 'staff1' },
        }),
      );
    });

    it('applies customerId filter', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await bookingService.findAll('biz1', { customerId: 'cust1' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', customerId: 'cust1' },
        }),
      );
    });

    it('applies date range filters', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await bookingService.findAll('biz1', {
        dateFrom: '2026-01-01',
        dateTo: '2026-01-31',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            startTime: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          },
        }),
      );
    });
  });

  describe('findById', () => {
    it('returns booking with relations', async () => {
      const booking = { id: 'b1', customer: {}, service: {}, staff: {} };
      prisma.booking.findFirst.mockResolvedValue(booking as any);

      const result = await bookingService.findById('biz1', 'b1');

      expect(result).toEqual(booking);
      expect(prisma.booking.findFirst).toHaveBeenCalledWith({
        where: { id: 'b1', businessId: 'biz1' },
        include: { customer: true, service: true, staff: true, conversation: true, reminders: true },
      });
    });
  });

  describe('create', () => {
    const createData = {
      customerId: 'cust1',
      serviceId: 'svc1',
      staffId: 'staff1',
      startTime: '2026-03-01T10:00:00Z',
    };

    it('creates booking with calculated endTime', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue(null); // no conflict
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', createData);

      const expectedStart = new Date('2026-03-01T10:00:00Z');
      const expectedEnd = new Date(expectedStart.getTime() + 60 * 60000);

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            businessId: 'biz1',
            startTime: expectedStart,
            endTime: expectedEnd,
            status: 'CONFIRMED',
          }),
        }),
      );
    });

    it('throws on missing service', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(
        bookingService.create('biz1', createData),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws on staff conflict', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue({ id: 'conflict' } as any);

      await expect(
        bookingService.create('biz1', createData),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-creates 24h reminder when booking is >24h away', async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', { ...createData, startTime: futureDate, staffId: undefined });

      expect(prisma.reminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: 'b1',
            status: 'PENDING',
          }),
        }),
      );
    });

    it('skips reminder if booking is <24h away', async () => {
      const soonDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);

      await bookingService.create('biz1', { ...createData, startTime: soonDate, staffId: undefined });

      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('recalculates endTime when startTime changes', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'b1',
        service: { durationMins: 45 },
      } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1' } as any);

      await bookingService.update('biz1', 'b1', { startTime: '2026-03-01T14:00:00Z' });

      const expectedStart = new Date('2026-03-01T14:00:00Z');
      const expectedEnd = new Date(expectedStart.getTime() + 45 * 60000);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            startTime: expectedStart,
            endTime: expectedEnd,
          }),
        }),
      );
    });
  });

  describe('updateStatus', () => {
    it('cancels pending reminders on CANCELLED status', async () => {
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 1 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'b1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });

    it('cancels pending reminders on NO_SHOW status', async () => {
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'NO_SHOW' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 1 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'NO_SHOW');

      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'b1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });

    it('does not cancel reminders for CONFIRMED status', async () => {
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CONFIRMED' } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED');

      expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('getCalendar', () => {
    it('filters by date range', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await bookingService.getCalendar('biz1', '2026-03-01', '2026-03-07');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            startTime: { gte: new Date('2026-03-01') },
            endTime: { lte: new Date('2026-03-07') },
          }),
        }),
      );
    });

    it('filters by optional staffId', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await bookingService.getCalendar('biz1', '2026-03-01', '2026-03-07', 'staff1');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            staffId: 'staff1',
          }),
        }),
      );
    });
  });
});
