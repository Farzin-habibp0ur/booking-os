import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';
import { ActionHistoryService } from '../action-history/action-history.service';
import { InboxGateway } from '../../common/inbox.gateway';

@Injectable()
export class ActionCardService {
  private readonly logger = new Logger(ActionCardService.name);

  constructor(
    private prisma: PrismaService,
    private actionHistoryService: ActionHistoryService,
    private inboxGateway: InboxGateway,
  ) {}

  async create(data: {
    businessId: string;
    type: string;
    category: string;
    priority?: number;
    title: string;
    description: string;
    suggestedAction?: string;
    preview?: any;
    ctaConfig?: any;
    autonomyLevel?: string;
    expiresAt?: Date;
    bookingId?: string;
    customerId?: string;
    conversationId?: string;
    staffId?: string;
    metadata?: any;
  }) {
    const card = await this.prisma.actionCard.create({
      data: {
        businessId: data.businessId,
        type: data.type,
        category: data.category,
        priority: data.priority ?? 50,
        title: data.title,
        description: data.description,
        suggestedAction: data.suggestedAction,
        preview: data.preview,
        ctaConfig: data.ctaConfig || [],
        autonomyLevel: data.autonomyLevel || 'ASSISTED',
        expiresAt: data.expiresAt,
        bookingId: data.bookingId,
        customerId: data.customerId,
        conversationId: data.conversationId,
        staffId: data.staffId,
        metadata: data.metadata || {},
      },
      include: { customer: true, booking: true, staff: true },
    });

    this.inboxGateway.emitToBusinessRoom(data.businessId, 'action-card:new', { card });

    return card;
  }

  async findAll(
    businessId: string,
    query: {
      status?: string;
      category?: string;
      type?: string;
      staffId?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { businessId };

    if (query.status) where.status = query.status;
    if (query.category) where.category = query.category;
    if (query.type) where.type = query.type;
    if (query.staffId) where.staffId = query.staffId;

    const [items, total] = await Promise.all([
      this.prisma.actionCard.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { customer: true, booking: true, staff: true },
      }),
      this.prisma.actionCard.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async findById(businessId: string, id: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, businessId },
      include: { customer: true, booking: true, staff: true, conversation: true },
    });
    if (!card) throw new NotFoundException('Action card not found');
    return card;
  }

  async approve(businessId: string, id: string, staffId: string, staffName?: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, businessId },
    });
    if (!card) throw new NotFoundException('Action card not found');
    if (card.status !== 'PENDING') {
      throw new BadRequestException(`Cannot approve card with status ${card.status}`);
    }

    const updated = await this.prisma.actionCard.update({
      where: { id },
      data: { status: 'APPROVED', resolvedById: staffId, resolvedAt: new Date() },
      include: { customer: true, booking: true, staff: true },
    });

    this.inboxGateway.emitToBusinessRoom(businessId, 'action-card:updated', { card: updated });

    this.actionHistoryService
      .create({
        businessId,
        actorType: 'STAFF',
        actorId: staffId,
        actorName: staffName,
        action: 'CARD_APPROVED',
        entityType: 'ACTION_CARD',
        entityId: id,
        description: `Action card "${card.title}" approved`,
        diff: { before: { status: 'PENDING' }, after: { status: 'APPROVED' } },
      })
      .catch((err) =>
        this.logger.warn(`Failed to log card approval audit for ${id}`, { error: err?.message }),
      );

    return updated;
  }

  async dismiss(businessId: string, id: string, staffId: string, staffName?: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, businessId },
    });
    if (!card) throw new NotFoundException('Action card not found');
    if (card.status !== 'PENDING') {
      throw new BadRequestException(`Cannot dismiss card with status ${card.status}`);
    }

    const updated = await this.prisma.actionCard.update({
      where: { id },
      data: { status: 'DISMISSED', resolvedById: staffId, resolvedAt: new Date() },
      include: { customer: true, booking: true, staff: true },
    });

    this.inboxGateway.emitToBusinessRoom(businessId, 'action-card:updated', { card: updated });

    this.actionHistoryService
      .create({
        businessId,
        actorType: 'STAFF',
        actorId: staffId,
        actorName: staffName,
        action: 'CARD_DISMISSED',
        entityType: 'ACTION_CARD',
        entityId: id,
        description: `Action card "${card.title}" dismissed`,
        diff: { before: { status: 'PENDING' }, after: { status: 'DISMISSED' } },
      })
      .catch((err) =>
        this.logger.warn(`Failed to log card dismissal audit for ${id}`, { error: err?.message }),
      );

    return updated;
  }

  async snooze(businessId: string, id: string, until: Date, staffId: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, businessId },
    });
    if (!card) throw new NotFoundException('Action card not found');
    if (card.status !== 'PENDING') {
      throw new BadRequestException(`Cannot snooze card with status ${card.status}`);
    }

    const updated = await this.prisma.actionCard.update({
      where: { id },
      data: { status: 'SNOOZED', snoozedUntil: until },
      include: { customer: true, booking: true, staff: true },
    });

    this.inboxGateway.emitToBusinessRoom(businessId, 'action-card:updated', { card: updated });

    return updated;
  }

  async execute(businessId: string, id: string, staffId: string, staffName?: string) {
    const card = await this.prisma.actionCard.findFirst({
      where: { id, businessId },
    });
    if (!card) throw new NotFoundException('Action card not found');
    if (!['PENDING', 'APPROVED'].includes(card.status)) {
      throw new BadRequestException(`Cannot execute card with status ${card.status}`);
    }

    const updated = await this.prisma.actionCard.update({
      where: { id },
      data: { status: 'EXECUTED', resolvedById: staffId, resolvedAt: new Date() },
      include: { customer: true, booking: true, staff: true },
    });

    this.inboxGateway.emitToBusinessRoom(businessId, 'action-card:updated', { card: updated });

    this.actionHistoryService
      .create({
        businessId,
        actorType: 'STAFF',
        actorId: staffId,
        actorName: staffName,
        action: 'CARD_EXECUTED',
        entityType: 'ACTION_CARD',
        entityId: id,
        description: `Action card "${card.title}" executed`,
        diff: { before: { status: card.status }, after: { status: 'EXECUTED' } },
      })
      .catch((err) =>
        this.logger.warn(`Failed to log card execution audit for ${id}`, { error: err?.message }),
      );

    return updated;
  }

  async getPendingCount(businessId: string, staffId?: string) {
    const where: any = { businessId, status: 'PENDING' };
    if (staffId) where.staffId = staffId;
    return this.prisma.actionCard.count({ where });
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async expireCards() {
    const now = new Date();
    const { count } = await this.prisma.actionCard.updateMany({
      where: {
        status: 'PENDING',
        expiresAt: { lte: now },
      },
      data: { status: 'EXPIRED' },
    });

    if (count > 0) {
      this.logger.log(`Expired ${count} action card(s)`);
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async unsnoozCards() {
    const now = new Date();
    const { count } = await this.prisma.actionCard.updateMany({
      where: {
        status: 'SNOOZED',
        snoozedUntil: { lte: now },
      },
      data: { status: 'PENDING', snoozedUntil: null },
    });

    if (count > 0) {
      this.logger.log(`Unsnoozed ${count} action card(s)`);
    }
  }
}
