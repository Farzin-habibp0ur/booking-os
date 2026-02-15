import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MockProvider, WhatsAppCloudProvider, MessagingProvider } from '@booking-os/messaging-provider';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private provider: MessagingProvider;
  private mockProvider?: MockProvider;

  constructor(private configService: ConfigService) {
    const providerName = this.configService.get<string>('MESSAGING_PROVIDER', 'mock');

    if (providerName === 'whatsapp-cloud') {
      const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
      const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');

      if (!phoneNumberId || !accessToken) {
        this.logger.warn('WhatsApp Cloud API credentials not configured, falling back to MockProvider');
        this.mockProvider = new MockProvider();
        this.provider = this.mockProvider;
      } else {
        this.provider = new WhatsAppCloudProvider({ phoneNumberId, accessToken });
        this.logger.log('Using WhatsApp Cloud API provider');
      }
    } else {
      this.mockProvider = new MockProvider();
      this.provider = this.mockProvider;
      this.logger.log('Using Mock messaging provider');
    }
  }

  getProvider(): MessagingProvider {
    return this.provider;
  }

  getMockProvider(): MockProvider {
    if (!this.mockProvider) {
      throw new Error('Mock provider not available — using WhatsApp Cloud in production');
    }
    return this.mockProvider;
  }

  isWhatsAppCloud(): boolean {
    return this.provider.name === 'whatsapp-cloud';
  }
}
