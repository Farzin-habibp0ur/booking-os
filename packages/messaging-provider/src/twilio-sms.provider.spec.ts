import { TwilioSmsProvider } from './twilio-sms.provider';

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

  describe('sendMessage', () => {
    it('makes correct Twilio API call', async () => {
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
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          text: async () => 'Rate limited',
        })
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

  describe('parseInboundWebhook', () => {
    it('parses valid payload', () => {
      const payload = {
        From: '+15559876543',
        Body: 'Hello back',
        MessageSid: 'SM_INBOUND_123',
      };

      const result = TwilioSmsProvider.parseInboundWebhook(payload);

      expect(result).toEqual({
        from: '+15559876543',
        body: 'Hello back',
        externalId: 'SM_INBOUND_123',
        timestamp: expect.any(String),
      });

      // Verify timestamp is a valid ISO string
      expect(new Date(result!.timestamp).toISOString()).toBe(result!.timestamp);
    });

    it('returns null for missing From', () => {
      const result = TwilioSmsProvider.parseInboundWebhook({
        Body: 'Hello',
        MessageSid: 'SM_123',
      });

      expect(result).toBeNull();
    });

    it('returns null for missing Body', () => {
      const result = TwilioSmsProvider.parseInboundWebhook({
        From: '+15559876543',
        MessageSid: 'SM_123',
      });

      expect(result).toBeNull();
    });

    it('returns null for missing MessageSid', () => {
      const result = TwilioSmsProvider.parseInboundWebhook({
        From: '+15559876543',
        Body: 'Hello',
      });

      expect(result).toBeNull();
    });

    it('returns null for empty payload', () => {
      const result = TwilioSmsProvider.parseInboundWebhook({});

      expect(result).toBeNull();
    });
  });

  it('has correct provider name', () => {
    expect(provider.name).toBe('twilio-sms');
  });
});
