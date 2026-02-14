import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { InboxGateway } from '../../common/inbox.gateway';

@Injectable()
export class MessageService {
  constructor(
    private prisma: PrismaService,
    private inboxGateway: InboxGateway,
  ) {}

  async sendMessage(
    businessId: string,
    conversationId: string,
    staffId: string,
    content: string,
    provider: { sendMessage: (msg: any) => Promise<{ externalId: string }> },
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
      include: { customer: true },
    });
    if (!conversation) throw new Error('Conversation not found');

    // Send via provider
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
      include: { senderStaff: { select: { id: true, name: true } } },
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
}
