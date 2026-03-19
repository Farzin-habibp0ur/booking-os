import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

export interface EmailProviderConfig {
  provider: 'resend' | 'sendgrid';
  apiKey: string;
  fromAddress: string;
}

export class EmailChannelProvider implements MessagingProvider {
  name = 'email';
  private config: EmailProviderConfig;

  constructor(config: EmailProviderConfig) {
    this.config = config;
  }

  async sendMessage(msg: OutboundMessage): Promise<{ externalId: string }> {
    throw new Error('Email channel provider not yet implemented — Phase 2 pending');
  }

  static parseInboundWebhook(payload: any): Array<{
    from: string;
    body: string;
    externalId: string;
    subject?: string;
  }> {
    // Stub — Phase 2 will implement email inbound parsing
    return [];
  }
}
