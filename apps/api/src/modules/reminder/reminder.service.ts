import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { MessagingService } from '../messaging/messaging.service';
import { WhatsAppCloudProvider } from '@booking-os/messaging-provider';

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

        const provider = this.messagingService.getProvider();

        // When using WhatsApp Cloud API, reminders are business-initiated messages
        // that require pre-approved templates (outside 24h customer service window)
        if (this.messagingService.isWhatsAppCloud() && provider instanceof WhatsAppCloudProvider) {
          await provider.sendTemplateMessage({
            to: booking.customer.phone,
            templateName: 'appointment_reminder',
            languageCode: booking.business.defaultLocale || 'en',
            components: [
              {
                type: 'body',
                parameters: [
                  { type: 'text', text: booking.customer.name },
                  { type: 'text', text: booking.service.name },
                  { type: 'text', text: time },
                  { type: 'text', text: booking.staff?.name || booking.business.name },
                ],
              },
            ],
            businessId: booking.businessId,
          });
        } else {
          // Mock provider or fallback — send plain text
          const body = `Hi ${booking.customer.name}! Reminder: your ${booking.service.name} is scheduled for ${time}${booking.staff ? ` with ${booking.staff.name}` : ''} at ${booking.business.name}. Reply YES to confirm.`;

          await provider.sendMessage({
            to: booking.customer.phone,
            body,
            businessId: booking.businessId,
          });
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
