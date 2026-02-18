import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { InternalServerErrorException } from '@nestjs/common';
import { MessagingService } from './messaging.service';

describe('MessagingService', () => {
  const createService = async (config: Record<string, string> = {}) => {
    const mockConfigService = {
      get: jest.fn((key: string, def?: string) => config[key] ?? def),
    };
    const module = await Test.createTestingModule({
      providers: [MessagingService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();
    return module.get(MessagingService);
  };

  describe('constructor', () => {
    it('defaults to mock provider', async () => {
      const service = await createService({});

      expect(service.getProvider()).toBeDefined();
      expect(service.isWhatsAppCloud()).toBe(false);
    });

    it('uses mock provider when explicitly set to mock', async () => {
      const service = await createService({ MESSAGING_PROVIDER: 'mock' });

      expect(service.isWhatsAppCloud()).toBe(false);
      expect(service.getMockProvider()).toBeDefined();
    });

    it('falls back to mock when whatsapp-cloud is missing credentials', async () => {
      const service = await createService({ MESSAGING_PROVIDER: 'whatsapp-cloud' });

      expect(service.isWhatsAppCloud()).toBe(false);
      expect(service.getMockProvider()).toBeDefined();
    });

    it('uses WhatsApp Cloud when credentials are provided', async () => {
      const service = await createService({
        MESSAGING_PROVIDER: 'whatsapp-cloud',
        WHATSAPP_PHONE_NUMBER_ID: '1234',
        WHATSAPP_ACCESS_TOKEN: 'token',
      });

      expect(service.isWhatsAppCloud()).toBe(true);
    });
  });

  describe('getProvider', () => {
    it('returns the configured provider', async () => {
      const service = await createService({});

      const provider = service.getProvider();
      expect(provider).toBeDefined();
      expect(provider.name).toBeDefined();
    });
  });

  describe('getMockProvider', () => {
    it('returns mock provider when using mock', async () => {
      const service = await createService({});

      const mock = service.getMockProvider();
      expect(mock).toBeDefined();
    });

    it('throws when using WhatsApp Cloud provider', async () => {
      const service = await createService({
        MESSAGING_PROVIDER: 'whatsapp-cloud',
        WHATSAPP_PHONE_NUMBER_ID: '1234',
        WHATSAPP_ACCESS_TOKEN: 'token',
      });

      expect(() => service.getMockProvider()).toThrow(InternalServerErrorException);
    });
  });

  describe('isWhatsAppCloud', () => {
    it('returns false for mock provider', async () => {
      const service = await createService({});
      expect(service.isWhatsAppCloud()).toBe(false);
    });

    it('returns true for WhatsApp Cloud provider', async () => {
      const service = await createService({
        MESSAGING_PROVIDER: 'whatsapp-cloud',
        WHATSAPP_PHONE_NUMBER_ID: '1234',
        WHATSAPP_ACCESS_TOKEN: 'token',
      });
      expect(service.isWhatsAppCloud()).toBe(true);
    });
  });

  // ─── Provider Registry (Multi-Number) ─────────────────────────────────

  describe('provider registry', () => {
    it('registers the default provider in registry when using whatsapp-cloud', async () => {
      const service = await createService({
        MESSAGING_PROVIDER: 'whatsapp-cloud',
        WHATSAPP_PHONE_NUMBER_ID: '1234',
        WHATSAPP_ACCESS_TOKEN: 'token',
      });

      expect(service.getRegisteredProviderCount()).toBe(1);
    });

    it('returns default provider for unknown phoneNumberId', async () => {
      const service = await createService({});

      const provider = service.getProviderForPhoneNumberId('unknown-id');
      expect(provider).toBe(service.getProvider());
    });

    it('returns registered provider for known phoneNumberId', async () => {
      const service = await createService({
        MESSAGING_PROVIDER: 'whatsapp-cloud',
        WHATSAPP_PHONE_NUMBER_ID: '1234',
        WHATSAPP_ACCESS_TOKEN: 'token',
      });

      const provider = service.getProviderForPhoneNumberId('1234');
      expect(provider.name).toBe('whatsapp-cloud');
    });

    it('registerProvider creates and caches new provider', async () => {
      const service = await createService({});

      const provider = service.registerProvider('5678', 'new-token');

      expect(provider.name).toBe('whatsapp-cloud');
      expect(service.getRegisteredProviderCount()).toBe(1);
      expect(service.getProviderForPhoneNumberId('5678')).toBe(provider);
    });

    it('registerProvider returns existing provider if already registered', async () => {
      const service = await createService({});

      const first = service.registerProvider('5678', 'token');
      const second = service.registerProvider('5678', 'different-token');

      expect(first).toBe(second);
      expect(service.getRegisteredProviderCount()).toBe(1);
    });

    it('supports multiple registered providers', async () => {
      const service = await createService({});

      service.registerProvider('phone1', 'token1');
      service.registerProvider('phone2', 'token2');

      expect(service.getRegisteredProviderCount()).toBe(2);
      expect(service.getProviderForPhoneNumberId('phone1')).not.toBe(
        service.getProviderForPhoneNumberId('phone2'),
      );
    });
  });

  describe('getProviderForLocationConfig', () => {
    it('returns default provider when config is null', async () => {
      const service = await createService({});

      const provider = service.getProviderForLocationConfig(null);
      expect(provider).toBe(service.getProvider());
    });

    it('returns default provider when config has no phoneNumberId', async () => {
      const service = await createService({});

      const provider = service.getProviderForLocationConfig({ accessToken: 'token' });
      expect(provider).toBe(service.getProvider());
    });

    it('returns default provider when config has no accessToken', async () => {
      const service = await createService({});

      const provider = service.getProviderForLocationConfig({ phoneNumberId: '1234' });
      expect(provider).toBe(service.getProvider());
    });

    it('creates and returns provider from location config', async () => {
      const service = await createService({});

      const provider = service.getProviderForLocationConfig({
        phoneNumberId: 'loc-phone-1',
        accessToken: 'loc-token-1',
      });

      expect(provider.name).toBe('whatsapp-cloud');
      expect(service.getRegisteredProviderCount()).toBe(1);
    });

    it('reuses cached provider for same phoneNumberId', async () => {
      const service = await createService({});

      const first = service.getProviderForLocationConfig({
        phoneNumberId: 'loc-phone-1',
        accessToken: 'loc-token-1',
      });
      const second = service.getProviderForLocationConfig({
        phoneNumberId: 'loc-phone-1',
        accessToken: 'loc-token-1',
      });

      expect(first).toBe(second);
    });
  });
});
