import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';
import { EmailChannelController } from './email-channel.controller';
import { MessagingService } from './messaging.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('EmailChannelController', () => {
  let controller: EmailChannelController;
  let prisma: MockPrisma;
  let messagingService: { getEmailProvider: jest.Mock; registerEmailProvider: jest.Mock };

  beforeEach(async () => {
    prisma = createMockPrisma();
    messagingService = {
      getEmailProvider: jest.fn(),
      registerEmailProvider: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmailChannelController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: MessagingService, useValue: messagingService },
      ],
    }).compile();

    controller = module.get(EmailChannelController);
  });

  describe('sendTestEmail', () => {
    it('should send test email successfully when provider is configured', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        id: 'biz1',
        channelSettings: {
          email: {
            provider: 'resend',
            apiKey: 'test-api-key',
            fromAddress: 'support@example.com',
            fromName: 'Test Clinic',
          },
        },
      });

      // Mock fetch for Resend API
      const originalFetch = global.fetch;
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'email_123' }),
      });

      const result = await controller.sendTestEmail(
        { to: 'test@example.com', subject: 'Test', message: 'Hello' },
        'biz1',
      );

      expect(result.ok).toBe(true);
      expect(result.externalId).toBe('email_123');

      global.fetch = originalFetch;
    });

    it('should return error when provider is not configured', async () => {
      (prisma.business.findUnique as jest.Mock).mockResolvedValue({
        id: 'biz1',
        channelSettings: {},
      });

      await expect(
        controller.sendTestEmail(
          { to: 'test@example.com', subject: 'Test', message: 'Hello' },
          'biz1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should validate email format', async () => {
      await expect(
        controller.sendTestEmail(
          { to: 'invalid-email', subject: 'Test', message: 'Hello' },
          'biz1',
        ),
      ).rejects.toThrow('Invalid email format');
    });

    it('should require all fields', async () => {
      await expect(
        controller.sendTestEmail({ to: '', subject: 'Test', message: 'Hello' }, 'biz1'),
      ).rejects.toThrow('to, subject, and message are required');
    });
  });

  describe('checkDns', () => {
    it('should return DNS check results for a valid domain', async () => {
      const result = await controller.checkDns('example.com');

      expect(result.domain).toBe('example.com');
      expect(result.checks).toHaveLength(4);
      expect(result.checks.map((c: any) => c.type)).toEqual(['MX', 'SPF', 'DKIM', 'DMARC']);
    });

    it('should require domain parameter', async () => {
      await expect(controller.checkDns('')).rejects.toThrow('domain query parameter is required');
    });

    it('should validate domain format', async () => {
      await expect(controller.checkDns('x')).rejects.toThrow('Invalid domain format');
    });
  });
});
