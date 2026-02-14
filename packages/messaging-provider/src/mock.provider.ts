import { OutboundMessage, InboundMessage } from '@booking-os/shared';
import { MessagingProvider } from './provider.interface';

interface StoredMessage extends OutboundMessage {
  externalId: string;
  sentAt: Date;
}

export class MockProvider implements MessagingProvider {
  name = 'mock';
  private outbox: StoredMessage[] = [];
  private inboundHandler?: (msg: InboundMessage) => void;

  async sendMessage(msg: OutboundMessage): Promise<{ externalId: string }> {
    const externalId = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.outbox.push({
      ...msg,
      externalId,
      sentAt: new Date(),
    });
    return { externalId };
  }

  onInboundMessage(handler: (msg: InboundMessage) => void): void {
    this.inboundHandler = handler;
  }

  // Simulator-only: get outbound messages for a phone number
  getOutboxForPhone(phone: string): StoredMessage[] {
    return this.outbox.filter((m) => m.to === phone);
  }

  // Simulator-only: get all outbound messages since a timestamp
  getOutboxSince(since: Date): StoredMessage[] {
    return this.outbox.filter((m) => m.sentAt > since);
  }

  // Simulator-only: get all outbound messages
  getFullOutbox(): StoredMessage[] {
    return [...this.outbox];
  }

  // Simulator-only: clear outbox
  clearOutbox(): void {
    this.outbox = [];
  }

  // Simulator-only: inject an inbound message
  simulateInbound(msg: InboundMessage): void {
    this.inboundHandler?.(msg);
  }
}
