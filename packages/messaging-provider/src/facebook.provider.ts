import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

export interface FacebookConfig {
  pageId: string;
  pageAccessToken: string;
  apiVersion?: string;
}

export class FacebookProvider implements MessagingProvider {
  name = 'facebook';
  private config: FacebookConfig;
  private apiBase: string;

  constructor(config: FacebookConfig) {
    this.config = config;
    const version = config.apiVersion || 'v21.0';
    this.apiBase = `https://graph.facebook.com/${version}`;
  }

  async sendMessage(msg: OutboundMessage): Promise<{ externalId: string }> {
    let payload: any;

    if (msg.mediaUrl && msg.mediaType) {
      // Send media message via attachment
      payload = {
        recipient: { id: msg.to },
        message: {
          attachment: {
            type: msg.mediaType === 'document' ? 'file' : msg.mediaType,
            payload: { url: msg.mediaUrl, is_reusable: false },
          },
        },
      };

      // Facebook supports caption — send text separately if present
      if (msg.body && msg.body !== `[${msg.mediaType}]`) {
        const mediaResponse = await this.makeRequest('/me/messages', payload);
        const textPayload = {
          recipient: { id: msg.to },
          message: { text: msg.body.slice(0, 2000) },
        };
        const textResponse = await this.makeRequest('/me/messages', textPayload);
        return { externalId: textResponse.message_id || mediaResponse.message_id || '' };
      }
    } else {
      // Send text message (Facebook Messenger supports up to 2000 chars)
      payload = {
        recipient: { id: msg.to },
        message: { text: msg.body.slice(0, 2000) },
      };
    }

    const response = await this.makeRequest('/me/messages', payload);
    return { externalId: response.message_id || '' };
  }

  /**
   * Send a message with the HUMAN_AGENT tag (extends 24h window to 7 days).
   */
  async sendHumanAgentMessage(msg: OutboundMessage): Promise<{ externalId: string }> {
    const payload = {
      recipient: { id: msg.to },
      message: { text: msg.body.slice(0, 2000) },
      messaging_type: 'MESSAGE_TAG',
      tag: 'HUMAN_AGENT',
    };

    const response = await this.makeRequest('/me/messages', payload);
    return { externalId: response.message_id || '' };
  }

  /**
   * Configure ice breaker prompts for the Facebook Messenger page.
   */
  async setIceBreakers(prompts: Array<{ question: string; payload: string }>): Promise<void> {
    const payload = {
      ice_breakers: prompts.map((p) => ({
        call_to_actions: [{ question: p.question, payload: p.payload }],
      })),
    };
    await this.makeRequest('/me/messenger_profile', payload);
  }

  /**
   * Get page info (id and name).
   */
  async getPageInfo(): Promise<{ id: string; name: string }> {
    const response = await fetch(
      `${this.apiBase}/me?fields=id,name&access_token=${this.config.pageAccessToken}`,
    );
    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Facebook API error ${response.status}: ${errorBody}`);
    }
    const data = (await response.json()) as { id: string; name: string };
    return { id: data.id, name: data.name };
  }

  /**
   * Check if within the standard 24-hour messaging window.
   */
  isWithinMessagingWindow(lastUserMessageAt: Date): boolean {
    const windowMs = 24 * 60 * 60 * 1000; // 24 hours
    return Date.now() - lastUserMessageAt.getTime() < windowMs;
  }

  /**
   * Check if within the 7-day HUMAN_AGENT messaging window.
   */
  isWithinHumanAgentWindow(lastUserMessageAt: Date): boolean {
    const windowMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    return Date.now() - lastUserMessageAt.getTime() < windowMs;
  }

  /**
   * Send a template message with buttons and/or quick replies.
   */
  async sendTemplateMessage(
    psid: string,
    template: {
      text: string;
      buttons?: Array<{
        type: 'web_url' | 'postback';
        title: string;
        url?: string;
        payload?: string;
      }>;
      quickReplies?: Array<{ title: string; payload: string }>;
    },
  ): Promise<{ externalId: string }> {
    const message: any = {};

    if (template.buttons && template.buttons.length > 0) {
      message.attachment = {
        type: 'template',
        payload: {
          template_type: 'button',
          text: template.text.slice(0, 640),
          buttons: template.buttons.slice(0, 3).map((b) => ({
            type: b.type,
            title: b.title.slice(0, 20),
            ...(b.type === 'web_url' ? { url: b.url } : { payload: b.payload }),
          })),
        },
      };
    } else {
      message.text = template.text.slice(0, 2000);
    }

    if (template.quickReplies && template.quickReplies.length > 0) {
      message.quick_replies = template.quickReplies.slice(0, 13).map((qr) => ({
        content_type: 'text',
        title: qr.title.slice(0, 20),
        payload: qr.payload,
      }));
    }

    const payload = { recipient: { id: psid }, message };
    const response = await this.makeRequest('/me/messages', payload);
    return { externalId: response.message_id || '' };
  }

  private async makeRequest(path: string, body: any, retries = 3): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch(`${this.apiBase}${path}`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.config.pageAccessToken}`,
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
          throw new Error(`Facebook API error ${response.status}: ${errorBody}`);
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

    throw lastError || new Error('Facebook API request failed after retries');
  }

  /**
   * Parse Facebook Messenger's inbound webhook payload into a normalized format.
   * Facebook Messenger webhook structure:
   * { object: "page", entry: [{ id, time, messaging: [{ sender, recipient, timestamp, message }] }] }
   */
  static parseInboundWebhook(payload: any): Array<{
    from: string;
    body: string;
    externalId: string;
    timestamp: string;
    pageId: string;
    mediaType?: 'image' | 'video' | 'audio' | 'file';
    mediaUrl?: string;
    referral?: { source: string; type: string; ref?: string };
    postback?: string;
  }> {
    const messages: Array<{
      from: string;
      body: string;
      externalId: string;
      timestamp: string;
      pageId: string;
      mediaType?: 'image' | 'video' | 'audio' | 'file';
      mediaUrl?: string;
      referral?: { source: string; type: string; ref?: string };
      postback?: string;
    }> = [];

    if (!payload?.entry) return messages;

    for (const entry of payload.entry) {
      const pageId = entry.id || '';

      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        if (!senderId) continue;

        // Skip messages sent by the page itself
        if (senderId === pageId) continue;

        const timestamp = event.timestamp?.toString() || '';

        // Standard message
        if (event.message) {
          const msg = event.message;
          const parsed: (typeof messages)[0] = {
            from: senderId,
            body: msg.text || '',
            externalId: msg.mid || '',
            timestamp,
            pageId,
          };

          // Media attachments
          if (msg.attachments?.length > 0) {
            const att = msg.attachments[0];
            if (['image', 'video', 'audio', 'file'].includes(att.type)) {
              parsed.mediaType = att.type;
              parsed.mediaUrl = att.payload?.url;
              if (!parsed.body) {
                parsed.body = `[${att.type}]`;
              }
            }
          }

          messages.push(parsed);
        }

        // Postback (persistent menu tap / get started / quick reply)
        if (event.postback) {
          messages.push({
            from: senderId,
            body: event.postback.title || event.postback.payload || '[postback]',
            externalId: `postback_${senderId}_${timestamp}`,
            timestamp,
            pageId,
            postback: event.postback.payload,
            ...(event.postback.referral && {
              referral: {
                source: event.postback.referral.source || '',
                type: event.postback.referral.type || '',
                ref: event.postback.referral.ref,
              },
            }),
          });
        }

        // Referral (ad click, m.me link, etc.)
        if (event.referral && !event.message && !event.postback) {
          messages.push({
            from: senderId,
            body: event.referral.ad_id ? `[Ad referral: ${event.referral.ad_id}]` : '[Referral]',
            externalId: `referral_${senderId}_${timestamp}`,
            timestamp,
            pageId,
            referral: {
              source: event.referral.source || '',
              type: event.referral.type || '',
              ref: event.referral.ref,
            },
          });
        }
      }
    }

    return messages;
  }

  /**
   * Parse Facebook Messenger delivery/read status webhooks.
   */
  static parseStatusWebhook(payload: any): Array<{
    messageId: string;
    status: 'delivered' | 'read';
    timestamp: string;
  }> {
    const statuses: Array<{
      messageId: string;
      status: 'delivered' | 'read';
      timestamp: string;
    }> = [];

    if (!payload?.entry) return statuses;

    for (const entry of payload.entry) {
      for (const event of entry.messaging || []) {
        if (event.delivery?.mids) {
          for (const mid of event.delivery.mids) {
            statuses.push({
              messageId: mid,
              status: 'delivered',
              timestamp: event.timestamp?.toString() || '',
            });
          }
        }
        if (event.read) {
          statuses.push({
            messageId: event.read.mid || `read_${event.read.watermark}`,
            status: 'read',
            timestamp: event.timestamp?.toString() || '',
          });
        }
      }
    }

    return statuses;
  }
}
