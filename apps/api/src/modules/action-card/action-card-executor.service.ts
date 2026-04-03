import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';
import { OutboundService } from '../outbound/outbound.service';
import { CustomerIdentityService } from '../customer-identity/customer-identity.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';

export interface ExecutionResult {
  success: boolean;
  action: string;
  draftId?: string;
  conversationId?: string;
  error?: string;
}

@Injectable()
export class ActionCardExecutorService {
  private readonly logger = new Logger(ActionCardExecutorService.name);

  constructor(
    private prisma: PrismaService,
    private outboundService: OutboundService,
    private customerIdentityService: CustomerIdentityService,
    private inboxGateway: InboxGateway,
    @Optional() @InjectQueue(QUEUE_NAMES.AI_PROCESSING) private aiQueue?: Queue,
  ) {}

  async executeCta(
    businessId: string,
    actionCard: any,
    ctaAction: string,
    staffId: string,
  ): Promise<ExecutionResult> {
    this.logger.log(
      `Executing CTA "${ctaAction}" on card ${actionCard.id} (type: ${actionCard.type})`,
    );

    switch (ctaAction) {
      case 'send_followup':
        return this.handleSendFollowup(businessId, actionCard, staffId);
      case 'offer_slot':
        return this.handleOfferSlot(businessId, actionCard, staffId);
      case 'retry_ai':
        return this.handleRetryAi(businessId, actionCard);
      case 'reply_manually':
        return this.handleReplyManually(businessId, actionCard);
      case 'check_waitlist':
        return this.handleCheckWaitlist(businessId, actionCard);
      case 'merge':
        return this.handleMerge(businessId, actionCard);
      case 'dismiss':
        return { success: true, action: 'dismiss' };
      default:
        this.logger.warn(`Unknown CTA action: ${ctaAction}`);
        return { success: false, action: ctaAction, error: `Unknown action: ${ctaAction}` };
    }
  }

  private async handleSendFollowup(
    businessId: string,
    actionCard: any,
    staffId: string,
  ): Promise<ExecutionResult> {
    const customerId = actionCard.customerId;
    if (!customerId) {
      return { success: false, action: 'send_followup', error: 'No customer linked to card' };
    }

    // Get customer data
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) {
      return { success: false, action: 'send_followup', error: 'Customer not found' };
    }

    // Determine best channel and find/create conversation
    const channel = await this.determineBestChannel(businessId, customerId);
    const conversation = await this.findOrCreateConversation(businessId, customerId, channel);

    if (!conversation) {
      return {
        success: false,
        action: 'send_followup',
        error: 'Could not find or create conversation',
      };
    }

    // Use pre-generated message from card metadata if available
    const metadata = (actionCard.metadata as any) || {};
    const suggestedMessages = metadata.suggestedMessages;
    let content: string;

    if (suggestedMessages) {
      // Pick message for the chosen channel, or use DEFAULT
      const channelKey = channel.toUpperCase();
      const channelMsg = suggestedMessages[channelKey];
      if (typeof channelMsg === 'string') {
        content = channelMsg;
      } else if (channelMsg?.body) {
        content = channelMsg.body; // Email format with subject+body
      } else {
        content = suggestedMessages.DEFAULT || this.generateFallbackMessage(actionCard, customer);
      }
    } else {
      content = this.generateFallbackMessage(actionCard, customer);
    }

    // Create OutboundDraft (never auto-send)
    try {
      const draft = await this.outboundService.createAiDraft({
        businessId,
        customerId,
        staffId,
        conversationId: conversation.id,
        channel,
        content,
        source: 'AGENT',
        intent: actionCard.type,
        metadata: {
          sourceActionCardId: actionCard.id,
          actionCardType: actionCard.type,
          generatedAt: new Date().toISOString(),
        },
      });

      // Emit event for inbox to navigate to conversation with draft loaded
      this.inboxGateway.emitToBusinessRoom(businessId, 'draft:review-requested', {
        conversationId: conversation.id,
        draftId: draft.id,
        actionCardId: actionCard.id,
        channel,
        customerName: customer.name,
      });

      return {
        success: true,
        action: 'send_followup',
        draftId: draft.id,
        conversationId: conversation.id,
      };
    } catch (err: any) {
      this.logger.error(`Failed to create follow-up draft: ${err.message}`);
      return { success: false, action: 'send_followup', error: err.message };
    }
  }

  private async handleOfferSlot(
    businessId: string,
    actionCard: any,
    staffId: string,
  ): Promise<ExecutionResult> {
    const customerId = actionCard.customerId;
    if (!customerId) {
      return { success: false, action: 'offer_slot', error: 'No customer linked to card' };
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) {
      return { success: false, action: 'offer_slot', error: 'Customer not found' };
    }

    const channel = await this.determineBestChannel(businessId, customerId);
    const conversation = await this.findOrCreateConversation(businessId, customerId, channel);
    if (!conversation) {
      return { success: false, action: 'offer_slot', error: 'Could not find conversation' };
    }

    // Use pre-generated message or generate one from card metadata
    const metadata = (actionCard.metadata as any) || {};
    const suggestedMessages = metadata.suggestedMessages;
    let content: string;

    if (suggestedMessages) {
      const channelKey = channel.toUpperCase();
      content =
        (typeof suggestedMessages[channelKey] === 'string'
          ? suggestedMessages[channelKey]
          : suggestedMessages[channelKey]?.body) ||
        suggestedMessages.DEFAULT ||
        `Great news, ${customer.name}! A slot has opened up. Would you like to book it?`;
    } else {
      const preview = (actionCard.preview as any) || {};
      const slots = preview.slots || [];
      const topSlot = slots[0];
      content = topSlot
        ? `Great news, ${customer.name}! A slot opened up on ${topSlot.time}${topSlot.staffName ? ` with ${topSlot.staffName}` : ''}. Would you like to book it?`
        : `Great news, ${customer.name}! A slot has opened up. Would you like to book it?`;
    }

    try {
      const draft = await this.outboundService.createAiDraft({
        businessId,
        customerId,
        staffId,
        conversationId: conversation.id,
        channel,
        content,
        source: 'AGENT',
        intent: 'WAITLIST_MATCH',
        metadata: {
          sourceActionCardId: actionCard.id,
          actionCardType: actionCard.type,
          generatedAt: new Date().toISOString(),
        },
      });

      this.inboxGateway.emitToBusinessRoom(businessId, 'draft:review-requested', {
        conversationId: conversation.id,
        draftId: draft.id,
        actionCardId: actionCard.id,
        channel,
        customerName: customer.name,
      });

      return {
        success: true,
        action: 'offer_slot',
        draftId: draft.id,
        conversationId: conversation.id,
      };
    } catch (err: any) {
      this.logger.error(`Failed to create slot offer draft: ${err.message}`);
      return { success: false, action: 'offer_slot', error: err.message };
    }
  }

  private async handleRetryAi(businessId: string, actionCard: any): Promise<ExecutionResult> {
    const metadata = (actionCard.metadata as any) || {};
    const messageId = metadata.messageId;
    const conversationId = actionCard.conversationId;

    if (!messageId || !conversationId) {
      return {
        success: false,
        action: 'retry_ai',
        error: 'Missing messageId or conversationId for retry',
      };
    }

    // Get the original message content
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
      select: { content: true },
    });

    if (!message) {
      return { success: false, action: 'retry_ai', error: 'Original message not found' };
    }

    if (this.aiQueue) {
      await this.aiQueue.add(
        'process-inbound',
        {
          businessId,
          conversationId,
          messageId,
          messageBody: message.content,
          channel: metadata.channel,
          customerId: actionCard.customerId,
        },
        {
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: 100,
          removeOnFail: false,
        },
      );

      return { success: true, action: 'retry_ai', conversationId };
    } else {
      return {
        success: false,
        action: 'retry_ai',
        error: 'AI processing queue not available',
      };
    }
  }

  private async handleReplyManually(businessId: string, actionCard: any): Promise<ExecutionResult> {
    const conversationId = actionCard.conversationId;
    if (conversationId) {
      this.inboxGateway.emitToBusinessRoom(businessId, 'conversation:focus', {
        conversationId,
      });
    }
    return { success: true, action: 'reply_manually', conversationId };
  }

  private async determineBestChannel(businessId: string, customerId: string): Promise<string> {
    // Find the most recent conversation channel for this customer
    const recentConversation = await this.prisma.conversation.findFirst({
      where: { businessId, customerId, status: { in: ['OPEN', 'WAITING'] } },
      orderBy: { lastMessageAt: 'desc' },
      select: { channel: true },
    });

    if (recentConversation) return recentConversation.channel;

    // Check available channels from customer identity
    try {
      const channels = await this.customerIdentityService.getCustomerChannels(customerId);
      if (channels.phone) return 'WHATSAPP';
      if (channels.email) return 'EMAIL';
      if (channels.facebookPsid) return 'FACEBOOK';
      if (channels.instagramUserId) return 'INSTAGRAM';
    } catch {
      // Ignore — fall through to default
    }

    return 'WHATSAPP';
  }

  private async findOrCreateConversation(
    businessId: string,
    customerId: string,
    channel: string,
  ): Promise<{ id: string; channel: string } | null> {
    // Try to find existing conversation
    const existing = await this.prisma.conversation.findFirst({
      where: { businessId, customerId, channel, status: { in: ['OPEN', 'WAITING', 'RESOLVED'] } },
      orderBy: { lastMessageAt: 'desc' },
      select: { id: true, channel: true },
    });

    if (existing) return existing;

    // Create new conversation
    try {
      const created = await this.prisma.conversation.create({
        data: { businessId, customerId, channel, status: 'OPEN' },
        select: { id: true, channel: true },
      });
      return created;
    } catch (err: any) {
      this.logger.error(`Failed to create conversation: ${err.message}`);
      return null;
    }
  }

  // FIX-05: check_waitlist — find ACTIVE waitlist entries that match a scheduling gap
  private async handleCheckWaitlist(businessId: string, actionCard: any): Promise<ExecutionResult> {
    const metadata = (actionCard.metadata as any) || {};
    const gapDate = metadata.date;
    const gapStaffId = metadata.staffId;

    if (!gapDate) {
      return { success: false, action: 'check_waitlist', error: 'No date in card metadata' };
    }

    const entries = await this.prisma.waitlistEntry.findMany({
      where: {
        businessId,
        status: 'ACTIVE',
        AND: [
          ...(gapStaffId ? [{ OR: [{ staffId: gapStaffId }, { staffId: null }] }] : []),
          {
            OR: [
              { dateFrom: null },
              { dateFrom: { lte: new Date(gapDate) }, dateTo: { gte: new Date(gapDate) } },
            ],
          },
        ],
      },
      include: { customer: true, service: true },
      take: 10,
    });

    if (entries.length === 0) {
      return {
        success: true,
        action: 'check_waitlist',
        error: 'No matching waitlist entries found',
      };
    }

    this.inboxGateway.emitToBusinessRoom(businessId, 'action-card:updated', {
      actionCardId: actionCard.id,
      waitlistMatches: entries.map((e: any) => ({
        id: e.id,
        customerName: e.customer.name,
        serviceName: e.service.name,
        customerId: e.customerId,
      })),
    });

    return { success: true, action: 'check_waitlist' };
  }

  // FIX-06: merge — re-point all relations from secondary customer to primary, then soft-delete
  private async handleMerge(businessId: string, actionCard: any): Promise<ExecutionResult> {
    const preview = (actionCard.preview as any) || {};
    const primaryId = preview.customer1?.id;
    const secondaryId = preview.customer2?.id;

    if (!primaryId || !secondaryId) {
      return { success: false, action: 'merge', error: 'Missing customer IDs for merge' };
    }

    const [primary, secondary] = await Promise.all([
      this.prisma.customer.findFirst({ where: { id: primaryId, businessId } }),
      this.prisma.customer.findFirst({ where: { id: secondaryId, businessId } }),
    ]);

    if (!primary || !secondary) {
      return { success: false, action: 'merge', error: 'One or both customers not found' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.booking.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });
      await tx.conversation.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });
      await tx.actionCard.updateMany({
        where: { customerId: secondaryId, businessId },
        data: { customerId: primaryId },
      });

      const primaryTags = (primary.tags || []) as string[];
      const secondaryTags = (secondary.tags || []) as string[];
      const mergedTags = [...new Set([...primaryTags, ...secondaryTags])];

      await tx.customer.update({
        where: { id: primaryId },
        data: {
          tags: mergedTags,
          ...(!primary.email && secondary.email && { email: secondary.email }),
          ...(!primary.phone && secondary.phone && { phone: secondary.phone }),
        },
      });

      await tx.customer.update({
        where: { id: secondaryId },
        data: { deletedAt: new Date() },
      });
    });

    return { success: true, action: 'merge' };
  }

  private generateFallbackMessage(actionCard: any, customer: any): string {
    const name = customer?.name || 'there';
    const type = actionCard.type;

    if (type === 'RETENTION_DUE') {
      const preview = (actionCard.preview as any) || {};
      return `Hi ${name}, it's been a while since your last visit${preview.lastServiceName ? ` for ${preview.lastServiceName}` : ''}. We'd love to see you again! Would you like to book an appointment?`;
    }

    if (type === 'STALLED_QUOTE') {
      const metadata = (actionCard.metadata as any) || {};
      const amount = metadata.totalAmount ? `$${(metadata.totalAmount / 100).toFixed(2)}` : '';
      return `Hi ${name}, just following up on your quote${amount ? ` for ${amount}` : ''}. Would you like to proceed? Let me know if you have any questions.`;
    }

    return `Hi ${name}, we wanted to follow up with you. Please let us know if there's anything we can help with!`;
  }
}
