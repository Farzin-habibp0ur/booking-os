import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ActionCardService } from '../action-card/action-card.service';
import { InboxGateway } from '../../common/inbox.gateway';

@Injectable()
export class HumanTakeoverService {
  private readonly logger = new Logger(HumanTakeoverService.name);

  constructor(
    private prisma: PrismaService,
    private actionCardService: ActionCardService,
    private inboxGateway: InboxGateway,
  ) {}

  async inititateTakeover(
    businessId: string,
    conversationId: string,
    reason: string,
    customerId?: string,
    customerName?: string,
  ) {
    try {
      // Mark conversation as transferred
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, businessId },
      });
      if (!conversation) return null;

      const metadata = (conversation.metadata as any) || {};
      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          metadata: {
            ...metadata,
            transferredToHuman: true,
            transferredAt: new Date().toISOString(),
            transferReason: reason,
          },
        },
      });

      // Create urgent action card
      const card = await this.actionCardService.create({
        businessId,
        type: 'HUMAN_TAKEOVER',
        category: 'URGENT_TODAY',
        priority: 95,
        title: `Human takeover: ${customerName || 'Customer'}`,
        description: `Because ${reason}. The AI has paused all automatic responses for this conversation.`,
        suggestedAction: 'Review the conversation and respond manually',
        conversationId,
        customerId,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
        metadata: { reason, source: 'human-takeover' },
      });

      // Emit WebSocket event for real-time banner
      this.inboxGateway.emitToBusinessRoom(businessId, 'conversation:takeover', {
        conversationId,
        reason,
        cardId: card.id,
      });

      return card;
    } catch (err: any) {
      this.logger.error(
        `Failed to initiate takeover for conversation ${conversationId}: ${err.message}`,
      );
      return null;
    }
  }

  async resolveTakeover(businessId: string, conversationId: string, staffId: string) {
    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, businessId },
      });
      if (!conversation) return null;

      const metadata = (conversation.metadata as any) || {};
      if (!metadata.transferredToHuman) return null;

      await this.prisma.conversation.update({
        where: { id: conversationId },
        data: {
          metadata: {
            ...metadata,
            transferredToHuman: false,
            resolvedAt: new Date().toISOString(),
            resolvedBy: staffId,
          },
          assignedToId: staffId,
        },
      });

      // Dismiss any pending takeover cards
      const pendingCards = await this.prisma.actionCard.findMany({
        where: {
          businessId,
          conversationId,
          type: 'HUMAN_TAKEOVER',
          status: 'PENDING',
        },
      });

      for (const card of pendingCards) {
        await this.actionCardService.dismiss(businessId, card.id, staffId);
      }

      this.inboxGateway.emitToBusinessRoom(businessId, 'conversation:takeover-resolved', {
        conversationId,
        staffId,
      });

      return { resolved: true, conversationId };
    } catch (err: any) {
      this.logger.error(
        `Failed to resolve takeover for conversation ${conversationId}: ${err.message}`,
      );
      return null;
    }
  }

  async isConversationTakenOver(businessId: string, conversationId: string): Promise<boolean> {
    try {
      const conversation = await this.prisma.conversation.findFirst({
        where: { id: conversationId, businessId },
      });
      const metadata = (conversation?.metadata as any) || {};
      return !!metadata.transferredToHuman;
    } catch {
      return false;
    }
  }
}
