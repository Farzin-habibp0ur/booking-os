import { EmailChannelProvider, EmailProviderConfig } from '@booking-os/messaging-provider';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

function createProvider(overrides?: Partial<EmailProviderConfig>): EmailChannelProvider {
  return new EmailChannelProvider({
    provider: 'resend',
    apiKey: 'test-api-key',
    fromAddress: 'noreply@example.com',
    fromName: 'Test Business',
    replyToAddress: 'reply@example.com',
    ...overrides,
  });
}

describe('EmailChannelProvider', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  // ─── sendMessage via Resend ────────────────────────────────────────

  describe('sendMessage via Resend', () => {
    it('should send a plain text email via Resend', async () => {
      const provider = createProvider({ provider: 'resend' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'resend_msg_123' }),
      });

      const result = await provider.sendMessage({
        to: 'customer@example.com',
        body: 'Hello, your appointment is confirmed.',
        businessId: 'biz1',
      });

      expect(result.externalId).toBe('resend_msg_123');
      expect(mockFetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
        method: 'POST',
      }));

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.from).toBe('Test Business <noreply@example.com>');
      expect(callBody.to).toEqual(['customer@example.com']);
      expect(callBody.subject).toBe('New message');
      expect(callBody.text).toBe('Hello, your appointment is confirmed.');
      expect(callBody.reply_to).toBe('reply@example.com');
    });

    it('should send HTML email via Resend', async () => {
      const provider = createProvider({ provider: 'resend' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'resend_html_456' }),
      });

      const result = await provider.sendMessage({
        to: 'customer@example.com',
        body: 'Plain text version',
        businessId: 'biz1',
        subject: 'Your Booking',
        htmlBody: '<h1>Your Booking</h1><p>Confirmed!</p>',
      });

      expect(result.externalId).toBe('resend_html_456');
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toBe('Your Booking');
      expect(callBody.html).toBe('<h1>Your Booking</h1><p>Confirmed!</p>');
      expect(callBody.text).toBe('Plain text version');
    });

    it('should include In-Reply-To and References headers when inReplyTo is set', async () => {
      const provider = createProvider({ provider: 'resend' });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'resend_reply_789' }),
      });

      await provider.sendMessage({
        to: 'customer@example.com',
        body: 'Thanks for your reply!',
        businessId: 'biz1',
        inReplyTo: '<original-msg-id@example.com>',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.headers['In-Reply-To']).toBe('<original-msg-id@example.com>');
      expect(callBody.headers['References']).toBe('<original-msg-id@example.com>');
    });

    it('should use fromAddress without fromName when fromName is not set', async () => {
      const provider = createProvider({ provider: 'resend', fromName: undefined });
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'resend_noname' }),
      });

      await provider.sendMessage({
        to: 'customer@example.com',
        body: 'Hello',
        businessId: 'biz1',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.from).toBe('noreply@example.com');
    });

    it('should throw on Resend API error', async () => {
      const provider = createProvider({ provider: 'resend' });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 422,
        text: async () => 'Invalid email address',
      });

      await expect(
        provider.sendMessage({ to: 'bad-email', body: 'Test', businessId: 'biz1' }),
      ).rejects.toThrow('Resend API error 422: Invalid email address');
    });
  });

  // ─── sendMessage via SendGrid ──────────────────────────────────────

  describe('sendMessage via SendGrid', () => {
    it('should send a plain text email via SendGrid', async () => {
      const provider = createProvider({ provider: 'sendgrid' });
      const mockHeaders = new Map([['x-message-id', 'sg_msg_abc']]);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: (k: string) => mockHeaders.get(k) || null },
      });

      const result = await provider.sendMessage({
        to: 'customer@example.com',
        body: 'Your appointment is ready.',
        businessId: 'biz1',
        subject: 'Appointment Ready',
      });

      expect(result.externalId).toBe('sg_msg_abc');
      expect(mockFetch).toHaveBeenCalledWith('https://api.sendgrid.com/v3/mail/send', expect.objectContaining({
        method: 'POST',
      }));

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.personalizations[0].to[0].email).toBe('customer@example.com');
      expect(callBody.from.email).toBe('noreply@example.com');
      expect(callBody.from.name).toBe('Test Business');
      expect(callBody.subject).toBe('Appointment Ready');
      expect(callBody.content[0]).toEqual({ type: 'text/plain', value: 'Your appointment is ready.' });
      expect(callBody.reply_to.email).toBe('reply@example.com');
    });

    it('should send HTML email via SendGrid', async () => {
      const provider = createProvider({ provider: 'sendgrid' });
      const mockHeaders = new Map([['x-message-id', 'sg_html_def']]);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: (k: string) => mockHeaders.get(k) || null },
      });

      await provider.sendMessage({
        to: 'customer@example.com',
        body: 'Plain text',
        businessId: 'biz1',
        htmlBody: '<p>Rich content</p>',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.content).toHaveLength(2);
      expect(callBody.content[1]).toEqual({ type: 'text/html', value: '<p>Rich content</p>' });
    });

    it('should include In-Reply-To headers via SendGrid', async () => {
      const provider = createProvider({ provider: 'sendgrid' });
      const mockHeaders = new Map([['x-message-id', 'sg_reply_ghi']]);
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: (k: string) => mockHeaders.get(k) || null },
      });

      await provider.sendMessage({
        to: 'customer@example.com',
        body: 'Reply text',
        businessId: 'biz1',
        inReplyTo: '<thread-id@example.com>',
      });

      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.headers['In-Reply-To']).toBe('<thread-id@example.com>');
      expect(callBody.headers['References']).toBe('<thread-id@example.com>');
    });

    it('should generate fallback externalId when x-message-id header is missing', async () => {
      const provider = createProvider({ provider: 'sendgrid' });
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => null },
      });

      const result = await provider.sendMessage({
        to: 'customer@example.com',
        body: 'Test',
        businessId: 'biz1',
      });

      expect(result.externalId).toMatch(/^sg_\d+$/);
    });

    it('should throw on SendGrid API error', async () => {
      const provider = createProvider({ provider: 'sendgrid' });
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => 'Forbidden',
      });

      await expect(
        provider.sendMessage({ to: 'customer@example.com', body: 'Test', businessId: 'biz1' }),
      ).rejects.toThrow('SendGrid API error 403: Forbidden');
    });
  });

  // ─── parseInboundWebhook ───────────────────────────────────────────

  describe('parseInboundWebhook', () => {
    it('should parse a basic inbound email', () => {
      const result = EmailChannelProvider.parseInboundWebhook({
        from: 'john@example.com',
        to: 'inbox@mybusiness.com',
        subject: 'Question about booking',
        text: 'I would like to book an appointment.',
      });

      expect(result).toHaveLength(1);
      expect(result[0].from).toBe('john@example.com');
      expect(result[0].to).toBe('inbox@mybusiness.com');
      expect(result[0].subject).toBe('Question about booking');
      expect(result[0].body).toBe('I would like to book an appointment.');
    });

    it('should extract email from "Name <email>" format', () => {
      const result = EmailChannelProvider.parseInboundWebhook({
        from: 'John Doe <john@example.com>',
        to: 'inbox@mybusiness.com',
        text: 'Hello',
      });

      expect(result[0].from).toBe('john@example.com');
    });

    it('should strip quoted reply content', () => {
      const result = EmailChannelProvider.parseInboundWebhook({
        from: 'john@example.com',
        to: 'inbox@mybusiness.com',
        text: 'Yes, that works for me.\n\n> Previous message content\n> More quoted text\nOn Mon, Jan 1, 2026, someone wrote:\n---',
      });

      expect(result[0].body).toBe('Yes, that works for me.');
    });

    it('should return empty array for empty/invalid payload', () => {
      expect(EmailChannelProvider.parseInboundWebhook({})).toEqual([]);
      expect(EmailChannelProvider.parseInboundWebhook({ from: 'x@y.com' })).toEqual([]);
      expect(EmailChannelProvider.parseInboundWebhook({ to: 'x@y.com' })).toEqual([]);
    });

    it('should include In-Reply-To header when present', () => {
      const result = EmailChannelProvider.parseInboundWebhook({
        from: 'john@example.com',
        to: 'inbox@mybusiness.com',
        text: 'Reply content',
        'In-Reply-To': '<original-id@example.com>',
        'Message-ID': '<reply-id@example.com>',
      });

      expect(result[0].inReplyTo).toBe('<original-id@example.com>');
      expect(result[0].messageId).toBe('<reply-id@example.com>');
      expect(result[0].externalId).toBe('<reply-id@example.com>');
    });

    it('should generate externalId when Message-ID is not present', () => {
      const result = EmailChannelProvider.parseInboundWebhook({
        from: 'john@example.com',
        to: 'inbox@mybusiness.com',
        text: 'Hello',
      });

      expect(result[0].externalId).toMatch(/^email_\d+_/);
    });

    it('should include htmlBody when present', () => {
      const result = EmailChannelProvider.parseInboundWebhook({
        from: 'john@example.com',
        to: 'inbox@mybusiness.com',
        text: 'Plain text',
        html: '<p>Rich text</p>',
      });

      expect(result[0].htmlBody).toBe('<p>Rich text</p>');
    });

    it('should use raw text when stripping removes everything', () => {
      const result = EmailChannelProvider.parseInboundWebhook({
        from: 'john@example.com',
        to: 'inbox@mybusiness.com',
        text: '> Only quoted content',
      });

      // When stripping produces empty string, fall back to raw text
      expect(result[0].body).toBe('> Only quoted content');
    });
  });

  // ─── validateDomain ────────────────────────────────────────────────

  describe('validateDomain', () => {
    it('should return check results for a domain', () => {
      const result = EmailChannelProvider.validateDomain('example.com');

      expect(result.valid).toBe(true);
      expect(result.checks).toHaveLength(4);
      expect(result.checks.map((c) => c.type)).toEqual(['MX', 'SPF', 'DKIM', 'DMARC']);
      expect(result.checks.every((c) => c.status === 'pending')).toBe(true);
    });
  });
});
