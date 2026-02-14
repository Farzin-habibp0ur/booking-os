import { Injectable } from '@nestjs/common';
import { MockProvider, MessagingProvider } from '@booking-os/messaging-provider';

@Injectable()
export class MessagingService {
  private provider: MockProvider;

  constructor() {
    // In dev, always use MockProvider. In production, would use WhatsAppCloudProvider.
    this.provider = new MockProvider();
  }

  getProvider(): MessagingProvider {
    return this.provider;
  }

  getMockProvider(): MockProvider {
    return this.provider;
  }
}
