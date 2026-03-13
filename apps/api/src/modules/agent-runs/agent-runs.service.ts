import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { QueryAgentRunsDto } from './dto';

@Injectable()
export class AgentRunsService {
  constructor(private prisma: PrismaService) {}

  async findAll(businessId: string, query: QueryAgentRunsDto) {
    const where: any = { businessId };
    if (query.agentType) where.agentType = query.agentType;
    if (query.status) where.status = query.status;
    if (query.startDate || query.endDate) {
      where.startedAt = {};
      if (query.startDate) where.startedAt.gte = new Date(query.startDate);
      if (query.endDate) where.startedAt.lte = new Date(query.endDate);
    }

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = Math.min(query.take ? parseInt(query.take, 10) : 20, 100);

    const [data, total] = await Promise.all([
      this.prisma.agentRun.findMany({
        where,
        skip,
        take,
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.agentRun.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(businessId: string, id: string) {
    const run = await this.prisma.agentRun.findFirst({
      where: { id, businessId },
    });
    if (!run) throw new NotFoundException('Agent run not found');
    return run;
  }

  async getStats(businessId: string) {
    const [byAgent, overall] = await Promise.all([
      this.prisma.agentRun.groupBy({
        by: ['agentType', 'status'],
        where: { businessId },
        _count: true,
        _sum: { cardsCreated: true },
      }),
      this.prisma.agentRun.aggregate({
        where: { businessId },
        _count: true,
        _sum: { cardsCreated: true },
      }),
    ]);

    const totalRuns = overall._count;
    const totalCards = overall._sum.cardsCreated || 0;

    const completedRuns = byAgent
      .filter((r) => r.status === 'COMPLETED')
      .reduce((sum, r) => sum + r._count, 0);
    const successRate = totalRuns > 0 ? Math.round((completedRuns / totalRuns) * 100) : 0;

    const agentBreakdown: Record<string, any> = {};
    for (const row of byAgent) {
      if (!agentBreakdown[row.agentType]) {
        agentBreakdown[row.agentType] = { total: 0, completed: 0, failed: 0, cardsCreated: 0 };
      }
      agentBreakdown[row.agentType].total += row._count;
      if (row.status === 'COMPLETED') {
        agentBreakdown[row.agentType].completed += row._count;
        agentBreakdown[row.agentType].cardsCreated += row._sum.cardsCreated || 0;
      }
      if (row.status === 'FAILED') {
        agentBreakdown[row.agentType].failed += row._count;
      }
    }

    return { totalRuns, totalCards, successRate, agentBreakdown };
  }
}
