import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';

@Injectable()
export class OutboundService {
  private readonly logger = new Logger(OutboundService.name);

  constructor(
    private prisma: PrismaService,
    private actionHistoryService: ActionHistoryService,
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
    return this.prisma.outboundDraft.update({
      where: { id, businessId },
      data: { status: 'SENT', sentAt: new Date(), conversationId },
    });
  }
}
