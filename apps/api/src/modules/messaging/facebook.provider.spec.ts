import { FacebookProvider } from '@booking-os/messaging-provider';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('FacebookProvider', () => {
  let provider: FacebookProvider;

  beforeEach(() => {
    provider = new FacebookProvider({
      pageId: 'page123',
      pageAccessToken: 'token123',
    });
    mockFetch.mockReset();
  });

  describe('sendMessage', () => {
    it('should send a text message', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'mid.text123' }),
      });

      const result = await provider.sendMessage({
        to: 'psid_user1',
        body: 'Hello from Facebook!',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('mid.text123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/me/messages',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer token123',
          }),
          body: JSON.stringify({
            recipient: { id: 'psid_user1' },
            message: { text: 'Hello from Facebook!' },
          }),
        }),
      );
    });

    it('should send a media attachment', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'mid.media123' }),
      });

      const result = await provider.sendMessage({
        to: 'psid_user1',
        body: '[image]',
        mediaUrl: 'https://example.com/photo.jpg',
        mediaType: 'image',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('mid.media123');
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.message.attachment.type).toBe('image');
      expect(sentBody.message.attachment.payload.url).toBe('https://example.com/photo.jpg');
    });

    it('should send media + text as two separate messages', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ message_id: 'mid.media1' }),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ message_id: 'mid.text1' }),
        });

      const result = await provider.sendMessage({
        to: 'psid_user1',
        body: 'Check this out!',
        mediaUrl: 'https://example.com/photo.jpg',
        mediaType: 'image',
        businessId: 'biz1',
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.externalId).toBe('mid.text1');
    });

    it('should truncate text to 2000 characters', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'mid.long' }),
      });

      const longText = 'a'.repeat(3000);
      await provider.sendMessage({ to: 'psid_user1', body: longText, businessId: 'biz1' });

      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.message.text.length).toBe(2000);
    });
  });

  describe('sendHumanAgentMessage', () => {
    it('should include HUMAN_AGENT tag', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ message_id: 'mid.agent123' }),
      });

      const result = await provider.sendHumanAgentMessage({
        to: 'psid_user1',
        body: 'A human is here to help',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('mid.agent123');
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.messaging_type).toBe('MESSAGE_TAG');
      expect(sentBody.tag).toBe('HUMAN_AGENT');
    });
  });

  describe('setIceBreakers', () => {
    it('should configure ice breakers via messenger_profile', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'success' }),
      });

      await provider.setIceBreakers([
        { question: 'Book an appointment', payload: 'BOOK' },
        { question: 'Business hours?', payload: 'HOURS' },
      ]);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://graph.facebook.com/v21.0/me/messenger_profile',
        expect.objectContaining({ method: 'POST' }),
      );
      const sentBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(sentBody.ice_breakers).toHaveLength(2);
      expect(sentBody.ice_breakers[0].call_to_actions[0].question).toBe('Book an appointment');
    });
  });

  describe('retry on 429', () => {
    it('should retry with exponential backoff on rate limit', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ message_id: 'mid.retry' }),
        });

      const result = await provider.sendMessage({
        to: 'psid_user1',
        body: 'Retry test',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('mid.retry');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    }, 10000);

    it('should throw after exhausting retries', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: false, status: 429 })
        .mockResolvedValueOnce({ ok: false, status: 429 });

      await expect(
        provider.sendMessage({ to: 'psid_user1', body: 'Fail test', businessId: 'biz1' }),
      ).rejects.toThrow();
    }, 30000);
  });

  describe('parseInboundWebhook', () => {
    it('should parse a text message', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page123',
            time: 1234567890,
            messaging: [
              {
                sender: { id: 'user456' },
                recipient: { id: 'page123' },
                timestamp: 1234567890,
                message: {
                  mid: 'mid.abc123',
                  text: 'Hello!',
                },
              },
            ],
          },
        ],
      };

      const messages = FacebookProvider.parseInboundWebhook(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toEqual({
        from: 'user456',
        body: 'Hello!',
        externalId: 'mid.abc123',
        timestamp: '1234567890',
        pageId: 'page123',
      });
    });

    it('should parse a media message', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page123',
            messaging: [
              {
                sender: { id: 'user456' },
                recipient: { id: 'page123' },
                timestamp: 1234567890,
                message: {
                  mid: 'mid.media1',
                  attachments: [
                    {
                      type: 'image',
                      payload: { url: 'https://cdn.facebook.com/photo.jpg' },
                    },
                  ],
                },
              },
            ],
          },
        ],
      };

      const messages = FacebookProvider.parseInboundWebhook(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0].mediaType).toBe('image');
      expect(messages[0].mediaUrl).toBe('https://cdn.facebook.com/photo.jpg');
      expect(messages[0].body).toBe('[image]');
    });

    it('should parse a postback', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page123',
            messaging: [
              {
                sender: { id: 'user456' },
                recipient: { id: 'page123' },
                timestamp: 1234567890,
                postback: {
                  title: 'Get Started',
                  payload: 'GET_STARTED',
                },
              },
            ],
          },
        ],
      };

      const messages = FacebookProvider.parseInboundWebhook(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0].body).toBe('Get Started');
      expect(messages[0].postback).toBe('GET_STARTED');
      expect(messages[0].externalId).toBe('postback_user456_1234567890');
    });

    it('should parse a referral', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page123',
            messaging: [
              {
                sender: { id: 'user456' },
                recipient: { id: 'page123' },
                timestamp: 1234567890,
                referral: {
                  source: 'SHORTLINK',
                  type: 'OPEN_THREAD',
                  ref: 'campaign123',
                },
              },
            ],
          },
        ],
      };

      const messages = FacebookProvider.parseInboundWebhook(payload);
      expect(messages).toHaveLength(1);
      expect(messages[0].referral).toEqual({
        source: 'SHORTLINK',
        type: 'OPEN_THREAD',
        ref: 'campaign123',
      });
      expect(messages[0].body).toBe('[Referral]');
    });

    it('should skip page own messages', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page123',
            messaging: [
              {
                sender: { id: 'page123' },
                recipient: { id: 'user456' },
                timestamp: 1234567890,
                message: { mid: 'mid.own', text: 'Reply from page' },
              },
            ],
          },
        ],
      };

      const messages = FacebookProvider.parseInboundWebhook(payload);
      expect(messages).toHaveLength(0);
    });

    it('should return empty array for invalid payload', () => {
      expect(FacebookProvider.parseInboundWebhook(null)).toEqual([]);
      expect(FacebookProvider.parseInboundWebhook({})).toEqual([]);
      expect(FacebookProvider.parseInboundWebhook({ entry: [] })).toEqual([]);
    });
  });

  describe('parseStatusWebhook', () => {
    it('should parse delivered status', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page123',
            messaging: [
              {
                sender: { id: 'user456' },
                recipient: { id: 'page123' },
                timestamp: 1234567890,
                delivery: {
                  mids: ['mid.delivered1', 'mid.delivered2'],
                  watermark: 1234567890,
                },
              },
            ],
          },
        ],
      };

      const statuses = FacebookProvider.parseStatusWebhook(payload);
      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toEqual({
        messageId: 'mid.delivered1',
        status: 'delivered',
        timestamp: '1234567890',
      });
    });

    it('should parse read status', () => {
      const payload = {
        object: 'page',
        entry: [
          {
            id: 'page123',
            messaging: [
              {
                sender: { id: 'user456' },
                recipient: { id: 'page123' },
                timestamp: 1234567890,
                read: {
                  watermark: 1234567890,
                },
              },
            ],
          },
        ],
      };

      const statuses = FacebookProvider.parseStatusWebhook(payload);
      expect(statuses).toHaveLength(1);
      expect(statuses[0].status).toBe('read');
      expect(statuses[0].messageId).toBe('read_1234567890');
    });

    it('should return empty array for empty payload', () => {
      expect(FacebookProvider.parseStatusWebhook(null)).toEqual([]);
      expect(FacebookProvider.parseStatusWebhook({})).toEqual([]);
    });
  });
});
