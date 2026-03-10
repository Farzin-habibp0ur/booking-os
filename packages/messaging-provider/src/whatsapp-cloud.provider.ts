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
    let payload: any;

    if (msg.mediaUrl && msg.mediaType) {
      // Send media message
      const mediaPayload: any = { link: msg.mediaUrl };
      if (msg.body) mediaPayload.caption = msg.body;
      if (msg.fileName && msg.mediaType === 'document') mediaPayload.filename = msg.fileName;

      payload = {
        messaging_product: 'whatsapp',
        to: msg.to,
        type: msg.mediaType,
        [msg.mediaType]: mediaPayload,
      };
    } else {
      // Send text message
      payload = {
        messaging_product: 'whatsapp',
        to: msg.to,
        type: 'text',
        text: { body: msg.body },
      };
    }

    const response = await this.makeRequest('/messages', payload);
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
   * Download media from WhatsApp by media ID.
   * Returns the media buffer and content type.
   */
  async downloadMedia(mediaId: string): Promise<{ buffer: Buffer; contentType: string }> {
    const version = this.config.apiVersion || 'v21.0';
    // Step 1: Get media URL
    const urlRes = await fetch(`https://graph.facebook.com/${version}/${mediaId}`, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    if (!urlRes.ok) throw new Error(`Failed to get media URL: ${urlRes.status}`);
    const { url } = (await urlRes.json()) as { url: string };

    // Step 2: Download media from URL
    const mediaRes = await fetch(url, {
      headers: { Authorization: `Bearer ${this.config.accessToken}` },
    });
    if (!mediaRes.ok) throw new Error(`Failed to download media: ${mediaRes.status}`);
    const buffer = Buffer.from(await mediaRes.arrayBuffer());
    const contentType = mediaRes.headers.get('content-type') || 'application/octet-stream';

    return { buffer, contentType };
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
    mediaType?: 'image' | 'document' | 'audio' | 'video';
    mediaId?: string;
    mimeType?: string;
    fileName?: string;
  }> {
    const messages: Array<{
      from: string;
      body: string;
      externalId: string;
      timestamp: string;
      businessPhoneNumberId: string;
      mediaType?: 'image' | 'document' | 'audio' | 'video';
      mediaId?: string;
      mimeType?: string;
      fileName?: string;
    }> = [];

    if (!payload?.entry) return messages;

    const MEDIA_TYPES = ['image', 'document', 'audio', 'video'] as const;

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
          } else if (MEDIA_TYPES.includes(msg.type)) {
            const mediaData = msg[msg.type] || {};
            messages.push({
              from: msg.from,
              body: mediaData.caption || `[${msg.type}]`,
              externalId: msg.id,
              timestamp: msg.timestamp,
              businessPhoneNumberId: phoneNumberId,
              mediaType: msg.type,
              mediaId: mediaData.id,
              mimeType: mediaData.mime_type,
              fileName: mediaData.filename,
            });
          }
        }
      }
    }

    return messages;
  }
}
