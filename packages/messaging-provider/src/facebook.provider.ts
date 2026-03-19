import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

export interface FacebookConfig {
  pageId: string;
  pageAccessToken: string;
}

export class FacebookProvider implements MessagingProvider {
  name = 'facebook';
  private config: FacebookConfig;

  constructor(config: FacebookConfig) {
    this.config = config;
  }

  async sendMessage(msg: OutboundMessage): Promise<{ externalId: string }> {
    throw new Error('Facebook Messenger provider not yet implemented — Phase 1 pending');
  }

  static parseInboundWebhook(payload: any): Array<{
    from: string;
    body: string;
    externalId: string;
    pageId: string;
  }> {
    // Stub — Phase 1 will implement Meta Messenger webhook parsing
    return [];
  }
}
