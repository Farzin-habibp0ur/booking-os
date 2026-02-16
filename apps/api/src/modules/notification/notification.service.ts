import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { PrismaService } from '../../common/prisma.service';
import { EmailService } from '../email/email.service';
import { MessagingService } from '../messaging/messaging.service';
import { TemplateService } from '../template/template.service';
import { BusinessService } from '../business/business.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

interface BookingWithRelations {
  id: string;
  businessId: string;
  customer: { id: string; name: string; phone: string; email?: string | null };
  service: { id: string; name: string; durationMins: number };
  staff?: { id: string; name: string } | null;
  business?: { id: string; name: string } | null;
  startTime: Date;
  endTime: Date;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private messagingService: MessagingService,
    private templateService: TemplateService,
    private businessService: BusinessService,
    @Inject('QUEUE_AVAILABLE') private queueAvailable: boolean,
    @Optional() @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationQueue?: Queue,
  ) {}

  async sendBookingConfirmation(booking: BookingWithRelations): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business = booking.business || await this.businessService.findById(booking.businessId);
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
      };

      const body = await this.resolveTemplate(booking.businessId, 'CONFIRMATION', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Booking Confirmed - ${booking.service.name} at ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent booking confirmation for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send booking confirmation for ${booking.id}:`, error);
    }
  }

  async sendReminder(booking: BookingWithRelations): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business = booking.business || await this.businessService.findById(booking.businessId);
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
      };

      const body = await this.resolveTemplate(booking.businessId, 'REMINDER', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Appointment Reminder - ${booking.service.name} at ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent reminder for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send reminder for ${booking.id}:`, error);
    }
  }

  async sendFollowUp(booking: BookingWithRelations): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business = booking.business || await this.businessService.findById(booking.businessId);
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
      };

      const body = await this.resolveTemplate(booking.businessId, 'FOLLOW_UP', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `How was your visit? - ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent follow-up for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send follow-up for ${booking.id}:`, error);
    }
  }

  private async getChannelPreference(businessId: string): Promise<'email' | 'whatsapp' | 'both'> {
    const settings = await this.businessService.getNotificationSettings(businessId);
    const channels = settings?.channels || 'both';
    if (['email', 'whatsapp', 'both'].includes(channels)) {
      return channels as 'email' | 'whatsapp' | 'both';
    }
    return 'both';
  }

  private async resolveTemplate(businessId: string, category: string, context: any): Promise<string> {
    const templates = await this.prisma.messageTemplate.findMany({
      where: { businessId, category },
    });

    if (templates.length > 0) {
      return this.templateService.resolveVariables(templates[0], context);
    }

    // Fallback default messages
    const defaults: Record<string, string> = {
      CONFIRMATION: `Hi ${context.customerName}, your appointment for ${context.serviceName} has been confirmed for ${context.date} at ${context.time}${context.staffName ? ` with ${context.staffName}` : ''}. Thank you for choosing ${context.businessName}!`,
      REMINDER: `Hi ${context.customerName}! Reminder: your ${context.serviceName} is scheduled for ${context.time}${context.staffName ? ` with ${context.staffName}` : ''} at ${context.businessName}. Reply YES to confirm.`,
      FOLLOW_UP: `Hi ${context.customerName}, thank you for visiting ${context.businessName}! We hope you enjoyed your ${context.serviceName}. We'd love to hear your feedback.`,
    };

    return defaults[category] || `Hi ${context.customerName}, this is a message from ${context.businessName}.`;
  }

  private async dispatchEmail(to: string, subject: string, html: string): Promise<void> {
    if (this.queueAvailable && this.notificationQueue) {
      await this.notificationQueue.add('send-email', { to, subject, html });
    } else {
      this.emailService.send({ to, subject, html }).catch((err) => {
        this.logger.error(`Direct email send failed to ${to}:`, err);
      });
    }
  }

  private async dispatchWhatsApp(to: string, body: string, businessId: string): Promise<void> {
    const provider = this.messagingService.getProvider();
    await provider.sendMessage({ to, body, businessId });
  }

  private wrapInEmailHtml(body: string, businessName: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #71907C;">${businessName}</h2>
        <p style="font-size: 16px; line-height: 1.5; color: #333;">${body}</p>
        <hr style="border: none; border-top: 1px solid #E4EBE6; margin: 20px 0;" />
        <p style="font-size: 12px; color: #999;">Sent by ${businessName} via Booking OS</p>
      </div>
    `;
  }
}
