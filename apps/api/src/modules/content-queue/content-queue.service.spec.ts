import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContentQueueService } from './content-queue.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('ContentQueueService', () => {
  let service: ContentQueueService;
  let prisma: MockPrisma;

  const mockDraft = {
    id: 'cd1',
    businessId: 'biz1',
    title: 'Spring Promo',
    body: 'Check out our spring deals!',
    contentType: 'SOCIAL_POST',
    channel: 'INSTAGRAM',
    pillar: 'PROMOTION',
    agentId: 'agent1',
    status: 'PENDING_REVIEW',
    scheduledFor: null,
    reviewedById: null,
    reviewNote: null,
    metadata: { hashtags: ['#spring'] },
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new ContentQueueService(prisma as any);
  });

  describe('create', () => {
    it('creates a content draft with all fields', async () => {
      prisma.contentDraft.create.mockResolvedValue(mockDraft as any);

      const dto = {
        title: 'Spring Promo',
        body: 'Check out our spring deals!',
        contentType: 'SOCIAL_POST',
        channel: 'INSTAGRAM',
        pillar: 'PROMOTION',
        agentId: 'agent1',
        scheduledFor: '2026-04-01T10:00:00Z',
        metadata: { hashtags: ['#spring'] },
      };

      const result = await service.create('biz1', dto as any);

      expect(result).toEqual(mockDraft);
      expect(prisma.contentDraft.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          title: 'Spring Promo',
          body: 'Check out our spring deals!',
          contentType: 'SOCIAL_POST',
          channel: 'INSTAGRAM',
          pillar: 'PROMOTION',
          agentId: 'agent1',
          scheduledFor: new Date('2026-04-01T10:00:00Z'),
          metadata: { hashtags: ['#spring'] },
        },
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated results with filters', async () => {
      const drafts = [mockDraft, { ...mockDraft, id: 'cd2' }];
      prisma.contentDraft.findMany.mockResolvedValue(drafts as any);
      prisma.contentDraft.count.mockResolvedValue(2);

      const result = await service.findAll('biz1', {
        status: 'PENDING_REVIEW',
        contentType: 'SOCIAL_POST',
        channel: 'INSTAGRAM',
        pillar: 'PROMOTION',
      } as any);

      expect(result).toEqual({ data: drafts, total: 2 });
      expect(prisma.contentDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            status: 'PENDING_REVIEW',
            contentType: 'SOCIAL_POST',
            channel: 'INSTAGRAM',
            pillar: 'PROMOTION',
          },
          skip: 0,
          take: 20,
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('respects skip/take pagination', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([]);
      prisma.contentDraft.count.mockResolvedValue(0);

      await service.findAll('biz1', { skip: '10', take: '5' } as any);

      expect(prisma.contentDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
        }),
      );
    });
  });

  describe('findOne', () => {
    it('returns draft by id and businessId', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);

      const result = await service.findOne('biz1', 'cd1');

      expect(result).toEqual(mockDraft);
      expect(prisma.contentDraft.findFirst).toHaveBeenCalledWith({
        where: { id: 'cd1', businessId: 'biz1' },
      });
    });

    it('throws NotFoundException when draft not found', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'cd999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates draft fields', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
      const updated = { ...mockDraft, title: 'Updated Title' };
      prisma.contentDraft.update.mockResolvedValue(updated as any);

      const result = await service.update('biz1', 'cd1', { title: 'Updated Title' } as any);

      expect(result).toEqual(updated);
      expect(prisma.contentDraft.update).toHaveBeenCalledWith({
        where: { id: 'cd1' },
        data: { title: 'Updated Title' },
      });
    });

    it('throws NotFoundException when draft not found', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(null);

      await expect(service.update('biz1', 'cd999', { title: 'Updated' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('approve', () => {
    it('approves a PENDING_REVIEW draft and creates action history', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
      const approved = { ...mockDraft, status: 'APPROVED', reviewedById: 'staff1' };
      prisma.contentDraft.update.mockResolvedValue(approved as any);
      prisma.actionHistory.create.mockResolvedValue({} as any);

      const result = await service.approve('biz1', 'cd1', 'staff1');

      expect(result).toEqual(approved);
      expect(prisma.contentDraft.update).toHaveBeenCalledWith({
        where: { id: 'cd1' },
        data: {
          status: 'APPROVED',
          reviewedById: 'staff1',
          scheduledFor: undefined,
        },
      });
      expect(prisma.actionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          actorType: 'STAFF',
          actorId: 'staff1',
          action: 'CONTENT_APPROVED',
          entityType: 'CONTENT_DRAFT',
          entityId: 'cd1',
        }),
      });
    });

    it('schedules draft when scheduledFor provided', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
      const scheduled = { ...mockDraft, status: 'SCHEDULED', reviewedById: 'staff1' };
      prisma.contentDraft.update.mockResolvedValue(scheduled as any);
      prisma.actionHistory.create.mockResolvedValue({} as any);

      const result = await service.approve('biz1', 'cd1', 'staff1', '2026-04-01T10:00:00Z');

      expect(result).toEqual(scheduled);
      expect(prisma.contentDraft.update).toHaveBeenCalledWith({
        where: { id: 'cd1' },
        data: {
          status: 'SCHEDULED',
          reviewedById: 'staff1',
          scheduledFor: new Date('2026-04-01T10:00:00Z'),
        },
      });
    });

    it('throws BadRequestException for non-pending drafts', async () => {
      const approvedDraft = { ...mockDraft, status: 'APPROVED' };
      prisma.contentDraft.findFirst.mockResolvedValue(approvedDraft as any);

      await expect(service.approve('biz1', 'cd1', 'staff1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('reject', () => {
    it('rejects a PENDING_REVIEW draft with review note', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
      const rejected = {
        ...mockDraft,
        status: 'REJECTED',
        reviewedById: 'staff1',
        reviewNote: 'Needs revision',
      };
      prisma.contentDraft.update.mockResolvedValue(rejected as any);
      prisma.actionHistory.create.mockResolvedValue({} as any);

      const result = await service.reject('biz1', 'cd1', 'staff1', 'Needs revision');

      expect(result).toEqual(rejected);
      expect(prisma.contentDraft.update).toHaveBeenCalledWith({
        where: { id: 'cd1' },
        data: {
          status: 'REJECTED',
          reviewedById: 'staff1',
          reviewNote: 'Needs revision',
        },
      });
      expect(prisma.actionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          businessId: 'biz1',
          actorType: 'STAFF',
          actorId: 'staff1',
          action: 'CONTENT_REJECTED',
          entityType: 'CONTENT_DRAFT',
          entityId: 'cd1',
          metadata: { reviewNote: 'Needs revision' },
        }),
      });
    });

    it('throws BadRequestException for non-pending drafts', async () => {
      const approvedDraft = { ...mockDraft, status: 'APPROVED' };
      prisma.contentDraft.findFirst.mockResolvedValue(approvedDraft as any);

      await expect(service.reject('biz1', 'cd1', 'staff1', 'Needs work')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('bulkApprove', () => {
    it('approves multiple pending drafts', async () => {
      prisma.contentDraft.updateMany.mockResolvedValue({ count: 3 } as any);

      const result = await service.bulkApprove('biz1', ['cd1', 'cd2', 'cd3'], 'staff1');

      expect(result).toEqual({ updated: 3 });
      expect(prisma.contentDraft.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['cd1', 'cd2', 'cd3'] }, businessId: 'biz1', status: 'PENDING_REVIEW' },
        data: { status: 'APPROVED', reviewedById: 'staff1' },
      });
    });
  });

  describe('bulkReject', () => {
    it('rejects multiple pending drafts with review note', async () => {
      prisma.contentDraft.updateMany.mockResolvedValue({ count: 2 } as any);

      const result = await service.bulkReject('biz1', ['cd1', 'cd2'], 'staff1', 'Not on brand');

      expect(result).toEqual({ updated: 2 });
      expect(prisma.contentDraft.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['cd1', 'cd2'] },
          businessId: 'biz1',
          status: 'PENDING_REVIEW',
        },
        data: { status: 'REJECTED', reviewedById: 'staff1', reviewNote: 'Not on brand' },
      });
    });
  });

  describe('getStats', () => {
    it('returns counts by status, contentType, and channel', async () => {
      prisma.contentDraft.groupBy.mockResolvedValueOnce([
        { status: 'PENDING_REVIEW', _count: 5 },
        { status: 'APPROVED', _count: 3 },
      ] as any);
      prisma.contentDraft.groupBy.mockResolvedValueOnce([
        { contentType: 'SOCIAL_POST', _count: 6 },
        { contentType: 'BLOG', _count: 2 },
      ] as any);
      prisma.contentDraft.groupBy.mockResolvedValueOnce([
        { channel: 'INSTAGRAM', _count: 4 },
        { channel: 'FACEBOOK', _count: 4 },
      ] as any);

      const result = await service.getStats('biz1');

      expect(result).toEqual({
        byStatus: { PENDING_REVIEW: 5, APPROVED: 3 },
        byContentType: { SOCIAL_POST: 6, BLOG: 2 },
        byChannel: { INSTAGRAM: 4, FACEBOOK: 4 },
      });
      expect(prisma.contentDraft.groupBy).toHaveBeenCalledTimes(3);
      expect(prisma.contentDraft.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['status'],
          where: { businessId: 'biz1' },
        }),
      );
    });
  });

  describe('tenant isolation', () => {
    it('all queries filter by businessId', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(null);

      try {
        await service.findOne('biz1', 'cd1');
      } catch {
        // expected
      }

      expect(prisma.contentDraft.findFirst).toHaveBeenCalledWith({
        where: { id: 'cd1', businessId: 'biz1' },
      });
    });
  });
});
