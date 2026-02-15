import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma, createMockConfigService } from '../../test/mocks';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let authService: AuthService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwtService: { sign: jest.Mock; verify: jest.Mock };

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

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: createMockConfigService() },
      ],
    }).compile();

    authService = module.get(AuthService);
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

      await expect(
        authService.login('unknown@test.com', 'password'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive user', async () => {
      prisma.staff.findUnique.mockResolvedValue({ ...mockStaff, isActive: false } as any);

      await expect(
        authService.login('sarah@glowclinic.com', 'password123'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for wrong password', async () => {
      prisma.staff.findUnique.mockResolvedValue(mockStaff as any);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        authService.login('sarah@glowclinic.com', 'wrongpassword'),
      ).rejects.toThrow(UnauthorizedException);
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

      await expect(
        authService.refresh('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for inactive staff on refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'staff1' });
      prisma.staff.findUnique.mockResolvedValue({ ...mockStaff, isActive: false } as any);

      await expect(
        authService.refresh('valid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when staff not found on refresh', async () => {
      jwtService.verify.mockReturnValue({ sub: 'nonexistent' });
      prisma.staff.findUnique.mockResolvedValue(null);

      await expect(
        authService.refresh('valid-token'),
      ).rejects.toThrow(UnauthorizedException);
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

      await expect(
        authService.getMe('nonexistent'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
