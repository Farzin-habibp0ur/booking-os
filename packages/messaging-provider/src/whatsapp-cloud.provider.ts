import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

interface WhatsAppCloudConfig {
  phoneNumberId: string;
  accessToken: string;
  apiVersion?: string;
}

interface WhatsAppTemplateMessage {
  to: string;
  templateName: string;
  languageCode: string;
  components?: Array<{
    type: string;
    parameters: Array<{ type: string; text: string }>;
  }>;
  businessId: string;
}

export class WhatsAppCloudProvider implements MessagingProvider {
  name = 'whatsapp-cloud';
  private config: WhatsAppCloudConfig;
  private apiBase: string;

  constructor(config: WhatsAppCloudConfig) {
    this.config = config;
    const version = config.apiVersion || 'v21.0';
    this.apiBase = `https://graph.facebook.com/${version}/${config.phoneNumberId}`;
  }

  async sendMessage(msg: OutboundMessage): Promise<{ externalId: string }> {
    const response = await this.makeRequest('/messages', {
      messaging_product: 'whatsapp',
      to: msg.to,
      type: 'text',
      text: { body: msg.body },
    });

    return { externalId: response.messages?.[0]?.id || '' };
  }

  async sendTemplateMessage(msg: WhatsAppTemplateMessage): Promise<{ externalId: string }> {
    const payload: any = {
      messaging_product: 'whatsapp',
      to: msg.to,
      type: 'template',
      template: {
        name: msg.templateName,
        language: { code: msg.languageCode },
      },
    };

    if (msg.components) {
      payload.template.components = msg.components;
    }

    const response = await this.makeRequest('/messages', payload);
    return { externalId: response.messages?.[0]?.id || '' };
  }

  private async makeRequest(path: string, body: any, retries = 3): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`${this.apiBase}${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (response.status === 429) {
          // Rate limited — exponential backoff
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise((resolve) => setTimeout(resolve, delay));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`WhatsApp API error ${response.status}: ${errorBody}`);
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

    throw lastError || new Error('WhatsApp API request failed after retries');
  }

  /**
   * Parse Meta's inbound webhook payload into a normalized format.
   * Returns an array of inbound messages extracted from the payload.
   */
  static parseInboundWebhook(payload: any): Array<{
    from: string;
    body: string;
    externalId: string;
    timestamp: string;
    businessPhoneNumberId: string;
  }> {
    const messages: Array<{
      from: string;
      body: string;
      externalId: string;
      timestamp: string;
      businessPhoneNumberId: string;
    }> = [];

    if (!payload?.entry) return messages;

    for (const entry of payload.entry) {
      for (const change of entry.changes || []) {
        const value = change.value;
        if (!value?.messages) continue;

        const phoneNumberId = value.metadata?.phone_number_id || '';

        for (const msg of value.messages) {
          if (msg.type === 'text' && msg.text?.body) {
            messages.push({
              from: msg.from,
              body: msg.text.body,
              externalId: msg.id,
              timestamp: msg.timestamp,
              businessPhoneNumberId: phoneNumberId,
            });
          }
        }
      }
    }

    return messages;
  }
}
