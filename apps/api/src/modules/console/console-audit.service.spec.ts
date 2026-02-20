import { Test } from '@nestjs/testing';
import { ConsoleAuditService } from './console-audit.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsoleAuditService', () => {
  let service: ConsoleAuditService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [ConsoleAuditService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ConsoleAuditService);
  });

  describe('findAll', () => {
    const mockLog = {
      id: 'log1',
      actorId: 'admin1',
      actorEmail: 'admin@test.com',
      action: 'BUSINESS_LOOKUP',
      targetType: 'BUSINESS',
      targetId: 'biz1',
      createdAt: new Date(),
    };

    it('returns paginated results', async () => {
      prisma.platformAuditLog.findMany.mockResolvedValue([mockLog] as any);
      prisma.platformAuditLog.count.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(prisma.platformAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 50,
        }),
      );
    });

    it('applies search filter', async () => {
      prisma.platformAuditLog.findMany.mockResolvedValue([mockLog] as any);
      prisma.platformAuditLog.count.mockResolvedValue(1);

      await service.findAll({ search: 'admin' });

      expect(prisma.platformAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { actorEmail: { contains: 'admin', mode: 'insensitive' } },
              { action: { contains: 'admin', mode: 'insensitive' } },
              { targetId: { contains: 'admin', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    it('applies action filter', async () => {
      prisma.platformAuditLog.findMany.mockResolvedValue([mockLog] as any);
      prisma.platformAuditLog.count.mockResolvedValue(1);

      await service.findAll({ action: 'BUSINESS_LOOKUP' });

      expect(prisma.platformAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ action: 'BUSINESS_LOOKUP' }),
        }),
      );
    });

    it('applies date range filter', async () => {
      prisma.platformAuditLog.findMany.mockResolvedValue([] as any);
      prisma.platformAuditLog.count.mockResolvedValue(0);

      await service.findAll({ from: '2026-01-01', to: '2026-01-31' });

      expect(prisma.platformAuditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-01-31'),
            },
          }),
        }),
      );
    });
  });

  describe('getActionTypes', () => {
    it('returns distinct values', async () => {
      prisma.platformAuditLog.findMany.mockResolvedValue([
        { action: 'BUSINESS_LOOKUP' },
        { action: 'BUSINESS_LIST' },
        { action: 'VIEW_AS_START' },
      ] as any);

      const result = await service.getActionTypes();

      expect(result).toEqual(['BUSINESS_LOOKUP', 'BUSINESS_LIST', 'VIEW_AS_START']);
      expect(prisma.platformAuditLog.findMany).toHaveBeenCalledWith({
        select: { action: true },
        distinct: ['action'],
        orderBy: { action: 'asc' },
      });
    });
  });
});
