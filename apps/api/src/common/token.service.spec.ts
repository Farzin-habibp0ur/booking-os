import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TokenService } from './token.service';
import { PrismaService } from './prisma.service';
import { createMockPrisma } from '../test/mocks';

describe('TokenService', () => {
  let tokenService: TokenService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [TokenService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    tokenService = module.get(TokenService);
  });

  describe('createToken', () => {
    it('stores token in DB and returns hex string', async () => {
      prisma.token.create.mockResolvedValue({} as any);

      const result = await tokenService.createToken(
        'PASSWORD_RESET',
        'test@test.com',
        'biz1',
        'staff1',
        1,
      );

      expect(typeof result).toBe('string');
      expect(result).toMatch(/^[0-9a-f]{64}$/);
      expect(prisma.token.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'PASSWORD_RESET',
          email: 'test@test.com',
          businessId: 'biz1',
          staffId: 'staff1',
        }),
      });

      // Verify expiry is approximately 1 hour from now
      const callData = prisma.token.create.mock.calls[0][0].data;
      const expiryDiff = (callData.expiresAt as Date).getTime() - Date.now();
      expect(expiryDiff).toBeGreaterThan(3500000); // ~58 min
      expect(expiryDiff).toBeLessThan(3700000); // ~62 min
    });
  });

  describe('validateToken', () => {
    const validRecord = {
      id: 'token1',
      token: 'abc123',
      type: 'PASSWORD_RESET',
      email: 'test@test.com',
      staffId: 'staff1',
      usedAt: null,
      expiresAt: new Date(Date.now() + 3600000),
    };

    it('returns record for valid token', async () => {
      prisma.token.findUnique.mockResolvedValue(validRecord as any);

      const result = await tokenService.validateToken('abc123', 'PASSWORD_RESET');

      expect(result.id).toBe('token1');
      expect(result.email).toBe('test@test.com');
    });

    it('throws BadRequestException for missing token', async () => {
      prisma.token.findUnique.mockResolvedValue(null);

      await expect(tokenService.validateToken('nonexistent', 'PASSWORD_RESET')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for wrong type', async () => {
      prisma.token.findUnique.mockResolvedValue(validRecord as any);

      await expect(tokenService.validateToken('abc123', 'STAFF_INVITE')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for used token', async () => {
      prisma.token.findUnique.mockResolvedValue({
        ...validRecord,
        usedAt: new Date(),
      } as any);

      await expect(tokenService.validateToken('abc123', 'PASSWORD_RESET')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException for expired token', async () => {
      prisma.token.findUnique.mockResolvedValue({
        ...validRecord,
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(tokenService.validateToken('abc123', 'PASSWORD_RESET')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('markUsed', () => {
    it('sets usedAt on the token', async () => {
      prisma.token.update.mockResolvedValue({} as any);

      await tokenService.markUsed('token1');

      expect(prisma.token.update).toHaveBeenCalledWith({
        where: { id: 'token1' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('revokeTokens', () => {
    it('calls deleteMany with correct filter', async () => {
      prisma.token.deleteMany.mockResolvedValue({ count: 2 } as any);

      await tokenService.revokeTokens('test@test.com', 'PASSWORD_RESET');

      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@test.com', type: 'PASSWORD_RESET' },
      });
    });

    it('works with different token types', async () => {
      prisma.token.deleteMany.mockResolvedValue({ count: 1 } as any);

      await tokenService.revokeTokens('test@test.com', 'STAFF_INVITE');

      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@test.com', type: 'STAFF_INVITE' },
      });
    });
  });

  describe('revokeBookingTokens', () => {
    it('calls deleteMany with bookingId and type filter', async () => {
      prisma.token.deleteMany.mockResolvedValue({ count: 1 } as any);

      await tokenService.revokeBookingTokens('booking1', 'RESCHEDULE');

      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking1', type: 'RESCHEDULE' },
      });
    });

    it('works with CANCEL type', async () => {
      prisma.token.deleteMany.mockResolvedValue({ count: 0 } as any);

      await tokenService.revokeBookingTokens('booking2', 'CANCEL');

      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { bookingId: 'booking2', type: 'CANCEL' },
      });
    });
  });

  describe('revokeAllTokensForEmail', () => {
    it('calls deleteMany with only email filter (all types)', async () => {
      prisma.token.deleteMany.mockResolvedValue({ count: 5 } as any);

      await tokenService.revokeAllTokensForEmail('test@test.com');

      expect(prisma.token.deleteMany).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });
  });

  // C1/C2/C3 fix: Atomic validate + consume prevents race conditions
  describe('validateAndConsume', () => {
    const validRecord = {
      id: 'token1',
      token: 'abc123',
      type: 'PASSWORD_RESET',
      email: 'test@test.com',
      staffId: 'staff1',
      usedAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000),
    };

    it('atomically marks token used and returns record when valid', async () => {
      prisma.token.updateMany.mockResolvedValue({ count: 1 } as any);
      prisma.token.findUnique.mockResolvedValue(validRecord as any);

      const result = await tokenService.validateAndConsume('abc123', 'PASSWORD_RESET');

      expect(result).toBeDefined();
      expect(result!.id).toBe('token1');
      expect(prisma.token.updateMany).toHaveBeenCalledWith({
        where: {
          token: 'abc123',
          type: 'PASSWORD_RESET',
          usedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        data: { usedAt: expect.any(Date) },
      });
    });

    it('throws when token already used (race condition blocked)', async () => {
      prisma.token.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.token.findUnique.mockResolvedValue({
        ...validRecord,
        usedAt: new Date(), // Already consumed by concurrent request
      } as any);

      await expect(tokenService.validateAndConsume('abc123', 'PASSWORD_RESET')).rejects.toThrow(
        'Token has already been used',
      );
    });

    it('throws when token is expired', async () => {
      prisma.token.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.token.findUnique.mockResolvedValue({
        ...validRecord,
        usedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      await expect(tokenService.validateAndConsume('abc123', 'PASSWORD_RESET')).rejects.toThrow(
        'Token has expired',
      );
    });

    it('throws when token not found', async () => {
      prisma.token.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.token.findUnique.mockResolvedValue(null);

      await expect(
        tokenService.validateAndConsume('nonexistent', 'PASSWORD_RESET'),
      ).rejects.toThrow('Invalid token');
    });

    it('throws when token type does not match', async () => {
      prisma.token.updateMany.mockResolvedValue({ count: 0 } as any);
      prisma.token.findUnique.mockResolvedValue({
        ...validRecord,
        type: 'STAFF_INVITE',
        usedAt: null,
      } as any);

      await expect(tokenService.validateAndConsume('abc123', 'PASSWORD_RESET')).rejects.toThrow(
        'Invalid token',
      );
    });
  });

  describe('createToken with bookingId', () => {
    it('stores bookingId when provided', async () => {
      prisma.token.create.mockResolvedValue({} as any);

      await tokenService.createToken(
        'RESCHEDULE',
        'test@test.com',
        'biz1',
        'staff1',
        24,
        'booking1',
      );

      expect(prisma.token.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: 'RESCHEDULE',
          email: 'test@test.com',
          bookingId: 'booking1',
        }),
      });
    });

    it('uses default 24-hour expiry when not specified', async () => {
      prisma.token.create.mockResolvedValue({} as any);

      await tokenService.createToken('PASSWORD_RESET', 'test@test.com');

      const callData = prisma.token.create.mock.calls[0][0].data;
      const expiryDiff = (callData.expiresAt as Date).getTime() - Date.now();
      // Should be approximately 24 hours (86400000ms)
      expect(expiryDiff).toBeGreaterThan(86000000);
      expect(expiryDiff).toBeLessThan(86800000);
    });
  });
});
