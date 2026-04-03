import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ProfileExtractor } from '../ai/profile-extractor';
import { AutomationExecutorService } from '../automation/automation-executor.service';

@Injectable()
export class CustomerService {
  private readonly logger = new Logger(CustomerService.name);

  constructor(
    private prisma: PrismaService,
    private profileExtractor: ProfileExtractor,
    @Optional()
    @Inject(forwardRef(() => AutomationExecutorService))
    private automationExecutor?: AutomationExecutorService,
  ) {}

  private static readonly VALID_SORT_FIELDS = ['name', 'email', 'phone', 'createdAt'];

  async findAll(
    businessId: string,
    query: {
      search?: string;
      page?: number;
      pageSize?: number;
      sortBy?: string;
      sortOrder?: string;
    },
  ) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { businessId, deletedAt: null };
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    let orderBy: any = { createdAt: 'desc' };
    if (query.sortBy && CustomerService.VALID_SORT_FIELDS.includes(query.sortBy)) {
      const dir = query.sortOrder === 'asc' ? 'asc' : 'desc';
      orderBy = { [query.sortBy]: dir };
    }
    const [customers, total] = await Promise.all([
      this.prisma.customer.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy,
        include: {
          _count: { select: { bookings: true } },
          bookings: {
            where: { status: { in: ['COMPLETED', 'CONFIRMED', 'IN_PROGRESS'] } },
            orderBy: { startTime: 'desc' },
            take: 1,
            select: { startTime: true, service: { select: { price: true } } },
          },
        },
      }),
      this.prisma.customer.count({ where }),
    ]);

    // Compute totalSpent per customer (sum of service prices for completed bookings)
    const customerIds = customers.map((c) => c.id);
    const spentResults =
      customerIds.length > 0
        ? await this.prisma.booking.groupBy({
            by: ['customerId'],
            where: {
              businessId,
              customerId: { in: customerIds },
              status: 'COMPLETED',
            },
            _count: { id: true },
          })
        : [];

    // Get actual totals via raw aggregation on service prices
    const spentTotals =
      customerIds.length > 0
        ? await this.prisma.$queryRaw<Array<{ customerId: string; total: number }>>`
            SELECT b."customerId", COALESCE(SUM(s.price), 0) as total
            FROM bookings b
            JOIN services s ON b."serviceId" = s.id
            WHERE b."businessId" = ${businessId}
              AND b."customerId" = ANY(${customerIds}::text[])
              AND b.status = 'COMPLETED'
            GROUP BY b."customerId"
          `
        : [];

    const spentMap = new Map(spentTotals.map((r) => [r.customerId, Number(r.total)]));

    const data = customers.map((c) => ({
      ...c,
      bookingsCount: c._count.bookings,
      totalSpent: spentMap.get(c.id) ?? 0,
    }));

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(businessId: string, id: string) {
    return this.prisma.customer.findFirst({ where: { id, businessId, deletedAt: null } });
  }

  async softDelete(businessId: string, id: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id, businessId, deletedAt: null },
    });
    if (!customer) throw new NotFoundException('Customer not found');
    return this.prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
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

  async findOrCreateByInstagramId(businessId: string, instagramUserId: string, name?: string) {
    let customer = await this.prisma.customer.findFirst({
      where: { businessId, instagramUserId },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          businessId,
          phone: `ig:${instagramUserId}`,
          name: name || `Instagram User ${instagramUserId.slice(-6)}`,
          instagramUserId,
        },
      });
    }
    return customer;
  }

  async findOrCreateByFacebookPsid(businessId: string, facebookPsid: string, name?: string) {
    let customer = await this.prisma.customer.findFirst({
      where: { businessId, facebookPsid },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          businessId,
          phone: `fb:${facebookPsid}`,
          name: name || `Facebook User ${facebookPsid.slice(-6)}`,
          facebookPsid,
        },
      });
    }
    return customer;
  }

  async findOrCreateByWebChatSessionId(
    businessId: string,
    webChatSessionId: string,
    name?: string,
  ) {
    let customer = await this.prisma.customer.findFirst({
      where: { businessId, webChatSessionId },
    });
    if (!customer) {
      customer = await this.prisma.customer.create({
        data: {
          businessId,
          phone: `web:${webChatSessionId}`,
          name: name || `Web Visitor ${webChatSessionId.slice(-6)}`,
          webChatSessionId,
        },
      });
    }
    return customer;
  }

  async create(
    businessId: string,
    data: { name: string; phone: string; email?: string; tags?: string[]; customFields?: any },
  ) {
    const created = await this.prisma.customer.create({ data: { businessId, ...data } });

    if (this.automationExecutor) {
      this.automationExecutor
        .evaluateTrigger('CUSTOMER_CREATED', {
          businessId: created.businessId,
          customerId: created.id,
          customerName: created.name,
          customerEmail: created.email,
          customerPhone: created.phone,
        })
        .catch((err) => this.logger.warn(`CUSTOMER_CREATED trigger failed: ${err.message}`));
    }

    return created;
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

    const [
      bookings,
      conversations,
      notes,
      waitlistEntries,
      quotes,
      campaignSends,
      invoices,
      clinicalPhotos,
      deals,
      testDrives,
    ] = await Promise.all([
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
      !types || types.includes('invoice')
        ? this.prisma.invoice.findMany({
            where: { customerId, businessId },
            include: { lineItems: true },
          })
        : Promise.resolve([]),
      !types || types.includes('photo')
        ? this.prisma.clinicalPhoto.findMany({
            where: { customerId, businessId, deletedAt: null },
            select: { id: true, type: true, bodyArea: true, createdAt: true },
          })
        : Promise.resolve([]),
      !types || types.includes('deal')
        ? this.prisma.deal.findMany({
            where: { customerId, businessId },
            include: {
              vehicle: { select: { year: true, make: true, model: true } },
              assignedTo: { select: { name: true } },
            },
          })
        : Promise.resolve([]),
      !types || types.includes('testDrive')
        ? this.prisma.testDrive.findMany({
            where: { customer: { id: customerId }, vehicle: { businessId } },
            include: {
              vehicle: { select: { year: true, make: true, model: true } },
              staff: { select: { name: true } },
            },
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

    // Invoices
    for (const inv of invoices as any[]) {
      events.push({
        id: `invoice-${inv.id}`,
        type: 'invoice',
        timestamp: inv.createdAt.toISOString(),
        title: `Invoice ${inv.invoiceNumber} — $${Number(inv.total).toFixed(2)} — ${inv.status}`,
        description: inv.lineItems?.map((li: any) => li.description).join(', ') || '',
        metadata: { invoiceId: inv.id, status: inv.status, total: Number(inv.total) },
        isSystemEvent: false,
        deepLink: `/invoices/${inv.id}`,
      });
    }

    // Clinical Photos
    for (const photo of clinicalPhotos as any[]) {
      events.push({
        id: `photo-${photo.id}`,
        type: 'photo',
        timestamp: photo.createdAt.toISOString(),
        title: `${photo.type} photo — ${photo.bodyArea}`,
        description: `Clinical photo uploaded`,
        metadata: { photoId: photo.id, photoType: photo.type, bodyArea: photo.bodyArea },
        isSystemEvent: false,
        deepLink: null,
      });
    }

    // Deals
    for (const d of deals as any[]) {
      const vehicleLabel = d.vehicle
        ? `${d.vehicle.year} ${d.vehicle.make} ${d.vehicle.model}`
        : '';
      const value = d.dealValue ? ` — $${Number(d.dealValue).toLocaleString()}` : '';
      events.push({
        id: `deal-${d.id}`,
        type: 'deal',
        timestamp: d.updatedAt.toISOString(),
        title: `Deal — ${d.stage}${value}`,
        description: [vehicleLabel, d.assignedTo?.name ? `Assigned to ${d.assignedTo.name}` : '']
          .filter(Boolean)
          .join(' · '),
        metadata: { dealId: d.id, stage: d.stage, vehicleId: d.vehicleId },
        isSystemEvent: false,
        deepLink: `/pipeline/${d.id}`,
      });
    }

    // Test Drives
    for (const td of testDrives as any[]) {
      const vehicleLabel = td.vehicle
        ? `${td.vehicle.year} ${td.vehicle.make} ${td.vehicle.model}`
        : 'Vehicle';
      events.push({
        id: `testDrive-${td.id}`,
        type: 'testDrive',
        timestamp: td.createdAt.toISOString(),
        title: `Test Drive — ${vehicleLabel}`,
        description: [
          td.status,
          td.feedback ? td.feedback.substring(0, 100) : '',
          td.staff?.name ? `with ${td.staff.name}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        metadata: { testDriveId: td.id, vehicleId: td.vehicleId, status: td.status },
        isSystemEvent: false,
        deepLink: null,
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

  async getJourney(businessId: string, customerId: string) {
    // Verify dealership vertical
    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
      select: { verticalPack: true },
    });
    if (business?.verticalPack !== 'dealership') {
      return null;
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId, deletedAt: null },
    });
    if (!customer) return null;

    const [deals, testDrives, bookings, conversations] = await Promise.all([
      this.prisma.deal.findMany({
        where: { customerId, businessId },
        include: {
          vehicle: {
            select: {
              id: true,
              stockNumber: true,
              year: true,
              make: true,
              model: true,
              trim: true,
              askingPrice: true,
              status: true,
              imageUrls: true,
            },
          },
          assignedTo: { select: { id: true, name: true } },
          stageHistory: {
            include: { changedBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'asc' },
          },
          activities: {
            include: { createdBy: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.testDrive.findMany({
        where: { vehicle: { businessId }, customer: { id: customerId } },
        include: {
          vehicle: {
            select: {
              id: true,
              stockNumber: true,
              year: true,
              make: true,
              model: true,
              trim: true,
            },
          },
          staff: { select: { id: true, name: true } },
          booking: { select: { id: true, status: true, startTime: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.booking.findMany({
        where: { customerId, businessId },
        include: { service: true, staff: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.conversation.findMany({
        where: { customerId, businessId },
        select: { id: true, channel: true, createdAt: true, status: true },
        orderBy: { createdAt: 'asc' },
        take: 1,
      }),
    ]);

    // First contact
    const firstContact = conversations[0]
      ? { date: conversations[0].createdAt, channel: conversations[0].channel }
      : bookings.length > 0
        ? { date: bookings[bookings.length - 1].createdAt, channel: 'BOOKING' }
        : { date: customer.createdAt, channel: 'MANUAL' };

    // Vehicles of interest (from deals + test drives)
    const vehicleMap = new Map<string, any>();
    for (const deal of deals) {
      if (deal.vehicle) vehicleMap.set(deal.vehicle.id, deal.vehicle);
    }
    for (const td of testDrives) {
      if (td.vehicle) vehicleMap.set(td.vehicle.id, td.vehicle);
    }
    const vehiclesOfInterest = Array.from(vehicleMap.values());

    // Stats
    const wonDeals = deals.filter((d) => d.stage === 'CLOSED_WON');
    const totalWonValue = wonDeals.reduce(
      (sum, d) => sum + (d.dealValue ? Number(d.dealValue) : 0),
      0,
    );
    const totalVisits = bookings.length;
    const testDriveCount = testDrives.length;

    // Engagement score (simple heuristic: 0-100)
    let engagementScore = 0;
    engagementScore += Math.min(totalVisits * 10, 30); // up to 30 for visits
    engagementScore += Math.min(testDriveCount * 15, 30); // up to 30 for test drives
    engagementScore += deals.some((d) => !['CLOSED_WON', 'CLOSED_LOST'].includes(d.stage)) ? 20 : 0; // active deal
    engagementScore += wonDeals.length > 0 ? 20 : 0; // has won deal
    engagementScore = Math.min(engagementScore, 100);

    return {
      customerId,
      firstContact,
      deals,
      testDrives,
      vehiclesOfInterest,
      stats: {
        totalWonValue,
        totalVisits,
        testDriveCount,
        activeDeals: deals.filter((d) => !['CLOSED_WON', 'CLOSED_LOST'].includes(d.stage)).length,
        wonDeals: wonDeals.length,
        lostDeals: deals.filter((d) => d.stage === 'CLOSED_LOST').length,
        engagementScore,
      },
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
