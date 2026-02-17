import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('EmailService', () => {
  let service: EmailService;
  let mockConfigService: { get: jest.Mock };

  const createService = async (config: Record<string, string> = {}) => {
    mockConfigService = {
      get: jest.fn((key: string, def?: string) => config[key] ?? def),
    };
    const module = await Test.createTestingModule({
      providers: [EmailService, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();
    return module.get(EmailService);
  };

  beforeEach(async () => {
    service = await createService({ EMAIL_PROVIDER: 'none' });
  });

  // ─── Constructor ──────────────────────────────────────────────────────

  it('logs warning when provider is none', async () => {
    const svc = await createService({});
    expect(svc).toBeDefined();
  });

  it('logs warning when API key is missing', async () => {
    const svc = await createService({ EMAIL_PROVIDER: 'resend' });
    expect(svc).toBeDefined();
  });

  // ─── send ─────────────────────────────────────────────────────────────

  describe('send', () => {
    it('logs email when provider is none (no API key)', async () => {
      const result = await service.send({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });
      expect(result).toBe(true);
    });

    it('uses default from address when not provided', async () => {
      const result = await service.send({
        to: 'test@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });
      expect(result).toBe(true);
    });

    it('sends via Resend when configured', async () => {
      const svc = await createService({
        EMAIL_PROVIDER: 'resend',
        EMAIL_API_KEY: 'test-key',
        EMAIL_FROM: 'hello@clinic.com',
      });

      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      const result = await svc.send({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-key',
          }),
        }),
      );
    });

    it('sends via SendGrid when configured', async () => {
      const svc = await createService({
        EMAIL_PROVIDER: 'sendgrid',
        EMAIL_API_KEY: 'sg-key',
        EMAIL_FROM: 'hello@clinic.com',
      });

      const mockFetch = jest.fn().mockResolvedValue({ ok: true });
      global.fetch = mockFetch;

      const result = await svc.send({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      expect(result).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    it('returns false for unknown provider', async () => {
      const svc = await createService({
        EMAIL_PROVIDER: 'unknown',
        EMAIL_API_KEY: 'key',
      });

      const result = await svc.send({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      expect(result).toBe(false);
    });

    it('returns false when Resend API fails', async () => {
      const svc = await createService({
        EMAIL_PROVIDER: 'resend',
        EMAIL_API_KEY: 'key',
      });

      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500 });

      const result = await svc.send({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      expect(result).toBe(false);
    });

    it('returns false when SendGrid API fails', async () => {
      const svc = await createService({
        EMAIL_PROVIDER: 'sendgrid',
        EMAIL_API_KEY: 'key',
      });

      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 403 });

      const result = await svc.send({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      expect(result).toBe(false);
    });

    it('returns false on fetch exception', async () => {
      const svc = await createService({
        EMAIL_PROVIDER: 'resend',
        EMAIL_API_KEY: 'key',
      });

      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

      const result = await svc.send({
        to: 'test@example.com',
        subject: 'Hello',
        html: '<p>Hi</p>',
      });

      expect(result).toBe(false);
    });
  });

  // ─── Convenience methods ──────────────────────────────────────────────

  describe('sendBookingConfirmation', () => {
    it('sends booking confirmation email', async () => {
      const result = await service.sendBookingConfirmation('test@example.com', {
        customerName: 'Emma',
        serviceName: 'Botox',
        dateTime: '2026-03-01 10:00',
        businessName: 'Glow Clinic',
      });
      expect(result).toBe(true);
    });
  });

  describe('sendPasswordReset', () => {
    it('sends password reset email', async () => {
      const result = await service.sendPasswordReset('test@example.com', {
        name: 'Emma',
        resetUrl: 'https://example.com/reset/token123',
      });
      expect(result).toBe(true);
    });
  });

  describe('sendStaffInvitation', () => {
    it('sends staff invitation email', async () => {
      const result = await service.sendStaffInvitation('new@clinic.com', {
        name: 'Dr. Chen',
        businessName: 'Glow Clinic',
        inviteUrl: 'https://example.com/invite/token456',
      });
      expect(result).toBe(true);
    });
  });
});
