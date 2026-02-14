import { OutboundMessage, InboundMessage } from '@booking-os/shared';

export interface MessagingProvider {
  name: string;
  sendMessage(msg: OutboundMessage): Promise<{ externalId: string }>;
  onInboundMessage?(handler: (msg: InboundMessage) => void): void;
}
