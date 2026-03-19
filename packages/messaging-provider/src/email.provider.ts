import * as crypto from 'crypto';
import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

export interface EmailProviderConfig {
  provider: 'resend' | 'sendgrid';
  apiKey: string;
  fromAddress: string;
  fromName?: string;
  replyToAddress?: string;
}

export class EmailChannelProvider implements MessagingProvider {
  name = 'email';
  private config: EmailProviderConfig;

  constructor(config: EmailProviderConfig) {
    this.config = config;
  }

  /**
   * Send an email. The OutboundMessage.to is the recipient email address.
   * msg.body is the plain text body. msg.subject (extended field) is the subject line.
   * Generates proper email headers for thread continuity:
   * - In-Reply-To and References headers if msg.metadata.inReplyTo is set
   * - Message-ID for thread tracking
   */
  async sendMessage(
    msg: OutboundMessage & { subject?: string; htmlBody?: string; inReplyTo?: string },
  ): Promise<{ externalId: string }> {
    if (this.config.provider === 'resend') {
      return this.sendViaResend(msg);
    } else {
      return this.sendViaSendGrid(msg);
    }
  }

  private async sendViaResend(
    msg: OutboundMessage & { subject?: string; htmlBody?: string; inReplyTo?: string },
  ): Promise<{ externalId: string }> {
    const headers: Record<string, string> = {};
    if (msg.inReplyTo) {
      headers['In-Reply-To'] = msg.inReplyTo;
      headers['References'] = msg.inReplyTo;
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.fromName
          ? `${this.config.fromName} <${this.config.fromAddress}>`
          : this.config.fromAddress,
        to: [msg.to],
        subject: msg.subject || 'New message',
        text: msg.body,
        ...(msg.htmlBody && { html: msg.htmlBody }),
        ...(this.config.replyToAddress && { reply_to: this.config.replyToAddress }),
        ...(Object.keys(headers).length > 0 && { headers }),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Resend API error ${response.status}: ${errorBody}`);
    }

    const data = (await response.json()) as { id?: string };
    return { externalId: data.id || '' };
  }

  private async sendViaSendGrid(
    msg: OutboundMessage & { subject?: string; htmlBody?: string; inReplyTo?: string },
  ): Promise<{ externalId: string }> {
    const headers: Record<string, string> = {};
    if (msg.inReplyTo) {
      headers['In-Reply-To'] = msg.inReplyTo;
      headers['References'] = msg.inReplyTo;
    }

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: msg.to }] }],
        from: { email: this.config.fromAddress, name: this.config.fromName || undefined },
        subject: msg.subject || 'New message',
        content: [
          { type: 'text/plain', value: msg.body },
          ...(msg.htmlBody ? [{ type: 'text/html', value: msg.htmlBody }] : []),
        ],
        ...(this.config.replyToAddress && { reply_to: { email: this.config.replyToAddress } }),
        ...(Object.keys(headers).length > 0 && { headers }),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`SendGrid API error ${response.status}: ${errorBody}`);
    }

    // SendGrid doesn't return a message ID in the response body, use x-message-id header
    const messageId = response.headers.get('x-message-id') || `sg_${Date.now()}`;
    return { externalId: messageId };
  }

  /**
   * Parse SendGrid Inbound Parse webhook payload.
   * SendGrid sends multipart/form-data with fields: from, to, subject, text, html, etc.
   */
  static parseInboundWebhook(payload: Record<string, string>): Array<{
    from: string;
    to: string;
    body: string;
    subject: string;
    externalId: string;
    htmlBody?: string;
    inReplyTo?: string;
    messageId?: string;
  }> {
    if (!payload.from || !payload.to) return [];

    // Extract email address from "Name <email>" format
    const fromMatch = payload.from.match(/<([^>]+)>/) || [null, payload.from];
    const fromEmail = fromMatch[1] || payload.from;

    // Strip quoted content from reply (simple approach: remove lines starting with >)
    const rawText = payload.text || '';
    const strippedBody =
      rawText
        .split('\n')
        .filter((line) => !line.startsWith('>') && !line.startsWith('On ') && !line.match(/^-{3,}/))
        .join('\n')
        .trim() || rawText;

    return [
      {
        from: fromEmail.trim(),
        to: (payload.to || '').trim(),
        body: strippedBody,
        subject: payload.subject || '',
        externalId:
          payload['Message-ID'] || `email_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        htmlBody: payload.html,
        inReplyTo: payload['In-Reply-To'],
        messageId: payload['Message-ID'],
      },
    ];
  }

  /**
   * Validate that a domain has proper DNS records for receiving email.
   * Returns a simple check result (in production, you'd verify MX, SPF, DKIM, DMARC).
   */
  /**
   * Verify webhook payload integrity via HMAC-SHA256 with timing-safe comparison.
   */
  static verifyWebhookIntegrity(rawBody: string, signature: string, secret: string): boolean {
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return false;
    return crypto.timingSafeEqual(sigBuf, expBuf);
  }

  static validateDomain(domain: string): {
    valid: boolean;
    checks: Array<{ type: string; status: string }>;
  } {
    // Stub -- in production, perform actual DNS lookups
    return {
      valid: true,
      checks: [
        { type: 'MX', status: 'pending' },
        { type: 'SPF', status: 'pending' },
        { type: 'DKIM', status: 'pending' },
        { type: 'DMARC', status: 'pending' },
      ],
    };
  }
}
