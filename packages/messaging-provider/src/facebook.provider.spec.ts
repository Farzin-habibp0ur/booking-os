import * as crypto from 'crypto';
import { FacebookProvider } from './facebook.provider';

describe('FacebookProvider', () => {
  describe('verifyWebhookSignature', () => {
    const appSecret = 'test-app-secret';

    function makeSignature(body: string, secret: string): string {
      const hmac = crypto.createHmac('sha256', secret).update(body).digest('hex');
      return `sha256=${hmac}`;
    }

    it('should return true for a valid signature', () => {
      const body = '{"entry":[]}';
      const signature = makeSignature(body, appSecret);

      expect(FacebookProvider.verifyWebhookSignature(body, signature, appSecret)).toBe(true);
    });

    it('should return false for an invalid signature', () => {
      const body = '{"entry":[]}';
      const signature = 'sha256=deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      expect(FacebookProvider.verifyWebhookSignature(body, signature, appSecret)).toBe(false);
    });

    it('should return false when signature is missing sha256= prefix', () => {
      const body = '{"entry":[]}';
      const hmac = crypto.createHmac('sha256', appSecret).update(body).digest('hex');

      expect(FacebookProvider.verifyWebhookSignature(body, hmac, appSecret)).toBe(false);
    });

    it('should return false when signature is empty', () => {
      const body = '{"entry":[]}';

      expect(FacebookProvider.verifyWebhookSignature(body, '', appSecret)).toBe(false);
    });
  });

  describe('parseInboundWebhook - quick reply', () => {
    it('parses quick reply payload from message', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                sender: { id: 'USER_456' },
                timestamp: 1700000000,
                message: {
                  mid: 'mid.qr',
                  text: 'Book appointment',
                  quick_reply: {
                    payload: 'BOOK_APPOINTMENT',
                  },
                },
              },
            ],
          },
        ],
      };

      const result = FacebookProvider.parseInboundWebhook(payload);

      expect(result).toHaveLength(1);
      expect(result[0].body).toBe('Book appointment');
      expect(result[0].quickReplyPayload).toBe('BOOK_APPOINTMENT');
    });

    it('regular message without quick_reply has no quickReplyPayload', () => {
      const payload = {
        entry: [
          {
            id: 'PAGE_123',
            messaging: [
              {
                sender: { id: 'USER_456' },
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

      const result = FacebookProvider.parseInboundWebhook(payload);

      expect(result).toHaveLength(1);
      expect(result[0].body).toBe('Hello!');
      expect(result[0].quickReplyPayload).toBeUndefined();
    });
  });
});
