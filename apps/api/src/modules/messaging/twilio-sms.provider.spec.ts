import * as crypto from 'crypto';
import { TwilioSmsProvider } from '@booking-os/messaging-provider';

const mockConfig = {
  accountSid: 'AC_TEST_SID',
  authToken: 'test_auth_token',
  fromNumber: '+15551234567',
};

const mockMessage = {
  to: '+15559876543',
  body: 'Hello from Booking OS',
  businessId: 'biz-test-1',
};

// Speed up retries for tests by replacing setTimeout with immediate execution
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

// Helper to build a valid Twilio signature
function buildTwilioSignature(
  authToken: string,
  url: string,
  params: Record<string, string>,
): string {
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  return crypto.createHmac('sha1', authToken).update(data).digest('base64');
}

describe('TwilioSmsProvider', () => {
  let provider: TwilioSmsProvider;
  const originalFetch = global.fetch;

  beforeEach(() => {
    provider = new TwilioSmsProvider(mockConfig);
    global.fetch = jest.fn();
    patchTimers();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    restoreTimers();
  });

  it('has correct provider name', () => {
    expect(provider.name).toBe('twilio-sms');
  });

  // ─── sendMessage ──────────────────────────────────────────────────────

  describe('sendMessage', () => {
    it('makes correct Twilio API call with basic params', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ sid: 'SM_TEST_123' }),
      });

      const result = await provider.sendMessage(mockMessage);

      expect(result).toEqual({ externalId: 'SM_TEST_123' });
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(url).toBe('https://api.twilio.com/2010-04-01/Accounts/AC_TEST_SID/Messages.json');
      expect(options.method).toBe('POST');
      expect(options.headers['Content-Type']).toBe('application/x-www-form-urlencoded');

      const expectedCredentials = Buffer.from('AC_TEST_SID:test_auth_token').toString('base64');
      expect(options.headers.Authorization).toBe(`Basic ${expectedCredentials}`);

      const body = new URLSearchParams(options.body);
      expect(body.get('To')).toBe('+15559876543');
      expect(body.get('From')).toBe('+15551234567');
      expect(body.get('Body')).toBe('Hello from Booking OS');
      expect(body.has('MediaUrl')).toBe(false);
      expect(body.has('StatusCallback')).toBe(false);
    });

    it('includes MediaUrl when mediaUrl is provided (MMS)', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ sid: 'SM_MMS' }),
      });

      await provider.sendMessage({
        ...mockMessage,
        mediaUrl: 'https://example.com/image.jpg',
      });

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = new URLSearchParams(options.body);
      expect(body.get('MediaUrl')).toBe('https://example.com/image.jpg');
    });

    it('includes StatusCallback when statusCallbackUrl is configured', async () => {
      const providerWithCallback = new TwilioSmsProvider({
        ...mockConfig,
        statusCallbackUrl: 'https://example.com/webhook/sms/status',
      });

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ sid: 'SM_CB' }),
      });

      await providerWithCallback.sendMessage(mockMessage);

      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      const body = new URLSearchParams(options.body);
      expect(body.get('StatusCallback')).toBe('https://example.com/webhook/sms/status');
    });

    it('returns empty string externalId when sid is missing', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({}),
      });

      const result = await provider.sendMessage(mockMessage);
      expect(result).toEqual({ externalId: '' });
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
          json: async () => ({ sid: 'SM_RETRY_OK' }),
        });

      const result = await provider.sendMessage(mockMessage);

      expect(result).toEqual({ externalId: 'SM_RETRY_OK' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('retries multiple 429s with exponential backoff', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limited' })
        .mockResolvedValueOnce({ ok: false, status: 429, text: async () => 'Rate limited' })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ sid: 'SM_FINAL' }),
        });

      const result = await provider.sendMessage(mockMessage);

      expect(result).toEqual({ externalId: 'SM_FINAL' });
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('throws error on non-ok non-429 response after retries', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request: invalid number',
      });

      await expect(provider.sendMessage(mockMessage)).rejects.toThrow(
        'Twilio API error 400: Bad Request: invalid number',
      );
    });

    it('throws after all retries exhausted on fetch error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network failure'));

      await expect(provider.sendMessage(mockMessage)).rejects.toThrow('Network failure');
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('recovers on second attempt after fetch error', async () => {
      (global.fetch as jest.Mock)
        .mockRejectedValueOnce(new Error('Transient error'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ sid: 'SM_RECOVERED' }),
        });

      const result = await provider.sendMessage(mockMessage);

      expect(result).toEqual({ externalId: 'SM_RECOVERED' });
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  // ─── parseInboundWebhook ──────────────────────────────────────────────

  describe('parseInboundWebhook', () => {
    it('parses a basic SMS inbound payload', () => {
      const result = TwilioSmsProvider.parseInboundWebhook({
        From: '+15559876543',
        To: '+15551234567',
        Body: 'Hello back',
        MessageSid: 'SM_INBOUND_123',
        NumMedia: '0',
        NumSegments: '1',
      });

      expect(result).not.toBeNull();
      expect(result!.from).toBe('+15559876543');
      expect(result!.to).toBe('+15551234567');
      expect(result!.body).toBe('Hello back');
      expect(result!.externalId).toBe('SM_INBOUND_123');
      expect(result!.numMedia).toBe(0);
      expect(result!.mediaUrls).toEqual([]);
      expect(result!.numSegments).toBe(1);
      expect(new Date(result!.timestamp).toISOString()).toBe(result!.timestamp);
    });

    it('parses MMS with media attachments', () => {
      const result = TwilioSmsProvider.parseInboundWebhook({
        From: '+14155551234',
        To: '+15551234567',
        Body: 'Photo attached',
        MessageSid: 'SM_MMS_IN',
        NumMedia: '2',
        MediaUrl0: 'https://api.twilio.com/media/img1.jpg',
        MediaUrl1: 'https://api.twilio.com/media/img2.png',
        NumSegments: '1',
      });

      expect(result).not.toBeNull();
      expect(result!.numMedia).toBe(2);
      expect(result!.mediaUrls).toEqual([
        'https://api.twilio.com/media/img1.jpg',
        'https://api.twilio.com/media/img2.png',
      ]);
    });

    it('includes geo metadata when present', () => {
      const result = TwilioSmsProvider.parseInboundWebhook({
        From: '+14155551234',
        MessageSid: 'SM_GEO',
        FromCity: 'SAN FRANCISCO',
        FromState: 'CA',
        FromCountry: 'US',
      });

      expect(result).not.toBeNull();
      expect(result!.fromCity).toBe('SAN FRANCISCO');
      expect(result!.fromState).toBe('CA');
      expect(result!.fromCountry).toBe('US');
    });

    it('handles empty body gracefully (Body is optional)', () => {
      const result = TwilioSmsProvider.parseInboundWebhook({
        From: '+14155551234',
        MessageSid: 'SM_NOBODY',
      });

      expect(result).not.toBeNull();
      expect(result!.body).toBe('');
    });

    it('returns null when From is missing', () => {
      expect(
        TwilioSmsProvider.parseInboundWebhook({ Body: 'Hello', MessageSid: 'SM_123' }),
      ).toBeNull();
    });

    it('returns null when MessageSid is missing', () => {
      expect(
        TwilioSmsProvider.parseInboundWebhook({ From: '+15559876543', Body: 'Hello' }),
      ).toBeNull();
    });

    it('returns null for empty payload', () => {
      expect(TwilioSmsProvider.parseInboundWebhook({})).toBeNull();
    });
  });

  // ─── parseStatusWebhook ───────────────────────────────────────────────

  describe('parseStatusWebhook', () => {
    it('parses a successful delivery status', () => {
      const result = TwilioSmsProvider.parseStatusWebhook({
        MessageSid: 'SM_DELIVERED',
        MessageStatus: 'delivered',
      });

      expect(result).not.toBeNull();
      expect(result!.messageSid).toBe('SM_DELIVERED');
      expect(result!.status).toBe('delivered');
      expect(result!.errorCode).toBeUndefined();
      expect(result!.errorMessage).toBeUndefined();
    });

    it('parses a failed status with error code and message', () => {
      const result = TwilioSmsProvider.parseStatusWebhook({
        MessageSid: 'SM_FAILED',
        MessageStatus: 'failed',
        ErrorCode: '30003',
        ErrorMessage: 'Unreachable destination handset',
      });

      expect(result).not.toBeNull();
      expect(result!.messageSid).toBe('SM_FAILED');
      expect(result!.status).toBe('failed');
      expect(result!.errorCode).toBe(30003);
      expect(result!.errorMessage).toBe('Unreachable destination handset');
    });

    it('returns null when MessageSid is missing', () => {
      expect(TwilioSmsProvider.parseStatusWebhook({ MessageStatus: 'delivered' })).toBeNull();
    });

    it('returns null when MessageStatus is missing', () => {
      expect(TwilioSmsProvider.parseStatusWebhook({ MessageSid: 'SM_X' })).toBeNull();
    });
  });

  // ─── validateSignature ────────────────────────────────────────────────

  describe('validateSignature', () => {
    const authToken = 'test-auth-token-12345';
    const webhookUrl = 'https://example.com/webhook/sms/inbound';

    it('returns true for a valid signature', () => {
      const params = {
        From: '+14155551234',
        To: '+15551234567',
        Body: 'Hello',
        MessageSid: 'SM_SIG',
      };
      const signature = buildTwilioSignature(authToken, webhookUrl, params);

      expect(TwilioSmsProvider.validateSignature(authToken, signature, webhookUrl, params)).toBe(
        true,
      );
    });

    it('returns false for an invalid signature', () => {
      const params = { From: '+14155551234', Body: 'Hello', MessageSid: 'SM_BAD' };

      expect(
        TwilioSmsProvider.validateSignature(authToken, 'invalidbase64sig', webhookUrl, params),
      ).toBe(false);
    });

    it('returns false when params are tampered', () => {
      const params = { From: '+14155551234', Body: 'Hello', MessageSid: 'SM_TAMPER' };
      const signature = buildTwilioSignature(authToken, webhookUrl, params);

      expect(
        TwilioSmsProvider.validateSignature(authToken, signature, webhookUrl, {
          ...params,
          Body: 'Tampered',
        }),
      ).toBe(false);
    });
  });

  // ─── classifyError ────────────────────────────────────────────────────

  describe('classifyError', () => {
    it('classifies known non-retriable error codes', () => {
      expect(TwilioSmsProvider.classifyError(21211)).toEqual({
        category: 'INVALID_NUMBER',
        retriable: false,
        description: 'Invalid phone number',
      });
      expect(TwilioSmsProvider.classifyError(21610)).toEqual({
        category: 'UNSUBSCRIBED',
        retriable: false,
        description: 'Number opted out',
      });
      expect(TwilioSmsProvider.classifyError(30004)).toEqual({
        category: 'BLOCKED',
        retriable: false,
        description: 'Message blocked',
      });
      expect(TwilioSmsProvider.classifyError(30007)).toEqual({
        category: 'FILTERED',
        retriable: false,
        description: 'Message filtered by carrier',
      });
    });

    it('classifies known retriable error codes', () => {
      expect(TwilioSmsProvider.classifyError(30001)).toEqual({
        category: 'QUEUE',
        retriable: true,
        description: 'Queue overflow',
      });
      expect(TwilioSmsProvider.classifyError(30003)).toEqual({
        category: 'UNREACHABLE',
        retriable: true,
        description: 'Unreachable number',
      });
    });

    it('returns UNKNOWN with retriable=true for unrecognized error codes', () => {
      const result = TwilioSmsProvider.classifyError(99999);
      expect(result.category).toBe('UNKNOWN');
      expect(result.retriable).toBe(true);
      expect(result.description).toBe('Error code 99999');
    });
  });
});
