import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { BusinessService } from '../business/business.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';

@Injectable()
export class BookingService {
  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private businessService: BusinessService,
    private calendarSyncService: CalendarSyncService,
  ) {}

  async findAll(
    businessId: string,
    query: {
      status?: string;
      staffId?: string;
      customerId?: string;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.staffId) where.staffId = query.staffId;
    if (query.customerId) where.customerId = query.customerId;
    if (query.dateFrom || query.dateTo) {
      where.startTime = {};
      if (query.dateFrom) where.startTime.gte = new Date(query.dateFrom);
      if (query.dateTo) where.startTime.lte = new Date(query.dateTo);
    }

    const [data, total] = await Promise.all([
      this.prisma.booking.findMany({
        where,
        include: {
          customer: true,
          service: true,
          staff: true,
          recurringSeries: { select: { id: true } },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startTime: 'asc' },
      }),
      this.prisma.booking.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(businessId: string, id: string) {
    return this.prisma.booking.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        service: true,
        staff: true,
        conversation: true,
        reminders: true,
        recurringSeries: { select: { id: true } },
      },
    });
  }

  async create(
    businessId: string,
    data: {
      customerId: string;
      serviceId: string;
      staffId?: string;
      conversationId?: string;
      startTime: string;
      notes?: string;
      customFields?: any;
    },
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, businessId },
    });
    if (!service) throw new BadRequestException('Service not found');

    const startTime = new Date(data.startTime);
    const endTime = new Date(startTime.getTime() + service.durationMins * 60000);

    // Conflict detection
    if (data.staffId) {
      const conflict = await this.prisma.booking.findFirst({
        where: {
          businessId,
          staffId: data.staffId,
          status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
          startTime: { lt: endTime },
          endTime: { gt: startTime },
        },
      });
      if (conflict) throw new BadRequestException('Staff has a conflicting booking at this time');
    }

    const isDepositRequired = service.depositRequired === true;

    const booking = await this.prisma.booking.create({
      data: {
        businessId,
        customerId: data.customerId,
        serviceId: data.serviceId,
        staffId: data.staffId,
        conversationId: data.conversationId,
        startTime,
        endTime,
        notes: data.notes,
        customFields: data.customFields || {},
        status: isDepositRequired ? 'PENDING_DEPOSIT' : 'CONFIRMED',
      },
      include: { customer: true, service: true, staff: true },
    });

    // Auto-create 24h reminder
    const reminderTime = new Date(startTime.getTime() - 24 * 60 * 60 * 1000);
    if (reminderTime > new Date()) {
      await this.prisma.reminder.create({
        data: {
          businessId,
          bookingId: booking.id,
          scheduledAt: reminderTime,
          status: 'PENDING',
        },
      });
    }

    // Fire-and-forget notification
    if (isDepositRequired) {
      this.notificationService.sendDepositRequest(booking).catch(() => {});
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { customFields: { depositRequestLog: [{ sentAt: new Date().toISOString() }] } },
      });
    } else {
      this.notificationService.sendBookingConfirmation(booking).catch(() => {});
    }

    // Fire-and-forget calendar sync
    this.calendarSyncService.syncBookingToCalendar(booking, 'create').catch(() => {});

    return booking;
  }

  async update(businessId: string, id: string, data: any) {
    if (data.startTime) {
      const booking = await this.prisma.booking.findFirst({
        where: { id, businessId },
        include: { service: true },
      });
      if (booking) {
        data.startTime = new Date(data.startTime);
        data.endTime = new Date(data.startTime.getTime() + booking.service.durationMins * 60000);
      }
    }
    const result = await this.prisma.booking.update({
      where: { id, businessId },
      data,
      include: { customer: true, service: true, staff: true },
    });

    // Fire-and-forget calendar sync
    this.calendarSyncService.syncBookingToCalendar(result, 'update').catch(() => {});

    return result;
  }

  async updateStatus(businessId: string, id: string, status: string) {
    // Read current booking to detect PENDING_DEPOSIT → CONFIRMED transition
    const currentBooking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      select: { status: true },
    });

    const booking = await this.prisma.booking.update({
      where: { id, businessId },
      data: { status },
      include: { customer: true, service: true, staff: true },
    });

    // Send booking confirmation when deposit is confirmed
    if (status === 'CONFIRMED' && currentBooking?.status === 'PENDING_DEPOSIT') {
      this.notificationService.sendBookingConfirmation(booking).catch(() => {});
    }

    // Cancel pending reminders if booking is cancelled/no-show
    if (['CANCELLED', 'NO_SHOW'].includes(status)) {
      await this.prisma.reminder.updateMany({
        where: { bookingId: id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });

      // Fire-and-forget calendar sync — remove event
      this.calendarSyncService.syncBookingToCalendar(booking, 'cancel').catch(() => {});
    }

    // Create follow-up reminder when booking is completed
    if (status === 'COMPLETED') {
      const settings = await this.businessService.getNotificationSettings(businessId);
      const delayHours = settings?.followUpDelayHours || 2;
      await this.prisma.reminder.create({
        data: {
          businessId,
          bookingId: id,
          scheduledAt: new Date(Date.now() + delayHours * 3600000),
          status: 'PENDING',
          type: 'FOLLOW_UP',
        },
      });

      // Schedule consult follow-up for CONSULT bookings
      if (booking.service?.kind === 'CONSULT') {
        const delayDays = settings?.consultFollowUpDays || 3;
        await this.prisma.reminder.create({
          data: {
            businessId,
            bookingId: id,
            scheduledAt: new Date(Date.now() + delayDays * 24 * 3600000),
            status: 'PENDING',
            type: 'CONSULT_FOLLOW_UP',
          },
        });
      }

      // Schedule aftercare + treatment check-in for TREATMENT bookings
      if (booking.service?.kind === 'TREATMENT') {
        await this.prisma.reminder.create({
          data: {
            businessId,
            bookingId: id,
            scheduledAt: new Date(),
            status: 'PENDING',
            type: 'AFTERCARE',
          },
        });

        const checkInHours = settings?.treatmentCheckInHours || 24;
        await this.prisma.reminder.create({
          data: {
            businessId,
            bookingId: id,
            scheduledAt: new Date(Date.now() + checkInHours * 3600000),
            status: 'PENDING',
            type: 'TREATMENT_CHECK_IN',
          },
        });
      }
    }

    return booking;
  }

  async sendDepositRequest(businessId: string, id: string) {
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      include: { customer: true, service: true, staff: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'PENDING_DEPOSIT') {
      throw new BadRequestException('Booking is not in PENDING_DEPOSIT status');
    }

    await this.notificationService.sendDepositRequest(booking);

    const existingFields = (booking.customFields as any) || {};
    const log = Array.isArray(existingFields.depositRequestLog)
      ? existingFields.depositRequestLog
      : [];
    log.push({ sentAt: new Date().toISOString() });

    return this.prisma.booking.update({
      where: { id, businessId },
      data: { customFields: { ...existingFields, depositRequestLog: log } },
      include: { customer: true, service: true, staff: true },
    });
  }

  async getCalendar(businessId: string, dateFrom: string, dateTo: string, staffId?: string) {
    const where: any = {
      businessId,
      status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
      startTime: { gte: new Date(dateFrom) },
      endTime: { lte: new Date(dateTo) },
    };
    if (staffId) where.staffId = staffId;

    return this.prisma.booking.findMany({
      where,
      include: {
        customer: true,
        service: true,
        staff: true,
        recurringSeries: { select: { id: true } },
      },
      orderBy: { startTime: 'asc' },
    });
  }
}
