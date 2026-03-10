import { WhatsAppCloudProvider } from '@booking-os/messaging-provider';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('WhatsAppCloudProvider', () => {
  let provider: WhatsAppCloudProvider;

  beforeEach(() => {
    mockFetch.mockReset();
    provider = new WhatsAppCloudProvider({
      phoneNumberId: 'test-phone-id',
      accessToken: 'test-access-token',
    });
  });

  describe('sendMessage', () => {
    it('should send a text message via WhatsApp Cloud API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.abc123' }] }),
      });

      const result = await provider.sendMessage({
        to: '+1234567890',
        body: 'Hello!',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('wamid.abc123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('test-phone-id/messages'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-access-token',
          }),
        }),
      );

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messaging_product).toBe('whatsapp');
      expect(sentBody.to).toBe('+1234567890');
      expect(sentBody.type).toBe('text');
    });

    it('should retry on rate limit (429)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limited' })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ messages: [{ id: 'wamid.retry' }] }),
        });

      const result = await provider.sendMessage({
        to: '+1234567890',
        body: 'Retry test',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('wamid.retry');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should throw after max retries', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => 'Server error',
      });

      await expect(
        provider.sendMessage({ to: '+1234567890', body: 'Fail', businessId: 'biz1' }),
      ).rejects.toThrow('WhatsApp API error 500');
    });
  });

  describe('sendTemplateMessage', () => {
    it('should send a template message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.tpl123' }] }),
      });

      const result = await provider.sendTemplateMessage({
        to: '+1234567890',
        templateName: 'appointment_reminder',
        languageCode: 'en',
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: 'John' },
              { type: 'text', text: 'Haircut' },
            ],
          },
        ],
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('wamid.tpl123');
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.type).toBe('template');
      expect(sentBody.template.name).toBe('appointment_reminder');
    });
  });

  describe('parseInboundWebhook', () => {
    it('should parse Meta webhook payload', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'pn123' },
                  messages: [
                    {
                      id: 'wamid.msg1',
                      from: '+1234567890',
                      timestamp: '1234567890',
                      type: 'text',
                      text: { body: 'Hello from WhatsApp' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = WhatsAppCloudProvider.parseInboundWebhook(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        from: '+1234567890',
        body: 'Hello from WhatsApp',
        externalId: 'wamid.msg1',
        timestamp: '1234567890',
        businessPhoneNumberId: 'pn123',
      });
    });

    it('should parse inbound image messages', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'pn123' },
                  messages: [
                    {
                      id: 'wamid.img1',
                      from: '+1234567890',
                      timestamp: '1234567890',
                      type: 'image',
                      image: { id: 'media-123', mime_type: 'image/jpeg', caption: 'My photo' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = WhatsAppCloudProvider.parseInboundWebhook(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        from: '+1234567890',
        body: 'My photo',
        externalId: 'wamid.img1',
        timestamp: '1234567890',
        businessPhoneNumberId: 'pn123',
        mediaType: 'image',
        mediaId: 'media-123',
        mimeType: 'image/jpeg',
        fileName: undefined,
      });
    });

    it('should parse inbound document with filename', () => {
      const payload = {
        entry: [
          {
            changes: [
              {
                value: {
                  metadata: { phone_number_id: 'pn123' },
                  messages: [
                    {
                      id: 'wamid.doc1',
                      from: '+1234567890',
                      timestamp: '1234567890',
                      type: 'document',
                      document: {
                        id: 'media-doc',
                        mime_type: 'application/pdf',
                        filename: 'report.pdf',
                      },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = WhatsAppCloudProvider.parseInboundWebhook(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0].mediaType).toBe('document');
      expect(messages[0].fileName).toBe('report.pdf');
    });

    it('should handle empty or missing payload', () => {
      expect(WhatsAppCloudProvider.parseInboundWebhook({})).toEqual([]);
      expect(WhatsAppCloudProvider.parseInboundWebhook(null)).toEqual([]);
    });
  });

  describe('sendMessage with media', () => {
    it('should send an image message via WhatsApp Cloud API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.media1' }] }),
      });

      const result = await provider.sendMessage({
        to: '+1234567890',
        body: 'Check this out',
        businessId: 'biz1',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image',
      });

      expect(result.externalId).toBe('wamid.media1');
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.type).toBe('image');
      expect(sentBody.image.link).toBe('https://example.com/image.jpg');
      expect(sentBody.image.caption).toBe('Check this out');
    });

    it('should send a document with filename', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.doc1' }] }),
      });

      const result = await provider.sendMessage({
        to: '+1234567890',
        body: '',
        businessId: 'biz1',
        mediaUrl: 'https://example.com/report.pdf',
        mediaType: 'document',
        fileName: 'report.pdf',
      });

      expect(result.externalId).toBe('wamid.doc1');
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.type).toBe('document');
      expect(sentBody.document.filename).toBe('report.pdf');
    });
  });
});
