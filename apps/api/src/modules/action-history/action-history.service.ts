import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

export interface CreateActionHistoryDto {
  businessId: string;
  actorType: 'STAFF' | 'AI' | 'SYSTEM' | 'CUSTOMER';
  actorId?: string;
  actorName?: string;
  action: string;
  entityType: 'BOOKING' | 'CONVERSATION' | 'CUSTOMER' | 'ACTION_CARD' | 'SETTING';
  entityId: string;
  description?: string;
  diff?: { before?: any; after?: any };
  metadata?: any;
}

@Injectable()
export class ActionHistoryService {
  private readonly logger = new Logger(ActionHistoryService.name);

  constructor(private prisma: PrismaService) {}

  async create(dto: CreateActionHistoryDto) {
    try {
      return await this.prisma.actionHistory.create({
        data: {
          businessId: dto.businessId,
          actorType: dto.actorType,
          actorId: dto.actorId,
          actorName: dto.actorName,
          action: dto.action,
          entityType: dto.entityType,
          entityId: dto.entityId,
          description: dto.description,
          diff: dto.diff ? dto.diff : undefined,
          metadata: dto.metadata || {},
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create action history: ${dto.action} on ${dto.entityType}/${dto.entityId}`,
        err.message,
      );
      return null;
    }
  }

  async findAll(
    businessId: string,
    query: {
      entityType?: string;
      entityId?: string;
      actorId?: string;
      action?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { businessId };

    if (query.entityType) where.entityType = query.entityType;
    if (query.entityId) where.entityId = query.entityId;
    if (query.actorId) where.actorId = query.actorId;
    if (query.action) where.action = query.action;

    const [items, total] = await Promise.all([
      this.prisma.actionHistory.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.actionHistory.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async exportCsv(
    businessId: string,
    opts?: { dateFrom?: string; dateTo?: string; entityType?: string; actorType?: string },
  ): Promise<string> {
    const where: any = { businessId };
    if (opts?.entityType) where.entityType = opts.entityType;
    if (opts?.actorType) where.actorType = opts.actorType;
    if (opts?.dateFrom || opts?.dateTo) {
      where.createdAt = {};
      if (opts?.dateFrom) where.createdAt.gte = new Date(opts.dateFrom);
      if (opts?.dateTo) where.createdAt.lte = new Date(opts.dateTo);
    }

    const items = await this.prisma.actionHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    const headers = [
      'id',
      'actorType',
      'actorName',
      'action',
      'entityType',
      'entityId',
      'description',
      'createdAt',
    ];

    const escapeCsv = (val: string | null | undefined): string => {
      if (val == null) return '';
      const str = String(val);
      if (str.includes('"') || str.includes(',') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = items.map((item) =>
      [
        item.id,
        item.actorType,
        item.actorName,
        item.action,
        item.entityType,
        item.entityId,
        item.description,
        item.createdAt?.toISOString(),
      ]
        .map(escapeCsv)
        .join(','),
    );

    return [headers.join(','), ...rows].join('\r\n') + '\r\n';
  }

  async findByEntity(businessId: string, entityType: string, entityId: string) {
    return this.prisma.actionHistory.findMany({
      where: { businessId, entityType, entityId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }
}
