import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { QueryRejectionLogsDto } from './dto';

@Injectable()
export class RejectionAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getLogs(businessId: string, query: QueryRejectionLogsDto) {
    const where: any = { businessId };
    if (query.gate) where.gate = query.gate;
    if (query.rejectionCode) where.rejectionCode = query.rejectionCode;
    if (query.agentId) where.agentId = query.agentId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = Math.min(query.take ? parseInt(query.take, 10) : 20, 100);

    const [data, total] = await Promise.all([
      this.prisma.rejectionLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { contentDraft: { select: { title: true, contentType: true, pillar: true } } },
      }),
      this.prisma.rejectionLog.count({ where }),
    ]);

    return { data, total };
  }

  async getWeeklySummary(businessId: string) {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() - 7 + 1); // Last Monday
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);

    const [currentWeek, prevWeek, byCode, byAgent] = await Promise.all([
      this.prisma.rejectionLog.count({
        where: { businessId, createdAt: { gte: weekStart, lt: weekEnd } },
      }),
      this.prisma.rejectionLog.count({
        where: { businessId, createdAt: { gte: prevWeekStart, lt: weekStart } },
      }),
      this.prisma.rejectionLog.groupBy({
        by: ['rejectionCode'],
        where: { businessId, createdAt: { gte: weekStart, lt: weekEnd } },
        _count: true,
      }),
      this.prisma.rejectionLog.groupBy({
        by: ['agentId'],
        where: { businessId, createdAt: { gte: weekStart, lt: weekEnd } },
        _count: true,
      }),
    ]);

    const totalDrafts = await this.prisma.contentDraft.count({
      where: { businessId, createdAt: { gte: weekStart, lt: weekEnd } },
    });
    const rejectionRate = totalDrafts > 0 ? Math.round((currentWeek / totalDrafts) * 100) : 0;

    return {
      weekStart: weekStart.toISOString(),
      weekEnd: weekEnd.toISOString(),
      totalRejections: currentWeek,
      previousWeekRejections: prevWeek,
      weekOverWeekChange:
        prevWeek > 0 ? Math.round(((currentWeek - prevWeek) / prevWeek) * 100) : 0,
      rejectionRate,
      byCode: byCode.reduce((acc: any, r: any) => ({ ...acc, [r.rejectionCode]: r._count }), {}),
      byAgent: byAgent.reduce(
        (acc: any, r: any) => ({ ...acc, [r.agentId || 'manual']: r._count }),
        {},
      ),
    };
  }

  async getStats(businessId: string) {
    const [byGate, byCode, byAgent, bySeverity] = await Promise.all([
      this.prisma.rejectionLog.groupBy({
        by: ['gate'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.rejectionLog.groupBy({
        by: ['rejectionCode'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.rejectionLog.groupBy({
        by: ['agentId'],
        where: { businessId },
        _count: true,
      }),
      this.prisma.rejectionLog.groupBy({
        by: ['severity'],
        where: { businessId },
        _count: true,
      }),
    ]);

    return {
      byGate: byGate.reduce((acc: any, r: any) => ({ ...acc, [r.gate]: r._count }), {}),
      byCode: byCode.reduce((acc: any, r: any) => ({ ...acc, [r.rejectionCode]: r._count }), {}),
      byAgent: byAgent.reduce(
        (acc: any, r: any) => ({ ...acc, [r.agentId || 'manual']: r._count }),
        {},
      ),
      bySeverity: bySeverity.reduce((acc: any, r: any) => ({ ...acc, [r.severity]: r._count }), {}),
    };
  }

  async getAgentRejectionDetails(businessId: string, agentId: string) {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    const [recentCount, previousCount, byCode, recentLogs] = await Promise.all([
      this.prisma.rejectionLog.count({
        where: { businessId, agentId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.rejectionLog.count({
        where: { businessId, agentId, createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
      }),
      this.prisma.rejectionLog.groupBy({
        by: ['rejectionCode'],
        where: { businessId, agentId },
        _count: true,
      }),
      this.prisma.rejectionLog.findMany({
        where: { businessId, agentId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { contentDraft: { select: { title: true } } },
      }),
    ]);

    let trend: 'up' | 'down' | 'stable' = 'stable';
    if (recentCount > previousCount * 1.1) trend = 'up';
    else if (recentCount < previousCount * 0.9) trend = 'down';

    return {
      agentId,
      recentRejections: recentCount,
      previousPeriodRejections: previousCount,
      trend,
      byCode: byCode.reduce((acc: any, r: any) => ({ ...acc, [r.rejectionCode]: r._count }), {}),
      recentLogs,
    };
  }
}
