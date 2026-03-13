import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreateBudgetEntryDto, QueryBudgetEntriesDto } from './dto';

export const TOOL_COST_DEFAULTS: Record<string, { min: number; max: number }> = {
  OPENAI_API: { min: 50, max: 120 },
  ANTHROPIC_API: { min: 30, max: 60 },
  IMAGE_GENERATION: { min: 20, max: 40 },
  SOCIAL_SCHEDULING: { min: 29, max: 29 },
  ANALYTICS_TOOLS: { min: 15, max: 25 },
  EMAIL_PLATFORM: { min: 25, max: 49 },
  SEO_TOOLS: { min: 0, max: 29 },
  STOCK_MEDIA: { min: 18, max: 29 },
};

export const BUDGET_RULES = [
  { id: 1, rule: 'No paid advertising before Month 3' },
  { id: 2, rule: 'Start with lowest tier for all tools' },
  { id: 3, rule: 'Track cost-per-lead for every channel' },
  { id: 4, rule: 'Review budget monthly and adjust' },
  { id: 5, rule: 'Kill underperforming channels within 14 days' },
  { id: 6, rule: 'Reallocate budget to winning channels' },
  { id: 7, rule: 'Never exceed approved monthly budget' },
  { id: 8, rule: 'Maintain 10% emergency fund' },
];

const APPROVAL_THRESHOLDS = [
  { max: 50, approver: 'AUTO' },
  { max: 200, approver: 'AGENT_LEAD' },
  { max: 500, approver: 'MARKETING_MANAGER' },
  { max: Infinity, approver: 'FOUNDER' },
];

@Injectable()
export class BudgetTrackerService {
  constructor(private prisma: PrismaService) {}

  async create(businessId: string, dto: CreateBudgetEntryDto) {
    const amount = parseFloat(dto.amount);
    const threshold = APPROVAL_THRESHOLDS.find((t) => amount <= t.max);
    const requiresApproval = threshold?.approver !== 'AUTO';

    return this.prisma.budgetEntry.create({
      data: {
        businessId,
        category: dto.category,
        description: dto.description,
        amount: dto.amount,
        currency: dto.currency ?? 'USD',
        period: dto.period,
        month: dto.month,
        year: dto.year,
        isRecurring: dto.isRecurring ?? false,
        metadata: {
          ...(dto.metadata ?? {}),
          approvalStatus: requiresApproval ? 'PENDING' : 'APPROVED',
          requiredApprover: threshold?.approver ?? 'AUTO',
        },
      },
    });
  }

  async findAll(businessId: string, query: QueryBudgetEntriesDto) {
    const where: any = { businessId };
    if (query.category) where.category = query.category;
    if (query.month) where.month = parseInt(query.month as any, 10);
    if (query.year) where.year = parseInt(query.year as any, 10);
    if (query.period) where.period = query.period;

    const [data, total] = await Promise.all([
      this.prisma.budgetEntry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: parseInt(query.skip as any, 10) || 0,
        take: Math.min(parseInt(query.take as any, 10) || 20, 100),
      }),
      this.prisma.budgetEntry.count({ where }),
    ]);

    return { data, total };
  }

  async getSummary(businessId: string, month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();

    const entries = await this.prisma.budgetEntry.findMany({
      where: {
        businessId,
        OR: [
          { month: targetMonth, year: targetYear },
          { isRecurring: true },
        ],
      },
    });

    const byCategory: Record<string, number> = {};
    let total = 0;

    for (const entry of entries) {
      const amount = Number(entry.amount);
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + amount;
      total += amount;
    }

    const emergencyFund = total * 0.1;

    return {
      month: targetMonth,
      year: targetYear,
      total,
      emergencyFund,
      effectiveBudget: total - emergencyFund,
      byCategory,
      entryCount: entries.length,
      toolCostDefaults: TOOL_COST_DEFAULTS,
    };
  }

  async getRoi(businessId: string) {
    const entries = await this.prisma.budgetEntry.findMany({
      where: { businessId },
    });

    const totalSpend = entries.reduce((sum, e) => sum + Number(e.amount), 0);

    const byCategory: Record<string, number> = {};
    for (const entry of entries) {
      byCategory[entry.category] = (byCategory[entry.category] ?? 0) + Number(entry.amount);
    }

    return {
      totalSpend,
      byCategory,
      budgetRules: BUDGET_RULES,
      approvalThresholds: APPROVAL_THRESHOLDS.map((t) => ({
        maxAmount: t.max === Infinity ? null : t.max,
        approver: t.approver,
      })),
    };
  }

  async approve(businessId: string, id: string, approverRole: string) {
    const entry = await this.prisma.budgetEntry.findFirst({
      where: { id, businessId },
    });
    if (!entry) throw new NotFoundException('Budget entry not found');

    const metadata = entry.metadata as any;
    if (metadata?.approvalStatus === 'APPROVED') {
      throw new BadRequestException('Entry is already approved');
    }

    const amount = Number(entry.amount);
    const threshold = APPROVAL_THRESHOLDS.find((t) => amount <= t.max);

    const roleHierarchy = ['AUTO', 'AGENT_LEAD', 'MARKETING_MANAGER', 'FOUNDER'];
    const requiredLevel = roleHierarchy.indexOf(threshold?.approver ?? 'FOUNDER');
    const approverLevel = roleHierarchy.indexOf(approverRole);

    if (approverLevel < requiredLevel) {
      throw new BadRequestException(
        `Requires ${threshold?.approver} approval for entries of $${amount}`,
      );
    }

    return this.prisma.budgetEntry.update({
      where: { id },
      data: {
        metadata: {
          ...metadata,
          approvalStatus: 'APPROVED',
          approvedBy: approverRole,
          approvedAt: new Date().toISOString(),
        },
      },
    });
  }
}
