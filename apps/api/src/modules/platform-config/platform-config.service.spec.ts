import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PlatformConfigService } from './platform-config.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('PlatformConfigService', () => {
  let service: PlatformConfigService;
  let prisma: MockPrisma;

  const mockConfig = {
    id: 'pc1',
    businessId: 'biz1',
    platform: 'INSTAGRAM',
    phase: 'ACTIVE',
    isEnabled: true,
    credentials: {},
    postingSchedule: { postsPerWeek: { min: 4, max: 5 } },
    constraints: {
      publishingWindows: {
        days: ['TUE', 'WED', 'THU'],
        times: ['09:00', '12:00', '17:00'],
        timezone: 'UTC-5',
      },
    },
    metrics: {},
    unlockedAt: new Date('2025-03-17'),
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new PlatformConfigService(prisma as any);
  });

  describe('seedDefaults', () => {
    it('seeds 6 platform configs for a new business', async () => {
      prisma.platformConfig.findUnique.mockResolvedValue(null);
      prisma.platformConfig.create.mockResolvedValue(mockConfig as any);

      const count = await service.seedDefaults('biz1');

      expect(count).toBe(6);
      expect(prisma.platformConfig.create).toHaveBeenCalledTimes(6);
    });

    it('skips existing platforms', async () => {
      prisma.platformConfig.findUnique.mockResolvedValue(mockConfig as any);

      const count = await service.seedDefaults('biz1');

      expect(count).toBe(0);
      expect(prisma.platformConfig.create).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('returns existing configs', async () => {
      prisma.platformConfig.findMany.mockResolvedValue([mockConfig] as any);

      const result = await service.findAll('biz1');

      expect(result).toHaveLength(1);
      expect(prisma.platformConfig.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { platform: 'asc' },
      });
    });

    it('auto-seeds when no configs exist', async () => {
      prisma.platformConfig.findMany
        .mockResolvedValueOnce([]) // first call returns empty
        .mockResolvedValueOnce([mockConfig] as any); // after seed
      prisma.platformConfig.findUnique.mockResolvedValue(null);
      prisma.platformConfig.create.mockResolvedValue(mockConfig as any);

      const result = await service.findAll('biz1');

      expect(prisma.platformConfig.create).toHaveBeenCalledTimes(6);
      expect(result).toHaveLength(1);
    });
  });

  describe('update', () => {
    it('updates platform config', async () => {
      prisma.platformConfig.findUnique.mockResolvedValue(mockConfig as any);
      prisma.platformConfig.update.mockResolvedValue({ ...mockConfig, isEnabled: false } as any);

      const result = await service.update('biz1', 'INSTAGRAM', { isEnabled: false });

      expect(result.isEnabled).toBe(false);
    });

    it('throws NotFoundException for unknown platform', async () => {
      prisma.platformConfig.findUnique.mockResolvedValue(null);

      await expect(service.update('biz1', 'SNAPCHAT', {})).rejects.toThrow(NotFoundException);
    });

    it('allows phase upgrade from LOCKED to ACTIVE', async () => {
      const lockedConfig = { ...mockConfig, phase: 'LOCKED', unlockedAt: null };
      prisma.platformConfig.findUnique.mockResolvedValue(lockedConfig as any);
      prisma.platformConfig.update.mockResolvedValue({ ...lockedConfig, phase: 'ACTIVE' } as any);

      await service.update('biz1', 'INSTAGRAM', { phase: 'ACTIVE' });

      expect(prisma.platformConfig.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ phase: 'ACTIVE', unlockedAt: expect.any(Date) }),
        }),
      );
    });

    it('rejects phase downgrade from ACTIVE to LOCKED', async () => {
      prisma.platformConfig.findUnique.mockResolvedValue(mockConfig as any);

      await expect(
        service.update('biz1', 'INSTAGRAM', { phase: 'LOCKED' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows phase upgrade from ACTIVE to SCALING', async () => {
      prisma.platformConfig.findUnique.mockResolvedValue(mockConfig as any);
      prisma.platformConfig.update.mockResolvedValue({ ...mockConfig, phase: 'SCALING' } as any);

      await service.update('biz1', 'INSTAGRAM', { phase: 'SCALING' });

      expect(prisma.platformConfig.update).toHaveBeenCalled();
    });
  });

  describe('getPublishingWindows', () => {
    it('returns windows for active platforms only', async () => {
      prisma.platformConfig.findMany.mockResolvedValue([mockConfig] as any);

      const result = await service.getPublishingWindows('biz1');

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('INSTAGRAM');
      expect(result[0].windows).toEqual(
        expect.objectContaining({ days: ['TUE', 'WED', 'THU'] }),
      );
    });

    it('filters by non-LOCKED and enabled', async () => {
      prisma.platformConfig.findMany.mockResolvedValue([]);

      await service.getPublishingWindows('biz1');

      expect(prisma.platformConfig.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', phase: { not: 'LOCKED' }, isEnabled: true },
      });
    });
  });

  describe('tenant isolation', () => {
    it('findAll filters by businessId', async () => {
      prisma.platformConfig.findMany.mockResolvedValue([mockConfig] as any);

      await service.findAll('biz1');

      expect(prisma.platformConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { businessId: 'biz1' } }),
      );
    });

    it('update scopes to businessId', async () => {
      prisma.platformConfig.findUnique.mockResolvedValue(mockConfig as any);
      prisma.platformConfig.update.mockResolvedValue(mockConfig as any);

      await service.update('biz1', 'INSTAGRAM', { isEnabled: true });

      expect(prisma.platformConfig.findUnique).toHaveBeenCalledWith({
        where: { businessId_platform: { businessId: 'biz1', platform: 'INSTAGRAM' } },
      });
    });
  });
});
