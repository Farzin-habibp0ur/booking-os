import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
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

      expect(() => service.getMockProvider()).toThrow('Mock provider not available');
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
});
