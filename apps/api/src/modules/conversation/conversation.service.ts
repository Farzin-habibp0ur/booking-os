import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/prisma.service';

// Default SLA: 10 minutes
const DEFAULT_SLA_MINUTES = 10;

@Injectable()
export class ConversationService {
  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleSnoozedConversations() {
    const count = await this.unsnoozeOverdue();
    if (count > 0) {
      console.log(`[Snooze] Reopened ${count} snoozed conversation(s)`);
    }
  }

  async findAll(
    businessId: string,
    query: {
      status?: string;
      assignedToId?: string;
      unassigned?: boolean;
      search?: string;
      filter?: string;
      locationId?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: any = { businessId };

    // Location filter
    if (query.locationId) {
      where.locationId = query.locationId;
    }

    // Named filters
    if (query.filter) {
      switch (query.filter) {
        case 'unassigned':
          where.assignedToId = null;
          where.status = { not: 'RESOLVED' };
          break;
        case 'overdue':
          where.status = 'OPEN';
          where.metadata = { path: ['isOverdue'], equals: true };
          break;
        case 'waiting':
          where.status = 'WAITING';
          break;
        case 'snoozed':
          where.status = 'SNOOZED';
          break;
        case 'closed':
          where.status = 'RESOLVED';
          break;
        case 'mine':
          // assignedToId will be set by the controller
          if (query.assignedToId) where.assignedToId = query.assignedToId;
          where.status = { not: 'RESOLVED' };
          break;
        default:
          // 'all' or unknown — show all non-resolved
          where.status = { not: 'RESOLVED' };
          break;
      }
    } else {
      // Legacy: direct params
      if (query.status) where.status = query.status;
      if (query.assignedToId) where.assignedToId = query.assignedToId;
      if (query.unassigned) where.assignedToId = null;
    }

    // Search by customer name or phone
    if (query.search) {
      where.customer = {
        OR: [
          { name: { contains: query.search, mode: 'insensitive' } },
          { phone: { contains: query.search } },
        ],
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          customer: true,
          assignedTo: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
          messages: { take: 1, orderBy: { createdAt: 'desc' } },
          bookings: {
            where: { status: { in: ['PENDING', 'CONFIRMED'] } },
            take: 1,
            orderBy: { startTime: 'asc' },
            include: { service: true },
          },
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { lastMessageAt: 'desc' },
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Compute overdue flag on each conversation
    const enriched = data.map((c: any) => ({
      ...c,
      isOverdue: this.isOverdue(c),
      isNew: this.isNew(c),
    }));

    return { data: enriched, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async getFilterCounts(businessId: string, staffId?: string) {
    const base = { businessId };

    const [all, unassigned, mine, overdue, waiting, snoozed, closed] = await Promise.all([
      this.prisma.conversation.count({
        where: { ...base, status: { notIn: ['RESOLVED', 'SNOOZED'] } },
      }),
      this.prisma.conversation.count({
        where: { ...base, assignedToId: null, status: { notIn: ['RESOLVED', 'SNOOZED'] } },
      }),
      staffId
        ? this.prisma.conversation.count({
            where: { ...base, assignedToId: staffId, status: { notIn: ['RESOLVED', 'SNOOZED'] } },
          })
        : Promise.resolve(0),
      this.countOverdue(businessId),
      this.prisma.conversation.count({ where: { ...base, status: 'WAITING' } }),
      this.prisma.conversation.count({ where: { ...base, status: 'SNOOZED' } }),
      this.prisma.conversation.count({ where: { ...base, status: 'RESOLVED' } }),
    ]);

    return { all, unassigned, mine, overdue, waiting, snoozed, closed };
  }

  private async countOverdue(businessId: string): Promise<number> {
    const slaThreshold = new Date(Date.now() - DEFAULT_SLA_MINUTES * 60 * 1000);
    // Conversations that are OPEN, have a lastMessageAt before SLA threshold,
    // and the last message was inbound (no staff reply yet)
    const openConversations = await this.prisma.conversation.findMany({
      where: {
        businessId,
        status: 'OPEN',
        lastMessageAt: { lt: slaThreshold },
      },
      select: { id: true },
    });
    return openConversations.length;
  }

  private isOverdue(conversation: any): boolean {
    if (conversation.status !== 'OPEN') return false;
    if (!conversation.lastMessageAt) return false;
    const slaThreshold = new Date(Date.now() - DEFAULT_SLA_MINUTES * 60 * 1000);
    return new Date(conversation.lastMessageAt) < slaThreshold;
  }

  private isNew(conversation: any): boolean {
    // A conversation is "new" if it has no outbound messages
    // We check if the latest message is inbound and there's no staff reply
    const lastMsg = conversation.messages?.[0];
    if (!lastMsg) return false;
    return lastMsg.direction === 'INBOUND' && !conversation.assignedToId;
  }

  async findById(businessId: string, id: string) {
    return this.prisma.conversation.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        assignedTo: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
      },
    });
  }

  async findOrCreate(
    businessId: string,
    customerId: string,
    channel: string = 'WHATSAPP',
    locationId?: string,
  ) {
    // First try to find an active (non-resolved) conversation
    let conversation = await this.prisma.conversation.findFirst({
      where: { businessId, customerId, channel, status: { not: 'RESOLVED' } },
    });
    if (conversation) {
      // Update locationId if provided and not already set
      if (locationId && !conversation.locationId) {
        conversation = await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { locationId },
        });
      }
      return conversation;
    }

    // If no active conversation, try to reopen the most recent resolved one
    const resolved = await this.prisma.conversation.findFirst({
      where: { businessId, customerId, channel, status: 'RESOLVED' },
      orderBy: { updatedAt: 'desc' },
    });
    if (resolved) {
      conversation = await this.prisma.conversation.update({
        where: { id: resolved.id },
        data: { status: 'OPEN', ...(locationId && { locationId }) },
      });
      return conversation;
    }

    // No conversation at all — create new
    conversation = await this.prisma.conversation.create({
      data: { businessId, customerId, channel, status: 'OPEN', ...(locationId && { locationId }) },
    });
    return conversation;
  }

  // --- Snooze ---
  async snooze(businessId: string, id: string, until: Date) {
    return this.prisma.conversation.update({
      where: { id, businessId },
      data: { status: 'SNOOZED', snoozedUntil: until },
      include: { customer: true, assignedTo: { select: { id: true, name: true } } },
    });
  }

  async unsnoozeOverdue() {
    const now = new Date();
    const snoozed = await this.prisma.conversation.findMany({
      where: { status: 'SNOOZED', snoozedUntil: { lte: now } },
    });
    for (const c of snoozed) {
      await this.prisma.conversation.update({
        where: { id: c.id },
        data: { status: 'OPEN', snoozedUntil: null },
      });
    }
    return snoozed.length;
  }

  // --- Notes (tenant-scoped) ---
  async getNotes(businessId: string, conversationId: string) {
    // Verify the conversation belongs to this business
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) return [];

    return this.prisma.conversationNote.findMany({
      where: { conversationId },
      include: { staff: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addNote(businessId: string, conversationId: string, staffId: string, content: string) {
    // Verify the conversation belongs to this business
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) throw new Error('Conversation not found');

    return this.prisma.conversationNote.create({
      data: { conversationId, staffId, content },
      include: { staff: { select: { id: true, name: true } } },
    });
  }

  async deleteNote(businessId: string, conversationId: string, noteId: string) {
    // Verify the conversation belongs to this business
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) throw new Error('Conversation not found');

    return this.prisma.conversationNote.delete({ where: { id: noteId } });
  }

  // --- Tags ---
  async updateTags(businessId: string, id: string, tags: string[]) {
    return this.prisma.conversation.update({
      where: { id, businessId },
      data: { tags },
      include: { customer: true, assignedTo: { select: { id: true, name: true } } },
    });
  }

  async assign(businessId: string, id: string, staffId: string | null) {
    return this.prisma.conversation.update({
      where: { id, businessId },
      data: { assignedToId: staffId },
      include: { customer: true, assignedTo: { select: { id: true, name: true } } },
    });
  }

  async updateStatus(businessId: string, id: string, status: string) {
    return this.prisma.conversation.update({
      where: { id, businessId },
      data: { status },
      include: { customer: true, assignedTo: { select: { id: true, name: true } } },
    });
  }

  async getMessages(businessId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: { id: conversationId, businessId },
    });
    if (!conversation) return [];

    return this.prisma.message.findMany({
      where: { conversationId },
      include: { senderStaff: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}
