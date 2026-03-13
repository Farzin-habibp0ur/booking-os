import { NotFoundException } from '@nestjs/common';
import { DashboardBriefingService } from './dashboard-briefing.service';
import { createMockPrisma, MockPrisma } from '../../test/mocks';

describe('DashboardBriefingService', () => {
  let service: DashboardBriefingService;
  let prisma: MockPrisma;

  const mockCard = (overrides: any = {}) => ({
    id: 'ac1',
    businessId: 'biz1',
    type: 'CONTENT_REVIEW',
    category: 'CONTENT_REVIEW',
    priority: 70,
    title: 'Review blog post',
    description: 'New blog post needs approval',
    status: 'PENDING',
    metadata: { sourceAgentId: 'BlogWriter' },
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DashboardBriefingService(prisma as any);
  });

  describe('getBriefingFeed', () => {
    it('returns prioritized briefing items', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        mockCard({ id: 'ac1', priority: 90, category: 'URGENT' }),
        mockCard({ id: 'ac2', priority: 65, category: 'CONTENT_REVIEW' }),
        mockCard({ id: 'ac3', priority: 40, category: 'GROWTH' }),
        mockCard({ id: 'ac4', priority: 10, category: 'MAINTENANCE' }),
      ] as any);

      const result = await service.getBriefingFeed('biz1');

      expect(result).toHaveLength(4);
      expect(result[0].priority).toBe('URGENT_TODAY');
      expect(result[1].priority).toBe('NEEDS_APPROVAL');
      expect(result[2].priority).toBe('OPPORTUNITY');
      expect(result[3].priority).toBe('HYGIENE');
    });

    it('includes quickActions on each item', async () => {
      prisma.actionCard.findMany.mockResolvedValue([mockCard()] as any);

      const result = await service.getBriefingFeed('biz1');

      expect(result[0].quickActions).toEqual(['approve', 'dismiss', 'snooze', 'expand']);
    });

    it('extracts sourceAgent from metadata', async () => {
      prisma.actionCard.findMany.mockResolvedValue([mockCard()] as any);

      const result = await service.getBriefingFeed('biz1');

      expect(result[0].sourceAgent).toBe('BlogWriter');
    });

    it('falls back to type for sourceAgent', async () => {
      prisma.actionCard.findMany.mockResolvedValue([mockCard({ metadata: {} })] as any);

      const result = await service.getBriefingFeed('biz1');

      expect(result[0].sourceAgent).toBe('CONTENT_REVIEW');
    });

    it('only fetches PENDING cards', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);

      await service.getBriefingFeed('biz1');

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { businessId: 'biz1', status: 'PENDING' },
        }),
      );
    });
  });

  describe('getBriefingCount', () => {
    it('returns counts by priority', async () => {
      prisma.actionCard.findMany.mockResolvedValue([
        { priority: 90, category: 'URGENT' },
        { priority: 85, category: 'URGENT' },
        { priority: 65, category: 'CONTENT_REVIEW' },
        { priority: 40, category: 'GROWTH' },
        { priority: 10, category: 'MAINTENANCE' },
      ] as any);

      const result = await service.getBriefingCount('biz1');

      expect(result.URGENT_TODAY).toBe(2);
      expect(result.NEEDS_APPROVAL).toBe(1);
      expect(result.OPPORTUNITY).toBe(1);
      expect(result.HYGIENE).toBe(1);
      expect(result.total).toBe(5);
    });

    it('returns zeros when no cards', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);

      const result = await service.getBriefingCount('biz1');

      expect(result.total).toBe(0);
      expect(result.URGENT_TODAY).toBe(0);
    });
  });

  describe('executeBriefingAction', () => {
    it('approves a card', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(mockCard() as any);
      prisma.actionCard.update.mockResolvedValue({ ...mockCard(), status: 'APPROVED' } as any);

      const result = await service.executeBriefingAction('biz1', 'ac1', 'approve', 'staff1');

      expect(prisma.actionCard.update).toHaveBeenCalledWith({
        where: { id: 'ac1' },
        data: { status: 'APPROVED', resolvedAt: expect.any(Date), resolvedById: 'staff1' },
      });
    });

    it('dismisses a card', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(mockCard() as any);
      prisma.actionCard.update.mockResolvedValue({ ...mockCard(), status: 'DISMISSED' } as any);

      await service.executeBriefingAction('biz1', 'ac1', 'dismiss', 'staff1');

      expect(prisma.actionCard.update).toHaveBeenCalledWith({
        where: { id: 'ac1' },
        data: expect.objectContaining({ status: 'DISMISSED' }),
      });
    });

    it('snoozes a card for 4 hours', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(mockCard() as any);
      prisma.actionCard.update.mockResolvedValue({ ...mockCard(), status: 'SNOOZED' } as any);

      await service.executeBriefingAction('biz1', 'ac1', 'snooze');

      expect(prisma.actionCard.update).toHaveBeenCalledWith({
        where: { id: 'ac1' },
        data: { status: 'SNOOZED', snoozedUntil: expect.any(Date) },
      });
    });

    it('throws NotFoundException for missing card', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await expect(service.executeBriefingAction('biz1', 'missing', 'approve')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns card unchanged for unknown action', async () => {
      const card = mockCard();
      prisma.actionCard.findFirst.mockResolvedValue(card as any);

      const result = await service.executeBriefingAction('biz1', 'ac1', 'unknown');

      expect(result).toEqual(card);
      expect(prisma.actionCard.update).not.toHaveBeenCalled();
    });
  });

  describe('getMonthlyReview', () => {
    it('returns monthly review metrics', async () => {
      prisma.contentDraft.count
        .mockResolvedValueOnce(30) // current month
        .mockResolvedValueOnce(20); // previous month
      prisma.rejectionLog.count.mockResolvedValue(5);
      prisma.agentRun.count.mockResolvedValue(100);
      prisma.budgetEntry.findMany.mockResolvedValue([{ amount: 50 }, { amount: 100 }] as any);
      prisma.actionCard.count.mockResolvedValue(45);

      const result = await service.getMonthlyReview('biz1');

      expect(result.content.totalDrafts).toBe(30);
      expect(result.content.previousMonth).toBe(20);
      expect(result.content.growthPercent).toBe(50);
      expect(result.content.rejections).toBe(5);
      expect(result.agents.totalRuns).toBe(100);
      expect(result.agents.cardsExecuted).toBe(45);
      expect(result.budget.totalSpend).toBe(150);
    });

    it('handles zero previous month', async () => {
      prisma.contentDraft.count.mockResolvedValueOnce(10).mockResolvedValueOnce(0);
      prisma.rejectionLog.count.mockResolvedValue(0);
      prisma.agentRun.count.mockResolvedValue(0);
      prisma.budgetEntry.findMany.mockResolvedValue([]);
      prisma.actionCard.count.mockResolvedValue(0);

      const result = await service.getMonthlyReview('biz1');

      expect(result.content.growthPercent).toBe(0);
    });
  });

  describe('generateMonthlyReview', () => {
    it('includes recommendations for high rejection rate', async () => {
      prisma.contentDraft.count.mockResolvedValueOnce(10).mockResolvedValueOnce(10);
      prisma.rejectionLog.count.mockResolvedValue(5); // 50% rejection rate
      prisma.agentRun.count.mockResolvedValue(10);
      prisma.budgetEntry.findMany.mockResolvedValue([{ amount: 100 }] as any);
      prisma.actionCard.count.mockResolvedValue(5);

      const result = await service.generateMonthlyReview('biz1');

      expect(result.recommendations).toContainEqual(
        expect.stringContaining('Rejection rate above 20%'),
      );
    });

    it('includes recommendation when no budget allocated', async () => {
      prisma.contentDraft.count.mockResolvedValue(10);
      prisma.rejectionLog.count.mockResolvedValue(0);
      prisma.agentRun.count.mockResolvedValue(10);
      prisma.budgetEntry.findMany.mockResolvedValue([]);
      prisma.actionCard.count.mockResolvedValue(5);

      const result = await service.generateMonthlyReview('biz1');

      expect(result.recommendations).toContainEqual(expect.stringContaining('No budget allocated'));
    });

    it('includes recommendation when no agent runs', async () => {
      prisma.contentDraft.count.mockResolvedValue(10);
      prisma.rejectionLog.count.mockResolvedValue(0);
      prisma.agentRun.count.mockResolvedValue(0);
      prisma.budgetEntry.findMany.mockResolvedValue([{ amount: 50 }] as any);
      prisma.actionCard.count.mockResolvedValue(0);

      const result = await service.generateMonthlyReview('biz1');

      expect(result.recommendations).toContainEqual(
        expect.stringContaining('No agent runs recorded'),
      );
    });
  });

  describe('tenant isolation', () => {
    it('getBriefingFeed filters by businessId', async () => {
      prisma.actionCard.findMany.mockResolvedValue([]);

      await service.getBriefingFeed('biz1');

      expect(prisma.actionCard.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ businessId: 'biz1' }),
        }),
      );
    });

    it('executeBriefingAction scopes to businessId', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null);

      try {
        await service.executeBriefingAction('biz1', 'ac1', 'approve');
      } catch {
        /* expected */
      }

      expect(prisma.actionCard.findFirst).toHaveBeenCalledWith({
        where: { id: 'ac1', businessId: 'biz1' },
      });
    });
  });
});
