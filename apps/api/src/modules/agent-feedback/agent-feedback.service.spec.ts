import { Test } from '@nestjs/testing';
import { AgentFeedbackService } from './agent-feedback.service';
import { PrismaService } from '../../common/prisma.service';
import { createMockPrisma } from '../../test/mocks';
import { NotFoundException, ConflictException } from '@nestjs/common';

describe('AgentFeedbackService', () => {
  let service: AgentFeedbackService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(async () => {
    prisma = createMockPrisma();
    const module = await Test.createTestingModule({
      providers: [AgentFeedbackService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get(AgentFeedbackService);
  });

  describe('submitFeedback', () => {
    it('creates feedback for a valid action card', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({ id: 'card1', businessId: 'biz1' } as any);
      prisma.agentFeedback.create.mockResolvedValue({
        id: 'fb1',
        businessId: 'biz1',
        actionCardId: 'card1',
        staffId: 'staff1',
        rating: 'HELPFUL',
        comment: 'Great suggestion',
      } as any);

      const result = await service.submitFeedback('biz1', 'card1', 'staff1', {
        rating: 'HELPFUL',
        comment: 'Great suggestion',
      });

      expect(result.rating).toBe('HELPFUL');
      expect(prisma.agentFeedback.create).toHaveBeenCalledWith({
        data: {
          businessId: 'biz1',
          actionCardId: 'card1',
          staffId: 'staff1',
          rating: 'HELPFUL',
          comment: 'Great suggestion',
        },
      });
    });

    it('throws NotFoundException when action card not found', async () => {
      prisma.actionCard.findFirst.mockResolvedValue(null);

      await expect(
        service.submitFeedback('biz1', 'card1', 'staff1', { rating: 'HELPFUL' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException on duplicate feedback', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({ id: 'card1', businessId: 'biz1' } as any);
      prisma.agentFeedback.create.mockRejectedValue({ code: 'P2002' });

      await expect(
        service.submitFeedback('biz1', 'card1', 'staff1', { rating: 'HELPFUL' }),
      ).rejects.toThrow(ConflictException);
    });

    it('re-throws non-P2002 errors', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({ id: 'card1', businessId: 'biz1' } as any);
      prisma.agentFeedback.create.mockRejectedValue(new Error('DB down'));

      await expect(
        service.submitFeedback('biz1', 'card1', 'staff1', { rating: 'HELPFUL' }),
      ).rejects.toThrow('DB down');
    });

    it('creates feedback without comment', async () => {
      prisma.actionCard.findFirst.mockResolvedValue({ id: 'card1', businessId: 'biz1' } as any);
      prisma.agentFeedback.create.mockResolvedValue({
        id: 'fb1',
        rating: 'NOT_HELPFUL',
      } as any);

      const result = await service.submitFeedback('biz1', 'card1', 'staff1', {
        rating: 'NOT_HELPFUL',
      });

      expect(result.rating).toBe('NOT_HELPFUL');
    });
  });

  describe('getFeedbackForCard', () => {
    it('returns feedback with staff info', async () => {
      prisma.agentFeedback.findMany.mockResolvedValue([
        {
          id: 'fb1',
          rating: 'HELPFUL',
          staff: { id: 'staff1', name: 'Sarah' },
        },
      ] as any);

      const result = await service.getFeedbackForCard('biz1', 'card1');

      expect(result).toHaveLength(1);
      expect(prisma.agentFeedback.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', actionCardId: 'card1' },
        include: { staff: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('returns empty array when no feedback', async () => {
      prisma.agentFeedback.findMany.mockResolvedValue([]);

      const result = await service.getFeedbackForCard('biz1', 'card1');

      expect(result).toHaveLength(0);
    });
  });

  describe('getStats', () => {
    it('returns aggregated stats', async () => {
      prisma.agentFeedback.findMany.mockResolvedValue([
        { rating: 'HELPFUL', actionCard: { type: 'WAITLIST_MATCH' } },
        { rating: 'HELPFUL', actionCard: { type: 'WAITLIST_MATCH' } },
        { rating: 'NOT_HELPFUL', actionCard: { type: 'RETENTION_DUE' } },
        { rating: 'HELPFUL', actionCard: { type: 'RETENTION_DUE' } },
      ] as any);

      const stats = await service.getStats('biz1');

      expect(stats.total).toBe(4);
      expect(stats.helpful).toBe(3);
      expect(stats.notHelpful).toBe(1);
      expect(stats.helpfulRate).toBe(75);
      expect(stats.byType.WAITLIST_MATCH).toEqual({ helpful: 2, notHelpful: 0, total: 2 });
      expect(stats.byType.RETENTION_DUE).toEqual({ helpful: 1, notHelpful: 1, total: 2 });
    });

    it('returns zero rate when no feedback', async () => {
      prisma.agentFeedback.findMany.mockResolvedValue([]);

      const stats = await service.getStats('biz1');

      expect(stats.total).toBe(0);
      expect(stats.helpfulRate).toBe(0);
    });

    it('filters by agentType', async () => {
      prisma.agentFeedback.findMany.mockResolvedValue([]);

      await service.getStats('biz1', { agentType: 'WAITLIST_MATCH' });

      expect(prisma.agentFeedback.findMany).toHaveBeenCalledWith({
        where: { businessId: 'biz1', actionCard: { type: 'WAITLIST_MATCH' } },
        include: { actionCard: { select: { type: true } } },
      });
    });

    it('filters by date range', async () => {
      prisma.agentFeedback.findMany.mockResolvedValue([]);
      const from = new Date('2026-01-01');
      const to = new Date('2026-02-01');

      await service.getStats('biz1', { from, to });

      expect(prisma.agentFeedback.findMany).toHaveBeenCalledWith({
        where: {
          businessId: 'biz1',
          createdAt: { gte: from, lte: to },
        },
        include: { actionCard: { select: { type: true } } },
      });
    });
  });

  describe('deleteFeedback', () => {
    it('deletes own feedback', async () => {
      prisma.agentFeedback.findFirst.mockResolvedValue({
        id: 'fb1',
        staffId: 'staff1',
      } as any);
      prisma.agentFeedback.delete.mockResolvedValue({} as any);

      const result = await service.deleteFeedback('biz1', 'fb1', 'staff1');

      expect(result).toEqual({ deleted: true });
      expect(prisma.agentFeedback.delete).toHaveBeenCalledWith({ where: { id: 'fb1' } });
    });

    it('throws NotFoundException when feedback not found', async () => {
      prisma.agentFeedback.findFirst.mockResolvedValue(null);

      await expect(service.deleteFeedback('biz1', 'fb1', 'staff1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
