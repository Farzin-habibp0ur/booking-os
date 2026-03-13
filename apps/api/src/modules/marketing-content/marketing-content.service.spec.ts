import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MarketingContentService } from './marketing-content.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('MarketingContentService', () => {
  let service: MarketingContentService;
  let prisma: MockPrisma;

  const mockDraft = {
    id: 'cd1',
    businessId: 'biz1',
    title: 'Spring Promo Post',
    body: 'Check out our spring deals!',
    contentType: 'SOCIAL_POST',
    channel: 'INSTAGRAM',
    pillar: 'PRODUCT_EDUCATION',
    tier: 'GREEN',
    agentId: 'agent1',
    platform: 'INSTAGRAM',
    slug: 'spring-promo',
    status: 'PENDING_REVIEW',
    currentGate: 'GATE_1',
    qualityScore: null,
    rejectionCode: null,
    rejectionReason: null,
    scheduledFor: null,
    publishedAt: null,
    reviewedById: null,
    reviewNote: null,
    metadata: { hashtags: ['#spring'] },
    createdAt: new Date('2026-03-01'),
    updatedAt: new Date('2026-03-01'),
    rejectionLogs: [],
    abTestVariants: [],
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new MarketingContentService(prisma as any);
  });

  describe('create', () => {
    it('creates a content draft with businessId and all fields', async () => {
      prisma.contentDraft.create.mockResolvedValue(mockDraft as any);

      const dto = {
        contentType: 'SOCIAL_POST',
        title: 'Spring Promo Post',
        body: 'Check out our spring deals!',
        tier: 'GREEN',
        channel: 'INSTAGRAM',
        pillar: 'PRODUCT_EDUCATION',
        agentId: 'agent1',
        platform: 'INSTAGRAM',
        slug: 'spring-promo',
        metadata: { hashtags: ['#spring'] },
      };

      const result = await service.create('biz1', dto as any);

      expect(result).toEqual(mockDraft);
      expect(prisma.contentDraft.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          contentType: 'SOCIAL_POST',
          title: 'Spring Promo Post',
          body: 'Check out our spring deals!',
          tier: 'GREEN',
          channel: 'INSTAGRAM',
          pillar: 'PRODUCT_EDUCATION',
          agentId: 'agent1',
          platform: 'INSTAGRAM',
          slug: 'spring-promo',
          metadata: { hashtags: ['#spring'] },
          status: 'PENDING_REVIEW',
          currentGate: 'GATE_1',
        },
      });
    });
  });

  describe('findAll', () => {
    it('returns paginated results with filters', async () => {
      const drafts = [mockDraft];
      prisma.contentDraft.findMany.mockResolvedValue(drafts as any);
      prisma.contentDraft.count.mockResolvedValue(1);

      const result = await service.findAll('biz1', {
        status: 'PENDING_REVIEW',
        tier: 'GREEN',
        contentType: 'SOCIAL_POST',
        pillar: 'PRODUCT_EDUCATION',
      } as any);

      expect(result).toEqual({ data: drafts, total: 1 });
      expect(prisma.contentDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            businessId: 'biz1',
            status: 'PENDING_REVIEW',
            tier: 'GREEN',
            contentType: 'SOCIAL_POST',
            pillar: 'PRODUCT_EDUCATION',
          },
          skip: 0,
          take: 20,
        }),
      );
    });

    it('respects custom pagination and sorting', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([]);
      prisma.contentDraft.count.mockResolvedValue(0);

      await service.findAll('biz1', {
        skip: '10',
        take: '5',
        sortBy: 'title',
        sortOrder: 'asc',
      } as any);

      expect(prisma.contentDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 5,
          orderBy: { title: 'asc' },
        }),
      );
    });

    it('caps take at 100', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([]);
      prisma.contentDraft.count.mockResolvedValue(0);

      await service.findAll('biz1', { take: '999' } as any);

      expect(prisma.contentDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  describe('findOne', () => {
    it('returns draft with relations when found', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);

      const result = await service.findOne('biz1', 'cd1');

      expect(result).toEqual(mockDraft);
      expect(prisma.contentDraft.findFirst).toHaveBeenCalledWith({
        where: { id: 'cd1', businessId: 'biz1' },
        include: {
          rejectionLogs: { orderBy: { createdAt: 'desc' } },
          abTestVariants: true,
        },
      });
    });

    it('throws NotFoundException when draft not found', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(null);

      await expect(service.findOne('biz1', 'missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates draft after verifying existence', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
      prisma.contentDraft.update.mockResolvedValue({ ...mockDraft, title: 'Updated' } as any);

      const result = await service.update('biz1', 'cd1', { title: 'Updated' } as any);

      expect(result.title).toBe('Updated');
      expect(prisma.contentDraft.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cd1', businessId: 'biz1' },
        }),
      );
    });

    it('throws NotFoundException for non-existent draft', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(null);

      await expect(service.update('biz1', 'missing', { title: 'X' } as any)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('review', () => {
    describe('APPROVE', () => {
      it('advances gate on approval', async () => {
        prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
        prisma.contentDraft.update.mockResolvedValue({
          ...mockDraft,
          currentGate: 'GATE_2',
        } as any);
        prisma.actionHistory.create.mockResolvedValue({} as any);

        const result = await service.review('biz1', 'cd1', 'staff1', { action: 'APPROVE' } as any);

        expect(prisma.contentDraft.update).toHaveBeenCalledWith({
          where: { id: 'cd1' },
          data: {
            status: 'PENDING_REVIEW',
            currentGate: 'GATE_2',
            reviewedById: 'staff1',
          },
        });
        expect(result.currentGate).toBe('GATE_2');
      });

      it('sets status to APPROVED when passing final gate', async () => {
        const draftAtGate4 = { ...mockDraft, currentGate: 'GATE_4' };
        prisma.contentDraft.findFirst.mockResolvedValue(draftAtGate4 as any);
        prisma.contentDraft.update.mockResolvedValue({
          ...draftAtGate4,
          status: 'APPROVED',
        } as any);
        prisma.actionHistory.create.mockResolvedValue({} as any);

        const result = await service.review('biz1', 'cd1', 'staff1', { action: 'APPROVE' } as any);

        expect(prisma.contentDraft.update).toHaveBeenCalledWith({
          where: { id: 'cd1' },
          data: {
            status: 'APPROVED',
            currentGate: 'GATE_4',
            reviewedById: 'staff1',
          },
        });
      });

      it('throws if draft is not in review status', async () => {
        const approved = { ...mockDraft, status: 'APPROVED' };
        prisma.contentDraft.findFirst.mockResolvedValue(approved as any);

        await expect(
          service.review('biz1', 'cd1', 'staff1', { action: 'APPROVE' } as any),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('REJECT', () => {
      it('creates rejection log and updates draft', async () => {
        prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
        prisma.contentDraft.update.mockResolvedValue({
          ...mockDraft,
          rejectionCode: 'R01',
        } as any);
        prisma.rejectionLog.create.mockResolvedValue({} as any);
        prisma.actionHistory.create.mockResolvedValue({} as any);

        await service.review('biz1', 'cd1', 'staff1', {
          action: 'REJECT',
          rejectionCode: 'R01',
          rejectionReason: 'Off brand',
        } as any);

        expect(prisma.rejectionLog.create).toHaveBeenCalledWith({
          data: {
            businessId: 'biz1',
            contentDraftId: 'cd1',
            gate: 'GATE_1',
            rejectionCode: 'R01',
            reason: 'Off brand',
            severity: 'MINOR',
            reviewedById: 'staff1',
          },
        });
      });

      it('maps critical rejection codes to CRITICAL severity', async () => {
        prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
        prisma.contentDraft.update.mockResolvedValue(mockDraft as any);
        prisma.rejectionLog.create.mockResolvedValue({} as any);
        prisma.actionHistory.create.mockResolvedValue({} as any);

        await service.review('biz1', 'cd1', 'staff1', {
          action: 'REJECT',
          rejectionCode: 'R08',
          rejectionReason: 'Compliance issue',
        } as any);

        expect(prisma.rejectionLog.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ severity: 'CRITICAL' }),
          }),
        );
      });
    });

    describe('EDIT', () => {
      it('updates body with editedBody', async () => {
        prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
        prisma.contentDraft.update.mockResolvedValue({
          ...mockDraft,
          body: 'New body',
        } as any);

        const result = await service.review('biz1', 'cd1', 'staff1', {
          action: 'EDIT',
          editedBody: 'New body',
        } as any);

        expect(prisma.contentDraft.update).toHaveBeenCalledWith({
          where: { id: 'cd1' },
          data: { body: 'New body', reviewedById: 'staff1' },
        });
      });

      it('throws if editedBody is missing', async () => {
        prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);

        await expect(
          service.review('biz1', 'cd1', 'staff1', { action: 'EDIT' } as any),
        ).rejects.toThrow(BadRequestException);
      });
    });
  });

  describe('bulkReview', () => {
    it('bulk approves drafts in review status', async () => {
      prisma.contentDraft.updateMany.mockResolvedValue({ count: 3 } as any);

      const result = await service.bulkReview('biz1', 'staff1', {
        draftIds: ['cd1', 'cd2', 'cd3'],
        action: 'APPROVE',
      } as any);

      expect(result).toEqual({ updated: 3 });
      expect(prisma.contentDraft.updateMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['cd1', 'cd2', 'cd3'] },
          businessId: 'biz1',
          status: { in: ['PENDING_REVIEW', 'REVIEW'] },
        },
        data: { status: 'APPROVED', reviewedById: 'staff1' },
      });
    });

    it('bulk rejects with rejection logs in transaction', async () => {
      const drafts = [
        { ...mockDraft, id: 'cd1' },
        { ...mockDraft, id: 'cd2' },
      ];
      prisma.contentDraft.findMany.mockResolvedValue(drafts as any);
      prisma.contentDraft.updateMany.mockResolvedValue({ count: 2 } as any);
      prisma.rejectionLog.createMany.mockResolvedValue({ count: 2 } as any);

      const result = await service.bulkReview('biz1', 'staff1', {
        draftIds: ['cd1', 'cd2'],
        action: 'REJECT',
        rejectionCode: 'R03',
        rejectionReason: 'Quality issue',
      } as any);

      expect(result).toEqual({ updated: 2 });
      expect(prisma.rejectionLog.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({
            contentDraftId: 'cd1',
            rejectionCode: 'R03',
            reason: 'Quality issue',
          }),
          expect.objectContaining({
            contentDraftId: 'cd2',
            rejectionCode: 'R03',
            reason: 'Quality issue',
          }),
        ]),
      });
    });
  });

  describe('remove', () => {
    it('soft deletes by setting status to DRAFT', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(mockDraft as any);
      prisma.contentDraft.update.mockResolvedValue({ ...mockDraft, status: 'DRAFT' } as any);

      const result = await service.remove('biz1', 'cd1');

      expect(result.status).toBe('DRAFT');
      expect(prisma.contentDraft.update).toHaveBeenCalledWith({
        where: { id: 'cd1' },
        data: { status: 'DRAFT' },
      });
    });
  });

  describe('getPipelineStats', () => {
    it('returns aggregated stats by status, tier, contentType, pillar', async () => {
      prisma.contentDraft.groupBy
        .mockResolvedValueOnce([
          { status: 'PENDING_REVIEW', _count: 5 },
          { status: 'APPROVED', _count: 3 },
        ] as any)
        .mockResolvedValueOnce([
          { tier: 'GREEN', _count: 6 },
          { tier: 'RED', _count: 2 },
        ] as any)
        .mockResolvedValueOnce([{ contentType: 'SOCIAL_POST', _count: 8 }] as any)
        .mockResolvedValueOnce([{ pillar: 'PRODUCT_EDUCATION', _count: 8 }] as any);

      const result = await service.getPipelineStats('biz1');

      expect(result.byStatus).toEqual({ PENDING_REVIEW: 5, APPROVED: 3 });
      expect(result.byTier).toEqual({ GREEN: 6, RED: 2 });
      expect(result.byContentType).toEqual({ SOCIAL_POST: 8 });
      expect(result.byPillar).toEqual({ PRODUCT_EDUCATION: 8 });
    });
  });

  describe('getPillarBalance', () => {
    it('returns distribution with percentages', async () => {
      prisma.contentDraft.groupBy.mockResolvedValue([
        { pillar: 'PRODUCT_EDUCATION', _count: 6 },
        { pillar: 'CUSTOMER_SUCCESS', _count: 4 },
      ] as any);

      const result = await service.getPillarBalance('biz1');

      expect(result.total).toBe(10);
      expect(result.distribution).toEqual([
        { pillar: 'PRODUCT_EDUCATION', count: 6, percentage: 60 },
        { pillar: 'CUSTOMER_SUCCESS', count: 4, percentage: 40 },
      ]);
    });

    it('returns zero percentages when no drafts exist', async () => {
      prisma.contentDraft.groupBy.mockResolvedValue([] as any);

      const result = await service.getPillarBalance('biz1');

      expect(result.total).toBe(0);
      expect(result.distribution).toEqual([]);
    });
  });

  describe('tenant isolation', () => {
    it('findAll always filters by businessId', async () => {
      prisma.contentDraft.findMany.mockResolvedValue([]);
      prisma.contentDraft.count.mockResolvedValue(0);

      await service.findAll('biz1', {} as any);

      expect(prisma.contentDraft.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
        }),
      );
    });

    it('findOne always filters by businessId', async () => {
      prisma.contentDraft.findFirst.mockResolvedValue(null);

      try {
        await service.findOne('biz1', 'cd1');
      } catch {
        // expected
      }

      expect(prisma.contentDraft.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'cd1', businessId: 'biz1' },
        }),
      );
    });

    it('getPipelineStats filters by businessId', async () => {
      prisma.contentDraft.groupBy.mockResolvedValue([] as any);

      await service.getPipelineStats('biz1');

      expect(prisma.contentDraft.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1' },
        }),
      );
    });

    it('bulkReview filters by businessId', async () => {
      prisma.contentDraft.updateMany.mockResolvedValue({ count: 0 } as any);

      await service.bulkReview('biz1', 'staff1', {
        draftIds: ['cd1'],
        action: 'APPROVE',
      } as any);

      expect(prisma.contentDraft.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz1' }),
        }),
      );
    });
  });
});
