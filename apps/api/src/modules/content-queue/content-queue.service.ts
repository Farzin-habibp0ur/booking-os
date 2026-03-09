import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateContentDraftDto, UpdateContentDraftDto, ListContentDraftsDto } from './dto';

@Injectable()
export class ContentQueueService {
  private readonly logger = new Logger(ContentQueueService.name);

  constructor(private prisma: PrismaService) {}

  async create(businessId: string, dto: CreateContentDraftDto) {
    return this.prisma.contentDraft.create({
      data: {
        businessId,
        title: dto.title,
        body: dto.body,
        contentType: dto.contentType,
        channel: dto.channel,
        pillar: dto.pillar,
        agentId: dto.agentId,
        scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : undefined,
        metadata: dto.metadata,
      },
    });
  }

  async findAll(businessId: string, query: ListContentDraftsDto) {
    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.contentType) where.contentType = query.contentType;
    if (query.channel) where.channel = query.channel;
    if (query.pillar) where.pillar = query.pillar;

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = Math.min(query.take ? parseInt(query.take, 10) : 20, 100);

    const [data, total] = await Promise.all([
      this.prisma.contentDraft.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.contentDraft.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(businessId: string, id: string) {
    const draft = await this.prisma.contentDraft.findFirst({
      where: { id, businessId },
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

  async approve(businessId: string, id: string, reviewedById: string, scheduledFor?: string) {
    const draft = await this.findOne(businessId, id);
    if (draft.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Only pending drafts can be approved');
    }

    const updated = await this.prisma.contentDraft.update({
      where: { id },
      data: {
        status: scheduledFor ? 'SCHEDULED' : 'APPROVED',
        reviewedById,
        scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined,
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
          entityId: id,
          description: `Approved content: ${draft.title}`,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create action history: ${err.message}`);
    }

    return updated;
  }

  async reject(businessId: string, id: string, reviewedById: string, reviewNote: string) {
    const draft = await this.findOne(businessId, id);
    if (draft.status !== 'PENDING_REVIEW') {
      throw new BadRequestException('Only pending drafts can be rejected');
    }

    const updated = await this.prisma.contentDraft.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedById,
        reviewNote,
      },
    });

    try {
      await this.prisma.actionHistory.create({
        data: {
          businessId,
          actorType: 'STAFF',
          actorId: reviewedById,
          action: 'CONTENT_REJECTED',
          entityType: 'CONTENT_DRAFT',
          entityId: id,
          description: `Rejected content: ${draft.title}`,
          metadata: { reviewNote },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create action history: ${err.message}`);
    }

    return updated;
  }

  async bulkApprove(businessId: string, ids: string[], reviewedById: string) {
    const result = await this.prisma.contentDraft.updateMany({
      where: { id: { in: ids }, businessId, status: 'PENDING_REVIEW' },
      data: { status: 'APPROVED', reviewedById },
    });
    return { updated: result.count };
  }

  async bulkReject(businessId: string, ids: string[], reviewedById: string, reviewNote: string) {
    const result = await this.prisma.contentDraft.updateMany({
      where: { id: { in: ids }, businessId, status: 'PENDING_REVIEW' },
      data: { status: 'REJECTED', reviewedById, reviewNote },
    });
    return { updated: result.count };
  }

  async getStats(businessId: string) {
    const [byStatus, byContentType, byChannel] = await Promise.all([
      this.prisma.contentDraft.groupBy({
        by: ['status'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.contentDraft.groupBy({
        by: ['contentType'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.contentDraft.groupBy({
        by: ['channel'],
        where: { businessId },
        _count: true,
      }),
    ]);

    return {
      byStatus: byStatus.reduce((acc: any, r: any) => ({ ...acc, [r.status]: r._count }), {}),
      byContentType: byContentType.reduce(
        (acc: any, r: any) => ({ ...acc, [r.contentType]: r._count }),
        {},
      ),
      byChannel: byChannel.reduce((acc: any, r: any) => ({ ...acc, [r.channel]: r._count }), {}),
    };
  }
}
