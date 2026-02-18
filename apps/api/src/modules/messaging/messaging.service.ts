import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MockProvider,
  WhatsAppCloudProvider,
  MessagingProvider,
} from '@booking-os/messaging-provider';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private provider: MessagingProvider;
  private mockProvider?: MockProvider;
  private providerRegistry = new Map<string, WhatsAppCloudProvider>();

  constructor(private configService: ConfigService) {
    const providerName = this.configService.get<string>('MESSAGING_PROVIDER', 'mock');

    if (providerName === 'whatsapp-cloud') {
      const phoneNumberId = this.configService.get<string>('WHATSAPP_PHONE_NUMBER_ID');
      const accessToken = this.configService.get<string>('WHATSAPP_ACCESS_TOKEN');

      if (!phoneNumberId || !accessToken) {
        this.logger.warn(
          'WhatsApp Cloud API credentials not configured, falling back to MockProvider',
        );
        this.mockProvider = new MockProvider();
        this.provider = this.mockProvider;
      } else {
        const provider = new WhatsAppCloudProvider({ phoneNumberId, accessToken });
        this.provider = provider;
        this.providerRegistry.set(phoneNumberId, provider);
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

  /** Get provider for a specific phone number ID (falls back to default) */
  getProviderForPhoneNumberId(phoneNumberId: string): MessagingProvider {
    return this.providerRegistry.get(phoneNumberId) || this.provider;
  }

  /** Register a WhatsApp Cloud provider for a specific phone number */
  registerProvider(phoneNumberId: string, accessToken: string): WhatsAppCloudProvider {
    const existing = this.providerRegistry.get(phoneNumberId);
    if (existing) return existing;

    const provider = new WhatsAppCloudProvider({ phoneNumberId, accessToken });
    this.providerRegistry.set(phoneNumberId, provider);
    this.logger.log(`Registered WhatsApp provider for phoneNumberId: ${phoneNumberId}`);
    return provider;
  }

  /** Get provider for a location's WhatsApp config (lazy-registers if needed) */
  getProviderForLocationConfig(whatsappConfig: Record<string, any> | null): MessagingProvider {
    if (!whatsappConfig?.phoneNumberId || !whatsappConfig?.accessToken) {
      return this.provider;
    }
    return this.registerProvider(whatsappConfig.phoneNumberId, whatsappConfig.accessToken);
  }

  /** Get the number of registered providers */
  getRegisteredProviderCount(): number {
    return this.providerRegistry.size;
  }

  getMockProvider(): MockProvider {
    if (!this.mockProvider) {
      throw new InternalServerErrorException(
        'Mock provider not available — using WhatsApp Cloud in production',
      );
    }
    return this.mockProvider;
  }

  isWhatsAppCloud(): boolean {
    return this.provider.name === 'whatsapp-cloud';
  }
}
