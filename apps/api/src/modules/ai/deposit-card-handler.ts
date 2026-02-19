import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ActionCardService } from '../action-card/action-card.service';
import { PolicyComplianceService } from './policy-compliance.service';

@Injectable()
export class DepositCardHandler {
  private readonly logger = new Logger(DepositCardHandler.name);

  constructor(
    private prisma: PrismaService,
    private actionCardService: ActionCardService,
    private policyCompliance: PolicyComplianceService,
  ) {}

  async createDepositCard(
    businessId: string,
    bookingId: string,
    customerId: string,
    serviceId: string,
    conversationId?: string,
  ) {
    try {
      // Check if deposit is required
      const policyCheck = await this.policyCompliance.checkDepositPolicy(businessId, serviceId);
      if (!policyCheck.allowed) {
        this.logger.log(`Deposit not required for service ${serviceId}: ${policyCheck.reason}`);
        return null;
      }

      // Check for existing pending deposit card for this booking
      const existing = await this.prisma.actionCard.findFirst({
        where: {
          businessId,
          bookingId,
          type: 'DEPOSIT_PENDING',
          status: 'PENDING',
        },
      });
      if (existing) {
        this.logger.log(`Deposit card already exists for booking ${bookingId}`);
        return existing;
      }

      // Get customer and service info for card text
      const [customer, service, booking] = await Promise.all([
        this.prisma.customer.findUnique({ where: { id: customerId } }),
        this.prisma.service.findFirst({ where: { id: serviceId, businessId } }),
        this.prisma.booking.findFirst({ where: { id: bookingId, businessId } }),
      ]);

      const customerName = customer?.name || 'Customer';
      const serviceName = service?.name || 'service';
      const depositAmount = service?.depositAmount || 0;
      const bookingDate = booking?.startTime
        ? booking.startTime.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : 'upcoming date';

      return await this.actionCardService.create({
        businessId,
        type: 'DEPOSIT_PENDING',
        category: 'URGENT_TODAY',
        priority: 85,
        title: `Collect deposit from ${customerName}`,
        description: `Because ${customerName}'s ${serviceName} appointment on ${bookingDate} requires a $${depositAmount.toFixed(2)} deposit that has not been collected.`,
        suggestedAction: 'Send deposit request via WhatsApp',
        bookingId,
        customerId,
        conversationId,
        expiresAt: booking?.startTime || undefined,
        metadata: {
          depositAmount,
          serviceId,
          serviceName,
          source: 'deposit-handler',
        },
      });
    } catch (err: any) {
      this.logger.error(
        `Failed to create deposit card for booking ${bookingId}: ${err.message}`,
      );
      return null;
    }
  }

  async checkAndCreateForBooking(businessId: string, bookingId: string) {
    try {
      const booking = await this.prisma.booking.findFirst({
        where: { id: bookingId, businessId },
        include: { service: true, customer: true },
      });

      if (!booking || !booking.service?.depositRequired) return null;
      if (booking.status === 'CANCELLED' || booking.status === 'COMPLETED') return null;

      // Check if deposit already paid
      const payment = await this.prisma.payment.findFirst({
        where: {
          bookingId,
          status: 'succeeded',
        },
      });

      if (payment) return null;

      return this.createDepositCard(
        businessId,
        bookingId,
        booking.customerId,
        booking.serviceId,
        booking.conversationId || undefined,
      );
    } catch (err: any) {
      this.logger.error(
        `Failed to check deposit for booking ${bookingId}: ${err.message}`,
      );
      return null;
    }
  }
}
