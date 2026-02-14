import { OutboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

export class WhatsAppCloudProvider implements MessagingProvider {
  name = 'whatsapp-cloud';

  async sendMessage(_msg: OutboundMessage): Promise<{ externalId: string }> {
    // TODO: Implement WhatsApp Cloud API integration
    throw new Error('WhatsApp Cloud API provider not yet implemented');
  }
}
