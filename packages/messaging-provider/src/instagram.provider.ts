import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

export interface InstagramConfig {
  pageId: string;
  pageAccessToken: string;
  apiVersion?: string;
}

export class InstagramProvider implements MessagingProvider {
  name = 'instagram';
  private config: InstagramConfig;
  private apiBase: string;

  constructor(config: InstagramConfig) {
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

      // Instagram doesn't support caption on media — send text separately if present
      if (msg.body && msg.body !== `[${msg.mediaType}]`) {
        // Send the media first, then text as a follow-up
        const mediaResponse = await this.makeRequest('/me/messages', payload);
        const textPayload = {
          recipient: { id: msg.to },
          message: { text: msg.body.slice(0, 1000) },
        };
        const textResponse = await this.makeRequest('/me/messages', textPayload);
        return { externalId: textResponse.message_id || mediaResponse.message_id || '' };
      }
    } else {
      // Send text message
      payload = {
        recipient: { id: msg.to },
        message: { text: msg.body.slice(0, 1000) },
      };
    }

    const response = await this.makeRequest('/me/messages', payload);
    return { externalId: response.message_id || '' };
  }

  /**
   * Send a message with the HUMAN_AGENT tag (extends window to 7 days).
   */
  async sendHumanAgentMessage(msg: OutboundMessage): Promise<{ externalId: string }> {
    const payload = {
      recipient: { id: msg.to },
      message: { text: msg.body.slice(0, 1000) },
      messaging_type: 'MESSAGE_TAG',
      tag: 'HUMAN_AGENT',
    };

    const response = await this.makeRequest('/me/messages', payload);
    return { externalId: response.message_id || '' };
  }

  /**
   * Configure ice breaker prompts for the Instagram account.
   */
  async setIceBreakers(prompts: Array<{ question: string; payload: string }>): Promise<void> {
    const payload = {
      platform: 'instagram',
      ice_breakers: prompts.map((p) => ({
        call_to_actions: [{ question: p.question, payload: p.payload }],
      })),
    };
    await this.makeRequest('/me/messenger_profile', payload);
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
          throw new Error(`Instagram API error ${response.status}: ${errorBody}`);
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

    throw lastError || new Error('Instagram API request failed after retries');
  }

  /**
   * Download media from Instagram by media URL or attachment ID.
   */
  async downloadMedia(mediaUrl: string): Promise<{ buffer: Buffer; contentType: string }> {
    const response = await fetch(mediaUrl, {
      headers: { Authorization: `Bearer ${this.config.pageAccessToken}` },
    });
    if (!response.ok) throw new Error(`Failed to download Instagram media: ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    return { buffer, contentType };
  }

  /**
   * Parse Instagram's inbound webhook payload into a normalized format.
   * Instagram webhook structure:
   * { object: "instagram", entry: [{ id, time, messaging: [{ sender, recipient, timestamp, message }] }] }
   */
  static parseInboundWebhook(payload: any): Array<{
    from: string;
    body: string;
    externalId: string;
    timestamp: string;
    instagramPageId: string;
    mediaType?: 'image' | 'video' | 'audio' | 'file';
    mediaUrl?: string;
    storyReplyUrl?: string;
    referral?: { source: string; type: string };
    postback?: string;
  }> {
    const messages: Array<{
      from: string;
      body: string;
      externalId: string;
      timestamp: string;
      instagramPageId: string;
      mediaType?: 'image' | 'video' | 'audio' | 'file';
      mediaUrl?: string;
      storyReplyUrl?: string;
      referral?: { source: string; type: string };
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
            instagramPageId: pageId,
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
            // Story reply
            if (att.type === 'story_mention' || msg.reply_to?.story) {
              parsed.storyReplyUrl = att.payload?.url || msg.reply_to?.story?.url;
            }
          }

          // Story reply via reply_to field
          if (msg.reply_to?.story) {
            parsed.storyReplyUrl = msg.reply_to.story.url;
          }

          messages.push(parsed);
        }

        // Postback (ice breaker tap / quick reply)
        if (event.postback) {
          messages.push({
            from: senderId,
            body: event.postback.title || event.postback.payload || '[postback]',
            externalId: `postback_${senderId}_${timestamp}`,
            timestamp,
            instagramPageId: pageId,
            postback: event.postback.payload,
          });
        }

        // Referral (ad click, story mention link, etc.)
        if (event.referral && !event.message) {
          messages.push({
            from: senderId,
            body: event.referral.ad_id ? `[Ad referral: ${event.referral.ad_id}]` : '[Referral]',
            externalId: `referral_${senderId}_${timestamp}`,
            timestamp,
            instagramPageId: pageId,
            referral: {
              source: event.referral.source || '',
              type: event.referral.type || '',
            },
          });
        }
      }
    }

    return messages;
  }

  /**
   * Parse Instagram delivery/read status webhooks.
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
