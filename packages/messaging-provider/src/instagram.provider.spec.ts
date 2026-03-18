import { InstagramProvider } from './instagram.provider';

const mockConfig = {
  pageId: 'PAGE_123',
  pageAccessToken: 'test_page_access_token',
};

const mockMessage = {
  to: 'IGSID_12345',
  body: 'Hello from Booking OS',
  businessId: 'biz-test-1',
};

// Speed up retries for tests
const originalSetTimeout = global.setTimeout;
function patchTimers() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).setTimeout = (fn: (...args: any[]) => void, _ms?: number) => {
    return originalSetTimeout(fn, 0);
  };
}
function restoreTimers() {
  global.setTimeout = originalSetTimeout;
}

describe('InstagramProvider', () => {
  let provider: InstagramProvider;
  const originalFetch = global.fetch;

  beforeEach(() => {
    provider = new InstagramProvider(mockConfig);
    global.fetch = jest.fn();
    patchTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    restoreTimers();
  });

  it('has correct provider name', () => {
    expect(provider.name).toBe('instagram');
  });

  describe('sendMessage', () => {
    it('sends a text message correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'mid.123' }),
      });

      const result = await provider.sendMessage(mockMessage);

      expect(result).toEqual({ externalId: 'mid.123' });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v21.0/me/messages');
      expect(options.method).toBe('POST');
      expect(options.headers.Authorization).toBe('Bearer test_page_access_token');

      const body = JSON.parse(options.body);
      expect(body.recipient.id).toBe('IGSID_12345');
      expect(body.message.text).toBe('Hello from Booking OS');
    });

    it('truncates text to 1000 characters', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'mid.long' }),
      });

      const longMessage = { ...mockMessage, body: 'A'.repeat(2000) };
      await provider.sendMessage(longMessage);

      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.message.text).toHaveLength(1000);
    });

    it('sends media message with separate text caption', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ message_id: 'mid.media' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ message_id: 'mid.caption' }),
        });

      const mediaMsg = {
        ...mockMessage,
        body: 'Check this photo',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image' as const,
      };

      const result = await provider.sendMessage(mediaMsg);

      expect(result).toEqual({ externalId: 'mid.caption' });
      expect(global.fetch).toHaveBeenCalledTimes(2);

      // First call: media
      const mediaBody = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(mediaBody.message.attachment.type).toBe('image');
      expect(mediaBody.message.attachment.payload.url).toBe('https://example.com/image.jpg');

      // Second call: text caption
      const textBody = JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body);
      expect(textBody.message.text).toBe('Check this photo');
    });

    it('sends media without separate text when body matches mediaType placeholder', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'mid.media_only' }),
      });

      const mediaMsg = {
        ...mockMessage,
        body: '[image]',
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image' as const,
      };

      await provider.sendMessage(mediaMsg);

      // Only one call (no separate text)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('retries on 429 status', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ message_id: 'mid.retry' }),
        });

      const result = await provider.sendMessage(mockMessage);

      expect(result).toEqual({ externalId: 'mid.retry' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('throws after all retries exhausted', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

      await expect(provider.sendMessage(mockMessage)).rejects.toThrow('Network failure');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('returns empty externalId when message_id missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const result = await provider.sendMessage(mockMessage);
      expect(result).toEqual({ externalId: '' });
    });
  });

  describe('sendHumanAgentMessage', () => {
    it('sends with HUMAN_AGENT tag', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'mid.human' }),
      });

      const result = await provider.sendHumanAgentMessage(mockMessage);

      expect(result).toEqual({ externalId: 'mid.human' });
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.messaging_type).toBe('MESSAGE_TAG');
      expect(body.tag).toBe('HUMAN_AGENT');
    });
  });

  describe('setIceBreakers', () => {
    it('configures ice breakers', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ result: 'success' }),
      });

      await provider.setIceBreakers([
        { question: 'Book appointment', payload: 'book' },
        { question: 'View services', payload: 'services' },
      ]);

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://graph.facebook.com/v21.0/me/messenger_profile');
      const body = JSON.parse(options.body);
      expect(body.platform).toBe('instagram');
      expect(body.ice_breakers).toHaveLength(2);
    });
  });

  describe('parseInboundWebhook', () => {
    it('parses a standard text message', () => {
      const payload = {
        object: 'instagram',
        entry: [
          {
            id: 'PAGE_123',
            time: 1700000000,
            messaging: [
              {
                sender: { id: 'USER_456' },
                recipient: { id: 'PAGE_123' },
                timestamp: 1700000000,
                message: {
                  mid: 'mid.text',
                  text: 'Hello!',
                },
              },
            ],
          },
        ],
      };

      const result = InstagramProvider.parseInboundWebhook(payload);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        from: 'USER_456',
        body: 'Hello!',
        externalId: 'mid.text',
        timestamp: '1700000000',
        instagramPageId: 'PAGE_123',
      });
    });

    it('parses media attachment', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                sender: { id: 'USER_456' },
                timestamp: 1700000000,
                message: {
                  mid: 'mid.img',
                  attachments: [
                    {
                      type: 'image',
                      payload: { url: 'https://cdn.instagram.com/image.jpg' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const result = InstagramProvider.parseInboundWebhook(payload);

      expect(result).toHaveLength(1);
      expect(result[0].mediaType).toBe('image');
      expect(result[0].mediaUrl).toBe('https://cdn.instagram.com/image.jpg');
      expect(result[0].body).toBe('[image]');
    });

    it('parses story reply', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                sender: { id: 'USER_456' },
                timestamp: 1700000000,
                message: {
                  mid: 'mid.story',
                  text: 'Love this!',
                  reply_to: {
                    story: { url: 'https://cdn.instagram.com/story.jpg' },
                  },
                },
              },
            ],
          },
        ],
      };

      const result = InstagramProvider.parseInboundWebhook(payload);

      expect(result).toHaveLength(1);
      expect(result[0].storyReplyUrl).toBe('https://cdn.instagram.com/story.jpg');
      expect(result[0].body).toBe('Love this!');
    });

    it('parses postback (ice breaker tap)', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                sender: { id: 'USER_456' },
                timestamp: 1700000000,
                postback: {
                  title: 'Book appointment',
                  payload: 'book',
                },
              },
            ],
          },
        ],
      };

      const result = InstagramProvider.parseInboundWebhook(payload);

      expect(result).toHaveLength(1);
      expect(result[0].body).toBe('Book appointment');
      expect(result[0].postback).toBe('book');
      expect(result[0].externalId).toContain('postback_USER_456');
    });

    it('parses referral (ad click)', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                sender: { id: 'USER_456' },
                timestamp: 1700000000,
                referral: {
                  source: 'ADS',
                  type: 'OPEN_THREAD',
                  ad_id: 'AD_789',
                },
              },
            ],
          },
        ],
      };

      const result = InstagramProvider.parseInboundWebhook(payload);

      expect(result).toHaveLength(1);
      expect(result[0].body).toBe('[Ad referral: AD_789]');
      expect(result[0].referral).toEqual({ source: 'ADS', type: 'OPEN_THREAD' });
    });

    it('skips messages from the page itself', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                sender: { id: 'PAGE_123' },
                timestamp: 1700000000,
                message: { mid: 'mid.self', text: 'My own message' },
              },
            ],
          },
        ],
      };

      const result = InstagramProvider.parseInboundWebhook(payload);
      expect(result).toHaveLength(0);
    });

    it('returns empty array for null payload', () => {
      expect(InstagramProvider.parseInboundWebhook(null)).toEqual([]);
      expect(InstagramProvider.parseInboundWebhook({})).toEqual([]);
    });
  });

  describe('parseStatusWebhook', () => {
    it('parses delivery status', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                timestamp: 1700000000,
                delivery: { mids: ['mid.1', 'mid.2'] },
              },
            ],
          },
        ],
      };

      const result = InstagramProvider.parseStatusWebhook(payload);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        messageId: 'mid.1',
        status: 'delivered',
        timestamp: '1700000000',
      });
      expect(result[1]).toEqual({
        messageId: 'mid.2',
        status: 'delivered',
        timestamp: '1700000000',
      });
    });

    it('parses read receipt', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                timestamp: 1700000000,
                read: { mid: 'mid.read', watermark: 1700000000 },
              },
            ],
          },
        ],
      };

      const result = InstagramProvider.parseStatusWebhook(payload);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        messageId: 'mid.read',
        status: 'read',
        timestamp: '1700000000',
      });
    });

    it('returns empty array for null payload', () => {
      expect(InstagramProvider.parseStatusWebhook(null)).toEqual([]);
    });
  });
});
