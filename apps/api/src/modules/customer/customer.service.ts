import { Injectable, Logger } from '@nestjs/common';
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

  async getBookings(businessId: string, customerId: string) {
    return this.prisma.booking.findMany({
      where: { businessId, customerId },
      include: { service: true, staff: true },
      orderBy: { startTime: 'desc' },
    });
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
        this.logger.error(`Bulk create error for ${c.phone}: ${err.message}`);
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
        this.logger.error(`Profile extraction failed for conversation ${conv.id}: ${err.message}`);
      }
    }

    return { created, updated };
  }
}
