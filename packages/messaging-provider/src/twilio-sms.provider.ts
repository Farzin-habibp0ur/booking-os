import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

interface TwilioSmsConfig {
  accountSid: string;
  authToken: string;
  fromNumber: string;
}

export class TwilioSmsProvider implements MessagingProvider {
  name = 'twilio-sms';
  private config: TwilioSmsConfig;
  private apiBase: string;

  constructor(config: TwilioSmsConfig) {
    this.config = config;
    this.apiBase = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}`;
  }

  async sendMessage(msg: OutboundMessage): Promise<{ externalId: string }> {
    const url = `${this.apiBase}/Messages.json`;
    const params = new URLSearchParams({
      To: msg.to,
      From: this.config.fromNumber,
      Body: msg.body,
    });

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
   * Parse Twilio's inbound webhook payload into a normalized format.
   */
  static parseInboundWebhook(body: Record<string, string>): {
    from: string;
    body: string;
    externalId: string;
    timestamp: string;
  } | null {
    if (!body.From || !body.Body || !body.MessageSid) return null;

    return {
      from: body.From,
      body: body.Body,
      externalId: body.MessageSid,
      timestamp: new Date().toISOString(),
    };
  }
}
