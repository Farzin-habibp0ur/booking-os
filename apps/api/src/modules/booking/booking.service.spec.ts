import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BookingService } from './booking.service';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { BusinessService } from '../business/business.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import {
  createMockPrisma,
  createMockNotificationService,
  createMockBusinessService,
  createMockCalendarSyncService,
} from '../../test/mocks';

describe('BookingService', () => {
  let bookingService: BookingService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockBusinessService: ReturnType<typeof createMockBusinessService>;
  let mockCalendarSyncService: ReturnType<typeof createMockCalendarSyncService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockNotificationService = createMockNotificationService();
    mockBusinessService = createMockBusinessService();
    mockCalendarSyncService = createMockCalendarSyncService();

    const module = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: BusinessService, useValue: mockBusinessService },
        { provide: CalendarSyncService, useValue: mockCalendarSyncService },
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
        include: {
          customer: true,
          service: true,
          staff: true,
          conversation: true,
          reminders: true,
          recurringSeries: { select: { id: true } },
        },
      });
    });

    it('includes service.kind in response when service has kind', async () => {
      const booking = {
        id: 'b1',
        customer: { name: 'Test' },
        service: { id: 'svc1', name: 'Consultation', kind: 'CONSULT' },
        staff: { name: 'Dr. Chen' },
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);

      const result = await bookingService.findById('biz1', 'b1');

      expect(result?.service.kind).toBe('CONSULT');
    });
  });

  describe('create', () => {
    const createData = {
      customerId: 'cust1',
      serviceId: 'svc1',
      staffId: 'staff1',
      startTime: '2026-03-01T10:00:00Z',
    };

    it('creates booking with calculated endTime and CONFIRMED status for non-deposit service', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60, depositRequired: false } as any);
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

    it('creates booking with PENDING_DEPOSIT status when service has depositRequired: true', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60, depositRequired: true, depositAmount: 100 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1', service: { depositRequired: true, depositAmount: 100 } } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', createData);

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING_DEPOSIT',
          }),
        }),
      );
    });

    it('sends sendDepositRequest instead of sendBookingConfirmation for deposit-required services', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60, depositRequired: true, depositAmount: 100 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({
        id: 'b1',
        customer: {},
        service: { depositRequired: true, depositAmount: 100 },
        staff: {},
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', createData);

      expect(mockNotificationService.sendDepositRequest).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
      );
      expect(mockNotificationService.sendBookingConfirmation).not.toHaveBeenCalled();
    });

    it('includes PENDING_DEPOSIT in conflict detection status filter', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', createData);

      expect(prisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
          }),
        }),
      );
    });

    it('throws on missing service', async () => {
      prisma.service.findFirst.mockResolvedValue(null);

      await expect(bookingService.create('biz1', createData)).rejects.toThrow(BadRequestException);
    });

    it('throws on staff conflict', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue({ id: 'conflict' } as any);

      await expect(bookingService.create('biz1', createData)).rejects.toThrow(BadRequestException);
    });

    it('auto-creates 24h reminder when booking is >24h away', async () => {
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', {
        ...createData,
        startTime: futureDate,
        staffId: undefined,
      });

      expect(prisma.reminder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            bookingId: 'b1',
            status: 'PENDING',
          }),
        }),
      );
    });

    it('sends booking confirmation notification after create', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({
        id: 'b1',
        customer: {},
        service: {},
        staff: {},
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', createData);

      expect(mockNotificationService.sendBookingConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
      );
    });

    it('logs initial deposit request in customFields for deposit-required services', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60, depositRequired: true, depositAmount: 100 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({
        id: 'b1',
        customer: {},
        service: { depositRequired: true, depositAmount: 100 },
        staff: {},
      } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', createData);

      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1' },
        data: {
          customFields: {
            depositRequestLog: [{ sentAt: expect.any(String) }],
          },
        },
      });
    });

    it('skips reminder if booking is <24h away', async () => {
      const soonDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);

      await bookingService.create('biz1', {
        ...createData,
        startTime: soonDate,
        staffId: undefined,
      });

      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });
  });

  describe('sendDepositRequest', () => {
    it('sends notification and logs event in customFields', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'PENDING_DEPOSIT',
        customFields: {},
        customer: { name: 'Test' },
        service: { name: 'Botox', depositRequired: true, depositAmount: 100 },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking, customFields: { depositRequestLog: [{ sentAt: expect.any(String) }] } } as any);

      await bookingService.sendDepositRequest('biz1', 'b1');

      expect(mockNotificationService.sendDepositRequest).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
      );
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1', businessId: 'biz1' },
        data: {
          customFields: {
            depositRequestLog: [{ sentAt: expect.any(String) }],
          },
        },
        include: { customer: true, service: true, staff: true },
      });
    });

    it('throws NotFoundException if booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(bookingService.sendDepositRequest('biz1', 'b1')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if booking not PENDING_DEPOSIT', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: {},
        service: {},
        staff: null,
      } as any);

      await expect(bookingService.sendDepositRequest('biz1', 'b1')).rejects.toThrow(BadRequestException);
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
    it('sends booking confirmation when transitioning from PENDING_DEPOSIT to CONFIRMED (admin override)', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING_DEPOSIT', customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'CONFIRMED',
        customer: { name: 'Test' },
        service: { name: 'Botox' },
        staff: null,
      } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED', {
        reason: 'Client paid cash',
        staffId: 'staff1',
        staffName: 'Sarah',
        role: 'ADMIN',
      });

      expect(mockNotificationService.sendBookingConfirmation).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1', status: 'CONFIRMED' }),
      );
    });

    it('does NOT send booking confirmation when transitioning from PENDING to CONFIRMED', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CONFIRMED' } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED');

      expect(mockNotificationService.sendBookingConfirmation).not.toHaveBeenCalled();
    });

    it('cancels pending reminders on CANCELLED status', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 1 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'b1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });

    it('cancels pending reminders on NO_SHOW status', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'NO_SHOW' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 1 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'NO_SHOW');

      expect(prisma.reminder.updateMany).toHaveBeenCalledWith({
        where: { bookingId: 'b1', status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
    });

    it('does not cancel reminders for CONFIRMED status', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CONFIRMED' } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED');

      expect(prisma.reminder.updateMany).not.toHaveBeenCalled();
    });

    it('creates follow-up reminder when status becomes COMPLETED', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'COMPLETED' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          bookingId: 'b1',
          status: 'PENDING',
          type: 'FOLLOW_UP',
        }),
      });
    });

    it('creates CONSULT_FOLLOW_UP reminder when a CONSULT booking becomes COMPLETED', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'Consultation', kind: 'CONSULT' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      expect(prisma.reminder.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          bookingId: 'b1',
          status: 'PENDING',
          type: 'CONSULT_FOLLOW_UP',
        }),
      });
    });

    it('does NOT create CONSULT_FOLLOW_UP for TREATMENT bookings', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'Botox', kind: 'TREATMENT' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      const calls = prisma.reminder.create.mock.calls;
      const consultFollowUpCalls = calls.filter(
        (call: any) => call[0]?.data?.type === 'CONSULT_FOLLOW_UP',
      );
      expect(consultFollowUpCalls).toHaveLength(0);
    });

    it('does NOT create CONSULT_FOLLOW_UP for OTHER bookings', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'General', kind: 'OTHER' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      const calls = prisma.reminder.create.mock.calls;
      const consultFollowUpCalls = calls.filter(
        (call: any) => call[0]?.data?.type === 'CONSULT_FOLLOW_UP',
      );
      expect(consultFollowUpCalls).toHaveLength(0);
    });

    it('creates AFTERCARE reminder when a TREATMENT booking becomes COMPLETED', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'Botox', kind: 'TREATMENT' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      const aftercareCalls = prisma.reminder.create.mock.calls.filter(
        (call: any) => call[0]?.data?.type === 'AFTERCARE',
      );
      expect(aftercareCalls).toHaveLength(1);
      expect(aftercareCalls[0][0].data).toMatchObject({
        businessId: 'biz1',
        bookingId: 'b1',
        status: 'PENDING',
        type: 'AFTERCARE',
      });
    });

    it('creates TREATMENT_CHECK_IN reminder when a TREATMENT booking becomes COMPLETED', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'Botox', kind: 'TREATMENT' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      const checkInCalls = prisma.reminder.create.mock.calls.filter(
        (call: any) => call[0]?.data?.type === 'TREATMENT_CHECK_IN',
      );
      expect(checkInCalls).toHaveLength(1);
      expect(checkInCalls[0][0].data).toMatchObject({
        businessId: 'biz1',
        bookingId: 'b1',
        status: 'PENDING',
        type: 'TREATMENT_CHECK_IN',
      });
    });

    it('does NOT create AFTERCARE/TREATMENT_CHECK_IN for CONSULT bookings', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'Consultation', kind: 'CONSULT' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      const calls = prisma.reminder.create.mock.calls;
      const aftercareCalls = calls.filter((call: any) => call[0]?.data?.type === 'AFTERCARE');
      const checkInCalls = calls.filter((call: any) => call[0]?.data?.type === 'TREATMENT_CHECK_IN');
      expect(aftercareCalls).toHaveLength(0);
      expect(checkInCalls).toHaveLength(0);
    });

    it('does NOT create AFTERCARE/TREATMENT_CHECK_IN for OTHER bookings', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'General', kind: 'OTHER' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      const calls = prisma.reminder.create.mock.calls;
      const aftercareCalls = calls.filter((call: any) => call[0]?.data?.type === 'AFTERCARE');
      const checkInCalls = calls.filter((call: any) => call[0]?.data?.type === 'TREATMENT_CHECK_IN');
      expect(aftercareCalls).toHaveLength(0);
      expect(checkInCalls).toHaveLength(0);
    });

    it('uses treatmentCheckInHours from business settings for check-in delay', async () => {
      mockBusinessService.getNotificationSettings.mockResolvedValue({
        channels: 'both',
        followUpDelayHours: 2,
        consultFollowUpDays: 3,
        treatmentCheckInHours: 48,
      });
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'Botox', kind: 'TREATMENT' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      const before = Date.now();
      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');
      const after = Date.now();

      const checkInCall = prisma.reminder.create.mock.calls.find(
        (call: any) => call[0]?.data?.type === 'TREATMENT_CHECK_IN',
      );
      expect(checkInCall).toBeDefined();

      const scheduledAt = checkInCall![0].data.scheduledAt as Date;
      const expectedMin = before + 48 * 3600000;
      const expectedMax = after + 48 * 3600000;
      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('schedules AFTERCARE immediately (scheduledAt ~ now)', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'Botox', kind: 'TREATMENT' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      const before = Date.now();
      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');
      const after = Date.now();

      const aftercareCall = prisma.reminder.create.mock.calls.find(
        (call: any) => call[0]?.data?.type === 'AFTERCARE',
      );
      expect(aftercareCall).toBeDefined();

      const scheduledAt = aftercareCall![0].data.scheduledAt as Date;
      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(after);
    });

    it('uses consultFollowUpDays from business settings for delay', async () => {
      mockBusinessService.getNotificationSettings.mockResolvedValue({
        channels: 'both',
        followUpDelayHours: 2,
        consultFollowUpDays: 5,
      });
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', name: 'Consultation', kind: 'CONSULT' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      const before = Date.now();
      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');
      const after = Date.now();

      const consultCall = prisma.reminder.create.mock.calls.find(
        (call: any) => call[0]?.data?.type === 'CONSULT_FOLLOW_UP',
      );
      expect(consultCall).toBeDefined();

      const scheduledAt = consultCall![0].data.scheduledAt as Date;
      const expectedMin = before + 5 * 24 * 3600000;
      const expectedMax = after + 5 * 24 * 3600000;
      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('checkPolicyAllowed', () => {
    it('returns allowed:true when policy is disabled', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: false,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
      });

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(true);
    });

    it('returns allowed:false when booking is within cancellation window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: 'No cancellations within 24h',
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 12 * 3600000); // 12h from now
      prisma.booking.findFirst.mockResolvedValue({ startTime: soon } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('24');
      expect(result.policyText).toBe('No cancellations within 24h');
    });

    it('returns allowed:true when booking is outside cancellation window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
      });
      const farAway = new Date(Date.now() + 48 * 3600000); // 48h from now
      prisma.booking.findFirst.mockResolvedValue({ startTime: farAway } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(true);
    });

    it('returns allowed:false when booking is within reschedule window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 48,
        cancellationPolicyText: '',
        reschedulePolicyText: 'No reschedules within 48h',
      });
      const soon = new Date(Date.now() + 36 * 3600000); // 36h from now
      prisma.booking.findFirst.mockResolvedValue({ startTime: soon } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'reschedule');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('48');
      expect(result.policyText).toBe('No reschedules within 48h');
    });

    it('returns allowed:true when booking not found', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
      });
      prisma.booking.findFirst.mockResolvedValue(null);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(true);
    });
  });

  describe('updateStatus - policy enforcement', () => {
    it('throws BadRequestException when non-admin cancels within policy window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        cancellationPolicyText: 'Cancellations must be made 24h in advance',
        rescheduleWindowHours: 24,
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 12 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED', startTime: soon, customFields: {} } as any);

      await expect(
        bookingService.updateStatus('biz1', 'b1', 'CANCELLED', { role: 'AGENT', staffId: 's1', staffName: 'Agent', reason: '' }),
      ).rejects.toThrow('Cancellations must be made 24h in advance');
    });

    it('allows cancellation when booking is outside policy window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        cancellationPolicyText: '',
        rescheduleWindowHours: 24,
        reschedulePolicyText: '',
      });
      const farAway = new Date(Date.now() + 48 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED', startTime: farAway, customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(result.status).toBe('CANCELLED');
    });

    it('allows cancellation when policy is disabled', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: false,
        cancellationWindowHours: 24,
        cancellationPolicyText: '',
        rescheduleWindowHours: 24,
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 2 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED', startTime: soon, customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(result.status).toBe('CANCELLED');
    });

    it('uses default message when cancellation policy text is empty', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        cancellationPolicyText: '',
        rescheduleWindowHours: 24,
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 12 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED', startTime: soon, customFields: {} } as any);

      await expect(bookingService.updateStatus('biz1', 'b1', 'CANCELLED')).rejects.toThrow(
        'Cannot cancel within 24 hours of the appointment',
      );
    });
  });

  describe('updateStatus - admin override', () => {
    const adminActor = { reason: 'Client paid cash', staffId: 'staff1', staffName: 'Sarah', role: 'ADMIN' };

    it('allows ADMIN to confirm PENDING_DEPOSIT booking with reason', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING_DEPOSIT', customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'CONFIRMED',
        customer: {},
        service: {},
        staff: null,
      } as any);

      const result = await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED', adminActor);

      expect(result.status).toBe('CONFIRMED');
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              overrideLog: [
                expect.objectContaining({
                  type: 'DEPOSIT_OVERRIDE',
                  action: 'CONFIRMED',
                  reason: 'Client paid cash',
                  staffId: 'staff1',
                  staffName: 'Sarah',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('throws ForbiddenException when non-ADMIN tries to confirm PENDING_DEPOSIT', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING_DEPOSIT', customFields: {} } as any);

      await expect(
        bookingService.updateStatus('biz1', 'b1', 'CONFIRMED', {
          role: 'AGENT',
          staffId: 's1',
          staffName: 'Agent',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException when ADMIN tries to confirm PENDING_DEPOSIT without reason', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING_DEPOSIT', customFields: {} } as any);

      await expect(
        bookingService.updateStatus('biz1', 'b1', 'CONFIRMED', {
          role: 'ADMIN',
          staffId: 'staff1',
          staffName: 'Sarah',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows ADMIN to cancel within policy window with reason', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        cancellationPolicyText: 'No cancellations within 24h',
        rescheduleWindowHours: 24,
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 12 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED', startTime: soon, customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await bookingService.updateStatus('biz1', 'b1', 'CANCELLED', {
        reason: 'Emergency situation',
        staffId: 'staff1',
        staffName: 'Sarah',
        role: 'ADMIN',
      });

      expect(result.status).toBe('CANCELLED');
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              overrideLog: [
                expect.objectContaining({
                  type: 'POLICY_OVERRIDE',
                  action: 'CANCELLED',
                  reason: 'Emergency situation',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('throws BadRequestException when ADMIN cancels within policy window without reason', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        cancellationPolicyText: 'No cancellations within 24h',
        rescheduleWindowHours: 24,
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 12 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED', startTime: soon, customFields: {} } as any);

      await expect(
        bookingService.updateStatus('biz1', 'b1', 'CANCELLED', {
          role: 'ADMIN',
          staffId: 'staff1',
          staffName: 'Sarah',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('override log includes timestamp', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING_DEPOSIT', customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'CONFIRMED',
        customer: {},
        service: {},
        staff: null,
      } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED', adminActor);

      const updateCall = prisma.booking.update.mock.calls[0][0];
      const log = (updateCall.data as any).customFields.overrideLog[0];
      expect(log.timestamp).toBeDefined();
      expect(new Date(log.timestamp).getTime()).toBeGreaterThan(0);
    });

    it('appends to existing overrideLog', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        status: 'PENDING_DEPOSIT',
        customFields: {
          overrideLog: [{ type: 'EXISTING', action: 'TEST', reason: 'old', staffId: '', staffName: '', timestamp: '2025-01-01' }],
        },
      } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'CONFIRMED',
        customer: {},
        service: {},
        staff: null,
      } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED', adminActor);

      const updateCall = prisma.booking.update.mock.calls[0][0];
      const log = (updateCall.data as any).customFields.overrideLog;
      expect(log).toHaveLength(2);
      expect(log[0].type).toBe('EXISTING');
      expect(log[1].type).toBe('DEPOSIT_OVERRIDE');
    });
  });

  describe('checkPolicyAllowed - adminCanOverride', () => {
    it('returns adminCanOverride:true when booking is within cancellation window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: 'No cancellations within 24h',
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 12 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ startTime: soon } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(false);
      expect(result.adminCanOverride).toBe(true);
    });
  });

  describe('getCalendar', () => {
    it('filters by date range and includes PENDING_DEPOSIT in status filter', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await bookingService.getCalendar('biz1', '2026-03-01', '2026-03-07');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            businessId: 'biz1',
            status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
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
