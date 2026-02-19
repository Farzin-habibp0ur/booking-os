import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from '../../common/prisma.service';
import { JwtBlacklistService } from '../../common/jwt-blacklist.service';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let prisma: { staff: { findUnique: jest.Mock }; viewAsSession: { findUnique: jest.Mock } };
  let blacklist: { isBlacklisted: jest.Mock };

  const payload = {
    sub: 'staff1',
    email: 'sarah@glowclinic.com',
    businessId: 'biz1',
    role: 'ADMIN',
  };

  beforeEach(() => {
    prisma = {
      staff: {
        findUnique: jest.fn(),
      },
      viewAsSession: {
        findUnique: jest.fn(),
      },
    };

    blacklist = {
      isBlacklisted: jest.fn().mockReturnValue(false),
    };

    const config = {
      get: jest.fn().mockReturnValue('test-secret'),
    };

    strategy = new JwtStrategy(
      config as unknown as ConfigService,
      prisma as unknown as PrismaService,
      blacklist as unknown as JwtBlacklistService,
    );
  });

  it('throws error when JWT_SECRET is not configured', () => {
    const configNoSecret = {
      get: jest.fn().mockReturnValue(undefined),
    };

    expect(() => {
      new JwtStrategy(
        configNoSecret as unknown as ConfigService,
        prisma as unknown as PrismaService,
        blacklist as unknown as JwtBlacklistService,
      );
    }).toThrow('JWT_SECRET environment variable must be configured');
  });

  it('returns user payload for valid active staff', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff1', isActive: true });

    const mockReq = { cookies: {}, headers: {} } as any;
    const result = await strategy.validate(mockReq, payload);

    expect(result).toEqual({
      sub: 'staff1',
      staffId: 'staff1',
      email: 'sarah@glowclinic.com',
      businessId: 'biz1',
      role: 'ADMIN',
    });
  });

  it('throws UnauthorizedException when token is blacklisted', async () => {
    blacklist.isBlacklisted.mockReturnValue(true);

    const mockReq = {
      cookies: { access_token: 'some-blacklisted-token' },
      headers: {},
    } as any;

    await expect(strategy.validate(mockReq, payload)).rejects.toThrow(
      new UnauthorizedException('Token has been revoked'),
    );
  });

  it('throws UnauthorizedException when staff is not found', async () => {
    prisma.staff.findUnique.mockResolvedValue(null);

    const mockReq = { cookies: {}, headers: {} } as any;

    await expect(strategy.validate(mockReq, payload)).rejects.toThrow(
      new UnauthorizedException('Account is deactivated'),
    );
  });

  it('throws UnauthorizedException when staff is inactive', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff1', isActive: false });

    const mockReq = { cookies: {}, headers: {} } as any;

    await expect(strategy.validate(mockReq, payload)).rejects.toThrow(
      new UnauthorizedException('Account is deactivated'),
    );
  });

  it('extracts token from cookie when available', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff1', isActive: true });

    const mockReq = {
      cookies: { access_token: 'cookie-token-value' },
    } as any;

    await strategy.validate(mockReq, payload);

    // The blacklist check should have been called with the cookie token
    expect(blacklist.isBlacklisted).toHaveBeenCalledWith('cookie-token-value');
  });

  it('falls back to Authorization header when no cookie', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff1', isActive: true });

    const mockReq = {
      cookies: {},
      headers: { authorization: 'Bearer header-token-value' },
    } as any;

    await strategy.validate(mockReq, payload);

    // Should check blacklist with the header bearer token
    expect(blacklist.isBlacklisted).toHaveBeenCalledWith('header-token-value');
  });

  it('skips blacklist check when no token can be extracted', async () => {
    prisma.staff.findUnique.mockResolvedValue({ id: 'staff1', isActive: true });

    const mockReq = {
      cookies: {},
      headers: {},
    } as any;

    const result = await strategy.validate(mockReq, payload);

    // No token extracted, so isBlacklisted not called (token is null)
    expect(result.staffId).toBe('staff1');
  });

  describe('view-as JWT validation', () => {
    const viewAsPayload = {
      sub: 'admin1',
      email: 'admin@businesscommandcentre.com',
      businessId: 'target-biz',
      role: 'ADMIN',
      viewAs: true,
      viewAsSessionId: 'session1',
      originalBusinessId: 'platform-biz',
      originalRole: 'SUPER_ADMIN',
    };

    it('validates view-as session and returns extended user object', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'admin1', isActive: true });
      prisma.viewAsSession.findUnique.mockResolvedValue({
        id: 'session1',
        endedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const mockReq = { cookies: {}, headers: {} } as any;
      const result = await strategy.validate(mockReq, viewAsPayload);

      expect(result).toEqual({
        sub: 'admin1',
        staffId: 'admin1',
        email: 'admin@businesscommandcentre.com',
        businessId: 'target-biz',
        role: 'ADMIN',
        viewAs: true,
        viewAsSessionId: 'session1',
        originalBusinessId: 'platform-biz',
        originalRole: 'SUPER_ADMIN',
      });
    });

    it('throws UnauthorizedException when view-as session not found', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'admin1', isActive: true });
      prisma.viewAsSession.findUnique.mockResolvedValue(null);

      const mockReq = { cookies: {}, headers: {} } as any;

      await expect(strategy.validate(mockReq, viewAsPayload)).rejects.toThrow(
        new UnauthorizedException('View-as session expired'),
      );
    });

    it('throws UnauthorizedException when view-as session has ended', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'admin1', isActive: true });
      prisma.viewAsSession.findUnique.mockResolvedValue({
        id: 'session1',
        endedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      });

      const mockReq = { cookies: {}, headers: {} } as any;

      await expect(strategy.validate(mockReq, viewAsPayload)).rejects.toThrow(
        new UnauthorizedException('View-as session expired'),
      );
    });

    it('throws UnauthorizedException when view-as session is expired', async () => {
      prisma.staff.findUnique.mockResolvedValue({ id: 'admin1', isActive: true });
      prisma.viewAsSession.findUnique.mockResolvedValue({
        id: 'session1',
        endedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      });

      const mockReq = { cookies: {}, headers: {} } as any;

      await expect(strategy.validate(mockReq, viewAsPayload)).rejects.toThrow(
        new UnauthorizedException('View-as session expired'),
      );
    });
  });
});
