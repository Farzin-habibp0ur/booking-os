import { Test } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ConsolePacksService } from './console-packs.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('ConsolePacksService', () => {
  let service: ConsolePacksService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [ConsolePacksService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(ConsolePacksService);
  });

  describe('getRegistry', () => {
    it('returns packs with adoption stats', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([
        {
          id: 'v1',
          slug: 'aesthetic',
          version: 2,
          name: 'Aesthetic',
          description: 'For clinics',
          isPublished: true,
          rolloutStage: 'completed',
          rolloutPercent: 100,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'v2',
          slug: 'aesthetic',
          version: 1,
          name: 'Aesthetic',
          description: 'For clinics',
          isPublished: true,
          rolloutStage: 'completed',
          rolloutPercent: 100,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'v3',
          slug: 'general',
          version: 1,
          name: 'General',
          description: 'General pack',
          isPublished: true,
          rolloutStage: 'published',
          rolloutPercent: 0,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);
      prisma.business.count
        .mockResolvedValueOnce(10) // totalBusinesses
        .mockResolvedValueOnce(6) // aesthetic businesses
        .mockResolvedValueOnce(4); // general businesses

      const result = await service.getRegistry();

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('aesthetic');
      expect(result[0].latestVersion).toBe(2);
      expect(result[0].businessCount).toBe(6);
      expect(result[0].adoptionPercent).toBe(60);
      expect(result[0].versionCount).toBe(2);
      expect(result[1].slug).toBe('general');
      expect(result[1].businessCount).toBe(4);
      expect(result[1].adoptionPercent).toBe(40);
    });

    it('handles empty registry', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([]);
      prisma.business.count.mockResolvedValue(0);

      const result = await service.getRegistry();

      expect(result).toEqual([]);
    });

    it('handles zero businesses gracefully', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([
        {
          id: 'v1',
          slug: 'general',
          version: 1,
          name: 'General',
          isPublished: true,
          rolloutStage: 'draft',
          rolloutPercent: 0,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);
      prisma.business.count.mockResolvedValue(0);

      const result = await service.getRegistry();

      expect(result[0].adoptionPercent).toBe(0);
      expect(result[0].totalBusinesses).toBe(0);
    });
  });

  describe('getPackDetail', () => {
    it('returns pack detail with versions and stats', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([
        {
          id: 'v2',
          slug: 'aesthetic',
          version: 2,
          name: 'Aesthetic',
          description: 'Clinics',
          isPublished: true,
          rolloutStage: 'rolling_out',
          rolloutPercent: 25,
          rolloutStartedAt: new Date(),
          rolloutCompletedAt: null,
          rolloutPausedAt: null,
          rolledBackAt: null,
          rolledBackReason: null,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'v1',
          slug: 'aesthetic',
          version: 1,
          name: 'Aesthetic',
          description: 'Clinics',
          isPublished: true,
          rolloutStage: 'completed',
          rolloutPercent: 100,
          rolloutStartedAt: new Date(),
          rolloutCompletedAt: new Date(),
          rolloutPausedAt: null,
          rolledBackAt: null,
          rolledBackReason: null,
          config: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ] as any);
      prisma.business.count
        .mockResolvedValueOnce(6) // businessCount
        .mockResolvedValueOnce(10); // totalBusinesses
      prisma.packTenantPin.count.mockResolvedValue(2);

      const result = await service.getPackDetail('aesthetic');

      expect(result.slug).toBe('aesthetic');
      expect(result.versions).toHaveLength(2);
      expect(result.businessCount).toBe(6);
      expect(result.adoptionPercent).toBe(60);
      expect(result.pinnedCount).toBe(2);
    });

    it('throws NotFoundException for unknown slug', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([]);

      await expect(service.getPackDetail('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getVersions', () => {
    it('returns versions for a pack', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([
        {
          id: 'v2',
          slug: 'aesthetic',
          version: 2,
          name: 'Aesthetic',
          isPublished: true,
          rolloutStage: 'rolling_out',
          rolloutPercent: 25,
          rolloutStartedAt: new Date(),
          rolloutCompletedAt: null,
          rolledBackAt: null,
          rolledBackReason: null,
          createdAt: new Date(),
        },
      ] as any);

      const result = await service.getVersions('aesthetic');

      expect(result).toHaveLength(1);
      expect(result[0].version).toBe(2);
      expect(result[0].rolloutStage).toBe('rolling_out');
    });

    it('throws NotFoundException for unknown slug', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([]);

      await expect(service.getVersions('unknown')).rejects.toThrow(NotFoundException);
    });
  });

  describe('startOrAdvanceRollout', () => {
    it('starts rollout from published state', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'published',
        rolloutPercent: 0,
        rolloutStartedAt: null,
        isPublished: true,
      } as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 5,
        rolloutStartedAt: new Date(),
        rolloutCompletedAt: null,
      } as any);

      const result = await service.startOrAdvanceRollout('aesthetic', 2, 5);

      expect(result.rolloutStage).toBe('rolling_out');
      expect(result.rolloutPercent).toBe(5);
    });

    it('advances rollout from 5% to 25%', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 5,
        rolloutStartedAt: new Date(),
        isPublished: true,
      } as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 25,
        rolloutStartedAt: new Date(),
        rolloutCompletedAt: null,
      } as any);

      const result = await service.startOrAdvanceRollout('aesthetic', 2, 25);

      expect(result.rolloutPercent).toBe(25);
    });

    it('completes rollout at 100%', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 50,
        rolloutStartedAt: new Date(),
        isPublished: true,
      } as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'completed',
        rolloutPercent: 100,
        rolloutStartedAt: new Date(),
        rolloutCompletedAt: new Date(),
      } as any);

      const result = await service.startOrAdvanceRollout('aesthetic', 2, 100);

      expect(result.rolloutStage).toBe('completed');
      expect(result.rolloutPercent).toBe(100);
    });

    it('rejects rollout from draft stage', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'draft',
        rolloutPercent: 0,
        isPublished: false,
      } as any);

      await expect(service.startOrAdvanceRollout('aesthetic', 2, 5)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects rollout from completed stage', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'completed',
        rolloutPercent: 100,
        isPublished: true,
      } as any);

      await expect(service.startOrAdvanceRollout('aesthetic', 2, 100)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects rollout from rolled_back stage', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolled_back',
        rolloutPercent: 25,
        isPublished: true,
      } as any);

      await expect(service.startOrAdvanceRollout('aesthetic', 2, 50)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rejects if target percent not greater than current', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 25,
        rolloutStartedAt: new Date(),
        isPublished: true,
      } as any);

      await expect(service.startOrAdvanceRollout('aesthetic', 2, 25)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws NotFoundException for unknown version', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue(null);

      await expect(service.startOrAdvanceRollout('aesthetic', 99, 5)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('pauseRollout', () => {
    it('pauses a rolling_out version', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 25,
      } as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'paused',
        rolloutPercent: 25,
        rolloutPausedAt: new Date(),
      } as any);

      const result = await service.pauseRollout('aesthetic', 2);

      expect(result.rolloutStage).toBe('paused');
    });

    it('rejects pause from non-rolling_out stage', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'published',
        rolloutPercent: 0,
      } as any);

      await expect(service.pauseRollout('aesthetic', 2)).rejects.toThrow(BadRequestException);
    });
  });

  describe('resumeRollout', () => {
    it('resumes a paused version', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'paused',
        rolloutPercent: 25,
      } as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 25,
      } as any);

      const result = await service.resumeRollout('aesthetic', 2);

      expect(result.rolloutStage).toBe('rolling_out');
    });

    it('rejects resume from non-paused stage', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 25,
      } as any);

      await expect(service.resumeRollout('aesthetic', 2)).rejects.toThrow(BadRequestException);
    });
  });

  describe('rollbackVersion', () => {
    it('rolls back a rolling_out version', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolling_out',
        rolloutPercent: 25,
      } as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolled_back',
        rolledBackAt: new Date(),
        rolledBackReason: 'Bug found',
      } as any);

      const result = await service.rollbackVersion('aesthetic', 2, 'Bug found');

      expect(result.rolloutStage).toBe('rolled_back');
      expect(result.rolledBackReason).toBe('Bug found');
    });

    it('rolls back a completed version', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'completed',
        rolloutPercent: 100,
      } as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'rolled_back',
        rolledBackAt: new Date(),
        rolledBackReason: 'Critical issue',
      } as any);

      const result = await service.rollbackVersion('aesthetic', 2, 'Critical issue');

      expect(result.rolloutStage).toBe('rolled_back');
    });

    it('rejects rollback from draft stage', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 2,
        rolloutStage: 'draft',
        rolloutPercent: 0,
      } as any);

      await expect(service.rollbackVersion('aesthetic', 2, 'reason')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getPins', () => {
    it('returns pinned businesses with details', async () => {
      prisma.packTenantPin.findMany.mockResolvedValue([
        {
          id: 'pin1',
          businessId: 'biz1',
          packSlug: 'aesthetic',
          pinnedVersion: 1,
          reason: 'Legacy config',
          pinnedById: 'admin1',
          createdAt: new Date(),
          business: { id: 'biz1', name: 'Glow Clinic', slug: 'glow-clinic' },
          pinnedBy: { id: 'admin1', name: 'Admin', email: 'admin@test.com' },
        },
      ] as any);

      const result = await service.getPins('aesthetic');

      expect(result).toHaveLength(1);
      expect(result[0].businessName).toBe('Glow Clinic');
      expect(result[0].pinnedVersion).toBe(1);
      expect(result[0].pinnedBy.name).toBe('Admin');
    });

    it('returns empty array when no pins', async () => {
      prisma.packTenantPin.findMany.mockResolvedValue([]);

      const result = await service.getPins('aesthetic');

      expect(result).toEqual([]);
    });
  });

  describe('pinBusiness', () => {
    it('pins a business to a version', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1', name: 'Glow Clinic' } as any);
      prisma.verticalPackVersion.findUnique.mockResolvedValue({
        id: 'v1',
        slug: 'aesthetic',
        version: 1,
      } as any);
      prisma.packTenantPin.upsert.mockResolvedValue({
        id: 'pin1',
        businessId: 'biz1',
        packSlug: 'aesthetic',
        pinnedVersion: 1,
        reason: 'Legacy config',
        pinnedById: 'admin1',
      } as any);

      const result = await service.pinBusiness('aesthetic', 'biz1', 1, 'Legacy config', 'admin1');

      expect(result.pinnedVersion).toBe(1);
      expect(prisma.packTenantPin.upsert).toHaveBeenCalled();
    });

    it('throws NotFoundException when business not found', async () => {
      prisma.business.findUnique.mockResolvedValue(null);
      prisma.verticalPackVersion.findUnique.mockResolvedValue({ id: 'v1' } as any);

      await expect(
        service.pinBusiness('aesthetic', 'biz99', 1, 'reason', 'admin1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when pack version not found', async () => {
      prisma.business.findUnique.mockResolvedValue({ id: 'biz1' } as any);
      prisma.verticalPackVersion.findUnique.mockResolvedValue(null);

      await expect(
        service.pinBusiness('aesthetic', 'biz1', 99, 'reason', 'admin1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('unpinBusiness', () => {
    it('unpins a business', async () => {
      prisma.packTenantPin.findUnique.mockResolvedValue({
        id: 'pin1',
        businessId: 'biz1',
        packSlug: 'aesthetic',
      } as any);
      prisma.packTenantPin.delete.mockResolvedValue({} as any);

      const result = await service.unpinBusiness('aesthetic', 'biz1');

      expect(result.success).toBe(true);
      expect(prisma.packTenantPin.delete).toHaveBeenCalledWith({ where: { id: 'pin1' } });
    });

    it('throws NotFoundException when pin not found', async () => {
      prisma.packTenantPin.findUnique.mockResolvedValue(null);

      await expect(service.unpinBusiness('aesthetic', 'biz99')).rejects.toThrow(NotFoundException);
    });
  });
});
