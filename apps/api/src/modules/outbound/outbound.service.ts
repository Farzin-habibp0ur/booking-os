import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';
import { InboxGateway } from '../../common/inbox.gateway';

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    private prisma: PrismaService,
    private actionHistoryService: ActionHistoryService,
    @Optional() private inboxGateway?: InboxGateway,
  ) {}

  async createDraft(data: {
    businessId: string;
    customerId: string;
    staffId: string;
    channel?: string;
    content: string;
  }) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, businessId: data.businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    return this.prisma.outboundDraft.create({
      data: {
        businessId: data.businessId,
        customerId: data.customerId,
        staffId: data.staffId,
        channel: data.channel || 'WHATSAPP',
        content: data.content,
        status: 'DRAFT',
      },
      include: { customer: true, staff: true },
    });
  }

  async createAiDraft(data: {
    businessId: string;
    customerId: string;
    staffId: string;
    conversationId: string;
    channel: string;
    content: string;
    sourceMessageId?: string;
    intent?: string;
    confidence?: number;
    metadata?: Record<string, any>;
    source?: string;
  }) {
    const source = data.source || 'AI';
    const channel = data.channel || 'WHATSAPP';
    const draft = await this.prisma.$transaction(async (tx) => {
      const created = await tx.outboundDraft.create({
        data: {
          businessId: data.businessId,
          customerId: data.customerId,
          staffId: data.staffId,
          conversationId: data.conversationId,
          channel,
          content: data.content,
          status: 'DRAFT',
          source,
          sourceMessageId: data.sourceMessageId,
          intent: data.intent,
          confidence: data.confidence,
          metadata: data.metadata as any,
        },
        include: { customer: true, staff: true },
      });

      // LEGACY: Phase 4 moved attribution to booking-creation hook
      // (front-desk-attribution.service.createForBooking). Kept commented for
      // one release for safety; remove in next cleanup.
      // if (source === 'AI') {
      //   await tx.frontDeskAttribution.create({
      //     data: {
      //       businessId: data.businessId,
      //       customerId: data.customerId,
      //       conversationId: data.conversationId,
      //       outboundDraftId: created.id,
      //       source: this.getAttributionSource(data.intent),
      //       status: 'OPEN',
      //       channel,
      //       confidence: data.confidence ?? null,
      //       reason: data.intent || null,
      //       metadata: (data.metadata || {}) as any,
      //     },
      //   });
      // }

      return created;
    });

    // Notify inbox in real-time
    if (this.inboxGateway) {
      this.inboxGateway.emitToBusinessRoom(data.businessId, 'draft:created', {
        conversationId: data.conversationId,
        draftId: draft.id,
        channel: draft.channel,
        source: draft.source,
        intent: data.intent,
        preview: data.content.slice(0, 120),
      });
    }

    this.logger.log(
      `AI draft created: ${draft.id} for conversation ${data.conversationId} (${data.intent})`,
    );

    return draft;
  }

  async findByConversation(businessId: string, conversationId: string, status?: string) {
    const where: any = { businessId, conversationId };
    if (status) where.status = status;

    return this.prisma.outboundDraft.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { customer: true, staff: true },
    });
  }

  async findAll(
    businessId: string,
    query: { status?: string; customerId?: string; page?: number; pageSize?: number },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;

    const [items, total] = await Promise.all([
      this.prisma.outboundDraft.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true, staff: true, approvedBy: true },
      }),
      this.prisma.outboundDraft.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async approve(businessId: string, id: string, approvedById: string) {
    const draft = await this.prisma.outboundDraft.findFirst({
      where: { id, businessId },
    });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot approve draft with status ${draft.status}`);
    }

    const updated = await this.prisma.outboundDraft.update({
      where: { id },
      data: { status: 'APPROVED', approvedById },
      include: { customer: true, staff: true },
    });

    this.actionHistoryService
      .create({
        businessId,
        actorType: 'STAFF',
        actorId: approvedById,
        action: 'OUTBOUND_APPROVED',
        entityType: 'CONVERSATION',
        entityId: draft.conversationId || id,
        description: `Outbound message approved for customer`,
        diff: { before: { status: 'DRAFT' }, after: { status: 'APPROVED' } },
      })
      .catch((err) =>
        this.logger.warn(`Failed to log outbound approval for ${id}`, { error: err?.message }),
      );

    return updated;
  }

  async reject(businessId: string, id: string) {
    const draft = await this.prisma.outboundDraft.findFirst({
      where: { id, businessId },
    });
    if (!draft) throw new NotFoundException('Draft not found');
    if (draft.status !== 'DRAFT') {
      throw new BadRequestException(`Cannot reject draft with status ${draft.status}`);
    }

    return this.prisma.outboundDraft.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: { customer: true, staff: true },
    });
  }

  async markSent(businessId: string, id: string, conversationId: string) {
    const sentAt = new Date();
    return this.prisma.$transaction(async (tx) => {
      const draft = await tx.outboundDraft.update({
        where: { id, businessId },
        data: { status: 'SENT', sentAt, conversationId },
      });

      // LEGACY: Phase 4 moved attribution to booking-creation hook
      // (front-desk-attribution.service.createForBooking). Kept commented for
      // one release for safety; remove in next cleanup.
      // await tx.frontDeskAttribution.updateMany({
      //   where: { businessId, outboundDraftId: id },
      //   data: { status: 'OPEN', openedAt: sentAt, conversationId },
      // });

      return draft;
    });
  }

  // LEGACY: Phase 4 moved attribution to booking-creation hook
  // (front-desk-attribution.service.createForBooking). Kept for one release
  // alongside the commented call sites above; remove in next cleanup.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private getAttributionSource(intent?: string): string {
    const normalized = intent?.toUpperCase();
    if (normalized === 'QUOTE_FOLLOWUP' || normalized === 'CONSULT_FOLLOWUP') {
      return 'CONSULT_FOLLOWUP';
    }
    return 'AI_DRAFT';
  }

  async autoSaveDraft(
    businessId: string,
    staffId: string,
    dto: { conversationId: string; channel: string; content: string; subject?: string },
  ) {
    // If content and subject are both empty, delete the draft
    if (!dto.content.trim() && !dto.subject?.trim()) {
      await this.prisma.outboundDraft.deleteMany({
        where: {
          businessId,
          conversationId: dto.conversationId,
          channel: dto.channel,
          staffId,
          status: 'DRAFT',
        },
      });
      return { deleted: true };
    }

    // Find the conversation to get customerId
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: dto.conversationId, businessId },
      select: { customerId: true },
    });
    if (!conversation) throw new NotFoundException('Conversation not found');

    return this.prisma.outboundDraft.upsert({
      where: {
        conversationId_channel_staffId: {
          conversationId: dto.conversationId,
          channel: dto.channel,
          staffId,
        },
      },
      create: {
        businessId,
        customerId: conversation.customerId,
        staffId,
        conversationId: dto.conversationId,
        channel: dto.channel,
        content: dto.content,
        subject: dto.subject,
        status: 'DRAFT',
        source: 'MANUAL',
      },
      update: {
        content: dto.content,
        subject: dto.subject,
        updatedAt: new Date(),
      },
    });
  }

  async getAutoSaveDrafts(businessId: string, staffId: string, conversationId: string) {
    return this.prisma.outboundDraft.findMany({
      where: {
        businessId,
        conversationId,
        staffId,
        status: 'DRAFT',
        source: 'MANUAL',
      },
      select: {
        channel: true,
        content: true,
        subject: true,
      },
    });
  }
}
