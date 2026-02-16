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
    role: 'OWNER',
    isActive: true,
    businessId: 'biz1',
    locale: 'en',
    business: {
      id: 'biz1',
      name: 'Glow Clinic',
      slug: 'glow-clinic',
      verticalPack: 'AESTHETIC',
      defaultLocale: 'en',
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
        role: 'OWNER',
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
      expect(result.staff.role).toBe('OWNER');
      expect(prisma.business.create).toHaveBeenCalled();
      expect(prisma.staff.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz-new',
          email: 'owner@new.com',
          role: 'OWNER',
        }),
      });
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
        role: 'OWNER',
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
    it('validates token, hashes new password, marks used', async () => {
      const tokenRecord = {
        id: 'token1',
        staffId: 'staff1',
        email: 'sarah@glowclinic.com',
      };
      tokenService.validateToken.mockResolvedValue(tokenRecord as any);
      (bcrypt.hash as jest.Mock).mockResolvedValue('$new-hash');
      prisma.staff.update.mockResolvedValue({} as any);

      const result = await authService.resetPassword('valid-token', 'newpassword123');

      expect(result).toEqual({ ok: true });
      expect(tokenService.validateToken).toHaveBeenCalledWith('valid-token', 'PASSWORD_RESET');
      expect(bcrypt.hash).toHaveBeenCalledWith('newpassword123', 10);
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff1' },
        data: { passwordHash: '$new-hash' },
      });
      expect(tokenService.markUsed).toHaveBeenCalledWith('token1');
    });

    it('throws on invalid token', async () => {
      tokenService.validateToken.mockRejectedValue(new BadRequestException('Invalid token'));

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
      expect(tokenService.revokeTokens).toHaveBeenCalledWith(
        'sarah@glowclinic.com',
        'PASSWORD_RESET',
      );
    });

    it('throws on wrong current password', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(authService.changePassword('staff1', 'wrongpass', 'newpass123')).rejects.toThrow(
        BadRequestException,
      );
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
    it('validates token, sets password, activates staff, returns tokens', async () => {
      const tokenRecord = { id: 'token1', staffId: 'staff2' };
      tokenService.validateToken.mockResolvedValue(tokenRecord as any);
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
      expect(tokenService.validateToken).toHaveBeenCalledWith('invite-token', 'STAFF_INVITE');
      expect(prisma.staff.update).toHaveBeenCalledWith({
        where: { id: 'staff2' },
        data: { passwordHash: '$invite-hash', isActive: true },
      });
      expect(tokenService.markUsed).toHaveBeenCalledWith('token1');
    });

    it('throws on invalid token', async () => {
      tokenService.validateToken.mockRejectedValue(new BadRequestException('Invalid token'));

      await expect(authService.acceptInvite('bad-token', 'password123')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
