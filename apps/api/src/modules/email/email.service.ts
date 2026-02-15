import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
}

/**
 * Email service for sending transactional emails.
 *
 * Supports Resend (recommended) or SendGrid as the provider.
 * Set EMAIL_PROVIDER and the corresponding API key in env vars.
 *
 * Used for:
 * - Booking confirmations
 * - Password reset
 * - Billing receipts/invoices
 * - Staff invitation emails
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private provider: string;
  private apiKey: string | undefined;

  constructor(private configService: ConfigService) {
    this.provider = this.configService.get<string>('EMAIL_PROVIDER', 'none');
    this.apiKey = this.configService.get<string>('EMAIL_API_KEY');

    if (this.provider === 'none' || !this.apiKey) {
      this.logger.warn('Email provider not configured — emails will be logged only');
    }
  }

  async send(options: EmailOptions): Promise<boolean> {
    const from = options.from || this.configService.get<string>('EMAIL_FROM') || 'noreply@booking-os.com';

    if (!this.apiKey || this.provider === 'none') {
      this.logger.log(`[Email] Would send to ${options.to}: ${options.subject}`);
      return true;
    }

    try {
      if (this.provider === 'resend') {
        return await this.sendViaResend({ ...options, from });
      } else if (this.provider === 'sendgrid') {
        return await this.sendViaSendGrid({ ...options, from });
      }
      this.logger.warn(`Unknown email provider: ${this.provider}`);
      return false;
    } catch (err: any) {
      this.logger.error(`Failed to send email to ${options.to}: ${err.message}`);
      return false;
    }
  }

  private async sendViaResend(options: EmailOptions & { from: string }): Promise<boolean> {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from,
        to: [options.to],
        subject: options.subject,
        html: options.html,
      }),
    });

    if (!response.ok) {
      throw new Error(`Resend API error: ${response.status}`);
    }
    return true;
  }

  private async sendViaSendGrid(options: EmailOptions & { from: string }): Promise<boolean> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: options.from },
        subject: options.subject,
        content: [{ type: 'text/html', value: options.html }],
      }),
    });

    if (!response.ok) {
      throw new Error(`SendGrid API error: ${response.status}`);
    }
    return true;
  }

  // Convenience methods
  async sendBookingConfirmation(to: string, data: { customerName: string; serviceName: string; dateTime: string; businessName: string }) {
    return this.send({
      to,
      subject: `Booking Confirmed - ${data.serviceName} at ${data.businessName}`,
      html: `
        <h2>Booking Confirmed</h2>
        <p>Hi ${data.customerName},</p>
        <p>Your appointment for <strong>${data.serviceName}</strong> has been confirmed.</p>
        <p><strong>Date & Time:</strong> ${data.dateTime}</p>
        <p>Thank you for choosing ${data.businessName}!</p>
      `,
    });
  }

  async sendPasswordReset(to: string, data: { name: string; resetUrl: string }) {
    return this.send({
      to,
      subject: 'Reset Your Password',
      html: `
        <h2>Password Reset</h2>
        <p>Hi ${data.name},</p>
        <p>Click the link below to reset your password:</p>
        <p><a href="${data.resetUrl}">Reset Password</a></p>
        <p>This link expires in 1 hour.</p>
      `,
    });
  }

  async sendStaffInvitation(to: string, data: { name: string; businessName: string; inviteUrl: string }) {
    return this.send({
      to,
      subject: `You've been invited to join ${data.businessName} on Booking OS`,
      html: `
        <h2>You're Invited!</h2>
        <p>Hi ${data.name},</p>
        <p>You've been invited to join <strong>${data.businessName}</strong> on Booking OS.</p>
        <p>Click the link below to set your password and get started:</p>
        <p><a href="${data.inviteUrl}">Accept Invitation</a></p>
        <p>This invitation expires in 48 hours.</p>
      `,
    });
  }
}
