import { Test } from '@nestjs/testing';
import { AutonomyService } from './autonomy.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('AutonomyService', () => {
  let service: AutonomyService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [AutonomyService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AutonomyService);
  });

  describe('getConfigs', () => {
    it('returns all configs for business', async () => {
      const configs = [
        { id: 'ac1', businessId: 'biz1', actionType: 'DEPOSIT_PENDING', autonomyLevel: 'ASSISTED' },
        { id: 'ac2', businessId: 'biz1', actionType: '*', autonomyLevel: 'OFF' },
      ];
      prisma.autonomyConfig.findMany.mockResolvedValue(configs as any);

      const result = await service.getConfigs('biz1');

      expect(result).toHaveLength(2);
      expect(prisma.autonomyConfig.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { actionType: 'asc' },
      });
    });
  });

  describe('getConfig', () => {
    it('returns config for specific action type', async () => {
      const config = {
        id: 'ac1',
        businessId: 'biz1',
        actionType: 'DEPOSIT_PENDING',
        autonomyLevel: 'AUTO',
      };
      prisma.autonomyConfig.findUnique.mockResolvedValue(config as any);

      const result = await service.getConfig('biz1', 'DEPOSIT_PENDING');

      expect(result).toEqual(config);
    });

    it('returns null when config does not exist', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);

      const result = await service.getConfig('biz1', 'NONEXISTENT');

      expect(result).toBeNull();
    });
  });

  describe('upsertConfig', () => {
    it('creates new config', async () => {
      const config = {
        id: 'ac1',
        businessId: 'biz1',
        actionType: 'DEPOSIT_PENDING',
        autonomyLevel: 'AUTO',
        constraints: { maxPerDay: 10 },
      };
      prisma.autonomyConfig.upsert.mockResolvedValue(config as any);

      const result = await service.upsertConfig('biz1', 'DEPOSIT_PENDING', {
        autonomyLevel: 'AUTO',
        constraints: { maxPerDay: 10 },
      });

      expect(result).toEqual(config);
      expect(prisma.autonomyConfig.upsert).toHaveBeenCalledWith({
        where: { businessId_actionType: { businessId: 'biz1', actionType: 'DEPOSIT_PENDING' } },
        create: expect.objectContaining({
          businessId: 'biz1',
          actionType: 'DEPOSIT_PENDING',
          autonomyLevel: 'AUTO',
          constraints: { maxPerDay: 10 },
        }),
        update: expect.objectContaining({
          autonomyLevel: 'AUTO',
          constraints: { maxPerDay: 10 },
        }),
      });
    });

    it('sets empty constraints when not provided', async () => {
      prisma.autonomyConfig.upsert.mockResolvedValue({} as any);

      await service.upsertConfig('biz1', 'DEPOSIT_PENDING', { autonomyLevel: 'ASSISTED' });

      expect(prisma.autonomyConfig.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ constraints: {} }),
          update: expect.objectContaining({ constraints: {} }),
        }),
      );
    });
  });

  describe('getLevel', () => {
    it('returns specific config level when exists', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        autonomyLevel: 'AUTO',
      } as any);

      const result = await service.getLevel('biz1', 'DEPOSIT_PENDING');

      expect(result).toBe('AUTO');
    });

    it('falls back to wildcard config when specific does not exist', async () => {
      prisma.autonomyConfig.findUnique
        .mockResolvedValueOnce(null) // specific
        .mockResolvedValueOnce({ id: 'ac2', autonomyLevel: 'OFF' } as any); // wildcard

      const result = await service.getLevel('biz1', 'DEPOSIT_PENDING');

      expect(result).toBe('OFF');
      expect(prisma.autonomyConfig.findUnique).toHaveBeenCalledTimes(2);
    });

    it('defaults to ASSISTED when no config exists', async () => {
      prisma.autonomyConfig.findUnique
        .mockResolvedValueOnce(null) // specific
        .mockResolvedValueOnce(null); // wildcard

      const result = await service.getLevel('biz1', 'DEPOSIT_PENDING');

      expect(result).toBe('ASSISTED');
    });
  });

  describe('checkConstraints', () => {
    it('returns allowed when no config exists', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);

      const result = await service.checkConstraints('biz1', 'DEPOSIT_PENDING');

      expect(result).toEqual({ allowed: true });
    });

    it('returns allowed when no constraints defined', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        constraints: {},
      } as any);

      const result = await service.checkConstraints('biz1', 'DEPOSIT_PENDING');

      expect(result).toEqual({ allowed: true });
    });

    it('returns allowed when maxPerDay not reached', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        constraints: { maxPerDay: 5 },
      } as any);
      prisma.actionCard.count.mockResolvedValue(3);

      const result = await service.checkConstraints('biz1', 'DEPOSIT_PENDING');

      expect(result).toEqual({ allowed: true });
    });

    it('returns not allowed when maxPerDay reached', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        constraints: { maxPerDay: 5 },
      } as any);
      prisma.actionCard.count.mockResolvedValue(5);

      const result = await service.checkConstraints('biz1', 'DEPOSIT_PENDING');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Daily limit');
    });

    it('counts only executed cards for today', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue({
        id: 'ac1',
        constraints: { maxPerDay: 10 },
      } as any);
      prisma.actionCard.count.mockResolvedValue(2);

      await service.checkConstraints('biz1', 'DEPOSIT_PENDING');

      expect(prisma.actionCard.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          businessId: 'biz1',
          type: 'DEPOSIT_PENDING',
          status: 'EXECUTED',
          resolvedAt: { gte: expect.any(Date) },
        }),
      });
    });
  });
});
