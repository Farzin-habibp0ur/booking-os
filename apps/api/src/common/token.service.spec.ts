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
  });
});
