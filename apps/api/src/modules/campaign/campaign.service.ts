import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CampaignDispatchService } from './campaign-dispatch.service';

@Injectable()
export class CampaignService {
  constructor(
    private prisma: PrismaService,
    private dispatchService: CampaignDispatchService,
  ) {}

  async create(
    businessId: string,
    data: { name: string; templateId?: string; filters?: any; scheduledAt?: string },
  ) {
    return this.prisma.campaign.create({
      data: {
        businessId,
        name: data.name,
        templateId: data.templateId || null,
        filters: data.filters || {},
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
        status: 'DRAFT',
      },
    });
  }

  async findAll(businessId: string, query: { status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
    const where: any = { businessId };
    if (query.status) where.status = query.status;

    const [data, total] = await Promise.all([
      this.prisma.campaign.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { data, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async findById(businessId: string, id: string) {
    const campaign = await this.prisma.campaign.findFirst({ where: { id, businessId } });
    if (!campaign) throw new NotFoundException('Campaign not found');
    return campaign;
  }

  async update(
    businessId: string,
    id: string,
    data: {
      name?: string;
      templateId?: string;
      filters?: any;
      scheduledAt?: string;
      throttlePerMinute?: number;
    },
  ) {
    const campaign = await this.findById(businessId, id);
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Only draft campaigns can be edited');
    }
    return this.prisma.campaign.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.templateId !== undefined && { templateId: data.templateId }),
        ...(data.filters !== undefined && { filters: data.filters }),
        ...(data.scheduledAt !== undefined && { scheduledAt: new Date(data.scheduledAt) }),
        ...(data.throttlePerMinute !== undefined && { throttlePerMinute: data.throttlePerMinute }),
      },
    });
  }

  async delete(businessId: string, id: string) {
    const campaign = await this.findById(businessId, id);
    if (!['DRAFT', 'CANCELLED'].includes(campaign.status)) {
      throw new BadRequestException('Only draft or cancelled campaigns can be deleted');
    }
    await this.prisma.campaign.delete({ where: { id } });
    return { deleted: true };
  }

  async previewAudience(businessId: string, filters: any) {
    const where = this.buildAudienceWhere(businessId, filters);
    const [count, samples] = await Promise.all([
      this.prisma.customer.count({ where }),
      this.prisma.customer.findMany({
        where,
        select: { id: true, name: true, phone: true },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { count, samples };
  }

  buildAudienceWhere(businessId: string, filters: any) {
    const where: any = { businessId };

    if (filters?.tags?.length) {
      where.tags = { hasSome: filters.tags };
    }

    if (filters?.lastBookingBefore) {
      where.bookings = {
        every: {
          startTime: { lt: new Date(filters.lastBookingBefore) },
        },
      };
    }

    if (filters?.serviceKind) {
      where.bookings = {
        ...where.bookings,
        some: {
          service: { kind: filters.serviceKind },
        },
      };
    }

    if (filters?.noUpcomingBooking) {
      where.NOT = {
        bookings: {
          some: { startTime: { gte: new Date() } },
        },
      };
    }

    if (filters?.excludeDoNotMessage) {
      where.NOT = {
        ...where.NOT,
        tags: { has: 'do-not-message' },
      };
    }

    return where;
  }

  async sendCampaign(businessId: string, id: string) {
    const campaign = await this.findById(businessId, id);
    if (campaign.status !== 'DRAFT') {
      throw new BadRequestException('Only draft campaigns can be sent');
    }

    // Prepare send rows from audience
    const { total } = await this.dispatchService.prepareSends(
      id,
      businessId,
      campaign.filters as any,
    );

    // Update campaign to SENDING
    await this.prisma.campaign.update({
      where: { id },
      data: { status: 'SENDING', stats: { total, sent: 0, failed: 0, pending: total } },
    });

    return { status: 'SENDING', audienceSize: total };
  }
}
