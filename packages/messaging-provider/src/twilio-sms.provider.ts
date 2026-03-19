import * as crypto from 'crypto';
import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

export interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
  statusCallbackUrl?: string;
}

export class TwilioSmsProvider implements MessagingProvider {
  name = 'twilio-sms';
  private config: TwilioSmsConfig;
  private apiBase: string;

  constructor(config: TwilioSmsConfig) {
    this.config = config;
    this.apiBase = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}`;
  }

  async sendMessage(msg: OutboundMessage & { mediaUrl?: string }): Promise<{ externalId: string }> {
    const url = `${this.apiBase}/Messages.json`;
    const params = new URLSearchParams({
      To: msg.to,
      From: this.config.fromNumber,
      Body: msg.body,
    });

    if (msg.mediaUrl) {
      params.append('MediaUrl', msg.mediaUrl);
    }

    if (this.config.statusCallbackUrl) {
      params.append('StatusCallback', this.config.statusCallbackUrl);
    }

    const credentials = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString(
      'base64',
    );

    const response = await this.makeRequest(url, params.toString(), credentials);
    return { externalId: response.sid || '' };
  }

  private async makeRequest(
    url: string,
    body: string,
    credentials: string,
    retries = 3,
  ): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body,
        });

        if (response.status === 429) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Twilio API error ${response.status}: ${errorBody}`);
        }

        return await response.json();
      } catch (err: any) {
        lastError = err;
        if (attempt < retries - 1) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error('Twilio API request failed after retries');
  }

  /**
   * Validate Twilio request signature (X-Twilio-Signature header).
   * See: https://www.twilio.com/docs/usage/security#validating-requests
   */
  static validateSignature(
    authToken: string,
    signature: string,
    url: string,
    params: Record<string, string>,
  ): boolean {
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    for (const key of sortedKeys) {
      data += key + params[key];
    }
    const expected = crypto.createHmac('sha1', authToken).update(data).digest('base64');
    return expected === signature;
  }

  /**
   * Classify common Twilio error codes into categories.
   */
  static classifyError(errorCode: number): {
    category: string;
    retriable: boolean;
    description: string;
  } {
    const errors: Record<number, { category: string; retriable: boolean; description: string }> = {
      21211: { category: 'INVALID_NUMBER', retriable: false, description: 'Invalid phone number' },
      21214: { category: 'INVALID_NUMBER', retriable: false, description: 'Non-mobile number' },
      21408: { category: 'PERMISSION', retriable: false, description: 'Permission denied' },
      21610: { category: 'UNSUBSCRIBED', retriable: false, description: 'Number opted out' },
      21612: { category: 'CAPABILITY', retriable: false, description: 'Cannot receive SMS' },
      30001: { category: 'QUEUE', retriable: true, description: 'Queue overflow' },
      30002: { category: 'SUSPENDED', retriable: false, description: 'Account suspended' },
      30003: { category: 'UNREACHABLE', retriable: true, description: 'Unreachable number' },
      30004: { category: 'BLOCKED', retriable: false, description: 'Message blocked' },
      30005: { category: 'UNKNOWN', retriable: true, description: 'Unknown destination' },
      30006: {
        category: 'LANDLINE',
        retriable: false,
        description: 'Landline or unreachable carrier',
      },
      30007: {
        category: 'FILTERED',
        retriable: false,
        description: 'Message filtered by carrier',
      },
      30008: { category: 'UNKNOWN', retriable: true, description: 'Unknown error' },
    };
    return (
      errors[errorCode] || {
        category: 'UNKNOWN',
        retriable: true,
        description: `Error code ${errorCode}`,
      }
    );
  }

  /**
   * Parse Twilio's inbound webhook payload into a normalized format.
   * Supports MMS media attachments and geo metadata.
   */
  static parseInboundWebhook(body: Record<string, string>): {
    from: string;
    to: string;
    body: string;
    externalId: string;
    numMedia: number;
    mediaUrls: string[];
    numSegments: number;
    fromCity?: string;
    fromState?: string;
    fromCountry?: string;
    timestamp: string;
  } | null {
    if (!body.From || !body.MessageSid) return null;

    const numMedia = parseInt(body.NumMedia || '0', 10);
    const mediaUrls: string[] = [];
    for (let i = 0; i < numMedia; i++) {
      if (body[`MediaUrl${i}`]) mediaUrls.push(body[`MediaUrl${i}`]);
    }

    return {
      from: body.From,
      to: body.To || '',
      body: body.Body || '',
      externalId: body.MessageSid,
      numMedia,
      mediaUrls,
      numSegments: parseInt(body.NumSegments || '1', 10),
      fromCity: body.FromCity,
      fromState: body.FromState,
      fromCountry: body.FromCountry,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Parse Twilio's status callback webhook payload.
   */
  static parseStatusWebhook(body: Record<string, string>): {
    messageSid: string;
    status: string;
    errorCode?: number;
    errorMessage?: string;
  } | null {
    if (!body.MessageSid || !body.MessageStatus) return null;
    return {
      messageSid: body.MessageSid,
      status: body.MessageStatus,
      errorCode: body.ErrorCode ? parseInt(body.ErrorCode, 10) : undefined,
      errorMessage: body.ErrorMessage,
    };
  }
}
