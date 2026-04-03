import {
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreatePaymentDto, ListPaymentsDto, UpdatePaymentDto } from './dto';
import { AutomationExecutorService } from '../automation/automation-executor.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    @Optional()
    @Inject(forwardRef(() => AutomationExecutorService))
    private automationExecutor?: AutomationExecutorService,
  ) {}

  async create(businessId: string, data: CreatePaymentDto, recordedById: string) {
    const payment = await this.prisma.payment.create({
      data: {
        businessId,
        bookingId: data.bookingId,
        customerId: data.customerId,
        amount: data.amount,
        method: data.method,
        reference: data.reference,
        notes: data.notes,
        recordedById,
      },
      include: {
        booking: true,
        customer: true,
      },
    });

    if (this.automationExecutor) {
      this.automationExecutor
        .evaluateTrigger('PAYMENT_RECEIVED', {
          businessId,
          customerId: data.customerId,
          bookingId: data.bookingId,
          amount: payment.amount,
          paymentMethod: payment.method,
        })
        .catch((err) => this.logger.warn(`PAYMENT_RECEIVED trigger failed: ${err.message}`));
    }

    return payment;
  }

  async findAll(businessId: string, query: ListPaymentsDto) {
    const where: any = { businessId };

    if (query.bookingId) where.bookingId = query.bookingId;
    if (query.customerId) where.customerId = query.customerId;

    if (query.from || query.to) {
      where.createdAt = {};
      if (query.from) where.createdAt.gte = new Date(query.from);
      if (query.to) where.createdAt.lte = new Date(query.to);
    }

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = query.take ? parseInt(query.take, 10) : 20;

    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { booking: true, customer: true },
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(businessId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, businessId },
      include: { booking: true, customer: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return payment;
  }

  async summary(businessId: string, from?: string, to?: string) {
    const where: any = { businessId };

    if (from || to) {
      where.createdAt = {};
      if (from) where.createdAt.gte = new Date(from);
      if (to) where.createdAt.lte = new Date(to);
    }

    const [aggregate, byMethod] = await Promise.all([
      this.prisma.payment.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
      this.prisma.payment.groupBy({
        by: ['method'],
        where,
        _sum: { amount: true },
        _count: { id: true },
      }),
    ]);

    return {
      totalAmount: aggregate._sum.amount || 0,
      count: aggregate._count.id,
      byMethod: byMethod.map((g) => ({
        method: g.method,
        totalAmount: g._sum.amount || 0,
        count: g._count.id,
      })),
    };
  }

  async update(businessId: string, id: string, data: UpdatePaymentDto) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, businessId },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.reference !== undefined && { reference: data.reference }),
      },
    });
  }
}
