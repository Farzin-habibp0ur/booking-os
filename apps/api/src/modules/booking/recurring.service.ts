import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';
import { CalendarSyncService } from '../calendar-sync/calendar-sync.service';

@Injectable()
export class RecurringService {
  private readonly logger = new Logger(RecurringService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
    private calendarSyncService: CalendarSyncService,
  ) {}

  /**
   * Pure function: generates occurrence dates for a recurring series.
   * Returns an array of Date objects, max 52 occurrences.
   */
  generateOccurrenceDates(
    startDate: Date,
    timeOfDay: string,
    daysOfWeek: number[],
    intervalWeeks: number,
    count?: number,
    endDate?: Date,
  ): Date[] {
    const maxCount = Math.min(count || 52, 52);
    const [hours, minutes] = timeOfDay.split(':').map(Number);
    const dates: Date[] = [];

    // Start from the beginning of the week containing startDate
    const cursor = new Date(startDate);
    cursor.setHours(0, 0, 0, 0);
    const dayOfWeek = cursor.getDay();
    cursor.setDate(cursor.getDate() - dayOfWeek); // go to Sunday of that week

    const sortedDays = [...daysOfWeek].sort((a, b) => a - b);

    while (dates.length < maxCount) {
      for (const day of sortedDays) {
        const occurrence = new Date(cursor);
        occurrence.setDate(occurrence.getDate() + day);
        occurrence.setHours(hours, minutes, 0, 0);

        // Skip dates before startDate
        if (occurrence < startDate) continue;

        // Stop if past endDate
        if (endDate && occurrence > endDate) return dates;

        dates.push(occurrence);
        if (dates.length >= maxCount) return dates;
      }

      // Advance cursor by intervalWeeks
      cursor.setDate(cursor.getDate() + intervalWeeks * 7);
    }

    return dates;
  }

  async createSeries(
    businessId: string,
    data: {
      customerId: string;
      serviceId: string;
      staffId?: string;
      startDate: string;
      timeOfDay: string;
      daysOfWeek: number[];
      intervalWeeks: number;
      totalCount?: number;
      endsAt?: string;
      notes?: string;
    },
  ) {
    const service = await this.prisma.service.findFirst({
      where: { id: data.serviceId, businessId },
    });
    if (!service) throw new BadRequestException('Service not found');

    const startDate = new Date(data.startDate);
    if (startDate < new Date()) {
      throw new BadRequestException('Start date must be in the future');
    }

    const endDate = data.endsAt ? new Date(data.endsAt) : undefined;

    const occurrenceDates = this.generateOccurrenceDates(
      startDate,
      data.timeOfDay,
      data.daysOfWeek,
      data.intervalWeeks,
      data.totalCount,
      endDate,
    );

    if (occurrenceDates.length === 0) {
      throw new BadRequestException('No occurrences could be generated with the given parameters');
    }

    // Batch conflict detection
    if (data.staffId) {
      for (const date of occurrenceDates) {
        const occurrenceEnd = new Date(date.getTime() + service.durationMins * 60000);
        const conflict = await this.prisma.booking.findFirst({
          where: {
            businessId,
            staffId: data.staffId,
            status: { in: ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'] },
            startTime: { lt: occurrenceEnd },
            endTime: { gt: date },
          },
        });
        if (conflict) {
          throw new BadRequestException(
            `Staff has a conflicting booking on ${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} at ${data.timeOfDay}`,
          );
        }
      }
    }

    // Create series + all bookings in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const series = await tx.recurringSeries.create({
        data: {
          businessId,
          customerId: data.customerId,
          serviceId: data.serviceId,
          staffId: data.staffId,
          timeOfDay: data.timeOfDay,
          daysOfWeek: data.daysOfWeek,
          intervalWeeks: data.intervalWeeks,
          totalCount: occurrenceDates.length,
          endsAt: endDate,
          notes: data.notes,
        },
      });

      const bookings = [];
      for (const date of occurrenceDates) {
        const endTime = new Date(date.getTime() + service.durationMins * 60000);
        const booking = await tx.booking.create({
          data: {
            businessId,
            customerId: data.customerId,
            serviceId: data.serviceId,
            staffId: data.staffId,
            recurringSeriesId: series.id,
            startTime: date,
            endTime,
            notes: data.notes,
            status: 'CONFIRMED',
          },
          include: { customer: true, service: true, staff: true },
        });
        bookings.push(booking);

        // Auto-create 24h reminder
        const reminderTime = new Date(date.getTime() - 24 * 60 * 60 * 1000);
        if (reminderTime > new Date()) {
          await tx.reminder.create({
            data: {
              businessId,
              bookingId: booking.id,
              scheduledAt: reminderTime,
              status: 'PENDING',
            },
          });
        }
      }

      return { series, bookings };
    });

    // Fire-and-forget notifications and calendar sync per occurrence
    for (const booking of result.bookings) {
      this.notificationService.sendBookingConfirmation(booking).catch((err) =>
        this.logger.warn(`Failed to send confirmation for recurring booking ${booking.id}`, {
          bookingId: booking.id,
          seriesId: result.series.id,
          error: err.message,
        }),
      );
      this.calendarSyncService.syncBookingToCalendar(booking, 'create').catch((err) =>
        this.logger.warn(`Failed to sync recurring booking ${booking.id} to calendar`, {
          bookingId: booking.id,
          seriesId: result.series.id,
          error: err.message,
        }),
      );
    }

    return {
      ...result.series,
      bookings: result.bookings,
    };
  }

  async getSeriesById(businessId: string, seriesId: string) {
    const series = await this.prisma.recurringSeries.findFirst({
      where: { id: seriesId, businessId },
      include: {
        bookings: {
          include: { customer: true, service: true, staff: true },
          orderBy: { startTime: 'asc' },
        },
        customer: true,
        service: true,
        staff: true,
      },
    });
    if (!series) throw new NotFoundException('Recurring series not found');
    return series;
  }

  async cancelSeries(
    businessId: string,
    seriesId: string,
    scope: 'single' | 'future' | 'all',
    bookingId?: string,
  ) {
    const series = await this.prisma.recurringSeries.findFirst({
      where: { id: seriesId, businessId },
      include: {
        bookings: {
          orderBy: { startTime: 'asc' },
          include: { customer: true, service: true, staff: true },
        },
      },
    });
    if (!series) throw new NotFoundException('Recurring series not found');

    const cancellableStatuses = ['PENDING', 'PENDING_DEPOSIT', 'CONFIRMED', 'IN_PROGRESS'];
    let bookingsToCancel: typeof series.bookings;

    if (scope === 'single') {
      if (!bookingId) throw new BadRequestException('bookingId is required for single cancel');
      bookingsToCancel = series.bookings.filter(
        (b) => b.id === bookingId && cancellableStatuses.includes(b.status),
      );
    } else if (scope === 'future') {
      if (!bookingId) throw new BadRequestException('bookingId is required for future cancel');
      const fromBooking = series.bookings.find((b) => b.id === bookingId);
      if (!fromBooking) throw new BadRequestException('Booking not found in series');
      bookingsToCancel = series.bookings.filter(
        (b) => b.startTime >= fromBooking.startTime && cancellableStatuses.includes(b.status),
      );
    } else {
      // scope === 'all'
      bookingsToCancel = series.bookings.filter((b) => cancellableStatuses.includes(b.status));
    }

    // Cancel bookings and their reminders
    for (const booking of bookingsToCancel) {
      await this.prisma.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELLED' },
      });
      await this.prisma.reminder.updateMany({
        where: { bookingId: booking.id, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      });
      this.calendarSyncService.syncBookingToCalendar(booking, 'cancel').catch((err) =>
        this.logger.warn(`Failed to sync cancellation for recurring booking ${booking.id}`, {
          bookingId: booking.id,
          seriesId: seriesId,
          error: err.message,
        }),
      );
    }

    return { cancelled: bookingsToCancel.length };
  }
}
