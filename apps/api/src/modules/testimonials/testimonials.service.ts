import { Injectable, NotFoundException, BadRequestException, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../common/prisma.service';
import { QUEUE_NAMES } from '../../common/queue/queue.module';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';

const MAX_FEATURED = 6;

@Injectable()
export class TestimonialsService {
  private readonly logger = new Logger(TestimonialsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional() @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private notificationQueue?: Queue,
  ) {}

  async create(businessId: string, dto: CreateTestimonialDto) {
    return this.prisma.testimonial.create({
      data: {
        businessId,
        name: dto.name,
        content: dto.content,
        rating: dto.rating ?? null,
        role: dto.role ?? null,
        company: dto.company ?? null,
        customerId: dto.customerId ?? null,
        avatarUrl: dto.avatarUrl ?? null,
        source: 'MANUAL',
        status: 'PENDING',
      },
    });
  }

  async findAll(
    businessId: string,
    query: { status?: string; page?: number; pageSize?: number },
  ) {
    const where: any = { businessId };
    if (query.status) where.status = query.status;

    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      this.prisma.testimonial.findMany({
        where,
        include: { customer: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.testimonial.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  async findOne(businessId: string, id: string) {
    const testimonial = await this.prisma.testimonial.findFirst({
      where: { id, businessId },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    return testimonial;
  }

  async update(businessId: string, id: string, dto: UpdateTestimonialDto) {
    await this.findOne(businessId, id);
    return this.prisma.testimonial.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.rating !== undefined && { rating: dto.rating }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      },
    });
  }

  async approve(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.testimonial.update({
      where: { id },
      data: { status: 'APPROVED' },
    });
  }

  async reject(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.testimonial.update({
      where: { id },
      data: { status: 'REJECTED' },
    });
  }

  async feature(businessId: string, id: string) {
    await this.findOne(businessId, id);

    const featuredCount = await this.prisma.testimonial.count({
      where: { businessId, status: 'FEATURED' },
    });

    if (featuredCount >= MAX_FEATURED) {
      // Auto-demote the oldest featured testimonial
      const oldest = await this.prisma.testimonial.findFirst({
        where: { businessId, status: 'FEATURED' },
        orderBy: { updatedAt: 'asc' },
      });
      if (oldest) {
        await this.prisma.testimonial.update({
          where: { id: oldest.id },
          data: { status: 'APPROVED' },
        });
      }
    }

    return this.prisma.testimonial.update({
      where: { id },
      data: { status: 'FEATURED' },
    });
  }

  async delete(businessId: string, id: string) {
    await this.findOne(businessId, id);
    return this.prisma.testimonial.delete({ where: { id } });
  }

  async sendRequest(businessId: string, customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, businessId },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    const business = await this.prisma.business.findUnique({
      where: { id: businessId },
    });

    const testimonial = await this.prisma.testimonial.create({
      data: {
        businessId,
        customerId,
        name: customer.name,
        content: '',
        source: 'REQUESTED',
        status: 'PENDING',
        requestedAt: new Date(),
      },
    });

    if (customer.email && this.notificationQueue) {
      try {
        await this.notificationQueue.add('testimonial-request', {
          to: customer.email,
          subject: `${business?.name || 'We'} would love your feedback!`,
          html: `<p>Hi ${customer.name},</p><p>We hope you enjoyed your experience with ${business?.name || 'us'}. We'd love to hear your feedback!</p><p>Please take a moment to share your thoughts — it means a lot to us.</p><p>Thank you!</p>`,
        });
      } catch (err) {
        this.logger.warn(`Failed to enqueue testimonial request email: ${(err as Error).message}`);
      }
    }

    return testimonial;
  }

  async findPublic(businessSlug: string) {
    const business = await this.prisma.business.findUnique({
      where: { slug: businessSlug },
    });
    if (!business) throw new NotFoundException('Business not found');

    return this.prisma.testimonial.findMany({
      where: {
        businessId: business.id,
        status: { in: ['APPROVED', 'FEATURED'] },
      },
      select: {
        id: true,
        name: true,
        role: true,
        company: true,
        content: true,
        rating: true,
        status: true,
        avatarUrl: true,
        createdAt: true,
      },
      orderBy: [
        { status: 'desc' }, // FEATURED sorts after APPROVED alphabetically — we handle in code
        { rating: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
  }
}
