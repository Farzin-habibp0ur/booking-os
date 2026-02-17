import { Test } from '@nestjs/testing';
import { PackBuilderService } from './pack-builder.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('PackBuilderService', () => {
  let service: PackBuilderService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [PackBuilderService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(PackBuilderService);
  });

  const mockPack = {
    id: 'pack1',
    slug: 'dealership',
    version: 1,
    name: 'Dealership',
    description: 'Car dealership vertical',
    config: { labels: { customer: 'Client' } },
    isPublished: false,
    businessId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // ─── listPacks ────────────────────────────────────────────────────────

  describe('listPacks', () => {
    it('returns latest version per slug by default', async () => {
      const packs = [
        { ...mockPack, slug: 'aesthetic', version: 2 },
        { ...mockPack, slug: 'aesthetic', version: 1 },
        { ...mockPack, slug: 'dealership', version: 1 },
      ];
      prisma.verticalPackVersion.findMany.mockResolvedValue(packs as any);

      const result = await service.listPacks();

      expect(result).toHaveLength(2);
      expect(result[0].slug).toBe('aesthetic');
      expect(result[0].version).toBe(2);
      expect(result[1].slug).toBe('dealership');
    });

    it('returns all versions when includeAllVersions is true', async () => {
      const packs = [
        { ...mockPack, slug: 'aesthetic', version: 2 },
        { ...mockPack, slug: 'aesthetic', version: 1 },
      ];
      prisma.verticalPackVersion.findMany.mockResolvedValue(packs as any);

      const result = await service.listPacks(true);

      expect(result).toHaveLength(2);
      expect(prisma.verticalPackVersion.findMany).toHaveBeenCalledWith({
        orderBy: [{ slug: 'asc' }, { version: 'desc' }],
      });
    });

    it('returns empty array when no packs exist', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([]);

      const result = await service.listPacks();

      expect(result).toEqual([]);
    });
  });

  // ─── getPackBySlug ────────────────────────────────────────────────────

  describe('getPackBySlug', () => {
    it('returns the latest version of a pack', async () => {
      prisma.verticalPackVersion.findFirst.mockResolvedValue(mockPack as any);

      const result = await service.getPackBySlug('dealership');

      expect(result).toEqual(mockPack);
      expect(prisma.verticalPackVersion.findFirst).toHaveBeenCalledWith({
        where: { slug: 'dealership' },
        orderBy: { version: 'desc' },
      });
    });

    it('throws NotFoundException when pack not found', async () => {
      prisma.verticalPackVersion.findFirst.mockResolvedValue(null);

      await expect(service.getPackBySlug('nonexistent')).rejects.toThrow(
        'Pack "nonexistent" not found',
      );
    });
  });

  // ─── getPackById ──────────────────────────────────────────────────────

  describe('getPackById', () => {
    it('returns pack by ID', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue(mockPack as any);

      const result = await service.getPackById('pack1');

      expect(result).toEqual(mockPack);
    });

    it('throws NotFoundException when not found', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue(null);

      await expect(service.getPackById('nonexistent')).rejects.toThrow(
        'Pack version not found',
      );
    });
  });

  // ─── getPackVersions ──────────────────────────────────────────────────

  describe('getPackVersions', () => {
    it('returns all versions sorted by version desc', async () => {
      const versions = [
        { ...mockPack, version: 3 },
        { ...mockPack, version: 2 },
        { ...mockPack, version: 1 },
      ];
      prisma.verticalPackVersion.findMany.mockResolvedValue(versions as any);

      const result = await service.getPackVersions('dealership');

      expect(result).toHaveLength(3);
      expect(result[0].version).toBe(3);
    });

    it('throws NotFoundException when no versions exist', async () => {
      prisma.verticalPackVersion.findMany.mockResolvedValue([]);

      await expect(service.getPackVersions('nonexistent')).rejects.toThrow(
        'Pack "nonexistent" not found',
      );
    });
  });

  // ─── createPack ───────────────────────────────────────────────────────

  describe('createPack', () => {
    it('creates a new pack with default config', async () => {
      prisma.verticalPackVersion.findFirst.mockResolvedValue(null);
      prisma.verticalPackVersion.create.mockResolvedValue(mockPack as any);

      const result = await service.createPack({
        slug: 'dealership',
        name: 'Dealership',
      });

      expect(result).toEqual(mockPack);
      expect(prisma.verticalPackVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'dealership',
          name: 'Dealership',
          version: 1,
          isPublished: false,
        }),
      });
    });

    it('creates a pack with custom config', async () => {
      prisma.verticalPackVersion.findFirst.mockResolvedValue(null);
      prisma.verticalPackVersion.create.mockResolvedValue(mockPack as any);

      const customConfig = {
        labels: { customer: 'Client', booking: 'Appointment', service: 'Service' },
        intakeFields: [{ key: 'vin', label: 'VIN', type: 'text' }],
      };

      await service.createPack({
        slug: 'dealership',
        name: 'Dealership',
        config: customConfig,
      });

      expect(prisma.verticalPackVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          config: customConfig,
        }),
      });
    });

    it('throws BadRequestException when slug already exists', async () => {
      prisma.verticalPackVersion.findFirst.mockResolvedValue(mockPack as any);

      await expect(
        service.createPack({ slug: 'dealership', name: 'Dealership' }),
      ).rejects.toThrow('Pack with slug "dealership" already exists');
    });

    it('includes description when provided', async () => {
      prisma.verticalPackVersion.findFirst.mockResolvedValue(null);
      prisma.verticalPackVersion.create.mockResolvedValue(mockPack as any);

      await service.createPack({
        slug: 'dealership',
        name: 'Dealership',
        description: 'Car dealership vertical',
      });

      expect(prisma.verticalPackVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          description: 'Car dealership vertical',
        }),
      });
    });
  });

  // ─── updatePack ───────────────────────────────────────────────────────

  describe('updatePack', () => {
    it('updates a draft pack', async () => {
      const draft = { ...mockPack, isPublished: false };
      prisma.verticalPackVersion.findUnique.mockResolvedValue(draft as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        ...draft,
        name: 'Updated Name',
      } as any);

      const result = await service.updatePack('pack1', { name: 'Updated Name' });

      expect(result.name).toBe('Updated Name');
      expect(prisma.verticalPackVersion.update).toHaveBeenCalledWith({
        where: { id: 'pack1' },
        data: { name: 'Updated Name' },
      });
    });

    it('updates pack config', async () => {
      const draft = { ...mockPack, isPublished: false };
      prisma.verticalPackVersion.findUnique.mockResolvedValue(draft as any);
      prisma.verticalPackVersion.update.mockResolvedValue(draft as any);

      const newConfig = { labels: { customer: 'Buyer' } };
      await service.updatePack('pack1', { config: newConfig });

      expect(prisma.verticalPackVersion.update).toHaveBeenCalledWith({
        where: { id: 'pack1' },
        data: { config: newConfig },
      });
    });

    it('throws BadRequestException when updating published pack', async () => {
      const published = { ...mockPack, isPublished: true };
      prisma.verticalPackVersion.findUnique.mockResolvedValue(published as any);

      await expect(
        service.updatePack('pack1', { name: 'New Name' }),
      ).rejects.toThrow('Cannot update a published pack version');
    });

    it('throws NotFoundException when pack not found', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue(null);

      await expect(
        service.updatePack('nonexistent', { name: 'New Name' }),
      ).rejects.toThrow('Pack version not found');
    });
  });

  // ─── publishPack ──────────────────────────────────────────────────────

  describe('publishPack', () => {
    it('publishes a draft pack', async () => {
      const draft = { ...mockPack, isPublished: false };
      prisma.verticalPackVersion.findUnique.mockResolvedValue(draft as any);
      prisma.verticalPackVersion.update.mockResolvedValue({
        ...draft,
        isPublished: true,
      } as any);

      const result = await service.publishPack('pack1');

      expect(result.isPublished).toBe(true);
      expect(prisma.verticalPackVersion.update).toHaveBeenCalledWith({
        where: { id: 'pack1' },
        data: { isPublished: true },
      });
    });

    it('throws BadRequestException when already published', async () => {
      const published = { ...mockPack, isPublished: true };
      prisma.verticalPackVersion.findUnique.mockResolvedValue(published as any);

      await expect(service.publishPack('pack1')).rejects.toThrow(
        'This pack version is already published',
      );
    });

    it('throws NotFoundException when pack not found', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue(null);

      await expect(service.publishPack('nonexistent')).rejects.toThrow(
        'Pack version not found',
      );
    });
  });

  // ─── createNewVersion ─────────────────────────────────────────────────

  describe('createNewVersion', () => {
    it('creates a new draft version from latest', async () => {
      const latest = { ...mockPack, version: 2, isPublished: true };
      prisma.verticalPackVersion.findFirst
        .mockResolvedValueOnce(latest as any) // getPackBySlug
        .mockResolvedValueOnce(null); // check for existing draft
      prisma.verticalPackVersion.create.mockResolvedValue({
        ...mockPack,
        version: 3,
        isPublished: false,
      } as any);

      const result = await service.createNewVersion('dealership');

      expect(result.version).toBe(3);
      expect(result.isPublished).toBe(false);
      expect(prisma.verticalPackVersion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slug: 'dealership',
          version: 3,
          isPublished: false,
        }),
      });
    });

    it('throws BadRequestException when unpublished draft already exists', async () => {
      const latest = { ...mockPack, version: 2, isPublished: true };
      const draft = { ...mockPack, version: 3, isPublished: false };
      prisma.verticalPackVersion.findFirst
        .mockResolvedValueOnce(latest as any) // getPackBySlug
        .mockResolvedValueOnce(draft as any); // existing draft

      await expect(service.createNewVersion('dealership')).rejects.toThrow(
        'An unpublished draft (v3) already exists',
      );
    });

    it('throws NotFoundException when pack slug not found', async () => {
      prisma.verticalPackVersion.findFirst.mockResolvedValue(null);

      await expect(service.createNewVersion('nonexistent')).rejects.toThrow(
        'Pack "nonexistent" not found',
      );
    });
  });

  // ─── deletePack ───────────────────────────────────────────────────────

  describe('deletePack', () => {
    it('deletes an unpublished draft', async () => {
      const draft = { ...mockPack, isPublished: false };
      prisma.verticalPackVersion.findUnique.mockResolvedValue(draft as any);
      prisma.verticalPackVersion.delete.mockResolvedValue(draft as any);

      const result = await service.deletePack('pack1');

      expect(result).toEqual(draft);
      expect(prisma.verticalPackVersion.delete).toHaveBeenCalledWith({
        where: { id: 'pack1' },
      });
    });

    it('throws BadRequestException when deleting published pack', async () => {
      const published = { ...mockPack, isPublished: true };
      prisma.verticalPackVersion.findUnique.mockResolvedValue(published as any);

      await expect(service.deletePack('pack1')).rejects.toThrow(
        'Cannot delete a published pack version',
      );
    });

    it('throws NotFoundException when pack not found', async () => {
      prisma.verticalPackVersion.findUnique.mockResolvedValue(null);

      await expect(service.deletePack('nonexistent')).rejects.toThrow(
        'Pack version not found',
      );
    });
  });
});
