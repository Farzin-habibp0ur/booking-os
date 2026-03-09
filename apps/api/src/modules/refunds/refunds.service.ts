import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma.service';
import { CreateRefundDto, ListRefundsDto } from './dto';
import Stripe from 'stripe';

@Injectable()
export class RefundsService {
  private readonly logger = new Logger(RefundsService.name);
  private stripe: Stripe | null = null;

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {
    const secretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (secretKey) {
      this.stripe = new Stripe(secretKey);
    }
  }

  async create(businessId: string, dto: CreateRefundDto, processedById: string) {
    // 1. Find the payment and verify ownership
    const payment = await this.prisma.payment.findFirst({
      where: { id: dto.paymentId, businessId },
      include: { refunds: true },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    // 2. Calculate already-refunded amount
    const refundedAmount = payment.refunds
      .filter((r: any) => r.status === 'COMPLETED')
      .reduce((sum: number, r: any) => sum + r.amount, 0);

    const refundableAmount = payment.amount - refundedAmount;

    if (dto.amount > refundableAmount) {
      throw new BadRequestException(
        `Refund amount exceeds refundable balance. Max refundable: $${refundableAmount.toFixed(2)}`,
      );
    }

    // 3. If Stripe payment, process via Stripe
    let stripeRefundId: string | undefined;
    if (payment.stripePaymentIntentId && this.stripe) {
      try {
        const stripeRefund = await this.stripe.refunds.create({
          payment_intent: payment.stripePaymentIntentId,
          amount: Math.round(dto.amount * 100), // Stripe uses cents
          reason: 'requested_by_customer',
        });
        stripeRefundId = stripeRefund.id;
      } catch (err: any) {
        this.logger.error(`Stripe refund failed: ${err.message}`);
        // Create refund record with FAILED status
        return this.prisma.refund.create({
          data: {
            businessId,
            paymentId: dto.paymentId,
            amount: dto.amount,
            reason: dto.reason,
            status: 'FAILED',
            processedById,
          },
          include: { payment: true },
        });
      }
    }

    // 4. Create refund record
    const refund = await this.prisma.refund.create({
      data: {
        businessId,
        paymentId: dto.paymentId,
        amount: dto.amount,
        reason: dto.reason,
        status: 'COMPLETED',
        stripeRefundId,
        processedById,
        processedAt: new Date(),
      },
      include: { payment: true },
    });

    // 5. Update payment status
    const newRefundedTotal = refundedAmount + dto.amount;
    const newStatus = newRefundedTotal >= payment.amount ? 'REFUNDED' : 'PARTIAL_REFUND';

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus },
    });

    // 6. Create action history (best-effort)
    try {
      await this.prisma.actionHistory.create({
        data: {
          businessId,
          actorType: 'STAFF',
          actorId: processedById,
          action: 'REFUND_PROCESSED',
          entityType: 'BOOKING',
          entityId: payment.bookingId || payment.id,
          description: `Refund of $${dto.amount.toFixed(2)} processed`,
          metadata: {
            paymentId: payment.id,
            refundId: refund.id,
            amount: dto.amount,
            method: payment.method,
            reason: dto.reason,
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to create action history for refund: ${err.message}`);
    }

    return refund;
  }

  async findAll(businessId: string, query: ListRefundsDto) {
    const where: any = { businessId };
    if (query.paymentId) where.paymentId = query.paymentId;

    const skip = query.skip ? parseInt(query.skip, 10) : 0;
    const take = query.take ? parseInt(query.take, 10) : 20;

    const [data, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { payment: true },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return { data, total };
  }

  async findOne(businessId: string, id: string) {
    const refund = await this.prisma.refund.findFirst({
      where: { id, businessId },
      include: { payment: true },
    });

    if (!refund) {
      throw new NotFoundException('Refund not found');
    }

    return refund;
  }
}
