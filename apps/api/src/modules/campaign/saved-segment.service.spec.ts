import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SavedSegmentService } from './saved-segment.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';

describe('SavedSegmentService', () => {
  let service: SavedSegmentService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();

    const module = await Test.createTestingModule({
      providers: [
        SavedSegmentService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get(SavedSegmentService);
  });

  describe('findAll', () => {
    it('returns all segments for a business', async () => {
      const segments = [
        { id: 'seg1', name: 'VIPs', filters: { tags: ['vip'] } },
        { id: 'seg2', name: 'Lapsed', filters: { lastVisitDaysAgo: 30 } },
      ];
      prisma.savedSegment.findMany.mockResolvedValue(segments as any);

      const result = await service.findAll('biz1');

      expect(result).toEqual(segments);
      expect(prisma.savedSegment.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1' },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('creates a new segment', async () => {
      const segment = { id: 'seg1', name: 'VIPs', filters: { tags: ['vip'] } };
      prisma.savedSegment.create.mockResolvedValue(segment as any);

      const result = await service.create('biz1', { name: 'VIPs', filters: { tags: ['vip'] } });

      expect(result).toEqual(segment);
      expect(prisma.savedSegment.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          name: 'VIPs',
          filters: { tags: ['vip'] },
        },
      });
    });

    it('defaults filters to empty object', async () => {
      prisma.savedSegment.create.mockResolvedValue({ id: 'seg1' } as any);

      await service.create('biz1', { name: 'Empty', filters: undefined });

      expect(prisma.savedSegment.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ filters: {} }),
      });
    });
  });

  describe('update', () => {
    it('updates an existing segment', async () => {
      prisma.savedSegment.findFirst.mockResolvedValue({ id: 'seg1', businessId: 'biz1' } as any);
      prisma.savedSegment.update.mockResolvedValue({ id: 'seg1', name: 'Updated' } as any);

      const result = await service.update('biz1', 'seg1', { name: 'Updated' });

      expect(result.name).toBe('Updated');
    });

    it('throws NotFoundException for missing segment', async () => {
      prisma.savedSegment.findFirst.mockResolvedValue(null);

      await expect(service.update('biz1', 'nope', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('delete', () => {
    it('deletes a segment', async () => {
      prisma.savedSegment.findFirst.mockResolvedValue({ id: 'seg1', businessId: 'biz1' } as any);
      prisma.savedSegment.delete.mockResolvedValue({} as any);

      const result = await service.delete('biz1', 'seg1');

      expect(result).toEqual({ deleted: true });
    });

    it('throws NotFoundException for missing segment', async () => {
      prisma.savedSegment.findFirst.mockResolvedValue(null);

      await expect(service.delete('biz1', 'nope')).rejects.toThrow(NotFoundException);
    });
  });
});
