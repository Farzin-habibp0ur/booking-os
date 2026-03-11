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
  service: {
    id: string;
    name: string;
    durationMins: number;
    depositRequired?: boolean;
    depositAmount?: number | null;
    price?: number;
  };
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

      if (channels === 'sms') {
        await this.dispatchSms(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Booking Confirmed - ${booking.service.name} at ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      await this.logNotificationEvent(booking.id, 'sent', 'CONFIRMATION');

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

      await this.logNotificationEvent(booking.id, 'sent', 'REMINDER');

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

      await this.logNotificationEvent(booking.id, 'sent', 'FOLLOW_UP');

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

      await this.logNotificationEvent(booking.id, 'sent', 'CONSULT_FOLLOW_UP');

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

      await this.logNotificationEvent(booking.id, 'sent', 'AFTERCARE');

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

      await this.logNotificationEvent(booking.id, 'sent', 'TREATMENT_CHECK_IN');

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

      await this.logNotificationEvent(booking.id, 'sent', 'DEPOSIT_REQUIRED');

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

      await this.logNotificationEvent(booking.id, 'sent', 'RESCHEDULE_LINK');

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

      await this.logNotificationEvent(booking.id, 'sent', 'CANCEL_LINK');

      this.logger.log(`Sent cancel link for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send cancel link for ${booking.id}:`, error);
    }
  }

  async sendCancellationNotification(booking: BookingWithRelations): Promise<void> {
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

      const body = await this.resolveTemplate(booking.businessId, 'CANCELLATION', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Appointment Cancelled - ${booking.service.name} at ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      await this.logNotificationEvent(booking.id, 'sent', 'CANCELLATION');

      this.logger.log(`Sent cancellation notification for ${booking.id} via ${channels}`);
    } catch (error) {
      this.logger.error(`Failed to send cancellation notification for ${booking.id}:`, error);
    }
  }

  async sendKanbanStatusUpdate(booking: BookingWithRelations, kanbanStatus: string): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const statusMessages: Record<string, string> = {
        CHECKED_IN: 'Your vehicle has been checked in and is in our queue.',
        DIAGNOSING: 'Our technician is currently diagnosing your vehicle.',
        AWAITING_APPROVAL:
          'We have prepared a service quote for your vehicle. Please review and approve.',
        IN_PROGRESS: 'Work on your vehicle is now in progress.',
        READY_FOR_PICKUP: 'Your vehicle is ready for pickup!',
      };

      const statusMessage = statusMessages[kanbanStatus] || `Status updated to ${kanbanStatus}`;

      const context = {
        customerName: booking.customer.name,
        serviceName: booking.service.name,
        businessName,
        statusMessage,
      };

      const body = await this.resolveTemplate(booking.businessId, 'CUSTOM', context);
      // Use the status update message directly since CUSTOM templates may not match
      const finalBody = `Hi ${context.customerName}, update from ${businessName}: ${statusMessage}`;

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, finalBody, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Service Update - ${businessName}`;
          const html = this.wrapInEmailHtml(finalBody, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      await this.logNotificationEvent(booking.id, 'sent', `KANBAN_${kanbanStatus}`);

      this.logger.log(`Sent kanban status update (${kanbanStatus}) for ${booking.id}`);
    } catch (error) {
      this.logger.error(`Failed to send kanban status update for ${booking.id}:`, error);
    }
  }

  async sendQuoteApprovalRequest(
    booking: BookingWithRelations,
    totalAmount: number,
    description: string,
    approvalLink: string,
  ): Promise<void> {
    try {
      const channels = await this.getChannelPreference(booking.businessId);
      const business =
        booking.business || (await this.businessService.findById(booking.businessId));
      const businessName = business?.name || 'Our Business';

      const formattedAmount = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(totalAmount);

      const body = `Hi ${booking.customer.name}, ${businessName} has prepared a service quote for your ${booking.service.name}.\n\nTotal: ${formattedAmount}\n${description}\n\nPlease review and approve here: ${approvalLink}`;

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `Quote Approval Required - ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      await this.logNotificationEvent(booking.id, 'sent', 'QUOTE_APPROVAL_REQUEST');

      this.logger.log(`Sent quote approval request for booking ${booking.id}`);
    } catch (error) {
      this.logger.error(`Failed to send quote approval request for ${booking.id}:`, error);
    }
  }

  async sendWaitlistOffer(
    entry: {
      customer: { name: string; phone: string; email?: string | null };
      service: { name: string };
      business?: { name: string } | null;
    },
    slot: { date: string; time: string; staffName?: string },
    claimLink: string,
    businessId: string,
  ): Promise<void> {
    try {
      const channels = await this.getChannelPreference(businessId);
      const business = entry.business || (await this.businessService.findById(businessId));
      const businessName = (business as any)?.name || 'Our Business';

      const context = {
        customerName: entry.customer.name,
        serviceName: entry.service.name,
        date: slot.date,
        time: slot.time,
        staffName: slot.staffName || '',
        businessName,
        claimLink,
      };

      const body = await this.resolveTemplate(businessId, 'WAITLIST_OFFER', context);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(entry.customer.phone, body, businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (entry.customer.email) {
          const subject = `A slot opened for ${entry.service.name} at ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(entry.customer.email, subject, html);
        }
      }

      this.logger.log(`Sent waitlist offer for ${entry.service.name} to ${entry.customer.name}`);
    } catch (error) {
      this.logger.error(`Failed to send waitlist offer:`, error);
    }
  }

  async sendCampaignMessage(
    customer: { name: string; phone: string; email?: string | null },
    body: string,
    businessId: string,
  ): Promise<void> {
    try {
      const channels = await this.getChannelPreference(businessId);
      const business = await this.businessService.findById(businessId);
      const businessName = (business as any)?.name || 'Our Business';

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(customer.phone, body, businessId);
      }

      if (channels === 'email' || channels === 'both') {
        if (customer.email) {
          const subject = `Message from ${businessName}`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(customer.email, subject, html);
        }
      }

      this.logger.log(`Sent campaign message to ${customer.name}`);
    } catch (error) {
      this.logger.error(`Failed to send campaign message to ${customer.name}:`, error);
    }
  }

  async logNotificationEvent(bookingId: string, type: string, category: string): Promise<void> {
    try {
      const booking = await this.prisma.booking.findUnique({
        where: { id: bookingId },
        select: { customFields: true },
      });

      const existingFields = (booking?.customFields as any) || {};
      const notificationLog = Array.isArray(existingFields.notificationLog)
        ? existingFields.notificationLog
        : [];

      notificationLog.push({ type, category, sentAt: new Date().toISOString() });

      await this.prisma.booking.update({
        where: { id: bookingId },
        data: {
          customFields: {
            ...existingFields,
            notificationLog,
          },
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log notification event for ${bookingId}:`, error);
    }
  }

  async sendReviewRequest(booking: BookingWithRelations): Promise<void> {
    try {
      const business = await this.businessService.findById(booking.businessId);
      if (!business) return;

      const packConfig =
        typeof business.packConfig === 'object' && business.packConfig
          ? (business.packConfig as Record<string, unknown>)
          : {};
      const reviewUrl = packConfig.googleReviewUrl as string | undefined;
      if (!reviewUrl) return;

      const businessName = business.name || 'Our Business';
      const customerName = booking.customer.name;

      const body = `Hi ${customerName}, thanks for visiting ${businessName} today! If you had a great experience, we'd love your feedback: ${reviewUrl}`;

      const channels = await this.getChannelPreference(booking.businessId);

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(booking.customer.phone, body, booking.businessId);
      }
      if (channels === 'email' || channels === 'both') {
        if (booking.customer.email) {
          const subject = `How was your visit to ${businessName}?`;
          const html = this.wrapInEmailHtml(body, businessName);
          await this.dispatchEmail(booking.customer.email, subject, html);
        }
      }

      await this.logNotificationEvent(booking.id, 'review_request_sent', 'REVIEW_REQUEST');
      this.logger.log(`Review request sent for booking ${booking.id}`);
    } catch (error) {
      this.logger.error(`Failed to send review request for booking ${booking.id}:`, error);
    }
  }

  async sendTreatmentPlanProposal(
    customer: { name: string; phone: string; email?: string | null },
    business: { id: string; name: string },
    sessionCount: number,
    planLink: string,
  ): Promise<void> {
    try {
      const channels = await this.getChannelPreference(business.id);
      const body = `Hi ${customer.name}, your treatment plan from ${business.name} is ready for review! It includes ${sessionCount} session(s). View your plan at: ${planLink}`;

      if (channels === 'whatsapp' || channels === 'both') {
        await this.dispatchWhatsApp(customer.phone, body, business.id);
      }
      if (channels === 'email' || channels === 'both') {
        if (customer.email) {
          const subject = `Treatment Plan Ready - ${business.name}`;
          const html = this.wrapInEmailHtml(body, business.name);
          await this.dispatchEmail(customer.email, subject, html);
        }
      }

      this.logger.log(`Treatment plan proposal notification sent to ${customer.phone}`);
    } catch (error) {
      this.logger.error(`Failed to send treatment plan proposal notification:`, error);
    }
  }

  async sendAftercareStepMessage(
    phone: string,
    email: string | undefined,
    body: string,
    subject: string,
    channel: string,
    business: { id: string; name: string },
  ): Promise<void> {
    try {
      if (channel === 'WHATSAPP' || channel === 'BOTH') {
        await this.dispatchWhatsApp(phone, body, business.id);
      }
      if (channel === 'EMAIL' || channel === 'BOTH') {
        if (email) {
          const html = this.wrapInEmailHtml(body, business.name);
          await this.dispatchEmail(email, subject, html);
        }
      }
      if (channel === 'SMS') {
        await this.dispatchSms(phone, body, business.id);
      }
      this.logger.log(`Sent aftercare step message via ${channel} to ${phone}`);
    } catch (error) {
      this.logger.error(`Failed to send aftercare step message to ${phone}:`, error);
      throw error;
    }
  }

  private async getChannelPreference(
    businessId: string,
  ): Promise<'email' | 'whatsapp' | 'sms' | 'both'> {
    const settings = await this.businessService.getNotificationSettings(businessId);
    const channels = settings?.channels || 'both';
    if (['email', 'whatsapp', 'sms', 'both'].includes(channels)) {
      return channels as 'email' | 'whatsapp' | 'sms' | 'both';
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
      CANCELLATION: `Hi ${context.customerName}, your ${context.serviceName} on ${context.date} at ${context.time} at ${context.businessName} has been cancelled. Contact us if you need to rebook.`,
      WAITLIST_OFFER: `Hi ${context.customerName}, great news! A slot has opened for ${context.serviceName} on ${context.date} at ${context.time}${context.staffName ? ` with ${context.staffName}` : ''} at ${context.businessName}. Claim it here: ${context.claimLink || ''}`,
      CAMPAIGN: `Hi ${context.customerName}, ${context.businessName} has a message for you.`,
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

  async dispatchSms(to: string, body: string, businessId: string): Promise<void> {
    const smsProvider = this.messagingService.getSmsProvider();
    if (!smsProvider) {
      this.logger.warn(`SMS not available — skipping SMS to ${to}`);
      return;
    }
    await smsProvider.sendMessage({ to, body, businessId });
  }

  private wrapInEmailHtml(body: string, businessName: string): string {
    const bodyContent = `
<h2 style="margin:0 0 16px 0;font-size:20px;color:#1E293B;">${businessName}</h2>
<p style="margin:0;font-size:16px;line-height:1.6;color:#334155;white-space:pre-line;">${body}</p>`;
    return this.emailService.buildBrandedHtml(bodyContent);
  }
}
