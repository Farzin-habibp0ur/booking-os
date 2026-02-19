import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';

@Injectable()
export class AgentFeedbackService {
  private readonly logger = new Logger(AgentFeedbackService.name);

  constructor(private prisma: PrismaService) {}

  async submitFeedback(
    businessId: string,
    actionCardId: string,
    staffId: string,
    data: { rating: string; comment?: string },
  ) {
    // Verify action card exists and belongs to business
    const card = await this.prisma.actionCard.findFirst({
      where: { id: actionCardId, businessId },
    });

    if (!card) throw new NotFoundException('Action card not found');

    try {
      const feedback = await this.prisma.agentFeedback.create({
        data: {
          businessId,
          actionCardId,
          staffId,
          rating: data.rating,
          comment: data.comment,
        },
      });

      this.logger.log(
        `Feedback submitted: card=${actionCardId} staff=${staffId} rating=${data.rating}`,
      );
      return feedback;
    } catch (err: any) {
      if (err.code === 'P2002') {
        throw new ConflictException('Feedback already submitted for this action card');
      }
      throw err;
    }
  }

  async getFeedbackForCard(businessId: string, actionCardId: string) {
    return this.prisma.agentFeedback.findMany({
      where: { businessId, actionCardId },
      include: { staff: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getStats(businessId: string, filters?: { agentType?: string; from?: Date; to?: Date }) {
    const where: any = { businessId };

    if (filters?.from || filters?.to) {
      where.createdAt = {};
      if (filters.from) where.createdAt.gte = filters.from;
      if (filters.to) where.createdAt.lte = filters.to;
    }

    if (filters?.agentType) {
      where.actionCard = { type: filters.agentType };
    }

    const feedback = await this.prisma.agentFeedback.findMany({
      where,
      include: { actionCard: { select: { type: true } } },
    });

    const total = feedback.length;
    const helpful = feedback.filter((f) => f.rating === 'HELPFUL').length;
    const notHelpful = feedback.filter((f) => f.rating === 'NOT_HELPFUL').length;

    // Group by action card type
    const byType: Record<string, { helpful: number; notHelpful: number; total: number }> = {};
    for (const f of feedback) {
      const type = f.actionCard.type;
      if (!byType[type]) byType[type] = { helpful: 0, notHelpful: 0, total: 0 };
      byType[type].total++;
      if (f.rating === 'HELPFUL') byType[type].helpful++;
      else byType[type].notHelpful++;
    }

    return {
      total,
      helpful,
      notHelpful,
      helpfulRate: total > 0 ? Math.round((helpful / total) * 100) : 0,
      byType,
    };
  }

  async deleteFeedback(businessId: string, feedbackId: string, staffId: string) {
    const feedback = await this.prisma.agentFeedback.findFirst({
      where: { id: feedbackId, businessId, staffId },
    });

    if (!feedback) throw new NotFoundException('Feedback not found');

    await this.prisma.agentFeedback.delete({ where: { id: feedbackId } });
    return { deleted: true };
  }
}
