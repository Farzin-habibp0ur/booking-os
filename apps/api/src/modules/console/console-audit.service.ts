import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

interface AuditLogQuery {
  search?: string;
  action?: string;
  actorId?: string;
  targetId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ConsoleAuditService {
  private readonly logger = new Logger(ConsoleAuditService.name);

  constructor(private prisma: PrismaService) {}

  async findAll(query: AuditLogQuery) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 50;
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (query.search) {
      where.OR = [
        { actorEmail: { contains: query.search, mode: 'insensitive' } },
        { action: { contains: query.search, mode: 'insensitive' } },
        { targetId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.action) {
      where.action = query.action;
    }

    if (query.actorId) {
      where.actorId = query.actorId;
    }

    if (query.targetId) {
      where.targetId = query.targetId;
    }

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const [items, total] = await Promise.all([
      this.prisma.platformAuditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.platformAuditLog.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  async getActionTypes(): Promise<string[]> {
    const result = await this.prisma.platformAuditLog.findMany({
      select: { action: true },
      distinct: ['action'],
      orderBy: { action: 'asc' },
    });
    return result.map((r) => r.action);
  }
}
