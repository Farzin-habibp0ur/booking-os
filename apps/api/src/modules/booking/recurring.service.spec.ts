import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RecurringService } from './recurring.service';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import { createMockPrisma, createMockNotificationService, createMockCalendarSyncService } from '../../test/mocks';

describe('RecurringService', () => {
  let service: RecurringService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockCalendarSyncService: ReturnType<typeof createMockCalendarSyncService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockNotificationService = createMockNotificationService();
    mockCalendarSyncService = createMockCalendarSyncService();

    const module = await Test.createTestingModule({
      providers: [
        RecurringService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: CalendarSyncService, useValue: mockCalendarSyncService },
      ],
    }).compile();

    service = module.get(RecurringService);
  });

  describe('generateOccurrenceDates', () => {
    it('generates weekly occurrences on a single day', () => {
      // Tuesday = day 2, starting from 2026-03-03 (Tuesday)
      const start = new Date('2026-03-03T00:00:00');
      const dates = service.generateOccurrenceDates(start, '14:00', [2], 1, 4);

      expect(dates).toHaveLength(4);
      dates.forEach((d) => {
        expect(d.getDay()).toBe(2); // all Tuesdays
        expect(d.getHours()).toBe(14);
        expect(d.getMinutes()).toBe(0);
      });
    });

    it('generates biweekly occurrences', () => {
      const start = new Date('2026-03-03T00:00:00');
      const dates = service.generateOccurrenceDates(start, '10:00', [2], 2, 4);

      expect(dates).toHaveLength(4);
      // Dates should be 2 weeks apart
      for (let i = 1; i < dates.length; i++) {
        const diff = dates[i].getTime() - dates[i - 1].getTime();
        expect(diff).toBe(14 * 24 * 60 * 60 * 1000);
      }
    });

    it('generates occurrences on multiple days per week', () => {
      // Mon=1, Wed=3, Fri=5
      const start = new Date('2026-03-02T00:00:00'); // Monday
      const dates = service.generateOccurrenceDates(start, '09:00', [1, 3, 5], 1, 6);

      expect(dates).toHaveLength(6);
      expect(dates[0].getDay()).toBe(1); // Mon
      expect(dates[1].getDay()).toBe(3); // Wed
      expect(dates[2].getDay()).toBe(5); // Fri
      expect(dates[3].getDay()).toBe(1); // Mon (next week)
    });

    it('respects endDate', () => {
      const start = new Date('2026-03-03T00:00:00');
      const endDate = new Date('2026-03-18T23:59:59');
      const dates = service.generateOccurrenceDates(start, '14:00', [2], 1, 52, endDate);

      expect(dates.length).toBeLessThanOrEqual(3);
      dates.forEach((d) => expect(d <= endDate).toBe(true));
    });

    it('caps at 52 occurrences', () => {
      const start = new Date('2026-01-01T00:00:00');
      const dates = service.generateOccurrenceDates(start, '10:00', [1, 3, 5], 1, 200);

      expect(dates).toHaveLength(52);
    });
  });

  describe('createSeries', () => {
    const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const createData = {
      customerId: 'cust1',
      serviceId: 'svc1',
      staffId: 'staff1',
      startDate: futureDate.toISOString().split('T')[0],
      timeOfDay: '14:00',
      daysOfWeek: [futureDate.getDay()],
      intervalWeeks: 1,
      totalCount: 4,
    };

    it('throws on invalid service', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(service.createSeries('biz1', createData)).rejects.toThrow(BadRequestException);
    });

    it('throws on staff conflict', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue({ id: 'conflict' } as any);

      await expect(service.createSeries('biz1', createData)).rejects.toThrow(BadRequestException);
    });

    it('creates series and bookings in a transaction', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue(null); // no conflicts

      const mockTx = {
        recurringSeries: { create: jest.fn().mockResolvedValue({ id: 'series1' }) },
        booking: {
          create: jest.fn().mockResolvedValue({
            id: 'b1',
            customer: { name: 'Test' },
            service: { name: 'Test Service' },
            staff: { name: 'Staff' },
          }),
        },
        reminder: { create: jest.fn().mockResolvedValue({}) },
      };
      prisma.$transaction.mockImplementation(async (fn: any) => fn(mockTx));

      const result = await service.createSeries('biz1', createData);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(mockTx.recurringSeries.create).toHaveBeenCalled();
      expect(mockTx.booking.create).toHaveBeenCalledTimes(4);
      expect(result.bookings).toHaveLength(4);
    });
  });

  describe('getSeriesById', () => {
    it('throws NotFoundException when series not found', async () => {
      prisma.recurringSeries.findFirst.mockResolvedValue(null);

      await expect(service.getSeriesById('biz1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('returns series with bookings', async () => {
      const series = {
        id: 'series1',
        bookings: [{ id: 'b1' }, { id: 'b2' }],
        customer: {},
        service: {},
        staff: {},
      };
      prisma.recurringSeries.findFirst.mockResolvedValue(series as any);

      const result = await service.getSeriesById('biz1', 'series1');

      expect(result.id).toBe('series1');
      expect(result.bookings).toHaveLength(2);
    });
  });

  describe('cancelSeries', () => {
    const series = {
      id: 'series1',
      bookings: [
        { id: 'b1', status: 'CONFIRMED', startTime: new Date('2026-03-03'), customer: {}, service: {}, staff: {} },
        { id: 'b2', status: 'CONFIRMED', startTime: new Date('2026-03-10'), customer: {}, service: {}, staff: {} },
        { id: 'b3', status: 'CONFIRMED', startTime: new Date('2026-03-17'), customer: {}, service: {}, staff: {} },
        { id: 'b4', status: 'COMPLETED', startTime: new Date('2026-02-24'), customer: {}, service: {}, staff: {} },
      ],
    };

    it('cancels single booking from series', async () => {
      prisma.recurringSeries.findFirst.mockResolvedValue(series as any);
      prisma.booking.update.mockResolvedValue({} as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.cancelSeries('biz1', 'series1', 'single', 'b2');

      expect(result.cancelled).toBe(1);
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'b2' },
        data: { status: 'CANCELLED' },
      });
    });

    it('cancels future bookings from a given point', async () => {
      prisma.recurringSeries.findFirst.mockResolvedValue(series as any);
      prisma.booking.update.mockResolvedValue({} as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.cancelSeries('biz1', 'series1', 'future', 'b2');

      // b2 and b3 are future from b2, b4 is COMPLETED so skipped
      expect(result.cancelled).toBe(2);
    });

    it('cancels all cancellable bookings in series', async () => {
      prisma.recurringSeries.findFirst.mockResolvedValue(series as any);
      prisma.booking.update.mockResolvedValue({} as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await service.cancelSeries('biz1', 'series1', 'all');

      // b1, b2, b3 are CONFIRMED; b4 is COMPLETED (skipped)
      expect(result.cancelled).toBe(3);
    });

    it('throws when series not found', async () => {
      prisma.recurringSeries.findFirst.mockResolvedValue(null);

      await expect(service.cancelSeries('biz1', 'missing', 'all')).rejects.toThrow(NotFoundException);
    });
  });
});
