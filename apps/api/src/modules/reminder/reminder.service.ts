import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { MessagingService } from '../messaging/messaging.service';

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private prisma: PrismaService,
    private messagingService: MessagingService,
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

        const time = booking.startTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        });

        const body = `Hi ${booking.customer.name}! Reminder: your ${booking.service.name} is scheduled for ${time}${booking.staff ? ` with ${booking.staff.name}` : ''} at ${booking.business.name}. Reply YES to confirm.`;

        await this.messagingService.getProvider().sendMessage({
          to: booking.customer.phone,
          body,
          businessId: booking.businessId,
        });

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
