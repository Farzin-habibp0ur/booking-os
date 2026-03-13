import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import {
  CreateContentDraftDto,
  UpdateContentDraftDto,
  ReviewContentDraftDto,
  BulkReviewDto,
  QueryContentDraftsDto,
} from './dto';

@Injectable()
export class MarketingContentService {
  private readonly logger = new Logger(MarketingContentService.name);

  constructor(private prisma: PrismaService) {}

  async create(businessId: string, dto: CreateContentDraftDto) {
    return this.prisma.contentDraft.create({
      data: {
        businessId,
        contentType: dto.contentType,
        title: dto.title,
        body: dto.body,
        tier: dto.tier,
        channel: dto.channel,
        pillar: dto.pillar,
        agentId: dto.agentId,
        platform: dto.platform,
        slug: dto.slug,
        metadata: dto.metadata,
        status: 'PENDING_REVIEW',
        currentGate: 'GATE_1',
      },
    });
  }

  async findAll(businessId: string, query: QueryContentDraftsDto) {
    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.tier) where.tier = query.tier;
    if (query.contentType) where.contentType = query.contentType;
    if (query.agentId) where.agentId = query.agentId;
    if (query.pillar) where.pillar = query.pillar;
    if (query.channel) where.channel = query.channel;

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = Math.min(query.take ? parseInt(query.take, 10) : 20, 100);

    const orderBy: any = {};
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    orderBy[sortBy] = sortOrder;

    const [data, total] = await Promise.all([
      this.prisma.contentDraft.findMany({
        where,
        skip,
        take,
        orderBy,
      }),
      this.prisma.contentDraft.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(businessId: string, id: string) {
    const draft = await this.prisma.contentDraft.findFirst({
      where: { id, businessId },
      include: {
        rejectionLogs: { orderBy: { createdAt: 'desc' } },
        abTestVariants: true,
      },
    });
    if (!draft) throw new NotFoundException('Content draft not found');
    return draft;
  }

  async update(businessId: string, id: string, dto: UpdateContentDraftDto) {
    await this.findOne(businessId, id);
    return this.prisma.contentDraft.update({
      where: { id },
      data: dto,
    });
  }

  async review(businessId: string, id: string, reviewedById: string, dto: ReviewContentDraftDto) {
    const draft = await this.findOne(businessId, id);

    if (dto.action === 'APPROVE') {
      return this.approveDraft(businessId, draft, reviewedById);
    } else if (dto.action === 'REJECT') {
      return this.rejectDraft(businessId, draft, reviewedById, dto);
    } else if (dto.action === 'EDIT') {
      return this.editDraft(draft, reviewedById, dto);
    }

    throw new BadRequestException('Invalid review action');
  }

  private async approveDraft(businessId: string, draft: any, reviewedById: string) {
    if (draft.status !== 'PENDING_REVIEW' && draft.status !== 'REVIEW') {
      throw new BadRequestException('Only drafts in review can be approved');
    }

    const nextGate = this.getNextGate(draft.currentGate);
    const isFullyApproved = !nextGate;

    const updated = await this.prisma.contentDraft.update({
      where: { id: draft.id },
      data: {
        status: isFullyApproved ? 'APPROVED' : draft.status,
        currentGate: nextGate || draft.currentGate,
        reviewedById,
      },
    });

    try {
      await this.prisma.actionHistory.create({
        data: {
          businessId,
          actorType: 'STAFF',
          actorId: reviewedById,
          action: 'CONTENT_APPROVED',
          entityType: 'CONTENT_DRAFT',
          entityId: draft.id,
          description: `Approved content at ${draft.currentGate}: ${draft.title}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create action history: ${err.message}`);
    }

    return updated;
  }

  private async rejectDraft(
    businessId: string,
    draft: any,
    reviewedById: string,
    dto: ReviewContentDraftDto,
  ) {
    if (draft.status !== 'PENDING_REVIEW' && draft.status !== 'REVIEW') {
      throw new BadRequestException('Only drafts in review can be rejected');
    }

    const severity = this.getSeverityFromCode(dto.rejectionCode);

    const [updated] = await Promise.all([
      this.prisma.contentDraft.update({
        where: { id: draft.id },
        data: {
          rejectionCode: dto.rejectionCode,
          rejectionReason: dto.rejectionReason,
          reviewedById,
        },
      }),
      this.prisma.rejectionLog.create({
        data: {
          businessId,
          contentDraftId: draft.id,
          gate: draft.currentGate || 'GATE_1',
          rejectionCode: dto.rejectionCode || 'R01',
          reason: dto.rejectionReason || 'No reason provided',
          severity,
          reviewedById,
        },
      }),
    ]);

    try {
      await this.prisma.actionHistory.create({
        data: {
          businessId,
          actorType: 'STAFF',
          actorId: reviewedById,
          action: 'CONTENT_REJECTED',
          entityType: 'CONTENT_DRAFT',
          entityId: draft.id,
          description: `Rejected content at ${draft.currentGate}: ${draft.title}`,
          metadata: {
            rejectionCode: dto.rejectionCode,
            rejectionReason: dto.rejectionReason,
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create action history: ${err.message}`);
    }

    return updated;
  }

  private async editDraft(draft: any, reviewedById: string, dto: ReviewContentDraftDto) {
    if (!dto.editedBody) {
      throw new BadRequestException('editedBody is required for EDIT action');
    }

    return this.prisma.contentDraft.update({
      where: { id: draft.id },
      data: {
        body: dto.editedBody,
        reviewedById,
      },
    });
  }

  async bulkReview(businessId: string, reviewedById: string, dto: BulkReviewDto) {
    if (dto.action === 'APPROVE') {
      const result = await this.prisma.contentDraft.updateMany({
        where: {
          id: { in: dto.draftIds },
          businessId,
          status: { in: ['PENDING_REVIEW', 'REVIEW'] },
        },
        data: { status: 'APPROVED', reviewedById },
      });
      return { updated: result.count };
    }

    if (dto.action === 'REJECT') {
      return this.prisma.$transaction(async (tx) => {
        const drafts = await tx.contentDraft.findMany({
          where: {
            id: { in: dto.draftIds },
            businessId,
            status: { in: ['PENDING_REVIEW', 'REVIEW'] },
          },
        });

        if (drafts.length === 0) return { updated: 0 };

        const result = await tx.contentDraft.updateMany({
          where: {
            id: { in: drafts.map((d) => d.id) },
            businessId,
          },
          data: {
            rejectionCode: dto.rejectionCode,
            rejectionReason: dto.rejectionReason,
            reviewedById,
          },
        });

        await tx.rejectionLog.createMany({
          data: drafts.map((draft) => ({
            businessId,
            contentDraftId: draft.id,
            gate: draft.currentGate || 'GATE_1',
            rejectionCode: dto.rejectionCode || 'R01',
            reason: dto.rejectionReason || 'Bulk rejection',
            severity: 'MINOR',
            reviewedById,
          })),
        });

        return { updated: result.count };
      });
    }

    throw new BadRequestException('Invalid bulk review action');
  }

  async remove(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.contentDraft.update({
      where: { id },
      data: { status: 'DRAFT' },
    });
  }

  async getPipelineStats(businessId: string) {
    const [byStatus, byTier, byContentType, byPillar] = await Promise.all([
      this.prisma.contentDraft.groupBy({
        by: ['status'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.contentDraft.groupBy({
        by: ['tier'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.contentDraft.groupBy({
        by: ['contentType'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.contentDraft.groupBy({
        by: ['pillar'],
        where: { businessId },
        _count: true,
      }),
    ]);

    return {
      byStatus: byStatus.reduce((acc: any, r: any) => ({ ...acc, [r.status]: r._count }), {}),
      byTier: byTier.reduce(
        (acc: any, r: any) => ({ ...acc, [r.tier || 'UNSET']: r._count }),
        {},
      ),
      byContentType: byContentType.reduce(
        (acc: any, r: any) => ({ ...acc, [r.contentType]: r._count }),
        {},
      ),
      byPillar: byPillar.reduce(
        (acc: any, r: any) => ({ ...acc, [r.pillar || 'UNSET']: r._count }),
        {},
      ),
    };
  }

  async getPillarBalance(businessId: string) {
    const groups = await this.prisma.contentDraft.groupBy({
      by: ['pillar'],
      where: { businessId },
      _count: true,
    });

    const total = groups.reduce((sum: number, g: any) => sum + g._count, 0);

    const distribution = groups.map((g: any) => ({
      pillar: g.pillar || 'UNSET',
      count: g._count,
      percentage: total > 0 ? Math.round((g._count / total) * 100 * 10) / 10 : 0,
    }));

    return { distribution, total };
  }

  private getNextGate(currentGate: string | null): string | null {
    const gates = ['GATE_1', 'GATE_2', 'GATE_3', 'GATE_4'];
    if (!currentGate) return 'GATE_2';
    const idx = gates.indexOf(currentGate);
    if (idx < 0 || idx >= gates.length - 1) return null;
    return gates[idx + 1];
  }

  private getSeverityFromCode(code?: string): string {
    if (!code) return 'MINOR';
    const critical = ['R07', 'R08', 'R09', 'R10'];
    const major = ['R04', 'R05', 'R06'];
    if (critical.includes(code)) return 'CRITICAL';
    if (major.includes(code)) return 'MAJOR';
    return 'MINOR';
  }
}
