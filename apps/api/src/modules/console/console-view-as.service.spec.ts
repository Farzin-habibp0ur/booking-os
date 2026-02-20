import { Test } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConsoleViewAsService } from './console-view-as.service';
import { PlatformAuditService } from './platform-audit.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleViewAsService', () => {
  let service: ConsoleViewAsService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let jwt: { sign: jest.Mock };
  let audit: { log: jest.Mock };

  const superAdmin = {
    sub: 'admin1',
    email: 'admin@businesscommandcentre.com',
    businessId: 'platform-biz',
  };

  beforeEach(async () => {
    prisma = createMockPrisma();
    jwt = { sign: jest.fn().mockReturnValue('mock-jwt-token') };
    audit = { log: jest.fn().mockResolvedValue(undefined) };

    const module = await Test.createTestingModule({
      providers: [
        ConsoleViewAsService,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: PlatformAuditService, useValue: audit },
      ],
    }).compile();

    service = module.get(ConsoleViewAsService);
  });

  describe('startSession', () => {
    const targetBusiness = { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' };

    beforeEach(() => {
      prisma.business.findUnique.mockResolvedValue(targetBusiness as any);
      prisma.viewAsSession.findFirst.mockResolvedValue(null);
      prisma.viewAsSession.create.mockResolvedValue({
        id: 'session1',
        superAdminId: superAdmin.sub,
        targetBusinessId: 'biz1',
        reason: 'Testing issue',
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      } as any);
    });

    it('creates a view-as session and returns tokens', async () => {
      const result = await service.startSession(
        superAdmin.sub,
        superAdmin.email,
        superAdmin.businessId,
        'biz1',
        'Testing issue',
      );

      expect(result.sessionId).toBe('session1');
      expect(result.accessToken).toBe('mock-jwt-token');
      expect(result.refreshToken).toBe('mock-jwt-token');
      expect(result.business).toEqual(targetBusiness);
      expect(result.expiresAt).toBeDefined();
    });

    it('issues JWT with viewAs claims', async () => {
      await service.startSession(
        superAdmin.sub,
        superAdmin.email,
        superAdmin.businessId,
        'biz1',
        'Testing issue',
      );

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: superAdmin.sub,
          email: superAdmin.email,
          businessId: 'biz1',
          role: 'ADMIN',
          viewAs: true,
          viewAsSessionId: 'session1',
          originalBusinessId: superAdmin.businessId,
          originalRole: 'SUPER_ADMIN',
        }),
        { expiresIn: '15m' },
      );
    });

    it('logs audit entry for VIEW_AS_START', async () => {
      await service.startSession(
        superAdmin.sub,
        superAdmin.email,
        superAdmin.businessId,
        'biz1',
        'Testing issue',
      );

      expect(audit.log).toHaveBeenCalledWith(
        superAdmin.sub,
        superAdmin.email,
        'VIEW_AS_START',
        expect.objectContaining({
          targetType: 'BUSINESS',
          targetId: 'biz1',
          reason: 'Testing issue',
        }),
      );
    });

    it('throws BadRequestException when reason is empty', async () => {
      await expect(
        service.startSession(superAdmin.sub, superAdmin.email, superAdmin.businessId, 'biz1', ''),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when reason is whitespace only', async () => {
      await expect(
        service.startSession(
          superAdmin.sub,
          superAdmin.email,
          superAdmin.businessId,
          'biz1',
          '   ',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException when target business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);

      await expect(
        service.startSession(
          superAdmin.sub,
          superAdmin.email,
          superAdmin.businessId,
          'nonexistent',
          'Reason',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when active session exists', async () => {
      prisma.viewAsSession.findFirst.mockResolvedValue({
        id: 'existing-session',
        endedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      } as any);

      await expect(
        service.startSession(
          superAdmin.sub,
          superAdmin.email,
          superAdmin.businessId,
          'biz1',
          'Reason',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('trims reason text', async () => {
      await service.startSession(
        superAdmin.sub,
        superAdmin.email,
        superAdmin.businessId,
        'biz1',
        '  Investigating bug  ',
      );

      expect(prisma.viewAsSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reason: 'Investigating bug' }),
        }),
      );
    });
  });

  describe('endSession', () => {
    it('ends session by viewAsSessionId', async () => {
      prisma.viewAsSession.findFirst.mockResolvedValue({
        id: 'session1',
        superAdminId: superAdmin.sub,
        targetBusinessId: 'biz1',
        endedAt: null,
      } as any);
      prisma.viewAsSession.update.mockResolvedValue({} as any);
      prisma.staff.findUnique.mockResolvedValue({
        id: superAdmin.sub,
        email: superAdmin.email,
        businessId: superAdmin.businessId,
        role: 'SUPER_ADMIN',
      } as any);

      const result = await service.endSession(superAdmin.sub, superAdmin.email, 'session1');

      expect(result.ended).toBe(true);
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });

    it('ends any active session when no sessionId provided', async () => {
      prisma.viewAsSession.findFirst.mockResolvedValue({
        id: 'session1',
        superAdminId: superAdmin.sub,
        targetBusinessId: 'biz1',
        endedAt: null,
      } as any);
      prisma.viewAsSession.update.mockResolvedValue({} as any);
      prisma.staff.findUnique.mockResolvedValue({
        id: superAdmin.sub,
        email: superAdmin.email,
        businessId: superAdmin.businessId,
        role: 'SUPER_ADMIN',
      } as any);

      const result = await service.endSession(superAdmin.sub, superAdmin.email);

      expect(result.ended).toBe(true);
      expect(prisma.viewAsSession.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            superAdminId: superAdmin.sub,
            endedAt: null,
          }),
        }),
      );
    });

    it('returns ended: true when no session found', async () => {
      prisma.viewAsSession.findFirst.mockResolvedValue(null);

      const result = await service.endSession(superAdmin.sub, superAdmin.email, 'nonexistent');

      expect(result).toEqual({ ended: true });
    });

    it('logs VIEW_AS_END audit entry', async () => {
      prisma.viewAsSession.findFirst.mockResolvedValue({
        id: 'session1',
        superAdminId: superAdmin.sub,
        targetBusinessId: 'biz1',
        endedAt: null,
      } as any);
      prisma.viewAsSession.update.mockResolvedValue({} as any);
      prisma.staff.findUnique.mockResolvedValue({
        id: superAdmin.sub,
        email: superAdmin.email,
        businessId: superAdmin.businessId,
        role: 'SUPER_ADMIN',
      } as any);

      await service.endSession(superAdmin.sub, superAdmin.email, 'session1');

      expect(audit.log).toHaveBeenCalledWith(
        superAdmin.sub,
        superAdmin.email,
        'VIEW_AS_END',
        expect.objectContaining({
          targetType: 'BUSINESS',
          targetId: 'biz1',
        }),
      );
    });

    it('re-issues original Super Admin tokens', async () => {
      prisma.viewAsSession.findFirst.mockResolvedValue({
        id: 'session1',
        superAdminId: superAdmin.sub,
        targetBusinessId: 'biz1',
        endedAt: null,
      } as any);
      prisma.viewAsSession.update.mockResolvedValue({} as any);
      prisma.staff.findUnique.mockResolvedValue({
        id: superAdmin.sub,
        email: superAdmin.email,
        businessId: superAdmin.businessId,
        role: 'SUPER_ADMIN',
      } as any);

      await service.endSession(superAdmin.sub, superAdmin.email, 'session1');

      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: superAdmin.sub,
          email: superAdmin.email,
          businessId: superAdmin.businessId,
          role: 'SUPER_ADMIN',
        }),
      );
    });
  });

  describe('getActiveSession', () => {
    it('returns active session with target business', async () => {
      const session = {
        id: 'session1',
        superAdminId: superAdmin.sub,
        targetBusinessId: 'biz1',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        endedAt: null,
        targetBusiness: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
      };
      prisma.viewAsSession.findFirst.mockResolvedValue(session as any);

      const result = await service.getActiveSession(superAdmin.sub);

      expect(result).toEqual(session);
    });

    it('returns null when no active session', async () => {
      prisma.viewAsSession.findFirst.mockResolvedValue(null);

      const result = await service.getActiveSession(superAdmin.sub);

      expect(result).toBeNull();
    });
  });

  describe('validateViewAsSession', () => {
    it('returns true for valid active session', async () => {
      prisma.viewAsSession.findUnique.mockResolvedValue({
        id: 'session1',
        endedAt: null,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      } as any);

      const result = await service.validateViewAsSession('session1');

      expect(result).toBe(true);
    });

    it('returns false when session not found', async () => {
      prisma.viewAsSession.findUnique.mockResolvedValue(null);

      const result = await service.validateViewAsSession('nonexistent');

      expect(result).toBe(false);
    });

    it('returns false when session has ended', async () => {
      prisma.viewAsSession.findUnique.mockResolvedValue({
        id: 'session1',
        endedAt: new Date(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      } as any);

      const result = await service.validateViewAsSession('session1');

      expect(result).toBe(false);
    });

    it('returns false when session is expired', async () => {
      prisma.viewAsSession.findUnique.mockResolvedValue({
        id: 'session1',
        endedAt: null,
        expiresAt: new Date(Date.now() - 1000),
      } as any);

      const result = await service.validateViewAsSession('session1');

      expect(result).toBe(false);
    });
  });
});
