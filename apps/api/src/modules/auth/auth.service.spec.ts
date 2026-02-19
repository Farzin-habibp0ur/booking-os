import { Test } from '@nestjs/testing';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma.service';
import { TokenService } from '../../common/token.service';
import { EmailService } from '../email/email.service';
import {
  createMockPrisma,
  createMockConfigService,
  createMockTokenService,
  createMockEmailService,
} from '../../test/mocks';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let tokenService: ReturnType<typeof createMockTokenService>;
  let emailService: ReturnType<typeof createMockEmailService>;

  const mockStaff = {
    id: 'staff1',
    name: 'Sarah Johnson',
    email: 'sarah@glowclinic.com',
    passwordHash: '$2b$10$hashedpassword',
    role: 'ADMIN',
    isActive: true,
    businessId: 'biz1',
    locale: 'en',
    business: {
      id: 'biz1',
      name: 'Glow Clinic',
      slug: 'glow-clinic',
      verticalPack: 'AESTHETIC',
      defaultLocale: 'en',
      packConfig: { requireConsultation: true },
    },
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    jwtService = {
      sign: jest.fn().mockReturnValue('mock-token'),
      verify: jest.fn(),
    };
    tokenService = createMockTokenService();
    emailService = createMockEmailService();

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: createMockConfigService() },
        { provide: TokenService, useValue: tokenService },
        { provide: EmailService, useValue: emailService },
      ],
    }).compile();

    authService = module.get(AuthService);
  });

  describe('signup', () => {
    it('creates business + staff and returns tokens', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$hashed');
      prisma.business.create.mockResolvedValue({
        id: 'biz-new',
        name: 'New Biz',
        slug: 'new-biz',
      } as any);
      prisma.staff.create.mockResolvedValue({
        id: 'staff-new',
        name: 'Owner',
        email: 'owner@new.com',
        role: 'ADMIN',
        businessId: 'biz-new',
      } as any);

      const result = await authService.signup({
        businessName: 'New Biz',
        ownerName: 'Owner',
        email: 'owner@new.com',
        password: 'password123',
      });

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.staff.email).toBe('owner@new.com');
      expect(result.staff.role).toBe('ADMIN');
      expect(prisma.business.create).toHaveBeenCalled();
      expect(prisma.staff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz-new',
          email: 'owner@new.com',
          role: 'ADMIN',
          emailVerified: false,
        }),
      });
    });

    it('sends verification email on signup', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$hashed');
      prisma.business.create.mockResolvedValue({
        id: 'biz-new',
        name: 'New Biz',
        slug: 'new-biz',
      } as any);
      prisma.staff.create.mockResolvedValue({
        id: 'staff-new',
        name: 'Owner',
        email: 'owner@new.com',
        role: 'ADMIN',
        businessId: 'biz-new',
      } as any);

      await authService.signup({
        businessName: 'New Biz',
        ownerName: 'Owner',
        email: 'owner@new.com',
        password: 'password123',
      });

      expect(tokenService.createToken).toHaveBeenCalledWith(
        'EMAIL_VERIFY',
        'owner@new.com',
        'biz-new',
        'staff-new',
        24,
      );
      expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
        'owner@new.com',
        expect.objectContaining({ name: 'Owner' }),
      );
    });

    it('throws ConflictException for duplicate email', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);

      await expect(
        authService.signup({
          businessName: 'Dup',
          ownerName: 'Dup',
          email: 'sarah@glowclinic.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('returns tokens and staff on valid credentials', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login('sarah@glowclinic.com', 'password123');

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(result.staff.id).toBe('staff1');
      expect(result.staff.email).toBe('sarah@glowclinic.com');
      expect(result.staff.businessId).toBe('biz1');
    });

    it('throws UnauthorizedException for non-existent user', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);

      await expect(authService.login('unknown@test.com', 'password')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for inactive user', async () => {
      prisma.staff.findUnique.mockResolvedValue({ ...mockStaff, isActive: false } as any);

      await expect(authService.login('sarah@glowclinic.com', 'password123')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException for wrong password', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.login('sarah@glowclinic.com', 'wrongpassword')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('signs JWT with correct payload', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await authService.login('sarah@glowclinic.com', 'password123');

      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: 'staff1',
        email: 'sarah@glowclinic.com',
        businessId: 'biz1',
        role: 'ADMIN',
      });
    });
  });

  describe('refresh', () => {
    it('returns new tokens on valid refresh token', async () => {
      jwtService.verify.mockReturnValue({ sub: 'staff1' });
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);

      const result = await authService.refresh('valid-refresh-token');

      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
    });

    it('throws UnauthorizedException on invalid refresh token', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid token');
      });

      await expect(authService.refresh('invalid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive staff on refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'staff1' });
      prisma.staff.findUnique.mockResolvedValue({ ...mockStaff, isActive: false } as any);

      await expect(authService.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when staff not found on refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'nonexistent' });
      prisma.staff.findUnique.mockResolvedValue(null);

      await expect(authService.refresh('valid-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getMe', () => {
    it('returns staff info with business details', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);

      const result = await authService.getMe('staff1');

      expect(result.id).toBe('staff1');
      expect(result.name).toBe('Sarah Johnson');
      expect(result.business.name).toBe('Glow Clinic');
      expect(result.business.verticalPack).toBe('AESTHETIC');
      expect(result.business.packConfig).toEqual({ requireConsultation: true });
    });

    it('throws UnauthorizedException when staff not found', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);

      await expect(authService.getMe('nonexistent')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('forgotPassword', () => {
    it('creates token, sends email, returns ok', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);

      const result = await authService.forgotPassword('sarah@glowclinic.com');

      expect(result).toEqual({ ok: true });
      expect(tokenService.revokeTokens).toHaveBeenCalledWith(
        'sarah@glowclinic.com',
        'PASSWORD_RESET',
      );
      expect(tokenService.createToken).toHaveBeenCalledWith(
        'PASSWORD_RESET',
        'sarah@glowclinic.com',
        'biz1',
        'staff1',
        1,
      );
      expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
        'sarah@glowclinic.com',
        expect.objectContaining({ name: 'Sarah Johnson' }),
      );
    });

    it('returns ok for non-existent email (no enumeration)', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);

      const result = await authService.forgotPassword('nobody@test.com');

      expect(result).toEqual({ ok: true });
      expect(tokenService.createToken).not.toHaveBeenCalled();
      expect(emailService.sendPasswordReset).not.toHaveBeenCalled();
    });
  });

  describe('resetPassword', () => {
    it('atomically validates and consumes token, then hashes new password (C1 fix)', async () => {
      const tokenRecord = {
        id: 'token1',
        staffId: 'staff1',
        email: 'sarah@glowclinic.com',
      };
      tokenService.validateAndConsume.mockResolvedValue(tokenRecord as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$new-hash');
      prisma.staff.update.mockResolvedValue({} as any);

      const result = await authService.resetPassword('valid-token', 'newpassword123');

      expect(result).toEqual({ ok: true });
      // C1 fix: Uses validateAndConsume (atomic) instead of separate validateToken + markUsed
      expect(tokenService.validateAndConsume).toHaveBeenCalledWith('valid-token', 'PASSWORD_RESET');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 12);
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: { passwordHash: '$new-hash' },
      });
      // markUsed should NOT be called separately — consumed atomically
      expect(tokenService.markUsed).not.toHaveBeenCalled();
    });

    it('throws on invalid token', async () => {
      tokenService.validateAndConsume.mockRejectedValue(new BadRequestException('Invalid token'));

      await expect(authService.resetPassword('bad-token', 'newpassword123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('changePassword', () => {
    it('verifies current password, updates hash, and revokes tokens', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$new-hash');
      prisma.staff.update.mockResolvedValue({} as any);

      const result = await authService.changePassword('staff1', 'oldpass', 'newpass123');

      expect(result.ok).toBe(true);
      expect(result.accessToken).toBe('mock-token');
      expect(result.refreshToken).toBe('mock-token');
      expect(bcrypt.compare).toHaveBeenCalledWith('oldpass', '$2b$10$hashedpassword');
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: { passwordHash: '$new-hash' },
      });
      // C4 fix: Revokes ALL token types, not just PASSWORD_RESET
      expect(tokenService.revokeAllTokensForEmail).toHaveBeenCalledWith('sarah@glowclinic.com');
    });

    it('throws on wrong current password', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.changePassword('staff1', 'wrongpass', 'newpass123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // H6 fix: Warn on unverified email login
  describe('login email verification warning', () => {
    it('logs warning when emailVerified is false', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        ...mockStaff,
        emailVerified: false,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loggerSpy = jest.spyOn((authService as any).logger, 'warn');

      await authService.login('sarah@glowclinic.com', 'password123');

      expect(loggerSpy).toHaveBeenCalledWith(expect.stringContaining('Login by unverified email'));
    });

    it('does not log warning when emailVerified is true', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        ...mockStaff,
        emailVerified: true,
      } as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const loggerSpy = jest.spyOn((authService as any).logger, 'warn');

      await authService.login('sarah@glowclinic.com', 'password123');

      expect(loggerSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Login by unverified email'),
      );
    });
  });

  // M1 fix: JWT_REFRESH_SECRET production enforcement
  describe('getRefreshSecret production enforcement', () => {
    it('throws in production when JWT_REFRESH_SECRET is not set', async () => {
      // Create a service instance with production config and no refresh secret
      const prodConfig = {
        get: jest.fn((key: string, defaultValue?: any) => {
          const config: Record<string, string> = {
            NODE_ENV: 'production',
            JWT_SECRET: 'some-jwt-secret',
          };
          return config[key] ?? defaultValue;
        }),
      };

      const module = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: prisma },
          { provide: JwtService, useValue: jwtService },
          { provide: ConfigService, useValue: prodConfig },
          { provide: TokenService, useValue: tokenService },
          { provide: EmailService, useValue: emailService },
        ],
      }).compile();

      const prodAuthService = module.get(AuthService);

      // Trigger getRefreshSecret via login
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(prodAuthService.login('sarah@glowclinic.com', 'password123')).rejects.toThrow(
        'JWT_REFRESH_SECRET must be set in production',
      );
    });

    it('allows fallback to JWT_SECRET in development', async () => {
      // Default mock config has no JWT_REFRESH_SECRET and NODE_ENV=development
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const result = await authService.login('sarah@glowclinic.com', 'password123');

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });

  describe('brute-force protection', () => {
    it('locks account after 5 failed attempts', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      // Fail 5 times
      for (let i = 0; i < 5; i++) {
        await expect(authService.login('sarah@glowclinic.com', 'wrong')).rejects.toThrow(
          UnauthorizedException,
        );
      }

      // 6th attempt should be locked
      await expect(authService.login('sarah@glowclinic.com', 'password123')).rejects.toThrow(
        'Account temporarily locked',
      );
    });

    it('clears failed attempts on successful login', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(false);
      (bcrypt.compare as jest.Mock).mockResolvedValueOnce(true);

      // Fail twice
      await expect(authService.login('sarah@glowclinic.com', 'wrong')).rejects.toThrow();
      await expect(authService.login('sarah@glowclinic.com', 'wrong')).rejects.toThrow();

      // Succeed
      const result = await authService.login('sarah@glowclinic.com', 'password123');
      expect(result.accessToken).toBeDefined();

      // After success, fail again should count from 0
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      for (let i = 0; i < 4; i++) {
        await expect(authService.login('sarah@glowclinic.com', 'wrong')).rejects.toThrow(
          'Invalid credentials',
        );
      }
    });
  });

  describe('acceptInvite', () => {
    it('atomically consumes token, sets password, activates staff (C2 fix)', async () => {
      const tokenRecord = { id: 'token1', staffId: 'staff2' };
      tokenService.validateAndConsume.mockResolvedValue(tokenRecord as any);
      prisma.staff.findUnique.mockResolvedValue({
        id: 'staff2',
        name: 'Jane',
        email: 'jane@test.com',
        role: 'AGENT',
        isActive: false,
        businessId: 'biz1',
        passwordHash: null,
      } as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$invite-hash');
      prisma.staff.update.mockResolvedValue({
        id: 'staff2',
        name: 'Jane',
        email: 'jane@test.com',
        role: 'AGENT',
        isActive: true,
        businessId: 'biz1',
      } as any);

      const result = await authService.acceptInvite('invite-token', 'mypassword123');

      expect(result.accessToken).toBe('mock-token');
      expect(result.staff.id).toBe('staff2');
      // C2 fix: Uses validateAndConsume (atomic) instead of separate validateToken + markUsed
      expect(tokenService.validateAndConsume).toHaveBeenCalledWith('invite-token', 'STAFF_INVITE');
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff2' },
        data: { passwordHash: '$invite-hash', isActive: true },
      });
      // markUsed should NOT be called separately — consumed atomically
      expect(tokenService.markUsed).not.toHaveBeenCalled();
    });

    it('throws on invalid token', async () => {
      tokenService.validateAndConsume.mockRejectedValue(new BadRequestException('Invalid token'));

      await expect(authService.acceptInvite('bad-token', 'password123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // M16: Email verification tests
  describe('verifyEmail', () => {
    it('atomically consumes token, then marks staff as verified (C3 fix)', async () => {
      const tokenRecord = { id: 'token1', staffId: 'staff1' };
      tokenService.validateAndConsume.mockResolvedValue(tokenRecord as any);
      prisma.staff.update.mockResolvedValue({} as any);

      const result = await authService.verifyEmail('verify-token');

      expect(result).toEqual({ ok: true });
      // C3 fix: Uses validateAndConsume (atomic) instead of separate validateToken + markUsed
      expect(tokenService.validateAndConsume).toHaveBeenCalledWith('verify-token', 'EMAIL_VERIFY');
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: { emailVerified: true },
      });
      // markUsed should NOT be called separately — consumed atomically
      expect(tokenService.markUsed).not.toHaveBeenCalled();
    });

    it('throws on invalid token', async () => {
      tokenService.validateAndConsume.mockRejectedValue(new BadRequestException('Invalid token'));

      await expect(authService.verifyEmail('bad-token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('resendVerification', () => {
    it('revokes old tokens and sends new verification email', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        ...mockStaff,
        emailVerified: false,
      } as any);

      const result = await authService.resendVerification('staff1');

      expect(result).toEqual({ ok: true });
      expect(tokenService.revokeTokens).toHaveBeenCalledWith(
        'sarah@glowclinic.com',
        'EMAIL_VERIFY',
      );
      expect(tokenService.createToken).toHaveBeenCalledWith(
        'EMAIL_VERIFY',
        'sarah@glowclinic.com',
        'biz1',
        'staff1',
        24,
      );
      expect(emailService.sendEmailVerification).toHaveBeenCalledWith(
        'sarah@glowclinic.com',
        expect.objectContaining({ name: 'Sarah Johnson' }),
      );
    });

    it('throws if email already verified', async () => {
      prisma.staff.findUnique.mockResolvedValue({
        ...mockStaff,
        emailVerified: true,
      } as any);

      await expect(authService.resendVerification('staff1')).rejects.toThrow(BadRequestException);
    });

    it('throws if staff not found', async () => {
      prisma.staff.findUnique.mockResolvedValue(null);

      await expect(authService.resendVerification('nonexistent')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
