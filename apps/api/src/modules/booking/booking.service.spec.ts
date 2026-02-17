import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingService } from './booking.service';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { BusinessService } from '../business/business.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';
import { TokenService } from '../../common/token.service';
import { WaitlistService } from '../waitlist/waitlist.service';
import {
  createMockPrisma,
  createMockNotificationService,
  createMockBusinessService,
  createMockCalendarSyncService,
  createMockTokenService,
  createMockConfigService,
  createMockWaitlistService,
} from '../../test/mocks';

describe('BookingService', () => {
  let bookingService: BookingService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let mockNotificationService: ReturnType<typeof createMockNotificationService>;
  let mockBusinessService: ReturnType<typeof createMockBusinessService>;
  let mockCalendarSyncService: ReturnType<typeof createMockCalendarSyncService>;
  let mockTokenService: ReturnType<typeof createMockTokenService>;
  let mockConfigService: ReturnType<typeof createMockConfigService>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    mockNotificationService = createMockNotificationService();
    mockBusinessService = createMockBusinessService();
    mockCalendarSyncService = createMockCalendarSyncService();
    mockTokenService = createMockTokenService();
    mockConfigService = createMockConfigService();

    const module = await Test.createTestingModule({
      providers: [
        BookingService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: BusinessService, useValue: mockBusinessService },
        { provide: CalendarSyncService, useValue: mockCalendarSyncService },
        { provide: TokenService, useValue: mockTokenService },
        { provide: ConfigService, useValue: mockConfigService },
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

    it('applies dateFrom only without dateTo', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await bookingService.findAll('biz1', { dateFrom: '2026-01-01' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            startTime: { gte: new Date('2026-01-01') },
          },
        }),
      );
    });

    it('applies dateTo only without dateFrom', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await bookingService.findAll('biz1', { dateTo: '2026-01-31' });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            startTime: { lte: new Date('2026-01-31') },
          },
        }),
      );
    });

    it('uses custom page and pageSize', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(100);

      const result = await bookingService.findAll('biz1', { page: 3, pageSize: 10 });

      expect(result).toEqual({
        data: [],
        total: 100,
        page: 3,
        pageSize: 10,
        totalPages: 10,
      });
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 10,
        }),
      );
    });

    it('calculates totalPages correctly with remainder', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(25);

      const result = await bookingService.findAll('biz1', { pageSize: 10 });

      expect(result.totalPages).toBe(3);
    });

    it('combines multiple filters', async () => {
      prisma.booking.findMany.mockResolvedValue([]);
      prisma.booking.count.mockResolvedValue(0);

      await bookingService.findAll('biz1', {
        status: 'CONFIRMED',
        staffId: 'staff1',
        customerId: 'cust1',
        dateFrom: '2026-01-01',
      });

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            status: 'CONFIRMED',
            staffId: 'staff1',
            customerId: 'cust1',
            startTime: { gte: new Date('2026-01-01') },
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

    it('returns null when booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      const result = await bookingService.findById('biz1', 'nonexistent');

      expect(result).toBeNull();
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

    it('skips conflict detection when no staffId is provided', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', {
        customerId: 'cust1',
        serviceId: 'svc1',
        startTime: '2026-03-01T10:00:00Z',
      });

      // findFirst should NOT be called for conflict detection when no staffId
      expect(prisma.booking.findFirst).not.toHaveBeenCalled();
    });

    it('triggers calendar sync after creating booking', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1', customer: {}, service: {}, staff: {} } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', createData);

      expect(mockCalendarSyncService.syncBookingToCalendar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
        'create',
      );
    });

    it('passes notes and customFields to booking creation', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', {
        ...createData,
        notes: 'Patient allergic to latex',
        customFields: { skinType: 'sensitive' },
        staffId: undefined,
      });

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            notes: 'Patient allergic to latex',
            customFields: { skinType: 'sensitive' },
          }),
        }),
      );
    });

    it('defaults customFields to empty object when not provided', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', {
        customerId: 'cust1',
        serviceId: 'svc1',
        startTime: '2026-03-01T10:00:00Z',
      });

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: {},
          }),
        }),
      );
    });

    it('passes conversationId to booking when provided', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 30 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1' } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.create('biz1', {
        ...createData,
        conversationId: 'conv1',
        staffId: undefined,
      });

      expect(prisma.booking.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            conversationId: 'conv1',
          }),
        }),
      );
    });

    it('calls attributeCampaignSend after creating booking', async () => {
      const recentSend = { id: 'cs1', customerId: 'cust1', status: 'SENT', sentAt: new Date(), bookingId: null };
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1', customerId: 'cust1', customer: {}, service: {}, staff: {} } as any);
      prisma.reminder.create.mockResolvedValue({} as any);
      prisma.campaignSend.findFirst.mockResolvedValue(recentSend as any);
      prisma.campaignSend.update.mockResolvedValue({ ...recentSend, bookingId: 'b1' } as any);

      await bookingService.create('biz1', createData);

      // Allow async fire-and-forget to settle
      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.campaignSend.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: 'cust1',
            status: 'SENT',
            bookingId: null,
          }),
        }),
      );
      expect(prisma.campaignSend.update).toHaveBeenCalledWith({
        where: { id: 'cs1' },
        data: { bookingId: 'b1' },
      });
    });

    it('does not update campaignSend when no recent send found', async () => {
      prisma.service.findFirst.mockResolvedValue({ id: 'svc1', durationMins: 60 } as any);
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.create.mockResolvedValue({ id: 'b1', customerId: 'cust1', customer: {}, service: {}, staff: {} } as any);
      prisma.reminder.create.mockResolvedValue({} as any);
      prisma.campaignSend.findFirst.mockResolvedValue(null);

      await bookingService.create('biz1', createData);

      // Allow async fire-and-forget to settle
      await new Promise((r) => setTimeout(r, 50));

      expect(prisma.campaignSend.update).not.toHaveBeenCalled();
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

    it('appends to existing depositRequestLog', async () => {
      const existingLog = [{ sentAt: '2026-01-01T00:00:00Z' }];
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'PENDING_DEPOSIT',
        customFields: { depositRequestLog: existingLog },
        customer: { name: 'Test' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendDepositRequest('biz1', 'b1');

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              depositRequestLog: [
                { sentAt: '2026-01-01T00:00:00Z' },
                { sentAt: expect.any(String) },
              ],
            }),
          }),
        }),
      );
    });

    it('handles null customFields gracefully', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'PENDING_DEPOSIT',
        customFields: null,
        customer: { name: 'Test' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendDepositRequest('biz1', 'b1');

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              depositRequestLog: [{ sentAt: expect.any(String) }],
            }),
          }),
        }),
      );
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

    it('does not recalculate endTime when startTime is not provided', async () => {
      prisma.booking.update.mockResolvedValue({ id: 'b1', notes: 'Updated notes' } as any);

      await bookingService.update('biz1', 'b1', { notes: 'Updated notes' });

      expect(prisma.booking.findFirst).not.toHaveBeenCalled();
      expect(prisma.booking.update).toHaveBeenCalledWith({
        where: { id: 'b1', businessId: 'biz1' },
        data: { notes: 'Updated notes' },
        include: { customer: true, service: true, staff: true },
      });
    });

    it('triggers calendar sync after update', async () => {
      prisma.booking.update.mockResolvedValue({ id: 'b1', customer: {}, service: {}, staff: {} } as any);

      await bookingService.update('biz1', 'b1', { notes: 'New notes' });

      expect(mockCalendarSyncService.syncBookingToCalendar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
        'update',
      );
    });

    it('returns the updated booking with included relations', async () => {
      const updatedBooking = { id: 'b1', notes: 'Updated', customer: { name: 'Test' }, service: { name: 'Botox' }, staff: null };
      prisma.booking.update.mockResolvedValue(updatedBooking as any);

      const result = await bookingService.update('biz1', 'b1', { notes: 'Updated' });

      expect(result).toEqual(updatedBooking);
    });

    it('does not recalculate endTime when booking not found for startTime update', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);
      prisma.booking.update.mockResolvedValue({ id: 'b1' } as any);

      await bookingService.update('biz1', 'b1', { startTime: '2026-03-01T14:00:00Z' });

      // Should still call update, but without endTime since booking was not found
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            endTime: expect.anything(),
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

    it('triggers calendar sync with cancel action on CANCELLED status', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(mockCalendarSyncService.syncBookingToCalendar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
        'cancel',
      );
    });

    it('triggers calendar sync with cancel action on NO_SHOW status', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'NO_SHOW' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'NO_SHOW');

      expect(mockCalendarSyncService.syncBookingToCalendar).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
        'cancel',
      );
    });

    it('sends cancellation notification on CANCELLED status', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(mockNotificationService.sendCancellationNotification).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
      );
    });

    it('does NOT send cancellation notification on NO_SHOW status', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'NO_SHOW' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'NO_SHOW');

      expect(mockNotificationService.sendCancellationNotification).not.toHaveBeenCalled();
    });

    it('does not trigger calendar sync for non-cancel/no-show statuses', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CONFIRMED' } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED');

      expect(mockCalendarSyncService.syncBookingToCalendar).not.toHaveBeenCalled();
    });

    it('does not create follow-up reminders for non-COMPLETED statuses', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'IN_PROGRESS' } as any);

      await bookingService.updateStatus('biz1', 'b1', 'IN_PROGRESS');

      expect(prisma.reminder.create).not.toHaveBeenCalled();
    });

    it('only creates FOLLOW_UP reminder for COMPLETED booking with no service kind', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: null,
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      const calls = prisma.reminder.create.mock.calls;
      expect(calls).toHaveLength(1);
      expect(calls[0][0].data.type).toBe('FOLLOW_UP');
    });

    it('uses default followUpDelayHours of 2 when settings return null', async () => {
      mockBusinessService.getNotificationSettings.mockResolvedValue(null);
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', kind: 'OTHER' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      const before = Date.now();
      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');
      const after = Date.now();

      const followUpCall = prisma.reminder.create.mock.calls.find(
        (call: any) => call[0]?.data?.type === 'FOLLOW_UP',
      );
      expect(followUpCall).toBeDefined();
      const scheduledAt = followUpCall![0].data.scheduledAt as Date;
      const expectedMin = before + 2 * 3600000;
      const expectedMax = after + 2 * 3600000;
      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('uses custom followUpDelayHours from business settings', async () => {
      mockBusinessService.getNotificationSettings.mockResolvedValue({
        channels: 'both',
        followUpDelayHours: 6,
        consultFollowUpDays: 3,
        treatmentCheckInHours: 24,
      });
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { id: 'svc1', kind: 'OTHER' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      const before = Date.now();
      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');
      const after = Date.now();

      const followUpCall = prisma.reminder.create.mock.calls.find(
        (call: any) => call[0]?.data?.type === 'FOLLOW_UP',
      );
      expect(followUpCall).toBeDefined();
      const scheduledAt = followUpCall![0].data.scheduledAt as Date;
      const expectedMin = before + 6 * 3600000;
      const expectedMax = after + 6 * 3600000;
      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('uses default consultFollowUpDays of 3 when settings return null', async () => {
      mockBusinessService.getNotificationSettings.mockResolvedValue(null);
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
      const expectedMin = before + 3 * 24 * 3600000;
      const expectedMax = after + 3 * 24 * 3600000;
      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });

    it('uses default treatmentCheckInHours of 24 when settings return null', async () => {
      mockBusinessService.getNotificationSettings.mockResolvedValue(null);
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
      const expectedMin = before + 24 * 3600000;
      const expectedMax = after + 24 * 3600000;
      expect(scheduledAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
      expect(scheduledAt.getTime()).toBeLessThanOrEqual(expectedMax);
    });
  });

  describe('updateStatus - waitlist integration', () => {
    let mockWaitlistService: ReturnType<typeof createMockWaitlistService>;

    beforeEach(async () => {
      mockWaitlistService = createMockWaitlistService();

      const module = await Test.createTestingModule({
        providers: [
          BookingService,
          { provide: PrismaService, useValue: prisma },
          { provide: NotificationService, useValue: mockNotificationService },
          { provide: BusinessService, useValue: mockBusinessService },
          { provide: CalendarSyncService, useValue: mockCalendarSyncService },
          { provide: TokenService, useValue: mockTokenService },
          { provide: ConfigService, useValue: mockConfigService },
          { provide: WaitlistService, useValue: mockWaitlistService },
        ],
      }).compile();

      bookingService = module.get(BookingService);
    });

    it('offers open slot to waitlist on cancellation when WaitlistService is injected', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(mockWaitlistService.offerOpenSlot).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
      );
    });

    it('does NOT offer open slot to waitlist on NO_SHOW', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'NO_SHOW' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'NO_SHOW');

      expect(mockWaitlistService.offerOpenSlot).not.toHaveBeenCalled();
    });

    it('does NOT offer open slot to waitlist on COMPLETED', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'IN_PROGRESS' } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        service: { kind: 'OTHER' },
      } as any);
      prisma.reminder.create.mockResolvedValue({} as any);

      await bookingService.updateStatus('biz1', 'b1', 'COMPLETED');

      expect(mockWaitlistService.offerOpenSlot).not.toHaveBeenCalled();
    });
  });

  describe('updateStatus - without WaitlistService', () => {
    it('does not throw when WaitlistService is not injected and booking is cancelled', async () => {
      // bookingService from the main beforeEach does not have WaitlistService
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      // Should not throw even though waitlistService is undefined
      const result = await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(result.status).toBe('CANCELLED');
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

    it('returns allowed:true when policySettings is null', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue(null);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(true);
    });

    it('returns hoursRemaining when booking is within window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
      });
      const hoursFromNow = 6;
      const soon = new Date(Date.now() + hoursFromNow * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ startTime: soon } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(false);
      expect(result.hoursRemaining).toBeDefined();
      expect(typeof result.hoursRemaining).toBe('number');
      expect(result.hoursRemaining).toBeGreaterThanOrEqual(0);
      expect(result.hoursRemaining).toBeLessThanOrEqual(hoursFromNow + 1);
    });

    it('returns policyText as undefined when text is empty and booking is within window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 12 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ startTime: soon } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.policyText).toBeUndefined();
    });

    it('returns policyText when booking is outside window and text is provided', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: 'Our cancellation policy...',
        reschedulePolicyText: '',
      });
      const farAway = new Date(Date.now() + 48 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ startTime: farAway } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(true);
      expect(result.policyText).toBe('Our cancellation policy...');
    });

    it('returns policyText as undefined when allowed and text is empty', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 24,
        cancellationPolicyText: '',
        reschedulePolicyText: '',
      });
      const farAway = new Date(Date.now() + 48 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ startTime: farAway } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'cancel');

      expect(result.allowed).toBe(true);
      expect(result.policyText).toBeUndefined();
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

    it('skips policy check when currentBooking has no startTime', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED', startTime: null, customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      const result = await bookingService.updateStatus('biz1', 'b1', 'CANCELLED');

      expect(result.status).toBe('CANCELLED');
      // getPolicySettings should not have been called since startTime is falsy
      expect(mockBusinessService.getPolicySettings).not.toHaveBeenCalled();
    });

    it('does not enforce cancellation policy for non-CANCELLED statuses', async () => {
      // Even though the booking is within the window, the policy only applies to CANCELLED
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'IN_PROGRESS' } as any);

      const result = await bookingService.updateStatus('biz1', 'b1', 'IN_PROGRESS');

      expect(result.status).toBe('IN_PROGRESS');
      expect(mockBusinessService.getPolicySettings).not.toHaveBeenCalled();
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

    it('does not include overrideLog when there are no override entries', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING' } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CONFIRMED' } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED');

      const updateCall = prisma.booking.update.mock.calls[0][0];
      expect((updateCall.data as any).customFields).toBeUndefined();
      expect((updateCall.data as any).status).toBe('CONFIRMED');
    });

    it('handles actor with empty staffId and staffName gracefully for deposit override', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING_DEPOSIT', customFields: {} } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'CONFIRMED',
        customer: {},
        service: {},
        staff: null,
      } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED', {
        reason: 'Override reason',
        role: 'ADMIN',
      });

      const updateCall = prisma.booking.update.mock.calls[0][0];
      const log = (updateCall.data as any).customFields.overrideLog[0];
      expect(log.staffId).toBe('');
      expect(log.staffName).toBe('');
    });

    it('handles actor with empty staffId and staffName gracefully for policy override cancellation', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        cancellationPolicyText: 'No cancellations within 24h',
        rescheduleWindowHours: 24,
        reschedulePolicyText: '',
      });
      const soon = new Date(Date.now() + 12 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ status: 'CONFIRMED', startTime: soon, customFields: null } as any);
      prisma.booking.update.mockResolvedValue({ id: 'b1', status: 'CANCELLED' } as any);
      prisma.reminder.updateMany.mockResolvedValue({ count: 0 } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CANCELLED', {
        reason: 'Emergency override',
        role: 'ADMIN',
      });

      const updateCall = prisma.booking.update.mock.calls[0][0];
      const log = (updateCall.data as any).customFields.overrideLog[0];
      expect(log.type).toBe('POLICY_OVERRIDE');
      expect(log.staffId).toBe('');
      expect(log.staffName).toBe('');
    });

    it('handles null customFields when building override log', async () => {
      prisma.booking.findFirst.mockResolvedValue({ status: 'PENDING_DEPOSIT', customFields: null } as any);
      prisma.booking.update.mockResolvedValue({
        id: 'b1',
        status: 'CONFIRMED',
        customer: {},
        service: {},
        staff: null,
      } as any);

      await bookingService.updateStatus('biz1', 'b1', 'CONFIRMED', {
        reason: 'Override reason',
        role: 'ADMIN',
        staffId: 'staff1',
        staffName: 'Sarah',
      });

      const updateCall = prisma.booking.update.mock.calls[0][0];
      const customFields = (updateCall.data as any).customFields;
      expect(customFields.overrideLog).toHaveLength(1);
      expect(customFields.overrideLog[0].type).toBe('DEPOSIT_OVERRIDE');
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

    it('returns adminCanOverride:true when booking is within reschedule window', async () => {
      mockBusinessService.getPolicySettings.mockResolvedValue({
        policyEnabled: true,
        cancellationWindowHours: 24,
        rescheduleWindowHours: 48,
        cancellationPolicyText: '',
        reschedulePolicyText: 'No reschedules within 48h',
      });
      const soon = new Date(Date.now() + 36 * 3600000);
      prisma.booking.findFirst.mockResolvedValue({ startTime: soon } as any);

      const result = await bookingService.checkPolicyAllowed('biz1', 'b1', 'reschedule');

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

    it('does not include staffId in where when not provided', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await bookingService.getCalendar('biz1', '2026-03-01', '2026-03-07');

      const calledWith = prisma.booking.findMany.mock.calls[0]?.[0] as any;
      expect(calledWith?.where).not.toHaveProperty('staffId');
    });

    it('returns bookings ordered by startTime ascending', async () => {
      const bookings = [
        { id: 'b1', startTime: new Date('2026-03-01T10:00:00Z') },
        { id: 'b2', startTime: new Date('2026-03-01T14:00:00Z') },
      ];
      prisma.booking.findMany.mockResolvedValue(bookings as any);

      const result = await bookingService.getCalendar('biz1', '2026-03-01', '2026-03-07');

      expect(result).toEqual(bookings);
      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { startTime: 'asc' },
        }),
      );
    });

    it('includes customer, service, staff and recurringSeries relations', async () => {
      prisma.booking.findMany.mockResolvedValue([]);

      await bookingService.getCalendar('biz1', '2026-03-01', '2026-03-07');

      expect(prisma.booking.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: {
            customer: true,
            service: true,
            staff: true,
            recurringSeries: { select: { id: true } },
          },
        }),
      );
    });
  });

  describe('sendRescheduleLink', () => {
    const actor = { staffId: 'staff1', staffName: 'Sarah' };

    it('creates token, sends notification, appends selfServeLog', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendRescheduleLink('biz1', 'b1', actor);

      expect(mockTokenService.revokeBookingTokens).toHaveBeenCalledWith('b1', 'RESCHEDULE_LINK');
      expect(mockTokenService.createToken).toHaveBeenCalledWith(
        'RESCHEDULE_LINK',
        'jane@test.com',
        'biz1',
        undefined,
        48,
        'b1',
      );
      expect(mockNotificationService.sendRescheduleLink).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
        expect.stringContaining('/manage/reschedule/'),
      );
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              selfServeLog: [
                expect.objectContaining({
                  type: 'RESCHEDULE_LINK_SENT',
                  sentBy: 'Sarah',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('throws NotFoundException if booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(bookingService.sendRescheduleLink('biz1', 'b1', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if booking has wrong status', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        customFields: {},
        customer: {},
        service: {},
        staff: null,
      } as any);

      await expect(bookingService.sendRescheduleLink('biz1', 'b1', actor)).rejects.toThrow(BadRequestException);
    });

    it('uses phone when email is not available', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: null },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendRescheduleLink('biz1', 'b1', actor);

      expect(mockTokenService.createToken).toHaveBeenCalledWith(
        'RESCHEDULE_LINK',
        '+1234567890',
        'biz1',
        undefined,
        48,
        'b1',
      );
    });

    it('works for PENDING_DEPOSIT status', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'PENDING_DEPOSIT',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendRescheduleLink('biz1', 'b1', actor);

      expect(mockTokenService.createToken).toHaveBeenCalled();
      expect(mockNotificationService.sendRescheduleLink).toHaveBeenCalled();
    });

    it('appends to existing selfServeLog', async () => {
      const existingLog = [{ type: 'CANCEL_LINK_SENT', sentAt: '2026-01-01T00:00:00Z', sentBy: 'Admin', staffId: 'staff2' }];
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: { selfServeLog: existingLog },
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendRescheduleLink('biz1', 'b1', actor);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              selfServeLog: [
                expect.objectContaining({ type: 'CANCEL_LINK_SENT' }),
                expect.objectContaining({ type: 'RESCHEDULE_LINK_SENT', sentBy: 'Sarah', staffId: 'staff1' }),
              ],
            }),
          }),
        }),
      );
    });

    it('uses WEB_URL from config to build reschedule link', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendRescheduleLink('biz1', 'b1', actor);

      expect(mockNotificationService.sendRescheduleLink).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('http://localhost:3000/manage/reschedule/'),
      );
    });

    it('handles null customFields when appending to selfServeLog', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: null,
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendRescheduleLink('biz1', 'b1', actor);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              selfServeLog: [
                expect.objectContaining({ type: 'RESCHEDULE_LINK_SENT' }),
              ],
            }),
          }),
        }),
      );
    });
  });

  describe('sendCancelLink', () => {
    const actor = { staffId: 'staff1', staffName: 'Sarah' };

    it('creates token, sends notification, appends selfServeLog', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendCancelLink('biz1', 'b1', actor);

      expect(mockTokenService.revokeBookingTokens).toHaveBeenCalledWith('b1', 'CANCEL_LINK');
      expect(mockTokenService.createToken).toHaveBeenCalledWith(
        'CANCEL_LINK',
        'jane@test.com',
        'biz1',
        undefined,
        48,
        'b1',
      );
      expect(mockNotificationService.sendCancelLink).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'b1' }),
        expect.stringContaining('/manage/cancel/'),
      );
      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              selfServeLog: [
                expect.objectContaining({
                  type: 'CANCEL_LINK_SENT',
                  sentBy: 'Sarah',
                }),
              ],
            }),
          }),
        }),
      );
    });

    it('throws NotFoundException if booking not found', async () => {
      prisma.booking.findFirst.mockResolvedValue(null);

      await expect(bookingService.sendCancelLink('biz1', 'b1', actor)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if booking has wrong status', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'b1',
        status: 'COMPLETED',
        customFields: {},
        customer: {},
        service: {},
        staff: null,
      } as any);

      await expect(bookingService.sendCancelLink('biz1', 'b1', actor)).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if booking is CANCELLED', async () => {
      prisma.booking.findFirst.mockResolvedValue({
        id: 'b1',
        status: 'CANCELLED',
        customFields: {},
        customer: {},
        service: {},
        staff: null,
      } as any);

      await expect(bookingService.sendCancelLink('biz1', 'b1', actor)).rejects.toThrow(BadRequestException);
    });

    it('uses phone when email is not available', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: null },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendCancelLink('biz1', 'b1', actor);

      expect(mockTokenService.createToken).toHaveBeenCalledWith(
        'CANCEL_LINK',
        '+1234567890',
        'biz1',
        undefined,
        48,
        'b1',
      );
    });

    it('works for PENDING_DEPOSIT status', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'PENDING_DEPOSIT',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendCancelLink('biz1', 'b1', actor);

      expect(mockTokenService.createToken).toHaveBeenCalled();
      expect(mockNotificationService.sendCancelLink).toHaveBeenCalled();
    });

    it('appends to existing selfServeLog', async () => {
      const existingLog = [{ type: 'RESCHEDULE_LINK_SENT', sentAt: '2026-01-01T00:00:00Z', sentBy: 'Admin', staffId: 'staff2' }];
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: { selfServeLog: existingLog },
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendCancelLink('biz1', 'b1', actor);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              selfServeLog: [
                expect.objectContaining({ type: 'RESCHEDULE_LINK_SENT' }),
                expect.objectContaining({ type: 'CANCEL_LINK_SENT', sentBy: 'Sarah', staffId: 'staff1' }),
              ],
            }),
          }),
        }),
      );
    });

    it('uses WEB_URL from config to build cancel link', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendCancelLink('biz1', 'b1', actor);

      expect(mockNotificationService.sendCancelLink).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('http://localhost:3000/manage/cancel/'),
      );
    });

    it('handles null customFields when appending to selfServeLog', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: null,
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await bookingService.sendCancelLink('biz1', 'b1', actor);

      expect(prisma.booking.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              selfServeLog: [
                expect.objectContaining({ type: 'CANCEL_LINK_SENT' }),
              ],
            }),
          }),
        }),
      );
    });
  });

  describe('sendRescheduleLink - WEB_URL fallback', () => {
    let serviceWithNoWebUrl: BookingService;

    beforeEach(async () => {
      const noWebUrlConfig = {
        get: jest.fn((key: string) => {
          if (key === 'WEB_URL') return undefined;
          return mockConfigService.get(key);
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          BookingService,
          { provide: PrismaService, useValue: prisma },
          { provide: NotificationService, useValue: mockNotificationService },
          { provide: BusinessService, useValue: mockBusinessService },
          { provide: CalendarSyncService, useValue: mockCalendarSyncService },
          { provide: TokenService, useValue: mockTokenService },
          { provide: ConfigService, useValue: noWebUrlConfig },
        ],
      }).compile();

      serviceWithNoWebUrl = module.get(BookingService);
    });

    it('falls back to http://localhost:3000 when WEB_URL is not configured', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await serviceWithNoWebUrl.sendRescheduleLink('biz1', 'b1', { staffId: 'staff1', staffName: 'Sarah' });

      expect(mockNotificationService.sendRescheduleLink).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('http://localhost:3000/manage/reschedule/'),
      );
    });
  });

  describe('sendCancelLink - WEB_URL fallback', () => {
    let serviceWithNoWebUrl: BookingService;

    beforeEach(async () => {
      const noWebUrlConfig = {
        get: jest.fn((key: string) => {
          if (key === 'WEB_URL') return undefined;
          return mockConfigService.get(key);
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          BookingService,
          { provide: PrismaService, useValue: prisma },
          { provide: NotificationService, useValue: mockNotificationService },
          { provide: BusinessService, useValue: mockBusinessService },
          { provide: CalendarSyncService, useValue: mockCalendarSyncService },
          { provide: TokenService, useValue: mockTokenService },
          { provide: ConfigService, useValue: noWebUrlConfig },
        ],
      }).compile();

      serviceWithNoWebUrl = module.get(BookingService);
    });

    it('falls back to http://localhost:3000 when WEB_URL is not configured', async () => {
      const booking = {
        id: 'b1',
        businessId: 'biz1',
        status: 'CONFIRMED',
        customFields: {},
        customer: { name: 'Jane', phone: '+1234567890', email: 'jane@test.com' },
        service: { name: 'Botox' },
        staff: null,
      };
      prisma.booking.findFirst.mockResolvedValue(booking as any);
      prisma.booking.update.mockResolvedValue({ ...booking } as any);

      await serviceWithNoWebUrl.sendCancelLink('biz1', 'b1', { staffId: 'staff1', staffName: 'Sarah' });

      expect(mockNotificationService.sendCancelLink).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('http://localhost:3000/manage/cancel/'),
      );
    });
  });

  describe('bulkUpdate', () => {
    it('updates status for multiple bookings', async () => {
      prisma.booking.updateMany.mockResolvedValue({ count: 3 } as any);

      const result = await bookingService.bulkUpdate(
        'biz1', ['b1', 'b2', 'b3'], 'status', { status: 'CONFIRMED' }, 'ADMIN',
      );

      expect(result.updated).toBe(3);
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b1', 'b2', 'b3'] }, businessId: 'biz1' },
        data: { status: 'CONFIRMED' },
      });
    });

    it('assigns staff to multiple bookings', async () => {
      prisma.booking.updateMany.mockResolvedValue({ count: 2 } as any);

      const result = await bookingService.bulkUpdate(
        'biz1', ['b1', 'b2'], 'assign', { staffId: 'staff1' }, 'ADMIN',
      );

      expect(result.updated).toBe(2);
      expect(prisma.booking.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['b1', 'b2'] }, businessId: 'biz1' },
        data: { staffId: 'staff1' },
      });
    });

    it('throws if no IDs provided', async () => {
      await expect(
        bookingService.bulkUpdate('biz1', [], 'status', { status: 'CONFIRMED' }, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if non-admin tries to bulk-cancel', async () => {
      await expect(
        bookingService.bulkUpdate('biz1', ['b1'], 'status', { status: 'CANCELLED' }, 'AGENT'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows admin to bulk-cancel', async () => {
      prisma.booking.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await bookingService.bulkUpdate(
        'biz1', ['b1'], 'status', { status: 'CANCELLED' }, 'ADMIN',
      );

      expect(result.updated).toBe(1);
    });

    it('throws if more than 50 IDs provided', async () => {
      const ids = Array.from({ length: 51 }, (_, i) => `b${i}`);

      await expect(
        bookingService.bulkUpdate('biz1', ids, 'status', { status: 'CONFIRMED' }, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if status action has no status in payload', async () => {
      await expect(
        bookingService.bulkUpdate('biz1', ['b1'], 'status', {}, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws if assign action has no staffId in payload', async () => {
      await expect(
        bookingService.bulkUpdate('biz1', ['b1'], 'assign', {}, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws on unknown bulk action', async () => {
      await expect(
        bookingService.bulkUpdate('biz1', ['b1'], 'delete' as any, {}, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows exactly 50 IDs', async () => {
      const ids = Array.from({ length: 50 }, (_, i) => `b${i}`);
      prisma.booking.updateMany.mockResolvedValue({ count: 50 } as any);

      const result = await bookingService.bulkUpdate(
        'biz1', ids, 'status', { status: 'CONFIRMED' }, 'ADMIN',
      );

      expect(result.updated).toBe(50);
    });

    it('allows non-admin to bulk-update non-cancel status', async () => {
      prisma.booking.updateMany.mockResolvedValue({ count: 2 } as any);

      const result = await bookingService.bulkUpdate(
        'biz1', ['b1', 'b2'], 'status', { status: 'CONFIRMED' }, 'AGENT',
      );

      expect(result.updated).toBe(2);
    });

    it('allows non-admin to bulk-assign staff', async () => {
      prisma.booking.updateMany.mockResolvedValue({ count: 1 } as any);

      const result = await bookingService.bulkUpdate(
        'biz1', ['b1'], 'assign', { staffId: 'staff1' }, 'AGENT',
      );

      expect(result.updated).toBe(1);
    });

    it('throws for null ids', async () => {
      await expect(
        bookingService.bulkUpdate('biz1', null as any, 'status', { status: 'CONFIRMED' }, 'ADMIN'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
