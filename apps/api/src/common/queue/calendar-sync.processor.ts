import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { QUEUE_NAMES } from './queue.module';

export interface CalendarSyncJobData {
  businessId: string;
  bookingId: string;
  staffId: string;
  action: 'create' | 'update' | 'cancel';
}

@Processor(QUEUE_NAMES.CALENDAR_SYNC)
export class CalendarSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(CalendarSyncProcessor.name);

  async process(job: Job<CalendarSyncJobData>): Promise<void> {
    const { businessId, bookingId, staffId, action } = job.data;
    this.logger.log(
      `Processing calendar sync job ${job.id}: ${action} booking ${bookingId} for staff ${staffId}`,
    );

    const { CalendarSyncService } =
      await import('../../modules/calendar-sync/calendar-sync.service');
    const calendarSyncService = (this as any).moduleRef?.get(CalendarSyncService);

    if (!calendarSyncService) {
      throw new Error('CalendarSyncService not available — cannot process job');
    }

    const { PrismaService } = await import('../prisma.service');
    const prisma = (this as any).moduleRef?.get(PrismaService);

    if (!prisma) {
      throw new Error('PrismaService not available — cannot process job');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { customer: true, service: true, staff: true },
    });

    if (!booking) {
      this.logger.warn(`Booking ${bookingId} not found — skipping calendar sync`);
      return;
    }

    try {
      await calendarSyncService.syncBookingToCalendar(
        {
          id: booking.id,
          staffId: booking.staffId,
          externalCalendarEventId: booking.externalCalendarEventId,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          customer: { name: booking.customer.name },
          service: { name: booking.service.name },
          staff: booking.staff ? { name: booking.staff.name } : null,
        },
        action,
      );
    } catch (err) {
      this.logger.error(
        `Calendar sync failed for job ${job.id}, booking ${bookingId}: ${(err as Error).message}`,
        (err as Error).stack,
      );
      throw err;
    }
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<CalendarSyncJobData>, error: Error) {
    this.logger.warn(
      `Calendar sync job ${job.id} failed (attempt ${job.attemptsMade}/${job.opts?.attempts || 1}): ${error.message}`,
    );
  }
}
