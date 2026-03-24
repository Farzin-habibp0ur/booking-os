import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { randomBytes } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';
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
        submittedAt: new Date(),
      },
    });
  }

  async findAll(
    businessId: string,
    query: {
      status?: string;
      customerId?: string;
      search?: string;
      sortBy?: string;
      sortOrder?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const where: any = { businessId };
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { content: { contains: query.search, mode: 'insensitive' } },
        { company: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
    const orderBy = { [sortBy]: sortOrder };

    const [data, total] = await Promise.all([
      this.prisma.testimonial.findMany({
        where,
        include: { customer: { select: { id: true, name: true, email: true } } },
        orderBy,
        skip,
        take: pageSize,
      }),
      this.prisma.testimonial.count({ where }),
    ]);

    return { data, total, page, pageSize };
  }

  // MED-09: Bulk action
  async bulkAction(businessId: string, ids: string[], action: 'approve' | 'reject' | 'delete') {
    const where = { id: { in: ids }, businessId };

    switch (action) {
      case 'approve':
        await this.prisma.testimonial.updateMany({ where, data: { status: 'APPROVED' } });
        break;
      case 'reject':
        await this.prisma.testimonial.updateMany({ where, data: { status: 'REJECTED' } });
        break;
      case 'delete':
        await this.prisma.testimonial.deleteMany({ where });
        break;
    }

    return { processed: ids.length, action };
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
    const existing = await this.findOne(businessId, id);

    const data: any = {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.content !== undefined && { content: dto.content }),
      ...(dto.rating !== undefined && { rating: dto.rating }),
      ...(dto.role !== undefined && { role: dto.role }),
      ...(dto.company !== undefined && { company: dto.company }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
    };

    // Set submittedAt if this is the first time content is being provided
    if (dto.content && !existing.submittedAt) {
      data.submittedAt = new Date();
    }

    return this.prisma.testimonial.update({
      where: { id },
      data,
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

    const submissionToken = randomBytes(32).toString('hex');

    const testimonial = await this.prisma.testimonial.create({
      data: {
        businessId,
        customerId,
        name: customer.name,
        content: '',
        source: 'REQUESTED',
        status: 'PENDING',
        requestedAt: new Date(),
        submissionToken,
      },
    });

    if (customer.email && this.notificationQueue) {
      const submitUrl = `${process.env.NEXT_PUBLIC_URL || 'https://businesscommandcentre.com'}/testimonials/submit/${submissionToken}`;
      try {
        await this.notificationQueue.add('testimonial-request', {
          to: customer.email,
          subject: `${business?.name || 'We'} would love your feedback!`,
          html: `<p>Hi ${customer.name},</p><p>We hope you enjoyed your experience with ${business?.name || 'us'}. We'd love to hear your feedback!</p><p><a href="${submitUrl}" style="display:inline-block;padding:12px 24px;background:#71907C;color:white;border-radius:12px;text-decoration:none;font-weight:500;">Share Your Experience</a></p><p>Thank you!</p>`,
        });
      } catch (err) {
        this.logger.warn(`Failed to enqueue testimonial request email: ${(err as Error).message}`);
      }
    }

    return testimonial;
  }

  // HIGH-08: Verify submission token (public, no auth)
  async verifyToken(token: string) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { submissionToken: token },
      include: { business: { select: { name: true, slug: true } } },
    });
    if (!testimonial) throw new NotFoundException('Invalid or expired link');
    // Defensive: token is nullified on submit, but guard against race conditions
    if (testimonial.submittedAt) throw new BadRequestException('Already submitted');

    return {
      businessName: testimonial.business.name,
      customerName: testimonial.name,
    };
  }

  // HIGH-08: Submit testimonial by token (public, no auth)
  async submitByToken(dto: { token: string; content: string; rating: number; name?: string }) {
    const testimonial = await this.prisma.testimonial.findUnique({
      where: { submissionToken: dto.token },
    });
    if (!testimonial) throw new NotFoundException('Invalid or expired link');
    if (testimonial.submittedAt) throw new BadRequestException('Already submitted');

    return this.prisma.testimonial.update({
      where: { id: testimonial.id },
      data: {
        content: dto.content,
        rating: dto.rating,
        name: dto.name || testimonial.name,
        status: 'PENDING',
        submittedAt: new Date(),
        submissionToken: null, // Invalidate token after use
      },
    });
  }

  // MED-10: Send reminders for unanswered testimonial requests
  @Cron(CronExpression.EVERY_DAY_AT_10AM)
  async sendPendingReminders() {
    const defaultReminderDays = 5;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - defaultReminderDays);

    const pendingRequests = await this.prisma.testimonial.findMany({
      where: {
        source: 'REQUESTED',
        submittedAt: null,
        requestedAt: { lte: cutoff },
        status: 'PENDING',
        reminderSentAt: null,
        submissionToken: { not: null },
      },
      include: {
        customer: { select: { email: true, name: true } },
        business: { select: { name: true } },
      },
    });

    for (const testimonial of pendingRequests) {
      if (!testimonial.customer?.email || !this.notificationQueue) continue;

      try {
        const submitUrl = `${process.env.NEXT_PUBLIC_URL || 'https://businesscommandcentre.com'}/testimonials/submit/${testimonial.submissionToken}`;
        await this.notificationQueue.add('testimonial-reminder', {
          to: testimonial.customer.email,
          subject: `Reminder: ${testimonial.business.name} would love your feedback!`,
          html: `<p>Hi ${testimonial.customer.name},</p><p>We sent you a review request a few days ago. We'd still love to hear about your experience with ${testimonial.business.name}!</p><p><a href="${submitUrl}" style="display:inline-block;padding:12px 24px;background:#71907C;color:white;border-radius:12px;text-decoration:none;font-weight:500;">Share Your Experience</a></p>`,
        });

        await this.prisma.testimonial.update({
          where: { id: testimonial.id },
          data: { reminderSentAt: new Date() },
        });
      } catch (err) {
        this.logger.warn(`Failed to send testimonial reminder: ${(err as Error).message}`);
      }
    }

    if (pendingRequests.length > 0) {
      this.logger.log(`Sent ${pendingRequests.length} testimonial reminder(s)`);
    }
  }

  // MED-06: Dashboard stats
  async getDashboardStats(businessId: string) {
    const [pending, approved, featured, total, avgRating] = await Promise.all([
      this.prisma.testimonial.count({ where: { businessId, status: 'PENDING' } }),
      this.prisma.testimonial.count({ where: { businessId, status: 'APPROVED' } }),
      this.prisma.testimonial.count({ where: { businessId, status: 'FEATURED' } }),
      this.prisma.testimonial.count({ where: { businessId } }),
      this.prisma.testimonial.aggregate({
        where: { businessId, status: { in: ['APPROVED', 'FEATURED'] }, rating: { not: null } },
        _avg: { rating: true },
      }),
    ]);
    return {
      pending,
      approved,
      featured,
      total,
      avgRating: avgRating._avg.rating || 0,
    };
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
        { status: 'desc' }, // Desc: REJECTED > PENDING > FEATURED > APPROVED — FEATURED appears before APPROVED
        { rating: { sort: 'desc', nulls: 'last' } },
        { createdAt: 'desc' },
      ],
    });
  }
}
