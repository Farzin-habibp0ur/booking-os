import { NotFoundException } from '@nestjs/common';
import { AutonomySettingsService, DEFAULT_MARKETING_AUTONOMY } from './autonomy-settings.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('AutonomySettingsService', () => {
  let service: AutonomySettingsService;
  let prisma: MockPrisma;

  const mockConfig = {
    id: 'ac1',
    businessId: 'biz1',
    actionType: 'GREEN_CONTENT_PUBLISH',
    autonomyLevel: 'AUTO_WITH_REVIEW',
    requiredRole: null,
    constraints: {},
    scope: 'MARKETING',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new AutonomySettingsService(prisma as any);
  });

  describe('DEFAULT_MARKETING_AUTONOMY', () => {
    it('has 8 default action types', () => {
      expect(DEFAULT_MARKETING_AUTONOMY).toHaveLength(8);
    });

    it('GREEN content defaults to AUTO_WITH_REVIEW', () => {
      const green = DEFAULT_MARKETING_AUTONOMY.find(
        (d) => d.actionType === 'GREEN_CONTENT_PUBLISH',
      );
      expect(green?.defaultLevel).toBe('AUTO_WITH_REVIEW');
    });

    it('RED content defaults to OFF', () => {
      const red = DEFAULT_MARKETING_AUTONOMY.find((d) => d.actionType === 'RED_CONTENT_PUBLISH');
      expect(red?.defaultLevel).toBe('OFF');
    });

    it('budget allocation defaults to OFF', () => {
      const budget = DEFAULT_MARKETING_AUTONOMY.find((d) => d.actionType === 'BUDGET_ALLOCATION');
      expect(budget?.defaultLevel).toBe('OFF');
    });

    it('social media posting defaults to SUGGEST', () => {
      const social = DEFAULT_MARKETING_AUTONOMY.find(
        (d) => d.actionType === 'SOCIAL_MEDIA_POSTING',
      );
      expect(social?.defaultLevel).toBe('SUGGEST');
    });
  });

  describe('seedDefaults', () => {
    it('seeds 8 marketing autonomy configs', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);
      prisma.autonomyConfig.create.mockResolvedValue(mockConfig as any);

      const count = await service.seedDefaults('biz1');

      expect(count).toBe(8);
      expect(prisma.autonomyConfig.create).toHaveBeenCalledTimes(8);
    });

    it('skips existing configs', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(mockConfig as any);

      const count = await service.seedDefaults('biz1');

      expect(count).toBe(0);
    });

    it('sets scope to MARKETING', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);
      prisma.autonomyConfig.create.mockResolvedValue(mockConfig as any);

      await service.seedDefaults('biz1');

      expect(prisma.autonomyConfig.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ scope: 'MARKETING' }),
      });
    });
  });

  describe('findAll', () => {
    it('returns marketing-scoped configs', async () => {
      prisma.autonomyConfig.findMany.mockResolvedValue([mockConfig] as any);

      const result = await service.findAll('biz1');

      expect(result).toHaveLength(1);
      expect(prisma.autonomyConfig.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', scope: 'MARKETING' },
        orderBy: { actionType: 'asc' },
      });
    });

    it('auto-seeds when empty', async () => {
      prisma.autonomyConfig.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([mockConfig] as any);
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);
      prisma.autonomyConfig.create.mockResolvedValue(mockConfig as any);

      await service.findAll('biz1');

      expect(prisma.autonomyConfig.create).toHaveBeenCalledTimes(8);
    });
  });

  describe('update', () => {
    it('updates autonomy level', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(mockConfig as any);
      prisma.autonomyConfig.update.mockResolvedValue({
        ...mockConfig,
        autonomyLevel: 'FULL_AUTO',
      } as any);

      const result = await service.update('biz1', 'GREEN_CONTENT_PUBLISH', 'FULL_AUTO');

      expect(result.autonomyLevel).toBe('FULL_AUTO');
      expect(prisma.autonomyConfig.update).toHaveBeenCalledWith({
        where: {
          businessId_actionType_scope: {
            businessId: 'biz1',
            actionType: 'GREEN_CONTENT_PUBLISH',
            scope: 'MARKETING',
          },
        },
        data: { autonomyLevel: 'FULL_AUTO' },
      });
    });

    it('throws NotFoundException for unknown action type', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);

      await expect(service.update('biz1', 'UNKNOWN', 'OFF')).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetToDefaults', () => {
    it('deletes marketing configs and re-seeds', async () => {
      prisma.autonomyConfig.deleteMany.mockResolvedValue({ count: 8 });
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);
      prisma.autonomyConfig.create.mockResolvedValue(mockConfig as any);

      const result = await service.resetToDefaults('biz1');

      expect(result.reset).toBe(true);
      expect(result.count).toBe(8);
      expect(prisma.autonomyConfig.deleteMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', scope: 'MARKETING' },
      });
    });
  });

  describe('getLevel', () => {
    it('returns configured level', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(mockConfig as any);

      const level = await service.getLevel('biz1', 'GREEN_CONTENT_PUBLISH');

      expect(level).toBe('AUTO_WITH_REVIEW');
    });

    it('falls back to default when not configured', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);

      const level = await service.getLevel('biz1', 'GREEN_CONTENT_PUBLISH');

      expect(level).toBe('AUTO_WITH_REVIEW');
    });

    it('returns SUGGEST for unknown action types', async () => {
      prisma.autonomyConfig.findUnique.mockResolvedValue(null);

      const level = await service.getLevel('biz1', 'UNKNOWN_ACTION');

      expect(level).toBe('SUGGEST');
    });
  });

  describe('tenant isolation', () => {
    it('findAll filters by businessId and scope', async () => {
      prisma.autonomyConfig.findMany.mockResolvedValue([mockConfig] as any);

      await service.findAll('biz1');

      expect(prisma.autonomyConfig.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', scope: 'MARKETING' },
        }),
      );
    });
  });
});
