import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';

@Injectable()
export class MessageService {
  private readonly logger = new Logger(MessageService.name);

  constructor(
    private prisma: PrismaService,
    private inboxGateway: InboxGateway,
    @InjectQueue('messaging') private messagingQueue: Queue,
  ) {}

  async sendMessage(
    businessId: string,
    conversationId: string,
    staffId: string,
    content: string,
    provider: { sendMessage: (msg: any) => Promise<{ externalId: string }> },
    scheduledFor?: Date,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
      include: { customer: true },
    });
    if (!conversation) throw new Error('Conversation not found');

    // If scheduling for the future
    if (scheduledFor && scheduledFor.getTime() > Date.now()) {
      const message = await this.prisma.message.create({
        data: {
          conversationId,
          direction: 'OUTBOUND',
          senderStaffId: staffId,
          content,
          contentType: 'TEXT',
          deliveryStatus: 'SCHEDULED',
          scheduledFor,
        },
        include: {
          senderStaff: { select: { id: true, name: true } },
          attachments: true,
        },
      });

      // Create delayed BullMQ job
      const delay = scheduledFor.getTime() - Date.now();
      const job = await this.messagingQueue.add(
        'scheduled-message',
        { messageId: message.id, businessId },
        { delay },
      );

      // Store job ID for cancellation
      await this.prisma.message.update({
        where: { id: message.id },
        data: { scheduledJobId: job.id },
      });

      return { ...message, scheduledJobId: job.id };
    }

    // Send immediately via provider
    const { externalId } = await provider.sendMessage({
      to: conversation.customer.phone,
      body: content,
      businessId,
      conversationId,
    });

    // Store message
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'OUTBOUND',
        senderStaffId: staffId,
        content,
        contentType: 'TEXT',
        externalId,
      },
      include: {
        senderStaff: { select: { id: true, name: true } },
        attachments: true,
      },
    });

    // Auto-transition: set to WAITING (waiting for customer reply)
    // Also auto-assign if unassigned
    const updateData: any = {
      lastMessageAt: new Date(),
      status: 'WAITING',
    };
    if (!conversation.assignedToId) {
      updateData.assignedToId = staffId;
    }

    const updated = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: updateData,
      include: {
        customer: true,
        assignedTo: { select: { id: true, name: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    // Notify via WebSocket
    this.inboxGateway.notifyNewMessage(businessId, message);
    this.inboxGateway.notifyConversationUpdate(businessId, updated);

    return message;
  }

  async getScheduledMessages(businessId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) return [];

    return this.prisma.message.findMany({
      where: {
        conversationId,
        deliveryStatus: 'SCHEDULED',
        scheduledFor: { not: null },
      },
      include: {
        senderStaff: { select: { id: true, name: true } },
      },
      orderBy: { scheduledFor: 'asc' },
    });
  }

  async cancelScheduledMessage(businessId: string, conversationId: string, messageId: string) {
    const message = await this.prisma.message.findFirst({
      where: {
        id: messageId,
        conversationId,
        deliveryStatus: 'SCHEDULED',
        conversation: { businessId },
      },
    });
    if (!message) throw new NotFoundException('Scheduled message not found');

    // Remove BullMQ job if exists
    if (message.scheduledJobId) {
      try {
        const job = await this.messagingQueue.getJob(message.scheduledJobId);
        if (job) await job.remove();
      } catch (err) {
        this.logger.warn(
          `Failed to remove scheduled job ${message.scheduledJobId}: ${(err as Error).message}`,
        );
      }
    }

    // Mark as cancelled
    return this.prisma.message.update({
      where: { id: messageId },
      data: { deliveryStatus: 'CANCELLED' },
    });
  }

  async receiveInbound(
    businessId: string,
    conversationId: string,
    content: string,
    externalId?: string,
  ) {
    const message = await this.prisma.message.create({
      data: {
        conversationId,
        direction: 'INBOUND',
        content,
        contentType: 'TEXT',
        externalId,
      },
    });

    // Auto-transition: reopen conversation (even if RESOLVED or WAITING)
    const conversation = await this.prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), status: 'OPEN' },
      include: {
        customer: true,
        assignedTo: { select: { id: true, name: true } },
        messages: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    // Notify via WebSocket
    this.inboxGateway.notifyNewMessage(businessId, message);
    this.inboxGateway.notifyConversationUpdate(businessId, conversation);

    return message;
  }

  async updateDeliveryStatus(
    externalId: string,
    status: 'DELIVERED' | 'READ' | 'FAILED',
    failureReason?: string,
  ) {
    const message = await this.prisma.message.findUnique({
      where: { externalId },
      include: { conversation: { select: { businessId: true } } },
    });

    if (!message) {
      this.logger.warn(`Message not found for delivery status update: ${externalId}`);
      return null;
    }

    const updateData: any = { deliveryStatus: status };
    if (status === 'DELIVERED') {
      updateData.deliveredAt = new Date();
    } else if (status === 'READ') {
      updateData.readAt = new Date();
      if (!message.deliveredAt) {
        updateData.deliveredAt = new Date();
      }
    } else if (status === 'FAILED') {
      updateData.failureReason = failureReason || 'Unknown error';
    }

    const updated = await this.prisma.message.update({
      where: { id: message.id },
      data: updateData,
    });

    // Notify via WebSocket
    const businessId = (message as any).conversation?.businessId;
    if (businessId) {
      this.inboxGateway.emitToBusinessRoom(businessId, 'message:status', {
        messageId: message.id,
        conversationId: message.conversationId,
        deliveryStatus: status,
        deliveredAt: updateData.deliveredAt,
        readAt: updateData.readAt,
        failureReason: updateData.failureReason,
      });
    }

    return updated;
  }
}
