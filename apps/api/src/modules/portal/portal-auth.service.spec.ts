import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PortalAuthService } from './portal-auth.service';
import { PrismaService } from '../../common/prisma.service';
import { PortalRedisService } from '../../common/portal-redis.service';
import { EmailService } from '../email/email.service';
import { createMockPrisma } from '../../test/mocks';

describe('PortalAuthService', () => {
  let service: PortalAuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let emailService: { send: jest.Mock; buildBrandedHtml: jest.Mock };
  let mockQueue: { add: jest.Mock };
  let redisStore: PortalRedisService;

  const mockBusiness = { id: 'biz1', name: 'Test Clinic', slug: 'test-clinic' };
  const mockCustomer = {
    id: 'cust1',
    businessId: 'biz1',
    phone: '+1234567890',
    email: 'cust@test.com',
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn().mockReturnValue({
        customerId: 'cust1',
        businessId: 'biz1',
        type: 'magic-link',
      }),
    };
    emailService = {
      send: jest.fn().mockResolvedValue(true),
      buildBrandedHtml: jest.fn((html: string) => `<html>${html}</html>`),
    };
    mockQueue = { add: jest.fn().mockResolvedValue({}) };

    // Create a real PortalRedisService (in-memory fallback mode, no REDIS_URL)
    const mockConfig = { get: jest.fn(() => undefined) } as any;
    redisStore = new PortalRedisService(mockConfig);

    const module = await Test.createTestingModule({
      providers: [
        PortalAuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn((key: string, def?: any) => def) } },
        { provide: EmailService, useValue: emailService },
        { provide: PortalRedisService, useValue: redisStore },
        { provide: 'QUEUE_AVAILABLE', useValue: true },
        { provide: 'BullQueue_messaging', useValue: mockQueue },
      ],
    }).compile();

    service = module.get(PortalAuthService);
    (service as any).messagingQueue = mockQueue;
  });

  describe('requestOtp', () => {
    it('generates OTP and enqueues WhatsApp message', async () => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);

      const result = await service.requestOtp('test-clinic', '+1234567890');

      expect(result.message).toBe('Verification code sent');
      expect(mockQueue.add).toHaveBeenCalledWith(
        'portal-otp',
        expect.objectContaining({
          to: '+1234567890',
          businessId: 'biz1',
        }),
      );
    });

    it('throws if customer not found', async () => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.requestOtp('test-clinic', '+0000000000')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws if business not found', async () => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.requestOtp('no-biz', '+1234567890')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyOtp', () => {
    beforeEach(() => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
    });

    it('returns token for valid OTP', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      await service.requestOtp('test-clinic', '+1234567890');

      // Get the OTP from the redis store (in-memory fallback)
      const key = `portal-otp:biz1:+1234567890`;
      const raw = await redisStore.get(key);
      const entry = JSON.parse(raw!);

      const result = await service.verifyOtp('test-clinic', '+1234567890', entry.otp);

      expect(result.token).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: 'cust1',
          businessId: 'biz1',
          type: 'portal',
        }),
        expect.objectContaining({ expiresIn: '24h' }),
      );
    });

    it('rejects wrong OTP', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      await service.requestOtp('test-clinic', '+1234567890');

      await expect(service.verifyOtp('test-clinic', '+1234567890', '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects after max attempts', async () => {
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);
      await service.requestOtp('test-clinic', '+1234567890');

      // Exhaust attempts
      for (let i = 0; i < 5; i++) {
        try {
          await service.verifyOtp('test-clinic', '+1234567890', '000000');
        } catch {
          // expected
        }
      }

      await expect(service.verifyOtp('test-clinic', '+1234567890', '000000')).rejects.toThrow(
        /request a new code|No verification/,
      );
    });

    it('rejects when no OTP exists', async () => {
      await expect(service.verifyOtp('test-clinic', '+9999999999', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('requestMagicLink', () => {
    it('sends magic link email', async () => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(mockCustomer);

      const result = await service.requestMagicLink('test-clinic', 'cust@test.com');

      expect(result.message).toBe('Magic link sent to your email');
      expect(emailService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'cust@test.com',
          subject: expect.stringContaining('Test Clinic'),
        }),
      );
    });

    it('throws if customer not found by email', async () => {
      (prisma.business.findFirst as jest.Mock).mockResolvedValue(mockBusiness);
      (prisma.customer.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.requestMagicLink('test-clinic', 'no@test.com')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('verifyMagicLink', () => {
    it('returns portal token for valid magic link', async () => {
      (prisma.customer.findUnique as jest.Mock).mockResolvedValue(mockCustomer);

      const result = await service.verifyMagicLink('valid-magic-token');

      expect(result.token).toBe('mock-jwt-token');
      expect(jwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'portal' }),
        expect.any(Object),
      );
    });

    it('rejects invalid token type', async () => {
      jwtService.verify.mockReturnValue({ type: 'staff', customerId: 'c1', businessId: 'b1' });

      await expect(service.verifyMagicLink('bad-type-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects expired token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.verifyMagicLink('expired-token')).rejects.toThrow(UnauthorizedException);
    });
  });
});
