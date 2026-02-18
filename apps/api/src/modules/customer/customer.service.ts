import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ProfileExtractor } from '../ai/profile-extractor';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private prisma: PrismaService,
    private profileExtractor: ProfileExtractor,
  ) {}

  async findAll(businessId: string, query: { search?: string; page?: number; pageSize?: number }) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 20;
    const where: any = { businessId };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(businessId: string, id: string) {
    return this.prisma.customer.findFirst({ where: { id, businessId } });
  }

  async findOrCreateByPhone(businessId: string, phone: string, name?: string) {
    let customer = await this.prisma.customer.findFirst({ where: { businessId, phone } });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: { businessId, phone, name: name || phone },
      });
    }
    return customer;
  }

  async create(
    businessId: string,
    data: { name: string; phone: string; email?: string; tags?: string[]; customFields?: any },
  ) {
    return this.prisma.customer.create({ data: { businessId, ...data } });
  }

  async update(
    businessId: string,
    id: string,
    data: { name?: string; phone?: string; email?: string; tags?: string[]; customFields?: any },
  ) {
    return this.prisma.customer.update({ where: { id, businessId }, data });
  }

  // ─── Customer Notes CRUD ────────────────────────────────────────────

  async getNotes(businessId: string, customerId: string) {
    return this.prisma.customerNote.findMany({
      where: { businessId, customerId },
      include: { staff: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createNote(businessId: string, customerId: string, staffId: string, content: string) {
    if (!content?.trim()) {
      throw new BadRequestException('Note content cannot be empty');
    }
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) {
      throw new NotFoundException('Customer not found');
    }
    return this.prisma.customerNote.create({
      data: { businessId, customerId, staffId, content: content.trim() },
      include: { staff: { select: { id: true, name: true } } },
    });
  }

  async updateNote(businessId: string, noteId: string, staffId: string, content: string) {
    if (!content?.trim()) {
      throw new BadRequestException('Note content cannot be empty');
    }
    const note = await this.prisma.customerNote.findFirst({ where: { id: noteId, businessId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.staffId !== staffId) {
      throw new ForbiddenException('You can only edit your own notes');
    }
    return this.prisma.customerNote.update({
      where: { id: noteId },
      data: { content: content.trim() },
      include: { staff: { select: { id: true, name: true } } },
    });
  }

  async deleteNote(businessId: string, noteId: string, staffId: string) {
    const note = await this.prisma.customerNote.findFirst({ where: { id: noteId, businessId } });
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (note.staffId !== staffId) {
      throw new ForbiddenException('You can only delete your own notes');
    }
    return this.prisma.customerNote.delete({ where: { id: noteId } });
  }

  // ─── Unified Timeline ────────────────────────────────────────────────

  async getTimeline(
    businessId: string,
    customerId: string,
    opts: { types?: string[]; showSystem?: boolean; limit?: number; offset?: number } = {},
  ) {
    const { types, showSystem = true, limit = 20, offset = 0 } = opts;

    const [bookings, conversations, notes, waitlistEntries, quotes, campaignSends] =
      await Promise.all([
        !types || types.includes('booking')
          ? this.prisma.booking.findMany({
              where: { customerId, businessId },
              include: { service: true, staff: true },
            })
          : Promise.resolve([]),
        !types || types.includes('conversation')
          ? this.prisma.conversation.findMany({
              where: { customerId, businessId },
              include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
            })
          : Promise.resolve([]),
        !types || types.includes('note')
          ? this.prisma.customerNote.findMany({
              where: { customerId, businessId },
              include: { staff: { select: { id: true, name: true } } },
            })
          : Promise.resolve([]),
        !types || types.includes('waitlist')
          ? this.prisma.waitlistEntry.findMany({
              where: { customerId, businessId },
              include: { service: true },
            })
          : Promise.resolve([]),
        !types || types.includes('quote')
          ? this.prisma.quote.findMany({
              where: { businessId, booking: { customerId } },
              include: { booking: { include: { service: true } } },
            })
          : Promise.resolve([]),
        !types || types.includes('campaign')
          ? this.prisma.campaignSend.findMany({
              where: { customerId, campaign: { businessId } },
              include: { campaign: true },
            })
          : Promise.resolve([]),
      ]);

    const events: Array<{
      id: string;
      type: string;
      timestamp: string;
      title: string;
      description: string;
      metadata: any;
      isSystemEvent: boolean;
      deepLink: string | null;
    }> = [];

    // Bookings
    for (const b of bookings as any[]) {
      events.push({
        id: `booking-${b.id}`,
        type: 'booking',
        timestamp: b.createdAt.toISOString(),
        title: `${b.service?.name || 'Booking'} — ${b.status}`,
        description: b.staff?.name ? `with ${b.staff.name}` : 'Unassigned',
        metadata: { bookingId: b.id, status: b.status, serviceId: b.serviceId },
        isSystemEvent: false,
        deepLink: `/bookings/${b.id}`,
      });
    }

    // Conversations
    for (const c of conversations as any[]) {
      const lastMsg = c.messages?.[0];
      events.push({
        id: `conversation-${c.id}`,
        type: 'conversation',
        timestamp: (c.lastMessageAt || c.createdAt).toISOString(),
        title: `Conversation — ${c.status}`,
        description: lastMsg?.content?.substring(0, 100) || 'No messages',
        metadata: { conversationId: c.id, channel: c.channel },
        isSystemEvent: false,
        deepLink: `/inbox?conversationId=${c.id}`,
      });
    }

    // Notes
    for (const n of notes as any[]) {
      events.push({
        id: `note-${n.id}`,
        type: 'note',
        timestamp: n.createdAt.toISOString(),
        title: 'Note added',
        description: n.content.substring(0, 100),
        metadata: { noteId: n.id, staffName: n.staff?.name },
        isSystemEvent: false,
        deepLink: null,
      });
    }

    // Waitlist Entries
    for (const w of waitlistEntries as any[]) {
      events.push({
        id: `waitlist-${w.id}`,
        type: 'waitlist',
        timestamp: w.createdAt.toISOString(),
        title: `Waitlist — ${w.status}`,
        description: w.service?.name || 'Service',
        metadata: { waitlistId: w.id, status: w.status },
        isSystemEvent: true,
        deepLink: null,
      });
    }

    // Quotes
    for (const q of quotes as any[]) {
      events.push({
        id: `quote-${q.id}`,
        type: 'quote',
        timestamp: q.createdAt.toISOString(),
        title: `Quote — $${q.totalAmount} — ${q.status}`,
        description: q.description.substring(0, 100),
        metadata: { quoteId: q.id, bookingId: q.bookingId, status: q.status },
        isSystemEvent: false,
        deepLink: `/bookings/${q.bookingId}`,
      });
    }

    // Campaign Sends
    for (const cs of campaignSends as any[]) {
      events.push({
        id: `campaign-${cs.id}`,
        type: 'campaign',
        timestamp: (cs.sentAt || cs.createdAt).toISOString(),
        title: `Campaign: ${cs.campaign?.name || 'Unknown'}`,
        description: `Status: ${cs.status}`,
        metadata: { campaignSendId: cs.id, campaignId: cs.campaignId, status: cs.status },
        isSystemEvent: true,
        deepLink: `/campaigns`,
      });
    }

    // Filter system events
    const filtered = showSystem ? events : events.filter((e) => !e.isSystemEvent);

    // Sort by timestamp desc
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = filtered.length;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      events: paginated,
      total,
      hasMore: offset + limit < total,
    };
  }

  async getBookings(businessId: string, customerId: string) {
    return this.prisma.booking.findMany({
      where: { businessId, customerId },
      include: { service: true, staff: true, quotes: true },
      orderBy: { startTime: 'desc' },
    });
  }

  async bulkUpdate(businessId: string, ids: string[], action: 'tag' | 'untag', payload: any) {
    if (!ids?.length) throw new BadRequestException('No customer IDs provided');
    if (ids.length > 100)
      throw new BadRequestException('Cannot update more than 100 customers at once');

    if (action === 'tag') {
      if (!payload?.tag) throw new BadRequestException('Tag is required');
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: ids }, businessId },
        select: { id: true, tags: true },
      });
      let updated = 0;
      for (const c of customers) {
        const tags = (c.tags || []) as string[];
        if (!tags.includes(payload.tag)) {
          await this.prisma.customer.update({
            where: { id: c.id },
            data: { tags: [...tags, payload.tag] },
          });
          updated++;
        }
      }
      return { updated };
    }

    if (action === 'untag') {
      if (!payload?.tag) throw new BadRequestException('Tag is required');
      const customers = await this.prisma.customer.findMany({
        where: { id: { in: ids }, businessId },
        select: { id: true, tags: true },
      });
      let updated = 0;
      for (const c of customers) {
        const tags = (c.tags || []) as string[];
        if (tags.includes(payload.tag)) {
          await this.prisma.customer.update({
            where: { id: c.id },
            data: { tags: tags.filter((t) => t !== payload.tag) },
          });
          updated++;
        }
      }
      return { updated };
    }

    throw new BadRequestException(`Unknown bulk action: ${action}`);
  }

  async bulkCreate(
    businessId: string,
    customers: Array<{ name: string; phone: string; email?: string; tags?: string[] }>,
  ): Promise<{ created: number; skipped: number; errors: number }> {
    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const c of customers) {
      try {
        if (!c.phone) {
          errors++;
          continue;
        }
        const existing = await this.prisma.customer.findFirst({
          where: { businessId, phone: c.phone },
        });
        if (existing) {
          skipped++;
          continue;
        }
        await this.prisma.customer.create({
          data: {
            businessId,
            name: c.name || c.phone,
            phone: c.phone,
            email: c.email || undefined,
            tags: c.tags || [],
          },
        });
        created++;
      } catch (err: any) {
        this.logger.error(`Bulk create error for ${c.phone}: ${err.message}`, err.stack);
        errors++;
      }
    }

    return { created, skipped, errors };
  }

  async createFromConversations(
    businessId: string,
    includeMessages: boolean,
  ): Promise<{ created: number; updated: number }> {
    const created = 0;
    let updated = 0;

    const conversations = await this.prisma.conversation.findMany({
      where: { businessId },
      include: {
        customer: true,
        messages: includeMessages ? { orderBy: { createdAt: 'asc' as const }, take: 50 } : false,
      },
    });

    for (const conv of conversations) {
      try {
        const customer = conv.customer;
        if (!customer) continue;

        if (includeMessages && (conv as any).messages?.length > 0) {
          const profile = await this.profileExtractor.extract(
            (conv as any).messages.map((m: any) => ({
              direction: m.direction,
              content: m.content,
              createdAt: m.createdAt.toISOString(),
            })),
          );

          const updateData: any = {};
          if (profile.name && (!customer.name || customer.name === customer.phone)) {
            updateData.name = profile.name;
          }
          if (profile.email && !(customer as any).email) {
            updateData.email = profile.email;
          }
          if (profile.tags?.length) {
            const existingTags = (customer as any).tags || [];
            updateData.tags = [...new Set([...existingTags, ...profile.tags])];
          }
          if (profile.notes) {
            const existingFields = (customer as any).customFields || {};
            updateData.customFields = { ...existingFields, aiNotes: profile.notes };
          }

          if (Object.keys(updateData).length > 0) {
            await this.prisma.customer.update({
              where: { id: customer.id },
              data: updateData,
            });
            updated++;
          }
        }
      } catch (err: any) {
        this.logger.error(
          `Profile extraction failed for conversation ${conv.id}: ${err.message}`,
          err.stack,
        );
      }
    }

    return { created, updated };
  }
}
