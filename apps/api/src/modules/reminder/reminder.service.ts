import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private prisma: PrismaService,
    private notificationService: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async processPendingReminders() {
    const now = new Date();
    const dueReminders = await this.prisma.reminder.findMany({
      where: {
        status: 'PENDING',
        scheduledAt: { lte: now },
      },
      include: {
        booking: {
          include: { customer: true, service: true, staff: true, business: true },
        },
      },
      take: 50,
    });

    for (const reminder of dueReminders) {
      try {
        const { booking } = reminder;
        if (['CANCELLED', 'NO_SHOW'].includes(booking.status)) {
          await this.prisma.reminder.update({
            where: { id: reminder.id },
            data: { status: 'CANCELLED' },
          });
          continue;
        }

        const type = (reminder as any).type || 'REMINDER';
        if (type === 'CONSULT_FOLLOW_UP') {
          // Check if customer already booked a treatment after the consult
          const treatmentBooking = await this.prisma.booking.findFirst({
            where: {
              customerId: booking.customerId,
              businessId: booking.businessId,
              service: { kind: 'TREATMENT' },
              createdAt: { gte: booking.updatedAt },
            },
          });
          if (treatmentBooking) {
            await this.prisma.reminder.update({
              where: { id: reminder.id },
              data: { status: 'CANCELLED' },
            });
            continue;
          }

          // Check if customer opted out
          const customer = await this.prisma.customer.findUnique({
            where: { id: booking.customerId },
          });
          const customFields = (customer?.customFields as any) || {};
          if (customFields.consultFollowUpOptOut) {
            await this.prisma.reminder.update({
              where: { id: reminder.id },
              data: { status: 'CANCELLED' },
            });
            continue;
          }

          await this.notificationService.sendConsultFollowUp(booking);
        } else if (type === 'AFTERCARE') {
          await this.notificationService.sendAftercare(booking);
        } else if (type === 'TREATMENT_CHECK_IN') {
          await this.notificationService.sendTreatmentCheckIn(booking);
        } else if (type === 'FOLLOW_UP') {
          await this.notificationService.sendFollowUp(booking);
        } else {
          await this.notificationService.sendReminder(booking);
        }

        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'SENT', sentAt: new Date() },
        });

        this.logger.log(`Sent reminder for booking ${booking.id} to ${booking.customer.phone}`);
      } catch (error) {
        this.logger.error(`Failed to send reminder ${reminder.id}:`, error);
        await this.prisma.reminder.update({
          where: { id: reminder.id },
          data: { status: 'FAILED' },
        });
      }
    }
  }
}
