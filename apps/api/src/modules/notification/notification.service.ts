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
  service: { id: string; name: string; durationMins: number; depositRequired?: boolean; depositAmount?: number | null; price?: number };
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
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
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
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
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
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
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

  async sendConsultFollowUp(booking: BookingWithRelations): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';
      const slug = (business as any)?.slug || '';
      const bookingLink = slug ? `${slug}/book` : '';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
        bookingLink,
      };

      const body = await this.resolveTemplate(booking.businessId, 'CONSULT_FOLLOW_UP', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Ready for your treatment? - ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent consult follow-up for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send consult follow-up for ${booking.id}:`, error);
    }
  }

  async sendAftercare(booking: BookingWithRelations): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
      };

      const body = await this.resolveTemplate(booking.businessId, 'AFTERCARE', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Aftercare instructions - ${booking.service.name} at ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent aftercare for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send aftercare for ${booking.id}:`, error);
    }
  }

  async sendTreatmentCheckIn(booking: BookingWithRelations): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
      };

      const body = await this.resolveTemplate(booking.businessId, 'TREATMENT_CHECK_IN', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `How are you feeling? - ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent treatment check-in for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send treatment check-in for ${booking.id}:`, error);
    }
  }

  async sendDepositRequest(booking: BookingWithRelations): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';
      const depositAmount = booking.service.depositAmount || booking.service.price || 0;

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
        depositAmount: `${depositAmount}`,
      };

      const body = await this.resolveTemplate(booking.businessId, 'DEPOSIT_REQUIRED', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Deposit required - ${booking.service.name} at ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent deposit request for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send deposit request for ${booking.id}:`, error);
    }
  }

  async sendRescheduleLink(booking: BookingWithRelations, rescheduleLink: string): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
        rescheduleLink,
      };

      const body = await this.resolveTemplate(booking.businessId, 'RESCHEDULE_LINK', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Reschedule your appointment - ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent reschedule link for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send reschedule link for ${booking.id}:`, error);
    }
  }

  async sendCancelLink(booking: BookingWithRelations, cancelLink: string): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        date: booking.startTime.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: booking.startTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
        staffName: booking.staff?.name || '',
        businessName,
        cancelLink,
      };

      const body = await this.resolveTemplate(booking.businessId, 'CANCEL_LINK', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Cancel your appointment - ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent cancel link for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send cancel link for ${booking.id}:`, error);
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

  private async resolveTemplate(
    businessId: string,
    category: string,
    context: any,
  ): Promise<string> {
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
      CONSULT_FOLLOW_UP: `Hi ${context.customerName}, we hope your consultation at ${context.businessName} was helpful! Ready to move forward with treatment?${context.bookingLink ? ` Book here: ${context.bookingLink}` : ''}`,
      AFTERCARE: `Hi ${context.customerName}, thank you for your ${context.serviceName} at ${context.businessName}! Here are your aftercare reminders: avoid direct sun exposure, keep the area clean, and contact us if you have any concerns.`,
      TREATMENT_CHECK_IN: `Hi ${context.customerName}, it's been 24 hours since your ${context.serviceName} at ${context.businessName}. How are you feeling? Let us know if you have any questions or concerns.`,
      DEPOSIT_REQUIRED: `Hi ${context.customerName}, your ${context.serviceName} at ${context.businessName} on ${context.date} at ${context.time} requires a deposit of $${context.depositAmount || '0'} to confirm. Please complete your payment to secure your appointment.`,
      RESCHEDULE_LINK: `Hi ${context.customerName}, need to reschedule your ${context.serviceName} on ${context.date} at ${context.time}? Use this link: ${context.rescheduleLink || ''}`,
      CANCEL_LINK: `Hi ${context.customerName}, need to cancel your ${context.serviceName} on ${context.date} at ${context.time}? Use this link: ${context.cancelLink || ''}`,
    };

    return (
      defaults[category] ||
      `Hi ${context.customerName}, this is a message from ${context.businessName}.`
    );
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
