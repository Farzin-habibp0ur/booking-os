import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MockProvider,
  WhatsAppCloudProvider,
  TwilioSmsProvider,
  InstagramProvider,
  MessagingProvider,
} from '@booking-os/messaging-provider';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private provider: MessagingProvider;
  private mockProvider?: MockProvider;
  private smsProvider?: TwilioSmsProvider;
  private providerRegistry = new Map<string, WhatsAppCloudProvider>();
  private instagramProviderRegistry = new Map<string, InstagramProvider>();

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

    // Initialize Twilio SMS provider if credentials are available
    const twilioSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const twilioToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const twilioNumber = this.configService.get<string>('TWILIO_PHONE_NUMBER');

    if (twilioSid && twilioToken && twilioNumber) {
      this.smsProvider = new TwilioSmsProvider({
        accountSid: twilioSid,
        authToken: twilioToken,
        fromNumber: twilioNumber,
      });
      this.logger.log('Twilio SMS provider initialized');
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

  getSmsProvider(): TwilioSmsProvider | null {
    return this.smsProvider || null;
  }

  isSmsAvailable(): boolean {
    return !!this.smsProvider;
  }

  /** Register an Instagram provider for a specific page ID */
  registerInstagramProvider(pageId: string, accessToken: string): InstagramProvider {
    const existing = this.instagramProviderRegistry.get(pageId);
    if (existing) return existing;

    const provider = new InstagramProvider({ pageId, pageAccessToken: accessToken });
    this.instagramProviderRegistry.set(pageId, provider);
    this.logger.log(`Registered Instagram provider for pageId: ${pageId}`);
    return provider;
  }

  /** Get Instagram provider for a specific page ID */
  getProviderForInstagramPageId(pageId: string): InstagramProvider | null {
    return this.instagramProviderRegistry.get(pageId) || null;
  }

  /** Get Instagram provider for a location's Instagram config (lazy-registers if needed) */
  getProviderForLocationInstagramConfig(
    instagramConfig: Record<string, any> | null,
  ): InstagramProvider | null {
    if (!instagramConfig?.pageId || !instagramConfig?.pageAccessToken) {
      return null;
    }
    return this.registerInstagramProvider(instagramConfig.pageId, instagramConfig.pageAccessToken);
  }

  isInstagramAvailable(): boolean {
    return this.instagramProviderRegistry.size > 0;
  }

  /**
   * Resolve the correct messaging provider for a conversation based on its channel
   * and associated location config. This is the primary method for outbound message routing.
   */
  getProviderForConversation(
    channel: string,
    locationInstagramConfig?: Record<string, any> | null,
    locationWhatsappConfig?: Record<string, any> | null,
  ): MessagingProvider {
    if (channel === 'INSTAGRAM') {
      const igProvider = this.getProviderForLocationInstagramConfig(
        locationInstagramConfig || null,
      );
      if (igProvider) return igProvider;
      this.logger.warn('Instagram provider not found for conversation, falling back to default');
    }

    if (channel === 'SMS') {
      const sms = this.getSmsProvider();
      if (sms) return sms;
    }

    // WhatsApp or fallback
    if (locationWhatsappConfig) {
      return this.getProviderForLocationConfig(locationWhatsappConfig);
    }

    return this.provider;
  }
}
