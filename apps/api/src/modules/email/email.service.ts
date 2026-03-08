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
 * - Booking confirmations & reminders
 * - Password reset
 * - Email verification
 * - Staff invitation emails
 * - Payment receipts
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private provider: string;
  private apiKey: string | undefined;

  constructor(private configService: ConfigService) {
    this.provider = this.configService.get<string>('EMAIL_PROVIDER', 'none');
    this.apiKey =
      this.configService.get<string>('EMAIL_API_KEY') ||
      this.configService.get<string>('RESEND_API_KEY');

    if (this.provider === 'none' || !this.apiKey) {
      this.logger.warn('Email provider not configured — emails will be logged only');
    }
  }

  async send(options: EmailOptions): Promise<boolean> {
    const from =
      options.from || this.configService.get<string>('EMAIL_FROM') || 'noreply@booking-os.com';

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
        Authorization: `Bearer ${this.apiKey}`,
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
        Authorization: `Bearer ${this.apiKey}`,
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

  // ─── Branded email layout ────────────────────────────────────────────

  /**
   * Wraps email body content in the Booking OS branded layout.
   * Uses inline CSS for maximum email client compatibility.
   */
  buildBrandedHtml(bodyContent: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Booking OS</title>
</head>
<body style="margin:0;padding:0;background-color:#F7F7F8;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F7F7F8;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background-color:#FFFFFF;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
<!-- Header -->
<tr><td style="background-color:#71907C;padding:28px 32px;text-align:center;">
<span style="font-size:22px;font-weight:700;color:#FFFFFF;letter-spacing:0.5px;">Booking OS</span>
</td></tr>
<!-- Body -->
<tr><td style="padding:32px 32px 24px 32px;color:#1E293B;font-size:16px;line-height:1.6;">
${bodyContent}
</td></tr>
<!-- Footer -->
<tr><td style="padding:20px 32px 28px 32px;border-top:1px solid #E4EBE6;text-align:center;">
<p style="margin:0 0 4px 0;font-size:12px;color:#94A3B8;">Powered by Booking OS</p>
<p style="margin:0;font-size:12px;color:#CBD5E1;">You received this email because of your account or booking activity.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
  }

  // ─── Convenience methods ─────────────────────────────────────────────

  async sendBookingConfirmation(
    to: string,
    data: {
      customerName: string;
      serviceName: string;
      dateTime: string;
      businessName: string;
      staffName?: string;
      locationAddress?: string;
    },
  ) {
    const staffLine = data.staffName
      ? `<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Provider</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.staffName}</td></tr>`
      : '';
    const locationLine = data.locationAddress
      ? `<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Location</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.locationAddress}</td></tr>`
      : '';

    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">Booking Confirmed</h2>
<p style="margin:0 0 24px 0;color:#64748B;">Hi ${data.customerName}, your appointment has been confirmed.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7F5;border-radius:12px;padding:20px;margin-bottom:24px;">
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Service</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.serviceName}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Date &amp; Time</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.dateTime}</td></tr>
${staffLine}
${locationLine}
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Business</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.businessName}</td></tr>
</table>
<p style="margin:0;font-size:14px;color:#64748B;">Thank you for choosing ${data.businessName}!</p>`;

    return this.send({
      to,
      subject: `Booking Confirmed - ${data.serviceName} at ${data.businessName}`,
      html: this.buildBrandedHtml(body),
    });
  }

  async sendBookingReminder(
    to: string,
    data: {
      customerName: string;
      serviceName: string;
      dateTime: string;
      businessName: string;
      staffName?: string;
    },
  ) {
    const staffLine = data.staffName ? ` with ${data.staffName}` : '';

    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">Appointment Reminder</h2>
<p style="margin:0 0 24px 0;color:#64748B;">Hi ${data.customerName}, this is a friendly reminder about your upcoming appointment.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F5F3FA;border-radius:12px;padding:20px;margin-bottom:24px;">
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Service</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.serviceName}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Date &amp; Time</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.dateTime}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Business</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.businessName}${staffLine}</td></tr>
</table>
<p style="margin:0;font-size:14px;color:#64748B;">We look forward to seeing you!</p>`;

    return this.send({
      to,
      subject: `Appointment Reminder - ${data.serviceName} tomorrow`,
      html: this.buildBrandedHtml(body),
    });
  }

  async sendPasswordReset(to: string, data: { name: string; resetUrl: string }) {
    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">Reset Your Password</h2>
<p style="margin:0 0 24px 0;color:#64748B;">Hi ${data.name}, we received a request to reset your password.</p>
<p style="margin:0 0 24px 0;">
<a href="${data.resetUrl}" style="display:inline-block;padding:14px 32px;background-color:#71907C;color:#FFFFFF;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;">Reset Password</a>
</p>
<p style="margin:0 0 8px 0;font-size:14px;color:#64748B;">This link expires in <strong>1 hour</strong>.</p>
<p style="margin:0;font-size:13px;color:#94A3B8;">If you didn't request this, you can safely ignore this email.</p>`;

    return this.send({
      to,
      subject: 'Reset Your Password - Booking OS',
      html: this.buildBrandedHtml(body),
    });
  }

  async sendStaffInvitation(
    to: string,
    data: { name: string; businessName: string; inviteUrl: string; roleName?: string },
  ) {
    const roleLabel = data.roleName ? ` as <strong>${data.roleName}</strong>` : '';

    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">You're Invited!</h2>
<p style="margin:0 0 24px 0;color:#64748B;">Hi ${data.name}, you've been invited to join <strong>${data.businessName}</strong>${roleLabel} on Booking OS.</p>
<p style="margin:0 0 24px 0;">
<a href="${data.inviteUrl}" style="display:inline-block;padding:14px 32px;background-color:#8A75BD;color:#FFFFFF;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;">Accept Invitation</a>
</p>
<p style="margin:0 0 8px 0;font-size:14px;color:#64748B;">This invitation expires in <strong>48 hours</strong>.</p>
<p style="margin:0;font-size:13px;color:#94A3B8;">If you weren't expecting this, you can safely ignore this email.</p>`;

    return this.send({
      to,
      subject: `You've been invited to join ${data.businessName} on Booking OS`,
      html: this.buildBrandedHtml(body),
    });
  }

  async sendEmailVerification(to: string, data: { name: string; verifyUrl: string }) {
    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">Verify Your Email</h2>
<p style="margin:0 0 24px 0;color:#64748B;">Hi ${data.name}, please confirm your email address to get started.</p>
<p style="margin:0 0 24px 0;">
<a href="${data.verifyUrl}" style="display:inline-block;padding:14px 32px;background-color:#71907C;color:#FFFFFF;text-decoration:none;border-radius:12px;font-size:16px;font-weight:600;">Verify Email</a>
</p>
<p style="margin:0 0 8px 0;font-size:14px;color:#64748B;">This link expires in <strong>24 hours</strong>.</p>
<p style="margin:0;font-size:13px;color:#94A3B8;">If you didn't create an account, you can safely ignore this email.</p>`;

    return this.send({
      to,
      subject: 'Verify Your Email - Booking OS',
      html: this.buildBrandedHtml(body),
    });
  }

  async sendPaymentReceipt(
    to: string,
    data: {
      customerName: string;
      businessName: string;
      serviceName: string;
      amount: string;
      date: string;
      paymentMethod?: string;
      invoiceNumber?: string;
    },
  ) {
    const methodLine = data.paymentMethod
      ? `<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Payment Method</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.paymentMethod}</td></tr>`
      : '';
    const invoiceLine = data.invoiceNumber
      ? `<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Invoice #</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.invoiceNumber}</td></tr>`
      : '';

    const body = `
<h2 style="margin:0 0 8px 0;font-size:22px;color:#1E293B;">Payment Receipt</h2>
<p style="margin:0 0 24px 0;color:#64748B;">Hi ${data.customerName}, here is your payment receipt from ${data.businessName}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F4F7F5;border-radius:12px;padding:20px;margin-bottom:24px;">
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Service</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.serviceName}</td></tr>
<tr><td style="padding:6px 0;color:#64748B;font-size:14px;">Date</td><td style="padding:6px 0;font-size:14px;font-weight:600;text-align:right;">${data.date}</td></tr>
${methodLine}
${invoiceLine}
<tr><td colspan="2" style="padding:12px 0 0 0;border-top:1px solid #E4EBE6;"></td></tr>
<tr><td style="padding:6px 0;color:#1E293B;font-size:16px;font-weight:700;">Total</td><td style="padding:6px 0;font-size:16px;font-weight:700;text-align:right;color:#71907C;">${data.amount}</td></tr>
</table>
<p style="margin:0;font-size:13px;color:#94A3B8;">Keep this email for your records. Contact ${data.businessName} if you have questions about this charge.</p>`;

    return this.send({
      to,
      subject: `Payment Receipt - ${data.businessName}`,
      html: this.buildBrandedHtml(body),
    });
  }
}
